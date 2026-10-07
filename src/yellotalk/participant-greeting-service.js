'use strict';

const MAX_TEMPLATE_LENGTH = 180;
const MAX_MESSAGE_LENGTH = 250;

const DEFAULT_MESSAGES = Object.freeze({
  join: 'ยินดีต้อนรับ {name}',
  leave: 'ลาก่อน {name}',
});

function cleanText(value, limit) {
  return String(value || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit);
}

class ParticipantGreetingService {
  constructor({ sendMessage, getSettings = () => ({}), getOwnUuid = () => '' } = {}) {
    if (typeof sendMessage !== 'function') throw new TypeError('A room message sender is required');
    this.sendMessage = sendMessage;
    this.getSettings = getSettings;
    this.getOwnUuid = getOwnUuid;
  }

  async handleParticipantEvent(event = {}) {
    const type = event.type;
    if (type !== 'join' && type !== 'leave') return false;
    const uuid = String(event.uuid || '').trim().slice(0, 128);
    if (!uuid || uuid === String(this.getOwnUuid() || '')) return false;
    const displayName = cleanText(event.displayName, 40).replace(/@/g, ' ');
    if (!displayName) return false;

    const settings = this.getSettings() || {};
    const enabled = type === 'join' ? settings.greetingsEnabled : settings.farewellsEnabled;
    if (enabled !== true) return false;
    const configured = type === 'join' ? settings.greetingMessage : settings.farewellMessage;
    const template = cleanText(configured, MAX_TEMPLATE_LENGTH) || DEFAULT_MESSAGES[type];
    const message = cleanText(template.replace(/\{name\}/gi, displayName), MAX_MESSAGE_LENGTH);
    if (!message) return false;
    try {
      await this.sendMessage(message);
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = { DEFAULT_MESSAGES, MAX_MESSAGE_LENGTH, MAX_TEMPLATE_LENGTH, ParticipantGreetingService };
