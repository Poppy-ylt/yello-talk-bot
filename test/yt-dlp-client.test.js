'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { YtDlpClient } = require('../src/music/yt-dlp-client');

async function withCache(run) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ymb-audio-'));
  try { await run(directory); }
  finally { fs.rmSync(directory, { recursive: true, force: true }); }
}

function fakeExecFile(directory, calls, onCall = () => {}) {
  return (_command, args, options, callback) => {
    calls.push({ args, options });
    onCall({ args, callback, directory, calls });
  };
}

const track = { videoId: 'dQw4w9WgXcQ', durationSeconds: 213 };

test('downloads a validated YouTube track to the session cache and reuses it only in memory', async () => {
  await withCache(async directory => {
    const calls = [];
    const client = new YtDlpClient({
      execFile: fakeExecFile(directory, calls, ({ args, callback }) => {
        const output = args[args.indexOf('--output') + 1].replace('%(ext)s', 'm4a');
        fs.writeFileSync(output, 'audio');
        callback(null, output, '');
      }),
      createId: () => 'run1',
    });
    const downloaded = await client.download(track, { directory, format: 'm4a' });
    assert.equal(path.dirname(downloaded), directory);
    assert.equal(fs.readFileSync(downloaded, 'utf8'), 'audio');
    const args = calls[0].args;
    assert.equal(args[args.indexOf('--match-filter') + 1], '!is_live & duration<=3600');
    assert.equal(args.includes('--no-playlist'), true);
    assert.equal(args.at(-1), 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    assert.equal(await client.download(track, { directory, format: 'm4a' }), downloaded);
    assert.equal(calls.length, 1);
    assert.equal(await client.release(path.join(directory, '..', 'not-owned.m4a')), false);
    assert.equal(await client.release(downloaded), true);
    assert.equal(fs.existsSync(downloaded), false);
  });
});

test('selects the requested encoded format and retries only transient download errors', async () => {
  await withCache(async directory => {
    const calls = [];
    const retryWaits = [];
    const client = new YtDlpClient({
      execFile: fakeExecFile(directory, calls, ({ args, callback }) => {
        if (calls.length === 1) {
          const error = new Error('HTTP 403 Forbidden');
          error.stderr = 'ERROR: HTTP 403 Forbidden';
          callback(error, '', error.stderr);
          return;
        }
        const output = args[args.indexOf('--output') + 1].replace('%(ext)s', 'mp3');
        fs.writeFileSync(output, 'mp3');
        callback(null, output, '');
      }),
      createId: () => 'run2',
      wait: async ms => retryWaits.push(ms),
    });
    const downloaded = await client.download(track, { directory, format: 'mp3', attempts: 2, retryDelayMs: 100 });
    assert.equal(downloaded.endsWith('.mp3'), true);
    assert.equal(calls.length, 2);
    assert.deepEqual(retryWaits, [100]);
    assert.equal(calls[0].args[calls[0].args.indexOf('--extractor-args') + 1], 'youtube:player_client=web_embedded');
    assert.equal(calls[1].args.includes('mp3'), true);
  });
});

test('rejects unsupported formats, invalid IDs, and over-limit durations before executing yt-dlp', async () => {
  await withCache(async directory => {
    let calls = 0;
    const client = new YtDlpClient({ execFile: () => { calls++; } });
    await assert.rejects(client.download({ ...track, videoId: 'not valid' }, { directory }), /Invalid YouTube video ID/);
    await assert.rejects(client.download(track, { directory, format: 'wav' }), /Unsupported audio format/);
    await assert.rejects(client.download({ ...track, durationSeconds: 3610 }, { directory, maxTrackDurationSeconds: 3600 }), /duration/);
    await assert.rejects(client.download(track, { directory: path.parse(directory).root }), /dedicated audio cache/);
    assert.equal(calls, 0);
  });
});

test('removes only files created by a terminally failed download attempt', async () => {
  await withCache(async directory => {
    let partial;
    const client = new YtDlpClient({
      execFile: fakeExecFile(directory, [], ({ args, callback }) => {
        partial = args[args.indexOf('--output') + 1].replace('%(ext)s', 'm4a') + '.part';
        fs.writeFileSync(partial, 'partial');
        const error = new Error('HTTP 403 Forbidden');
        callback(error, '', 'ERROR: HTTP 403 Forbidden');
      }),
      createId: () => 'run3',
    });
    await assert.rejects(client.download(track, { directory, attempts: 1 }), /403/);
    assert.equal(fs.existsSync(partial), false);
    assert.deepEqual(fs.readdirSync(directory), []);
  });
});
