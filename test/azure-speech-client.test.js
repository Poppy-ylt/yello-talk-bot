'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { AzureSpeechClient, buildSsml, validateVoice, waveDurationMs } = require('../src/tts/azure-speech-client');

function wavWithDuration(durationMs = 200) {
  const byteRate = 48000;
  const audioBytes = Math.max(2, Math.floor(byteRate * durationMs / 1000));
  const audio = Buffer.alloc(44 + audioBytes);
  audio.write('RIFF', 0);
  audio.writeUInt32LE(36 + audioBytes, 4);
  audio.write('WAVE', 8);
  audio.write('fmt ', 12);
  audio.writeUInt32LE(16, 16);
  audio.writeUInt16LE(1, 20);
  audio.writeUInt16LE(1, 22);
  audio.writeUInt32LE(24000, 24);
  audio.writeUInt32LE(byteRate, 28);
  audio.writeUInt16LE(2, 32);
  audio.writeUInt16LE(16, 34);
  audio.write('data', 36);
  audio.writeUInt32LE(audioBytes, 40);
  return audio;
}

test('builds escaped Azure SSML with bounded speed, pitch, and voice settings', () => {
  const ssml = buildSsml({ text: `Hi <bot> & "friend"'`, voice: 'en-US-JennyNeural', speed: 1.2, pitch: -5, volume: 80 });
  assert.match(ssml, /xml:lang="en-US"/);
  assert.match(ssml, /rate="\+20%" pitch="-5%" volume="80%"/);
  assert.match(ssml, /Hi &lt;bot&gt; &amp; &quot;friend&quot;&apos;/);
  assert.equal(validateVoice('en-US-JennyNeural'), 'en-US-JennyNeural');
  assert.equal(validateVoice('https://attacker.invalid'), null);
  assert.throws(() => buildSsml({ text: 'too fast', speed: 2 }), /speed/);
  assert.throws(() => buildSsml({ text: 'bad voice', voice: 'x' }), /voice/);
});

test('validates the Azure WAV response and computes its duration', () => {
  assert.equal(waveDurationMs(wavWithDuration(400)), 400);
  assert.throws(() => waveDurationMs(Buffer.from('not audio')), /valid WAV/);
});

test('sends only synthesis SSML with a local key and returns in-memory audio', async () => {
  const audio = wavWithDuration(200);
  const calls = [];
  const client = new AzureSpeechClient({
    http: { async post(...args) { calls.push(args); return { data: audio }; } },
    subscriptionKey: 'private-azure-key',
    region: 'westus2',
  });
  const result = await client.synthesize({ text: 'Hello', voice: 'en-US-JennyNeural' });
  assert.equal(result.durationMs, 200);
  assert.deepEqual(result.audio, audio);
  assert.equal(calls[0][0], 'https://westus2.tts.speech.microsoft.com/cognitiveservices/v1');
  assert.match(calls[0][1], /Hello/);
  assert.equal(calls[0][2].headers['Ocp-Apim-Subscription-Key'], 'private-azure-key');
  assert.equal(calls[0][2].headers['X-Microsoft-OutputFormat'], 'riff-24khz-16bit-mono-pcm');
  assert.equal(calls[0][2].responseType, 'arraybuffer');
  assert.throws(() => new AzureSpeechClient({ http: { post() {} }, subscriptionKey: 'key', region: 'https://evil.invalid' }), /region is invalid/);
});
