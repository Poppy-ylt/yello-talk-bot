'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { RoomReplyService, getMentionedText } = require('../src/ai/room-reply-service');

function fixture({ settings = {}, now = () => 1000 } = {}) {
  const calls = { generated: [], sent: [], spoken: [] };
  const config = {
    account: { userUuid: 'bot-id', displayName: 'Yello Bot', aliases: ['Yello'], persona: 'Friendly persona' },
    groq: { apiKey: 'private-groq-key', model: 'private-test-model' },
    settings: { chatRepliesEnabled: true, fortuneRepliesEnabled: false, ttsEnabled: false, aiReplyTtsEnabled: false, ...settings },
  };
  const service = new RoomReplyService({
    client: { async generateReply(input) { calls.generated.push(input); return `Reply: ${input.text}`; } },
    sendMessage: async message => calls.sent.push(message),
    getConfig: () => config,
    getOwnUuid: () => config.account.userUuid,
    speakReply: async text => calls.spoken.push(text),
    now,
  });
  return { service, calls, config };
}

test('requires an explicit configured name/alias mention and ignores commands and bot echoes', async () => {
  const { service, calls } = fixture();
  assert.equal(await service.handleMessage({ message: 'How are you?', uuid: 'member-1' }), false);
  assert.equal(await service.handleMessage({ message: '.play @Yello song', uuid: 'member-1' }), false);
  assert.equal(await service.handleMessage({ message: 'Hi @Yello', uuid: 'bot-id' }), false);
  assert.equal(await service.handleMessage({ message: 'The yellow flowers are nice', uuid: 'member-1' }), false);
  assert.equal(calls.generated.length, 0);
  assert.deepEqual(getMentionedText('Hey @Yello, what is new?', ['Yello']), { query: 'what is new', matchedAlias: 'Yello' });
});

test('sends a stateless Groq response only for enabled chat and fortune intents', async () => {
  const { service, calls, config } = fixture({ settings: { fortuneRepliesEnabled: true } });
  assert.equal(await service.handleMessage({ message: 'Hey Yello, how is the weather?', uuid: 'member-1' }), true);
  assert.deepEqual(calls.generated[0], { text: 'how is the weather', persona: 'Friendly persona', intent: 'chat' });
  assert.deepEqual(calls.sent, ['Reply: how is the weather']);
  assert.equal(await service.handleMessage({ message: '@Yello, ดูดวงวันนี้', uuid: 'member-2' }), true);
  assert.equal(calls.generated[1].intent, 'fortune');
  assert.equal(config.groq.apiKey, 'private-groq-key');
  assert.equal(JSON.stringify(calls.generated).includes('private-groq-key'), false);
});

test('honors feature switches, sender cooldown, and the separate AI reply TTS toggle', async () => {
  const { service, calls, config } = fixture({ settings: { fortuneRepliesEnabled: false, ttsEnabled: true, aiReplyTtsEnabled: true } });
  assert.equal(await service.handleMessage({ message: '@Yello, ดูดวง', uuid: 'member-1' }), false);
  assert.equal(await service.handleMessage({ message: '@Yello, say hi', uuid: 'member-2' }), true);
  assert.deepEqual(calls.spoken, ['Reply: say hi']);
  assert.equal(await service.handleMessage({ message: '@Yello, say again', uuid: 'member-2' }), false);
  config.settings.chatRepliesEnabled = false;
  assert.equal(await service.handleMessage({ message: '@Yello, say hi', uuid: 'member-3' }), false);
  assert.equal(calls.generated.length, 1);
});

test('does not call the model when local Groq credentials or model are missing', async () => {
  const { service, calls, config } = fixture();
  config.groq.apiKey = '';
  assert.equal(await service.handleMessage({ message: '@Yello, hello', uuid: 'member-1' }), false);
  config.groq.apiKey = 'private-groq-key';
  config.groq.model = '';
  assert.equal(await service.handleMessage({ message: '@Yello, hello', uuid: 'member-2' }), false);
  assert.equal(calls.generated.length, 0);
});

test('bounds concurrent model requests', async () => {
  let release;
  let starts = 0;
  const gate = new Promise(resolve => { release = resolve; });
  const service = new RoomReplyService({
    client: { async generateReply() { starts++; await gate; return 'ok'; } },
    sendMessage: async () => {},
    getConfig: () => ({
      account: { displayName: 'Yello Bot', aliases: ['Yello'] },
      groq: { apiKey: 'key', model: 'test-model' },
      settings: { chatRepliesEnabled: true },
    }),
  });
  const first = service.handleMessage({ message: 'Yello one', uuid: 'member-1' });
  const second = service.handleMessage({ message: 'Yello two', uuid: 'member-2' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(starts, 2);
  assert.equal(await service.handleMessage({ message: 'Yello three', uuid: 'member-3' }), false);
  release();
  assert.deepEqual(await Promise.all([first, second]), [true, true]);
});
