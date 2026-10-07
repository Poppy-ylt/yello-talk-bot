'use strict';

const DOT_COMMAND_ACTIONS = Object.freeze({
  play: 'PLAY',
  add: 'QUEUE',
  queue: 'QUEUE',
  skip: 'SKIP',
  next: 'SKIP',
  vol: 'VOLUME',
  volume: 'VOLUME',
  pause: 'PAUSE',
  resume: 'RESUME',
  stop: 'STOP',
  playlist: 'PLAYLIST',
  list: 'PLAYLIST',
  remove: 'REMOVE',
  clear: 'CLEAR_PLAYLIST',
  np: 'NOW_PLAYING',
  nowplaying: 'NOW_PLAYING',
  autoplay: 'AUTOPLAY',
  repeat: 'REPEAT_TRACK',
  loop: 'LOOP_QUEUE',
  sq: 'ROOM_QUALITY',
  tts: 'TTS',
});

function parseDotCommand(message) {
  if (typeof message !== 'string' || !message.startsWith('.')) return null;

  const spaceIndex = message.indexOf(' ');
  const word = (spaceIndex === -1 ? message : message.slice(0, spaceIndex))
    .slice(1)
    .toLowerCase();
  const param = spaceIndex === -1 ? '' : message.slice(spaceIndex + 1).trim();
  if (word === 'help') return { word, param, kind: 'help' };

  const action = Object.hasOwn(DOT_COMMAND_ACTIONS, word) ? DOT_COMMAND_ACTIONS[word] : null;
  return { word, param, action, kind: action ? 'action' : 'unknown' };
}

module.exports = { DOT_COMMAND_ACTIONS, parseDotCommand };
