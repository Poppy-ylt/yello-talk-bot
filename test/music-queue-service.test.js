'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { MusicQueueService } = require('../src/music/music-queue-service');

const tracks = [
  { videoId: 'aaaaaaaaaaa', title: 'A', durationSeconds: 60, url: 'https://youtu.be/aaaaaaaaaaa' },
  { videoId: 'bbbbbbbbbbb', title: 'B', durationSeconds: 70, url: 'https://youtu.be/bbbbbbbbbbb' },
  { videoId: 'ccccccccccc', title: 'C', durationSeconds: 80, url: 'https://youtu.be/ccccccccccc' },
];

test('starts in memory-only empty state and reports a safe queue projection', () => {
  const queue = new MusicQueueService({ createId: () => 'queue-id' });
  assert.deepEqual(queue.snapshot(), { current: null, upcoming: [], length: 0, repeat: false, loop: false });
  queue.add([{ ...tracks[0], file: 'private-cache-path' }]);
  assert.equal(JSON.stringify(queue.snapshot()).includes('private-cache-path'), false);
});

test('starts the first item, advances in order, removes upcoming items, and clears queue', () => {
  const queue = new MusicQueueService();
  queue.add(tracks);
  assert.equal(queue.startNext().title, 'A');
  assert.equal(queue.removeUpcoming(2).title, 'C');
  assert.equal(queue.completeCurrent().title, 'B');
  assert.equal(queue.completeCurrent(), null);
  queue.add(tracks.slice(0, 2));
  assert.equal(queue.clearUpcoming(), 2);
  assert.equal(queue.length, 0);
});

test('repeat restarts current track and skip advances anyway', () => {
  const queue = new MusicQueueService();
  queue.add(tracks.slice(0, 2));
  const first = queue.startNext();
  const staleGeneration = first.playbackGeneration;
  queue.setRepeat(true);
  assert.equal(queue.completeCurrent().title, 'A');
  assert.equal(queue.isCurrentPlayback(first.queueId, first.playbackGeneration), true);
  assert.equal(queue.isCurrentPlayback(first.queueId, staleGeneration), false);
  assert.equal(queue.skipCurrent().title, 'B');
});

test('loop requeues a completed or skipped track at the end of the queue', () => {
  const queue = new MusicQueueService();
  queue.add(tracks.slice(0, 2));
  queue.startNext();
  queue.setLoop(true);
  assert.equal(queue.completeCurrent().title, 'B');
  assert.deepEqual(queue.upcoming.map(item => item.title), ['A']);
  assert.equal(queue.skipCurrent().title, 'A');
});

test('rejects queue additions over the configured bound and stop preserves persistent modes', () => {
  const queue = new MusicQueueService({ maxItems: 2 });
  queue.add(tracks.slice(0, 2));
  assert.throws(() => queue.add([tracks[2]]), { code: 'QUEUE_LIMIT' });
  queue.setRepeat(true);
  queue.setLoop(true);
  assert.equal(queue.stop(), 2);
  assert.deepEqual(queue.snapshot(), { current: null, upcoming: [], length: 0, repeat: true, loop: true });
});

test('suspends the current item at its position for a room recovery without clearing queue modes', () => {
  const queue = new MusicQueueService();
  queue.add(tracks);
  const current = queue.startNext();
  queue.setRepeat(true);
  queue.setLoop(true);
  assert.equal(queue.suspendCurrent().queueId, current.queueId);
  assert.equal(queue.current, null);
  assert.deepEqual(queue.upcoming.map(item => item.title), ['A', 'B', 'C']);
  assert.equal(queue.upcoming[0].status, 'ready');
  assert.equal('playbackGeneration' in queue.upcoming[0], false);
  assert.equal(queue.snapshot().repeat, true);
  assert.equal(queue.snapshot().loop, true);
  assert.equal(queue.startNext().title, 'A');
});

test('rejects malformed queue entries before state changes', () => {
  const queue = new MusicQueueService();
  assert.throws(() => queue.add([{ videoId: '../private', title: 'bad' }]), { code: 'INVALID_TRACK' });
  assert.equal(queue.length, 0);
});

test('stale playback completion cannot start a newly-added track after a skip', () => {
  const queue = new MusicQueueService();
  queue.add([tracks[0]]);
  const playing = queue.startNext();
  const staleGeneration = playing.playbackGeneration;
  assert.equal(queue.skipCurrent(), null);
  queue.add([tracks[1]]);
  assert.equal(queue.completeCurrent(staleGeneration), null);
  assert.equal(queue.current, null);
  assert.equal(queue.startNext().title, 'B');
});

test('failed current track is discarded without retrying repeat or loop forever', () => {
  const queue = new MusicQueueService();
  queue.add(tracks.slice(0, 2));
  const failed = queue.startNext();
  queue.setRepeat(true);
  queue.setLoop(true);
  const next = queue.failCurrent(failed.queueId, failed.playbackGeneration);
  assert.equal(next.title, 'B');
  assert.deepEqual(queue.snapshot().upcoming.map(item => item.title), []);
  assert.equal(queue.failCurrent(failed.queueId, failed.playbackGeneration), null);
});
