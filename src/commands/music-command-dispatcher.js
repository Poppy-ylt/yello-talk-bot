'use strict';

const { DOT_COMMAND_HELP_MESSAGES } = require('./dot-command-help');
const { parseDotCommand } = require('./dot-command-parser');
const { normalizeRoomQuality, roomQualityFromLevel, roomQualityUsage } = require('../music/room-quality');
const { DEFAULT_SPEECH_VOICE, validateVoice } = require('../tts/azure-speech-client');

const DEFAULT_SENDER_COOLDOWN_MS = 750;
const MAX_COOLDOWN_ENTRIES = 1000;
const MAX_PLAYLIST_LINES = 6;

function safeChatText(value, maxLength = 140) {
  return String(value || '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, maxLength);
}

function messageDetails(data = {}) {
  const text = typeof data.message === 'string' ? data.message : data.text;
  const senderId = String(data.uuid || data.user_uuid || data.sender?.uuid || '').trim();
  const senderName = safeChatText(data.pin_name || data.display_name || data.sender?.name || 'Member', 80);
  return { text: typeof text === 'string' ? text : '', senderId, senderName };
}

function parseToggle(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'on') return true;
  if (normalized === 'off') return false;
  return null;
}

function displayQuality(value) {
  const normalized = value === 'hq' ? 'highquality' : normalizeRoomQuality(value);
  if (normalized === 'fluency') return '1 (Fluency)';
  if (normalized === 'standard') return '2 (Standard)';
  if (normalized === 'highquality') return '3 (HQ)';
  return 'unknown';
}

class MusicCommandDispatcher {
  constructor({
    playback,
    sendMessage,
    getSettings = () => ({}),
    getOwnUuid = () => '',
    isTtsConfigured = () => false,
    onSettingsChange = async () => {},
    senderCooldownMs = DEFAULT_SENDER_COOLDOWN_MS,
    now = Date.now,
  } = {}) {
    if (!playback || typeof playback.request !== 'function' || typeof sendMessage !== 'function') {
      throw new TypeError('Music playback and a room message sender are required');
    }
    this.playback = playback;
    this.sendMessage = sendMessage;
    this.getSettings = getSettings;
    this.getOwnUuid = getOwnUuid;
    this.isTtsConfigured = isTtsConfigured;
    this.onSettingsChange = onSettingsChange;
    this.senderCooldownMs = Math.max(0, Math.min(10000, Number(senderCooldownMs) || 0));
    this.now = now;
    this.lastCommandAt = new Map();
  }

  async send(text) {
    const message = String(text || '').trim();
    if (!message) return false;
    try {
      await this.sendMessage(message.slice(0, 800));
      return true;
    } catch {
      return false;
    }
  }

  allowSender(senderId, senderName) {
    const now = this.now();
    for (const [key, lastAt] of this.lastCommandAt) {
      if (now - lastAt > this.senderCooldownMs * 4) this.lastCommandAt.delete(key);
    }
    const key = senderId || senderName.toLowerCase();
    const lastAt = this.lastCommandAt.get(key);
    if (lastAt != null && now - lastAt < this.senderCooldownMs) return false;
    if (this.lastCommandAt.size >= MAX_COOLDOWN_ENTRIES) {
      const oldestKey = this.lastCommandAt.keys().next().value;
      if (oldestKey != null) this.lastCommandAt.delete(oldestKey);
    }
    this.lastCommandAt.set(key, now);
    return true;
  }

  async handle(data) {
    const { text, senderId, senderName } = messageDetails(data);
    if (senderId && senderId === String(this.getOwnUuid() || '')) return { handled: false, reason: 'own-message' };
    const command = parseDotCommand(text.trim());
    if (!command || command.kind === 'unknown') return { handled: false, reason: 'not-allowlisted' };
    if (!this.allowSender(senderId, senderName)) return { handled: false, reason: 'cooldown' };

    if (command.kind === 'help') {
      for (const message of DOT_COMMAND_HELP_MESSAGES) await this.send(message);
      return { handled: true, action: 'help' };
    }

    try {
      return await this.dispatch(command, { senderId, senderName });
    } catch (error) {
      await this.send(this.userFacingError(error));
      return { handled: true, action: command.action, error: error?.code || 'COMMAND_FAILED' };
    }
  }

  userFacingError(error) {
    switch (error?.code) {
      case 'AUDIO_ADAPTER_UNAVAILABLE': return 'Music controls are unavailable until the audio adapter is connected.';
      case 'QUEUE_LIMIT': return 'The music queue is full.';
      case 'EMPTY_REQUEST': return 'Add a song name or YouTube URL after the command.';
      case 'YOUTUBE_ONLY': return 'Only YouTube videos and playlists are supported.';
      case 'YOUTUBE_LIVE_UNSUPPORTED': return 'YouTube live streams are not supported.';
      case 'TRACK_TOO_LONG':
      case 'MUSIC_BLOCKED':
      case 'DURATION_UNAVAILABLE': return safeChatText(error.message, 180);
      case 'INVALID_VOLUME': return 'Volume must be a number from 0 to 100.';
      case 'INVALID_QUEUE_POSITION': return 'Use a positive queue number, such as .remove 2.';
      case 'TTS_NOT_CONFIGURED': return 'Configure Azure TTS credentials locally before enabling speech.';
      case 'TTS_NOT_SUPPORTED': return 'The audio adapter cannot play speech effects separately from music.';
      default: return 'That music command could not be completed.';
    }
  }

  async dispatch(command, { senderName }) {
    const settings = this.getSettings() || {};
    const parameter = command.param.trim();
    const queue = this.playback.snapshot?.().queue || {};

    switch (command.action) {
      case 'PLAY':
      case 'QUEUE': {
        if (command.word === 'queue' && !parameter) return this.showQueue(queue);
        if (!parameter) throw Object.assign(new Error('A music search or URL is required'), { code: 'EMPTY_REQUEST' });
        const result = await this.playback.request(parameter, { requestedBy: senderName, waitForPlayback: false });
        await this.send(`Added ${result.added} track${result.added === 1 ? '' : 's'} to the music queue.`);
        return { handled: true, action: command.action, added: result.added };
      }
      case 'SKIP': {
        const skipped = await this.playback.skip();
        await this.send(skipped ? 'Skipped the current track.' : 'There is no track to skip.');
        return { handled: true, action: command.action, skipped };
      }
      case 'PAUSE': {
        const paused = await this.playback.pause();
        await this.send(paused ? 'Music paused.' : 'Music is not playing.');
        return { handled: true, action: command.action, paused };
      }
      case 'RESUME': {
        const resumed = await this.playback.resume();
        await this.send(resumed ? 'Music resumed.' : 'Music is not paused.');
        return { handled: true, action: command.action, resumed };
      }
      case 'STOP':
        await this.playback.stop();
        await this.send('Music stopped and the queue was cleared.');
        return { handled: true, action: command.action };
      case 'PLAYLIST':
        return this.showQueue(queue);
      case 'REMOVE': {
        const position = Number(parameter);
        if (!Number.isInteger(position) || position < 1) throw Object.assign(new Error('Invalid queue position'), { code: 'INVALID_QUEUE_POSITION' });
        const removed = this.playback.removeUpcoming(position);
        await this.send(removed ? `Removed ${safeChatText(removed.title)} from the queue.` : 'That queue number was not found.');
        return { handled: true, action: command.action, removed: Boolean(removed) };
      }
      case 'CLEAR_PLAYLIST': {
        const removed = this.playback.clearUpcoming();
        await this.send(`Cleared ${removed} upcoming track${removed === 1 ? '' : 's'}.`);
        return { handled: true, action: command.action, removed };
      }
      case 'NOW_PLAYING': {
        const current = queue.current;
        await this.send(current ? `Now playing: ${safeChatText(current.title)}` : 'Nothing is playing right now.');
        return { handled: true, action: command.action, playing: Boolean(current) };
      }
      case 'VOLUME': {
        if (!parameter) {
          await this.send(`Music volume: ${Number(settings.volume) || 0}%.`);
          return { handled: true, action: command.action, volume: settings.volume };
        }
        const volume = Number(parameter);
        if (!Number.isFinite(volume) || volume < 0 || volume > 100) throw Object.assign(new Error('Invalid volume'), { code: 'INVALID_VOLUME' });
        const applied = await this.playback.setVolume(volume);
        await this.onSettingsChange({ volume: applied });
        await this.send(`Music volume set to ${applied}%.`);
        return { handled: true, action: command.action, volume: applied };
      }
      case 'REPEAT_TRACK':
        return this.toggleQueueSetting('repeat', parameter, this.playback.setRepeat.bind(this.playback));
      case 'LOOP_QUEUE':
        return this.toggleQueueSetting('loop', parameter, this.playback.setLoop.bind(this.playback));
      case 'AUTOPLAY':
        return this.toggleConfigSetting('autoplay', parameter, settings.autoplay === true);
      case 'ROOM_QUALITY': {
        const quality = roomQualityFromLevel(parameter) || normalizeRoomQuality(parameter);
        if (!quality) {
          if (!parameter) await this.send(`Room quality: ${displayQuality(settings.roomQuality)}. ${roomQualityUsage()}`);
          else await this.send(`Choose a room quality: ${roomQualityUsage()}`);
          return { handled: true, action: command.action, changed: false };
        }
        const adapterQuality = quality === 'highquality' ? 'hq' : quality;
        await this.playback.setRoomQuality(adapterQuality);
        await this.onSettingsChange({ roomQuality: adapterQuality });
        await this.send(`Room quality set to ${displayQuality(quality)}.`);
        return { handled: true, action: command.action, roomQuality: adapterQuality };
      }
      case 'TTS':
        return this.handleTts(parameter, settings);
      default:
        return { handled: false, reason: 'unsupported-action' };
    }
  }

  async handleTts(parameter, settings) {
    const [setting = 'status', ...parts] = parameter.split(/\s+/).filter(Boolean);
    const value = parts.join(' ');
    const name = setting.toLowerCase();
    if (name === 'status') {
      const configured = this.isTtsConfigured();
      await this.send(`TTS ${settings.ttsEnabled ? 'on' : 'off'}; ${configured ? 'Azure is configured' : 'Azure is not configured'}; voice ${safeChatText(settings.ttsVoice || DEFAULT_SPEECH_VOICE, 64)}, speed ${Number(settings.ttsSpeed) || 1}, pitch ${Number(settings.ttsPitch) || 0}, volume ${Number(settings.ttsVolume) || 0}%.`);
      return { handled: true, action: 'TTS', available: configured, enabled: settings.ttsEnabled === true };
    }
    if (name === 'on' || name === 'off') {
      const enabled = name === 'on';
      await this.onSettingsChange({ ttsEnabled: enabled });
      await this.send(`TTS ${enabled ? 'enabled' : 'disabled'}.`);
      return { handled: true, action: 'TTS', enabled };
    }
    if (name === 'voice') {
      const voice = value ? validateVoice(value) : null;
      if (!voice) {
        await this.send('Use an Azure Neural voice name, for example .tts voice en-US-JennyNeural.');
        return { handled: true, action: 'TTS', changed: false };
      }
      await this.onSettingsChange({ ttsVoice: voice });
      await this.send(`TTS voice set to ${voice}.`);
      return { handled: true, action: 'TTS', voice };
    }
    if (name === 'speed' || name === 'pitch' || name === 'vol' || name === 'volume') {
      const key = name === 'vol' || name === 'volume' ? 'ttsVolume' : name === 'speed' ? 'ttsSpeed' : 'ttsPitch';
      const amount = Number(value);
      const minimum = key === 'ttsSpeed' ? 0.5 : key === 'ttsPitch' ? -50 : 0;
      const maximum = key === 'ttsSpeed' ? 1.5 : key === 'ttsPitch' ? 50 : 100;
      if (!Number.isFinite(amount) || amount < minimum || amount > maximum) {
        await this.send(`TTS ${name} must be between ${minimum} and ${maximum}.`);
        return { handled: true, action: 'TTS', changed: false };
      }
      const settingValue = key === 'ttsSpeed' ? Math.round(amount * 100) / 100 : Math.round(amount);
      await this.onSettingsChange({ [key]: settingValue });
      await this.send(`TTS ${name} set to ${settingValue}${key === 'ttsVolume' ? '%' : ''}.`);
      return { handled: true, action: 'TTS', [key]: settingValue };
    }
    await this.send('Use .tts status, on/off, voice, speed, pitch, or vol.');
    return { handled: true, action: 'TTS', changed: false };
  }

  async toggleQueueSetting(name, parameter, setter) {
    const current = name === 'repeat'
      ? this.playback.snapshot?.().queue?.repeat === true
      : this.playback.snapshot?.().queue?.loop === true;
    const enabled = parseToggle(parameter);
    if (parameter && enabled == null) {
      await this.send(`Use .${name} on or .${name} off.`);
      return { handled: true, changed: false };
    }
    const next = enabled == null ? current : enabled;
    setter(next);
    await this.onSettingsChange({ [name]: next });
    await this.send(`${name === 'repeat' ? 'Repeat' : 'Queue loop'} ${next ? 'enabled' : 'disabled'}.`);
    return { handled: true, [name]: next };
  }

  async toggleConfigSetting(name, parameter, current) {
    const enabled = parseToggle(parameter);
    if (parameter && enabled == null) {
      await this.send(`Use .${name} on or .${name} off.`);
      return { handled: true, changed: false };
    }
    const next = enabled == null ? current : enabled;
    await this.onSettingsChange({ [name]: next });
    await this.send(`${name === 'autoplay' ? 'Autoplay' : name} ${next ? 'enabled' : 'disabled'}.`);
    return { handled: true, [name]: next };
  }

  async showQueue(queue) {
    const current = queue.current ? `Now: ${safeChatText(queue.current.title)}` : 'Nothing is playing.';
    const upcoming = Array.isArray(queue.upcoming) ? queue.upcoming : [];
    const lines = upcoming.slice(0, MAX_PLAYLIST_LINES).map((item, index) => `${index + 1}. ${safeChatText(item.title)}`);
    const extra = upcoming.length > MAX_PLAYLIST_LINES ? `\n…and ${upcoming.length - MAX_PLAYLIST_LINES} more.` : '';
    await this.send([current, ...lines].join('\n') + extra);
    return { handled: true, action: 'PLAYLIST', length: Number(queue.length) || 0 };
  }
}

module.exports = {
  DEFAULT_SENDER_COOLDOWN_MS,
  MAX_COOLDOWN_ENTRIES,
  MusicCommandDispatcher,
  messageDetails,
  parseToggle,
};
