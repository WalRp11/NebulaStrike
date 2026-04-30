/* ============================================================================
   NEBULA STRIKE — Retro Space Shooter
   Single-file vanilla JS. Sections:
     1. Constants & Config
     2. Utilities (math, rng, pools)
     3. Audio (SFX + procedural BGM)
     4. Canvas, Layers & Sprite Cache
     5. Background (parallax stars, nebula, planets)
     6. Input
     7. State
     8. Player
     9. Bullets, Enemy Bullets, Rockets
    10. Enemy Archetypes & Spawning
    11. Wave Director & Bosses
    12. Pickups
    13. Particles, Trails, Floating Text, Screen Shake
    14. Update & Collisions
    15. Draw (entities, post-fx, HUD)
    16. Game flow (start/pause/end/loop)
============================================================================ */

// ═══ 1. Constants & Config ════════════════════════════════════════════════
const CANVAS_W = 1000;
const CANVAS_H = 1200;
const PLAYER_SPEED = 9;
const HIGHSCORE_KEY = 'nebulastrike_highscore_v1';

const WEAPONS = [
  { name: 'Pulse',       color: '#00ffff', speed: 12, damage: 1,    type: 'bullet', cooldown: 160, scoreNeeded: 0 },
  { name: 'Twin Pulse',  color: '#ffff00', speed: 13, damage: 1,    type: 'double', cooldown: 150, scoreNeeded: 700 },
  { name: 'Spread',      color: '#00ff88', speed: 12, damage: 1,    type: 'spread', cooldown: 140, scoreNeeded: 1800 },
  { name: 'Laser',       color: '#ff4444', speed: 20, damage: 3,    type: 'laser',  cooldown: 110, scoreNeeded: 3500 },
  { name: 'Rockets',     color: '#ff8800', speed: 7,  damage: 8,    type: 'rocket', cooldown: 230, scoreNeeded: 6000 },
  { name: 'Plasma Beam', color: '#ff00ff', speed: 22, damage: 0.45, type: 'beam',   cooldown: 18,  scoreNeeded: 9500 },
];

const COMBO_WINDOW   = 2200;     // ms
const COMBO_TIERS    = [1, 2, 3, 4, 5, 6, 8];
const MAX_BOMBS      = 5;
const MAX_DASH       = 3;
const DASH_DURATION  = 220;      // ms
const DASH_IFRAMES   = 360;      // ms
const CHARGE_FULL_MS = 900;      // hold-to-charge
const SHAKE_DECAY    = 0.86;
const PARTICLE_CAP   = 600;

// ═══ 2. Utilities ═════════════════════════════════════════════════════════
const TAU = Math.PI * 2;
const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const randi = (a, b) => Math.floor(rand(a, b));
const choose = arr => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;
const dist2 = (ax, ay, bx, by) => { const dx=ax-bx, dy=ay-by; return dx*dx+dy*dy; };
function angleDiff(a, b) {
  let d = a - b;
  while (d < -Math.PI) d += TAU;
  while (d >  Math.PI) d -= TAU;
  return d;
}

// Lightweight pool factory
function makePool(create, reset) {
  const free = [];
  return {
    acquire(...args) {
      const o = free.pop() || create();
      reset(o, ...args);
      return o;
    },
    release(o) { free.push(o); },
    size: () => free.length,
  };
}

// ═══ 3. Audio ═════════════════════════════════════════════════════════════
const sfx = (() => {
  let _ctx = null;
  let muted = false;
  let masterGain = null;
  let bgmGain = null;
  let bgmTimer = null;
  let bgmStep = 0;
  let bgmMode = 'menu';

  function getCtx() {
    if (!_ctx) {
      try {
        _ctx = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = _ctx.createGain();
        masterGain.gain.value = 0.9;
        masterGain.connect(_ctx.destination);
        bgmGain = _ctx.createGain();
        bgmGain.gain.value = 0.0;
        bgmGain.connect(masterGain);
      } catch(e) { return null; }
    }
    if (_ctx.state === 'suspended') _ctx.resume();
    return _ctx;
  }

  function tone({ freq = 440, type = 'square', duration = 0.1, volume = 0.3, freqEnd, attack = 0.005, dest }) {
    const ac = getCtx();
    if (!ac || muted) return;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain);
    gain.connect(dest || masterGain);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ac.currentTime);
    if (freqEnd !== undefined)
      osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), ac.currentTime + duration);
    gain.gain.setValueAtTime(0.0001, ac.currentTime);
    gain.gain.linearRampToValueAtTime(volume, ac.currentTime + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + duration);
    osc.start(ac.currentTime);
    osc.stop(ac.currentTime + duration + 0.02);
  }

  function noise({ duration = 0.2, volume = 0.3, lowpass = 1000, highpass }) {
    const ac = getCtx();
    if (!ac || muted) return;
    const bufSize = Math.floor(ac.sampleRate * duration);
    const buf = ac.createBuffer(1, bufSize, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource();
    src.buffer = buf;
    let node = src;
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(lowpass, ac.currentTime);
    lp.frequency.exponentialRampToValueAtTime(50, ac.currentTime + duration);
    node.connect(lp); node = lp;
    if (highpass) {
      const hp = ac.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = highpass;
      node.connect(hp); node = hp;
    }
    const gain = ac.createGain();
    gain.gain.setValueAtTime(volume, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + duration);
    node.connect(gain);
    gain.connect(masterGain);
    src.start();
    src.stop(ac.currentTime + duration + 0.02);
  }

  // ─── Procedural BGM ────────────────────────────────────
  // Two patterns: 'play' (atmospheric arpeggio) and 'boss' (driving menace)
  const PATTERNS = {
    play: {
      bpm: 110,
      bass:  [55, 0, 55, 0, 73, 0, 65, 0],            // A1, D2, C2 vibe
      arp:   [220, 277, 330, 415, 277, 330, 415, 277],
      pad:   110,
    },
    boss: {
      bpm: 140,
      bass:  [49, 49, 0, 49, 55, 0, 49, 0],
      arp:   [196, 233, 261, 329, 392, 329, 261, 233],
      pad:   98,
    },
  };

  function bgmStepTick() {
    const ac = getCtx();
    if (!ac) return;
    if (muted) return;
    const p = PATTERNS[bgmMode] || PATTERNS.play;
    const idx = bgmStep % p.bass.length;
    const stepDur = 60 / p.bpm / 2; // 8th notes

    // Bass
    const bf = p.bass[idx];
    if (bf) tone({ freq: bf, type: 'triangle', duration: stepDur * 0.9, volume: 0.16, dest: bgmGain, attack: 0.01 });

    // Arp
    const af = p.arp[idx];
    if (af) tone({ freq: af, type: 'square', duration: stepDur * 0.45, volume: 0.045, dest: bgmGain, attack: 0.005 });

    // Pad on downbeats
    if (idx % 8 === 0 && p.pad) {
      tone({ freq: p.pad,     type: 'sine', duration: stepDur * 7, volume: 0.04, dest: bgmGain, attack: 0.4 });
      tone({ freq: p.pad * 1.5,type: 'sine', duration: stepDur * 7, volume: 0.03, dest: bgmGain, attack: 0.4 });
    }

    // Boss kick
    if (bgmMode === 'boss' && idx % 2 === 0) {
      tone({ freq: 80, freqEnd: 35, type: 'sine', duration: 0.08, volume: 0.18, dest: bgmGain });
    }

    bgmStep++;
    bgmTimer = setTimeout(bgmStepTick, stepDur * 1000);
  }

  function startBgm(mode = 'play') {
    bgmMode = mode;
    const ac = getCtx();
    if (!ac) return;
    if (bgmTimer) return;
    bgmStep = 0;
    bgmGain.gain.cancelScheduledValues(ac.currentTime);
    bgmGain.gain.setValueAtTime(0.0001, ac.currentTime);
    bgmGain.gain.linearRampToValueAtTime(0.6, ac.currentTime + 1.2);
    bgmStepTick();
  }
  function stopBgm() {
    if (bgmTimer) { clearTimeout(bgmTimer); bgmTimer = null; }
    const ac = getCtx();
    if (ac && bgmGain) {
      bgmGain.gain.cancelScheduledValues(ac.currentTime);
      bgmGain.gain.linearRampToValueAtTime(0.0001, ac.currentTime + 0.4);
    }
  }
  function setBgmMode(mode) {
    if (mode === bgmMode) return;
    bgmMode = mode;
  }

  return {
    shoot(type = 'bullet') {
      if (type === 'beam') tone({ freq: 1100, freqEnd: 700, type: 'sawtooth', duration: 0.05, volume: 0.05 });
      else if (type === 'laser') tone({ freq: 800, freqEnd: 280, type: 'sawtooth', duration: 0.1, volume: 0.14 });
      else if (type === 'rocket') {
        noise({ duration: 0.18, volume: 0.16, lowpass: 400 });
        tone({ freq: 130, freqEnd: 60, type: 'sawtooth', duration: 0.18, volume: 0.1 });
      } else tone({ freq: 980, freqEnd: 420, type: 'square', duration: 0.06, volume: 0.11 });
    },
    enemyExplode() { noise({ duration: 0.35, volume: 0.32, lowpass: 900 }); tone({ freq: 200, freqEnd: 40, type: 'sawtooth', duration: 0.3, volume: 0.15 }); },
    bigExplode() { noise({ duration: 0.6, volume: 0.45, lowpass: 1200 }); tone({ freq: 110, freqEnd: 30, type: 'sawtooth', duration: 0.5, volume: 0.22 }); },
    meteorExplode() { noise({ duration: 0.22, volume: 0.24, lowpass: 500 }); tone({ freq: 100, freqEnd: 30, type: 'sawtooth', duration: 0.18, volume: 0.1 }); },
    playerHit() { noise({ duration: 0.18, volume: 0.28, lowpass: 700 }); tone({ freq: 220, freqEnd: 80, type: 'square', duration: 0.22, volume: 0.28 }); },
    weaponUpgrade() { [523,659,784,1047].forEach((f,i)=>setTimeout(()=>tone({freq:f,type:'square',duration:0.14,volume:0.16}),i*85)); },
    powerUp() { tone({ freq: 440, freqEnd: 880, type: 'sine', duration: 0.22, volume: 0.2 }); },
    speedUp() { [660,880,1320].forEach((f,i)=>setTimeout(()=>tone({freq:f,type:'sawtooth',duration:0.1,volume:0.13}),i*60)); },
    enemyShoot() { tone({ freq: 280, freqEnd: 180, type: 'sawtooth', duration: 0.08, volume: 0.05 }); },
    bomb() {
      noise({ duration: 0.7, volume: 0.5, lowpass: 1200 });
      tone({ freq: 120, freqEnd: 25, type: 'sawtooth', duration: 0.6, volume: 0.3 });
      [80, 60, 40].forEach((f,i)=>setTimeout(()=>tone({freq:f,type:'sine',duration:0.3,volume:0.2}),i*120));
    },
    dash() { tone({ freq: 1200, freqEnd: 400, type: 'sawtooth', duration: 0.15, volume: 0.14 }); noise({ duration: 0.12, volume: 0.1, lowpass: 2000, highpass: 600 }); },
    charge() { tone({ freq: 200, freqEnd: 1400, type: 'sawtooth', duration: CHARGE_FULL_MS / 1000, volume: 0.1, attack: 0.05 }); },
    chargedRelease() { tone({ freq: 1500, freqEnd: 200, type: 'sawtooth', duration: 0.4, volume: 0.25 }); noise({ duration: 0.3, volume: 0.18, lowpass: 1500 }); },
    comboUp(tier) { tone({ freq: 440 * Math.pow(1.18, tier), type: 'square', duration: 0.12, volume: 0.13 }); },
    waveStart() { [392, 523, 659, 784].forEach((f,i)=>setTimeout(()=>tone({freq:f,type:'square',duration:0.18,volume:0.15}),i*100)); },
    bossRoar() {
      noise({ duration: 0.9, volume: 0.4, lowpass: 600 });
      [120, 90, 70, 60].forEach((f,i)=>setTimeout(()=>tone({freq:f,freqEnd:f*0.6,type:'sawtooth',duration:0.4,volume:0.25}),i*120));
    },
    pickup() { tone({ freq: 880, freqEnd: 1320, type: 'sine', duration: 0.15, volume: 0.16 }); },
    gameOver() { [380,300,220,150].forEach((f,i)=>setTimeout(()=>tone({freq:f,type:'sawtooth',duration:0.28,volume:0.26}),i*210)); },
    victory() { [523,659,784,1047,1318].forEach((f,i)=>setTimeout(()=>tone({freq:f,type:'square',duration:0.2,volume:0.2}),i*120)); },

    startBgm, stopBgm, setBgmMode,
    toggleMute() { muted = !muted; if (muted) stopBgm(); return muted; },
    isMuted() { return muted; },
  };
})();

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
    lastShot: 0,
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

// ═══ 8. Player ════════════════════════════════════════════════════════════
function drawPlayer() {
  const p = state.player;
  if (p.invincible > 0 && Math.floor(p.invincible / 80) % 2 === 0 && state.dashIframes <= 0) return;

  wctx.save();
  wctx.translate(p.x, p.y);

  // Dash afterimage glow
  if (state.dashActive > 0) {
    wctx.shadowColor = '#ffffff';
    wctx.shadowBlur = 30;
  }

  // Engine flame (animated)
  const flicker = 8 + Math.random() * 8;
  const fg = wctx.createLinearGradient(0, p.h / 2, 0, p.h / 2 + flicker + 4);
  fg.addColorStop(0, '#ffffff');
  fg.addColorStop(0.3, '#ffee44');
  fg.addColorStop(0.7, '#ff6600');
  fg.addColorStop(1, 'rgba(255, 0, 0, 0)');
  wctx.fillStyle = fg;
  wctx.beginPath();
  wctx.moveTo(-12, p.h / 2 - 2);
  wctx.lineTo(0, p.h / 2 + flicker + 4);
  wctx.lineTo(12, p.h / 2 - 2);
  wctx.closePath();
  wctx.fill();

  // Body (chrome gradient)
  const bg = wctx.createLinearGradient(-p.w / 2, 0, p.w / 2, 0);
  bg.addColorStop(0, '#003355');
  bg.addColorStop(0.4, '#00ccff');
  bg.addColorStop(0.5, '#ffffff');
  bg.addColorStop(0.6, '#00ccff');
  bg.addColorStop(1, '#003355');
  wctx.fillStyle = bg;
  wctx.shadowColor = '#00aaff';
  wctx.shadowBlur = 18;
  wctx.beginPath();
  wctx.moveTo(0, -p.h / 2);
  wctx.lineTo(p.w / 2 - 4, p.h / 4);
  wctx.lineTo(p.w / 2, p.h / 2);
  wctx.lineTo(p.w / 4, p.h / 2 - 6);
  wctx.lineTo(0, p.h / 2 - 2);
  wctx.lineTo(-p.w / 4, p.h / 2 - 6);
  wctx.lineTo(-p.w / 2, p.h / 2);
  wctx.lineTo(-p.w / 2 + 4, p.h / 4);
  wctx.closePath();
  wctx.fill();

  // Wings
  wctx.fillStyle = '#0088aa';
  wctx.shadowBlur = 6;
  wctx.beginPath();
  wctx.moveTo(-p.w / 2 - 6, p.h / 4);
  wctx.lineTo(-p.w / 2 + 2, -2);
  wctx.lineTo(-p.w / 2 + 2, p.h / 2);
  wctx.lineTo(-p.w / 2 - 4, p.h / 2);
  wctx.closePath();
  wctx.fill();
  wctx.beginPath();
  wctx.moveTo(p.w / 2 + 6, p.h / 4);
  wctx.lineTo(p.w / 2 - 2, -2);
  wctx.lineTo(p.w / 2 - 2, p.h / 2);
  wctx.lineTo(p.w / 2 + 4, p.h / 2);
  wctx.closePath();
  wctx.fill();

  // Cockpit
  const cg = wctx.createRadialGradient(-2, -p.h / 6, 1, 0, -p.h / 6, 10);
  cg.addColorStop(0, '#ffffff');
  cg.addColorStop(0.5, '#88ddff');
  cg.addColorStop(1, '#003366');
  wctx.fillStyle = cg;
  wctx.shadowBlur = 0;
  wctx.beginPath();
  wctx.ellipse(0, -p.h / 8, 7, 11, 0, 0, TAU);
  wctx.fill();

  // Tier accessories
  const tier = state.weaponTier;
  if (tier >= 1) {
    wctx.fillStyle = '#00aaaa';
    wctx.fillRect(-p.w / 2 - 4, -p.h / 4, 5, 22);
    wctx.fillRect(p.w / 2 - 1,  -p.h / 4, 5, 22);
  }
  if (tier >= 2) {
    wctx.fillStyle = '#ffaa00';
    wctx.shadowColor = '#ffaa00';
    wctx.shadowBlur = 8;
    wctx.beginPath();
    wctx.arc(-p.w / 2 - 6, 4, 5, 0, TAU);
    wctx.arc( p.w / 2 + 6, 4, 5, 0, TAU);
    wctx.fill();
  }
  if (tier >= 3) {
    wctx.fillStyle = '#ff2222';
    wctx.shadowColor = '#ff2222';
    wctx.shadowBlur = 10;
    wctx.fillRect(-3, -p.h / 2 - 10, 6, 12);
  }
  if (tier >= 4) {
    wctx.fillStyle = '#444';
    wctx.shadowBlur = 0;
    wctx.fillRect(-p.w / 2 - 14, 2, 8, 16);
    wctx.fillRect( p.w / 2 + 6,  2, 8, 16);
    wctx.fillStyle = '#ff4444';
    wctx.fillRect(-p.w / 2 - 12, -2, 4, 4);
    wctx.fillRect( p.w / 2 + 8,  -2, 4, 4);
  }
  if (tier >= 5) {
    wctx.fillStyle = '#ff00ff';
    wctx.shadowColor = '#ff00ff';
    wctx.shadowBlur = 14;
    wctx.beginPath();
    wctx.arc(0, -2, 7, 0, TAU);
    wctx.fill();
  }

  // Charging indicator
  if (state.charging) {
    const t = Math.min(1, (performance.now() - state.chargeStart) / CHARGE_FULL_MS);
    wctx.shadowColor = `hsl(${280 + t * 60}, 100%, 60%)`;
    wctx.shadowBlur = 25 * t;
    wctx.fillStyle = `rgba(255, ${100 + t * 155}, 255, ${0.3 + t * 0.5})`;
    wctx.beginPath();
    wctx.arc(0, -p.h / 2 - 6, 4 + t * 10, 0, TAU);
    wctx.fill();
  }

  // Shield
  if (p.armor > 0) {
    const a = p.armor / p.maxArmor;
    const pulse = 1 + Math.sin(performance.now() * 0.005) * 0.04;
    wctx.strokeStyle = `rgba(0, 255, 255, ${0.3 + a * 0.5})`;
    wctx.lineWidth = 2.5;
    wctx.shadowColor = '#00ffff';
    wctx.shadowBlur = 18;
    wctx.beginPath();
    wctx.arc(0, 0, (38 + a * 10) * pulse, 0, TAU);
    wctx.stroke();
    wctx.fillStyle = `rgba(0, 200, 255, ${a * 0.08})`;
    wctx.fill();
  }

  wctx.restore();
}

function emitPlayerTrail(dt) {
  state.player.trailTimer -= dt;
  if (state.player.trailTimer > 0) return;
  state.player.trailTimer = 16;
  const p = state.player;
  for (let i = 0; i < 2; i++) {
    spawnParticle(
      p.x + rand(-4, 4),
      p.y + p.h / 2 + 2,
      rand(-0.3, 0.3),
      rand(2, 5),
      rand(2, 4),
      i === 0 ? '#88ddff' : '#ffffff',
      0.04
    );
  }
}

// ═══ 9. Bullets / Rockets ═════════════════════════════════════════════════
function shoot(now) {
  const w = WEAPONS[state.weaponTier];
  if (now - state.lastShot < w.cooldown) return;
  state.lastShot = now;
  state.shotsFired++;
  sfx.shoot(w.type);

  const px = state.player.x;
  const py = state.player.y - state.player.h / 2;

  if (w.type === 'bullet') state.bullets.push(makeBullet(px, py, 0, w));
  else if (w.type === 'double') {
    state.bullets.push(makeBullet(px - 12, py, 0, w));
    state.bullets.push(makeBullet(px + 12, py, 0, w));
  } else if (w.type === 'spread') {
    state.bullets.push(makeBullet(px, py, 0, w));
    state.bullets.push(makeBullet(px - 10, py, -2.5, w));
    state.bullets.push(makeBullet(px + 10, py,  2.5, w));
    state.bullets.push(makeBullet(px - 18, py, -4.2, w));
    state.bullets.push(makeBullet(px + 18, py,  4.2, w));
  } else if (w.type === 'beam') {
    state.bullets.push({ x: px, y: py + 8, w: 6, h: 14, speed: w.speed, damage: w.damage, color: w.color, type: 'beam', dx: rand(-0.6, 0.6) });
  } else if (w.type === 'laser') {
    state.bullets.push({ x: px, y: py, w: 5, h: 30, speed: w.speed, damage: w.damage, color: w.color, type: 'laser', dx: 0 });
  } else if (w.type === 'rocket') {
    state.bullets.push({
      x: px, y: py, w: 9, h: 20, speed: w.speed, damage: w.damage,
      color: w.color, type: 'rocket', vx: 0, vy: -5, angle: -Math.PI / 2, turnRate: 0.09
    });
  }
}

function makeBullet(x, y, dx, w) {
  return { x, y, w: 5, h: 12, speed: w.speed, damage: w.damage, color: w.color, type: 'bullet', dx };
}

function fireChargedShot() {
  const t = clamp((performance.now() - state.chargeStart) / CHARGE_FULL_MS, 0.2, 1);
  const px = state.player.x;
  const py = state.player.y - state.player.h / 2;
  state.bullets.push({
    x: px, y: py, w: 18 + t * 36, h: 50 + t * 60,
    speed: 18, damage: 4 + t * 12,
    color: `hsl(${280 + t * 60}, 100%, 70%)`,
    type: 'charged', dx: 0, pierce: 99, life: 1500
  });
  state.shotsFired++;
  sfx.chargedRelease();
  addShake(8 + t * 6);
  for (let i = 0; i < 30; i++) spawnParticle(px + rand(-20, 20), py, rand(-3, 3), rand(-6, -1), rand(2, 6), '#ff88ff', 0.04);
}

// ═══ 10. Enemies ══════════════════════════════════════════════════════════
const ARCHETYPES = ['grunt', 'kamikaze', 'sniper', 'drone', 'shielded'];

function makeEnemySprite(arch, hue, w, h, seed) {
  const key = `${arch}|${hue}|${w}|${h}|${seed}`;
  return getSprite(key, w + 20, h + 20, (g) => {
    g.translate((w + 20) / 2, (h + 20) / 2);
    g.shadowColor = `hsl(${hue}, 90%, 50%)`;
    g.shadowBlur = 14;

    if (arch === 'grunt') {
      // Aggressive arrowhead with metal panels
      const grad = g.createLinearGradient(0, -h / 2, 0, h / 2);
      grad.addColorStop(0, `hsl(${hue}, 80%, 55%)`);
      grad.addColorStop(0.5, `hsl(${hue}, 70%, 30%)`);
      grad.addColorStop(1, `hsl(${hue}, 90%, 18%)`);
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(0, h / 2);
      g.lineTo(w / 2, 0);
      g.lineTo(w / 4, -h / 2);
      g.lineTo(-w / 4, -h / 2);
      g.lineTo(-w / 2, 0);
      g.closePath();
      g.fill();
      g.strokeStyle = `hsl(${hue}, 100%, 70%)`;
      g.lineWidth = 1.5;
      g.stroke();
      // Cockpit
      g.fillStyle = '#ff3333';
      g.shadowColor = '#ff0000';
      g.shadowBlur = 8;
      g.beginPath(); g.arc(0, 0, 4, 0, TAU); g.fill();

    } else if (arch === 'kamikaze') {
      // Spiked, aggressive red shape
      g.shadowColor = '#ff3300';
      g.shadowBlur = 16;
      g.fillStyle = '#440000';
      g.beginPath();
      const spikes = 8;
      for (let i = 0; i < spikes; i++) {
        const a = (i / spikes) * TAU;
        const r = (i % 2 === 0) ? w / 2 : w / 3;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        i === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
      }
      g.closePath();
      g.fillStyle = `hsl(${hue}, 100%, 35%)`;
      g.fill();
      g.strokeStyle = '#ff6600';
      g.lineWidth = 2;
      g.stroke();
      g.fillStyle = '#ffff00';
      g.shadowColor = '#ffff00';
      g.beginPath(); g.arc(0, 0, 5, 0, TAU); g.fill();

    } else if (arch === 'sniper') {
      // Long thin attacker with visible barrel
      g.fillStyle = `hsl(${hue}, 50%, 25%)`;
      g.beginPath();
      g.moveTo(-w / 3, -h / 2);
      g.lineTo(w / 3, -h / 2);
      g.lineTo(w / 2, h / 4);
      g.lineTo(0, h / 2);
      g.lineTo(-w / 2, h / 4);
      g.closePath();
      g.fill();
      g.strokeStyle = `hsl(${hue}, 80%, 60%)`;
      g.lineWidth = 1.5;
      g.stroke();
      // Barrel
      g.fillStyle = '#222';
      g.fillRect(-2, h / 4, 4, h / 4 + 6);
      // Eye
      g.fillStyle = '#00ffaa';
      g.shadowColor = '#00ffaa';
      g.shadowBlur = 10;
      g.beginPath(); g.arc(0, -h / 6, 3.5, 0, TAU); g.fill();

    } else if (arch === 'drone') {
      // Small disc shape
      const grad = g.createRadialGradient(0, 0, 1, 0, 0, w / 2);
      grad.addColorStop(0, `hsl(${hue}, 100%, 70%)`);
      grad.addColorStop(1, `hsl(${hue}, 80%, 20%)`);
      g.fillStyle = grad;
      g.beginPath(); g.arc(0, 0, w / 2, 0, TAU); g.fill();
      g.strokeStyle = `hsl(${hue}, 100%, 80%)`;
      g.lineWidth = 1.2;
      g.stroke();
      g.fillStyle = '#ffffff';
      g.beginPath(); g.arc(0, 0, 2, 0, TAU); g.fill();

    } else if (arch === 'shielded') {
      // Heavy unit with front shield
      g.fillStyle = `hsl(${hue}, 30%, 25%)`;
      g.beginPath();
      g.moveTo(-w / 2, -h / 4);
      g.lineTo(-w / 3, -h / 2);
      g.lineTo(w / 3, -h / 2);
      g.lineTo(w / 2, -h / 4);
      g.lineTo(w / 2, h / 3);
      g.lineTo(0, h / 2);
      g.lineTo(-w / 2, h / 3);
      g.closePath();
      g.fill();
      g.strokeStyle = `hsl(${hue}, 80%, 50%)`;
      g.lineWidth = 2;
      g.stroke();
      // Shield arc (drawn on top — rendered separately at runtime if active)
      g.fillStyle = '#ffffff';
      g.beginPath(); g.arc(0, -h / 8, 3, 0, TAU); g.fill();
    }
  });
}

function spawnEnemy(opts = {}) {
  const arch = opts.archetype || choose(['grunt', 'grunt', 'kamikaze', 'sniper', 'drone', 'shielded']);
  const tierBonus = Math.floor(state.wave / 3);
  let w, h, hp, speed;

  switch (arch) {
    case 'kamikaze': w = 36; h = 36; hp = 2 + tierBonus; speed = 3.2 + tierBonus * 0.3; break;
    case 'sniper':   w = 44; h = 50; hp = 4 + tierBonus * 1.5; speed = 0.9 + tierBonus * 0.2; break;
    case 'drone':    w = 22; h = 22; hp = 1 + tierBonus * 0.5; speed = 1.6 + tierBonus * 0.25; break;
    case 'shielded': w = 56; h = 60; hp = 8 + tierBonus * 2; speed = 1.0 + tierBonus * 0.2; break;
    case 'grunt':
    default:         w = 38; h = 42; hp = 2 + tierBonus; speed = 1.6 + tierBonus * 0.3; break;
  }

  const x = opts.x !== undefined ? opts.x : rand(w, CANVAS_W - w);
  const y = opts.y !== undefined ? opts.y : -40;
  const hue = opts.hue !== undefined ? opts.hue : (
    arch === 'kamikaze' ? randi(0, 25) :
    arch === 'sniper'   ? randi(120, 180) :
    arch === 'drone'    ? randi(40, 80) :
    arch === 'shielded' ? randi(200, 260) :
    randi(280, 360)
  );

  state.enemies.push({
    arch, x, y, w, h, hp,
    maxHp: hp,
    speed,
    sway: arch === 'kamikaze' ? 0 : (Math.random() - 0.5) * 1.2,
    swayAngle: Math.random() * TAU,
    hue,
    seed: randi(0, 1000),
    sprite: makeEnemySprite(arch, hue, w, h, randi(0, 1000)),
    lastShot: performance.now() + rand(0, 1500),
    shotCooldown: arch === 'sniper' ? 1800 : (arch === 'drone' ? 0 : (1400 + Math.random() * 1600)),
    state: arch === 'sniper' ? 'approach' : 'normal',
    targetY: rand(180, 360),
    flash: 0,                  // hit flash timer
    formationPhase: opts.phase || 0,
    formationLeader: opts.leader || null,
  });
}

function spawnMeteor() {
  const x = rand(20, CANVAS_W - 20);
  const size = rand(20, 48);
  state.meteors.push({
    x, y: -size,
    w: size, h: size,
    hp: Math.floor(size / 12),
    maxHp: Math.floor(size / 12),
    speed: rand(1.5, 3.0),
    rot: 0,
    rotSpeed: (Math.random() - 0.5) * 0.06,
    size,
    flash: 0,
  });
}

function enemyShoot(e, now) {
  const player = state.player;
  const dx = player.x - e.x;
  const dy = player.y - e.y;

  let bSpeed = 6;
  let spread = 15 * Math.PI / 180;
  if (e.arch === 'sniper') { bSpeed = 9; spread = 1 * Math.PI / 180; }

  let angle = Math.atan2(dy, dx);
  let diff = angle - Math.PI / 2;
  while (diff < -Math.PI) diff += TAU;
  while (diff > Math.PI) diff -= TAU;
  diff = clamp(diff, -spread, spread);
  const finalAngle = Math.PI / 2 + diff;

  bSpeed *= state.gameSpeed;
  sfx.enemyShoot();
  state.enemyBullets.push({
    x: e.x, y: e.y + e.h / 2, w: 7, h: 7,
    vx: Math.cos(finalAngle) * bSpeed,
    vy: Math.sin(finalAngle) * bSpeed,
    damage: 1, color: e.arch === 'sniper' ? '#00ffaa' : '#ff2222',
  });
}

// ═══ 11. Wave Director & Bosses ═══════════════════════════════════════════
function startWave(n) {
  state.wave = n;
  state.waveActive = true;
  state.waveQueue = buildWave(n);
  state.waveSpawnTimer = 0;
  state.waveBannerTime = 2200;
  state.waveBannerText = (n % 5 === 0) ? `BOSS WAVE ${n}` : `WAVE ${n}`;
  state.bossPending = (n % 5 === 0);
  sfx.waveStart();
  if (n % 5 === 0) {
    setTimeout(() => { if (state.running) spawnBoss(n); }, 2000);
  }
}

function buildWave(n) {
  const q = [];
  if (n % 5 === 0) return q; // boss waves: no regular spawns

  const baseCount = 8 + n * 2;
  let t = 600;
  const variety = Math.min(ARCHETYPES.length, 1 + Math.floor(n / 1.5));

  for (let i = 0; i < baseCount; i++) {
    const arch = ARCHETYPES[randi(0, variety)];
    if (arch === 'drone' && Math.random() < 0.5) {
      // Drone formation: 5 in a V
      const cx = rand(150, CANVAS_W - 150);
      for (let k = -2; k <= 2; k++) {
        q.push({ time: t + k * 80, opts: { archetype: 'drone', x: cx + k * 50, phase: k } });
      }
      t += 1500;
    } else {
      q.push({ time: t, opts: { archetype: arch } });
      t += 600 + Math.random() * 600 - n * 30;
      if (t < 200) t = 200;
    }
  }
  // Meteors interspersed
  for (let i = 0; i < Math.floor(n / 1.5) + 2; i++) {
    q.push({ time: rand(800, t), opts: { meteor: true } });
  }
  q.sort((a, b) => a.time - b.time);
  return q;
}

function spawnBoss(waveNum) {
  const tier = Math.floor(waveNum / 5);
  const hp = 80 + tier * 70;
  state.boss = {
    x: CANVAS_W / 2, y: -120,
    w: 220, h: 140,
    hp, maxHp: hp,
    targetY: 220,
    state: 'enter',
    phaseTimer: 0,
    pattern: 0,
    lastAttack: 0,
    sway: 0,
    hue: (tier * 60) % 360,
    flash: 0,
    cores: [
      { ox: -70, oy: 30, hp: 30, maxHp: 30, dead: false },
      { ox:  70, oy: 30, hp: 30, maxHp: 30, dead: false },
      { ox:   0, oy: -10, hp: 60, maxHp: 60, dead: false }, // main
    ],
  };
  state.bossActive = true;
  state.bossPending = false;
  sfx.bossRoar();
  sfx.setBgmMode('boss');
  if (!sfx.isMuted()) { sfx.stopBgm(); sfx.startBgm('boss'); }
  addShake(20);
}

function updateBoss(dt, now) {
  const b = state.boss;
  if (!b) return;
  b.flash = Math.max(0, b.flash - dt);

  if (b.state === 'enter') {
    b.y += (b.targetY - b.y) * 0.04 * (dt / 16);
    if (Math.abs(b.y - b.targetY) < 1) b.state = 'fight';
  } else {
    b.sway += dt * 0.0008;
    b.x = CANVAS_W / 2 + Math.sin(b.sway) * 280;
    b.y = b.targetY + Math.sin(b.sway * 1.4) * 30;

    // Attacks
    if (now - b.lastAttack > 1500) {
      b.lastAttack = now;
      const aliveCores = b.cores.filter(c => !c.dead);
      const pat = b.pattern % 3;
      if (pat === 0) {
        // Radial burst
        const n = 18;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU + (Math.random() * 0.1);
          state.enemyBullets.push({
            x: b.x, y: b.y + 20, w: 8, h: 8,
            vx: Math.cos(a) * 5, vy: Math.sin(a) * 5,
            damage: 1, color: '#ff44ff',
          });
        }
      } else if (pat === 1) {
        // Aimed triple at player
        for (const c of aliveCores) {
          const cx = b.x + c.ox, cy = b.y + c.oy;
          const a = Math.atan2(state.player.y - cy, state.player.x - cx);
          for (let k = -1; k <= 1; k++) {
            const ang = a + k * 0.18;
            state.enemyBullets.push({
              x: cx, y: cy, w: 9, h: 9,
              vx: Math.cos(ang) * 6.5, vy: Math.sin(ang) * 6.5,
              damage: 1, color: '#ffaa00',
            });
          }
        }
      } else {
        // Spawn drones
        for (let i = 0; i < 3; i++) {
          spawnEnemy({ archetype: 'drone', x: b.x + rand(-80, 80), y: b.y + 60, hue: b.hue });
        }
      }
      b.pattern++;
      sfx.enemyShoot();
    }
  }
}

function damageBoss(b, x, y, dmg) {
  // Find nearest core and damage it
  let nearest = null, nd = Infinity;
  for (const c of b.cores) {
    if (c.dead) continue;
    const cx = b.x + c.ox, cy = b.y + c.oy;
    const d = dist2(cx, cy, x, y);
    if (d < nd) { nd = d; nearest = c; }
  }
  if (!nearest) return false;
  nearest.hp -= dmg;
  b.flash = 80;
  b.hp = b.cores.reduce((s, c) => s + Math.max(0, c.hp), 0);
  if (nearest.hp <= 0) {
    nearest.dead = true;
    explode(b.x + nearest.ox, b.y + nearest.oy, '#ff44ff', 30);
    addShake(12);
    sfx.bigExplode();
  }
  if (b.cores.every(c => c.dead)) {
    defeatBoss();
  }
  return true;
}

function defeatBoss() {
  const b = state.boss;
  if (!b) return;
  for (let i = 0; i < 6; i++) {
    setTimeout(() => {
      explode(b.x + rand(-80, 80), b.y + rand(-50, 50), choose(['#ff4444','#ffaa00','#ff44ff','#ffffff']), 30);
      addShake(15);
      sfx.bigExplode();
    }, i * 180);
  }
  setTimeout(() => {
    state.score += 2000 + state.wave * 100;
    state.bombs = Math.min(MAX_BOMBS, state.bombs + 1);
    state.dashes = Math.min(MAX_DASH, state.dashes + 1);
    state.boss = null;
    state.bossActive = false;
    sfx.victory();
    sfx.setBgmMode('play');
    if (!sfx.isMuted()) { sfx.stopBgm(); sfx.startBgm('play'); }
    addFloatingText(CANVAS_W / 2, CANVAS_H / 2, 'BOSS DESTROYED', '#ff44ff', 2.6, -0.5);
    addFloatingText(CANVAS_W / 2, CANVAS_H / 2 + 36, '+ BOMB & DASH', '#ffaa00', 2.4, -0.5);
    state.waveActive = false;
    state.interWaveTimer = 1500;
  }, 1300);
}

function drawBoss() {
  const b = state.boss;
  if (!b) return;
  wctx.save();
  wctx.translate(b.x, b.y);

  // Hit flash overlay tint
  const flashAmt = b.flash / 80;

  // Main hull
  wctx.shadowColor = `hsl(${b.hue}, 100%, 50%)`;
  wctx.shadowBlur = 30;
  const grad = wctx.createRadialGradient(0, 0, 10, 0, 0, 130);
  grad.addColorStop(0, `hsl(${b.hue}, 100%, 70%)`);
  grad.addColorStop(0.4, `hsl(${b.hue}, 80%, 35%)`);
  grad.addColorStop(1, `hsl(${b.hue}, 80%, 12%)`);
  wctx.fillStyle = grad;
  wctx.beginPath();
  wctx.moveTo(-b.w / 2, 0);
  wctx.lineTo(-b.w / 3, -b.h / 2);
  wctx.lineTo(b.w / 3, -b.h / 2);
  wctx.lineTo(b.w / 2, 0);
  wctx.lineTo(b.w / 3, b.h / 2);
  wctx.lineTo(-b.w / 3, b.h / 2);
  wctx.closePath();
  wctx.fill();

  // Hull plating lines
  wctx.strokeStyle = `hsla(${b.hue}, 100%, 80%, 0.6)`;
  wctx.lineWidth = 2;
  wctx.stroke();
  wctx.beginPath();
  wctx.moveTo(-b.w / 2 + 30, -b.h / 4);
  wctx.lineTo(b.w / 2 - 30, -b.h / 4);
  wctx.moveTo(-b.w / 2 + 30, b.h / 4);
  wctx.lineTo(b.w / 2 - 30, b.h / 4);
  wctx.stroke();

  // Cores
  for (const c of b.cores) {
    if (c.dead) {
      wctx.fillStyle = '#220000';
      wctx.shadowBlur = 0;
      wctx.beginPath(); wctx.arc(c.ox, c.oy, 14, 0, TAU); wctx.fill();
      continue;
    }
    const cf = c.hp / c.maxHp;
    const pulse = 0.7 + Math.sin(performance.now() * 0.01) * 0.3;
    wctx.shadowColor = '#ffffff';
    wctx.shadowBlur = 18;
    wctx.fillStyle = `rgba(255, ${Math.floor(80 + cf * 175)}, ${Math.floor(40 + cf * 215)}, ${pulse})`;
    wctx.beginPath();
    wctx.arc(c.ox, c.oy, 14, 0, TAU);
    wctx.fill();
    wctx.fillStyle = '#ffffff';
    wctx.beginPath();
    wctx.arc(c.ox, c.oy, 5, 0, TAU);
    wctx.fill();
  }

  // Hit flash overlay
  if (flashAmt > 0) {
    wctx.globalCompositeOperation = 'lighter';
    wctx.fillStyle = `rgba(255,255,255,${flashAmt * 0.5})`;
    wctx.beginPath();
    wctx.moveTo(-b.w / 2, 0);
    wctx.lineTo(-b.w / 3, -b.h / 2);
    wctx.lineTo(b.w / 3, -b.h / 2);
    wctx.lineTo(b.w / 2, 0);
    wctx.lineTo(b.w / 3, b.h / 2);
    wctx.lineTo(-b.w / 3, b.h / 2);
    wctx.closePath();
    wctx.fill();
    wctx.globalCompositeOperation = 'source-over';
  }

  wctx.restore();
}

function bossHitTest(b, bullet) {
  // Bullet vs hull AABB
  return Math.abs(bullet.x - b.x) < b.w / 2 && Math.abs(bullet.y - b.y) < b.h / 2;
}

// ═══ 12. Pickups ══════════════════════════════════════════════════════════
const PICKUP_TYPES = ['armor', 'speed', 'bomb', 'dash', 'gem'];

function spawnPickup(type, x, y) {
  type = type || choose(PICKUP_TYPES);
  state.pickups.push({
    type, x, y,
    w: 22, h: 22,
    speed: rand(1.8, 2.8),
    bob: Math.random() * TAU,
  });
}

function drawPickup(p) {
  wctx.save();
  wctx.translate(p.x, p.y);
  const t = performance.now() * 0.005;
  wctx.rotate(Math.sin(t + p.bob) * 0.15);
  const pulse = 1 + Math.sin(t * 2 + p.bob) * 0.08;
  wctx.scale(pulse, pulse);

  if (p.type === 'armor') {
    wctx.shadowColor = '#00ffff'; wctx.shadowBlur = 14;
    wctx.fillStyle = '#00ffff';
    wctx.beginPath();
    wctx.moveTo(0, -12); wctx.lineTo(11, 0); wctx.lineTo(0, 12); wctx.lineTo(-11, 0); wctx.closePath();
    wctx.fill();
    wctx.fillStyle = '#ffffff';
    wctx.font = 'bold 14px monospace'; wctx.textAlign = 'center'; wctx.textBaseline = 'middle';
    wctx.fillText('S', 0, 0);
  } else if (p.type === 'speed') {
    wctx.shadowColor = '#ffff00'; wctx.shadowBlur = 14;
    wctx.fillStyle = '#ffff00';
    wctx.beginPath();
    wctx.moveTo(-2, -12); wctx.lineTo(8, -2); wctx.lineTo(2, -2); wctx.lineTo(8, 12);
    wctx.lineTo(-4, -2); wctx.lineTo(2, -2); wctx.closePath();
    wctx.fill();
  } else if (p.type === 'bomb') {
    wctx.shadowColor = '#ff44aa'; wctx.shadowBlur = 14;
    wctx.fillStyle = '#ff44aa';
    wctx.beginPath(); wctx.arc(0, 2, 11, 0, TAU); wctx.fill();
    wctx.fillStyle = '#ffff00';
    wctx.fillRect(-1, -12, 2, 6);
    wctx.fillStyle = '#ff8800';
    wctx.beginPath(); wctx.arc(0, -10, 2.5, 0, TAU); wctx.fill();
    wctx.fillStyle = '#ffffff';
    wctx.font = 'bold 12px monospace'; wctx.textAlign = 'center'; wctx.textBaseline = 'middle';
    wctx.fillText('B', 0, 3);
  } else if (p.type === 'dash') {
    wctx.shadowColor = '#88ff44'; wctx.shadowBlur = 14;
    wctx.fillStyle = '#88ff44';
    wctx.beginPath();
    wctx.moveTo(-10, -8); wctx.lineTo(2, -8); wctx.lineTo(2, -12); wctx.lineTo(12, 0);
    wctx.lineTo(2, 12); wctx.lineTo(2, 8); wctx.lineTo(-10, 8); wctx.closePath();
    wctx.fill();
  } else if (p.type === 'gem') {
    wctx.shadowColor = '#ff8800'; wctx.shadowBlur = 16;
    wctx.fillStyle = '#ffaa00';
    wctx.beginPath();
    wctx.moveTo(0, -12); wctx.lineTo(10, -4); wctx.lineTo(7, 12);
    wctx.lineTo(-7, 12); wctx.lineTo(-10, -4); wctx.closePath();
    wctx.fill();
    wctx.fillStyle = '#ffffff';
    wctx.globalAlpha = 0.6;
    wctx.beginPath();
    wctx.moveTo(0, -10); wctx.lineTo(7, -3); wctx.lineTo(0, 4); wctx.lineTo(-3, -3); wctx.closePath();
    wctx.fill();
  }

  wctx.restore();
}

function applyPickup(p) {
  sfx.pickup();
  if (p.type === 'armor') {
    state.player.armor = Math.min(state.player.maxArmor, state.player.armor + 30);
    addFloatingText(p.x, p.y - 10, '+SHIELD', '#00ffff', 1.5, -1.4);
  } else if (p.type === 'speed') {
    state.player.speedLevel++;
    sfx.speedUp();
    addFloatingText(p.x, p.y - 10, '+SPEED', '#ffff00', 1.5, -1.4);
  } else if (p.type === 'bomb') {
    state.bombs = Math.min(MAX_BOMBS, state.bombs + 1);
    addFloatingText(p.x, p.y - 10, '+BOMB', '#ff44aa', 1.5, -1.4);
  } else if (p.type === 'dash') {
    state.dashes = Math.min(MAX_DASH, state.dashes + 1);
    addFloatingText(p.x, p.y - 10, '+DASH', '#88ff44', 1.5, -1.4);
  } else if (p.type === 'gem') {
    const bonus = 250 * Math.max(1, state.comboTier);
    state.score += bonus;
    addFloatingText(p.x, p.y - 10, `+${bonus}`, '#ffaa00', 1.5, -1.4);
  }
  explode(p.x, p.y, '#ffffff', 12);
}

// ═══ 13. Particles, Trails, Floating Text, Shake ══════════════════════════
function spawnParticle(x, y, vx, vy, r, color, decay = 0.025) {
  if (state.particles.length >= PARTICLE_CAP) state.particles.shift();
  state.particles.push({ x, y, vx, vy, r, color, life: 1, decay });
}

function explode(x, y, color, count = 14) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * TAU;
    const s = rand(1, 6);
    spawnParticle(x, y, Math.cos(a) * s, Math.sin(a) * s, rand(1.2, 4.5), color, rand(0.02, 0.06));
  }
  // shockwave ring particle
  state.particles.push({ x, y, vx: 0, vy: 0, r: 4, color, life: 1, decay: 0.04, ring: true, growth: 4 });
}

function addFloatingText(x, y, text, color, life = 1.5, dy = -1.0) {
  state.floatingTexts.push({ x, y, text, color, life, dy, age: 0 });
}

function addShake(amount) { state.shake = Math.min(40, state.shake + amount); }

// ═══ 14. Specials (Bomb, Dash, Charged) ═══════════════════════════════════
function triggerBomb() {
  if (state.bombs <= 0) return;
  state.bombs--;
  sfx.bomb();
  addShake(28);
  state.flash = 0.85; state.flashColor = '#ffffff';
  // Clear enemy bullets (visually)
  for (const eb of state.enemyBullets) {
    explode(eb.x, eb.y, '#ffaa00', 6);
  }
  state.enemyBullets.length = 0;
  // Damage all enemies
  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const e = state.enemies[i];
    e.hp -= 10;
    explode(e.x, e.y, '#ffff00', 12);
    if (e.hp <= 0) onEnemyDeath(e, i);
  }
  for (let i = state.meteors.length - 1; i >= 0; i--) {
    const m = state.meteors[i];
    explode(m.x, m.y, '#aaaa88', 14);
    sfx.meteorExplode();
    state.score += 30;
    state.meteors.splice(i, 1);
  }
  if (state.boss) {
    for (const c of state.boss.cores) {
      if (c.dead) continue;
      damageBoss(state.boss, state.boss.x + c.ox, state.boss.y + c.oy, 10);
    }
  }
  addFloatingText(state.player.x, state.player.y - 50, 'SMART BOMB', '#ffaa00', 1.6, -1.2);
}

function triggerDash() {
  if (state.dashes <= 0 || state.dashActive > 0) return;
  state.dashes--;
  state.dashActive = DASH_DURATION;
  state.dashIframes = DASH_IFRAMES;
  let dx = 0, dy = 0;
  if (input.keys['ArrowLeft'] || input.keys['KeyA']) dx -= 1;
  if (input.keys['ArrowRight']|| input.keys['KeyD']) dx += 1;
  if (input.keys['ArrowUp']   || input.keys['KeyW']) dy -= 1;
  if (input.keys['ArrowDown'] || input.keys['KeyS']) dy += 1;
  if (dx === 0 && dy === 0) {
    if (input.useMouse) {
      const mx = input.mouseX - state.player.x;
      const my = input.mouseY - state.player.y;
      const m = Math.hypot(mx, my) || 1;
      dx = mx / m; dy = my / m;
    } else { dy = -1; }
  } else {
    const m = Math.hypot(dx, dy);
    dx /= m; dy /= m;
  }
  state.dashDir = { x: dx, y: dy };
  sfx.dash();
}

// ═══ 15. Combo ════════════════════════════════════════════════════════════
function bumpCombo() {
  state.combo++;
  state.comboTimer = COMBO_WINDOW;
  if (state.combo > state.maxCombo) state.maxCombo = state.combo;
  let tier = 0;
  for (let i = COMBO_TIERS.length - 1; i >= 0; i--) {
    if (state.combo >= [3, 6, 10, 16, 25, 40, 60][i]) { tier = i; break; }
  }
  if (tier > state.comboTier) {
    state.comboTier = tier;
    sfx.comboUp(tier);
    addFloatingText(state.player.x, state.player.y - 60, `×${COMBO_TIERS[tier]} COMBO!`, '#ffaa00', 1.4, -1.4);
  }
}
function resetCombo() {
  state.combo = 0;
  state.comboTier = 0;
  state.comboTimer = 0;
}

// ═══ 16. Update ═══════════════════════════════════════════════════════════
function rectsOverlap(a, b) {
  return (
    a.x - a.w / 2 < b.x + b.w / 2 &&
    a.x + a.w / 2 > b.x - b.w / 2 &&
    a.y - a.h / 2 < b.y + b.h / 2 &&
    a.y + a.h / 2 > b.y - b.h / 2
  );
}

function checkWeaponUpgrade() {
  let tier = 0;
  for (let i = WEAPONS.length - 1; i >= 0; i--) {
    if (state.score >= WEAPONS[i].scoreNeeded) { tier = i; break; }
  }
  if (tier > state.weaponTier) {
    state.weaponTier = tier;
    sfx.weaponUpgrade();
    addFloatingText(state.player.x, state.player.y - 40, 'WEAPON: ' + WEAPONS[tier].name, '#ffaa00', 2.0, -1);
  }
}

function update(dt, now) {
  const dts = dt / 16.6667;  // step factor (1 at 60fps)
  const p = state.player;
  const k = input.keys;

  // ── Input → movement
  if (state.dashActive > 0) {
    const dashSpeed = 22;
    p.x += state.dashDir.x * dashSpeed * dts;
    p.y += state.dashDir.y * dashSpeed * dts;
    state.dashActive -= dt;
    // Afterimages
    if (Math.random() < 0.6) state.afterimages.push({ x: p.x, y: p.y, life: 0.4, t: 0 });
  } else if (input.useMouse) {
    const baseStiff = Math.max(0.0001, 0.005 * Math.pow(0.65, p.speedLevel));
    const t = 1 - Math.pow(baseStiff, dt / 1000);
    p.x += (input.mouseX - p.x) * t;
    p.y += (input.mouseY - p.y) * t;
  }
  const hasKey = k['ArrowLeft']||k['KeyA']||k['ArrowRight']||k['KeyD']||k['ArrowUp']||k['KeyW']||k['ArrowDown']||k['KeyS'];
  if (hasKey) input.useMouse = false;
  if (!input.useMouse && state.dashActive <= 0) {
    if (k['ArrowLeft']||k['KeyA']) p.x -= PLAYER_SPEED * dts;
    if (k['ArrowRight']||k['KeyD']) p.x += PLAYER_SPEED * dts;
    if (k['ArrowUp']||k['KeyW'])    p.y -= PLAYER_SPEED * dts;
    if (k['ArrowDown']||k['KeyS'])  p.y += PLAYER_SPEED * dts;
  }
  p.x = clamp(p.x, p.w / 2, CANVAS_W - p.w / 2);
  p.y = clamp(p.y, p.h / 2 + 60, CANVAS_H - p.h / 2);

  if (p.invincible > 0) p.invincible -= dt;
  if (state.dashIframes > 0) state.dashIframes -= dt;

  // ── Charged shot
  const shootDown = k['Space'] || input.mouseDown;
  if (shootDown) {
    if (!state.charging && state.weaponTier <= 3) {
      state.charging = true;
      state.chargeStart = now;
      sfx.charge();
    }
    shoot(now);
  } else if (state.charging) {
    const dur = now - state.chargeStart;
    if (dur > 250) fireChargedShot();
    state.charging = false;
  }

  // ── Player trail
  emitPlayerTrail(dt);

  // ── Shield repel
  if (p.armor > 0) {
    const rad = 110 + (p.armor / p.maxArmor) * 35;
    const force = 0.08 * (p.armor / p.maxArmor);
    for (const e of state.enemies) {
      const dx = e.x - p.x, dy = e.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d < rad && d > 0.1) { e.x += dx / d * (rad - d) * force; e.y += dy / d * (rad - d) * force; }
    }
    for (const m of state.meteors) {
      const dx = m.x - p.x, dy = m.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d < rad && d > 0.1) { m.x += dx / d * (rad - d) * force; m.y += dy / d * (rad - d) * force; }
    }
  }

  // ── Combo
  if (state.comboTimer > 0) {
    state.comboTimer -= dt;
    if (state.comboTimer <= 0) resetCombo();
  }

  // ── Background scroll
  state.bgScroll = (state.bgScroll + 0.4 * dts) % CANVAS_H;
  for (const arr of [state.starsFar, state.starsMid, state.starsNear]) {
    for (const s of arr) {
      s.y += s.speed * dts * state.gameSpeed;
      if (s.y > CANVAS_H) { s.y = 0; s.x = rand(0, CANVAS_W); }
      s.twinkle += dts * 0.05;
    }
  }
  if (state.gameSpeed < 2.5) state.gameSpeed += dt * 0.000005;

  // ── Wave director
  if (state.waveBannerTime > 0) state.waveBannerTime -= dt;
  if (!state.waveActive && !state.bossActive) {
    state.interWaveTimer -= dt;
    if (state.interWaveTimer <= 0) startWave(state.wave + 1);
  } else if (state.waveActive) {
    state.waveSpawnTimer += dt;
    while (state.waveQueue.length && state.waveQueue[0].time <= state.waveSpawnTimer) {
      const item = state.waveQueue.shift();
      if (item.opts.meteor) spawnMeteor();
      else spawnEnemy(item.opts);
    }
    if (state.waveQueue.length === 0 && state.enemies.length === 0 && state.meteors.length === 0 && !state.bossActive && !state.bossPending) {
      state.waveActive = false;
      state.interWaveTimer = 1500;
      addFloatingText(CANVAS_W / 2, CANVAS_H / 2, `WAVE ${state.wave} CLEAR`, '#00ffff', 2.0, -0.4);
      // Random pickup reward
      spawnPickup(choose(['armor','dash','bomb','gem']), CANVAS_W / 2, 200);
    }
  }

  // Random pickup drops during waves
  if (state.waveActive && Math.random() < 0.0008 * dts) {
    spawnPickup(undefined, rand(40, CANVAS_W - 40), -20);
  }

  // ── Enemies
  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const e = state.enemies[i];
    e.flash = Math.max(0, e.flash - dt);
    e.swayAngle += 0.03 * dts;

    if (e.arch === 'kamikaze') {
      const dx = state.player.x - e.x;
      e.x += Math.sign(dx) * Math.min(Math.abs(dx), 2.5) * dts * state.gameSpeed;
      e.y += e.speed * dts * state.gameSpeed;
    } else if (e.arch === 'sniper') {
      if (e.state === 'approach') {
        e.y += e.speed * dts * state.gameSpeed;
        if (e.y >= e.targetY) e.state = 'fight';
      } else {
        e.x += Math.sin(e.swayAngle) * 0.4 * dts;
        if (now - e.lastShot > e.shotCooldown / state.gameSpeed) {
          e.lastShot = now;
          enemyShoot(e, now);
        }
      }
    } else if (e.arch === 'drone') {
      e.x += Math.sin(e.swayAngle + e.formationPhase) * 1.4 * dts;
      e.y += e.speed * dts * state.gameSpeed;
    } else {
      e.x += Math.sin(e.swayAngle) * e.sway * dts;
      e.y += e.speed * dts * state.gameSpeed;
      if (e.shotCooldown > 0 && now - e.lastShot > e.shotCooldown / state.gameSpeed && e.y > 0 && e.y < CANVAS_H - 200) {
        e.lastShot = now;
        enemyShoot(e, now);
      }
    }

    // Smoke when low HP
    if (e.hp / e.maxHp < 0.4 && Math.random() < 0.15 * dts) {
      spawnParticle(e.x + rand(-e.w/3, e.w/3), e.y + rand(-e.h/3, e.h/3), rand(-0.5,0.5), rand(-1,0.5), rand(2,4), '#444444', 0.03);
    }

    if (e.y > CANVAS_H + 60) { state.enemies.splice(i, 1); continue; }

    if (p.invincible <= 0 && state.dashIframes <= 0 && rectsOverlap(p, e)) {
      hitPlayer();
      e.hp = 0;
      onEnemyDeath(e, i, true);
    }
  }

  // ── Meteors
  for (let i = state.meteors.length - 1; i >= 0; i--) {
    const m = state.meteors[i];
    m.flash = Math.max(0, m.flash - dt);
    m.y += m.speed * dts * state.gameSpeed;
    m.rot += m.rotSpeed * dts;
    if (m.y > CANVAS_H + 60) { state.meteors.splice(i, 1); continue; }
    if (p.invincible <= 0 && state.dashIframes <= 0 && rectsOverlap(p, m)) {
      hitPlayer();
      state.meteors.splice(i, 1);
    }
  }

  // ── Boss
  if (state.boss) updateBoss(dt, now);
  // collision with boss body
  if (state.boss && p.invincible <= 0 && state.dashIframes <= 0) {
    if (Math.abs(p.x - state.boss.x) < state.boss.w / 2 + p.w / 2 &&
        Math.abs(p.y - state.boss.y) < state.boss.h / 2 + p.h / 2) {
      hitPlayer();
    }
  }

  // ── Bullets
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const b = state.bullets[i];
    if (b.type === 'rocket') {
      let nearest = null, nd = Infinity;
      for (const e of state.enemies) {
        const d = dist2(e.x, e.y, b.x, b.y);
        if (d < nd && d < 160000) { nd = d; nearest = e; }
      }
      if (state.boss && !nearest) nearest = state.boss;
      if (nearest) {
        const desired = Math.atan2(nearest.y - b.y, nearest.x - b.x);
        const diff = angleDiff(desired, b.angle);
        b.angle += Math.sign(diff) * Math.min(Math.abs(diff), b.turnRate * dts);
      }
      const thrust = 0.6 * dts * state.gameSpeed;
      b.vx += Math.cos(b.angle) * thrust;
      b.vy += Math.sin(b.angle) * thrust;
      b.vx *= Math.pow(0.96, dts);
      b.vy *= Math.pow(0.96, dts);
      b.x += b.vx * dts;
      b.y += b.vy * dts;
      // Smoke trail
      if (Math.random() < 0.5) spawnParticle(b.x, b.y, rand(-0.3, 0.3), rand(0.5, 1.5), rand(2, 4), '#ff8800', 0.04);
    } else if (b.type === 'charged') {
      b.y -= b.speed * dts;
      b.life -= dt;
      if (Math.random() < 0.5) spawnParticle(b.x + rand(-b.w/2, b.w/2), b.y + rand(0, b.h/2), rand(-1,1), rand(0,2), rand(2,5), b.color, 0.05);
      if (b.life <= 0) { state.bullets.splice(i, 1); continue; }
    } else {
      b.x += (b.dx || 0) * dts;
      b.y -= b.speed * dts;
    }

    if (b.y < -40 || b.x < -30 || b.x > CANVAS_W + 30) { state.bullets.splice(i, 1); continue; }

    // hit enemies
    let hit = false;
    for (let j = state.enemies.length - 1; j >= 0; j--) {
      const e = state.enemies[j];
      if (rectsOverlap(b, e)) {
        // Shielded enemy: only damaged from sides/back
        if (e.arch === 'shielded' && b.y < e.y) {
          // Bounce off top arc
          explode(b.x, b.y, '#88ccff', 5);
          hit = true; break;
        }
        e.hp -= b.damage;
        e.flash = 90;
        explode(b.x, b.y, b.color, 4);
        state.shotsHit++;
        if (e.hp <= 0) onEnemyDeath(e, j);
        if (b.type !== 'charged') { hit = true; break; }
        else { b.pierce--; if (b.pierce <= 0) { hit = true; break; } }
      }
    }
    if (hit) { state.bullets.splice(i, 1); continue; }

    // hit meteors
    for (let j = state.meteors.length - 1; j >= 0; j--) {
      const m = state.meteors[j];
      if (rectsOverlap(b, m)) {
        m.hp -= b.damage;
        m.flash = 80;
        explode(b.x, b.y, '#aaaa99', 4);
        state.shotsHit++;
        if (m.hp <= 0) {
          explode(m.x, m.y, '#998877', 18);
          sfx.meteorExplode();
          state.score += 40;
          state.meteors.splice(j, 1);
        }
        if (b.type !== 'charged') { hit = true; break; }
        else { b.pierce--; if (b.pierce <= 0) { hit = true; break; } }
      }
    }
    if (hit) { state.bullets.splice(i, 1); continue; }

    // hit boss
    if (state.boss && bossHitTest(state.boss, b)) {
      damageBoss(state.boss, b.x, b.y, b.damage);
      explode(b.x, b.y, b.color, 5);
      state.shotsHit++;
      if (b.type !== 'charged') { hit = true; }
      else { b.pierce--; if (b.pierce <= 0) hit = true; }
      if (hit) state.bullets.splice(i, 1);
    }
  }

  // ── Enemy bullets
  for (let i = state.enemyBullets.length - 1; i >= 0; i--) {
    const eb = state.enemyBullets[i];
    eb.x += eb.vx * dts;
    eb.y += eb.vy * dts;
    if (eb.y > CANVAS_H + 30 || eb.y < -30 || eb.x < -30 || eb.x > CANVAS_W + 30) {
      state.enemyBullets.splice(i, 1); continue;
    }
    if (p.invincible <= 0 && state.dashIframes <= 0 && rectsOverlap({x:eb.x,y:eb.y,w:eb.w,h:eb.h}, p)) {
      hitPlayer();
      state.enemyBullets.splice(i, 1);
    }
  }

  // ── Pickups
  for (let i = state.pickups.length - 1; i >= 0; i--) {
    const pk = state.pickups[i];
    pk.y += pk.speed * dts * state.gameSpeed;
    pk.bob += dt * 0.005;
    // Magnet pull when close
    const dx = p.x - pk.x, dy = p.y - pk.y;
    const d = Math.hypot(dx, dy);
    if (d < 140) {
      pk.x += (dx / d) * 4 * dts;
      pk.y += (dy / d) * 4 * dts;
    }
    if (pk.y > CANVAS_H + 40) { state.pickups.splice(i, 1); continue; }
    if (rectsOverlap(p, pk)) {
      applyPickup(pk);
      state.pickups.splice(i, 1);
    }
  }

  // ── Particles
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const pa = state.particles[i];
    if (pa.ring) {
      pa.r += pa.growth * dts;
      pa.life -= pa.decay * dts;
    } else {
      pa.x += pa.vx * dts;
      pa.y += pa.vy * dts;
      pa.vx *= Math.pow(0.96, dts);
      pa.vy *= Math.pow(0.96, dts);
      pa.life -= pa.decay * dts;
    }
    if (pa.life <= 0) state.particles.splice(i, 1);
  }

  // ── Afterimages
  for (let i = state.afterimages.length - 1; i >= 0; i--) {
    const a = state.afterimages[i];
    a.t += dt * 0.001;
    if (a.t >= a.life) state.afterimages.splice(i, 1);
  }

  // ── Floating text
  for (let i = state.floatingTexts.length - 1; i >= 0; i--) {
    const ft = state.floatingTexts[i];
    ft.y += ft.dy * dts;
    ft.life -= dt * 0.001;
    ft.age += dt * 0.001;
    if (ft.life <= 0) state.floatingTexts.splice(i, 1);
  }

  // ── Shake & flash decay
  state.shake *= Math.pow(SHAKE_DECAY, dts);
  if (state.shake < 0.1) state.shake = 0;
  if (state.flash > 0) state.flash = Math.max(0, state.flash - dt * 0.003);

  checkWeaponUpgrade();
}

function onEnemyDeath(e, idx, byCollision = false) {
  explode(e.x, e.y, e.arch === 'kamikaze' ? '#ff6600' : '#ffaa00', 22);
  sfx.enemyExplode();
  addShake(2);
  state.enemies.splice(idx, 1);
  if (!byCollision) {
    bumpCombo();
    state.enemiesKilled++;
    const mult = COMBO_TIERS[state.comboTier];
    let baseScore = 100;
    if (e.arch === 'kamikaze') baseScore = 80;
    else if (e.arch === 'sniper') baseScore = 180;
    else if (e.arch === 'drone') baseScore = 50;
    else if (e.arch === 'shielded') baseScore = 220;
    state.score += baseScore * mult;
    if (mult > 1) addFloatingText(e.x, e.y, `+${baseScore * mult}`, '#ffdd44', 0.9, -1.3);
  }
  // Pickup chance
  const dropRoll = Math.random();
  if (e.arch === 'shielded' && dropRoll < 0.7) spawnPickup(undefined, e.x, e.y);
  else if (dropRoll < 0.08) spawnPickup(undefined, e.x, e.y);
  // Kamikaze shrapnel
  if (e.arch === 'kamikaze') {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      state.enemyBullets.push({
        x: e.x, y: e.y, w: 6, h: 6,
        vx: Math.cos(a) * 4.5, vy: Math.sin(a) * 4.5,
        damage: 1, color: '#ff6600',
      });
    }
  }
}

function hitPlayer() {
  const p = state.player;
  if (p.armor > 0) {
    p.armor = Math.max(0, p.armor - 25);
    p.invincible = 600;
    sfx.playerHit();
    explode(p.x, p.y, '#00ffff', 14);
    addShake(8);
    return;
  }
  state.lives--;
  resetCombo();
  p.invincible = 2200;
  sfx.playerHit();
  explode(p.x, p.y, '#ff2222', 24);
  addShake(18);
  state.flash = 0.5; state.flashColor = '#ff0000';
  if (state.lives <= 0) endGame();
}

// ═══ 17. Draw ═════════════════════════════════════════════════════════════
function drawBackground() {
  // Tile background canvas with parallax
  const off = state.bgScroll * 0.3;
  wctx.drawImage(bgCanvas, 0, off - bgCanvas.height);
  wctx.drawImage(bgCanvas, 0, off);

  // Mid stars
  wctx.fillStyle = '#ffffff';
  for (const s of state.starsFar) {
    const a = 0.3 + Math.sin(s.twinkle) * 0.2 + s.bright * 0.4;
    wctx.globalAlpha = a;
    wctx.beginPath(); wctx.arc(s.x, s.y, s.r, 0, TAU); wctx.fill();
  }
  for (const s of state.starsMid) {
    const a = 0.5 + Math.sin(s.twinkle * 1.5) * 0.25 + s.bright * 0.3;
    wctx.globalAlpha = a;
    wctx.fillStyle = '#cce0ff';
    wctx.beginPath(); wctx.arc(s.x, s.y, s.r, 0, TAU); wctx.fill();
  }
  for (const s of state.starsNear) {
    const a = 0.7 + Math.sin(s.twinkle * 2) * 0.3 + s.bright * 0.3;
    wctx.globalAlpha = Math.min(1, a);
    wctx.fillStyle = '#ffffff';
    wctx.beginPath(); wctx.arc(s.x, s.y, s.r, 0, TAU); wctx.fill();
    // streak
    wctx.fillRect(s.x - 0.5, s.y - s.speed * 4, 1, s.speed * 4);
  }
  wctx.globalAlpha = 1;
}

function drawEnemy(e) {
  wctx.save();
  wctx.translate(e.x, e.y);
  wctx.drawImage(e.sprite, -e.sprite.width / 2, -e.sprite.height / 2);

  // Shielded arc
  if (e.arch === 'shielded' && e.hp > 0) {
    wctx.strokeStyle = `rgba(120, 200, 255, ${0.5 + Math.sin(performance.now() * 0.005) * 0.2})`;
    wctx.lineWidth = 3;
    wctx.shadowColor = '#88ccff';
    wctx.shadowBlur = 12;
    wctx.beginPath();
    wctx.arc(0, 0, e.w / 2 + 8, Math.PI * 1.1, Math.PI * 1.9);
    wctx.stroke();
  }

  // Hit flash overlay
  if (e.flash > 0) {
    wctx.globalCompositeOperation = 'lighter';
    wctx.globalAlpha = e.flash / 90;
    wctx.drawImage(e.sprite, -e.sprite.width / 2, -e.sprite.height / 2);
    wctx.globalAlpha = 1;
    wctx.globalCompositeOperation = 'source-over';
  }

  // HP bar (only if damaged)
  if (e.hp < e.maxHp && e.hp > 0) {
    wctx.shadowBlur = 0;
    wctx.fillStyle = 'rgba(60, 0, 0, 0.7)';
    wctx.fillRect(-e.w / 2, -e.h / 2 - 10, e.w, 4);
    wctx.fillStyle = '#ff3333';
    wctx.fillRect(-e.w / 2, -e.h / 2 - 10, e.w * (e.hp / e.maxHp), 4);
  }

  wctx.restore();
}

function drawMeteor(m) {
  wctx.save();
  wctx.translate(m.x, m.y);
  wctx.rotate(m.rot);
  wctx.shadowColor = '#553311';
  wctx.shadowBlur = 8;
  // Body gradient
  const grad = wctx.createRadialGradient(-m.size / 4, -m.size / 4, 1, 0, 0, m.size / 2);
  grad.addColorStop(0, '#aa9977');
  grad.addColorStop(1, '#443322');
  wctx.fillStyle = grad;
  const sides = 9;
  wctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const ang = (i / sides) * TAU;
    const r = m.size / 2 * (0.75 + Math.sin(i * 137.5 + m.size) * 0.25);
    const x = Math.cos(ang) * r, y = Math.sin(ang) * r;
    i === 0 ? wctx.moveTo(x, y) : wctx.lineTo(x, y);
  }
  wctx.closePath();
  wctx.fill();
  wctx.strokeStyle = '#221100';
  wctx.lineWidth = 1;
  wctx.stroke();
  // Crater
  wctx.fillStyle = 'rgba(0,0,0,0.3)';
  wctx.beginPath();
  wctx.arc(m.size * 0.1, m.size * 0.05, m.size * 0.15, 0, TAU);
  wctx.fill();
  if (m.flash > 0) {
    wctx.globalCompositeOperation = 'lighter';
    wctx.fillStyle = `rgba(255,255,255,${m.flash / 80 * 0.6})`;
    wctx.beginPath();
    wctx.arc(0, 0, m.size / 2, 0, TAU);
    wctx.fill();
    wctx.globalCompositeOperation = 'source-over';
  }
  wctx.restore();
}

function drawBullet(b) {
  wctx.save();
  wctx.shadowColor = b.color;
  wctx.shadowBlur = 12;
  if (b.type === 'laser') {
    wctx.fillStyle = '#ffffff';
    wctx.fillRect(b.x - b.w / 2 + 1, b.y - b.h / 2, b.w - 2, b.h);
    wctx.fillStyle = b.color;
    wctx.fillRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);
  } else if (b.type === 'rocket') {
    wctx.translate(b.x, b.y);
    wctx.rotate(b.angle + Math.PI / 2);
    wctx.fillStyle = b.color;
    wctx.beginPath();
    wctx.ellipse(0, 0, b.w / 2, b.h / 2, 0, 0, TAU);
    wctx.fill();
    wctx.fillStyle = '#ffff66';
    wctx.beginPath();
    wctx.moveTo(-4, b.h / 2);
    wctx.lineTo(0, b.h / 2 + 10);
    wctx.lineTo(4, b.h / 2);
    wctx.closePath();
    wctx.fill();
  } else if (b.type === 'charged') {
    wctx.fillStyle = b.color;
    wctx.shadowBlur = 25;
    wctx.beginPath();
    wctx.ellipse(b.x, b.y, b.w / 2, b.h / 2, 0, 0, TAU);
    wctx.fill();
    wctx.fillStyle = '#ffffff';
    wctx.shadowBlur = 0;
    wctx.beginPath();
    wctx.ellipse(b.x, b.y, b.w / 4, b.h / 3, 0, 0, TAU);
    wctx.fill();
  } else {
    wctx.fillStyle = b.color;
    wctx.fillRect(b.x - b.w / 2, b.y - b.h, b.w, b.h);
    wctx.fillStyle = '#ffffff';
    wctx.fillRect(b.x - 1, b.y - b.h + 1, 2, b.h - 2);
  }
  wctx.restore();
}

function drawEnemyBullet(eb) {
  wctx.save();
  wctx.shadowColor = eb.color;
  wctx.shadowBlur = 14;
  wctx.fillStyle = eb.color;
  wctx.beginPath();
  wctx.arc(eb.x, eb.y, eb.w, 0, TAU);
  wctx.fill();
  wctx.shadowBlur = 0;
  wctx.fillStyle = '#ffffff';
  wctx.beginPath();
  wctx.arc(eb.x, eb.y, eb.w * 0.4, 0, TAU);
  wctx.fill();
  wctx.restore();
}

function drawParticles() {
  for (const pa of state.particles) {
    wctx.globalAlpha = Math.max(0, pa.life);
    wctx.shadowColor = pa.color;
    wctx.shadowBlur = 8;
    if (pa.ring) {
      wctx.strokeStyle = pa.color;
      wctx.lineWidth = 3 * pa.life;
      wctx.beginPath();
      wctx.arc(pa.x, pa.y, pa.r, 0, TAU);
      wctx.stroke();
    } else {
      wctx.fillStyle = pa.color;
      wctx.beginPath();
      wctx.arc(pa.x, pa.y, pa.r, 0, TAU);
      wctx.fill();
    }
  }
  wctx.globalAlpha = 1;
  wctx.shadowBlur = 0;
}

function drawAfterimages() {
  for (const a of state.afterimages) {
    const t = 1 - (a.t / a.life);
    wctx.globalAlpha = t * 0.4;
    wctx.shadowColor = '#88ffff';
    wctx.shadowBlur = 10;
    wctx.fillStyle = '#88ffff';
    wctx.beginPath();
    wctx.ellipse(a.x, a.y, state.player.w / 2 * t, state.player.h / 2 * t, 0, 0, TAU);
    wctx.fill();
  }
  wctx.globalAlpha = 1;
}

function drawFloatingText() {
  wctx.textAlign = 'center';
  for (const ft of state.floatingTexts) {
    wctx.font = ft.text.length > 16 ? 'bold 22px Orbitron, monospace' : 'bold 28px "Press Start 2P", monospace';
    wctx.globalAlpha = Math.max(0, Math.min(1, ft.life * 1.5));
    wctx.shadowColor = ft.color;
    wctx.shadowBlur = 14;
    wctx.fillStyle = '#000000';
    wctx.fillText(ft.text, ft.x + 2, ft.y + 2);
    wctx.fillStyle = ft.color;
    wctx.fillText(ft.text, ft.x, ft.y);
  }
  wctx.globalAlpha = 1;
  wctx.shadowBlur = 0;
}

function drawHUD() {
  // Top bar background
  ctx.fillStyle = 'rgba(0, 10, 30, 0.55)';
  ctx.fillRect(0, 0, CANVAS_W, 60);
  ctx.strokeStyle = '#00ffff44';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, 60); ctx.lineTo(CANVAS_W, 60); ctx.stroke();

  // Score
  ctx.font = 'bold 26px Orbitron, monospace';
  ctx.textAlign = 'left';
  ctx.shadowColor = '#00ffff';
  ctx.shadowBlur = 4;
  ctx.fillStyle = '#00ffff';
  ctx.fillText('SCORE', 14, 22);
  ctx.fillStyle = '#ffffff';
  ctx.shadowBlur = 4;
  ctx.font = 'bold 28px Orbitron, monospace';
  ctx.fillText(String(state.score).padStart(7, '0'), 14, 50);

  // Wave & weapon (center)
  ctx.textAlign = 'center';
  ctx.font = 'bold 16px "Press Start 2P", monospace';
  ctx.fillStyle = '#ffaa00';
  ctx.shadowColor = '#ffaa00';
  ctx.shadowBlur = 4;
  ctx.fillText(`WAVE ${state.wave || 1}`, CANVAS_W / 2, 24);
  ctx.font = 'bold 14px Orbitron, monospace';
  ctx.fillStyle = WEAPONS[state.weaponTier].color;
  ctx.shadowColor = WEAPONS[state.weaponTier].color;
  ctx.shadowBlur = 4;
  ctx.fillText(WEAPONS[state.weaponTier].name.toUpperCase(), CANVAS_W / 2, 48);

  // Lives (top right area, shifted to leave room for buttons)
  ctx.textAlign = 'right';
  ctx.shadowBlur = 8;
  for (let i = 0; i < 3; i++) {
    const lit = i < state.lives;
    ctx.fillStyle = lit ? '#ff4488' : '#330011';
    ctx.shadowColor = lit ? '#ff4488' : 'transparent';
    drawHeart(CANVAS_W - 200 + i * 30, 22, 10);
  }

  // High score
  ctx.font = 'bold 12px Orbitron, monospace';
  ctx.fillStyle = '#ffdd66';
  ctx.shadowColor = '#ffaa00';
  ctx.shadowBlur = 4;
  ctx.fillText(`HI: ${state.highscore}`, CANVAS_W - 130, 50);

  // Combo meter
  if (state.combo > 0) {
    const tier = COMBO_TIERS[state.comboTier];
    const meterW = 220;
    const meterH = 8;
    const mx = CANVAS_W / 2 - meterW / 2;
    const my = 70;
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(mx, my, meterW, meterH);
    const t = clamp(state.comboTimer / COMBO_WINDOW, 0, 1);
    ctx.fillStyle = `hsl(${30 + state.comboTier * 40}, 100%, 55%)`;
    ctx.fillRect(mx, my, meterW * t, meterH);
    ctx.font = 'bold 18px "Press Start 2P", monospace';
    ctx.fillStyle = `hsl(${30 + state.comboTier * 40}, 100%, 60%)`;
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 6;
    ctx.textAlign = 'center';
    ctx.fillText(`×${tier} COMBO  (${state.combo})`, CANVAS_W / 2, my + 30);
  }

  // Armor bar (left)
  if (state.player.armor > 0) {
    const aw = 160, ah = 8;
    const ax = 14, ay = 70;
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(ax, ay, aw, ah);
    ctx.fillStyle = '#00ffff';
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 8;
    ctx.fillRect(ax, ay, aw * (state.player.armor / state.player.maxArmor), ah);
    ctx.font = 'bold 11px Orbitron, monospace';
    ctx.fillStyle = '#88ddff';
    ctx.textAlign = 'left';
    ctx.fillText('SHIELD', ax, ay - 2);
  }

  // Bombs / Dashes (bottom-left)
  ctx.shadowBlur = 8;
  ctx.font = 'bold 14px Orbitron, monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ff44aa';
  ctx.shadowColor = '#ff44aa';
  for (let i = 0; i < state.bombs; i++) {
    ctx.beginPath(); ctx.arc(20 + i * 22, CANVAS_H - 22, 7, 0, TAU); ctx.fill();
  }
  ctx.fillStyle = '#ff44aa';
  ctx.fillText(`B × ${state.bombs}`, 20, CANVAS_H - 38);

  ctx.fillStyle = '#88ff44';
  ctx.shadowColor = '#88ff44';
  for (let i = 0; i < state.dashes; i++) {
    ctx.beginPath();
    ctx.moveTo(140 + i * 22, CANVAS_H - 28);
    ctx.lineTo(150 + i * 22, CANVAS_H - 22);
    ctx.lineTo(140 + i * 22, CANVAS_H - 16);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = '#88ff44';
  ctx.fillText(`SHIFT × ${state.dashes}`, 140, CANVAS_H - 38);

  // Boss bar (top, below HUD)
  if (state.boss) {
    const bx = 80, by = 70, bw = CANVAS_W - 160, bh = 14;
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = '#660033';
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = '#ff2266';
    ctx.shadowColor = '#ff2266';
    ctx.shadowBlur = 12;
    ctx.fillRect(bx, by, bw * (state.boss.hp / state.boss.maxHp), bh);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, bw, bh);
    ctx.font = 'bold 14px "Press Start 2P", monospace';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#ff44aa';
    ctx.textAlign = 'center';
    ctx.fillText('— DREADNOUGHT —', CANVAS_W / 2, by - 4);
  }

  ctx.shadowBlur = 0;
}

function drawHeart(x, y, size) {
  ctx.beginPath();
  ctx.moveTo(x, y + size * 0.3);
  ctx.bezierCurveTo(x, y, x - size, y, x - size, y + size * 0.4);
  ctx.bezierCurveTo(x - size, y + size * 0.85, x, y + size * 1.0, x, y + size * 1.3);
  ctx.bezierCurveTo(x, y + size * 1.0, x + size, y + size * 0.85, x + size, y + size * 0.4);
  ctx.bezierCurveTo(x + size, y, x, y, x, y + size * 0.3);
  ctx.fill();
}

function drawWaveBanner() {
  if (state.waveBannerTime <= 0) return;
  const t = state.waveBannerTime / 2200;
  const alpha = t > 0.8 ? (1 - t) * 5 : (t < 0.2 ? t * 5 : 1);
  ctx.save();
  ctx.globalAlpha = clamp(alpha, 0, 1);
  ctx.font = 'bold 64px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  const isBoss = state.waveBannerText.includes('BOSS');
  const c = isBoss ? '#ff44aa' : '#00ffff';
  ctx.shadowColor = c;
  ctx.shadowBlur = 8;
  ctx.fillStyle = '#000';
  ctx.fillText(state.waveBannerText, CANVAS_W / 2 + 3, CANVAS_H / 2 + 3);
  ctx.fillStyle = c;
  ctx.fillText(state.waveBannerText, CANVAS_W / 2, CANVAS_H / 2);
  ctx.restore();
}

function applyBloomToMain() {
  // Downscale world to bloom buffer with screen blend, then blur, then composite back
  bctx.clearRect(0, 0, bloomCanvas.width, bloomCanvas.height);
  bctx.filter = 'brightness(1.4) saturate(1.4) blur(2px)';
  bctx.drawImage(worldCanvas, 0, 0, bloomCanvas.width, bloomCanvas.height);
  bctx.filter = 'none';

  // Composite world to main
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.drawImage(worldCanvas, 0, 0);
  // Add bloom additively
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.55;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(bloomCanvas, 0, 0, CANVAS_W, CANVAS_H);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

function draw() {
  wctx.setTransform(1, 0, 0, 1, 0, 0);
  wctx.fillStyle = '#000010';
  wctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  // Apply screen shake
  const sx = (Math.random() - 0.5) * state.shake;
  const sy = (Math.random() - 0.5) * state.shake;
  wctx.translate(sx, sy);

  drawBackground();

  drawAfterimages();
  for (const m of state.meteors) drawMeteor(m);
  for (const e of state.enemies) drawEnemy(e);
  for (const pk of state.pickups) drawPickup(pk);
  if (state.boss) drawBoss();
  for (const b of state.bullets) drawBullet(b);
  for (const eb of state.enemyBullets) drawEnemyBullet(eb);
  drawParticles();
  drawPlayer();
  drawFloatingText();

  // White flash (full screen)
  if (state.flash > 0) {
    wctx.setTransform(1, 0, 0, 1, 0, 0);
    wctx.fillStyle = `rgba(${state.flashColor === '#ff0000' ? '255,40,40' : '255,255,255'}, ${state.flash})`;
    wctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }

  // Composite to main with bloom
  applyBloomToMain();

  // Draw HUD and wave banner on main ctx AFTER bloom so they are sharp
  drawWaveBanner();
  drawHUD();
}

// ═══ 18. Game flow ════════════════════════════════════════════════════════
function startGame() {
  state = initState();
  state.running = true;
  state.interWaveTimer = 1200;
  document.getElementById('start-screen').classList.add('hidden');
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
document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('restart-btn').addEventListener('click', startGame);
document.getElementById('resume-btn').addEventListener('click', togglePause);
document.getElementById('quit-btn').addEventListener('click', quitToMenu);
document.getElementById('pause-btn').addEventListener('click', togglePause);
document.getElementById('crt-btn').addEventListener('click', toggleCRT);
document.getElementById('mute-btn').addEventListener('click', () => {
  const muted = sfx.toggleMute();
  document.getElementById('mute-btn').textContent = muted ? '🔇' : '🔊';
  if (!muted && state.running) sfx.startBgm(state.bossActive ? 'boss' : 'play');
});

// Show a static title-screen background
(function paintTitleBg() {
  wctx.setTransform(1, 0, 0, 1, 0, 0);
  drawBackground();
  applyBloomToMain();
})();
