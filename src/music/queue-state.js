'use strict';

function ensurePlaylist(state) {
  if (!state || typeof state !== 'object') return null;
  if (!Array.isArray(state.playlist)) state.playlist = [];
  return state.playlist;
}

function hasUpcoming(state) {
  const playlist = ensurePlaylist(state);
  return !!playlist?.some(item => item.status !== 'playing');
}

function clearAll(state) {
  const playlist = ensurePlaylist(state);
  if (!playlist) return 0;
  const removed = playlist.length;
  playlist.splice(0, playlist.length);
  state.currentlyPlaying = null;
  return removed;
}

function finishPlaying(state) {
  const playlist = ensurePlaylist(state);
  if (!playlist) return null;
  const index = playlist.findIndex(item => item.status === 'playing');
  const removed = index === -1 ? null : playlist.splice(index, 1)[0];
  state.currentlyPlaying = null;
  return removed;
}

// Move the currently playing queue item to the end for queue-repeat mode.
// The marker lets the caller remove replayed entries again when loop mode is
// turned off, while preserving songs that were added but never played.
function requeuePlaying(state) {
  const playlist = ensurePlaylist(state);
  if (!playlist) return null;
  const index = playlist.findIndex(item => item.status === 'playing');
  if (index === -1) {
    state.currentlyPlaying = null;
    return null;
  }
  const item = playlist.splice(index, 1)[0];
  item.status = 'ready';
  item.loopRequeued = true;
  playlist.push(item);
  state.currentlyPlaying = null;
  return item;
}

// A direct .play item is not normally in the playlist. Add a safe queue copy
// when queue-repeat mode starts a new cycle so queued songs still get their
// turn before the direct item comes around again.
function requeueCurrentDirect(state) {
  const playlist = ensurePlaylist(state);
  if (!playlist) return null;
  const current = state.currentlyPlaying;
  if (!current || !current.file || current.status !== 'playing') {
    state.currentlyPlaying = null;
    return null;
  }
  const existingIndex = playlist.indexOf(current);
  if (existingIndex !== -1) return requeuePlaying(state);
  const item = {
    ...current,
    source: 'queue',
    status: 'ready',
    loopRequeued: true,
  };
  playlist.push(item);
  state.currentlyPlaying = null;
  return item;
}

// Remove only entries produced by queue-repeat. Songs added after loop was
// enabled are deliberately left in place for normal one-shot playback.
function discardLoopReplays(state, protectedItem = null) {
  const playlist = ensurePlaylist(state);
  if (!playlist) return 0;
  let removed = 0;
  for (let index = playlist.length - 1; index >= 0; index--) {
    const item = playlist[index];
    if (item.loopRequeued && item !== protectedItem && item.status !== 'playing' && !item.playbackTransition) {
      playlist.splice(index, 1);
      removed++;
    } else if (item.loopRequeued && item.status === 'playing') {
      item.loopRequeued = false;
    }
  }
  if (state.currentlyPlaying?.loopRequeued) {
    state.currentlyPlaying.loopRequeued = false;
  }
  if (protectedItem?.loopRequeued) protectedItem.loopRequeued = false;
  return removed;
}

function clearUpcoming(state) {
  const playlist = ensurePlaylist(state);
  if (!playlist) return 0;
  let removed = 0;
  for (let index = playlist.length - 1; index >= 0; index--) {
    if (playlist[index].status !== 'playing' && !playlist[index].playbackTransition) {
      playlist.splice(index, 1);
      removed++;
    }
  }
  return removed;
}

function removeAt(state, index) {
  const playlist = ensurePlaylist(state);
  if (!playlist || !Number.isInteger(index) || index < 0 || index >= playlist.length) return null;
  if (playlist[index].status === 'playing' || playlist[index].playbackTransition) return null;
  return playlist.splice(index, 1)[0];
}

module.exports = {
  ensurePlaylist,
  hasUpcoming,
  clearAll,
  finishPlaying,
  requeuePlaying,
  requeueCurrentDirect,
  discardLoopReplays,
  clearUpcoming,
  removeAt,
};
