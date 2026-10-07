'use strict';

const DEFAULT_RECOVERY_DELAYS_MS = Object.freeze([1000, 2000, 5000, 10000, 20000]);

class RoomRecoveryController {
  constructor({ recover, onExhausted = async () => false, onStatus = () => {}, delaysMs = DEFAULT_RECOVERY_DELAYS_MS, schedule = setTimeout, cancelTimer = clearTimeout } = {}) {
    if (typeof recover !== 'function') throw new TypeError('A room recovery action is required');
    this.recover = recover;
    this.onExhausted = onExhausted;
    this.onStatus = onStatus;
    this.delaysMs = Array.isArray(delaysMs) && delaysMs.length
      ? delaysMs.map(value => Math.max(0, Math.min(60000, Number(value) || 0))).slice(0, 10)
      : DEFAULT_RECOVERY_DELAYS_MS;
    this.schedule = schedule;
    this.cancelTimer = cancelTimer;
    this.generation = 0;
    this.timer = null;
    this.roomId = null;
    this.attempt = 0;
    this.status = 'idle';
  }

  snapshot() {
    return { status: this.status, attempt: this.attempt, maxAttempts: this.delaysMs.length };
  }

  start(roomId) {
    const id = String(roomId || '').trim();
    if (!id) return false;
    this.cancel();
    const generation = this.generation;
    this.roomId = id;
    this.attempt = 0;
    this.status = 'waiting';
    this.notify();
    this.scheduleAttempt(generation, this.delaysMs[0]);
    return true;
  }

  cancel() {
    this.generation++;
    if (this.timer != null) this.cancelTimer(this.timer);
    this.timer = null;
    this.roomId = null;
    this.attempt = 0;
    this.status = 'idle';
    this.notify();
  }

  isCurrent(generation) {
    return this.generation === generation && Boolean(this.roomId);
  }

  scheduleAttempt(generation, delayMs) {
    this.timer = this.schedule(() => {
      this.timer = null;
      void this.runAttempt(generation);
    }, delayMs);
    this.timer?.unref?.();
  }

  async runAttempt(generation) {
    if (!this.isCurrent(generation)) return false;
    this.attempt++;
    this.status = 'recovering';
    this.notify();
    try {
      const result = await this.recover(this.roomId, () => this.isCurrent(generation));
      if (!this.isCurrent(generation)) return false;
      if (result === false) throw new Error('Room recovery did not succeed');
      this.status = 'recovered';
      this.roomId = null;
      this.notify();
      return true;
    } catch {
      if (!this.isCurrent(generation)) return false;
      if (this.attempt >= this.delaysMs.length) {
        this.status = 'recovering';
        this.notify();
        const failedRoomId = this.roomId;
        let recovered = false;
        try {
          recovered = Boolean(await this.onExhausted(failedRoomId, () => this.isCurrent(generation)));
        } catch {}
        if (!this.isCurrent(generation)) return false;
        this.roomId = null;
        this.status = recovered ? 'recovered' : 'exhausted';
        this.notify();
        return recovered;
      }
      this.status = 'waiting';
      this.notify();
      this.scheduleAttempt(generation, this.delaysMs[this.attempt]);
      return false;
    }
  }

  notify() {
    try { this.onStatus(this.snapshot()); } catch {}
  }
}

module.exports = { DEFAULT_RECOVERY_DELAYS_MS, RoomRecoveryController };
