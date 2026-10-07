'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { MusicCommandDispatcher } = require('../src/commands/music-command-dispatcher');

function fixture({ now = () => 1000 } = {}) {
  const calls = { requests: [], messages: [], settings: [], volume: [], quality: [], repeat: [], loop: [], skipped: 0 };
  const state = { status: 'playing', queue: { current: { title: 'Current song' }, upcoming: [], length: 1, repeat: false, loop: false } };
  const playback = {
    snapshot: () => state,
    async request(input, options) { calls.requests.push({ input, options }); return { added: 1 }; },
    async skip() { calls.skipped++; return true; },
    async pause() { return true; },
    async resume() { return true; },
    async stop() {},
    async setVolume(value) { calls.volume.push(value); return Math.round(value); },
    async setRoomQuality(value) { calls.quality.push(value); return value; },
    setRepeat(value) { calls.repeat.push(value); state.queue.repeat = value; },
    setLoop(value) { calls.loop.push(value); state.queue.loop = value; },
    removeUpcoming() { return null; },
    clearUpcoming() { return 0; },
  };
  const dispatcher = new MusicCommandDispatcher({
    playback,
    sendMessage: async message => calls.messages.push(message),
    getSettings: () => ({ volume: 80, autoplay: false, roomQuality: 'standard' }),
    getOwnUuid: () => 'bot-id',
    onSettingsChange: async settings => calls.settings.push(settings),
    now,
  });
  return { dispatcher, calls, state };
}

test('dispatches music commands from members and queues requests without waiting for download', async () => {
  const { dispatcher, calls } = fixture();
  const result = await dispatcher.handle({ message: '.play lofi mix', uuid: 'member-1', pin_name: 'Listener' });
  assert.deepEqual(result, { handled: true, action: 'PLAY', added: 1 });
  assert.deepEqual(calls.requests, [{ input: 'lofi mix', options: { requestedBy: 'Listener', waitForPlayback: false } }]);
  assert.match(calls.messages[0], /Added 1 track/);
});

test('ignores own echoes, ordinary messages, removed commands, and rate-limits a sender', async () => {
  const { dispatcher, calls } = fixture();
  assert.equal((await dispatcher.handle({ message: '.skip', uuid: 'bot-id' })).reason, 'own-message');
  assert.equal((await dispatcher.handle({ message: 'https://youtube.com/watch?v=abcdefghijk', uuid: 'member' })).reason, 'not-allowlisted');
  assert.equal((await dispatcher.handle({ message: '.autoplay2 on', uuid: 'member' })).reason, 'not-allowlisted');
  assert.equal((await dispatcher.handle({ message: '.skip', uuid: 'member' })).handled, true);
  assert.equal((await dispatcher.handle({ message: '.skip', uuid: 'member' })).reason, 'cooldown');
  assert.equal(calls.skipped, 1);
});

test('persists validated quality, volume, repeat, loop, and autoplay settings', async () => {
  const { dispatcher, calls } = fixture({ now: () => 1000 });
  assert.equal((await dispatcher.handle({ message: '.sq 3', uuid: 'a' })).roomQuality, 'hq');
  assert.equal((await dispatcher.handle({ message: '.vol 62', uuid: 'b' })).volume, 62);
  assert.equal((await dispatcher.handle({ message: '.repeat on', uuid: 'c' })).repeat, true);
  assert.equal((await dispatcher.handle({ message: '.loop on', uuid: 'd' })).loop, true);
  assert.equal((await dispatcher.handle({ message: '.autoplay on', uuid: 'e' })).autoplay, true);
  assert.deepEqual(calls.quality, ['hq']);
  assert.deepEqual(calls.volume, [62]);
  assert.deepEqual(calls.settings, [
    { roomQuality: 'hq' },
    { volume: 62 },
    { repeat: true },
    { loop: true },
    { autoplay: true },
  ]);
});

test('reports TTS status and retains validated controls for Azure speech', async () => {
  const { dispatcher, calls } = fixture();
  const status = await dispatcher.handle({ message: '.tts status', uuid: 'member-1' });
  assert.deepEqual(status, { handled: true, action: 'TTS', available: false, enabled: false });
  assert.match(calls.messages[0], /Azure is not configured/);
  const enabled = await dispatcher.handle({ message: '.tts on', uuid: 'member-2' });
  assert.deepEqual(enabled, { handled: true, action: 'TTS', enabled: true });
  const voice = await dispatcher.handle({ message: '.tts voice en-US-JennyNeural', uuid: 'member-3' });
  assert.equal(voice.voice, 'en-US-JennyNeural');
  const speed = await dispatcher.handle({ message: '.tts speed 1.2', uuid: 'member-4' });
  assert.equal(speed.ttsSpeed, 1.2);
  assert.deepEqual(calls.settings, [
    { ttsEnabled: true },
    { ttsVoice: 'en-US-JennyNeural' },
    { ttsSpeed: 1.2 },
  ]);
});
