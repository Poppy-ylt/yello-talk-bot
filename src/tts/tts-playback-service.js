'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { DEFAULT_SPEECH_VOICE, MAX_SPEECH_TEXT_LENGTH, validateVoice } = require('./azure-speech-client');

const DEFAULT_TTS_EFFECT_ID = 9001;
const DEFAULT_MAX_TTS_QUEUE_ITEMS = 30;
const DEFAULT_DUCK_RATIO = 0.3;
const MAX_DEDUP_ENTRIES = 500;
const DEDUP_WINDOW_MS = 15000;
const MAX_EFFECT_DURATION_MS = 120000;

function messageText(data = {}) {
  const raw = typeof data.message === 'string' ? data.message : data.text;
  return typeof raw === 'string' ? raw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ' ').trim() : '';
}

function assertSuccess(response, message) {
  if (response?.ok === false || response?.success === false) throw new Error(message);
}

class TtsPlaybackService {
  constructor({
    speech,
    adapter,
    playback,
    getSettings = () => ({}),
    getOwnUuid = () => '',
    audioDirectory = path.resolve('./music-cache'),
    fsImpl = fs,
    createId = randomUUID,
    now = Date.now,
    setTimeoutImpl = setTimeout,
    clearTimeoutImpl = clearTimeout,
    maxQueueItems = DEFAULT_MAX_TTS_QUEUE_ITEMS,
    effectId = DEFAULT_TTS_EFFECT_ID,
  } = {}) {
    if (!adapter || typeof adapter.playEffect !== 'function' || typeof adapter.stopEffect !== 'function'
      || !playback || typeof playback.setDucking !== 'function') {
      throw new TypeError('A speech-capable audio adapter and music playback service are required');
    }
    this.speech = speech || null;
    this.adapter = adapter;
    this.playback = playback;
    this.getSettings = getSettings;
    this.getOwnUuid = getOwnUuid;
    this.audioDirectory = path.resolve(audioDirectory);
    if (this.audioDirectory.toLowerCase() === path.parse(this.audioDirectory).root.toLowerCase()) {
      throw new Error('A dedicated speech cache directory is required');
    }
    this.fs = fsImpl;
    this.createId = createId;
    this.now = now;
    this.setTimeout = setTimeoutImpl;
    this.clearTimeout = clearTimeoutImpl;
    this.maxQueueItems = Math.max(1, Math.min(100, Math.trunc(Number(maxQueueItems)) || DEFAULT_MAX_TTS_QUEUE_ITEMS));
    this.effectId = Number(effectId);
    this.queue = [];
    this.recentMessages = new Map();
    this.draining = false;
    this.drainPromise = null;
    this.activeController = null;
    this.activeFile = null;
    this.activeEffect = false;
    this.waiting = null;
    this.status = 'idle';
    this.lastError = null;
  }

  snapshot() {
    return { status: this.status, queued: this.queue.length, error: this.lastError };
  }

  isConfigured() {
    return Boolean(this.speech);
  }

  remember(key) {
    const now = this.now();
    for (const [candidate, timestamp] of this.recentMessages) {
      if (now - timestamp > DEDUP_WINDOW_MS) this.recentMessages.delete(candidate);
    }
    if (this.recentMessages.has(key)) return false;
    if (this.recentMessages.size >= MAX_DEDUP_ENTRIES) {
      const oldest = this.recentMessages.keys().next().value;
      if (oldest != null) this.recentMessages.delete(oldest);
    }
    this.recentMessages.set(key, now);
    return true;
  }

  handleMessage(data) {
    const settings = this.getSettings() || {};
    if (settings.ttsEnabled !== true || !this.speech) return false;
    const text = messageText(data);
    if (!text || text.startsWith('.') || text.length > MAX_SPEECH_TEXT_LENGTH) return false;
    const senderId = String(data?.uuid || data?.user_uuid || data?.sender?.uuid || '').trim().slice(0, 128);
    if (senderId && senderId === String(this.getOwnUuid() || '')) return false;
    const eventId = String(data?.message_id || data?.id || '').trim().slice(0, 128);
    const key = eventId ? `id:${eventId}` : `${senderId}:${text}`;
    if (!this.remember(key) || this.queue.length >= this.maxQueueItems) return false;
    this.queue.push({ text, senderId });
    void this.drainQueue();
    return true;
  }

  speakReply(text) {
    const settings = this.getSettings() || {};
    const message = messageText({ message: text });
    if (settings.ttsEnabled !== true || !settings.aiReplyTtsEnabled || !this.speech
      || !message || message.length > MAX_SPEECH_TEXT_LENGTH || this.queue.length >= this.maxQueueItems) return false;
    this.queue.push({ text: message, senderId: 'ai-reply' });
    void this.drainQueue();
    return true;
  }

  async applySettings(patch = {}) {
    if (patch.ttsEnabled === false) await this.stopAll();
    if (Object.hasOwn(patch, 'ttsVolume') && this.activeEffect && typeof this.adapter.setEffectVolume === 'function') {
      await this.adapter.setEffectVolume(this.effectId, patch.ttsVolume);
    }
  }

  async drainQueue() {
    if (this.drainPromise) return this.drainPromise;
    this.draining = true;
    const operation = this.drainQueueItems();
    this.drainPromise = operation;
    try { await operation; }
    finally {
      this.status = this.lastError ? 'error' : 'idle';
      this.draining = false;
      if (this.drainPromise === operation) this.drainPromise = null;
      if (this.queue.length > 0 && this.getSettings()?.ttsEnabled === true) void this.drainQueue();
    }
  }

  async drainQueueItems() {
    try {
      while (this.queue.length > 0) {
        if (this.getSettings()?.ttsEnabled !== true || !this.speech) {
          this.queue.length = 0;
          break;
        }
        const item = this.queue.shift();
        try { await this.playMessage(item.text); }
        catch { this.lastError = 'A chat message could not be read aloud'; }
      }
    } catch { this.lastError = 'A chat message could not be read aloud'; }
  }

  async playMessage(text) {
    const settings = this.getSettings() || {};
    const controller = new AbortController();
    this.activeController = controller;
    this.status = 'checking';
    this.lastError = null;
    let ducked = false;
    let file = null;
    try {
      if (!this.speech || settings.ttsEnabled !== true) return false;
      if (typeof this.adapter.assertTtsCapabilities !== 'function') throw new Error('Speech effects are unavailable');
      await this.adapter.assertTtsCapabilities();
      if (controller.signal.aborted || this.getSettings()?.ttsEnabled !== true) return false;
      const voice = validateVoice(settings.ttsVoice || DEFAULT_SPEECH_VOICE);
      if (!voice) throw new Error('Configured speech voice is invalid');
      this.status = 'synthesizing';
      const result = await this.speech.synthesize({
        text,
        voice,
        speed: settings.ttsSpeed ?? 1,
        pitch: settings.ttsPitch ?? 0,
        volume: 100,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return false;
      const audio = Buffer.from(result?.audio || []);
      if (!audio.length || !Number.isFinite(result?.durationMs) || result.durationMs <= 0) throw new Error('Speech provider returned no playable audio');
      this.fs.mkdirSync(this.audioDirectory, { recursive: true });
      const fileName = `.ymb-tts-${this.createId()}.wav`;
      file = path.join(this.audioDirectory, fileName);
      await this.fs.promises.writeFile(file, audio, { mode: 0o600, flag: 'wx' });
      this.activeFile = file;
      if (controller.signal.aborted || this.getSettings()?.ttsEnabled !== true) return false;
      ducked = true;
      await this.playback.setDucking(DEFAULT_DUCK_RATIO);
      const currentSettings = this.getSettings() || {};
      if (controller.signal.aborted || currentSettings.ttsEnabled !== true) return false;
      assertSuccess(await this.adapter.playEffect({
        file,
        effectId: this.effectId,
        volume: currentSettings.ttsVolume ?? 80,
        send: true,
      }), 'Speech audio could not be started');
      this.activeEffect = true;
      this.status = 'speaking';
      if (controller.signal.aborted) {
        await this.adapter.stopEffect(this.effectId).catch(() => {});
        return false;
      }
      await this.waitForEffect(result.durationMs, controller.signal);
      return true;
    } finally {
      if (this.activeEffect) await this.adapter.stopEffect(this.effectId).catch(() => {});
      this.activeEffect = false;
      if (ducked) await this.playback.setDucking(1).catch(() => {});
      if (file) await this.removeOwnedFile(file);
      this.activeFile = null;
      if (this.activeController === controller) this.activeController = null;
    }
  }

  waitForEffect(durationMs, signal) {
    return new Promise(resolve => {
      const finish = () => {
        if (!this.waiting) return;
        this.clearTimeout(this.waiting.timer);
        signal.removeEventListener('abort', finish);
        const complete = this.waiting.resolve;
        this.waiting = null;
        complete();
      };
      const timer = this.setTimeout(finish, Math.max(100, Math.min(MAX_EFFECT_DURATION_MS, Math.ceil(durationMs) + 250)));
      this.waiting = { timer, resolve, finish };
      signal.addEventListener('abort', finish, { once: true });
    });
  }

  async removeOwnedFile(file) {
    const resolved = path.resolve(file);
    if (path.dirname(resolved) !== this.audioDirectory || !path.basename(resolved).startsWith('.ymb-tts-')) return false;
    try { await this.fs.promises.unlink(resolved); return true; }
    catch (error) { if (error?.code === 'ENOENT') return false; throw error; }
  }

  async stopAll() {
    this.queue.length = 0;
    const running = this.drainPromise;
    this.activeController?.abort();
    if (this.waiting) this.waiting.finish();
    if (this.activeEffect) await this.adapter.stopEffect(this.effectId).catch(() => {});
    if (running) await running.catch(() => {});
    if (this.activeFile) await this.removeOwnedFile(this.activeFile).catch(() => {});
    this.activeEffect = false;
  }
}

module.exports = {
  DEFAULT_DUCK_RATIO,
  DEFAULT_MAX_TTS_QUEUE_ITEMS,
  DEFAULT_TTS_EFFECT_ID,
  MAX_EFFECT_DURATION_MS,
  TtsPlaybackService,
  messageText,
};
