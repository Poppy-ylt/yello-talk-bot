#!/usr/bin/env node
'use strict';
/**
 * GME Redroid Bot adapter.
 *
 * Drop-in replacement for gme-web-bot/server.js (same HTTP API as the native
 * C++ bot), but instead of Puppeteer it drives the native GME Android SDK
 * running inside a Redroid (Android-in-Docker) container:
 *
 *   bot-server  ──HTTP──▶  this adapter (:PORT)
 *                             ├─ adb push <mp3> into the container
 *                             └─HTTP──▶ Android app (:9099 via adb forward) ──▶ GME native SDK ──▶ room
 *
 * The native Android platform is enabled for the GME app, so this path does not
 * hit the "sdkAppId invalid" wall the web/H5 SDK does.
 *
 * Usage: node server.js --port 9876 --bot-id <id>
 * Env:   REDROID_SERIAL (default localhost:5555), REDROID_APP_PORT (host port forwarded to the app, default 9877)
 */

const http = require('http');
const url = require('url');
const fs = require('fs');
const { execFile } = require('child_process');
const { isAdapterRequestAuthorized } = require('../../src/music/adapter-security');

const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 && i + 1 < args.length ? args[i + 1] : d; };

const PORT = parseInt(arg('--port', '9876'), 10);
const BOT_ID = arg('--bot-id', 'redroid-1');
const SERIAL = process.env.REDROID_SERIAL || 'localhost:5555';
// Multi-instance: each bot drives its OWN app copy (com.gmebot.botN) so N bots
// can sit in different rooms playing different songs at once. bot-server passes
// the instance index (REDROID_APP_INDEX); fall back to deriving it from PORT.
const INSTANCE = parseInt(process.env.REDROID_APP_INDEX || String(Math.max(0, PORT - 9876)), 10);
const APP_PKG = process.env.REDROID_APP_PKG || `com.gmebot.bot${INSTANCE}`;
const APP_ACTIVITY = `${APP_PKG}/com.gmebot.test.MainActivity`;
// Host port for `adb forward` -> app. MUST NOT collide with this adapter's own
// bot-server-facing PORT (bot-server allocates 9876, 9877, ...). Derive it as
// PORT+10000 so they can never clash.
const APP_HOST_PORT = parseInt(process.env.REDROID_APP_PORT || String(PORT + 10000), 10);
// Each app copy binds its own device port (9099+index) and reads its own mp3.
const APP_DEVICE_PORT = parseInt(process.env.REDROID_APP_DEVICE_PORT || String(9099 + INSTANCE), 10);
const APP = `http://127.0.0.1:${APP_HOST_PORT}`;
const DEVICE_MP3 = `/data/local/tmp/gmesong${INSTANCE}.mp3`;
const ADAPTER_TOKEN = String(process.env.GME_ADAPTER_TOKEN || '').trim();
const ADAPTER_AUTH_REQUIRED = process.env.GME_ADAPTER_AUTH_REQUIRED !== 'false';

function log(m) { console.log(`[${BOT_ID}] ${m}`); }

function adb(argv, timeout = 20000) {
  return new Promise((resolve) => {
    execFile('adb', ['-s', SERIAL].concat(argv), { timeout }, (e, so, se) => resolve({ e, so, se }));
  });
}

// JSON HTTP call to the Android app (through the adb-forwarded port)
function appCall(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(APP + path, {
      method,
      headers: data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {},
    }, (r) => {
      let b = ''; r.on('data', c => b += c); r.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch (e) { resolve({ raw: b }); } });
    });
    req.on('error', reject);
    req.setTimeout(28000, () => req.destroy(new Error('app request timeout')));
    if (data) req.write(data);
    req.end();
  });
}

// Make sure the container is reachable, the app is running, and the port is
// forwarded. `fresh` force-restarts the app so it never carries a stale room.
async function ensureApp(fresh) {
  await new Promise(r => execFile('adb', ['connect', SERIAL], () => r()));
  await adb(['forward', `tcp:${APP_HOST_PORT}`, `tcp:${APP_DEVICE_PORT}`]);
  if (fresh) { await adb(['shell', 'am', 'force-stop', APP_PKG]); await new Promise(r => setTimeout(r, 500)); }
  await adb(['shell', 'am', 'start', '-n', APP_ACTIVITY]);
  // wait for the in-app HTTP control server to respond
  for (let i = 0; i < 30; i++) {
    try { await appCall('GET', '/status'); return; } catch (e) { await new Promise(r => setTimeout(r, 400)); }
  }
}

let state = { currentFile: null, loop: false };
// Per-bot music volume (GME native scale 0-200, default 25). The Android app
// resets its own volume field to 100 whenever it force-restarts on /join, so we
// re-assert this after every /play — otherwise each fresh song plays loud.
let lastVol = 25;
let songPoll = null;

function startSongPoll() {
  if (songPoll) return;
  songPoll = setInterval(async () => {
    try {
      const s = await appCall('GET', '/status');
      if (s && s.songFinished && state.currentFile) {
        const f = state.currentFile; state.currentFile = null;
        log(`song finished: ${f}`);
      }
    } catch (e) { /* app briefly unreachable */ }
  }, 500);
}

const server = http.createServer((req, res) => {
  if (ADAPTER_AUTH_REQUIRED && !isAdapterRequestAuthorized(req, ADAPTER_TOKEN, { required: true })) {
    res.statusCode = ADAPTER_TOKEN ? 401 : 503;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('WWW-Authenticate', 'GME-Adapter');
    return res.end(JSON.stringify({ ok: false, error: ADAPTER_TOKEN ? 'Invalid GME adapter token' : 'GME adapter authentication is not configured' }));
  }
  const u = url.parse(req.url, true);
  let body = '';
  req.on('data', c => body += c);
  req.on('end', async () => {
    let j = {}; try { if (body) j = JSON.parse(body); } catch (e) {}
    res.setHeader('Content-Type', 'application/json');
    try {
      if (u.pathname === '/status') {
        let s = {}; try { s = await appCall('GET', '/status'); } catch (e) {}
        return res.end(JSON.stringify({ botId: BOT_ID, adapter: 'android-redroid', protocolVersion: 2, status: s.status || 'idle', room: s.room, user: null, currentFile: s.currentFile, loop: state.loop, volume: s.volume, roomType: s.roomType, roomQuality: s.roomQuality, inRoom: s.inRoom, songFinished: s.songFinished, error: s.error }));
      }
      if (u.pathname === '/capabilities') {
        return res.end(JSON.stringify({
          botId: BOT_ID,
          adapter: 'android-redroid',
          protocolVersion: 2,
          sdkVersion: 'android-native',
          authenticated: ADAPTER_AUTH_REQUIRED ? !!ADAPTER_TOKEN : true,
          features: {
            status: true,
            health: true,
            playMusic: true,
            effects: false,
            roomQuality: true,

          },
          endpoints: ['/status', '/health', '/capabilities', '/join', '/play', '/stop', '/pause', '/resume', '/volume', '/room-quality', '/leave'],
          notes: ['Android SDK control is reached through the local adb-forwarded app.'],
        }));
      }
      if (u.pathname === '/health') {
        let s = {}; try { s = await appCall('GET', '/status'); } catch (e) {}
        return res.end(JSON.stringify({
          botId: BOT_ID,
          adapter: 'android-redroid',
          state: s.inRoom ? (s.status === 'playing' ? 'ready' : 'ready') : 'idle',
          reachable: true,
          ready: true,
          inRoom: !!s.inRoom,
          playing: s.status === 'playing',
          room: s.room || null,
          audioEnabled: !!s.inRoom,
          audioEvidence: 'unknown',
          lastAudioAtMs: null,
          audioSilenceMs: null,
          audioEmpty: null,
          reconnecting: false,
          lastError: s.error || null,
          observedAtMs: Date.now(),
        }));
      }
      if (u.pathname === '/join' && req.method === 'POST') {
        const { room, user, uuid } = j;
        if (!room || !user) return res.end(JSON.stringify({ error: 'room and user required' }));
        await ensureApp(true);
        log(`join room=${room} user=${user}`);
        // GME's auth identifier MUST equal the Init openId (= user). bot-server
        // sometimes passes the YelloTalk uuid (a GUID) which is NOT a valid GME
        // identifier and makes EnterRoom fail auth. Always auth as `user`.
        const r = await appCall('POST', '/join', { room: String(room), user: String(user), uuid: String(user) });
        if (r.inRoom) startSongPoll();
        return res.end(JSON.stringify({ ok: !!r.inRoom, inRoom: !!r.inRoom, status: r.status, room, user, error: r.error }));
      }
      if (u.pathname === '/play' && req.method === 'POST') {
        const host = j.file;
        if (!host || !fs.existsSync(host)) return res.status ? res.end(JSON.stringify({ error: 'file not found: ' + host })) : res.end(JSON.stringify({ error: 'file not found: ' + host }));
        log(`play ${host} (loop=${!!j.loop})`);
        // Push with the file's real extension (.m4a/.mp3) so GME picks the right decoder.
        const ext = (require('path').extname(host) || '.mp3').toLowerCase();
        const devFile = `/data/local/tmp/gmesong${INSTANCE}${ext}`;
        const push = await adb(['push', host, devFile]);
        if (push.e) return res.end(JSON.stringify({ error: 'adb push failed: ' + push.e.message }));
        state.currentFile = host; state.loop = !!j.loop;
        // The app's /play does StopAccompany + StartAccompany (+retry on GME -7).
        const r = await appCall('POST', '/play', { file: devFile, loop: !!j.loop });
        // Re-assert the bot's volume (default 25) — the app's field resets to 100
        // on force-restart, so every fresh song would otherwise start loud.
        try { await appCall('POST', '/volume', { vol: lastVol }); } catch (e) {}
        log(`play -> ${APP_PKG} startRc=${r.startRc} ok=${r.ok} vol=${lastVol}`);
        return res.end(JSON.stringify({ ok: !!r.ok, status: 'playing', file: host, startRc: r.startRc }));
      }
      if (['/stop', '/pause', '/resume', '/leave'].includes(u.pathname) && req.method === 'POST') {
        if (u.pathname === '/leave') {
          state.currentFile = null;
        }
        const r = await appCall('POST', u.pathname, {});
        return res.end(JSON.stringify(r));
      }
      if (u.pathname === '/volume' && req.method === 'POST') {
        // 0 is a valid value (mute) — never `|| 100`. Clamp to GME's [0,200] range
        // and remember it so the next song keeps this level.
        const vv = parseInt(j.vol, 10);
        if (!isNaN(vv)) lastVol = Math.max(0, Math.min(200, vv));
        const r = await appCall('POST', '/volume', { vol: lastVol });
        return res.end(JSON.stringify({ ...r, vol: lastVol }));
      }
      if (u.pathname === '/room-quality' && req.method === 'POST') {
        const quality = String(j.quality || '').toLowerCase();
        if (!['fluency', 'standard', 'highquality'].includes(quality)) {
          res.statusCode = 400;
          return res.end(JSON.stringify({ success: false, error: 'quality must be fluency, standard, or highquality' }));
        }
        const r = await appCall('POST', '/room-quality', { quality });
        if (r && r.success === false) res.statusCode = 409;
        return res.end(JSON.stringify(r));
      }
      res.statusCode = 404; res.end(JSON.stringify({ error: 'unknown endpoint' }));
    } catch (e) {
      res.statusCode = 500; res.end(JSON.stringify({ error: e.message }));
    }
  });
});

server.on('error', (e) => { log('HTTP server error: ' + e.message); });

ensureApp()
  .then(() => server.listen(PORT, '127.0.0.1', () => log(`redroid adapter listening on ${PORT} -> ${APP_PKG} (adb :${APP_HOST_PORT} -> :${APP_DEVICE_PORT})`)))
  .catch((e) => { log('ensureApp failed: ' + e.message); server.listen(PORT, '127.0.0.1', () => log(`redroid adapter listening on ${PORT} (app not ready yet)`)); });

process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
