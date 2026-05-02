/* ============================================================================
   NEBULA STRIKE — Retro Space Shooter
   Runtime/gameplay glue file.
   Shared constants are in js/constants.js
   Shared utilities are in js/utils.js
   Audio system is in js/audio.js
============================================================================ */

// Canvas layers, bloom, nebula, getSprite: js/canvas_boot.js

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
    campaignWon: false,

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
  document.getElementById('victory-screen').classList.add('hidden');
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
  document.getElementById('victory-screen').classList.add('hidden');
  document.getElementById('pause-screen').classList.add('hidden');
  lastTime = performance.now();
  if (!sfx.isMuted()) sfx.startBgm('play');
  animFrame = requestAnimationFrame(loop);
}

function fillEndStats(statsEl, waveLabel = 'WAVE REACHED') {
  const accuracy = state.shotsFired > 0 ? Math.round((state.shotsHit / state.shotsFired) * 100) : 0;
  statsEl.innerHTML = `
    <div class="label">SCORE</div><div class="value">${state.score}</div>
    <div class="label">${waveLabel}</div><div class="value">${state.wave || 1}</div>
    <div class="label">ENEMIES KILLED</div><div class="value">${state.enemiesKilled}</div>
    <div class="label">ACCURACY</div><div class="value">${accuracy}%</div>
    <div class="label">LONGEST COMBO</div><div class="value">${state.maxCombo}</div>
  `;
}

function endGame() {
  state.running = false;
  state.campaignWon = false;
  sfx.gameOver();
  sfx.stopBgm();
  cancelAnimationFrame(animFrame);

  const isNew = state.score > state.highscore;
  if (isNew) {
    state.highscore = state.score;
    saveHighscore(state.highscore);
  }
  fillEndStats(document.getElementById('stats'));
  const hi = document.getElementById('go-highscore');
  hi.textContent = `High Score: ${state.highscore}` + (isNew ? '   ★ NEW RECORD ★' : '');
  hi.classList.toggle('new-record', isNew);
  document.getElementById('go-title').textContent = isNew ? 'NEW HIGH SCORE!' : 'GAME OVER';
  document.getElementById('game-over-screen').classList.remove('hidden');
}

function winGame() {
  state.running = false;
  state.campaignWon = true;
  sfx.stopBgm();
  cancelAnimationFrame(animFrame);

  const isNew = state.score > state.highscore;
  if (isNew) {
    state.highscore = state.score;
    saveHighscore(state.highscore);
  }
  fillEndStats(document.getElementById('victory-stats'), 'FINAL WAVE');
  const vhi = document.getElementById('victory-highscore');
  vhi.textContent = `High Score: ${state.highscore}` + (isNew ? '   ★ NEW RECORD ★' : '');
  vhi.classList.toggle('new-record', isNew);
  document.getElementById('victory-screen').classList.remove('hidden');
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
  state.campaignWon = false;
  cancelAnimationFrame(animFrame);
  sfx.stopBgm();
  document.getElementById('pause-screen').classList.add('hidden');
  document.getElementById('victory-screen').classList.add('hidden');
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
state = initState();

document.getElementById('start-highscore').textContent = `High Score: ${state.highscore}`;
document.getElementById('start-btn').addEventListener('click', showDifficultyScreen);
document.getElementById('restart-btn').addEventListener('click', showDifficultyScreen);
document.getElementById('victory-menu-btn').addEventListener('click', () => {
  document.getElementById('victory-screen').classList.add('hidden');
  document.getElementById('start-screen').classList.remove('hidden');
  document.getElementById('start-highscore').textContent = `High Score: ${loadHighscore()}`;
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
});
document.getElementById('victory-play-btn').addEventListener('click', showDifficultyScreen);
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
