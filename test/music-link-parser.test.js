'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { detectMusicLink } = require('../src/music/music-link-parser');

test('parses supported YouTube video and playlist URLs', () => {
  assert.deepEqual(detectMusicLink('https://youtu.be/abcdefghijk'), {
    source: 'youtube',
    kind: 'video',
    id: 'abcdefghijk',
    url: 'https://www.youtube.com/watch?v=abcdefghijk',
  });
  assert.equal(detectMusicLink('youtube.com/watch?v=abcdefghijk').id, 'abcdefghijk');
  assert.equal(detectMusicLink('https://www.youtube.com/watch?v=abcdefghijk&list=PL1234567890').kind, 'playlist');
  assert.equal(detectMusicLink('https://youtube.com/playlist?list=PL1234567890').kind, 'playlist');
});

test('does not accept live, non-YouTube, or malformed links', () => {
  assert.deepEqual(detectMusicLink('https://www.youtube.com/live/abcdefghijk'), {
    source: 'youtube', kind: 'rejected', reason: 'live',
  });
  assert.equal(detectMusicLink('https://open.spotify.com/track/123abc'), null);
  assert.equal(detectMusicLink('https://example.com/watch?v=abcdefghijk'), null);
  assert.equal(detectMusicLink('https://youtube.com/watch?v=short'), null);
});

test('treats a YouTube radio mix URL as a single video, not a playlist', () => {
  const result = detectMusicLink('https://youtube.com/watch?v=abcdefghijk&list=RDabcdefghijk');
  assert.equal(result.kind, 'video');
  assert.equal(result.id, 'abcdefghijk');
});
