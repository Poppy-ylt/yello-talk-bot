'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { MAX_CHAT_MESSAGE_LENGTH, MAX_CHAT_MESSAGES, RoomChatService } = require('../src/yellotalk/room-chat-service');

test('keeps a bounded in-memory chat projection and ignores own echoes and invalid text', () => {
  const service = new RoomChatService({ sendMessage: async () => {}, getOwnUuid: () => 'bot-id', now: () => 1000 });
  assert.equal(service.handleIncoming({ message: 'bot echo', uuid: 'bot-id' }), false);
  assert.equal(service.handleIncoming({ message: '   ', uuid: 'member-1' }), false);
  for (let index = 0; index < MAX_CHAT_MESSAGES + 5; index++) {
    service.handleIncoming({ message: `message ${index}`, uuid: `member-${index}`, pin_name: 'Listener' });
  }
  const messages = service.snapshot();
  assert.equal(messages.length, MAX_CHAT_MESSAGES);
  assert.equal(messages[0].text, 'message 5');
  assert.equal(Object.hasOwn(messages[0], 'uuid'), false);
  service.clear();
  assert.deepEqual(service.snapshot(), []);
});

test('validates owner chat sends and adds only successful outgoing messages to the buffer', async () => {
  const sent = [];
  const service = new RoomChatService({
    sendMessage: async text => { sent.push(text); },
    getOwnUuid: () => 'bot-id',
    getOwnName: () => 'Music Bot',
    now: () => 2000,
  });
  const outgoing = await service.send('  .skip  ');
  assert.equal(outgoing.direction, 'outgoing');
  assert.equal(outgoing.sender, 'Music Bot');
  assert.equal(outgoing.text, '.skip');
  assert.deepEqual(sent, ['.skip']);
  await assert.rejects(service.send('x'.repeat(MAX_CHAT_MESSAGE_LENGTH + 1)), /1-800 characters/);

  const failing = new RoomChatService({ sendMessage: async () => { throw new Error('not joined'); } });
  await assert.rejects(failing.send('hello'), /not joined/);
  assert.deepEqual(failing.snapshot(), []);
});

test('enforces a bounded owner send rate', async () => {
  const service = new RoomChatService({ sendMessage: async () => {}, now: () => 10000 });
  for (let index = 0; index < 30; index++) await service.send(`message ${index}`);
  await assert.rejects(service.send('one more'), /send limit/);
});
