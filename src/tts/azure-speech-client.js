'use strict';

const MAX_SPEECH_TEXT_LENGTH = 500;
const MAX_SPEECH_AUDIO_BYTES = 25 * 1024 * 1024;
const DEFAULT_SPEECH_VOICE = 'en-US-JennyNeural';

function escapeSsmlText(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function validateVoice(value) {
  const voice = String(value || DEFAULT_SPEECH_VOICE).trim();
  return /^[a-z]{2,3}-[A-Z]{2,4}-[A-Za-z0-9-]+Neural$/.test(voice) ? voice : null;
}

function percent(value) {
  const amount = Math.round(Number(value));
  return `${amount > 0 ? '+' : ''}${amount}%`;
}

function buildSsml({ text, voice = DEFAULT_SPEECH_VOICE, speed = 1, pitch = 0, volume = 80 } = {}) {
  const content = String(text || '').trim();
  const normalizedVoice = validateVoice(voice);
  const speechSpeed = Number(speed);
  const speechPitch = Number(pitch);
  const speechVolume = Number(volume);
  if (!content || content.length > MAX_SPEECH_TEXT_LENGTH) throw new Error(`Speech text must contain 1-${MAX_SPEECH_TEXT_LENGTH} characters`);
  if (!normalizedVoice) throw new Error('Unsupported Azure speech voice name');
  if (!Number.isFinite(speechSpeed) || speechSpeed < 0.5 || speechSpeed > 1.5) throw new Error('Speech speed is outside the supported range');
  if (!Number.isFinite(speechPitch) || speechPitch < -50 || speechPitch > 50) throw new Error('Speech pitch is outside the supported range');
  if (!Number.isFinite(speechVolume) || speechVolume < 0 || speechVolume > 100) throw new Error('Speech volume is outside the supported range');
  const locale = normalizedVoice.split('-').slice(0, 2).join('-');
  const rate = percent((speechSpeed - 1) * 100);
  const pitchValue = percent(speechPitch);
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${locale}"><voice name="${normalizedVoice}"><prosody rate="${rate}" pitch="${pitchValue}" volume="${Math.round(speechVolume)}%">${escapeSsmlText(content)}</prosody></voice></speak>`;
}

function waveDurationMs(audio) {
  const data = Buffer.isBuffer(audio) ? audio : Buffer.from(audio || []);
  if (data.length < 44 || data.toString('ascii', 0, 4) !== 'RIFF' || data.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('Azure speech response is not a valid WAV file');
  }
  let byteRate = 0;
  let audioBytes = 0;
  for (let offset = 12; offset + 8 <= data.length;) {
    const name = data.toString('ascii', offset, offset + 4);
    const chunkSize = data.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (body + chunkSize > data.length) break;
    if (name === 'fmt ' && chunkSize >= 16) byteRate = data.readUInt32LE(body + 8);
    if (name === 'data') audioBytes = chunkSize;
    offset = body + chunkSize + (chunkSize % 2);
  }
  if (byteRate <= 0 || audioBytes <= 0) throw new Error('Azure speech WAV has no playable audio');
  return Math.max(1, Math.ceil((audioBytes / byteRate) * 1000));
}

class AzureSpeechClient {
  constructor({ http, subscriptionKey, region, timeoutMs = 30000 } = {}) {
    if (!http || typeof http.post !== 'function') throw new TypeError('An HTTP client with post() is required');
    const key = String(subscriptionKey || '').trim();
    const normalizedRegion = String(region || '').trim().toLowerCase();
    if (!key) throw new Error('Azure speech subscription key is not configured');
    if (!/^[a-z0-9-]{3,64}$/.test(normalizedRegion)) throw new Error('Azure speech region is invalid');
    this.http = http;
    this.subscriptionKey = key;
    this.region = normalizedRegion;
    this.timeoutMs = Math.max(1000, Math.min(60000, Number(timeoutMs) || 30000));
  }

  async synthesize(options = {}) {
    const ssml = buildSsml(options);
    const response = await this.http.post(`https://${this.region}.tts.speech.microsoft.com/cognitiveservices/v1`, ssml, {
      timeout: this.timeoutMs,
      responseType: 'arraybuffer',
      maxContentLength: MAX_SPEECH_AUDIO_BYTES,
      maxBodyLength: 16 * 1024,
      signal: options.signal,
      headers: {
        'Ocp-Apim-Subscription-Key': this.subscriptionKey,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'riff-24khz-16bit-mono-pcm',
        'User-Agent': 'YelloMusicBot',
      },
    });
    const audio = Buffer.from(response?.data || []);
    if (audio.length > MAX_SPEECH_AUDIO_BYTES) throw new Error('Azure speech audio exceeds the size limit');
    return { audio, durationMs: waveDurationMs(audio) };
  }
}

module.exports = {
  DEFAULT_SPEECH_VOICE,
  MAX_SPEECH_AUDIO_BYTES,
  MAX_SPEECH_TEXT_LENGTH,
  AzureSpeechClient,
  buildSsml,
  escapeSsmlText,
  validateVoice,
  waveDurationMs,
};
