'use strict';

const { matchBlockedMusic } = require('./music-content-blocklist');
const { detectMusicLink } = require('./music-link-parser');

const DEFAULT_MAX_TRACK_DURATION_SECONDS = 3600;
const DEFAULT_MAX_PLAYLIST_ITEMS = 50;
const MAX_PLAYLIST_ITEMS = 100;
const MAX_SEARCH_RESULTS = 15;

class MusicRequestError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'MusicRequestError';
    this.code = code;
  }
}

function isWebUrl(value) {
  const text = String(value || '').trim();
  return /^https?:\/\//i.test(text) || /^(?:www\.)?[^/\s]+\.[a-z]{2,}(?:\/|$)/i.test(text);
}

function candidateId(candidate) {
  const videoId = String(candidate?.videoId || candidate?.id || '').trim();
  return /^[A-Za-z0-9_-]{11}$/.test(videoId) ? videoId : '';
}

function candidateRejectReason(candidate, settings) {
  if (candidate?.isLive === true || candidate?.liveStatus === 'is_live' || candidate?.liveStatus === 'is_upcoming') {
    return 'YOUTUBE_LIVE_UNSUPPORTED';
  }
  const duration = Number(candidate?.duration);
  if (!Number.isFinite(duration) || duration <= 0) return 'DURATION_UNAVAILABLE';
  if (duration > settings.maxTrackDurationSeconds) return 'TRACK_TOO_LONG';
  if (matchBlockedMusic(candidate, settings.musicBlockedKeywords).blocked) return 'MUSIC_BLOCKED';
  return null;
}

function toTrack(candidate, requestedBy, source) {
  const videoId = candidateId(candidate);
  return {
    videoId,
    title: String(candidate.title || 'Unknown').trim() || 'Unknown',
    durationSeconds: Number(candidate.duration),
    url: `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,
    artist: String(candidate.artist || '').trim(),
    channel: String(candidate.channel || '').trim(),
    uploader: String(candidate.uploader || '').trim(),
    requestedBy: String(requestedBy || '').trim(),
    source,
  };
}

class MusicRequestService {
  constructor({ youtube, getSettings, maxPlaylistItems = DEFAULT_MAX_PLAYLIST_ITEMS } = {}) {
    if (!youtube?.info || !youtube?.search || !youtube?.expandPlaylist) {
      throw new TypeError('A YouTube provider with info/search/expandPlaylist is required');
    }
    this.youtube = youtube;
    this.getSettings = getSettings || (() => ({}));
    this.maxPlaylistItems = Math.max(1, Math.min(MAX_PLAYLIST_ITEMS, Math.trunc(Number(maxPlaylistItems)) || DEFAULT_MAX_PLAYLIST_ITEMS));
  }

  settingsSnapshot() {
    const settings = this.getSettings() || {};
    const maxTrackDurationSeconds = Number(settings.maxTrackDurationSeconds);
    return {
      maxTrackDurationSeconds: Number.isFinite(maxTrackDurationSeconds)
        ? Math.max(60, Math.min(86400, Math.trunc(maxTrackDurationSeconds)))
        : DEFAULT_MAX_TRACK_DURATION_SECONDS,
      musicBlockedKeywords: Array.isArray(settings.musicBlockedKeywords) ? settings.musicBlockedKeywords : [],
    };
  }

  async resolve(input, { requestedBy = '' } = {}) {
    const query = String(input || '').trim();
    if (!query) throw new MusicRequestError('EMPTY_REQUEST', 'Enter a YouTube URL or search phrase');

    const link = detectMusicLink(query);
    if (link?.kind === 'rejected') {
      throw new MusicRequestError('YOUTUBE_LIVE_UNSUPPORTED', 'YouTube live streams are not supported');
    }
    if (!link && isWebUrl(query)) {
      throw new MusicRequestError('YOUTUBE_ONLY', 'Only YouTube videos and playlists are supported');
    }

    let candidates;
    let source;
    if (link?.kind === 'playlist') {
      source = 'playlist';
      candidates = await this.youtube.expandPlaylist(link.url, this.maxPlaylistItems);
    } else if (link?.kind === 'video') {
      source = 'url';
      candidates = [await this.youtube.info(link.url)];
    } else {
      source = 'search';
      candidates = await this.youtube.search(query, MAX_SEARCH_RESULTS);
    }

    if (!Array.isArray(candidates) || candidates.length === 0) {
      throw new MusicRequestError('NO_RESULTS', 'No playable YouTube results were found');
    }

    const settings = this.settingsSnapshot();
    const tracks = [];
    const rejected = new Map();
    for (const candidate of candidates.slice(0, source === 'playlist' ? this.maxPlaylistItems : MAX_SEARCH_RESULTS)) {
      if (!candidateId(candidate)) continue;
      const reason = candidateRejectReason(candidate, settings);
      if (reason) {
        rejected.set(reason, (rejected.get(reason) || 0) + 1);
        continue;
      }
      tracks.push(toTrack(candidate, requestedBy, source));
      if (source !== 'playlist') break;
    }

    if (tracks.length === 0) {
      const reason = ['YOUTUBE_LIVE_UNSUPPORTED', 'TRACK_TOO_LONG', 'MUSIC_BLOCKED', 'DURATION_UNAVAILABLE']
        .find(code => rejected.has(code));
      if (reason === 'YOUTUBE_LIVE_UNSUPPORTED') throw new MusicRequestError(reason, 'YouTube live streams are not supported');
      if (reason === 'TRACK_TOO_LONG') throw new MusicRequestError(reason, `Track exceeds the ${Math.floor(settings.maxTrackDurationSeconds / 60)} minute limit`);
      if (reason === 'MUSIC_BLOCKED') throw new MusicRequestError(reason, 'This music is blocked by the owner settings');
      if (reason === 'DURATION_UNAVAILABLE') throw new MusicRequestError(reason, 'Track duration could not be verified');
      throw new MusicRequestError('NO_RESULTS', 'No playable YouTube results were found');
    }

    return {
      tracks,
      source,
      skippedCount: [...rejected.values()].reduce((sum, count) => sum + count, 0),
    };
  }

  async resolveAutoplay(seedTrack, { requestedBy = '' } = {}) {
    const seedVideoId = candidateId(seedTrack);
    if (!seedVideoId || typeof this.youtube.mixCandidates !== 'function') return [];
    const candidates = await this.youtube.mixCandidates(seedVideoId, 12);
    if (!Array.isArray(candidates)) return [];
    const settings = this.settingsSnapshot();
    const tracks = [];
    for (const candidate of candidates.slice(0, 12)) {
      if (candidateId(candidate) === seedVideoId || !candidateId(candidate)) continue;
      if (candidateRejectReason(candidate, settings)) continue;
      tracks.push(toTrack(candidate, requestedBy, 'autoplay'));
      if (tracks.length >= 1) break;
    }
    return tracks;
  }
}

module.exports = {
  DEFAULT_MAX_TRACK_DURATION_SECONDS,
  DEFAULT_MAX_PLAYLIST_ITEMS,
  MusicRequestError,
  MusicRequestService,
};
