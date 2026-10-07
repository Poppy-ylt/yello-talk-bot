'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { ensureLocalConfig, normalizeConfig, publicConfigSummary, saveLocalConfig } = require('../src/config/public-config');

test('fresh config has no account or credentials and starts optional features disabled', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ymb-config-'));
  try {
    const { config } = ensureLocalConfig(path.join(directory, 'config.local.json'));
    assert.equal(config.account.jwtToken, '');
    assert.equal(config.groq.apiKey, '');
    assert.equal(config.azureTts.subscriptionKey, '');
    assert.equal(config.settings.ttsEnabled, false);
    assert.equal(config.settings.autoplay, false);
    assert.equal(Object.hasOwn(config.settings, 'autoplay2'), false);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('normalization preserves selected settings while pinning fade and removing legacy fields', () => {
  const config = normalizeConfig({
    account: { userUuid: 'example-id', aliases: [' Bot ', 10, ''] },
    settings: { fadeDurationMs: 7000, autoplay: true, autoplay2: true, volume: 40 },
    openai: { apiKey: 'must-not-survive' },
  });
  assert.equal(config.account.userUuid, 'example-id');
  assert.deepEqual(config.account.aliases, ['Bot']);
  assert.equal(config.settings.fadeDurationMs, 1500);
  assert.equal(config.settings.autoplay, true);
  assert.equal(Object.hasOwn(config.settings, 'autoplay2'), false);
  assert.equal(Object.hasOwn(config, 'openai'), false);
});

test('music blocklist is normalized, bounded, and de-duplicated', () => {
  const config = normalizeConfig({
    settings: { musicBlockedKeywords: ['  Banned  ', 'banned', '', 'x'.repeat(101)] },
  });
  assert.deepEqual(config.settings.musicBlockedKeywords, ['Banned']);
});

test('config summary never returns account or provider secrets', () => {
  const config = normalizeConfig({
    account: { jwtToken: 'account-secret', userUuid: 'private-id', displayName: 'Test bot' },
    groq: { apiKey: 'groq-secret', model: 'model-x' },
    azureTts: { subscriptionKey: 'tts-secret', region: 'region-x' },
  });
  const summary = publicConfigSummary(config);
  const serialized = JSON.stringify(summary);
  assert.equal(summary.account.configured, true);
  assert.deepEqual(summary.adapter, { configured: false, type: 'native' });
  assert.equal(summary.groq.configured, true);
  assert.equal(summary.azureTts.configured, true);
  assert.equal(serialized.includes('account-secret'), false);
  assert.equal(serialized.includes('private-id'), false);
  assert.equal(serialized.includes('groq-secret'), false);
  assert.equal(serialized.includes('tts-secret'), false);
});

test('local config can be updated and read back without changing fixed defaults', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ymb-save-'));
  const configPath = path.join(directory, 'config.local.json');
  try {
    ensureLocalConfig(configPath);
    const saved = saveLocalConfig(configPath, { account: { jwtToken: 'local-secret', userUuid: 'id' }, adapter: { token: 'adapter-secret', type: 'web' }, settings: { roomQuality: 'hq', fadeDurationMs: 3000 } });
    assert.equal(saved.settings.roomQuality, 'hq');
    assert.equal(saved.settings.fadeDurationMs, 1500);
    assert.equal(saved.adapter.type, 'web');
    assert.equal(ensureLocalConfig(configPath).config.account.jwtToken, 'local-secret');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
