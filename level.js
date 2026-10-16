/* Shared by the browser and the reachability check. No module loading needed. */
(function (root) {
  'use strict';
  const level = {
    width: 5400,
    ground: 620,
    speed: 220,
    gravity: 1250,
    jumpVelocity: -540,
    // The snowy bank is continuous, matching the supplied artwork. There are
    // no invisible gaps and no collectibles suspended over missing platforms.
    platforms: [{ x: 0, width: 5400, y: 620 }],
    embers: [
      { x: 640, y: 564 }, { x: 1060, y: 496 },
      { x: 1480, y: 564 }, { x: 1900, y: 496 },
      { x: 2320, y: 564 }, { x: 2740, y: 496 },
      { x: 3160, y: 564 }, { x: 3580, y: 496 },
      { x: 4000, y: 564 }, { x: 4420, y: 496 }
    ]
  };

  function step(player, direction, dt) {
    const oldY = player.y;
    player.x = Math.max(30, Math.min(level.width - 30, player.x + direction * level.speed * dt));
    player.vy += level.gravity * dt;
    player.y += player.vy * dt;
    player.grounded = false;
    for (const p of level.platforms) {
      if (player.x >= p.x && player.x <= p.x + p.width && oldY <= p.y + 1 && player.y >= p.y && player.vy >= 0) {
        player.y = p.y;
        player.vy = 0;
        player.grounded = true;
        break;
      }
    }
  }

  function jump(player) {
    if (!player.grounded) return false;
    player.vy = level.jumpVelocity;
    player.grounded = false;
    return true;
  }

  root.FifthSeasonLevel = { level, step, jump };
})(globalThis);
