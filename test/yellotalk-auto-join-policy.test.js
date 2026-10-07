'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { selectFollowedRoom } = require('../src/yellotalk/auto-join-policy');

const rooms = [
  { id: 'not-followed', ownerUuid: 'other-user', isPrivate: false },
  { id: 'followed-1', ownerUuid: 'followed-user', isPrivate: false },
  { id: 'followed-private', ownerUuid: 'followed-user', isPrivate: true },
  { id: 'followed-2', ownerUuid: 'FOLLOWED-USER', isPrivate: false },
];

test('random selection filters to public rooms of followed owners before sampling', () => {
  assert.equal(selectFollowedRoom(rooms, [{ uuid: 'Followed-User' }], { random: () => 0 }), rooms[1]);
  assert.equal(selectFollowedRoom(rooms, ['followed-user'], { random: () => 0.99 }), rooms[3]);
});

test('selection excludes the current room, deduplicates room IDs, and fails closed without candidates', () => {
  assert.equal(selectFollowedRoom([...rooms, rooms[1]], ['followed-user'], {
    excludeRoomId: 'followed-1', random: () => 0,
  }), rooms[3]);
  assert.equal(selectFollowedRoom(rooms, [], { random: () => 0 }), null);
  assert.equal(selectFollowedRoom(rooms, ['followed-user'], { excludeRoomId: 'followed-1', random: () => 0 }), rooms[3]);
});
