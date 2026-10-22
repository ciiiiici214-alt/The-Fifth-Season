/* Pure gesture state machines, shared with the interaction tests. */
(function (root) {
  'use strict';
  class ClockwiseRing {
    constructor() { this.reset(); }
    reset() { this.angle = null; this.rotation = 0; this.updatedAt = 0; this.displayRotation = 0; }
    smooth(dt) {
      this.displayRotation += (this.rotation - this.displayRotation) * (1 - Math.exp(-18 * dt));
      return this.displayRotation;
    }
    release() { this.angle = null; }
    move(x, y, cx, cy, radius, now) {
      const distance = Math.hypot(x - cx, y - cy);
      if (distance < radius * .38 || distance > radius * 1.9) { this.release(); return false; }
      const angle = Math.atan2(y - cy, x - cx);
      if (this.angle !== null && now - this.updatedAt < 750) {
        let delta = Math.atan2(Math.sin(angle - this.angle), Math.cos(angle - this.angle));
        // Screen coordinates have positive y downwards: positive is clockwise.
        if (Math.abs(delta) < 1.1) this.rotation = Math.max(0, this.rotation + delta);
      }
      this.angle = angle;
      this.updatedAt = now;
      return this.rotation >= Math.PI * 2 - .08;
    }
  }
  // A single thumb/index pinch confirms. Two hands also work, but are optional.
  class PinchConfirm {
    constructor() { this.reset(); }
    reset() { this.startedAt = null; this.latched = false; }
    update(hands, now) {
      const ratios = hands.map(p => Math.hypot(p[4].x - p[8].x, p[4].y - p[8].y) /
        Math.max(.025, Math.hypot(p[0].x - p[9].x, p[0].y - p[9].y)));
      if (!ratios.length || ratios.every(value => value > .6)) { this.reset(); return false; }
      if (this.latched) return false;
      if (ratios.some(value => value < .42)) {
        if (this.startedAt === null) this.startedAt = now;
        if (now - this.startedAt >= 150) { this.latched = true; return true; }
      } else this.startedAt = null;
      return false;
    }
  }
  root.FifthSeasonInput = { ClockwiseRing, PinchConfirm };
})(globalThis);
