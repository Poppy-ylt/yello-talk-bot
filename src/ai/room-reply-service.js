'use strict';

const MAX_COOLDOWN_SENDERS = 1000;
const DEFAULT_REPLY_COOLDOWN_MS = 10000;
const MAX_REPLY_TEXT_CHARS = 500;
const MAX_CONCURRENT_REPLIES = 2;
const FORTUNE_TRIGGER = /(?:ดูดวง|ทำนาย|ดวงวันนี้|horoscope|fortune)/i;

function normalizeRoomText(value) {
  return typeof value === 'string'
    ? value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ' ').trim().slice(0, MAX_REPLY_TEXT_CHARS)
    : '';
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function aliasMatches(text, alias) {
  if (/^[A-Za-z0-9_]+$/.test(alias)) {
    return new RegExp(`(?<![\\p{L}\\p{N}_])@?${escapeRegex(alias)}(?![\\p{L}\\p{N}_])`, 'iu').test(text);
  }
  return text.toLocaleLowerCase().includes(alias.toLocaleLowerCase());
}

function getMentionedText(message, names) {
  const original = normalizeRoomText(message);
  if (!original || original.startsWith('.')) return null;
  const aliases = [...new Set((Array.isArray(names) ? names : [])
    .filter(value => typeof value === 'string')
    .map(value => value.trim())
    .filter(value => value.length >= 2))]
    .sort((left, right) => right.length - left.length);
  const lower = original.toLocaleLowerCase();
  const matched = aliases.find(alias => aliasMatches(original, alias));
  if (!matched) return null;
  const query = original.replace(new RegExp(escapeRegex(matched), 'ig'), ' ')
    .replace(/[@,，:：.!?！？\s]+/g, ' ')
    .replace(/^(?:hey|hi|hello|yo|สวัสดี|หวัดดี|เฮ้)\s*/i, '')
    .trim();
  return { query: query.slice(0, MAX_REPLY_TEXT_CHARS), matchedAlias: matched };
}

class RoomReplyService {
  constructor({ client, sendMessage, getConfig = () => ({}), getOwnUuid = () => '', speakReply, cooldownMs = DEFAULT_REPLY_COOLDOWN_MS, now = Date.now } = {}) {
    if (!client || typeof client.generateReply !== 'function' || typeof sendMessage !== 'function') {
      throw new TypeError('A Groq reply client and room message sender are required');
    }
    this.client = client;
    this.sendMessage = sendMessage;
    this.getConfig = getConfig;
    this.getOwnUuid = getOwnUuid;
    this.speakReply = speakReply;
    this.cooldownMs = Math.max(1000, Math.min(60000, Number(cooldownMs) || DEFAULT_REPLY_COOLDOWN_MS));
    this.now = now;
    this.lastReplyAt = new Map();
    this.inFlight = 0;
  }

  async handleMessage(data = {}) {
    const config = this.getConfig() || {};
    const settings = config.settings || {};
    const senderId = String(data.uuid || data.user_uuid || data.sender?.uuid || '').trim().slice(0, 128);
    if (senderId && senderId === String(this.getOwnUuid() || '')) return false;
    const text = normalizeRoomText(typeof data.message === 'string' ? data.message : data.text);
    const account = config.account || {};
    const mention = getMentionedText(text, [account.displayName, ...(account.aliases || [])]);
    if (!mention || !mention.query) return false;
    const fortune = FORTUNE_TRIGGER.test(mention.query);
    if (fortune ? settings.fortuneRepliesEnabled !== true : settings.chatRepliesEnabled !== true) return false;
    const senderKey = senderId || String(data.pin_name || data.display_name || 'member').slice(0, 80).toLowerCase();
    if (!this.allowSender(senderKey)) return false;

    const clientConfig = config.groq || {};
    if (!clientConfig.apiKey || !clientConfig.model) return false;
    if (this.inFlight >= MAX_CONCURRENT_REPLIES) return false;
    this.inFlight++;
    try {
      const reply = await this.client.generateReply({
        text: mention.query,
        persona: account.persona || '',
        intent: fortune ? 'fortune' : 'chat',
      });
      await this.sendMessage(reply);
      if (settings.ttsEnabled === true && settings.aiReplyTtsEnabled === true && typeof this.speakReply === 'function') {
        await this.speakReply(reply);
      }
      return true;
    } catch {
      return false;
    } finally {
      this.inFlight = Math.max(0, this.inFlight - 1);
    }
  }

  allowSender(senderKey) {
    const now = this.now();
    for (const [key, timestamp] of this.lastReplyAt) {
      if (now - timestamp > this.cooldownMs * 4) this.lastReplyAt.delete(key);
    }
    const previous = this.lastReplyAt.get(senderKey);
    if (previous != null && now - previous < this.cooldownMs) return false;
    if (this.lastReplyAt.size >= MAX_COOLDOWN_SENDERS) {
      const oldest = this.lastReplyAt.keys().next().value;
      if (oldest != null) this.lastReplyAt.delete(oldest);
    }
    this.lastReplyAt.set(senderKey, now);
    return true;
  }
}

module.exports = { DEFAULT_REPLY_COOLDOWN_MS, FORTUNE_TRIGGER, MAX_CONCURRENT_REPLIES, MAX_REPLY_TEXT_CHARS, RoomReplyService, aliasMatches, getMentionedText, normalizeRoomText };
