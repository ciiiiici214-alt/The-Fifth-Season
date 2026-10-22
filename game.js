/* The Fifth Season — classic script, usable through file:// and localhost. */
(function () {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const game = $('#game');
  const canvas = $('#world');
  const ctx = canvas.getContext('2d');
  const { level, step, jump } = globalThis.FifthSeasonLevel;
  const hero = { x: 450, y: level.ground, vy: 0, grounded: true, face: 1 };
  const keys = new Set();
  const collected = new Set();
  const backgrounds = {};
  const cached = {};
  const particles = [];
  const companion = { x: 395, y: level.ground };
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let scene = 'portal';
  let sceneAge = 0;
  let time = 0;
  let previousFrame = 0;
  let accumulator = 0;
  let cameraX = 0;
  let width = 0;
  let height = 0;
  let assetsReady = false;
  let progress = 0;
  let fade = 0;
  let handDirection = 0;
  let handWasPointing = false;
  let stream = null;
  let landmarker = null;
  let cameraBusy = false;
  let cameraGeneration = 0;
  let lastHandFrame = -1;
  let lastDetection = 0;
  let swipeOrigin = null;
  let lastAdvance = 0;
  const ring = new globalThis.FifthSeasonInput.ClockwiseRing();
  const pinch = new globalThis.FifthSeasonInput.PinchConfirm();
  const menuButtons = [...document.querySelectorAll('[data-action]')];
  let selectedOption = null;
  let selectedAt = 0;
  let draggingRing = false;
  let lastSave = 0;
  let lastDiagnostics = 0;
  let displayRing = 0;
  let pointer = null;
  let displayedPointer = null;
  let pinchLock = null;
  let pinchLockAt = 0;
  let characterStride = 0;
  let lastDrawnRingProgress = -1;
  let lastMetrics = 0;
  let averageRenderMs = 0;
  const SAVE_KEY = 'the-fifth-season-save-v1';

  function readSave() {
    try {
      const save = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (!save || !['story', 'tutorial', 'mission', 'playing'].includes(save.scene)) return null;
      if (save.scene === 'playing' && (!Number.isFinite(save.x) || !Array.isArray(save.collected))) return null;
      return save;
    } catch { return null; }
  }
  function saveGame() {
    if (!['story', 'tutorial', 'mission', 'playing'].includes(scene)) return;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ scene, x: hero.x, collected: [...collected] })); } catch { /* Private mode can disable storage. */ }
  }
  function chooseOption(button) {
    if (!button || button.disabled) return;
    selectedOption = button;
    selectedAt = performance.now();
    if (!button.classList.contains('selected')) menuButtons.forEach(option => option.classList.toggle('selected', option === button));
  }
  function activateOption(button) {
    if (scene !== 'menu' || !button || button.disabled) return;
    if (button.dataset.action === 'new') {
      try { localStorage.removeItem(SAVE_KEY); } catch { /* Optional storage. */ }
      setScene('loading');
      progress = 0;
    } else if (button.dataset.action === 'continue') {
      const save = readSave();
      if (!save) return;
      setScene(save.scene);
      if (save.scene === 'playing') {
        hero.x = Math.max(30, Math.min(level.width - 30, save.x));
        save.collected.filter(i => Number.isInteger(i) && i >= 0 && i < level.embers.length).forEach(i => collected.add(i));
        updateCount();
        cameraX = Math.max(0, hero.x - width / (height / 800) * .395);
        saveGame();
      }
    } else {
      stopCamera(); ring.reset(); setScene('portal');
    }
  }
  menuButtons.forEach(button => {
    button.addEventListener('pointerenter', () => chooseOption(button));
    button.addEventListener('focus', () => chooseOption(button));
    button.onclick = () => activateOption(button);
  });

  function resize() {
    width = Math.max(1, innerWidth);
    height = Math.max(1, innerHeight);
    // Bound the fill rate on high-DPI/4K displays instead of rendering 8M pixels.
    const ratio = Math.min(devicePixelRatio || 1, 1.5, Math.sqrt(2400000 / (width * height)));
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    for (const key of Object.keys(cached)) delete cached[key];
  }
  resize();
  addEventListener('resize', resize);

  function setScene(next) {
    scene = next;
    sceneAge = 0;
    fade = next === 'loading' ? 0 : 1;
    keys.clear();
    handDirection = 0;
    swipeOrigin = null;
    game.dataset.scene = next;
    for (const name of ['portal', 'menu', 'loading', 'title', 'story', 'tutorial', 'mission', 'ending']) {
      $('#' + name).hidden = name !== next;
    }
    $('#next').hidden = !['story', 'tutorial', 'mission'].includes(next);
    $('#camera').hidden = ['loading', 'title', 'ending'].includes(next);
    $('#count').hidden = next !== 'playing';
    $('#touch').hidden = next !== 'playing';
    $('#finger-light').hidden = true;
    $('#second-light').hidden = true;
    ring.release(); pinch.reset(); pinchLock = null; pointer = null;
    particles.length = 0;
    selectedOption = null;
    menuButtons.forEach(option => option.classList.remove('selected'));
    if (next === 'menu') {
      const resume = $('[data-action="continue"]');
      resume.disabled = !readSave();
      resume.title = resume.disabled ? '暂无存档' : '继续上次的旅程';
    }
    if (next === 'playing') {
      Object.assign(hero, { x: 450, y: level.ground, vy: 0, grounded: true, face: 1 });
      cameraX = 0;
      collected.clear();
      companion.x = hero.x - 55; companion.y = hero.y;
      updateCount();
    }
    if (next === 'ending') stopCamera();
    saveGame();
  }

  function advance() {
    if (sceneAge < .65) return;
    if (scene === 'portal' || scene === 'menu') return;
    if (scene === 'title') setScene('story');
    else if (scene === 'story') setScene('tutorial');
    else if (scene === 'tutorial') setScene('mission');
    else if (scene === 'mission') setScene('playing');
  }
  $('#next').onclick = advance;
  $('#restart').onclick = () => setScene('playing');
  canvas.addEventListener('click', advance);
  $('#portal-key').onclick = () => setScene('menu');

  function shape(c, points, fill) {
    c.beginPath();
    points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
    c.closePath();
    c.fillStyle = fill;
    c.fill();
  }

  function drawTraveler(c, x, y, scale, moving, facing, light = false) {
    if (backgrounds.characters) {
      const image = backgrounds.characters;
      const pose = moving ? Math.floor(characterStride / 18) % 2 : 0;
      const frames = [[175, 58, 335, 571], [647, 67, 410, 562]];
      const [sx, sy, sw, sh] = frames[pose];
      const h = 92 * scale;
      const w = h * sw / sh;
      c.save(); c.translate(x, y); c.scale(facing, 1);
      const bob = moving && !reducedMotion ? Math.sin(characterStride / 8) * 1.2 : 0;
      c.translate(0, bob);
      c.drawImage(image, sx, sy, sw, sh, -w * .64, -h, w, h);
      c.restore();
      return;
    }
    c.save();
    c.translate(x, y);
    c.scale(scale * facing, scale);
    const swing = moving ? Math.sin(time * 10) : 0;
    const bob = moving ? Math.abs(Math.sin(time * 10)) * 1.3 : 0;
    c.translate(0, -bob);
    const dark = light ? '#b9b9b9' : '#25252a';
    c.strokeStyle = dark;
    c.lineWidth = 2.5;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(-4, -16); c.lineTo(-6 - swing * 5, -2); c.lineTo(-2 - swing * 5, 0);
    c.moveTo(3, -16); c.lineTo(7 + swing * 5, -2); c.lineTo(11 + swing * 5, -1);
    c.stroke();
    // Coat and scarf follow the same silhouette as the reference traveler.
    c.fillStyle = dark;
    c.beginPath();
    c.moveTo(0, -62);
    c.bezierCurveTo(-8, -52, -12, -29, -22 - swing * 1.5, -18);
    c.quadraticCurveTo(-9, -9, 13, -16);
    c.quadraticCurveTo(8, -37, 4, -60);
    c.fill();
    c.strokeStyle = light ? '#e2e2e2' : '#626269';
    c.lineWidth = .7;
    c.beginPath(); c.moveTo(0, -53); c.quadraticCurveTo(-4, -29, -13, -18); c.stroke();
    c.fillStyle = '#efefeb';
    c.beginPath();
    c.moveTo(-1, -61);
    c.bezierCurveTo(-14, -58, -23, -55, -40, -64 + Math.sin(time * 3) * 3);
    c.bezierCurveTo(-30, -52, -13, -48, 3, -57);
    c.fill();
    // White hair, a small face, and uneven hair ends rather than a circle.
    c.fillStyle = '#dddeda';
    c.beginPath(); c.ellipse(3, -66, 5.5, 7, .1, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#f0f0ec';
    c.beginPath();
    c.moveTo(-7, -65); c.bezierCurveTo(-10, -77, 8, -83, 11, -70);
    c.lineTo(15, -66); c.lineTo(8, -67); c.lineTo(5, -63);
    c.lineTo(3, -69); c.lineTo(-1, -63); c.lineTo(-2, -68); c.lineTo(-7, -62);
    c.fill();
    c.restore();
  }

  function drawCat(c, x, y, moving = true, facing = 1, scale = 1) {
    if (backgrounds.characters) {
      const image = backgrounds.characters;
      const frame = moving ? 1 + Math.floor(characterStride / 15) % 2 : 0;
      const [sx, sy, sw, sh] = [[235, 643, 270, 244], [700, 631, 320, 258], [1185, 628, 350, 261]][frame];
      const h = 35 * scale, w = h * sw / sh;
      c.save(); c.translate(x, y); c.scale(facing, 1);
      c.drawImage(image, sx, sy, sw, sh, -w * .5, -h, w, h);
      c.restore();
      return;
    }
    c.save(); c.translate(x, y);
    c.fillStyle = '#b9b9b9';
    c.beginPath(); c.ellipse(-1, -8, 10, 5, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(9, -14, 5, 0, Math.PI * 2); c.fill();
    shape(c, [[5, -16], [5, -23], [10, -18], [14, -22], [14, -14]], '#b9b9b9');
    c.strokeStyle = '#b9b9b9'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(-10, -9); c.bezierCurveTo(-24, -10, -22, -24, -17, -23);
    for (let i = 0; i < 4; i++) {
      c.moveTo(i * 4 - 7, -6); c.lineTo(i * 4 - 7 + Math.sin(time * 11 + i) * 3, -1);
    }
    c.stroke(); c.restore();
  }

  function drawLoading(dt) {
    const target = assetsReady ? 1 : .9;
    progress += (target - progress) * (1 - Math.exp(-dt * 2.1));
    if (assetsReady && progress > .995) progress = 1;
    $('#load-fill').style.width = `${progress * 100}%`;
    $('#walkers').style.left = `${Math.max(.045, progress) * 100}%`;
    const c = $('#walkers').getContext('2d');
    c.clearRect(0, 0, 240, 130);
    drawTraveler(c, 206, 128, 1.25, true, 1, true);
    drawCat(c, 133, 128);
    if (progress >= 1 && sceneAge > 2.5) setScene('story');
  }

  const random = (seed) => {
    const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
    return value - Math.floor(value);
  };

  function drawSnow(strength) {
    if (reducedMotion) return;
    ctx.save();
    for (let i = 0; i < (strength > 1 ? 80 : 30); i++) {
      const depth = .3 + random(i + 7);
      const gust = 1 + Math.sin(time * .4) * .25;
      const x = ((random(i) * width + time * (50 + depth * 130) * strength * gust) % (width + 80)) - 40;
      const y = ((random(i + 50) * height + time * (14 + depth * 26)) % (height + 40)) - 20;
      ctx.globalAlpha = .12 + depth * .24;
      ctx.strokeStyle = '#fff'; ctx.lineWidth = depth * 1.3;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + depth * 9 * strength, y + depth * 4); ctx.stroke();
    }
    ctx.restore();
  }

  function drawWinter() {
    const image = backgrounds.winter;
    if (image) ctx.drawImage(image, 0, 0, width, height);
    drawSnow(1.6);
  }

  function ringGeometry() {
    return { x: width / 2, y: height / 2, radius: Math.min(width, height) * .27 };
  }
  function drawPortal() {
    const image = backgrounds.ring;
    const { x, y, radius } = ringGeometry();
    ctx.save(); ctx.translate(x, y); ctx.rotate(displayRing);
    if (image) {
      // Crop only the ring from the supplied black plate; keep its original lights.
      ctx.drawImage(image, image.width * .34, image.height * .205,
        image.width * .32, image.height * .57, -radius * 1.06, -radius * 1.06, radius * 2.12, radius * 2.12);
    } else {
      ctx.strokeStyle = '#888'; ctx.lineWidth = 1;
      for (const factor of [1, .96, .82, .72]) {
        ctx.beginPath(); ctx.arc(0, 0, radius * factor, 0, Math.PI * 2); ctx.stroke();
      }
    }
    ctx.restore();
    const measured = Math.round(Math.min(1, ring.rotation / (Math.PI * 2)) * 100);
    if (measured !== lastDrawnRingProgress) { game.dataset.ringProgress = String(measured / 100); lastDrawnRingProgress = measured; }
  }
  function drawMenu() {
    const image = backgrounds.menu;
    if (!image) return;
    if (!cached.menu) {
      const plate = document.createElement('canvas'); plate.width = width; plate.height = height;
      const scale = Math.max(width / image.width, height / image.height);
      const w = image.width * scale, h = image.height * scale;
      plate.getContext('2d').drawImage(image, (width - w) / 2, (height - h) / 2, w, h);
      cached.menu = plate;
    }
    ctx.drawImage(cached.menu, 0, 0, width, height);
  }
  function moveLight(element, x, y) {
    element.hidden = false;
    element.style.transform = `translate(${x}px, ${y}px)`;
  }
  function pointAt(x, y, now, turnRing) {
    if (!stream) moveLight($('#finger-light'), x, y);
    if (scene === 'portal' && turnRing) {
      const center = ringGeometry();
      ring.move(x, y, center.x, center.y, center.radius, now);
    } else if (scene === 'menu') {
      const target = menuButtons.find(button => {
        const rect = button.getBoundingClientRect();
        return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
      });
      if (target) chooseOption(target);
      else if (now - selectedAt > 1000) {
        selectedOption = null;
        menuButtons.forEach(button => button.classList.remove('selected'));
      }
    }
  }
  function updateCount() {
    $('#count').innerHTML = `<span class="leaf-total">${collected.size} / ${level.embers.length}</span><span class="leaf-slots" aria-hidden="true">${level.embers.map((_, i) => `<i class="${collected.has(i) ? 'found' : ''}"></i>`).join('')}</span>`;
  }
  function collectibleBurst(x, y) {
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * Math.PI * 2;
      particles.push({ x, y, vx: Math.cos(a) * 34, vy: Math.sin(a) * 25 - 25, age: 0 });
    }
    $('#count').classList.remove('collected');
    void $('#count').offsetWidth;
    $('#count').classList.add('collected');
  }
  game.addEventListener('pointermove', event => {
    if (!['portal', 'menu'].includes(scene) || stream) return;
    pointAt(event.clientX, event.clientY, performance.now(), draggingRing);
  });
  game.addEventListener('pointerleave', () => { $('#finger-light').hidden = true; ring.release(); });

  function drawEmber(x, y, seed) {
    y += Math.sin(time * 2 + seed) * 3;
    ctx.save();
    if (!cached.leafGlow) {
      const glowCanvas = document.createElement('canvas'); glowCanvas.width = glowCanvas.height = 64;
      const gc = glowCanvas.getContext('2d');
      const glow = gc.createRadialGradient(32, 32, 2, 32, 32, 32);
      glow.addColorStop(0, '#e6bd6d99'); glow.addColorStop(1, '#e6bd6d00');
      gc.fillStyle = glow; gc.fillRect(0, 0, 64, 64); cached.leafGlow = glowCanvas;
    }
    ctx.drawImage(cached.leafGlow, x - 32, y - 32);
    ctx.translate(x, y); ctx.rotate(Math.sin(time + seed) * .15);
    ctx.fillStyle = '#396667'; ctx.strokeStyle = '#f4c875'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-2, 11);
    ctx.bezierCurveTo(-17, -1, -9, -12, 10, -15);
    ctx.bezierCurveTo(15, -1, 11, 7, -2, 11);
    ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-5, 16); ctx.quadraticCurveTo(0, -1, 8, -11); ctx.stroke();
    ctx.restore();
  }

  function drawForest() {
    const scale = height / 800;
    const view = width / scale;
    const tile = Math.max(1215, view);
    ctx.save(); ctx.scale(scale, scale);
    const image = backgrounds.forest;
    // Mirrored adjoining plates keep the bank continuous and prevent hard seams.
    const offset = scene === 'playing' ? cameraX : 0;
    if (image) {
      if (!cached.forest) {
        const plate = document.createElement('canvas'); plate.width = Math.ceil(tile); plate.height = 800;
        plate.getContext('2d').drawImage(image, 0, 0, plate.width, 800); cached.forest = plate;
      }
      const start = Math.floor(offset / tile);
      const end = Math.floor((offset + view) / tile);
      for (let i = start; i <= end; i++) {
        const x = i * tile - offset;
        ctx.save();
        if (i % 2) { ctx.translate(x + tile, 0); ctx.scale(-1, 1); }
        else ctx.translate(x, 0);
        ctx.drawImage(cached.forest, 0, 0, tile + 1, 800);
        ctx.restore();
      }
    }
    ctx.translate(-cameraX, 0);
    if (scene === 'tutorial' || scene === 'mission') {
      const x = Math.min(view * .395, 480);
      drawTraveler(ctx, x, 620, 1.15, false, 1);
      drawCat(ctx, x - 48, 620, false, 1, 1.1);
      [80, 145, 205].forEach((dx, i) => drawEmber(x + dx, 565 - i * 13, i));
    } else {
      level.embers.forEach((ember, index) => {
        if (ember.x < cameraX - 40 || ember.x > cameraX + view + 40) return;
        if (!collected.has(index)) drawEmber(ember.x, ember.y, index);
      });
      drawTraveler(ctx, hero.x, hero.y, 1.15, Math.abs(direction()) > 0, hero.face);
      drawCat(ctx, companion.x, companion.y, Math.abs(companion.x - hero.x) > 50, hero.face, 1.1);
    }
    for (const particle of particles) {
      ctx.globalAlpha = Math.max(0, 1 - particle.age / .7);
      ctx.fillStyle = '#e3b768';
      ctx.beginPath(); ctx.arc(particle.x, particle.y, 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    drawSnow(.5);
  }

  function direction() {
    const keyboard = (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) -
      (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0);
    return keyboard || handDirection;
  }

  function update(dt) {
    if (scene !== 'playing') return;
    const move = direction();
    if (move) hero.face = move;
    step(hero, move, dt);
    level.embers.forEach((ember, index) => {
      if (!collected.has(index) && Math.hypot(hero.x - ember.x, hero.y - 42 - ember.y) < 48) {
        collected.add(index);
        updateCount(); collectibleBurst(ember.x, ember.y);
      }
    });
    const visible = width / (height / 800);
    const target = Math.max(0, Math.min(level.width - visible, hero.x - visible * .395));
    cameraX += (target - cameraX) * Math.min(1, dt * 5);
    if (collected.size === 10 && hero.x > 4900) setScene('ending');
    // These DOM values allow QA to read actual game state without changing it.
    companion.x += (hero.x - hero.face * 55 - companion.x) * (1 - Math.exp(-dt * 4));
    companion.y += (hero.y - companion.y) * (1 - Math.exp(-dt * 7));
    characterStride += Math.abs(move) * level.speed * dt;
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]; p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.age > .7) particles.splice(i, 1);
    }
    if (time - lastDiagnostics > .15) {
      game.dataset.playerX = hero.x.toFixed(1); game.dataset.playerY = hero.y.toFixed(1);
      game.dataset.collected = String(collected.size); lastDiagnostics = time;
    }
    if (time - lastSave > 2) { saveGame(); lastSave = time; }
  }

  function render(now) {
    const renderStart = performance.now();
    const dt = Math.min((now - previousFrame) / 1000 || 0, .06);
    previousFrame = now;
    time += dt;
    sceneAge += dt;
    if (scene === 'loading') characterStride += dt * 105;
    displayRing = ring.smooth(dt);
    if (scene === 'portal' && displayRing >= Math.PI * 2 - .09) setScene('menu');
    if (pointer && ['portal', 'menu'].includes(scene)) {
      if (!displayedPointer) displayedPointer = { ...pointer };
      const ease = 1 - Math.exp(-dt * 25);
      displayedPointer.x += (pointer.x - displayedPointer.x) * ease;
      displayedPointer.y += (pointer.y - displayedPointer.y) * ease;
      moveLight($('#finger-light'), displayedPointer.x, displayedPointer.y);
    }
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, width, height);
    if (scene === 'portal') drawPortal();
    else if (scene === 'menu') drawMenu();
    else if (scene === 'loading') drawLoading(dt);
    else if (scene === 'title') { if (sceneAge > 2) setScene('story'); }
    else if (scene === 'story') drawWinter();
    else if (scene !== 'ending') {
      accumulator += dt;
      // Fixed physics steps keep jumping consistent at different frame rates.
      while (accumulator >= 1 / 120) { update(1 / 120); accumulator -= 1 / 120; }
      if (scene !== 'ending') drawForest();
    }
    if (fade > 0) {
      fade = Math.max(0, fade - dt * .9);
      ctx.fillStyle = `rgba(0,0,0,${fade})`;
      ctx.fillRect(0, 0, width, height);
    }
    averageRenderMs = averageRenderMs * .9 + (performance.now() - renderStart) * .1;
    if (time - lastMetrics > 1) {
      game.dataset.renderMs = averageRenderMs.toFixed(2);
      game.dataset.leafCount = String(level.embers.length);
      lastMetrics = time;
    }
    requestAnimationFrame(render);
  }

  function clearInput() { keys.clear(); handDirection = 0; swipeOrigin = null; }
  addEventListener('keydown', (event) => {
    if (event.code === 'Escape') { saveGame(); setScene('menu'); return; }
    if (scene === 'portal') {
      if (event.code === 'Enter') { event.preventDefault(); setScene('menu'); }
      return;
    }
    if (scene === 'menu') {
      if (['ArrowDown', 'ArrowUp'].includes(event.code)) {
        event.preventDefault();
        const available = menuButtons.filter(button => !button.disabled);
        const i = available.indexOf(selectedOption);
        const next = available[(i + (event.code === 'ArrowDown' ? 1 : -1) + available.length) % available.length];
        chooseOption(next); next.focus();
      } else if (event.code === 'Enter' && !(event.target instanceof HTMLButtonElement)) activateOption(selectedOption);
      return;
    }
    if (event.target instanceof HTMLButtonElement && event.code === 'Space') return;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space'].includes(event.code)) event.preventDefault();
    keys.add(event.code);
    if (scene === 'playing' && !event.repeat && ['ArrowUp', 'KeyW', 'Space'].includes(event.code)) jump(hero);
    else if (!event.repeat && ['Enter', 'ArrowRight', 'Space'].includes(event.code)) advance();
  });
  addEventListener('keyup', (event) => keys.delete(event.code));
  addEventListener('blur', clearInput);
  document.addEventListener('visibilitychange', () => { if (document.hidden) clearInput(); });
  for (const button of document.querySelectorAll('[data-key]')) {
    button.onpointerdown = (event) => {
      event.preventDefault(); button.setPointerCapture(event.pointerId);
      keys.add(button.dataset.key);
      if (button.dataset.key === 'Space') jump(hero);
    };
    button.onpointerup = button.onpointercancel = button.onlostpointercapture = () => keys.delete(button.dataset.key);
  }
  let swipeStart = null;
  canvas.addEventListener('pointerdown', (event) => {
    if (scene === 'portal') { draggingRing = true; ring.release(); canvas.setPointerCapture(event.pointerId); pointAt(event.clientX, event.clientY, performance.now(), true); }
    swipeStart = { x: event.clientX, y: event.clientY };
  });
  canvas.addEventListener('pointerup', (event) => {
    if (swipeStart && event.clientX - swipeStart.x > 80 && Math.abs(event.clientY - swipeStart.y) < 100) advance();
    swipeStart = null;
    draggingRing = false; ring.release();
  });
  canvas.addEventListener('pointercancel', () => { draggingRing = false; ring.release(); });

  function stopCamera() {
    cameraGeneration++;
    if (stream) stream.getTracks().forEach(track => track.stop());
    stream = null;
    $('#video').srcObject = null;
    $('#camera-panel').hidden = true;
    $('#camera').title = '开启手势摄像头';
    handDirection = 0;
    handWasPointing = false;
    swipeOrigin = null;
    $('#finger-light').hidden = true; $('#second-light').hidden = true;
    ring.release(); pinch.reset();
  }
  $('#close-camera').onclick = stopCamera;

  $('#camera').onclick = async () => {
    if (cameraBusy) return;
    if (stream) { stopCamera(); return; }
    cameraBusy = true;
    const generation = ++cameraGeneration;
    $('#camera').setAttribute('aria-busy', 'true');
    $('#camera').dataset.error = 'false';
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera unavailable');
      // The game itself does not depend on this optional network import.
      const modelPromise = landmarker ? Promise.resolve(landmarker) : globalThis.FifthSeasonHandTracker.create();
      let timeout;
      try {
        landmarker = await Promise.race([modelPromise, new Promise((_, reject) => {
          timeout = setTimeout(() => reject(new Error('Model download timeout')), 45000);
        })]);
      } finally { clearTimeout(timeout); }
      game.dataset.trackingThread = landmarker.threaded ? 'worker' : 'gpu-fallback';
      if (generation !== cameraGeneration) return;
      const opened = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240, frameRate: { ideal: 24, max: 30 }, facingMode: 'user' }, audio: false });
      if (generation !== cameraGeneration) { opened.getTracks().forEach(track => track.stop()); return; }
      stream = opened;
      $('#video').srcObject = stream;
      await $('#video').play();
      $('#camera-panel').hidden = false;
      $('#camera').title = '关闭手势摄像头';
      game.dataset.trackingThread = landmarker.threaded ? 'worker' : 'gpu-fallback';
      lastHandFrame = -1;
      requestAnimationFrame(detectHands);
    } catch (error) {
      stopCamera();
      const message = error.name === 'NotAllowedError'
        ? '摄像头权限未开启。可以用左右方向键行走、空格跳跃。'
        : '手势模型或摄像头未能开启。可重试，也可用左右方向键行走、空格跳跃。';
      $('#status').textContent = message;
      $('#camera').title = message;
      $('#camera').dataset.error = 'true';
      console.warn('Optional hand control:', error.name, error.message);
    } finally {
      cameraBusy = false;
      $('#camera').setAttribute('aria-busy', 'false');
    }
  };

  async function detectHands(now) {
    if (!stream) return;
    const video = $('#video');
    const generation = cameraGeneration;
    try {
      if (video.currentTime !== lastHandFrame && now - lastDetection > (landmarker.threaded ? 32 : 90)) {
        lastHandFrame = video.currentTime;
        lastDetection = now;
        const hands = await landmarker.detect(video, now);
        if (!stream || generation !== cameraGeneration) return;
        const p = hands[0];
        if (!p || document.hidden) {
          handDirection = 0; handWasPointing = false; swipeOrigin = null;
          $('#hand-indicator').textContent = '·';
          $('#finger-light').hidden = true; $('#second-light').hidden = true;
          pointer = null; displayedPointer = null;
          ring.release(); pinch.reset();
        } else {
          const extended = [8, 12, 16, 20].map(tip =>
            Math.hypot(p[tip].x - p[0].x, p[tip].y - p[0].y) >
            Math.hypot(p[tip - 2].x - p[0].x, p[tip - 2].y - p[0].y) * 1.18);
          const open = extended.every(Boolean);
          const point = extended[0] && !extended[1] && !extended[2] && !extended[3] && p[8].y < p[6].y;
          const x = 1 - (p[0].x + p[9].x) / 2;
          if (['portal', 'menu'].includes(scene)) {
            // Both index tips get a glow; either can select a menu option.
            const pointing = hands.filter(hand =>
              Math.hypot(hand[8].x - hand[0].x, hand[8].y - hand[0].y) >
              Math.hypot(hand[6].x - hand[0].x, hand[6].y - hand[0].y) * 1.12 ||
              Math.hypot(hand[4].x - hand[8].x, hand[4].y - hand[8].y) < .07);
            const primary = pointing[0];
            const closing = hands.some(hand => Math.hypot(hand[4].x - hand[8].x, hand[4].y - hand[8].y) /
              Math.max(.025, Math.hypot(hand[0].x - hand[9].x, hand[0].y - hand[9].y)) < .6);
            if (scene === 'menu' && closing && !pinchLock && selectedOption && now - selectedAt < 1800) {
              pinchLock = selectedOption; pinchLockAt = now;
            }
            if (!closing) pinchLock = null;
            if (primary) {
              pointer = { x: (1 - primary[8].x) * width, y: primary[8].y * height };
              if (!pinchLock || scene === 'portal') pointAt(pointer.x, pointer.y, now, true);
            } else { pointer = null; $('#finger-light').hidden = true; ring.release(); }
            if (pointing[1]) {
              const second = pointing[1];
              const sx = (1 - second[8].x) * width, sy = second[8].y * height;
              moveLight($('#second-light'), sx, sy);
              if (scene === 'menu' && !pinchLock) {
                const button = menuButtons.find(option => {
                  const rect = option.getBoundingClientRect();
                  return sx >= rect.left && sx <= rect.right && sy >= rect.top && sy <= rect.bottom;
                });
                if (button) chooseOption(button);
              }
            } else $('#second-light').hidden = true;
            if (scene === 'menu' && pinch.update(hands, now)) {
              const target = pinchLock && now - pinchLockAt < 2500 ? pinchLock : selectedOption;
              if (target && now - selectedAt < 2500) activateOption(target);
            }
            handDirection = 0;
            requestAnimationFrame(detectHands);
            return;
          }
          handDirection = open ? (x < .38 ? -1 : x > .62 ? 1 : 0) : 0;
          if (point && !handWasPointing && scene === 'playing') jump(hero);
          handWasPointing = point;
          $('#hand-indicator').textContent = point ? '↑' : handDirection < 0 ? '←' : handDirection > 0 ? '→' : '·';
          if (open && swipeOrigin && now - swipeOrigin.time < 900 && x - swipeOrigin.x > .2 && now - lastAdvance > 1300) {
            advance(); lastAdvance = now; swipeOrigin = null;
          } else if (open && (!swipeOrigin || now - swipeOrigin.time > 900)) {
            swipeOrigin = { x, time: now };
          }
          if (!open) swipeOrigin = null;
        }
      }
    } catch (error) {
      stopCamera(); $('#camera').dataset.error = 'true';
      return;
    }
    requestAnimationFrame(detectHands);
  }
  addEventListener('pagehide', () => { saveGame(); stopCamera(); });

  function loadImage(name) {
    return new Promise(resolve => {
      const image = new Image();
      image.onload = () => { backgrounds[name] = image; resolve(); };
      image.onerror = () => { console.error('Missing background:', name); resolve(); };
      image.src = `assets/${name}.png`;
    });
  }
  const fontReady = document.fonts.load('32px Palmetto').then(fonts => {
    game.dataset.fontLoaded = String(fonts.length > 0);
  }).catch(() => { game.dataset.fontLoaded = 'false'; });
  Promise.all([loadImage('forest'), loadImage('winter'), loadImage('ring'), loadImage('menu'), loadImage('characters'), fontReady]).then(() => { assetsReady = true; });
  // Never leave the loading bar permanently blocked by a font or asset request.
  setTimeout(() => { assetsReady = true; }, 6000);
  requestAnimationFrame(render);
})();
