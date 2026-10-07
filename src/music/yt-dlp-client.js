'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { downloadNetworkArgs, isRetryableDownloadError } = require('./youtube-download-options');

const INFO_PLAYER_CLIENTS = Object.freeze(['android_vr', 'web_embedded', 'default']);

class YtDlpClient {
  constructor({ execFile, runtimeArgs = [], env, fsImpl = fs, createId = randomUUID, wait = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
    this.execFile = execFile;
    this.runtimeArgs = runtimeArgs;
    this.env = env;
    this.fs = fsImpl;
    this.createId = createId;
    this.wait = wait;
    this.sessionCache = new Map();
    this.ownedFiles = new Set();
  }

  async run(args, options) {
    const stdout = await this.execute(args, options);
    if (stdout.trim()) return stdout;

    // YouTube sometimes returns a search interstitial instead of video results.
    // Retry an empty keyword search once with explicit music context. Direct
    // video URLs still go through the usual availability and playback checks.
    const searchIndex = args.findIndex(arg => /^ytsearch\d+:/.test(arg));
    if (searchIndex < 0) return stdout;
    const fallbackArgs = [...args];
    fallbackArgs[searchIndex] += ' เพลง';
    return this.execute(fallbackArgs, options);
  }

  execute(args, options) {
    return new Promise((resolve, reject) => {
      const { allowStdoutOnError = false, ...execOptions } = options || {};
      this.execFile('yt-dlp', [...this.runtimeArgs, ...args], { ...execOptions, env: this.env, windowsHide: true }, (error, stdout, stderr) => {
        if (error && stderr) error.stderr = String(stderr);
        if (error && !allowStdoutOnError) return reject(error);
        if (error && !stdout) return reject(error);
        resolve(stdout || '');
      });
    });
  }

  async info(url, { attempts = 3, timeout = 30000, retryDelayMs = 500 } = {}) {
    const maxAttempts = Math.max(1, Math.min(5, Math.trunc(Number(attempts)) || 1));
    let lastError;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const playerClient = INFO_PLAYER_CLIENTS[Math.min(attempt, INFO_PLAYER_CLIENTS.length - 1)];
      try {
        const stdout = await this.run([
          '--force-ipv4',
          '--extractor-args', `youtube:fetch_pot=never;player_client=${playerClient}`,
          '--print', '%(title)s\n%(duration)s\n%(id)s\n%(is_live)s\n%(artist|)s\n%(channel|)s\n%(uploader|)s',
          '--no-playlist', url,
        ], { timeout });
        const lines = stdout.trim().split(/\r?\n/);
        const info = {
          title: lines[0] || 'Unknown',
          duration: parseInt(lines[1]) || 0,
          id: lines[2] || '',
          isLive: lines[3] === 'True',
          artist: lines[4] || '',
          channel: lines[5] || '',
          uploader: lines[6] || '',
        };
        if (!info.id) throw new Error('no YouTube metadata returned');
        return info;
      } catch (error) {
        lastError = error;
        if (attempt + 1 < maxAttempts && retryDelayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, retryDelayMs * (attempt + 1)));
        }
      }
    }
    throw lastError || new Error('YouTube metadata lookup failed');
  }

  async expandPlaylist(url, cap) {
    const stdout = await this.run([
      '--flat-playlist',
      '--extractor-args', 'youtube:fetch_pot=never',
      '-I', `1:${cap}`,
      '--print', '%(id)s\t%(title)s\t%(duration)s\t%(artist|)s\t%(channel|)s\t%(uploader|)s',
      url,
    ], { timeout: 30000, maxBuffer: 8 * 1024 * 1024, allowStdoutOnError: true });
    return stdout.trim().split(/\r?\n/).filter(Boolean).map(line => {
      const [videoId, title, duration, artist, channel, uploader] = line.split('\t');
      return {
        videoId,
        title: title || 'Unknown',
        duration: parseInt(duration) || 0,
        artist: artist || '',
        channel: channel || '',
        uploader: uploader || '',
      };
    }).filter(item => item.videoId
      && item.title !== '[Private video]'
      && item.title !== '[Deleted video]'
      && item.title !== '[Unavailable video]');
  }

  async resolveVideoId(query) {
    const stdout = await this.run([
      `ytsearch1:${query}`,
      '--extractor-args', 'youtube:fetch_pot=never',
      '--print', '%(id)s', '--no-download', '--flat-playlist',
    ], { timeout: 20000 });
    const id = (stdout.trim().split(/\r?\n/)[0] || '').trim();
    if (!id) throw new Error('no YouTube match');
    return id;
  }

  async candidates(source, { limit, timeout = 15000 } = {}) {
    const args = [
      source,
      '--print', '%(id)s\t%(title)s\t%(duration)s\t%(is_live)s\t%(live_status)s\t%(artist|)s\t%(channel|)s\t%(uploader|)s',
      '--no-download', '--flat-playlist',
    ];
    if (limit) args.push('--playlist-end', String(limit));
    const stdout = await this.run(args, { timeout });
    return stdout.trim().split(/\r?\n/).filter(Boolean).map(line => {
      const [id, title, duration, isLive, liveStatus, artist, channel, uploader] = line.split('\t');
      return {
        id,
        title: title || 'Unknown',
        duration: parseInt(duration) || 0,
        isLive: isLive === 'True' || liveStatus === 'is_live' || liveStatus === 'is_upcoming',
        artist: artist || '',
        channel: channel || '',
        uploader: uploader || '',
      };
    }).filter(item => item.id);
  }

  async mixCandidates(seedVideoId, limit = 20) {
    const source = `https://www.youtube.com/watch?v=${seedVideoId}&list=RD${seedVideoId}`;
    const items = await this.candidates(source, { limit });
    return items.filter(item => item.id !== seedVideoId);
  }

  searchCandidates(query, limit = 15) {
    return this.candidates(`ytsearch${limit}:${query}`);
  }

  async search(query, limit = 5) {
    const stdout = await this.run([
      `ytsearch${limit}:${query}`,
      '--print', '%(id)s\t%(title)s\t%(duration)s\t%(channel|)s\t%(artist|)s\t%(uploader|)s',
      '--no-download', '--flat-playlist',
    ], { timeout: 15000 });
    return stdout.trim().split(/\r?\n/).filter(Boolean).map(line => {
      const [id, title, duration, channel, artist, uploader] = line.split('\t');
      return {
        id,
        title: title || 'Unknown',
        duration: parseInt(duration) || 0,
        channel: channel || '',
        artist: artist || '',
        uploader: uploader || '',
        url: `https://www.youtube.com/watch?v=${id}`,
        thumbnail: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
      };
    }).filter(item => item.id);
  }

  async download(track, {
    directory,
    format = 'm4a',
    maxTrackDurationSeconds = 3600,
    attempts = 3,
    retryDelayMs = 1000,
    signal,
  } = {}) {
    const videoId = String(track?.videoId || '').trim();
    if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) throw new Error('Invalid YouTube video ID');
    if (!['m4a', 'hq', 'mp3'].includes(format)) throw new Error('Unsupported audio format');
    const durationLimit = Math.max(60, Math.min(86400, Math.trunc(Number(maxTrackDurationSeconds)) || 3600));
    if (!Number.isFinite(Number(track?.durationSeconds)) || Number(track.durationSeconds) <= 0
      || Number(track.durationSeconds) > durationLimit) throw new Error('Track duration is outside the configured limit');
    const cacheDirectory = path.resolve(String(directory || ''));
    const filesystemRoot = path.resolve(path.parse(cacheDirectory).root);
    if (!directory || cacheDirectory.toLowerCase() === filesystemRoot.toLowerCase()) {
      throw new Error('A dedicated audio cache directory is required');
    }
    this.fs.mkdirSync(cacheDirectory, { recursive: true });
    const cacheKey = `${videoId}:${format}`;
    const cachedFile = this.sessionCache.get(cacheKey);
    if (cachedFile && this.fs.existsSync(cachedFile)) return cachedFile;

    const runId = this.createId();
    const outputTemplate = path.join(cacheDirectory, `${videoId}.${runId}.%(ext)s`);
    const sourceUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
    const encodeArgs = format === 'm4a'
      ? ['-f', 'ba[ext=m4a]/140']
      : ['-f', 'bestaudio', '-x', '--audio-format', format === 'hq' ? 'm4a' : 'mp3', '--audio-quality', '0',
          '--postprocessor-args', 'ffmpeg:-b:a 256k'];
    const maxAttempts = Math.max(1, Math.min(5, Math.trunc(Number(attempts)) || 1));
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (signal?.aborted) throw new Error('Audio download was cancelled');
      try {
        const stdout = await this.run([
          ...encodeArgs,
          ...downloadNetworkArgs(attempt),
          '--no-playlist',
          '--no-progress',
          '--match-filter', `!is_live & duration<=${durationLimit}`,
          '--output', outputTemplate,
          '--print', 'after_move:filepath',
          sourceUrl,
        ], { timeout: 10 * 60 * 1000, maxBuffer: 2 * 1024 * 1024, signal });
        const outputFile = stdout.trim().split(/\r?\n/).at(-1)?.trim();
        if (!outputFile) throw new Error('yt-dlp did not return the downloaded audio path');
        const resolvedFile = path.resolve(outputFile);
        const basePrefix = `${videoId}.${runId}.`;
        if (path.dirname(resolvedFile) !== cacheDirectory || !path.basename(resolvedFile).startsWith(basePrefix)) {
          throw new Error('yt-dlp returned a path outside the session cache');
        }
        if (!this.fs.existsSync(resolvedFile) || this.fs.statSync(resolvedFile).size <= 0) {
          throw new Error('Downloaded audio file is missing or empty');
        }
        this.sessionCache.set(cacheKey, resolvedFile);
        this.ownedFiles.add(resolvedFile);
        return resolvedFile;
      } catch (error) {
        lastError = error;
        if (attempt >= maxAttempts || !isRetryableDownloadError(error)) {
          await this.cleanupRunArtifacts(cacheDirectory, `${videoId}.${runId}.`);
          throw error;
        }
        if (retryDelayMs > 0) await this.wait(retryDelayMs * attempt);
      }
    }
    throw lastError || new Error('Audio download failed');
  }

  async release(filePath) {
    const resolvedFile = path.resolve(String(filePath || ''));
    if (!this.ownedFiles.has(resolvedFile)) return false;
    for (const [key, cachedFile] of this.sessionCache) {
      if (path.resolve(cachedFile) === resolvedFile) this.sessionCache.delete(key);
    }
    try {
      await this.fs.promises.unlink(resolvedFile);
      this.ownedFiles.delete(resolvedFile);
      return true;
    } catch (error) {
      if (error?.code === 'ENOENT') {
        this.ownedFiles.delete(resolvedFile);
        return false;
      }
      throw error;
    }
  }

  async cleanupRunArtifacts(directory, prefix) {
    const cacheDirectory = path.resolve(directory);
    let names;
    try { names = await this.fs.promises.readdir(cacheDirectory); }
    catch { return; }
    for (const name of names) {
      if (!name.startsWith(prefix)) continue;
      const candidate = path.resolve(cacheDirectory, name);
      if (path.dirname(candidate) !== cacheDirectory) continue;
      try {
        const stat = await this.fs.promises.lstat(candidate);
        if (stat.isFile()) await this.fs.promises.unlink(candidate);
      } catch {}
    }
  }
}

module.exports = { YtDlpClient };
