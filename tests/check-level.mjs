import assert from 'node:assert/strict';
import '../level.js';

const { level, step, jump } = globalThis.FifthSeasonLevel;
const player = { x: 450, y: level.ground, vy: 0, grounded: true };
const collected = new Set();
let wasJumping = false;

// Walk the actual level using the same fixed-step physics as the browser.
// Jump shortly before each high ember; normal walking collects the low ones.
for (let frame = 0; frame < 4000; frame++) {
  const next = level.embers.find((ember, index) => !collected.has(index) && ember.x > player.x - 40);
  if (next && next.y < 530 && next.x - player.x < 90 && next.x > player.x && player.grounded) {
    wasJumping = jump(player) || wasJumping;
  }
  step(player, 1, 1 / 120);
  assert.ok(player.y <= level.ground, 'No falling through an invisible platform gap');
  for (let index = 0; index < level.embers.length; index++) {
    const ember = level.embers[index];
    if (Math.hypot(player.x - ember.x, player.y - 42 - ember.y) < 40) collected.add(index);
  }
  if (player.x > 4900 && collected.size === 10) break;
}
assert.ok(wasJumping, 'The path exercises jumping');
assert.equal(collected.size, 10, 'All ten embers can be collected in one traversal');
assert.ok(player.x > 4900, 'The ending can be reached');

const stationary = { x: 1000, y: 620, vy: 0, grounded: true };
step(stationary, 0, 1 / 120);
assert.equal(stationary.x, 1000, 'Centering the hand stops horizontal movement');
assert.ok(jump(stationary));
assert.equal(jump(stationary), false, 'No unintended double jump');
console.log('PASS: ten embers, complete traversal, continuous bank, stop and jump.');
