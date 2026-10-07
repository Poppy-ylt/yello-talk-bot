'use strict';

const MAX_CHAT_MESSAGES = 100;
const MAX_CHAT_MESSAGE_LENGTH = 800;
const MAX_CHAT_SENDS_PER_MINUTE = 30;

function normalizeText(value) {
  return typeof value === 'string'
    ? value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ').trim()
    : '';
}

function senderUuid(data = {}) {
  return String(data.uuid || data.user_uuid || data.sender?.uuid || '').trim().slice(0, 128);
}

function senderName(data = {}) {
  return normalizeText(data.pin_name || data.display_name || data.sender?.display_name || data.sender?.name || 'สมาชิก')
    .replace(/\s+/g, ' ')
    .slice(0, 60) || 'สมาชิก';
}

class RoomChatService {
  constructor({ sendMessage, getOwnUuid = () => '', getOwnName = () => 'บอท', now = Date.now } = {}) {
    if (typeof sendMessage !== 'function') throw new TypeError('A room message sender is required');
    this.sendMessage = sendMessage;
    this.getOwnUuid = getOwnUuid;
    this.getOwnName = getOwnName;
    this.now = now;
    this.nextId = 1;
    this.messages = [];
    this.recentSends = [];
  }

  snapshot() {
    return this.messages.map(message => ({ ...message }));
  }

  handleIncoming(data = {}) {
    const uuid = senderUuid(data);
    if (uuid && uuid === String(this.getOwnUuid() || '')) return false;
    const text = normalizeText(typeof data.message === 'string' ? data.message : data.text);
    if (!text || text.length > MAX_CHAT_MESSAGE_LENGTH) return false;
    this.append({ direction: 'incoming', sender: senderName(data), text });
    return true;
  }

  async send(value) {
    const text = normalizeText(value);
    if (!text || text.length > MAX_CHAT_MESSAGE_LENGTH) {
      throw Object.assign(new Error(`Chat messages must contain 1-${MAX_CHAT_MESSAGE_LENGTH} characters`), { code: 'INVALID_CHAT_MESSAGE' });
    }
    const now = this.now();
    this.recentSends = this.recentSends.filter(timestamp => now - timestamp < 60000);
    if (this.recentSends.length >= MAX_CHAT_SENDS_PER_MINUTE) {
      throw Object.assign(new Error('Chat send limit reached; try again shortly'), { code: 'CHAT_RATE_LIMIT' });
    }
    this.recentSends.push(now);
    await this.sendMessage(text);
    this.append({ direction: 'outgoing', sender: senderName({ pin_name: this.getOwnName() }), text });
    return this.messages.at(-1);
  }

  clear() {
    this.messages = [];
  }

  append(message) {
    this.messages.push({ id: this.nextId++, createdAt: this.now(), ...message });
    if (this.messages.length > MAX_CHAT_MESSAGES) this.messages.splice(0, this.messages.length - MAX_CHAT_MESSAGES);
  }
}

module.exports = { MAX_CHAT_MESSAGE_LENGTH, MAX_CHAT_MESSAGES, MAX_CHAT_SENDS_PER_MINUTE, RoomChatService, normalizeText };
