'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { DOT_COMMAND_ACTIONS, parseDotCommand } = require('../src/commands/dot-command-parser');

test('recognizes the retained music and TTS room commands', () => {
  assert.equal(parseDotCommand('.play Lofi mix').action, 'PLAY');
  assert.equal(parseDotCommand('.add Lofi mix').action, 'QUEUE');
  assert.equal(parseDotCommand('.sq 3').action, 'ROOM_QUALITY');
  assert.equal(parseDotCommand('.tts status').action, 'TTS');
  assert.equal(parseDotCommand('.help').kind, 'help');
});

test('does not dispatch removed commands or ordinary URLs', () => {
  assert.equal(parseDotCommand('.autoplay2 on').kind, 'unknown');
  assert.equal(parseDotCommand('.find someone').kind, 'unknown');
  assert.equal(parseDotCommand('.report problem').kind, 'unknown');
  assert.equal(parseDotCommand('https://youtube.com/watch?v=abcdefghijk'), null);
  assert.equal(Object.hasOwn(DOT_COMMAND_ACTIONS, 'autoplay2'), false);
});
