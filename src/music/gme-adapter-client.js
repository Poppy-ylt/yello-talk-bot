'use strict';

const ADAPTER_TOKEN_HEADER = 'x-gme-adapter-token';
const ROOM_QUALITIES = Object.freeze({ fluency: 'fluency', standard: 'standard', hq: 'highquality' });

function normalizeLoopbackBaseUrl(value) {
  let url;
  try { url = new URL(String(value || '')); }
  catch { throw new Error('GME adapter URL must be a valid local HTTP URL'); }
  if (url.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(url.hostname.toLowerCase())
    || url.username || url.password || url.search || url.hash) {
    throw new Error('GME adapter must use plain HTTP on localhost or 127.0.0.1 only');
  }
  return url.toString().replace(/\/$/, '');
}

class GmeAdapterClient {
  constructor({ http, baseUrl, token, timeoutMs = 15000 } = {}) {
    if (!http || typeof http.get !== 'function' || typeof http.post !== 'function') {
      throw new TypeError('An HTTP client with get() and post() is required');
    }
    if (!String(token || '').trim()) throw new Error('GME adapter token is not configured');
    this.http = http;
    this.baseUrl = normalizeLoopbackBaseUrl(baseUrl);
    this.token = String(token).trim();
    this.timeoutMs = Math.max(1000, Math.min(60000, Number(timeoutMs) || 15000));
    this.capabilitySnapshot = null;
  }

  options() {
    return {
      timeout: this.timeoutMs,
      maxContentLength: 1024 * 1024,
      maxBodyLength: 1024 * 1024,
      headers: { [ADAPTER_TOKEN_HEADER]: this.token },
    };
  }

  async get(endpoint) {
    const response = await this.http.get(`${this.baseUrl}${endpoint}`, this.options());
    return response?.data || {};
  }

  async post(endpoint, body = {}) {
    const response = await this.http.post(`${this.baseUrl}${endpoint}`, body, this.options());
    return response?.data || {};
  }

  status() { return this.get('/status'); }
  capabilities() { return this.get('/capabilities'); }
  health() { return this.get('/health'); }

  async assertMusicCapabilities() {
    const response = await this.capabilities();
    this.capabilitySnapshot = response;
    const features = response?.features || {};
    const endpoints = new Set(Array.isArray(response?.endpoints) ? response.endpoints : []);
    const requiredEndpoints = ['/join', '/play', '/stop', '/pause', '/resume', '/volume', '/leave'];
    if (features.status !== true || features.health !== true || features.playMusic !== true
      || requiredEndpoints.some(endpoint => !endpoints.has(endpoint))) {
      throw new Error('GME adapter is missing one or more required music capabilities');
    }
    return response;
  }

  async assertTtsCapabilities() {
    const response = await this.capabilities();
    const features = response?.features || {};
    const endpoints = new Set(Array.isArray(response?.endpoints) ? response.endpoints : []);
    const requiredEndpoints = ['/effect-play', '/effect-stop', '/effect-volume'];
    if (features.effects !== true || requiredEndpoints.some(endpoint => !endpoints.has(endpoint))) {
      throw new Error('GME adapter does not support speech audio effects');
    }
    return response;
  }

  join({ room, user, uuid } = {}) {
    const payload = { room: String(room || '').trim(), user: String(user || '').trim(), uuid: String(uuid || '').trim() };
    if (!payload.room || !payload.user || !payload.uuid) throw new Error('GME room, user, and UUID are required');
    return this.post('/join', payload);
  }

  play({ file, loop = false } = {}) {
    const localFile = String(file || '').trim();
    if (!localFile) throw new Error('A local audio file is required');
    return this.post('/play', { file: localFile, loop: loop === true });
  }

  stop() { return this.post('/stop'); }
  pause() { return this.post('/pause'); }
  resume() { return this.post('/resume'); }

  setVolume(volume) {
    const value = Number(volume);
    if (!Number.isFinite(value) || value < 0 || value > 100) throw new Error('Music volume must be between 0 and 100');
    return this.post('/volume', { vol: Math.round(value) });
  }

  async setRoomQuality(quality) {
    const normalized = ROOM_QUALITIES[quality];
    if (!normalized) throw new Error('Unsupported room audio quality');
    const capabilities = this.capabilitySnapshot || await this.capabilities();
    this.capabilitySnapshot = capabilities;
    const endpoints = new Set(Array.isArray(capabilities?.endpoints) ? capabilities.endpoints : []);
    if (capabilities?.features?.roomQuality !== true || !endpoints.has('/room-quality')) {
      throw new Error('GME adapter does not support room quality');
    }
    return this.post('/room-quality', { quality: normalized });
  }

  playEffect({ file, effectId = 9001, volume = 100, send = true } = {}) {
    const localFile = String(file || '').trim();
    const id = Number(effectId);
    const level = Number(volume);
    if (!localFile) throw new Error('A local speech file is required');
    if (!Number.isInteger(id) || id < 1 || id > 999999) throw new Error('Invalid speech effect ID');
    if (!Number.isFinite(level) || level < 0 || level > 100) throw new Error('Speech effect volume must be between 0 and 100');
    return this.post('/effect-play', { file: localFile, effectId: id, volume: Math.round(level), send: send === true });
  }

  stopEffect(effectId = 9001) {
    const id = Number(effectId);
    if (!Number.isInteger(id) || id < 1 || id > 999999) throw new Error('Invalid speech effect ID');
    return this.post('/effect-stop', { effectId: id });
  }

  setEffectVolume(effectId, volume) {
    const id = Number(effectId);
    const level = Number(volume);
    if (!Number.isInteger(id) || id < 1 || id > 999999) throw new Error('Invalid speech effect ID');
    if (!Number.isFinite(level) || level < 0 || level > 100) throw new Error('Speech effect volume must be between 0 and 100');
    return this.post('/effect-volume', { effectId: id, volume: Math.round(level) });
  }

  leave() { return this.post('/leave'); }
}

module.exports = { ADAPTER_TOKEN_HEADER, GmeAdapterClient, ROOM_QUALITIES, normalizeLoopbackBaseUrl };
