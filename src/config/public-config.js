'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { normalizeMusicBlockedKeywords } = require('../music/music-content-blocklist');

const DEFAULT_CONFIG = Object.freeze({
  account: Object.freeze({ jwtToken: '', userUuid: '', displayName: '', aliases: [], persona: '' }),
  adapter: Object.freeze({ type: 'native', baseUrl: 'http://127.0.0.1:9876', token: '' }),
  groq: Object.freeze({ apiKey: '', model: '' }),
  azureTts: Object.freeze({ subscriptionKey: '', region: '' }),
  portalAllowedOrigins: Object.freeze(['http://localhost:5254', 'http://127.0.0.1:5254']),
  settings: Object.freeze({
    volume: 80,
    musicFormat: 'm4a',
    roomQuality: 'standard',
    fadeDurationMs: 1500,
    autoplay: false,
    repeat: false,
    loop: false,
    maxTrackDurationSeconds: 3600,
    musicBlockedKeywords: [],
    ttsEnabled: false,
    ttsVoice: '',
    ttsSpeed: 1,
    ttsPitch: 0,
    ttsVolume: 80,
    chatRepliesEnabled: false,
    fortuneRepliesEnabled: false,
    aiReplyTtsEnabled: false,
    greetingsEnabled: false,
    greetingMessage: '',
    farewellsEnabled: false,
    farewellMessage: '',
  }),
});

function copyDefaults() {
  return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
}

function normalizeConfig(input = {}) {
  const base = copyDefaults();
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  for (const section of ['account', 'adapter', 'groq', 'azureTts']) {
    const incoming = source[section];
    if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) continue;
    for (const key of Object.keys(base[section])) {
      if (key === 'aliases') {
        if (Array.isArray(incoming[key])) base[section][key] = incoming[key].filter(value => typeof value === 'string').map(value => value.trim()).filter(Boolean).slice(0, 20);
      } else if (typeof incoming[key] === 'string') {
        base[section][key] = incoming[key].trim();
      }
    }
  }
  if (!['native', 'web', 'redroid'].includes(base.adapter.type)) base.adapter.type = 'native';
  if (Array.isArray(source.portalAllowedOrigins)) {
    base.portalAllowedOrigins = source.portalAllowedOrigins
      .filter(value => typeof value === 'string')
      .map(value => value.trim())
      .filter(Boolean)
      .slice(0, 20);
  }
  const incomingSettings = source.settings;
  if (incomingSettings && typeof incomingSettings === 'object' && !Array.isArray(incomingSettings)) {
    for (const [key, fallback] of Object.entries(base.settings)) {
      const value = incomingSettings[key];
      if (typeof fallback === 'boolean' && typeof value === 'boolean') base.settings[key] = value;
      else if (typeof fallback === 'number' && Number.isFinite(value)) base.settings[key] = value;
      else if (typeof fallback === 'string' && typeof value === 'string') {
        base.settings[key] = ['greetingMessage', 'farewellMessage'].includes(key)
          ? value.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180)
          : value.trim();
      }
      else if (key === 'musicBlockedKeywords' && Array.isArray(value)) base.settings[key] = normalizeMusicBlockedKeywords(value);
    }
  }
  base.settings.fadeDurationMs = 1500;
  base.settings.autoplay2 = undefined;
  delete base.settings.autoplay2;
  return base;
}

function ensureLocalConfig(filePath) {
  const resolvedPath = path.resolve(filePath);
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  if (!fs.existsSync(resolvedPath)) {
    fs.writeFileSync(resolvedPath, `${JSON.stringify(copyDefaults(), null, 2)}\n`, { mode: 0o600, flag: 'wx' });
  }
  let config;
  try {
    config = normalizeConfig(JSON.parse(fs.readFileSync(resolvedPath, 'utf8')));
  } catch {
    throw new Error(`Local config is not valid JSON: ${resolvedPath}`);
  }
  return { path: resolvedPath, config };
}

function saveLocalConfig(filePath, input) {
  const resolvedPath = path.resolve(filePath);
  const normalized = normalizeConfig(input);
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  fs.writeFileSync(resolvedPath, `${JSON.stringify(normalized, null, 2)}\n`, { mode: 0o600 });
  return normalized;
}

function publicConfigSummary(config) {
  return {
    account: {
      configured: Boolean(config.account.jwtToken && config.account.userUuid && config.account.displayName),
    },
    adapter: { configured: Boolean(config.adapter.token && config.adapter.baseUrl), type: config.adapter.type },
    groq: { configured: Boolean(config.groq.apiKey), model: config.groq.model },
    azureTts: { configured: Boolean(config.azureTts.subscriptionKey && config.azureTts.region), region: config.azureTts.region },
    portalAllowedOrigins: config.portalAllowedOrigins,
    settings: config.settings,
  };
}

module.exports = { DEFAULT_CONFIG, ensureLocalConfig, normalizeConfig, publicConfigSummary, saveLocalConfig };
