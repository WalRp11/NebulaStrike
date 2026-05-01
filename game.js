/* ============================================================================
   NEBULA STRIKE — Retro Space Shooter
   Runtime/gameplay glue file.
   Shared constants are in js/constants.js
   Shared utilities are in js/utils.js
   Audio system is in js/audio.js
============================================================================ */

// ═══ 4. Canvas, Layers & Sprite Cache ═════════════════════════════════════
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = CANVAS_W;
canvas.height = CANVAS_H;

// Offscreen world canvas for post-FX bloom
const worldCanvas = document.createElement('canvas');
worldCanvas.width = CANVAS_W;
worldCanvas.height = CANVAS_H;
const wctx = worldCanvas.getContext('2d');

// Bloom buffer (downscaled)
const BLOOM_DIV = 4;
const bloomCanvas = document.createElement('canvas');
bloomCanvas.width = CANVAS_W / BLOOM_DIV;
bloomCanvas.height = CANVAS_H / BLOOM_DIV;
const bctx = bloomCanvas.getContext('2d');

// Static background canvas (nebula + far stars), redrawn on init
const bgCanvas = document.createElement('canvas');
bgCanvas.width = CANVAS_W;
bgCanvas.height = CANVAS_H * 2; // tile vertically for parallax loop
const bgctx = bgCanvas.getContext('2d');

// Sprite cache for enemy archetypes
const spriteCache = new Map();
function getSprite(key, w, h, drawFn) {
  if (spriteCache.has(key)) return spriteCache.get(key);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  drawFn(c.getContext('2d'), w, h);
  spriteCache.set(key, c);
  return c;
}

// ═══ 5. Background ════════════════════════════════════════════════════════
function paintNebulaBackground() {
  const g = bgctx;
  // Deep space gradient
  const grad = g.createLinearGradient(0, 0, 0, bgCanvas.height);
  grad.addColorStop(0, '#02021a');
  grad.addColorStop(0.5, '#06031c');
  grad.addColorStop(1, '#020010');
  g.fillStyle = grad;
  g.fillRect(0, 0, bgCanvas.width, bgCanvas.height);

  // Nebula clouds — soft radial blobs, additive
  g.globalCompositeOperation = 'screen';
  const nebulaColors = [
    'rgba(80, 0, 120, 0.55)',
    'rgba(0, 60, 140, 0.55)',
    'rgba(120, 0, 80, 0.45)',
    'rgba(30, 80, 180, 0.40)',
    'rgba(160, 40, 200, 0.35)',
  ];
  for (let i = 0; i < 22; i++) {
    const cx = rand(0, bgCanvas.width);
    const cy = rand(0, bgCanvas.height);
    const r  = rand(180, 480);
    const col = choose(nebulaColors);
    const rg = g.createRadialGradient(cx, cy, 0, cx, cy, r);
    rg.addColorStop(0, col);
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg;
    g.beginPath();
    g.arc(cx, cy, r, 0, TAU);
    g.fill();
  }

  // Distant tiny stars (deepest layer — embedded in bg so don't move with parallax layers)
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 600; i++) {
    const x = rand(0, bgCanvas.width);
    const y = rand(0, bgCanvas.height);
    const r = rand(0.3, 1.2);
    const a = rand(0.3, 0.9);
    g.fillStyle = `rgba(${randi(180,255)}, ${randi(200,255)}, 255, ${a})`;
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  }

  // Distant planet
  for (let i = 0; i < 2; i++) {
    const px = rand(120, bgCanvas.width - 120);
    const py = rand(80, bgCanvas.height - 80);
    const pr = rand(35, 70);
    const hue = randi(180, 340);
    const pg = g.createRadialGradient(px - pr * 0.4, py - pr * 0.4, pr * 0.1, px, py, pr);
    pg.addColorStop(0, `hsla(${hue}, 70%, 70%, 0.9)`);
    pg.addColorStop(0.5, `hsla(${hue}, 60%, 35%, 0.85)`);
    pg.addColorStop(1, `hsla(${hue}, 80%, 8%, 0.95)`);
    g.fillStyle = pg;
    g.beginPath(); g.arc(px, py, pr, 0, TAU); g.fill();
    // Glow halo
    const hg = g.createRadialGradient(px, py, pr, px, py, pr * 2.2);
    hg.addColorStop(0, `hsla(${hue}, 80%, 60%, 0.18)`);
    hg.addColorStop(1, `hsla(${hue}, 80%, 60%, 0)`);
    g.fillStyle = hg;
    g.beginPath(); g.arc(px, py, pr * 2.2, 0, TAU); g.fill();
  }

  g.globalCompositeOperation = 'source-over';
}

function generateStars(n, speedMin, speedMax, size) {
  return Array.from({ length: n }, () => ({
    x: rand(0, CANVAS_W),
    y: rand(0, CANVAS_H),
    r: rand(size * 0.5, size),
    speed: rand(speedMin, speedMax),
    bright: rand(0.4, 1.0),
    twinkle: rand(0, TAU),
  }));
}

// ═══ 6. Input ═════════════════════════════════════════════════════════════
const input = {
  keys: {},
  mouseX: CANVAS_W / 2,
  mouseY: CANVAS_H - 80,
  useMouse: false,
  mouseDown: false,
  rightClick: false,
};

window.addEventListener('keydown', e => {
  if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  input.keys[e.code] = true;
  if (e.code === 'KeyM') {
    const muted = sfx.toggleMute();
    document.getElementById('mute-btn').textContent = muted ? '🔇' : '🔊';
    if (!muted && state.running) sfx.startBgm(state.bossActive ? 'boss' : 'play');
  }
  if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
  if (e.code === 'KeyC') toggleCRT();
  if (e.code === 'KeyB' && state.running && !state.paused) triggerBomb();
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
    if (state.running && !state.paused) triggerDash();
  }
  if (/^Digit[1-8]$/.test(e.code) && state.running && !state.paused) {
    const slot = parseInt(e.code.slice(5), 10) - 1;
    toggleWeaponSlot(slot);
  }
});
window.addEventListener('keyup', e => { input.keys[e.code] = false; });

canvas.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  const sx = canvas.width / rect.width;
  const sy = canvas.height / rect.height;
  input.mouseX = (e.clientX - rect.left) * sx;
  input.mouseY = (e.clientY - rect.top) * sy;
  input.useMouse = true;
});
canvas.addEventListener('mousedown', e => {
  if (e.button === 0) input.mouseDown = true;
  if (e.button === 2) { input.rightClick = true; if (state.running && !state.paused) triggerBomb(); }
});
canvas.addEventListener('mouseup', e => {
  if (e.button === 0) input.mouseDown = false;
  if (e.button === 2) input.rightClick = false;
});
canvas.addEventListener('contextmenu', e => e.preventDefault());

// ═══ 7. State ═════════════════════════════════════════════════════════════
let state = {};
let animFrame = null;
let lastTime = 0;
let crtOn = true;

function loadHighscore() {
  try { return parseInt(localStorage.getItem(HIGHSCORE_KEY) || '0', 10) || 0; }
  catch (e) { return 0; }
}
function saveHighscore(v) {
  try { localStorage.setItem(HIGHSCORE_KEY, String(v)); } catch (e) {}
}

function initState() {
  return {
    running: false,
    paused: false,
    difficulty: 'normal',  // difficulty mode
    difficultyMultipliers: DIFFICULTY_MODES.normal,
    score: 0,
    highscore: loadHighscore(),
    wave: 0,
    waveActive: false,
    waveQueue: [],          // pending spawns for current wave
    waveSpawnTimer: 0,
    waveBannerTime: 0,
    waveBannerText: '',
    interWaveTimer: 0,
    bossActive: false,
    boss: null,

    lives: 3,
    weaponTier: 0,
    weaponLoadout: ['pulse'],
    weaponEnabled: { pulse: true },
    weaponCooldowns: {},
    multiWeaponCount: 1,  // how many weapons can fire simultaneously
    chargeStart: 0,
    charging: false,

    gameSpeed: 1.0,
    shake: 0,
    flash: 0,             // 0..1 white flash
    flashColor: '#ffffff',

    combo: 0,
    comboTimer: 0,
    comboTier: 0,
    maxCombo: 0,

    bombs: 2,
    dashes: 2,
    dashActive: 0,        // remaining ms of dash burst
    dashIframes: 0,
    dashDir: { x: 0, y: 0 },

    shotsFired: 0,
    shotsHit: 0,
    enemiesKilled: 0,

    player: {
      x: CANVAS_W / 2, y: CANVAS_H - 100,
      w: 44, h: 54,
      vx: 0, vy: 0,
      invincible: 0,
      armor: 0, maxArmor: 100,
      speedLevel: 0,
      trailTimer: 0,
    },

    bullets: [],
    enemyBullets: [],
    enemies: [],
    meteors: [],
    particles: [],
    afterimages: [],
    pickups: [],
    floatingTexts: [],

    starsFar: generateStars(80, 0.15, 0.45, 0.9),
    starsMid: generateStars(60, 0.5, 1.0,  1.3),
    starsNear:generateStars(35, 1.2, 2.4,  1.9),
    bgScroll: 0,
  };
}

// Gameplay/update systems are loaded from:
// - js/player_combat.js
// - js/enemies_bosses.js
// - js/pickups_effects.js
// - js/update_loop.js
// Draw pipeline is loaded from js/rendering.js.

// ═══ 18. Game flow ════════════════════════════════════════════════════════
function showDifficultyScreen() {
  document.getElementById('start-screen').classList.add('hidden');
  document.getElementById('game-over-screen').classList.add('hidden');
  document.getElementById('difficulty-screen').classList.remove('hidden');
}

function startGame() {
  state = initState();
  // Preserve difficulty and multipliers set by difficulty screen
  if (state.difficulty && DIFFICULTY_MODES[state.difficulty]) {
    state.difficultyMultipliers = DIFFICULTY_MODES[state.difficulty];
  }
  state.running = true;
  state.interWaveTimer = 1200;
  document.getElementById('start-screen').classList.add('hidden');
  document.getElementById('difficulty-screen').classList.add('hidden');
  document.getElementById('game-over-screen').classList.add('hidden');
  document.getElementById('pause-screen').classList.add('hidden');
  lastTime = performance.now();
  if (!sfx.isMuted()) sfx.startBgm('play');
  animFrame = requestAnimationFrame(loop);
}

function endGame() {
  state.running = false;
  sfx.gameOver();
  sfx.stopBgm();
  cancelAnimationFrame(animFrame);

  const isNew = state.score > state.highscore;
  if (isNew) {
    state.highscore = state.score;
    saveHighscore(state.highscore);
  }
  const accuracy = state.shotsFired > 0 ? Math.round((state.shotsHit / state.shotsFired) * 100) : 0;
  const stats = document.getElementById('stats');
  stats.innerHTML = `
    <div class="label">SCORE</div><div class="value">${state.score}</div>
    <div class="label">WAVE REACHED</div><div class="value">${state.wave || 1}</div>
    <div class="label">ENEMIES KILLED</div><div class="value">${state.enemiesKilled}</div>
    <div class="label">ACCURACY</div><div class="value">${accuracy}%</div>
    <div class="label">LONGEST COMBO</div><div class="value">${state.maxCombo}</div>
  `;
  const hi = document.getElementById('go-highscore');
  hi.textContent = `High Score: ${state.highscore}` + (isNew ? '   ★ NEW RECORD ★' : '');
  hi.classList.toggle('new-record', isNew);
  document.getElementById('go-title').textContent = isNew ? 'NEW HIGH SCORE!' : 'GAME OVER';
  document.getElementById('game-over-screen').classList.remove('hidden');
}

function togglePause() {
  if (!state.running) return;
  state.paused = !state.paused;
  if (state.paused) {
    cancelAnimationFrame(animFrame);
    document.getElementById('pause-screen').classList.remove('hidden');
    sfx.stopBgm();
  } else {
    document.getElementById('pause-screen').classList.add('hidden');
    lastTime = performance.now();
    animFrame = requestAnimationFrame(loop);
    if (!sfx.isMuted()) sfx.startBgm(state.bossActive ? 'boss' : 'play');
  }
}

function quitToMenu() {
  state.running = false;
  state.paused = false;
  cancelAnimationFrame(animFrame);
  sfx.stopBgm();
  document.getElementById('pause-screen').classList.add('hidden');
  document.getElementById('difficulty-screen').classList.add('hidden');
  document.getElementById('start-screen').classList.remove('hidden');
  document.getElementById('start-highscore').textContent = `High Score: ${loadHighscore()}`;
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
}

function toggleCRT() {
  crtOn = !crtOn;
  document.getElementById('crt-overlay').classList.toggle('off', !crtOn);
}

function loop(timestamp) {
  if (!state.running || state.paused) return;
  const dt = Math.min(50, timestamp - lastTime);
  lastTime = timestamp;
  update(dt, timestamp);
  draw();
  animFrame = requestAnimationFrame(loop);
}

// ── Init
paintNebulaBackground();
state = initState();

document.getElementById('start-highscore').textContent = `High Score: ${state.highscore}`;
document.getElementById('start-btn').addEventListener('click', showDifficultyScreen);
document.getElementById('restart-btn').addEventListener('click', showDifficultyScreen);
document.getElementById('resume-btn').addEventListener('click', togglePause);
document.getElementById('quit-btn').addEventListener('click', quitToMenu);
document.getElementById('pause-btn').addEventListener('click', togglePause);
document.getElementById('crt-btn').addEventListener('click', toggleCRT);
document.getElementById('mute-btn').addEventListener('click', () => {
  const muted = sfx.toggleMute();
  document.getElementById('mute-btn').textContent = muted ? '🔇' : '🔊';
  if (!muted && state.running) sfx.startBgm(state.bossActive ? 'boss' : 'play');
});

// Difficulty screen button listeners
document.querySelectorAll('.difficulty-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const difficulty = btn.dataset.difficulty;
    state.difficulty = difficulty;
    state.difficultyMultipliers = DIFFICULTY_MODES[difficulty];
    startGame();
  });
});

// Show a static title-screen background
(function paintTitleBg() {
  wctx.setTransform(1, 0, 0, 1, 0, 0);
  drawBackground();
  applyBloomToMain();
})();
