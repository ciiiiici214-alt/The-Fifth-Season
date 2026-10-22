/* Pure gesture state machines, shared with the interaction tests. */
(function (root) {
  'use strict';
  class ClockwiseRing {
    constructor() { this.reset(); }
    reset() { this.angle = null; this.rotation = 0; this.updatedAt = 0; }
    release() { this.angle = null; }
    move(x, y, cx, cy, radius, now) {
      const distance = Math.hypot(x - cx, y - cy);
      if (distance < radius * .55 || distance > radius * 1.55) { this.release(); return false; }
      const angle = Math.atan2(y - cy, x - cx);
      if (this.angle !== null && now - this.updatedAt < 450) {
        let delta = Math.atan2(Math.sin(angle - this.angle), Math.cos(angle - this.angle));
        // Screen coordinates have positive y downwards: positive is clockwise.
        if (Math.abs(delta) < .7) this.rotation = Math.max(0, this.rotation + delta);
      }
      this.angle = angle;
      this.updatedAt = now;
      return this.rotation >= Math.PI * 2 - .08;
    }
  }
  class TwoHandPinch {
    constructor() { this.reset(); }
    reset() { this.startedAt = null; this.latched = false; }
    update(hands, now) {
      const ratios = hands.map(p => Math.hypot(p[4].x - p[8].x, p[4].y - p[8].y) /
        Math.max(.025, Math.hypot(p[0].x - p[9].x, p[0].y - p[9].y)));
      if (ratios.length < 2 || ratios.some(value => value > .48)) { this.reset(); return false; }
      if (this.latched) return false;
      if (ratios.every(value => value < .32)) {
        if (this.startedAt === null) this.startedAt = now;
        if (now - this.startedAt >= 300) { this.latched = true; return true; }
      } else this.startedAt = null;
      return false;
    }
  }
  root.FifthSeasonInput = { ClockwiseRing, TwoHandPinch };
})(globalThis);
