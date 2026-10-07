'use strict';

const express = require('express');

function createMusicRouter({ ownerAuth, playback, getConfig, saveConfig } = {}) {
  const router = express.Router();

  router.get('/api/music/queue', ownerAuth, (_req, res) => res.json(playback.snapshot()));

  router.post('/api/music/request', ownerAuth, async (req, res) => {
    const query = String(req.body?.query || '').trim();
    if (!query || query.length > 500) return res.status(400).json({ error: 'Enter a music request up to 500 characters' });
    try {
      const result = await playback.request(query, { requestedBy: getConfig().account.displayName });
      return res.json(result);
    } catch (error) {
      const status = error?.code === 'AUDIO_ADAPTER_UNAVAILABLE' ? 409 : error?.code === 'QUEUE_LIMIT' ? 409 : 400;
      return res.status(status).json({ error: String(error?.message || 'Could not add this music request').slice(0, 240) });
    }
  });

  router.post('/api/music/skip', ownerAuth, async (_req, res) => {
    try { return res.json({ skipped: await playback.skip() }); }
    catch (error) { return res.status(error?.code === 'AUDIO_ADAPTER_UNAVAILABLE' ? 409 : 502).json({ error: String(error?.message || 'Could not skip this track').slice(0, 240) }); }
  });

  router.post('/api/music/pause', ownerAuth, async (_req, res) => {
    try { return res.json({ paused: await playback.pause() }); }
    catch (error) { return res.status(502).json({ error: String(error?.message || 'Could not pause playback').slice(0, 240) }); }
  });

  router.post('/api/music/resume', ownerAuth, async (_req, res) => {
    try { return res.json({ resumed: await playback.resume() }); }
    catch (error) { return res.status(502).json({ error: String(error?.message || 'Could not resume playback').slice(0, 240) }); }
  });

  router.post('/api/music/stop', ownerAuth, async (_req, res) => {
    try { await playback.stop(); return res.json({ stopped: true, queue: playback.snapshot().queue }); }
    catch { return res.status(502).json({ error: 'Could not stop playback cleanly' }); }
  });

  router.post('/api/music/volume', ownerAuth, async (req, res) => {
    try {
      const volume = await playback.setVolume(req.body?.volume);
      saveConfig({ ...getConfig(), settings: { ...getConfig().settings, volume } });
      return res.json({ volume });
    } catch (error) {
      const status = error?.code === 'INVALID_VOLUME' ? 400 : error?.code === 'AUDIO_ADAPTER_UNAVAILABLE' ? 409 : 502;
      return res.status(status).json({ error: String(error?.message || 'Could not change music volume').slice(0, 240) });
    }
  });

  router.post('/api/music/quality', ownerAuth, async (req, res) => {
    const quality = String(req.body?.quality || '');
    if (!['fluency', 'standard', 'hq'].includes(quality)) return res.status(400).json({ error: 'Unsupported room audio quality' });
    try {
      await playback.setRoomQuality(quality);
      saveConfig({ ...getConfig(), settings: { ...getConfig().settings, roomQuality: quality } });
      return res.json({ roomQuality: quality });
    } catch (error) {
      const status = error?.code === 'AUDIO_ADAPTER_UNAVAILABLE' ? 409 : 502;
      return res.status(status).json({ error: String(error?.message || 'Could not change room audio quality').slice(0, 240) });
    }
  });

  router.post('/api/music/repeat', ownerAuth, (req, res) => {
    if (typeof req.body?.enabled !== 'boolean') return res.status(400).json({ error: 'enabled must be boolean' });
    const repeat = playback.setRepeat(req.body.enabled);
    saveConfig({ ...getConfig(), settings: { ...getConfig().settings, repeat } });
    return res.json({ repeat });
  });

  router.post('/api/music/loop', ownerAuth, (req, res) => {
    if (typeof req.body?.enabled !== 'boolean') return res.status(400).json({ error: 'enabled must be boolean' });
    const loop = playback.setLoop(req.body.enabled);
    saveConfig({ ...getConfig(), settings: { ...getConfig().settings, loop } });
    return res.json({ loop });
  });

  router.post('/api/music/queue/clear', ownerAuth, (_req, res) => res.json({ removed: playback.clearUpcoming() }));

  router.post('/api/music/queue/remove', ownerAuth, (req, res) => {
    const removed = playback.removeUpcoming(req.body?.position);
    return removed ? res.json({ removed: true, title: removed.title }) : res.status(404).json({ error: 'Queue item was not found' });
  });

  return router;
}

module.exports = { createMusicRouter };
