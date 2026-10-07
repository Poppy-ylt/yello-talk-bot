'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createApp } = require('../server');

async function withServer(run, configSeed, dependencies = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ymb-server-'));
  const configPath = path.join(directory, 'config.local.json');
  if (configSeed) fs.writeFileSync(configPath, JSON.stringify(configSeed));
  const service = createApp({
    configPath,
    tokenPath: path.join(directory, 'owner-token.txt'),
    logger: { error() {} },
    ...dependencies,
  });
  const server = await new Promise(resolve => {
    const listener = service.app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    await run({ ...service, baseUrl });
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

test('status starts in setup-required state without connecting to YelloTalk', async () => {
  await withServer(async ({ baseUrl }) => {
    const response = await fetch(`${baseUrl}/api/status`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      product: 'Yello Music Bot',
      phase: 'setup-required',
      accountConfigured: false,
      connection: 'disconnected',
      room: { id: null, name: null },
      audioAdapterConfigured: false,
      playback: 'idle',
      queueLength: 0,
      recovery: { status: 'idle', attempt: 0, maxAttempts: 5 },
      tts: 'disabled',
      ttsPlayback: { status: 'unavailable', queued: 0, error: null },
      recentErrors: [],
    });
  });
});

test('legacy bot-management, monitoring, tunnel, and out-of-scope music routes are absent', async () => {
  const removedRoutes = [
    ['GET', '/api/bots'],
    ['GET', '/api/health'],
    ['GET', '/api/events'],
    ['GET', '/api/terminal-log'],
    ['GET', '/api/gme/health'],
    ['GET', '/api/music/playlist'],
    ['POST', '/api/music/auto-play'],
    ['POST', '/api/music/mic'],
    ['GET', '/api/tunnel-url'],
    ['POST', '/api/system/shutdown'],
    ['POST', '/api/bot/start'],
    ['GET', '/api/bot/following'],
  ];
  await withServer(async ({ baseUrl }) => {
    for (const [method, route] of removedRoutes) {
      const response = await fetch(`${baseUrl}${route}`, { method });
      assert.equal(response.status, 404, `${method} ${route} should not be mounted`);
    }
  });
});

test('graceful shutdown is idempotent and stops audio before leaving its room session', async () => {
  const calls = [];
  const roomSession = {
    snapshot: () => ({ status: 'joined', roomId: 'room1', roomName: 'Music room' }),
    async sendMessage() { return {}; },
    async leave() { calls.push('session.leave'); return true; },
  };
  const musicAdapter = {
    async stop() { calls.push('adapter.stop'); },
    async leave() { calls.push('adapter.leave'); },
  };
  const musicPlayback = {
    snapshot: () => ({ attached: true, queue: { current: null, upcoming: [], length: 0 } }),
    async request() { return {}; },
    async detachRoom(options) { calls.push(['playback.detach', options]); },
  };
  await withServer(async ({ shutdown }) => {
    const first = shutdown();
    const second = shutdown();
    assert.equal(first, second);
    assert.equal(await first, true);
    assert.deepEqual(calls, [
      ['playback.detach', { stopAdapter: true }],
      'adapter.leave',
      'session.leave',
    ]);
  }, { account: { jwtToken: 'local-test-token', userUuid: 'local-test-id', displayName: 'Music Bot' } }, {
    apiClient: {}, roomSession, musicAdapter, musicPlayback,
  });
});

test('configured local account is ready but does not connect until requested', async () => {
  await withServer(async ({ baseUrl }) => {
    const response = await fetch(`${baseUrl}/api/status`);
    const status = await response.json();
    assert.equal(status.phase, 'ready');
    assert.equal(status.accountConfigured, true);
    assert.equal(status.connection, 'disconnected');
  }, { account: { jwtToken: 'local-test-token', userUuid: 'local-test-id', displayName: 'Music Bot' } });
});

test('room directory requires owner authentication and a configured local account', async () => {
  let requests = 0;
  const apiClient = { async listPublicRooms() { requests++; return []; } };
  await withServer(async ({ baseUrl, ownerToken }) => {
    const denied = await fetch(`${baseUrl}/api/rooms`);
    assert.equal(denied.status, 401);
    const unconfigured = await fetch(`${baseUrl}/api/rooms`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(unconfigured.status, 409);
    assert.equal(requests, 0);
  }, undefined, { apiClient });
});

test('room directory uses the local account token and returns API-normalized room data', async () => {
  const apiClient = {
    async listPublicRooms(token) {
      assert.equal(token, 'local-test-token');
      return [{ id: 'room1', gmeId: 'voice-1', topic: 'Music room', campus: 'North', participantCount: 4 }];
    },
  };
  await withServer(async ({ baseUrl, ownerToken }) => {
    const response = await fetch(`${baseUrl}/api/rooms`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      rooms: [{ id: 'room1', gmeId: 'voice-1', topic: 'Music room', campus: 'North', participantCount: 4 }],
    });
  }, { account: { jwtToken: 'local-test-token', userUuid: 'local-test-id', displayName: 'Music Bot' } }, { apiClient });
});

test('public room creation requires owner auth and a topic of at most 100 characters', async () => {
  let calls = 0;
  const apiClient = { async createPublicRoom() { calls++; return { id: 'room2', gmeId: 'voice-2', topic: 'Room' }; } };
  await withServer(async ({ baseUrl, ownerToken }) => {
    const unauthorized = await fetch(`${baseUrl}/api/rooms/create`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic: 'Room' }),
    });
    assert.equal(unauthorized.status, 401);
    const headers = { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' };
    for (const topic of ['', 'x'.repeat(101), { unexpected: true }]) {
      const invalid = await fetch(`${baseUrl}/api/rooms/create`, { method: 'POST', headers, body: JSON.stringify({ topic }) });
      assert.equal(invalid.status, 400);
    }
    assert.equal(calls, 0);
  }, { account: { jwtToken: 'local-test-token', userUuid: 'local-test-id', displayName: 'Music Bot' } }, { apiClient });
});

test('public room creation uses the existing topic-only API flow and joins as host', async () => {
  const calls = [];
  const apiClient = {
    async createPublicRoom(token, topic) {
      calls.push(['createPublicRoom', token, topic]);
      return { id: 'room2', gmeId: 'voice-2', topic, campus: 'No Group' };
    },
  };
  const roomSession = {
    snapshot: () => ({ status: 'disconnected', roomId: null, roomName: null }),
    async join(input) { calls.push(['join', input]); return { status: 'joined', roomId: input.room.id }; },
  };
  await withServer(async ({ baseUrl, ownerToken }) => {
    const response = await fetch(`${baseUrl}/api/rooms/create`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: '  Music room  ' }),
    });
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), {
      room: { id: 'room2', gmeId: 'voice-2', topic: 'Music room', campus: 'No Group' },
      connected: { status: 'joined', roomId: 'room2' },
    });
    assert.deepEqual(calls, [
      ['createPublicRoom', 'local-test-token', 'Music room'],
      ['join', { account: { jwtToken: 'local-test-token', userUuid: 'local-test-id', displayName: 'Music Bot', aliases: [], persona: '' }, room: { id: 'room2', gmeId: 'voice-2', topic: 'Music room', campus: 'No Group' }, createRoom: true }],
    ]);
  }, { account: { jwtToken: 'local-test-token', userUuid: 'local-test-id', displayName: 'Music Bot' } }, { apiClient, roomSession });
});

test('auto-join refuses both modes until speaker availability has a verified preflight', async () => {
  let requests = 0;
  let joins = 0;
  const apiClient = {
    async listFollowing() { requests++; return [{ uuid: 'followed-user' }]; },
    async listPublicRooms() { requests++; return [{ id: 'room1', gmeId: 'voice-1' }]; },
  };
  const roomSession = {
    snapshot: () => ({ status: 'disconnected', roomId: null, roomName: null }),
    async join() { joins++; return { status: 'joined', roomId: 'room1' }; },
  };
  await withServer(async ({ baseUrl, ownerToken }) => {
    for (const mode of ['following', 'public']) {
      const response = await fetch(`${baseUrl}/api/room/auto-join`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      assert.equal(response.status, 409);
      assert.match((await response.json()).error, /speaker availability/);
    }
    assert.equal(requests, 0);
    assert.equal(joins, 0);
  }, { account: { jwtToken: 'local-test-token', userUuid: 'local-test-id', displayName: 'Music Bot' } }, { apiClient, roomSession });
});

test('joining a room resolves its voice identity locally and leaving stays explicit', async () => {
  const calls = [];
  const apiClient = {
    async getRoom(token, roomId) {
      calls.push(['getRoom', token, roomId]);
      if (roomId === 'missing') return null;
      return { id: roomId, gmeId: 'voice-1', topic: 'Music room', campus: 'North' };
    },
  };
  const roomSession = {
    snapshot: () => ({ status: 'disconnected', roomId: null, roomName: null }),
    async join(input) { calls.push(['join', input]); return { status: 'joined', roomId: input.room.id }; },
    async leave() { calls.push(['leave']); return true; },
  };
  await withServer(async ({ baseUrl, ownerToken }) => {
    const headers = { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' };
    const invalid = await fetch(`${baseUrl}/api/room/join`, { method: 'POST', headers, body: JSON.stringify({ roomId: '../bad' }) });
    assert.equal(invalid.status, 400);
    assert.equal(calls.length, 0);
    const missing = await fetch(`${baseUrl}/api/room/join`, { method: 'POST', headers, body: JSON.stringify({ roomId: 'missing' }) });
    assert.equal(missing.status, 404);
    assert.match((await missing.json()).error, /Room was not found/);
    assert.deepEqual(calls, [['getRoom', 'local-test-token', 'missing']]);
    const joined = await fetch(`${baseUrl}/api/room/join`, { method: 'POST', headers, body: JSON.stringify({ roomId: 'room1' }) });
    assert.equal(joined.status, 200);
    assert.deepEqual(await joined.json(), { connected: { status: 'joined', roomId: 'room1' } });
    const left = await fetch(`${baseUrl}/api/room/leave`, { method: 'POST', headers });
    assert.deepEqual(await left.json(), { left: true });
    assert.deepEqual(calls[1], ['getRoom', 'local-test-token', 'room1']);
    assert.equal(calls.filter(([name]) => name === 'join').length, 1);
    assert.deepEqual(calls.at(-1), ['leave']);
  }, {
    account: { jwtToken: 'local-test-token', userUuid: 'local-test-id', displayName: 'Music Bot' },
  }, { apiClient, roomSession });
});

test('the live room event sends allowlisted music commands to the playback service', async () => {
  const callbacks = new Map();
  const emittedMessages = [];
  const requests = [];
  const socket = {
    connected: true,
    on(event, callback) {
      const set = callbacks.get(event) || new Set();
      set.add(callback);
      callbacks.set(event, set);
    },
    off(event, callback) { callbacks.get(event)?.delete(callback); },
    emit(event, payload, callback) {
      if (event === 'join_room') callback({ result: 200 });
      if (event === 'new_message') {
        emittedMessages.push(payload);
        callback({ result: 200 });
      }
    },
    disconnect() { this.connected = false; },
    trigger(event, data) { for (const callback of callbacks.get(event) || []) callback(data); },
  };
  const apiClient = { async getRoom(_token, id) { return { id, gmeId: 'voice-1', topic: 'Music room' }; } };
  const musicPlayback = {
    snapshot: () => ({ status: 'idle', attached: false, queue: { current: null, upcoming: [], length: 0, repeat: false, loop: false } }),
    async request(query, options) { requests.push({ query, options }); return { added: 1 }; },
  };
  await withServer(async ({ baseUrl, ownerToken }) => {
    const headers = { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' };
    const joined = await fetch(`${baseUrl}/api/room/join`, { method: 'POST', headers, body: JSON.stringify({ roomId: 'room1' }) });
    assert.equal(joined.status, 200);
    socket.trigger('new_message', { message: '.play lofi', uuid: 'member-1', pin_name: 'Listener' });
    socket.trigger('new_message', { message: '.autoplay2 on', uuid: 'member-2', pin_name: 'Listener 2' });
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(requests, [{ query: 'lofi', options: { requestedBy: 'Listener', waitForPlayback: false } }]);
    assert.equal(emittedMessages.length, 1);
    assert.match(emittedMessages[0].message, /Added 1 track/);
    assert.equal(emittedMessages[0].room, 'room1');
    assert.equal(emittedMessages[0].uuid, 'local-test-id');
    assert.equal(JSON.stringify(emittedMessages).includes('local-test-token'), false);
  }, {
    account: { jwtToken: 'local-test-token', userUuid: 'local-test-id', displayName: 'Music Bot' },
  }, { apiClient, musicPlayback, createSocket: () => socket });
});

test('the live room event invokes stateless Groq only after an enabled bot mention', async () => {
  const callbacks = new Map();
  const emittedMessages = [];
  const generated = [];
  const socket = {
    connected: true,
    on(event, callback) {
      const set = callbacks.get(event) || new Set();
      set.add(callback);
      callbacks.set(event, set);
    },
    off(event, callback) { callbacks.get(event)?.delete(callback); },
    emit(event, payload, callback) {
      if (event === 'join_room') callback({ result: 200 });
      if (event === 'new_message') { emittedMessages.push(payload); callback({ result: 200 }); }
    },
    disconnect() { this.connected = false; },
    trigger(event, data) { for (const callback of callbacks.get(event) || []) callback(data); },
  };
  const groqChatClient = {
    async generateReply(input) { generated.push(input); return 'A short answer.'; },
  };
  const apiClient = { async getRoom(_token, id) { return { id, gmeId: 'voice-1', topic: 'Music room' }; } };
  const musicPlayback = {
    snapshot: () => ({ status: 'idle', attached: false, queue: { current: null, upcoming: [], length: 0, repeat: false, loop: false } }),
    async request() { return { added: 0 }; },
  };
  await withServer(async ({ baseUrl, ownerToken }) => {
    const headers = { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' };
    const joined = await fetch(`${baseUrl}/api/room/join`, { method: 'POST', headers, body: JSON.stringify({ roomId: 'room1' }) });
    assert.equal(joined.status, 200);
    socket.trigger('new_message', { message: 'How are you?', uuid: 'member-1' });
    socket.trigger('new_message', { message: 'Hey @Yello, tell me something.', uuid: 'member-2', pin_name: 'Listener' });
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(generated, [{ text: 'tell me something', persona: '', intent: 'chat' }]);
    assert.equal(emittedMessages.length, 1);
    assert.equal(emittedMessages[0].message, 'A short answer.');
    assert.equal(emittedMessages[0].uuid, 'local-test-id');
  }, {
    account: { jwtToken: 'local-test-token', userUuid: 'local-test-id', displayName: 'Music Bot', aliases: ['Yello'] },
    groq: { apiKey: 'private-groq-test-key', model: 'private-test-model' },
    settings: { chatRepliesEnabled: true },
  }, { apiClient, musicPlayback, groqChatClient, createSocket: () => socket });
});

test('participant changes send only configured single-person greetings and farewells', async () => {
  const callbacks = new Map();
  const emittedMessages = [];
  const socket = {
    connected: true,
    on(event, callback) {
      const set = callbacks.get(event) || new Set();
      set.add(callback);
      callbacks.set(event, set);
    },
    off(event, callback) { callbacks.get(event)?.delete(callback); },
    emit(event, payload, callback) {
      if (event === 'join_room') callback({ result: 200 });
      if (event === 'new_message') { emittedMessages.push(payload); callback({ result: 200 }); }
    },
    disconnect() { this.connected = false; },
    trigger(event, data) { for (const callback of callbacks.get(event) || []) callback(data); },
  };
  const apiClient = { async getRoom(_token, id) { return { id, gmeId: 'voice-1', topic: 'Music room' }; } };
  const musicPlayback = {
    snapshot: () => ({ status: 'idle', attached: false, queue: { current: null, upcoming: [], length: 0, repeat: false, loop: false } }),
    async request() { return { added: 0 }; },
  };

  await withServer(async ({ baseUrl, ownerToken }) => {
    const headers = { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' };
    const joined = await fetch(`${baseUrl}/api/room/join`, { method: 'POST', headers, body: JSON.stringify({ roomId: 'room1' }) });
    assert.equal(joined.status, 200);
    const emitParticipants = async participants => {
      socket.trigger('participant_changed', { participants });
      await new Promise(resolve => setImmediate(resolve));
    };
    await emitParticipants([
      { uuid: 'local-test-id', pin_name: 'Music Bot' },
      { uuid: 'already-here', pin_name: 'Existing listener' },
    ]);
    await emitParticipants([
      { uuid: 'local-test-id', pin_name: 'Music Bot' },
      { uuid: 'already-here', pin_name: 'Existing listener' },
      { uuid: 'new-listener', pin_name: 'Ari' },
    ]);
    await emitParticipants([
      { uuid: 'local-test-id', pin_name: 'Music Bot' },
      { uuid: 'already-here', pin_name: 'Existing listener' },
    ]);
    assert.deepEqual(emittedMessages.map(item => item.message), ['สวัสดี Ari!', 'ลาก่อน Ari!']);
    assert.equal(emittedMessages.every(item => item.uuid === 'local-test-id' && item.room === 'room1'), true);
  }, {
    account: { jwtToken: 'local-test-token', userUuid: 'local-test-id', displayName: 'Music Bot' },
    settings: { greetingsEnabled: true, greetingMessage: 'สวัสดี {name}!', farewellsEnabled: true, farewellMessage: 'ลาก่อน {name}!' },
  }, { apiClient, musicPlayback, createSocket: () => socket });
});

test('chat API is owner-authenticated, memory-only, and web commands are never dispatched', async () => {
  const callbacks = new Map();
  const sentMessages = [];
  const playbackCalls = [];
  const socket = {
    connected: true,
    on(event, callback) {
      const set = callbacks.get(event) || new Set();
      set.add(callback);
      callbacks.set(event, set);
    },
    off(event, callback) { callbacks.get(event)?.delete(callback); },
    emit(event, payload, callback) {
      if (event === 'join_room' || event === 'leave_room') callback({ result: 200 });
      if (event === 'new_message') {
        sentMessages.push(payload);
        callback({ result: 200 });
        queueMicrotask(() => this.trigger('new_message', payload));
      }
    },
    disconnect() { this.connected = false; },
    trigger(event, data) { for (const callback of callbacks.get(event) || []) callback(data); },
  };
  const apiClient = { async getRoom(_token, id) { return { id, gmeId: 'voice-1', topic: 'Music room' }; } };
  const musicPlayback = {
    snapshot: () => ({ status: 'idle', attached: false, queue: { current: null, upcoming: [], length: 0, repeat: false, loop: false } }),
    async request() { return { added: 0 }; },
    async skip() { playbackCalls.push('skip'); },
    async detachRoom() {},
  };

  await withServer(async ({ baseUrl, ownerToken }) => {
    assert.equal((await fetch(`${baseUrl}/api/chat/messages`)).status, 401);
    const authorization = { Authorization: `Bearer ${ownerToken}` };
    assert.equal((await fetch(`${baseUrl}/api/chat/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'hello' }) })).status, 401);
    const joined = await fetch(`${baseUrl}/api/room/join`, { method: 'POST', headers: { ...authorization, 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId: 'room1' }) });
    assert.equal(joined.status, 200);
    socket.trigger('new_message', { uuid: 'listener-id', pin_name: 'Listener', message: 'Hello there' });
    await new Promise(resolve => setImmediate(resolve));
    const messages = await fetch(`${baseUrl}/api/chat/messages`, { headers: authorization });
    assert.equal(messages.status, 200);
    assert.deepEqual((await messages.json()).messages.map(item => item.text), ['Hello there']);

    const send = await fetch(`${baseUrl}/api/chat/send`, {
      method: 'POST',
      headers: { ...authorization, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '.skip' }),
    });
    assert.equal(send.status, 200);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(sentMessages[0].message, '.skip');
    assert.deepEqual(playbackCalls, []);
    const afterSend = await fetch(`${baseUrl}/api/chat/messages`, { headers: authorization });
    assert.deepEqual((await afterSend.json()).messages.map(item => item.direction), ['incoming', 'outgoing']);

    const left = await fetch(`${baseUrl}/api/room/leave`, { method: 'POST', headers: authorization });
    assert.equal(left.status, 200);
    const cleared = await fetch(`${baseUrl}/api/chat/messages`, { headers: authorization });
    assert.deepEqual(await cleared.json(), { connected: false, messages: [] });
  }, { account: { jwtToken: 'local-test-token', userUuid: 'local-test-id', displayName: 'Music Bot' } }, { apiClient, musicPlayback, createSocket: () => socket });
});

test('connection loss retries the same room and preserves queued playback state', async () => {
  const sockets = [];
  const apiCalls = [];
  const adapterCalls = [];
  const detachOptions = [];
  let attached = false;
  let attachCount = 0;
  const createSocket = () => {
    const listeners = new Map();
    const socket = {
      connected: false,
      on(event, callback) { const set = listeners.get(event) || new Set(); set.add(callback); listeners.set(event, set); },
      off(event, callback) { listeners.get(event)?.delete(callback); },
      emit(event, payload, callback) {
        if (event === 'join_room') callback?.({ result: 200 });
        if (event === 'leave_room') callback?.({ result: 200 });
      },
      connect() { this.connected = true; this.trigger('connect', {}); },
      disconnect() { this.connected = false; this.trigger('disconnect', 'client disconnect'); },
      trigger(event, data) { for (const callback of listeners.get(event) || []) callback(data); },
    };
    sockets.push(socket);
    queueMicrotask(() => socket.connect());
    return socket;
  };
  const apiClient = {
    async getRoom(_token, id) {
      apiCalls.push(id);
      return { id, gmeId: 'voice-1', topic: 'Music room', campus: 'North' };
    },
  };
  const musicAdapter = {
    async assertMusicCapabilities() {},
    async join(input) { adapterCalls.push(['join', input.room]); },
    async leave() { adapterCalls.push(['leave']); },
    async stop() { adapterCalls.push(['stop']); },
    async setVolume() {},
    async setRoomQuality() {},
  };
  const musicPlayback = {
    snapshot: () => ({ status: attached ? 'playing' : 'disconnected', attached, queue: { current: null, upcoming: [], length: 1, repeat: false, loop: false } }),
    async request() { return { added: 0 }; },
    async attachRoom() { attached = true; attachCount++; },
    async detachRoom(options) { attached = false; detachOptions.push(options); },
  };

  await withServer(async ({ baseUrl, ownerToken }) => {
    const headers = { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' };
    const joined = await fetch(`${baseUrl}/api/room/join`, { method: 'POST', headers, body: JSON.stringify({ roomId: 'room1' }) });
    assert.equal(joined.status, 200);
    sockets[0].connected = false;
    sockets[0].trigger('disconnect', 'network lost');

    const recovered = await new Promise((resolve, reject) => {
      const started = Date.now();
      const check = async () => {
        const response = await fetch(`${baseUrl}/api/status`);
        const status = await response.json();
        if (status.connection === 'joined' && status.recovery.status === 'recovered') return resolve(status);
        if (Date.now() - started > 1000) return reject(new Error('room recovery did not complete'));
        setTimeout(check, 5);
      };
      void check();
    });
    assert.equal(recovered.connection, 'joined');
    assert.equal(recovered.recovery.status, 'recovered');
    assert.deepEqual(apiCalls, ['room1', 'room1']);
    assert.deepEqual(detachOptions, [{ preserveQueue: true }]);
    assert.deepEqual(adapterCalls, [['join', 'voice-1'], ['leave'], ['join', 'voice-1']]);
    assert.equal(attachCount, 2);
    assert.equal(sockets.length, 2);
  }, {
    account: { jwtToken: 'local-test-token', userUuid: 'local-test-id', displayName: 'Music Bot' },
  }, { apiClient, musicAdapter, musicPlayback, createSocket, recoveryDelaysMs: [0] });
});

test('exhausted same-room recovery does not join another room without speaker preflight and preserves the queue', async () => {
  const sockets = [];
  const apiCalls = [];
  const adapterCalls = [];
  const detachOptions = [];
  let attached = false;
  let attachCount = 0;
  const createSocket = () => {
    const listeners = new Map();
    const socket = {
      connected: false,
      on(event, callback) { const set = listeners.get(event) || new Set(); set.add(callback); listeners.set(event, set); },
      off(event, callback) { listeners.get(event)?.delete(callback); },
      emit(event, _payload, callback) {
        if (event === 'join_room' || event === 'leave_room') callback?.({ result: 200 });
      },
      connect() { this.connected = true; this.trigger('connect', {}); },
      disconnect() { this.connected = false; this.trigger('disconnect', 'client disconnect'); },
      trigger(event, data) { for (const callback of listeners.get(event) || []) callback(data); },
    };
    sockets.push(socket);
    queueMicrotask(() => socket.connect());
    return socket;
  };
  let roomLookups = 0;
  const apiClient = {
    async getRoom(_token, id) {
      apiCalls.push(['getRoom', id]);
      roomLookups++;
      return roomLookups === 1 ? { id, gmeId: 'voice-old', topic: 'Old room', campus: 'North' } : null;
    },
    async listFollowing() { apiCalls.push(['listFollowing']); return [{ uuid: 'followed-user', name: 'Followed User' }]; },
    async listPublicRooms(_token, options) {
      apiCalls.push(['listPublicRooms', options]);
      return [{ id: 'followed-room', gmeId: 'voice-new', topic: 'Followed room', ownerUuid: 'FOLLOWED-USER', isPrivate: false }];
    },
  };
  const musicAdapter = {
    async assertMusicCapabilities() {},
    async join(input) { adapterCalls.push(['join', input.room]); },
    async leave() { adapterCalls.push(['leave']); },
    async stop() { adapterCalls.push(['stop']); },
    async setVolume() {},
    async setRoomQuality() {},
  };
  const musicPlayback = {
    snapshot: () => ({ status: attached ? 'playing' : 'disconnected', attached, queue: { current: null, upcoming: [], length: 1, repeat: false, loop: false } }),
    async request() { return { added: 0 }; },
    async attachRoom() { attached = true; attachCount++; },
    async detachRoom(options) { attached = false; detachOptions.push(options); },
  };

  await withServer(async ({ baseUrl, ownerToken }) => {
    const headers = { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' };
    const joined = await fetch(`${baseUrl}/api/room/join`, { method: 'POST', headers, body: JSON.stringify({ roomId: 'oldroom' }) });
    assert.equal(joined.status, 200);
    sockets[0].connected = false;
    sockets[0].trigger('disconnect', 'network lost');

    const recovered = await new Promise((resolve, reject) => {
      const started = Date.now();
      const check = async () => {
        const response = await fetch(`${baseUrl}/api/status`);
        const status = await response.json();
        if (status.recovery.status === 'exhausted') return resolve(status);
        if (Date.now() - started > 1000) return reject(new Error('same-room recovery did not exhaust'));
        setTimeout(check, 5);
      };
      void check();
    });
    assert.equal(recovered.connection, 'disconnected');
    assert.equal(recovered.recovery.status, 'exhausted');
    assert.equal(recovered.queueLength, 1);
    assert.deepEqual(apiCalls, [['getRoom', 'oldroom'], ['getRoom', 'oldroom']]);
    assert.deepEqual(detachOptions, [{ preserveQueue: true }]);
    assert.deepEqual(adapterCalls, [['join', 'voice-old'], ['leave']]);
    assert.equal(attachCount, 1);
    assert.equal(sockets.length, 1);
  }, { account: { jwtToken: 'local-test-token', userUuid: 'local-test-id', displayName: 'Music Bot' } }, {
    apiClient, musicAdapter, musicPlayback, createSocket, recoveryDelaysMs: [0],
  });
});

test('explicit room join connects a configured music adapter using only the local account', async () => {
  const calls = [];
  const apiClient = { async getRoom(_token, id) { return { id, gmeId: 'voice-room', topic: 'Music room' }; } };
  const roomSession = {
    snapshot: () => ({ status: 'disconnected', roomId: null, roomName: null }),
    async join({ account, room }) { calls.push(['session.join', account.userUuid, room.id]); return { status: 'joined', roomId: room.id }; },
    async leave() { calls.push(['session.leave']); return true; },
  };
  const musicAdapter = {
    async assertMusicCapabilities() { calls.push(['adapter.capabilities']); },
    async join(value) { calls.push(['adapter.join', value]); },
    async setVolume(value) { calls.push(['adapter.volume', value]); },
    async setRoomQuality(value) { calls.push(['adapter.quality', value]); },
    async stop() { calls.push(['adapter.stop']); },
    async leave() { calls.push(['adapter.leave']); },
  };
  await withServer(async ({ baseUrl, ownerToken }) => {
    const response = await fetch(`${baseUrl}/api/room/join`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId: 'room1' }),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(calls, [
      ['session.join', 'local-test-id', 'room1'],
      ['adapter.capabilities'],
      ['adapter.join', { room: 'voice-room', user: 'local-test-id', uuid: 'local-test-id' }],
      ['adapter.volume', 80],
      ['adapter.quality', 'standard'],
    ]);
  }, {
    account: { jwtToken: 'local-test-token', userUuid: 'local-test-id', displayName: 'Music Bot' },
  }, { apiClient, roomSession, musicAdapter });
});

test('owner API plays a guarded YouTube request only after explicit room join and keeps file paths private', async () => {
  const calls = [];
  let currentRoom = null;
  const apiClient = { async getRoom(_token, id) { return { id, gmeId: 'voice-room', topic: 'Music room' }; } };
  const roomSession = {
    snapshot: () => ({ status: currentRoom ? 'joined' : 'disconnected', roomId: currentRoom?.id || null, roomName: currentRoom?.topic || null }),
    async join({ room }) { currentRoom = room; return { status: 'joined', roomId: room.id }; },
    async leave() { currentRoom = null; return true; },
  };
  const musicAdapter = {
    async assertMusicCapabilities() {},
    async join() {}, async setVolume() {}, async setRoomQuality() {},
    async play({ file }) { calls.push(['play', file]); return { ok: true }; },
    async status() { return {}; },
    async stop() { calls.push(['stop']); return { ok: true }; },
    async pause() { return { ok: true }; }, async resume() { return { ok: true }; },
    async leave() { calls.push(['leave']); return { ok: true }; },
  };
  const youtubeProvider = {
    async info() { return { id: 'aaaaaaaaaaa', title: 'A', duration: 60 }; },
    async search() { return []; },
    async expandPlaylist() { return []; },
    async download(_track, options) { calls.push(['download', options.format]); return 'C:\\music-cache\\a.m4a'; },
    async release(file) { calls.push(['release', file]); return true; },
  };
  await withServer(async ({ baseUrl, ownerToken }) => {
    const headers = { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' };
    const beforeJoin = await fetch(`${baseUrl}/api/music/request`, { method: 'POST', headers, body: JSON.stringify({ query: 'https://www.youtube.com/watch?v=aaaaaaaaaaa' }) });
    assert.equal(beforeJoin.status, 409);
    const joined = await fetch(`${baseUrl}/api/room/join`, { method: 'POST', headers, body: JSON.stringify({ roomId: 'room1' }) });
    assert.equal(joined.status, 200);
    const request = await fetch(`${baseUrl}/api/music/request`, { method: 'POST', headers, body: JSON.stringify({ query: 'https://www.youtube.com/watch?v=aaaaaaaaaaa' }) });
    assert.equal(request.status, 200);
    assert.deepEqual(await request.json().then(body => ({ added: body.added, source: body.source })), { added: 1, source: 'url' });
    const queueResponse = await fetch(`${baseUrl}/api/music/queue`, { headers });
    const queueBody = await queueResponse.json();
    assert.equal(queueBody.status, 'playing');
    assert.equal(queueBody.queue.current.title, 'A');
    assert.equal(JSON.stringify(queueBody).includes('music-cache'), false);
    assert.ok(calls.some(call => call[0] === 'play'));
    const stopped = await fetch(`${baseUrl}/api/music/stop`, { method: 'POST', headers });
    assert.equal(stopped.status, 200);
    assert.equal((await stopped.json()).queue.length, 0);
  }, {
    account: { jwtToken: 'local-test-token', userUuid: 'local-test-id', displayName: 'Music Bot' },
  }, { apiClient, roomSession, musicAdapter, youtubeProvider });
});

test('only one room action may be in flight', async () => {
  let releaseRoomLookup;
  let lookupStarted;
  const started = new Promise(resolve => { lookupStarted = resolve; });
  const lookupGate = new Promise(resolve => { releaseRoomLookup = resolve; });
  const apiClient = {
    async getRoom(_token, roomId) {
      lookupStarted();
      await lookupGate;
      return { id: roomId, gmeId: 'voice-1', topic: 'Music room' };
    },
  };
  const roomSession = {
    snapshot: () => ({ status: 'disconnected', roomId: null, roomName: null }),
    async join({ room: currentRoom }) { return { status: 'joined', roomId: currentRoom.id }; },
    async leave() { return true; },
  };
  await withServer(async ({ baseUrl, ownerToken }) => {
    const options = {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId: 'room1' }),
    };
    const firstRequest = fetch(`${baseUrl}/api/room/join`, options);
    await started;
    const overlap = await fetch(`${baseUrl}/api/room/join`, options);
    assert.equal(overlap.status, 409);
    releaseRoomLookup();
    const first = await firstRequest;
    assert.equal(first.status, 200);
  }, {
    account: { jwtToken: 'local-test-token', userUuid: 'local-test-id', displayName: 'Music Bot' },
  }, { apiClient, roomSession });
});

test('owner API keeps credentials local and never returns saved secrets', async () => {
  await withServer(async ({ baseUrl, ownerToken }) => {
    const denied = await fetch(`${baseUrl}/api/config`);
    assert.equal(denied.status, 401);
    const rejected = await fetch(`${baseUrl}/api/config`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        account: { jwtToken: 'test-account-secret', userUuid: 'test-user-id', displayName: 'Secret bot' },
        groq: { apiKey: 'test-groq-secret', model: 'test-model' },
        azureTts: { subscriptionKey: 'test-tts-secret', region: 'westus' },
        adapter: { type: 'native', baseUrl: 'http://127.0.0.1:9876', token: 'adapter-secret' },
      }),
    });
    assert.equal(rejected.status, 400);
    const saved = await fetch(`${baseUrl}/api/config`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: { volume: 65, autoplay2: true } }),
    });
    assert.equal(saved.status, 200);
    const responseBody = await saved.text();
    assert.equal(responseBody.includes('autoplay2'), false);
    const summary = JSON.parse(responseBody);
    assert.equal(summary.account.configured, false);
    assert.equal(summary.settings.volume, 65);
  });
});

test('config summary reports credential presence without exposing local secrets', async () => {
  await withServer(async ({ baseUrl, ownerToken }) => {
    const allowed = await fetch(`${baseUrl}/api/config`, { headers: { Authorization: `Bearer ${ownerToken}` } });
    assert.equal(allowed.status, 200);
    const responseBody = await allowed.text();
    assert.equal(responseBody.includes('test-account-secret'), false);
    assert.equal(responseBody.includes('test-user-id'), false);
    assert.equal(responseBody.includes('test-groq-secret'), false);
    assert.equal(responseBody.includes('test-tts-secret'), false);
    assert.equal(responseBody.includes('adapter-secret'), false);
    assert.equal(responseBody.includes('displayName'), false);
    assert.equal(responseBody.includes('persona'), false);
    const summary = JSON.parse(responseBody);
    assert.equal(summary.account.configured, true);
    assert.equal(summary.groq.configured, true);
    assert.equal(summary.azureTts.configured, true);
    assert.equal(summary.adapter.configured, true);
  }, {
    account: { jwtToken: 'test-account-secret', userUuid: 'test-user-id', displayName: 'Secret bot' },
    groq: { apiKey: 'test-groq-secret', model: 'test-model' },
    azureTts: { subscriptionKey: 'test-tts-secret', region: 'westus' },
    adapter: { type: 'native', baseUrl: 'http://127.0.0.1:9876', token: 'adapter-secret' },
  });
});

test('portal accepts configured and private LAN origins on the portal port only', async () => {
  await withServer(async ({ baseUrl, ownerToken }) => {
    const accepted = await fetch(`${baseUrl}/api/config`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://192.168.1.44:5254',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'authorization',
      },
    });
    assert.equal(accepted.status, 204);
    assert.equal(accepted.headers.get('access-control-allow-origin'), 'http://192.168.1.44:5254');
    const rejected = await fetch(`${baseUrl}/api/config`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://public.example:5254',
        'Access-Control-Request-Method': 'GET',
      },
    });
    assert.equal(rejected.status, 403);
    assert.equal(typeof ownerToken, 'string');
  });
});

test('invalid setting values are rejected without writing config', async () => {
  await withServer(async ({ baseUrl, ownerToken, configPath }) => {
    const response = await fetch(`${baseUrl}/api/config`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: { volume: 101 } }),
    });
    assert.equal(response.status, 400);
    assert.equal(JSON.parse(fs.readFileSync(configPath, 'utf8')).settings.volume, 80);
  });
});

test('greeting/farewell templates are bounded single-line text', async () => {
  await withServer(async ({ baseUrl, ownerToken, configPath }) => {
    const response = await fetch(`${baseUrl}/api/config`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: { greetingMessage: `x${'x'.repeat(180)}` } }),
    });
    assert.equal(response.status, 400);
    assert.equal(JSON.parse(fs.readFileSync(configPath, 'utf8')).settings.greetingMessage, '');
  });
});

test('does not enable TTS until local Azure credentials and adapter effects are configured', async () => {
  await withServer(async ({ baseUrl, ownerToken, configPath }) => {
    const response = await fetch(`${baseUrl}/api/config`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: { ttsEnabled: true } }),
    });
    assert.equal(response.status, 409);
    assert.match((await response.json()).error, /Azure TTS credentials/);
    assert.equal(JSON.parse(fs.readFileSync(configPath, 'utf8')).settings.ttsEnabled, false);
  });
});

test('enables TTS only after the adapter confirms effect support and never returns the Azure key', async () => {
  const calls = [];
  const musicAdapter = {
    async assertTtsCapabilities() { calls.push('tts-capabilities'); },
    async playEffect() {}, async stopEffect() {}, async setEffectVolume() {},
  };
  const musicPlayback = {
    snapshot: () => ({ attached: false, queue: { length: 0 } }),
    async request() { return { added: 0 }; },
    setDucking() {}, setRepeat() {}, setLoop() {},
  };
  await withServer(async ({ baseUrl, ownerToken, configPath }) => {
    const response = await fetch(`${baseUrl}/api/config`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: { ttsEnabled: true } }),
    });
    assert.equal(response.status, 200);
    const body = await response.text();
    assert.equal(body.includes('private-azure-test-key'), false);
    assert.equal(body.includes('subscriptionKey'), false);
    assert.equal(JSON.parse(fs.readFileSync(configPath, 'utf8')).settings.ttsEnabled, true);
    assert.deepEqual(calls, ['tts-capabilities']);
  }, {
    azureTts: { subscriptionKey: 'private-azure-test-key', region: 'westus2' },
  }, { musicAdapter, musicPlayback });
});
