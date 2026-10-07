'use strict';

const { randomUUID } = require('node:crypto');
const QueueState = require('./queue-state');

const DEFAULT_MAX_QUEUE_ITEMS = 100;

class MusicQueueService {
  constructor({ maxItems = DEFAULT_MAX_QUEUE_ITEMS, createId = randomUUID } = {}) {
    this.maxItems = Math.max(1, Math.min(500, Math.trunc(Number(maxItems)) || DEFAULT_MAX_QUEUE_ITEMS));
    this.createId = createId;
    this.state = { playlist: [], currentlyPlaying: null };
    this.repeat = false;
    this.loop = false;
    this.generation = 0;
  }

  get length() {
    return QueueState.ensurePlaylist(this.state).length;
  }

  get current() {
    return this.state.currentlyPlaying;
  }

  get upcoming() {
    return QueueState.ensurePlaylist(this.state).filter(item => item.status !== 'playing');
  }

  add(tracks) {
    if (!Array.isArray(tracks) || tracks.length === 0) return [];
    if (tracks.some(track => !track || typeof track !== 'object'
      || !/^[A-Za-z0-9_-]{11}$/.test(String(track.videoId || ''))
      || !Number.isFinite(Number(track.durationSeconds))
      || Number(track.durationSeconds) <= 0)) {
      const error = new Error('Queue tracks must have a valid YouTube ID and duration');
      error.code = 'INVALID_TRACK';
      throw error;
    }
    if (this.length + tracks.length > this.maxItems) {
      const error = new Error(`Queue can contain at most ${this.maxItems} tracks`);
      error.code = 'QUEUE_LIMIT';
      throw error;
    }
    const items = tracks.map(track => ({
      ...track,
      queueId: this.createId(),
      status: 'ready',
    }));
    this.state.playlist.push(...items);
    return items;
  }

  startNext() {
    if (this.state.currentlyPlaying) return null;
    const item = this.upcoming[0];
    if (!item) return null;
    item.status = 'playing';
    this.state.currentlyPlaying = item;
    this.generation++;
    item.playbackGeneration = this.generation;
    return item;
  }

  completeCurrent(expectedGeneration = this.generation) {
    if (expectedGeneration !== this.generation) return null;
    const current = this.current;
    if (!current) return this.startNext();
    if (this.repeat) {
      this.generation++;
      current.playbackGeneration = this.generation;
      return current;
    }
    this.generation++;
    if (this.loop) QueueState.requeuePlaying(this.state);
    else QueueState.finishPlaying(this.state);
    return this.startNext();
  }

  skipCurrent() {
    if (!this.current) return this.startNext();
    this.generation++;
    if (this.loop) QueueState.requeuePlaying(this.state);
    else QueueState.finishPlaying(this.state);
    return this.startNext();
  }

  failCurrent(queueId, expectedGeneration = this.generation) {
    const current = this.current;
    if (!current || current.queueId !== queueId || this.generation !== expectedGeneration) return null;
    QueueState.finishPlaying(this.state);
    this.generation++;
    return this.startNext();
  }

  setRepeat(enabled) {
    this.repeat = enabled === true;
    return this.repeat;
  }

  setLoop(enabled) {
    this.loop = enabled === true;
    return this.loop;
  }

  isCurrentPlayback(queueId, generation) {
    return !!this.current
      && this.current.queueId === queueId
      && this.generation === generation
      && this.current.playbackGeneration === generation;
  }

  removeUpcoming(position) {
    const ordinal = Number(position);
    if (!Number.isInteger(ordinal) || ordinal < 1) return null;
    const item = this.upcoming[ordinal - 1];
    if (!item) return null;
    const index = this.state.playlist.indexOf(item);
    return QueueState.removeAt(this.state, index);
  }

  clearUpcoming() {
    return QueueState.clearUpcoming(this.state);
  }

  stop() {
    this.generation++;
    return QueueState.clearAll(this.state);
  }

  suspendCurrent() {
    const current = this.current;
    if (!current) return null;
    this.generation++;
    current.status = 'ready';
    delete current.playbackGeneration;
    const playlist = QueueState.ensurePlaylist(this.state);
    if (playlist && !playlist.includes(current)) playlist.unshift(current);
    this.state.currentlyPlaying = null;
    return current;
  }

  snapshot() {
    const project = item => item && ({
      queueId: item.queueId,
      videoId: item.videoId,
      title: item.title,
      durationSeconds: item.durationSeconds,
      url: item.url,
      requestedBy: item.requestedBy,
      source: item.source,
      status: item.status,
    });
    return {
      current: project(this.current),
      upcoming: this.upcoming.map(project),
      length: this.length,
      repeat: this.repeat,
      loop: this.loop,
    };
  }
}

module.exports = { DEFAULT_MAX_QUEUE_ITEMS, MusicQueueService };
