import assert from 'node:assert/strict';
import '../interaction.js';
const { ClockwiseRing, TwoHandPinch } = globalThis.FifthSeasonInput;

const ring = new ClockwiseRing();
let completed = false;
for (let i = 0; i <= 80; i++) {
  const angle = i / 80 * Math.PI * 2;
  completed = ring.move(Math.cos(angle) * 100, Math.sin(angle) * 100, 0, 0, 100, i * 30) || completed;
}
assert.ok(completed, 'Clockwise circle opens the menu');
ring.reset();
for (let i = 0; i <= 80; i++) {
  const angle = -i / 80 * Math.PI * 2;
  assert.equal(ring.move(Math.cos(angle) * 100, Math.sin(angle) * 100, 0, 0, 100, i * 30), false);
}
assert.equal(ring.rotation, 0, 'Counterclockwise movement does not unlock');
ring.reset();
ring.move(100, 0, 0, 0, 100, 0);
ring.move(-100, 0, 0, 0, 100, 30);
assert.equal(ring.rotation, 0, 'Tracking jumps do not count as rotation');
ring.release();
ring.move(0, 100, 0, 0, 100, 60);
assert.equal(ring.rotation, 0, 'Reacquiring a finger does not create false progress');

function hand(pinched) {
  const points = Array.from({ length: 21 }, () => ({ x: .5, y: .5 }));
  points[0] = { x: .5, y: .8 };
  points[9] = { x: .5, y: .6 };
  points[8] = { x: .5, y: .3 };
  points[4] = { x: pinched ? .52 : .7, y: .3 };
  return points;
}
const pinch = new TwoHandPinch();
assert.equal(pinch.update([hand(true)], 0), false, 'One hand cannot confirm');
assert.equal(pinch.update([hand(true), hand(false)], 100), false);
assert.equal(pinch.update([hand(true), hand(true)], 200), false);
assert.equal(pinch.update([hand(true), hand(true)], 550), true, 'Both pinches confirm after a stable hold');
assert.equal(pinch.update([hand(true), hand(true)], 900), false, 'Holding cannot confirm twice');
pinch.update([hand(false), hand(false)], 1000);
pinch.update([hand(true), hand(true)], 1100);
assert.equal(pinch.update([hand(true), hand(true)], 1500), true, 'Release rearms confirmation');
console.log('PASS: clockwise circle, reversal, lost tracking, stable two-hand pinch and rearming.');
