'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { TtsPlaybackService } = require('../src/tts/tts-playback-service');

function wav() {
  const audioBytes = 4800;
  const result = Buffer.alloc(44 + audioBytes);
  result.write('RIFF', 0);
  result.writeUInt32LE(36 + audioBytes, 4);
  result.write('WAVE', 8);
  result.write('fmt ', 12);
  result.writeUInt32LE(16, 16);
  result.writeUInt16LE(1, 20);
  result.writeUInt16LE(1, 22);
  result.writeUInt32LE(24000, 24);
  result.writeUInt32LE(48000, 28);
  result.writeUInt16LE(2, 32);
  result.writeUInt16LE(16, 34);
  result.write('data', 36);
  result.writeUInt32LE(audioBytes, 40);
  return result;
}

function fixture({ settings = {}, timerMs = 2, synthesizeImpl, playEffectImpl } = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ymb-tts-'));
  const calls = [];
  let counter = 0;
  const service = new TtsPlaybackService({
    speech: { async synthesize(options) {
      calls.push(['synthesize', options]);
      return synthesizeImpl ? synthesizeImpl(options) : { audio: wav(), durationMs: 20 };
    } },
    adapter: {
      async assertTtsCapabilities() { calls.push(['capabilities']); return {}; },
      async playEffect(value) {
        calls.push(['playEffect', value]);
        return playEffectImpl ? playEffectImpl(value) : { ok: true };
      },
      async stopEffect(value) { calls.push(['stopEffect', value]); return { ok: true }; },
      async setEffectVolume(...value) { calls.push(['effectVolume', ...value]); return { ok: true }; },
    },
    playback: { async setDucking(value) { calls.push(['duck', value]); return value; } },
    getSettings: () => ({ ttsEnabled: true, ttsVoice: 'en-US-JennyNeural', ttsSpeed: 1, ttsPitch: 0, ttsVolume: 80, ...settings }),
    getOwnUuid: () => 'bot-id',
    audioDirectory: directory,
    createId: () => `test-${++counter}`,
    setTimeoutImpl: (callback, delay) => setTimeout(callback, Math.min(timerMs, delay)),
  });
  return { directory, service, calls };
}

test('reads only bounded ordinary chat, skips bot echoes and dot commands, and cleans its owned speech file', async () => {
  const { directory, service, calls } = fixture();
  assert.equal(service.handleMessage({ message: '.play song', uuid: 'member' }), false);
  assert.equal(service.handleMessage({ message: 'Hello there', uuid: 'bot-id' }), false);
  assert.equal(service.handleMessage({ message: 'x'.repeat(501), uuid: 'member' }), false);
  assert.equal(service.handleMessage({ message: 'Hello <everyone>', uuid: 'member' }), true);
  assert.equal(service.handleMessage({ message: 'Hello <everyone>', uuid: 'member' }), false);
  assert.equal(JSON.stringify(service.snapshot()).includes('Hello'), false);
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(service.snapshot().status, 'idle');
  assert.deepEqual(calls.filter(item => item[0] === 'duck'), [['duck', 0.3], ['duck', 1]]);
  assert.equal(calls.filter(item => item[0] === 'playEffect').length, 1);
  assert.equal(calls.find(item => item[0] === 'playEffect')[1].send, true);
  assert.equal(calls.find(item => item[0] === 'synthesize')[1].text, 'Hello <everyone>');
  assert.equal(fs.readdirSync(directory).length, 0);
  fs.rmSync(directory, { recursive: true, force: true });
});

test('disabling TTS cancels the active speech effect and restores the music volume', async () => {
  const { directory, service, calls } = fixture({ timerMs: 500 });
  service.handleMessage({ message: 'Read this message', uuid: 'member' });
  for (let tries = 0; tries < 30 && !calls.some(item => item[0] === 'playEffect'); tries++) {
    await new Promise(resolve => setTimeout(resolve, 2));
  }
  assert.ok(calls.some(item => item[0] === 'playEffect'));
  await service.applySettings({ ttsVolume: 40 });
  assert.deepEqual(calls.find(item => item[0] === 'effectVolume'), ['effectVolume', 9001, 40]);
  await service.applySettings({ ttsEnabled: false });
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.ok(calls.some(item => item[0] === 'stopEffect'));
  assert.deepEqual(calls.filter(item => item[0] === 'duck').at(-1), ['duck', 1]);
  assert.equal(fs.readdirSync(directory).length, 0);
  fs.rmSync(directory, { recursive: true, force: true });
});

test('continues the queued speech after one synthesis request fails', async () => {
  const { directory, service, calls } = fixture({
    synthesizeImpl: async options => {
      if (options.text === 'First fails') throw new Error('speech provider failed');
      return { audio: wav(), durationMs: 20 };
    },
  });
  service.handleMessage({ message: 'First fails', uuid: 'member', message_id: 'one' });
  service.handleMessage({ message: 'Second succeeds', uuid: 'member', message_id: 'two' });
  await service.drainPromise;

  assert.deepEqual(calls.filter(item => item[0] === 'synthesize').map(item => item[1].text), [
    'First fails',
    'Second succeeds',
  ]);
  assert.equal(calls.filter(item => item[0] === 'playEffect').length, 1);
  assert.deepEqual(calls.filter(item => item[0] === 'duck'), [['duck', 0.3], ['duck', 1]]);
  assert.equal(service.snapshot().queued, 0);
  assert.equal(service.snapshot().status, 'idle');
  assert.equal(fs.readdirSync(directory).length, 0);
  fs.rmSync(directory, { recursive: true, force: true });
});

test('restores music volume and cleans its file when starting a speech effect fails', async () => {
  const { directory, service, calls } = fixture({
    playEffectImpl: async () => { throw new Error('adapter effect failed'); },
  });
  service.handleMessage({ message: 'Cannot play this', uuid: 'member' });
  await service.drainPromise;

  assert.deepEqual(calls.filter(item => item[0] === 'duck'), [['duck', 0.3], ['duck', 1]]);
  assert.equal(service.snapshot().status, 'error');
  assert.equal(fs.readdirSync(directory).length, 0);
  fs.rmSync(directory, { recursive: true, force: true });
});
