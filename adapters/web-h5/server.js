#!/usr/bin/env node
/**
 * GME Web Bot Server
 *
 * HTTP server that controls a headless Chromium via Puppeteer,
 * running the GME H5 SDK to join voice rooms and play music.
 *
 * Same HTTP API as the C++ gme-music-bot binary so bot-server.js
 * can use it as a drop-in replacement.
 *
 * Usage: node server.js --port 9876 --bot-id test-1
 */

'use strict';

const express = require('express');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const { generateAuthBuffer, GME_SDK_APP_ID } = require('./auth');
const { createAdapterAuthMiddleware } = require('../../src/music/adapter-security');

// ---------- CLI args ----------

const args = process.argv.slice(2);
function getArg(name, defaultVal) {
  const idx = args.indexOf(name);
  if (idx === -1 || idx + 1 >= args.length) return defaultVal;
  return args[idx + 1];
}

const PORT = parseInt(getArg('--port', '9876'), 10);
const BOT_ID = getArg('--bot-id', 'web-bot-1');
const ADAPTER_TOKEN = String(process.env.GME_ADAPTER_TOKEN || '').trim();
const ADAPTER_AUTH_REQUIRED = process.env.GME_ADAPTER_AUTH_REQUIRED !== 'false';

// ---------- State ----------

let browser = null;
let page = null;
let state = {
  status: 'idle',      // idle, joining, joined, playing, paused, leaving
  room: null,
  user: null,
  uuid: null,
  currentFile: null,
  loop: false,
  volume: 100,
  error: null,
};

let songPollInterval = null;

// Browser-readiness gate. The HTTP server starts listening before Puppeteer
// finishes launching, so bot-server's /status poll can pass and call /join while
// `page` is still null. Gate every page.evaluate() behind this.
let browserReady = false;
let _browserReadyResolve = null;
const browserReadyPromise = new Promise((resolve) => { _browserReadyResolve = resolve; });

async function ensureBrowserReady(timeoutMs = 25000) {
  if (browserReady && page) return;
  let timer;
  try {
    await Promise.race([
      browserReadyPromise,
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('browser not ready (timeout)')), timeoutMs); }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

// ---------- Puppeteer setup ----------

async function launchBrowser() {
  console.log(`[${BOT_ID}] Launching headless Chromium...`);

  browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      '--autoplay-policy=no-user-gesture-required',
      '--disable-web-security',
      '--allow-file-access-from-files',
      '--disable-features=IsolateOrigins,site-per-process',
    ],
  });

  page = await browser.newPage();

  // Log ALL browser console to stdout (verbose — surfaces GME/TRTC internals)
  page.on('console', msg => {
    console.log(`[${BOT_ID}:chrome:${msg.type()}] ${msg.text()}`);
  });

  page.on('pageerror', err => {
    console.error(`[${BOT_ID}:chrome] PAGE ERROR: ${err.message}`);
  });

  // Load the GME page
  const pagePath = path.join(__dirname, 'gme-page.html');
  // Serve via express static so SDK relative path works
  console.log(`[${BOT_ID}] Loading GME page...`);
  await page.goto(`http://localhost:${PORT}/gme-page.html`, {
    waitUntil: 'networkidle0',
    timeout: 30000,
  });

  // Check SDK loaded
  const sdkLoaded = await page.evaluate(() => window.__sdkLoaded);
  if (sdkLoaded) {
    console.log(`[${BOT_ID}] GME H5 SDK loaded successfully`);
  } else {
    console.warn(`[${BOT_ID}] WARNING: GME H5 SDK failed to load — check sdk/WebRTCService.min.js`);
  }

  browserReady = true;
  if (_browserReadyResolve) _browserReadyResolve();
  console.log(`[${BOT_ID}] Browser ready`);
}

// ---------- Song-ended polling ----------

function startSongPoll() {
  if (songPollInterval) return;
  songPollInterval = setInterval(async () => {
    try {
      const result = await page.evaluate(() => window.getPlaybackState());
      if (result.songFinished && state.status === 'playing') {
        console.log(`[${BOT_ID}] Song finished: ${state.currentFile}`);
        state.status = 'joined';
        state.currentFile = null;

      }
    } catch (e) {
      // Page might be navigating
    }
  }, 200);
}

function stopSongPoll() {
  if (songPollInterval) {
    clearInterval(songPollInterval);
    songPollInterval = null;
  }
}

// ---------- Express HTTP API ----------

const app = express();
// The GME page and SDK assets are only consumed by the local Chromium process;
// control/status endpoints still require the per-process token from
// bot-server. The server itself also binds to loopback below.
app.use(createAdapterAuthMiddleware(ADAPTER_TOKEN, {
  required: ADAPTER_AUTH_REQUIRED,
  publicPaths: ['/gme-page.html', /^\/sdk\//],
}));
app.use(express.json({ limit: '50mb' }));

// Serve static files (gme-page.html, sdk/)
app.use(express.static(__dirname));

// GET /status
app.get('/status', (req, res) => {
  // Report "not ready" (503) until the browser/page is fully initialized so that
  // bot-server's waitForGmeReady keeps polling instead of calling /join too early.
  if (!browserReady) {
    return res.status(503).json({ botId: BOT_ID, status: 'starting', ready: false });
  }
  res.json({
    botId: BOT_ID,
    adapter: 'web-h5',
    protocolVersion: 2,
    status: state.status,
    playing: state.status === 'playing',
    inRoom: !!state.room,
    ready: true,
    room: state.room,
    user: state.user,
    currentFile: state.currentFile,
    loop: state.loop,
    volume: state.volume,
    error: state.error,
  });
});

// Capability handshake used by bot-server before it exposes adapter controls.
app.get('/capabilities', (req, res) => {
  res.json({
    botId: BOT_ID,
    adapter: 'web-h5',
    protocolVersion: 2,
    sdkVersion: 'h5',
    authenticated: ADAPTER_AUTH_REQUIRED ? !!ADAPTER_TOKEN : true,
    features: {
      status: true,
      health: true,
      playMusic: true,
      effects: false,
      roomQuality: false,
    },
    endpoints: ['/status', '/health', '/capabilities', '/join', '/play', '/stop', '/pause', '/resume', '/volume', '/leave'],
    notes: ['The H5 adapter intentionally exposes a smaller feature set than native GME.'],
  });
});

app.get('/health', (req, res) => {
  const now = Date.now();
  res.json({
    botId: BOT_ID,
    adapter: 'web-h5',
    state: !browserReady ? 'starting' : state.room ? 'ready' : 'idle',
    reachable: true,
    ready: browserReady,
    inRoom: !!state.room,
    playing: state.status === 'playing',
    room: state.room,
    audioEnabled: state.status === 'playing' || !!state.room,
    audioEvidence: 'unknown',
    lastAudioAtMs: null,
    audioSilenceMs: null,
    audioEmpty: null,
    reconnecting: false,
    lastError: state.error,
    observedAtMs: now,
  });
});

// POST /join { room, user, uuid }
app.post('/join', async (req, res) => {
  try {
    await ensureBrowserReady();
    const { room, user, uuid } = req.body;
    if (!room || !user) {
      return res.status(400).json({ error: 'room and user required' });
    }

    // Dedup: if we're already in (or joining) this exact room, don't re-init the
    // SDK — a concurrent second join tears down the first mid-handshake and
    // triggers "Promise was collected".
    if ((state.status === 'joining' || state.status === 'joined') && String(state.room) === String(room)) {
      console.log(`[${BOT_ID}] Already ${state.status} room ${room} — skipping duplicate join`);
      return res.json({ ok: true, status: state.status, room, user, note: 'already ' + state.status });
    }

    console.log(`[${BOT_ID}] Joining room ${room} as user ${user}`);
    state.status = 'joining';
    state.room = room;
    state.user = user;
    state.uuid = uuid || '';
    state.error = null;

    // GME auth identity — prefer the UUID (matches the native GenAuthBuffer identity).
    // openId and authBuffer must be for the SAME identity.
    const identity = (uuid && String(uuid).length) ? String(uuid) : String(user);
    const authBuffer = generateAuthBuffer(identity, room);
    console.log(`[${BOT_ID}] Auth buffer generated for identity=${identity}, room=${room} (${authBuffer.length} chars base64)`);

    // Init GME SDK
    await page.evaluate(async (appId, openId) => {
      await window.gmeInit(appId, openId);
    }, GME_SDK_APP_ID, identity);

    // Enter room
    await page.evaluate(async (roomId, auth, listenOnly) => {
      await window.gmeEnterRoom(roomId, auth, listenOnly);
    }, room, authBuffer, true);

    state.status = 'joined';
    startSongPoll();

    console.log(`[${BOT_ID}] Joined room ${room}`);
    res.json({ ok: true, status: 'joined', room, user });
  } catch (e) {
    console.error(`[${BOT_ID}] Join error: ${e.message}`);
    state.status = 'error';
    state.error = e.message;
    res.status(500).json({ error: e.message });
  }
});

// POST /play { file, loop }
app.post('/play', async (req, res) => {
  try {
    await ensureBrowserReady();
    const { file, loop } = req.body;
    if (!file) {
      return res.status(400).json({ error: 'file required' });
    }

    if (state.status !== 'joined' && state.status !== 'playing' && state.status !== 'paused') {
      return res.status(400).json({ error: `Cannot play in state: ${state.status}` });
    }

    console.log(`[${BOT_ID}] Playing: ${file} (loop: ${!!loop})`);

    // Read file from filesystem
    const filePath = path.resolve(file);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: `File not found: ${filePath}` });
    }

    const fileData = fs.readFileSync(filePath);
    const base64Data = fileData.toString('base64');

    // Send to page for decoding and playback
    const result = await page.evaluate(async (data, loopFlag) => {
      return await window.playAudio(data, loopFlag);
    }, base64Data, !!loop);

    state.status = 'playing';
    state.currentFile = file;
    state.loop = !!loop;

    console.log(`[${BOT_ID}] Playback started (duration: ${result.duration?.toFixed(1)}s)`);
    res.json({ ok: true, status: 'playing', file, duration: result.duration });
  } catch (e) {
    console.error(`[${BOT_ID}] Play error: ${e.message}`);
    res.status(500).json({ error: e.message });
  }
});

// POST /stop
app.post('/stop', async (req, res) => {
  try {
    await ensureBrowserReady();
    await page.evaluate(() => window.stopAudio());
    state.status = state.room ? 'joined' : 'idle';
    state.currentFile = null;
    state.loop = false;
    console.log(`[${BOT_ID}] Playback stopped`);
    res.json({ ok: true, status: state.status });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /pause
app.post('/pause', async (req, res) => {
  try {
    await ensureBrowserReady();
    const result = await page.evaluate(() => window.pauseAudio());
    if (result.ok) {
      state.status = 'paused';
      console.log(`[${BOT_ID}] Playback paused`);
    }
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /resume
app.post('/resume', async (req, res) => {
  try {
    await ensureBrowserReady();
    const result = await page.evaluate(() => window.resumeAudio());
    if (result.ok) {
      state.status = 'playing';
      console.log(`[${BOT_ID}] Playback resumed`);
    }
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /volume { vol }
app.post('/volume', async (req, res) => {
  try {
    await ensureBrowserReady();
    const rawVolume = Number(req.body?.vol);
    if (!Number.isFinite(rawVolume) || rawVolume < 0 || rawVolume > 100) {
      return res.status(400).json({ error: 'vol must be between 0 and 100' });
    }
    const vol = Math.round(rawVolume);
    const result = await page.evaluate((v) => window.setVolume(v), vol);
    state.volume = vol;
    console.log(`[${BOT_ID}] Volume set to ${vol}`);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /leave
app.post('/leave', async (req, res) => {
  try {
    console.log(`[${BOT_ID}] Leaving room...`);
    await ensureBrowserReady();
    stopSongPoll();

    // Stop audio first
    await page.evaluate(() => window.stopAudio());

    // Exit GME room
    await page.evaluate(async () => await window.gmeExitRoom());

    state.status = 'idle';
    state.room = null;
    state.user = null;
    state.uuid = null;
    state.currentFile = null;
    state.loop = false;
    state.error = null;

    console.log(`[${BOT_ID}] Left room`);
    res.json({ ok: true, status: 'idle' });
  } catch (e) {
    console.error(`[${BOT_ID}] Leave error: ${e.message}`);
    // Reset state anyway
    state.status = 'idle';
    state.room = null;
    res.json({ ok: true, status: 'idle', warn: e.message });
  }
});

// ---------- Startup ----------

const httpServer = app.listen(PORT, '127.0.0.1', async () => {
  console.log(`[${BOT_ID}] HTTP server listening on port ${PORT}`);

  try {
    await launchBrowser();
    console.log(`[${BOT_ID}] Ready — waiting for commands`);
  } catch (e) {
    console.error(`[${BOT_ID}] Failed to launch browser: ${e.message}`);
    process.exit(1);
  }
});

// ---------- Graceful shutdown ----------

async function shutdown() {
  console.log(`[${BOT_ID}] Shutting down...`);
  stopSongPoll();

  try {
    if (page && state.room) {
      await page.evaluate(async () => {
        window.stopAudio();
        await window.gmeExitRoom();
      }).catch(() => {});
    }
  } catch (e) {}

  try {
    if (browser) await browser.close();
  } catch (e) {}

  httpServer.close();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
