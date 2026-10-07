'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { MusicRequestError, MusicRequestService } = require('../src/music/music-request-service');

function provider(overrides = {}) {
  return {
    async info() { return { id: 'abcdefghijk', title: 'Single', duration: 90 }; },
    async search() { return [{ id: 'abcdefghijk', title: 'Search result', duration: 90 }]; },
    async expandPlaylist() { return [{ videoId: 'abcdefghijk', title: 'Playlist item', duration: 90 }]; },
    ...overrides,
  };
}

test('resolves explicit YouTube URLs and title searches into safe queue tracks', async () => {
  const service = new MusicRequestService({ youtube: provider() });
  const direct = await service.resolve('https://youtube.com/watch?v=abcdefghijk', { requestedBy: 'room member' });
  assert.equal(direct.source, 'url');
  assert.equal(direct.tracks[0].videoId, 'abcdefghijk');
  assert.equal(direct.tracks[0].requestedBy, 'room member');

  const search = await service.resolve('ambient piano');
  assert.equal(search.source, 'search');
  assert.match(search.tracks[0].url, /^https:\/\/www\.youtube\.com\/watch\?/);
});

test('rejects non-YouTube URLs and live links without searching them as text', async () => {
  let searches = 0;
  const youtube = provider({ async search() { searches++; return []; } });
  const service = new MusicRequestService({ youtube });
  await assert.rejects(service.resolve('https://open.spotify.com/track/123'), { code: 'YOUTUBE_ONLY' });
  await assert.rejects(service.resolve('https://youtube.com/live/abcdefghijk'), { code: 'YOUTUBE_LIVE_UNSUPPORTED' });
  assert.equal(searches, 0);
});

test('search skips live, over-limit, and blocklisted results before selecting a playable result', async () => {
  const youtube = provider({
    async search() {
      return [
        { id: 'aaaaaaaaaaa', title: 'Live show', duration: 120, isLive: true },
        { id: 'bbbbbbbbbbb', title: 'Long song', duration: 4000 },
        { id: 'ccccccccccc', title: 'Blocked channel', duration: 180, channel: 'Noise Co' },
        { id: 'ddddddddddd', title: 'Allowed song', duration: 200, artist: 'Piano' },
      ];
    },
  });
  const service = new MusicRequestService({
    youtube,
    getSettings: () => ({ maxTrackDurationSeconds: 3600, musicBlockedKeywords: ['noise'] }),
  });
  const result = await service.resolve('piano');
  assert.equal(result.tracks[0].videoId, 'ddddddddddd');
  assert.equal(result.skippedCount, 3);
});

test('filters playlists and caps the number of candidates', async () => {
  let requestedCap;
  const youtube = provider({
    async expandPlaylist(_url, cap) {
      requestedCap = cap;
      return [
        { videoId: 'aaaaaaaaaaa', title: 'Live', duration: 0 },
        { videoId: 'bbbbbbbbbbb', title: 'First allowed', duration: 120 },
        { videoId: 'ccccccccccc', title: 'Too long', duration: 4000 },
      ];
    },
  });
  const service = new MusicRequestService({
    youtube,
    maxPlaylistItems: 2,
    getSettings: () => ({ maxTrackDurationSeconds: 3600 }),
  });
  const result = await service.resolve('https://youtube.com/playlist?list=PL1234567890');
  assert.equal(requestedCap, 2);
  assert.deepEqual(result.tracks.map(track => track.videoId), ['bbbbbbbbbbb']);
  assert.equal(result.skippedCount, 1);
});

test('reports why a direct track was rejected and requires verifiable duration', async () => {
  const blocked = new MusicRequestService({
    youtube: provider({ async info() { return { id: 'abcdefghijk', title: 'Blocked', duration: 120 }; } }),
    getSettings: () => ({ musicBlockedKeywords: ['blocked'] }),
  });
  await assert.rejects(blocked.resolve('https://youtu.be/abcdefghijk'), error => {
    assert.ok(error instanceof MusicRequestError);
    return error.code === 'MUSIC_BLOCKED';
  });

  const unknownDuration = new MusicRequestService({
    youtube: provider({ async info() { return { id: 'abcdefghijk', title: 'No metadata', duration: 0 }; } }),
  });
  await assert.rejects(unknownDuration.resolve('https://youtu.be/abcdefghijk'), { code: 'DURATION_UNAVAILABLE' });
});

test('accepts a track at the configured 60-minute boundary and rejects one second over', async () => {
  const atLimit = new MusicRequestService({
    youtube: provider({ async info() { return { id: 'abcdefghijk', title: 'At limit', duration: 3600 }; } }),
    getSettings: () => ({ maxTrackDurationSeconds: 3600 }),
  });
  const result = await atLimit.resolve('https://youtu.be/abcdefghijk');
  assert.equal(result.tracks[0].durationSeconds, 3600);

  const overLimit = new MusicRequestService({
    youtube: provider({ async info() { return { id: 'abcdefghijk', title: 'Over limit', duration: 3601 }; } }),
    getSettings: () => ({ maxTrackDurationSeconds: 3600 }),
  });
  await assert.rejects(overLimit.resolve('https://youtu.be/abcdefghijk'), { code: 'TRACK_TOO_LONG' });
});

test('autoplay mix candidates pass through live, duration, and blocklist guards', async () => {
  const youtube = provider({
    async mixCandidates(seedVideoId, limit) {
      assert.equal(seedVideoId, 'seedseedsee');
      assert.equal(limit, 12);
      return [
        { id: 'seedseedsee', title: 'Same track', duration: 120 },
        { id: 'aaaaaaaaaaa', title: 'Live candidate', duration: 120, isLive: true },
        { id: 'bbbbbbbbbbb', title: 'Too long', duration: 5000 },
        { id: 'ccccccccccc', title: 'Blocked filler', duration: 120 },
        { id: 'ddddddddddd', title: 'Allowed mix', duration: 180, artist: 'Artist' },
      ];
    },
  });
  const service = new MusicRequestService({
    youtube,
    getSettings: () => ({ maxTrackDurationSeconds: 3600, musicBlockedKeywords: ['filler'] }),
  });
  const tracks = await service.resolveAutoplay({ videoId: 'seedseedsee', title: 'Seed' }, { requestedBy: 'Listener' });
  assert.deepEqual(tracks.map(track => ({ videoId: track.videoId, source: track.source, requestedBy: track.requestedBy })), [
    { videoId: 'ddddddddddd', source: 'autoplay', requestedBy: 'Listener' },
  ]);
});
