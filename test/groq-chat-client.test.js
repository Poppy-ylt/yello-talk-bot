'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { GroqChatClient, systemPrompt } = require('../src/ai/groq-chat-client');

test('uses one system prompt and one current user message with no conversation history', async () => {
  const calls = [];
  const client = new GroqChatClient({
    model: 'test-model',
    client: { chat: { completions: { async create(body) { calls.push(body); return { choices: [{ message: { content: 'Hello, room!' } }] }; } } } },
  });
  const reply = await client.generateReply({ text: 'How are you?', persona: 'Warm, brief voice', intent: 'chat' });
  assert.equal(reply, 'Hello, room!');
  assert.deepEqual(calls[0].messages.map(message => message.role), ['system', 'user']);
  assert.equal(calls[0].messages[1].content, 'How are you?');
  assert.equal(calls[0].messages[0].content.includes('Warm, brief voice'), true);
  assert.equal(calls[0].max_completion_tokens, 220);
  assert.equal(calls[0].stream, false);
});

test('adds entertainment-only boundaries for horoscope prompts and bounds text/model IDs', async () => {
  assert.match(systemPrompt('', 'fortune'), /light entertainment/);
  assert.doesNotMatch(systemPrompt('', 'chat'), /light entertainment/);
  const calls = [];
  const client = new GroqChatClient({
    model: 'test-model',
    client: { chat: { completions: { async create(body) { calls.push(body); return { choices: [{ message: { content: 'ok' } }] }; } } } },
  });
  await client.generateReply({ text: 'x'.repeat(600) });
  assert.equal(calls[0].messages[1].content.length, 500);
  assert.throws(() => new GroqChatClient({ client: {}, model: 'bad model' }), /model ID/);
  await assert.rejects(client.generateReply({ text: '' }), /chat message/);
});
