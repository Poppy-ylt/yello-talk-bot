'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { ADAPTER_TOKEN_HEADER, GmeAdapterClient } = require('../src/music/gme-adapter-client');

function fixture() {
  const calls = [];
  const capabilities = {
    features: { status: true, health: true, playMusic: true, effects: false, roomQuality: true },
    endpoints: ['/join', '/play', '/stop', '/pause', '/resume', '/volume', '/room-quality', '/leave', '/effect-play', '/effect-stop', '/effect-volume'],
  };
  const http = {
    async get(...args) {
      calls.push(['get', ...args]);
      return { data: args[0].endsWith('/capabilities') ? capabilities : { ok: true } };
    },
    async post(...args) { calls.push(['post', ...args]); return { data: { ok: true } }; },
  };
  return { client: new GmeAdapterClient({ http, baseUrl: 'http://127.0.0.1:9876', token: 'private-adapter-token' }), calls };
}

test('requires a loopback-only adapter URL and a local adapter token', () => {
  const http = { get() {}, post() {} };
  assert.throws(() => new GmeAdapterClient({ http, baseUrl: 'https://public.example', token: 'token' }), /localhost or 127\.0\.0\.1/);
  assert.throws(() => new GmeAdapterClient({ http, baseUrl: 'http://127.0.0.1:9876' }), /token is not configured/);
  assert.throws(() => new GmeAdapterClient({ http, baseUrl: 'http://user:pass@localhost:9876', token: 'token' }), /localhost or 127\.0\.0\.1/);
});

test('sends only music-room adapter calls with the dedicated auth header', async () => {
  const { client, calls } = fixture();
  await client.health();
  await client.assertMusicCapabilities();
  await client.join({ room: 'voice-room', user: 'local-user-id', uuid: 'local-user-id' });
  await client.play({ file: 'C:\\music-cache\\track.m4a' });
  await client.setVolume(67.5);
  await client.setRoomQuality('hq');
  await client.pause();
  await client.resume();
  await client.stop();
  await client.leave();
  assert.deepEqual(calls.map(([method, url]) => [method, url.replace('http://127.0.0.1:9876', '')]), [
    ['get', '/health'], ['get', '/capabilities'], ['post', '/join'], ['post', '/play'], ['post', '/volume'],
    ['post', '/room-quality'], ['post', '/pause'], ['post', '/resume'], ['post', '/stop'], ['post', '/leave'],
  ]);
  assert.equal(calls[2][3].headers[ADAPTER_TOKEN_HEADER], 'private-adapter-token');
  assert.deepEqual(calls[2][2], { room: 'voice-room', user: 'local-user-id', uuid: 'local-user-id' });
  assert.deepEqual(calls[3][2], { file: 'C:\\music-cache\\track.m4a', loop: false });
  assert.deepEqual(calls[4][2], { vol: 68 });
  assert.deepEqual(calls[5][2], { quality: 'highquality' });
});

test('validates room identity, local file, volume, and quality before requesting the adapter', async () => {
  const { client, calls } = fixture();
  assert.throws(() => client.join({ room: 'room', user: 'user' }), /room, user, and UUID/);
  assert.throws(() => client.play({}), /local audio file/);
  assert.throws(() => client.setVolume(101), /between 0 and 100/);
  await assert.rejects(client.setRoomQuality('ultra'), /Unsupported/);
  assert.equal(calls.length, 0);
});

test('validates optional speech-effect support and keeps its calls authenticated', async () => {
  const { client, calls } = fixture();
  await client.playEffect({ file: 'C:\\music-cache\\speech.wav', effectId: 9001, volume: 73 });
  await client.setEffectVolume(9001, 65);
  await client.stopEffect(9001);
  assert.deepEqual(calls.map(([, url]) => url.replace('http://127.0.0.1:9876', '')), [
    '/effect-play', '/effect-volume', '/effect-stop',
  ]);
  assert.deepEqual(calls[0][2], { file: 'C:\\music-cache\\speech.wav', effectId: 9001, volume: 73, send: true });
  assert.equal(calls[0][3].headers[ADAPTER_TOKEN_HEADER], 'private-adapter-token');
  assert.throws(() => client.playEffect({ file: 'speech.wav', effectId: -1 }), /effect ID/);

  const effectsClient = new GmeAdapterClient({
    http: {
      async get() { return { data: { features: { effects: true }, endpoints: ['/effect-play', '/effect-stop', '/effect-volume'] } }; },
      async post() { return { data: {} }; },
    },
    baseUrl: 'http://localhost:9876',
    token: 'token',
  });
  assert.equal((await effectsClient.assertTtsCapabilities()).features.effects, true);
});

test('rejects speech effects when the adapter does not advertise them', async () => {
  const { client } = fixture();
  await assert.rejects(client.assertTtsCapabilities(), /does not support speech/);
});

test('accepts music playback when optional room-quality control is unavailable', async () => {
  const musicEndpoints = ['/join', '/play', '/stop', '/pause', '/resume', '/volume', '/leave'];
  const client = new GmeAdapterClient({
    http: {
      async get(url) {
        if (url.endsWith('/capabilities')) return { data: { features: { status: true, health: true, playMusic: true, roomQuality: false }, endpoints: musicEndpoints } };
        return { data: {} };
      },
      async post() { return { data: {} }; },
    },
    baseUrl: 'http://localhost:9876',
    token: 'token',
  });
  const capabilities = await client.assertMusicCapabilities();
  assert.equal(capabilities.features.playMusic, true);
  await assert.rejects(client.setRoomQuality('hq'), /does not support room quality/);
});

test('rejects adapters that do not advertise the required music endpoint set', async () => {
  const incompleteEndpoints = ['/join', '/play', '/stop', '/pause', '/resume', '/volume'];
  const client = new GmeAdapterClient({
    http: {
      async get(url) {
        if (url.endsWith('/capabilities')) return { data: { features: { status: true, health: true, playMusic: true }, endpoints: incompleteEndpoints } };
        return { data: {} };
      },
      async post() { return { data: {} }; },
    },
    baseUrl: 'http://localhost:9876',
    token: 'token',
  });
  await assert.rejects(client.assertMusicCapabilities(), /missing one or more required music capabilities/);
});
