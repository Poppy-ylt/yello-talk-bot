'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const linuxSource = fs.readFileSync(
  path.join(__dirname, '..', 'adapters', 'linux-native', 'main_linux.cpp'),
  'utf8'
);
const windowsSource = fs.readFileSync(
  path.join(__dirname, '..', 'adapters', 'windows-native', 'main_windows.cpp'),
  'utf8'
);

test('Linux native adapter keeps only the music and optional room-quality command surface', () => {
  assert.match(
    linuxSource,
    /const char\* musicEndpoints\[\] = \{\"\/status\", \"\/health\", \"\/capabilities\", \"\/join\", \"\/play\", \"\/stop\", \"\/pause\", \"\/resume\", \"\/volume\", \"\/room-quality\", \"\/leave\"\};/
  );

  for (const legacyFeature of [
    'CMD_ACCOMPANY_PROGRESS',
    'CMD_ROOM_SHARING',
    'CMD_MIC',
    'VoiceUser',
    'g_voiceUsers',
    'roomSharing',
    'voiceUsers',
    '"/mic"',
    '"/room-sharing"',
    '"/accompany-progress"'
  ]) {
    assert.equal(linuxSource.includes(legacyFeature), false, `${legacyFeature} must stay out of the Linux music adapter`);
  }
});

test('Linux native status reports playback completion without exposing auth identifiers', () => {
  const statusStart = linuxSource.indexOf('else if (strcmp(path, "/status") == 0) {');
  const statusEnd = linuxSource.indexOf('else if (strcmp(path, "/join")', statusStart);
  const statusHandler = statusStart >= 0 && statusEnd > statusStart
    ? linuxSource.slice(statusStart, statusEnd)
    : null;

  assert.ok(statusHandler, 'status handler should exist');
  assert.match(statusHandler, /songFinished/);
  assert.match(statusHandler, /currentFile/);
  assert.doesNotMatch(statusHandler, /authId|uuid|micEnabled|voiceUsers|roomSharing/);
});

test('Windows native adapter exposes only music, TTS effects, and room quality', () => {
  assert.match(
    windowsSource,
    /const char\* musicEndpoints\[\] = \{"\/status", "\/health", "\/capabilities", "\/join", "\/play", "\/stop", "\/pause", "\/resume", "\/volume", "\/effect-play", "\/effect-stop", "\/effect-volume", "\/room-quality", "\/leave"\};/
  );
  assert.ok(windowsSource.includes('\\"features\\":{\\"status\\":true,\\"health\\":true,\\"playMusic\\":true,\\"effects\\":true,\\"roomQuality\\":true}'));
  assert.match(windowsSource, /SetMicVolume\(0\)/, 'the internal capture path must remain muted');

  for (const removedFeature of [
    'CMD_CROSSFADE',
    'MusicCrossfade',
    'remote-listener',
    'g_relay',
    'g_micEnabled',
    'setRoomAudioMonitor',
    'microphoneDevicesJson',
    'wasapiDevicesJson',
    'voiceUsers',
    'roomSharingActive',
    'accompany-progress',
    '"/mic"',
    '"/monitor"',
    '"/relay-input"'
  ]) {
    assert.equal(windowsSource.includes(removedFeature), false, `${removedFeature} must stay out of the Windows music adapter`);
  }
});

test('Windows native status reports playback completion without auth identifiers', () => {
  const statusStart = windowsSource.indexOf('else if (strcmp(path, "/status") == 0) {');
  const statusEnd = windowsSource.indexOf('else if (strcmp(path, "/join")', statusStart);
  const statusHandler = statusStart >= 0 && statusEnd > statusStart
    ? windowsSource.slice(statusStart, statusEnd)
    : null;

  assert.ok(statusHandler, 'status handler should exist');
  assert.match(statusHandler, /songFinished/);
  assert.match(statusHandler, /currentFile/);
  assert.doesNotMatch(statusHandler, /authId|uuid|"user"|micEnabled|voiceUsers|roomSharing/);
  assert.doesNotMatch(windowsSource, /authId=%s|uuid=%s|\\"uuid\\":\\"%s/);
});
