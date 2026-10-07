'use strict';

// GME's room profiles are numeric in the user-facing command, but the native
// adapter and API use their canonical names. Keep the conversion in one place
// so chat commands, the HTTP endpoint, and tests cannot drift apart.
const ROOM_QUALITY_BY_LEVEL = Object.freeze({
  '1': 'fluency',
  '2': 'standard',
  '3': 'highquality',
});

const ROOM_QUALITY_NAMES = Object.freeze(['fluency', 'standard', 'highquality']);
const ROOM_QUALITY_LEVELS = Object.freeze(['1', '2', '3']);

function normalizeRoomQuality(value) {
  const quality = String(value || '').trim().toLowerCase();
  return ROOM_QUALITY_NAMES.includes(quality) ? quality : null;
}

function roomQualityFromLevel(value) {
  const level = String(value || '').trim();
  return Object.prototype.hasOwnProperty.call(ROOM_QUALITY_BY_LEVEL, level)
    ? ROOM_QUALITY_BY_LEVEL[level]
    : null;
}

function roomQualityUsage() {
  return '.sq 1 (Fluency), .sq 2 (Standard), .sq 3 (HQ)';
}

module.exports = {
  ROOM_QUALITY_BY_LEVEL,
  ROOM_QUALITY_NAMES,
  ROOM_QUALITY_LEVELS,
  normalizeRoomQuality,
  roomQualityFromLevel,
  roomQualityUsage,
};
