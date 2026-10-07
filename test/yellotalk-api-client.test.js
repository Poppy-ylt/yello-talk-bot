'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { FOLLOWING_PAGE_SIZE, ROOM_PAGE_SIZE, YelloTalkApiClient, normalizeRoom } = require('../src/yellotalk/api-client');

test('lists public rooms using authenticated, paginated YelloTalk requests', async () => {
  const calls = [];
  const http = {
    async get(url, options) {
      calls.push({ url, options });
      const offset = Number(new URL(url).searchParams.get('offset'));
      const rooms = offset === 0
        ? Array.from({ length: ROOM_PAGE_SIZE }, (_, index) => ({
          id: `room${index}`, gme_id: `voice-${index}`, topic: `Room ${index}`,
          ...(index === 0 ? { owner: { uuid: 'Owner-1' } } : {}),
        }))
        : [{ id: 'room20', gme_id: 'voice-20', topic: 'Room 20' }, { id: 'private', gme_id: 'voice-private', is_private: true }];
      return { data: { json: rooms } };
    },
  };
  const api = new YelloTalkApiClient({ http });
  const rooms = await api.listPublicRooms('local-token', { maxRooms: 30 });
  assert.equal(calls.length, 2);
  assert.equal(new URL(calls[0].url).searchParams.get('offset'), '0');
  assert.equal(new URL(calls[1].url).searchParams.get('offset'), '20');
  assert.equal(new URL(calls[0].url).searchParams.get('is_private'), 'false');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer local-token');
  assert.equal(rooms.length, 21);
  assert.equal(rooms.some(room => room.id === 'private'), false);
  assert.deepEqual(rooms[0], {
      id: 'room0', gmeId: 'voice-0', ownerUuid: 'Owner-1', topic: 'Room 0', campus: 'No Group', participantCount: null, isPrivate: false,
  });
});

test('caps room-list paging and rejects malformed room identities', async () => {
  let calls = 0;
  const api = new YelloTalkApiClient({
    http: { async get() { calls++; return { data: { json: Array.from({ length: ROOM_PAGE_SIZE }, (_, i) => ({ id: `room${i}`, gme_id: i })) } }; } },
  });
  await api.listPublicRooms('token', { maxRooms: 1 });
  assert.equal(calls, 1);
  assert.equal(normalizeRoom({ id: '../unsafe', gme_id: 1 }), null);
  assert.equal(normalizeRoom({ id: 'room', topic: 'missing voice ID' }), null);
});

test('loads room details and rejects arbitrary room IDs before making a request', async () => {
  const calls = [];
  const api = new YelloTalkApiClient({
    http: { async get(url, options) { calls.push({ url, options }); return { data: { json: { room: { id: 'room1', gme_id: 'voice-1', topic: 'Test', owner: { group_shortname: 'West' } } } } }; } },
  });
  assert.deepEqual(await api.getRoom('token', 'room1'), {
    id: 'room1', gmeId: 'voice-1', ownerUuid: null, topic: 'Test', campus: 'West', participantCount: null, isPrivate: false,
  });
  await assert.rejects(api.getRoom('token', 'https://attacker.invalid/'), /Invalid room ID/);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/rooms\/room1$/);
});

test('reads the account following list with bounded pagination and excludes blocked or duplicate users', async () => {
  const calls = [];
  const api = new YelloTalkApiClient({
    http: {
      async get(url, options) {
        calls.push({ url, options });
        const offset = Number(new URL(url).searchParams.get('offset'));
        const entries = offset === 0
          ? Array.from({ length: FOLLOWING_PAGE_SIZE }, (_, index) => ({ target_user: { uuid: `user-${index}`, pin_name: `User ${index}` } }))
          : [
            { target_user: { uuid: `user-${FOLLOWING_PAGE_SIZE}`, pin_name: ' New User ' } },
            { target_user: { uuid: 'USER-1', pin_name: 'Duplicate' } },
            { is_blocked: 1, target_user: { uuid: 'blocked-user', pin_name: 'Blocked' } },
          ];
        return { data: { json: entries } };
      },
    },
  });
  const users = await api.listFollowing('local-token', { maxUsers: 250 });
  assert.equal(calls.length, 2);
  assert.equal(new URL(calls[0].url).pathname, '/v1/users/me/follow/following');
  assert.equal(new URL(calls[0].url).searchParams.get('limit'), String(FOLLOWING_PAGE_SIZE));
  assert.equal(new URL(calls[1].url).searchParams.get('offset'), String(FOLLOWING_PAGE_SIZE));
  assert.equal(calls[0].options.headers.Authorization, 'Bearer local-token');
  assert.equal(users.length, FOLLOWING_PAGE_SIZE + 1);
  assert.deepEqual(users.at(-1), { uuid: `user-${FOLLOWING_PAGE_SIZE}`, name: 'New User' });
  assert.equal(users.some(user => user.uuid === 'blocked-user'), false);
});

test('fails closed on malformed following responses and invalid pagination ranges', async () => {
  let calls = 0;
  const api = new YelloTalkApiClient({ http: { async get() { calls++; return { data: { json: { error: 'unauthorized' } } }; } } });
  await assert.rejects(api.listFollowing('token'), /following response was not a list/);
  await assert.rejects(api.followingPage('token', { limit: FOLLOWING_PAGE_SIZE + 1 }), /Invalid following-page range/);
  assert.equal(calls, 1);
});

test('creates a public room using the existing topic-only YelloTalk payload', async () => {
  const calls = [];
  const api = new YelloTalkApiClient({
    http: {
      async get() { throw new Error('unexpected GET'); },
      async post(url, body, options) {
        calls.push({ url, body, options });
        return { data: { json: { id: 'room2', gme_id: 'voice-2', topic: body.topic } } };
      },
    },
  });
  assert.deepEqual(await api.createPublicRoom('token', '  Music room  '), {
    id: 'room2', gmeId: 'voice-2', ownerUuid: null, topic: 'Music room', campus: 'No Group', participantCount: null, isPrivate: false,
  });
  assert.equal(calls[0].url, 'https://live.yellotalk.co/v1/rooms');
  assert.deepEqual(calls[0].body, { category_id: 0, is_private: false, limit_speaker: 1, topic: 'Music room' });
  assert.equal(calls[0].options.headers.Authorization, 'Bearer token');
});

test('public room creation validates the name and rejects incomplete API responses', async () => {
  let calls = 0;
  const api = new YelloTalkApiClient({ http: {
    async get() {},
    async post() { calls++; return { data: { json: { id: 'room3' } } }; },
  } });
  await assert.rejects(api.createPublicRoom('token', ''), /Room name is required/);
  await assert.rejects(api.createPublicRoom('token', 'x'.repeat(101)), /100 characters or fewer/);
  await assert.rejects(api.createPublicRoom('token', 'Valid title'), /valid created room/);
  assert.equal(calls, 1);
});

test('requires an account token before any API request', async () => {
  let calls = 0;
  const api = new YelloTalkApiClient({ http: { async get() { calls++; } } });
  await assert.rejects(api.listPublicRooms(''), /account is not configured/);
  assert.equal(calls, 0);
});
