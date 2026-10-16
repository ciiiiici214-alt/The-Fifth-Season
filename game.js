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
  let scene = 'loading';
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

  function resize() {
    width = Math.max(1, innerWidth);
    height = Math.max(1, innerHeight);
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
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
    for (const name of ['loading', 'title', 'story', 'tutorial', 'mission', 'ending']) {
      $('#' + name).hidden = name !== next;
    }
    $('#next').hidden = !['story', 'tutorial', 'mission'].includes(next);
    $('#camera').hidden = ['loading', 'title', 'ending'].includes(next);
    $('#count').hidden = next !== 'playing';
    $('#touch').hidden = next !== 'playing';
    if (next === 'playing') {
      Object.assign(hero, { x: 450, y: level.ground, vy: 0, grounded: true, face: 1 });
      cameraX = 0;
      collected.clear();
      $('#count').textContent = '0 / 10';
    }
    if (next === 'ending') stopCamera();
  }

  function advance() {
    if (sceneAge < .65) return;
    if (scene === 'title') setScene('story');
    else if (scene === 'story') setScene('tutorial');
    else if (scene === 'tutorial') setScene('mission');
    else if (scene === 'mission') setScene('playing');
  }
  $('#next').onclick = advance;
  $('#restart').onclick = () => setScene('playing');
  canvas.addEventListener('click', advance);

  function shape(c, points, fill) {
    c.beginPath();
    points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
    c.closePath();
    c.fillStyle = fill;
    c.fill();
  }

  function drawTraveler(c, x, y, scale, moving, facing, light = false) {
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

  function drawCat(c, x, y) {
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
    progress = Math.min(target, progress + dt * (assetsReady ? .6 : .27));
    $('#load-fill').style.width = `${progress * 100}%`;
    $('#walkers').style.left = `${Math.max(.045, progress) * 100}%`;
    const c = $('#walkers').getContext('2d');
    c.clearRect(0, 0, 240, 130);
    drawTraveler(c, 206, 128, 1.25, true, 1, true);
    drawCat(c, 133, 128);
    if (progress >= 1 && sceneAge > 2.5) setScene('title');
  }

  const random = (seed) => {
    const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
    return value - Math.floor(value);
  };

  function drawSnow(strength) {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;
    ctx.save();
    for (let i = 0; i < (strength > 1 ? 150 : 55); i++) {
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

  function drawEmber(x, y, seed) {
    y += Math.sin(time * 2 + seed) * 3;
    ctx.save();
    const glow = ctx.createRadialGradient(x, y, 0, x, y, 23);
    glow.addColorStop(0, '#fffffbc0');
    glow.addColorStop(.25, '#fffffb60');
    glow.addColorStop(1, '#fffffb00');
    ctx.fillStyle = glow; ctx.fillRect(x - 23, y - 23, 46, 46);
    ctx.translate(x, y); ctx.rotate(Math.sin(time + seed) * .15);
    ctx.fillStyle = '#fffffc';
    ctx.beginPath();
    ctx.moveTo(0, 3);
    ctx.bezierCurveTo(-4, 0, -11, -9, -8, -10);
    ctx.quadraticCurveTo(-3, -9, 0, -4);
    ctx.quadraticCurveTo(4, -13, 9, -11);
    ctx.quadraticCurveTo(9, -2, 0, 3);
    ctx.fill();
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
      const start = Math.floor(offset / tile);
      for (let i = start; i <= start + 2; i++) {
        const x = i * tile - offset;
        ctx.save();
        if (i % 2) { ctx.translate(x + tile, 0); ctx.scale(-1, 1); }
        else ctx.translate(x, 0);
        ctx.drawImage(image, 0, 0, tile + 1, 800);
        ctx.restore();
      }
    }
    ctx.translate(-cameraX, 0);
    if (scene === 'tutorial' || scene === 'mission') {
      const x = Math.min(view * .395, 480);
      drawTraveler(ctx, x, 620, 1.15, false, 1);
      [80, 145, 205].forEach((dx, i) => drawEmber(x + dx, 565 - i * 13, i));
    } else {
      level.embers.forEach((ember, index) => {
        if (!collected.has(index)) drawEmber(ember.x, ember.y, index);
      });
      drawTraveler(ctx, hero.x, hero.y, 1.15, Math.abs(direction()) > 0, hero.face);
    }
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
      if (!collected.has(index) && Math.hypot(hero.x - ember.x, hero.y - 42 - ember.y) < 40) {
        collected.add(index);
        $('#count').textContent = `${collected.size} / 10`;
      }
    });
    const visible = width / (height / 800);
    const target = Math.max(0, Math.min(level.width - visible, hero.x - visible * .395));
    cameraX += (target - cameraX) * Math.min(1, dt * 5);
    if (collected.size === 10 && hero.x > 4900) setScene('ending');
    // These DOM values allow QA to read actual game state without changing it.
    game.dataset.playerX = hero.x.toFixed(1);
    game.dataset.playerY = hero.y.toFixed(1);
    game.dataset.collected = String(collected.size);
  }

  function render(now) {
    const dt = Math.min((now - previousFrame) / 1000 || 0, .06);
    previousFrame = now;
    time += dt;
    sceneAge += dt;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, width, height);
    if (scene === 'loading') drawLoading(dt);
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
    requestAnimationFrame(render);
  }

  function clearInput() { keys.clear(); handDirection = 0; swipeOrigin = null; }
  addEventListener('keydown', (event) => {
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
  canvas.addEventListener('pointerdown', (event) => { swipeStart = { x: event.clientX, y: event.clientY }; });
  canvas.addEventListener('pointerup', (event) => {
    if (swipeStart && event.clientX - swipeStart.x > 80 && Math.abs(event.clientY - swipeStart.y) < 100) advance();
    swipeStart = null;
  });

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
      const modelPromise = (async () => {
        if (landmarker) return landmarker;
        const { HandLandmarker, FilesetResolver } = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/vision_bundle.mjs');
        const files = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm');
        return HandLandmarker.createFromOptions(files, {
          baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task' },
          runningMode: 'VIDEO', numHands: 1
        });
      })();
      let timeout;
      try {
        landmarker = await Promise.race([modelPromise, new Promise((_, reject) => {
          timeout = setTimeout(() => reject(new Error('Model download timeout')), 25000);
        })]);
      } finally { clearTimeout(timeout); }
      if (generation !== cameraGeneration) return;
      const opened = await navigator.mediaDevices.getUserMedia({ video: { width: 480, height: 360, facingMode: 'user' }, audio: false });
      if (generation !== cameraGeneration) { opened.getTracks().forEach(track => track.stop()); return; }
      stream = opened;
      $('#video').srcObject = stream;
      await $('#video').play();
      $('#camera-panel').hidden = false;
      $('#camera').title = '关闭手势摄像头';
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

  function detectHands(now) {
    if (!stream) return;
    const video = $('#video');
    try {
      if (video.currentTime !== lastHandFrame && now - lastDetection > 65) {
        lastHandFrame = video.currentTime;
        lastDetection = now;
        const p = landmarker.detectForVideo(video, now).landmarks[0];
        if (!p || document.hidden) {
          handDirection = 0; handWasPointing = false; swipeOrigin = null;
          $('#hand-indicator').textContent = '·';
        } else {
          const extended = [8, 12, 16, 20].map(tip =>
            Math.hypot(p[tip].x - p[0].x, p[tip].y - p[0].y) >
            Math.hypot(p[tip - 2].x - p[0].x, p[tip - 2].y - p[0].y) * 1.18);
          const open = extended.every(Boolean);
          const point = extended[0] && !extended[1] && !extended[2] && !extended[3] && p[8].y < p[6].y;
          const x = 1 - (p[0].x + p[9].x) / 2;
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
  addEventListener('pagehide', stopCamera);

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
  Promise.all([loadImage('forest'), loadImage('winter'), fontReady]).then(() => { assetsReady = true; });
  // Never leave the loading bar permanently blocked by a font or asset request.
  setTimeout(() => { assetsReady = true; }, 6000);
  requestAnimationFrame(render);
})();
