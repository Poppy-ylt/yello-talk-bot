'use strict';

const express = require('express');
const { normalizeConfig, publicConfigSummary } = require('../config/public-config');

function createSettingsRouter({
  ownerAuth,
  getConfig,
  saveConfig,
  speechClient,
  ttsPlayback,
  gmeAdapter,
  playback,
  validateVoice,
  normalizeOrigin,
  originIsAllowed,
  logger = console,
} = {}) {
  const router = express.Router();

  router.get('/api/config', ownerAuth, (_req, res) => res.json(publicConfigSummary(getConfig())));

  router.put('/api/config', ownerAuth, async (req, res) => {
    const current = getConfig();
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({ error: 'Expected a config object' });
    }
    if (['account', 'adapter', 'groq', 'azureTts'].some(section => Object.hasOwn(req.body, section))) {
      return res.status(400).json({ error: 'Credentials, adapter connection, and bot identity must be changed directly in config.local.json on this machine' });
    }
    const settingsPatch = req.body.settings && typeof req.body.settings === 'object' && !Array.isArray(req.body.settings)
      ? req.body.settings
      : {};
    for (const key of ['greetingMessage', 'farewellMessage']) {
      if (Object.hasOwn(settingsPatch, key)
        && (typeof settingsPatch[key] !== 'string'
          || settingsPatch[key].length > 180
          || /[\u0000-\u001F\u007F]/.test(settingsPatch[key]))) {
        return res.status(400).json({ error: 'Greeting and farewell messages must be single-line text of at most 180 characters' });
      }
    }
    const next = {
      ...current,
      ...req.body,
      settings: { ...current.settings, ...(req.body.settings || {}) },
    };
    const normalized = normalizeConfig(next);
    if (normalized.settings.volume < 0 || normalized.settings.volume > 100
      || normalized.settings.ttsVolume < 0 || normalized.settings.ttsVolume > 100
      || normalized.settings.maxTrackDurationSeconds < 60 || normalized.settings.maxTrackDurationSeconds > 86400
      || normalized.settings.ttsSpeed < 0.5 || normalized.settings.ttsSpeed > 1.5
      || normalized.settings.ttsPitch < -50 || normalized.settings.ttsPitch > 50
      || (normalized.settings.ttsVoice && !validateVoice(normalized.settings.ttsVoice))
      || !['m4a', 'hq', 'mp3'].includes(normalized.settings.musicFormat)
      || !['fluency', 'standard', 'hq'].includes(normalized.settings.roomQuality)) {
      return res.status(400).json({ error: 'One or more settings are outside the supported range' });
    }
    if (normalized.settings.ttsEnabled && !current.settings.ttsEnabled) {
      if (!speechClient) return res.status(409).json({ error: 'Configure Azure TTS credentials locally before enabling speech' });
      if (!ttsPlayback || typeof gmeAdapter?.assertTtsCapabilities !== 'function') {
        return res.status(409).json({ error: 'The audio adapter cannot play speech effects separately from music' });
      }
      try { await gmeAdapter.assertTtsCapabilities(); }
      catch { return res.status(409).json({ error: 'The audio adapter cannot play speech effects separately from music' }); }
    }
    for (const origin of normalized.portalAllowedOrigins) {
      if (!normalizeOrigin(origin) || !originIsAllowed(origin, [origin])) {
        return res.status(400).json({ error: 'Portal origins must be valid HTTP(S) origins' });
      }
    }
    try {
      const changedSettings = Object.fromEntries(Object.entries(normalized.settings)
        .filter(([key, value]) => JSON.stringify(current.settings[key]) !== JSON.stringify(value)));
      const saved = saveConfig(normalized);
      playback.setRepeat(saved.settings.repeat);
      playback.setLoop(saved.settings.loop);
      await ttsPlayback?.applySettings(changedSettings);
      let warning;
      if (playback.snapshot().attached && gmeAdapter) {
        try {
          if (current.settings.volume !== saved.settings.volume) await playback.setVolume(saved.settings.volume);
          if (current.settings.roomQuality !== saved.settings.roomQuality) await playback.setRoomQuality(saved.settings.roomQuality);
        } catch {
          warning = 'Settings were saved, but one or more values could not be applied to the active audio adapter';
        }
      }
      return res.json({ ...publicConfigSummary(saved), ...(warning ? { warning } : {}) });
    } catch {
      logger.error?.('Could not save local configuration');
      return res.status(500).json({ error: 'Could not save local configuration' });
    }
  });

  return router;
}

module.exports = { createSettingsRouter };
