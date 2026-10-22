import assert from 'node:assert/strict';
import '../interaction.js';
const { ClockwiseRing, PinchConfirm } = globalThis.FifthSeasonInput;
const ring = new ClockwiseRing();
let completed = false;
for (let i = 0; i <= 80; i++) {
  const a = i / 80 * Math.PI * 2;
  completed = ring.move(Math.cos(a) * 100, Math.sin(a) * 100, 0, 0, 100, i * 30) || completed;
}
assert.ok(completed);
let display = ring.smooth(1 / 60);
assert.ok(display > 0 && display < ring.rotation, 'Ring interpolates instead of snapping');
for (let i = 0; i < 60; i++) display = ring.smooth(1 / 60);
assert.ok(Math.abs(display - ring.rotation) < .001);
ring.reset();
for (let i = 0; i <= 80; i++) {
  const a = -i / 80 * Math.PI * 2;
  assert.equal(ring.move(Math.cos(a) * 100, Math.sin(a) * 100, 0, 0, 100, i * 30), false);
}
assert.equal(ring.rotation, 0);
ring.reset(); ring.move(100, 0, 0, 0, 100, 0); ring.move(-100, 0, 0, 0, 100, 30);
assert.equal(ring.rotation, 0, 'Tracking jumps do not count');
ring.release(); ring.move(0, 100, 0, 0, 100, 60);
assert.equal(ring.rotation, 0, 'Reacquiring does not add progress');
function hand(closed) {
  const p = Array.from({ length: 21 }, () => ({ x: .5, y: .5 }));
  p[0] = { x: .5, y: .8 }; p[9] = { x: .5, y: .6 };
  p[8] = { x: .5, y: .3 }; p[4] = { x: closed ? .55 : .7, y: .3 };
  return p;
}
const pinch = new PinchConfirm();
assert.equal(pinch.update([hand(false)], 0), false);
assert.equal(pinch.update([hand(true)], 100), false);
assert.equal(pinch.update([hand(true)], 270), true, 'One thumb/index pinch confirms');
assert.equal(pinch.update([hand(true)], 600), false, 'Holding cannot confirm twice');
pinch.update([hand(false)], 700);
pinch.update([hand(false), hand(true)], 800);
assert.equal(pinch.update([hand(false), hand(true)], 1000), true, 'Either hand can confirm');
pinch.update([], 1100);
assert.equal(pinch.update([hand(true)], 1200), false, 'Tracking loss cancels the hold');
console.log('PASS: smooth clockwise ring, rejection of jumps, single-hand pinch and release/rearm.');
