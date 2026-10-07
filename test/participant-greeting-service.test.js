'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { DEFAULT_MESSAGES, ParticipantGreetingService } = require('../src/yellotalk/participant-greeting-service');

test('sends configured greeting/farewell text with a safe participant name', async () => {
  const sent = [];
  const service = new ParticipantGreetingService({
    sendMessage: async message => sent.push(message),
    getSettings: () => ({
      greetingsEnabled: true,
      greetingMessage: 'Welcome, {name}! ',
      farewellsEnabled: true,
      farewellMessage: '',
    }),
    getOwnUuid: () => 'bot-id',
  });

  assert.equal(await service.handleParticipantEvent({ type: 'join', uuid: 'user-1', displayName: '@Ari\nSmith' }), true);
  assert.equal(await service.handleParticipantEvent({ type: 'leave', uuid: 'user-2', displayName: 'Mina' }), true);
  assert.deepEqual(sent, ['Welcome, Ari Smith!', DEFAULT_MESSAGES.leave.replace('{name}', 'Mina')]);
});

test('honors independent toggles and ignores own, malformed, and non-participant events', async () => {
  const sent = [];
  const service = new ParticipantGreetingService({
    sendMessage: async message => sent.push(message),
    getSettings: () => ({ greetingsEnabled: false, farewellsEnabled: true }),
    getOwnUuid: () => 'bot-id',
  });

  assert.equal(await service.handleParticipantEvent({ type: 'join', uuid: 'user-1', displayName: 'Ari' }), false);
  assert.equal(await service.handleParticipantEvent({ type: 'leave', uuid: 'bot-id', displayName: 'Bot' }), false);
  assert.equal(await service.handleParticipantEvent({ type: 'leave', uuid: 'user-2', displayName: '' }), false);
  assert.equal(await service.handleParticipantEvent({ type: 'message', uuid: 'user-3', displayName: 'Mina' }), false);
  assert.deepEqual(sent, []);
});

test('contains send failures without logging or leaking participant text', async () => {
  const service = new ParticipantGreetingService({
    sendMessage: async () => { throw new Error('provider failed'); },
    getSettings: () => ({ greetingsEnabled: true }),
  });
  assert.equal(await service.handleParticipantEvent({ type: 'join', uuid: 'user-1', displayName: 'Ari' }), false);
});
