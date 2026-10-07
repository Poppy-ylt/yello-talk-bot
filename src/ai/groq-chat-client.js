'use strict';

const Groq = require('groq-sdk');

const DEFAULT_GROQ_MODEL = 'llama-3.3-70b-versatile';
const MAX_CHAT_INPUT_CHARS = 500;
const MAX_CHAT_REPLY_CHARS = 500;
const MAX_PERSONA_CHARS = 1200;

function boundedText(value, maxLength) {
  return String(value || '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ' ').trim().slice(0, maxLength);
}

function systemPrompt(persona, intent) {
  const installedPersona = boundedText(persona, MAX_PERSONA_CHARS);
  const base = [
    'You are a friendly YelloTalk room bot. Reply in the language used by the person.',
    'Keep the response concise, respectful, and suitable for a public group chat.',
    'Do not claim you can control music, accounts, rooms, or settings.',
    installedPersona ? `The owner-set persona is: ${installedPersona}` : '',
  ].filter(Boolean);
  if (intent === 'fortune') {
    base.push('Treat fortune and horoscope requests as light entertainment. Do not present predictions as facts or give high-stakes medical, legal, or financial advice.');
  }
  return base.join('\n');
}

class GroqChatClient {
  constructor({ client, apiKey, model = DEFAULT_GROQ_MODEL, timeoutMs = 20000, maxRetries = 1 } = {}) {
    const normalizedModel = boundedText(model, 100);
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/.test(normalizedModel)) throw new Error('A valid Groq model ID is required');
    const key = String(apiKey || '').trim();
    if (!client && !key) throw new Error('Groq API key is not configured');
    this.client = client || new Groq({ apiKey: key, timeout: Math.max(1000, Math.min(60000, Number(timeoutMs) || 20000)), maxRetries: Math.max(0, Math.min(2, Number(maxRetries) || 0)) });
    this.model = normalizedModel;
  }

  async generateReply({ text, persona = '', intent = 'chat' } = {}) {
    const content = boundedText(text, MAX_CHAT_INPUT_CHARS);
    if (!content) throw new Error('A chat message is required');
    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt(persona, intent) },
        { role: 'user', content },
      ],
      max_completion_tokens: 220,
      temperature: 0.7,
      n: 1,
      stream: false,
    });
    const reply = boundedText(completion?.choices?.[0]?.message?.content, MAX_CHAT_REPLY_CHARS);
    if (!reply) throw new Error('Groq returned an empty response');
    return reply;
  }
}

module.exports = {
  DEFAULT_GROQ_MODEL,
  MAX_CHAT_INPUT_CHARS,
  MAX_CHAT_REPLY_CHARS,
  MAX_PERSONA_CHARS,
  GroqChatClient,
  boundedText,
  systemPrompt,
};
