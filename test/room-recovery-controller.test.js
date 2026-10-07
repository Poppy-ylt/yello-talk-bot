'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { RoomRecoveryController } = require('../src/yellotalk/room-recovery-controller');

function fakeTimers() {
  const timers = [];
  return {
    timers,
    schedule(callback, delay) { const timer = { callback, delay, cancelled: false }; timers.push(timer); return timer; },
    cancelTimer(timer) { timer.cancelled = true; },
  };
}

test('retries with bounded backoff and stops after recovery succeeds', async () => {
  const clock = fakeTimers();
  const calls = [];
  let failures = 0;
  const controller = new RoomRecoveryController({
    recover: async (roomId, isCurrent) => {
      calls.push([roomId, isCurrent()]);
      if (failures++ < 1) throw new Error('temporary failure');
    },
    delaysMs: [10, 20, 30],
    schedule: clock.schedule,
    cancelTimer: clock.cancelTimer,
  });

  assert.equal(controller.start('room-1'), true);
  assert.equal(controller.snapshot().status, 'waiting');
  assert.equal(clock.timers[0].delay, 10);
  clock.timers[0].callback();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(controller.snapshot().status, 'waiting');
  assert.equal(clock.timers[1].delay, 20);
  clock.timers[1].callback();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(controller.snapshot().status, 'recovered');
  assert.deepEqual(calls, [['room-1', true], ['room-1', true]]);
  assert.equal(clock.timers.length, 2);
});

test('treats an explicit false recovery result as a retryable failure', async () => {
  const clock = fakeTimers();
  let calls = 0;
  const controller = new RoomRecoveryController({
    recover: async () => ++calls > 1,
    delaysMs: [10, 20],
    schedule: clock.schedule,
    cancelTimer: clock.cancelTimer,
  });

  controller.start('room-false-result');
  clock.timers[0].callback();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(controller.snapshot(), { status: 'waiting', attempt: 1, maxAttempts: 2 });
  assert.equal(clock.timers[1].delay, 20);

  clock.timers[1].callback();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(controller.snapshot(), { status: 'recovered', attempt: 2, maxAttempts: 2 });
  assert.equal(calls, 2);
});

test('a newer recovery start is not overwritten by a stale in-flight result', async () => {
  const clock = fakeTimers();
  let releaseOldAttempt;
  let oldAttemptStarted;
  const oldStarted = new Promise(resolve => { oldAttemptStarted = resolve; });
  const oldAttempt = new Promise(resolve => { releaseOldAttempt = resolve; });
  const controller = new RoomRecoveryController({
    recover: async roomId => {
      if (roomId === 'old-room') {
        oldAttemptStarted();
        await oldAttempt;
      }
      return true;
    },
    delaysMs: [10],
    schedule: clock.schedule,
    cancelTimer: clock.cancelTimer,
  });

  controller.start('old-room');
  clock.timers[0].callback();
  await oldStarted;
  controller.start('new-room');
  releaseOldAttempt();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(clock.timers[0].cancelled, false);
  assert.deepEqual(controller.snapshot(), { status: 'waiting', attempt: 0, maxAttempts: 1 });

  clock.timers[1].callback();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(controller.snapshot(), { status: 'recovered', attempt: 1, maxAttempts: 1 });
});

test('bounds failed attempts and cancellation invalidates in-flight recovery', async () => {
  const clock = fakeTimers();
  let calls = 0;
  const controller = new RoomRecoveryController({
    recover: async () => { calls++; throw new Error('offline'); },
    delaysMs: [1, 2],
    schedule: clock.schedule,
    cancelTimer: clock.cancelTimer,
  });
  controller.start('room-2');
  clock.timers[0].callback();
  await new Promise(resolve => setImmediate(resolve));
  clock.timers[1].callback();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls, 2);
  assert.deepEqual(controller.snapshot(), { status: 'exhausted', attempt: 2, maxAttempts: 2 });

  let release;
  const pending = new Promise(resolve => { release = resolve; });
  let stillCurrent;
  const cancelled = new RoomRecoveryController({
    recover: async (_roomId, isCurrent) => { await pending; stillCurrent = isCurrent(); },
    delaysMs: [1],
    schedule: clock.schedule,
    cancelTimer: clock.cancelTimer,
  });
  cancelled.start('room-3');
  const timer = clock.timers[2];
  timer.callback();
  await Promise.resolve();
  cancelled.cancel();
  release();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(stillCurrent, false);
  assert.equal(cancelled.snapshot().status, 'idle');
  assert.equal(timer.cancelled, false);
});

test('uses a fallback only after bounded same-room retries are exhausted', async () => {
  const clock = fakeTimers();
  const calls = [];
  const controller = new RoomRecoveryController({
    recover: async roomId => { calls.push(['recover', roomId]); throw new Error('room unavailable'); },
    onExhausted: async (roomId, isCurrent) => {
      calls.push(['fallback', roomId, isCurrent()]);
      return true;
    },
    delaysMs: [10],
    schedule: clock.schedule,
    cancelTimer: clock.cancelTimer,
  });
  controller.start('room-closed');
  clock.timers[0].callback();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(calls, [['recover', 'room-closed'], ['fallback', 'room-closed', true]]);
  assert.deepEqual(controller.snapshot(), { status: 'recovered', attempt: 1, maxAttempts: 1 });
});

test('cancelling an in-flight fallback prevents it from restoring stale recovered state', async () => {
  const clock = fakeTimers();
  let release;
  let fallbackStarted;
  const started = new Promise(resolve => { fallbackStarted = resolve; });
  const pending = new Promise(resolve => { release = resolve; });
  const controller = new RoomRecoveryController({
    recover: async () => { throw new Error('room unavailable'); },
    onExhausted: async (_roomId, isCurrent) => {
      fallbackStarted(isCurrent());
      await pending;
      return true;
    },
    delaysMs: [1],
    schedule: clock.schedule,
    cancelTimer: clock.cancelTimer,
  });
  controller.start('room-closed');
  clock.timers[0].callback();
  assert.equal(await started, true);
  controller.cancel();
  release();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(controller.snapshot(), { status: 'idle', attempt: 0, maxAttempts: 1 });
});
