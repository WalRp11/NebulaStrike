/* ============================================================================
  NEBULA STRIKE — Enemies & Bosses
  Enemy archetypes, waves, bosses, and related combat routines.
============================================================================ */

// ═══ 10. Enemies ══════════════════════════════════════════════════════════
const ARCHETYPES = ['grunt', 'kamikaze', 'sniper', 'drone', 'shielded', 'specter', 'swarm', 'pulsar', 'tank', 'phantom'];

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

    } else if (arch === 'specter') {
      // Ghostly phase-shifter (semi-transparent)
      g.fillStyle = `hsla(${hue}, 80%, 50%, 0.8)`;
      g.beginPath();
      g.moveTo(0, -h / 2);
      g.bezierCurveTo(w / 3, -h / 4, w / 3, h / 4, 0, h / 2);
      g.bezierCurveTo(-w / 3, h / 4, -w / 3, -h / 4, 0, -h / 2);
      g.closePath();
      g.fill();
      // Glow eye
      g.fillStyle = '#00ff66';
      g.shadowColor = '#00ff66';
      g.shadowBlur = 12;
      g.beginPath(); g.arc(0, 0, 4, 0, TAU); g.fill();

    } else if (arch === 'swarm') {
      // Cluster of small segments
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU;
        const ox = Math.cos(a) * (w / 4);
        const oy = Math.sin(a) * (w / 4);
        g.fillStyle = `hsl(${hue + i * 20}, 100%, 50%)`;
        g.beginPath();
        g.arc(ox, oy, w / 6, 0, TAU);
        g.fill();
      }
      g.fillStyle = `hsl(${hue}, 100%, 70%)`;
      g.beginPath(); g.arc(0, 0, w / 8, 0, TAU); g.fill();

    } else if (arch === 'pulsar') {
      // Pulsing spherical burster
      g.fillStyle = `hsl(${hue}, 90%, 45%)`;
      g.beginPath();
      g.arc(0, 0, w / 2, 0, TAU);
      g.fill();
      g.strokeStyle = `hsl(${hue}, 100%, 70%)`;
      g.lineWidth = 2;
      g.stroke();
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU;
        g.strokeStyle = `hsl(${hue}, 100%, 60%)`;
        g.lineWidth = 1;
        g.beginPath();
        g.arc(0, 0, (i + 1) * (w / 10), 0, TAU);
        g.stroke();
      }

    } else if (arch === 'tank') {
      // Heavy armored slow unit
      g.fillStyle = `hsl(${hue}, 50%, 30%)`;
      g.fillRect(-w / 2, -h / 2, w, h);
      g.strokeStyle = `hsl(${hue}, 80%, 60%)`;
      g.lineWidth = 2.5;
      g.strokeRect(-w / 2, -h / 2, w, h);
      // Turret
      g.fillStyle = '#333333';
      g.beginPath();
      g.arc(0, 0, w / 4, 0, TAU);
      g.fill();
      g.fillStyle = '#ffff00';
      g.shadowColor = '#ffff00';
      g.shadowBlur = 8;
      g.fillRect(-w / 8, -2, w / 4, 4);

    } else if (arch === 'phantom') {
      // Ethereal darting enemy
      g.fillStyle = `hsl(${hue}, 70%, 35%)`;
      g.beginPath();
      g.moveTo(0, -h / 2);
      g.lineTo(w / 2, -h / 4);
      g.lineTo(w / 3, h / 3);
      g.lineTo(0, h / 2);
      g.lineTo(-w / 3, h / 3);
      g.lineTo(-w / 2, -h / 4);
      g.closePath();
      g.fill();
      g.strokeStyle = `hsl(${hue}, 100%, 60%)`;
      g.lineWidth = 1.5;
      g.stroke();
      // Trail effect
      g.globalAlpha = 0.5;
      g.strokeStyle = `hsl(${hue}, 100%, 70%)`;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(-w / 3, h / 2);
      g.lineTo(-w / 2, h / 2 + h / 4);
      g.stroke();
      g.globalAlpha = 1;
    }
  });
}

function spawnEnemy(opts = {}) {
  const basePool = state.wave < 10 ? ['grunt', 'grunt', 'kamikaze', 'sniper', 'drone'] :
                   state.wave < 20 ? ['grunt', 'kamikaze', 'sniper', 'drone', 'shielded', 'specter', 'swarm'] :
                   ['kamikaze', 'sniper', 'drone', 'shielded', 'specter', 'swarm', 'pulsar', 'tank', 'phantom'];
  const arch = opts.archetype || choose(basePool);
  const tierBonus = Math.floor(state.wave / 3);
  let w, h, hp, speed;

  switch (arch) {
    case 'kamikaze': w = 36; h = 36; hp = 2 + tierBonus; speed = 3.2 + tierBonus * 0.3; break;
    case 'sniper':   w = 44; h = 50; hp = 4 + tierBonus * 1.5; speed = 0.9 + tierBonus * 0.2; break;
    case 'drone':    w = 22; h = 22; hp = 1 + tierBonus * 0.5; speed = 1.6 + tierBonus * 0.25; break;
    case 'shielded': w = 56; h = 60; hp = 8 + tierBonus * 2; speed = 1.0 + tierBonus * 0.2; break;
    case 'specter':  w = 40; h = 44; hp = 3 + tierBonus; speed = 2.0 + tierBonus * 0.4; break;
    case 'swarm':    w = 28; h = 28; hp = 1 + tierBonus * 0.3; speed = 2.2 + tierBonus * 0.35; break;
    case 'pulsar':   w = 42; h = 42; hp = 5 + tierBonus * 1.2; speed = 1.2 + tierBonus * 0.25; break;
    case 'tank':     w = 60; h = 50; hp = 12 + tierBonus * 2.5; speed = 0.6 + tierBonus * 0.15; break;
    case 'phantom':  w = 36; h = 40; hp = 2 + tierBonus * 0.8; speed = 2.8 + tierBonus * 0.5; break;
    case 'grunt':
    default:         w = 38; h = 42; hp = 2 + tierBonus; speed = 1.6 + tierBonus * 0.3; break;
  }

  // Apply difficulty multipliers
  hp *= state.difficultyMultipliers.enemyHpMult;
  speed *= state.difficultyMultipliers.enemySpawnMult;

  const x = opts.x !== undefined ? opts.x : rand(w, CANVAS_W - w);
  const y = opts.y !== undefined ? opts.y : -40;
  const hue = opts.hue !== undefined ? opts.hue : (
    arch === 'kamikaze' ? randi(0, 25) :
    arch === 'sniper'   ? randi(120, 180) :
    arch === 'drone'    ? randi(40, 80) :
    arch === 'shielded' ? randi(200, 260) :
    arch === 'specter'  ? randi(240, 300) :
    arch === 'swarm'    ? randi(0, 60) :
    arch === 'pulsar'   ? randi(30, 120) :
    arch === 'tank'     ? randi(180, 240) :
    arch === 'phantom'  ? randi(300, 340) :
    randi(280, 360)
  );

  state.enemies.push({
    arch, x, y, w, h, hp,
    maxHp: hp,
    speed,
    sway: arch === 'kamikaze' || arch === 'phantom' ? 0 : (Math.random() - 0.5) * 1.2,
    swayAngle: Math.random() * TAU,
    hue,
    seed: randi(0, 1000),
    sprite: makeEnemySprite(arch, hue, w, h, randi(0, 1000)),
    lastShot: performance.now() + rand(0, 1500),
    shotCooldown: arch === 'sniper' ? 1800 : arch === 'tank' ? 2200 : arch === 'pulsar' ? 1600 : arch === 'drone' ? 0 : (1400 + Math.random() * 1600),
    state: arch === 'sniper' ? 'approach' : arch === 'specter' ? 'phase' : 'normal',
    targetY: rand(180, 360),
    phaseTimer: arch === 'specter' ? rand(800, 1200) : 0,
    flash: 0,
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
  const bulletMass = 0.5 + (e.arch === 'sniper' ? 0.3 : e.arch === 'tank' ? 1.2 : 0);
  const bulletDamage = (e.arch === 'sniper' ? 1.2 : 1) * state.difficultyMultipliers.enemyDamageMult;
  state.enemyBullets.push({
    x: e.x, y: e.y + e.h / 2, w: 7, h: 7,
    vx: Math.cos(finalAngle) * bSpeed,
    vy: Math.sin(finalAngle) * bSpeed,
    damage: bulletDamage, color: e.arch === 'sniper' ? '#00ffaa' : '#ff2222',
    mass: bulletMass,
  });
}

// ═══ 11. Wave Director & Bosses ═══════════════════════════════════════════
function startWave(n) {
  state.wave = n;
  state.waveActive = true;
  state.waveQueue = buildWave(n);
  state.waveSpawnTimer = 0;
  state.waveBannerTime = 2200;
  const bossWave = n > 0 && n % BOSS_WAVE_INTERVAL === 0;
  state.waveBannerText = bossWave ? `BOSS WAVE ${n}` : `WAVE ${n}`;
  state.bossPending = bossWave;
  sfx.waveStart();
  if (bossWave) {
    setTimeout(() => { if (state.running) spawnBoss(n); }, 2000);
  }
}

function buildWave(n) {
  const q = [];
  if (n % BOSS_WAVE_INTERVAL === 0) return q; // boss waves: no regular spawns

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
  const tier = Math.floor(waveNum / BOSS_WAVE_INTERVAL);
  const bossType = ['dreadnought', 'corsair', 'leviathan'][tier % 3];
  let hp = bossType === 'dreadnought' ? (80 + tier * 70) :
           bossType === 'corsair' ? (100 + tier * 80) :
           (140 + tier * 100);
  
  // Apply difficulty multiplier to boss HP
  hp *= state.difficultyMultipliers.bossHpMult;

  // Create cores with difficulty-adjusted HP
  let cores;
  const coreHpMult = state.difficultyMultipliers.bossHpMult;
  if (bossType === 'dreadnought') {
    cores = [
      { ox: -70, oy: 30, hp: 30 * coreHpMult, maxHp: 30 * coreHpMult, dead: false },
      { ox:  70, oy: 30, hp: 30 * coreHpMult, maxHp: 30 * coreHpMult, dead: false },
      { ox:   0, oy: -10, hp: 60 * coreHpMult, maxHp: 60 * coreHpMult, dead: false },
    ];
  } else if (bossType === 'corsair') {
    cores = [
      { ox: -100, oy: 20, hp: 35 * coreHpMult, maxHp: 35 * coreHpMult, dead: false },
      { ox: -50, oy: -20, hp: 35 * coreHpMult, maxHp: 35 * coreHpMult, dead: false },
      { ox: 0, oy: -30, hp: 80 * coreHpMult, maxHp: 80 * coreHpMult, dead: false },
      { ox: 50, oy: -20, hp: 35 * coreHpMult, maxHp: 35 * coreHpMult, dead: false },
      { ox: 100, oy: 20, hp: 35 * coreHpMult, maxHp: 35 * coreHpMult, dead: false },
    ];
  } else {
    cores = [
      { ox: -120, oy: 40, hp: 40 * coreHpMult, maxHp: 40 * coreHpMult, dead: false },
      { ox: -60, oy: -30, hp: 40 * coreHpMult, maxHp: 40 * coreHpMult, dead: false },
      { ox: 0, oy: -50, hp: 100 * coreHpMult, maxHp: 100 * coreHpMult, dead: false },
      { ox: 60, oy: -30, hp: 40 * coreHpMult, maxHp: 40 * coreHpMult, dead: false },
      { ox: 120, oy: 40, hp: 40 * coreHpMult, maxHp: 40 * coreHpMult, dead: false },
    ];
  }

  state.boss = {
    x: CANVAS_W / 2, y: -120,
    type: bossType,
    w: bossType === 'corsair' ? 260 : (bossType === 'leviathan' ? 300 : 220),
    h: bossType === 'corsair' ? 120 : (bossType === 'leviathan' ? 160 : 140),
    hp, maxHp: hp,
    targetY: bossType === 'corsair' ? 240 : 220,
    state: 'enter',
    phaseTimer: 0,
    pattern: 0,
    lastAttack: 0,
    sway: 0,
    hue: (tier * 60) % 360,
    flash: 0,
    cores,
    attackCycle: 0,
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
    const swayX = b.type === 'leviathan' ? 200 : 280;
    b.x = CANVAS_W / 2 + Math.sin(b.sway) * swayX;
    b.y = b.targetY + Math.sin(b.sway * 1.4) * 30;

    // Type-specific attack patterns
    const attackInterval = b.type === 'leviathan' ? 1200 : 1500;
    if (now - b.lastAttack > attackInterval) {
      b.lastAttack = now;
      const aliveCores = b.cores.filter(c => !c.dead);

      if (b.type === 'dreadnought') {
        const pat = b.pattern % 3;
        if (pat === 0) {
          // Radial burst
          const n = 18;
          for (let i = 0; i < n; i++) {
            const a = (i / n) * TAU + (Math.random() * 0.1);
            state.enemyBullets.push({
              x: b.x, y: b.y + 20, w: 8, h: 8,
              vx: Math.cos(a) * 5, vy: Math.sin(a) * 5,
              damage: 1 * state.difficultyMultipliers.bossDamageMult, color: '#ff44ff', mass: 0.8,
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
                damage: 1 * state.difficultyMultipliers.bossDamageMult, color: '#ffaa00', mass: 0.8,
              });
            }
          }
        } else {
          // Spawn drones
          for (let i = 0; i < 3; i++) {
            spawnEnemy({ archetype: 'drone', x: b.x + rand(-80, 80), y: b.y + 60, hue: b.hue });
          }
        }
      } else if (b.type === 'corsair') {
        const pat = b.pattern % 4;
        if (pat === 0) {
          // Spread cannon fire from all cores
          for (const c of aliveCores) {
            const cx = b.x + c.ox, cy = b.y + c.oy;
            const a = Math.atan2(state.player.y - cy, state.player.x - cx);
            for (let k = -2; k <= 2; k++) {
              const ang = a + k * 0.2;
              state.enemyBullets.push({
                x: cx, y: cy, w: 8, h: 8,
                vx: Math.cos(ang) * 5.8, vy: Math.sin(ang) * 5.8,
                damage: 1 * state.difficultyMultipliers.bossDamageMult, color: '#ff6688', mass: 0.85,
              });
            }
          }
        } else if (pat === 1) {
          // Sine wave bullets from center core
          const main = aliveCores.find(c => c.hp >= 80);
          if (main) {
            const cx = b.x + main.ox, cy = b.y + main.oy;
            const n = 12;
            for (let i = 0; i < n; i++) {
              const a = (i / n) * TAU;
              state.enemyBullets.push({
                x: cx, y: cy, w: 8, h: 8,
                vx: Math.cos(a) * 6.2, vy: Math.sin(a) * 6.2,
                damage: 1 * state.difficultyMultipliers.bossDamageMult, color: '#ffaa44', mass: 0.85,
              });
            }
          }
        } else if (pat === 2) {
          // Spawn small swarms
          for (let i = 0; i < 4; i++) {
            spawnEnemy({ archetype: 'swarm', x: b.x + rand(-100, 100), y: b.y + 80, hue: b.hue });
          }
        } else {
          // Focused beam pattern at player
          const main = aliveCores.find(c => c.hp >= 80);
          if (main) {
            const cx = b.x + main.ox, cy = b.y + main.oy;
            const a = Math.atan2(state.player.y - cy, state.player.x - cx);
            for (let r = 0; r < 3; r++) {
              for (let spread = -2; spread <= 2; spread++) {
                const ang = a + spread * 0.15;
                state.enemyBullets.push({
                  x: cx, y: cy, w: 7, h: 7,
                  vx: Math.cos(ang) * (5 + r * 1.5), vy: Math.sin(ang) * (5 + r * 1.5),
                  damage: 1 * state.difficultyMultipliers.bossDamageMult, color: '#44ffff', mass: 0.85,
                });
              }
            }
          }
        }
      } else if (b.type === 'leviathan') {
        const pat = b.pattern % 5;
        if (pat === 0) {
          // Super radial burst - many bullets
          const n = 24;
          for (let i = 0; i < n; i++) {
            const a = (i / n) * TAU + (Math.random() * 0.2);
            state.enemyBullets.push({
              x: b.x, y: b.y, w: 9, h: 9,
              vx: Math.cos(a) * 6.5, vy: Math.sin(a) * 6.5,
              damage: 1.2 * state.difficultyMultipliers.bossDamageMult, color: '#ff2255', mass: 0.9,
            });
          }
        } else if (pat === 1) {
          // Spiral attack from all cores
          for (const c of aliveCores) {
            if (c.dead) continue;
            const cx = b.x + c.ox, cy = b.y + c.oy;
            for (let i = 0; i < 6; i++) {
              const a = Math.atan2(state.player.y - cy, state.player.x - cx) + i * (TAU / 6);
              state.enemyBullets.push({
                x: cx, y: cy, w: 8, h: 8,
                vx: Math.cos(a) * 6, vy: Math.sin(a) * 6,
                damage: 1 * state.difficultyMultipliers.bossDamageMult, color: '#aa44ff', mass: 0.9,
              });
            }
          }
        } else if (pat === 2) {
          // Spawn multiple enemy types
          for (let i = 0; i < 3; i++) {
            spawnEnemy({ archetype: choose(['pulsar', 'tank', 'specter']), x: b.x + rand(-120, 120), y: b.y + 100, hue: b.hue });
          }
        } else if (pat === 3) {
          // Convergent fire - all cores aim at player convergence point
          const main = aliveCores.find(c => c.hp >= 100);
          for (const c of aliveCores) {
            if (c.dead) continue;
            const cx = b.x + c.ox, cy = b.y + c.oy;
            const a = Math.atan2(state.player.y - cy, state.player.x - cx);
            for (let k = -1; k <= 1; k++) {
              const ang = a + k * 0.12;
              state.enemyBullets.push({
                x: cx, y: cy, w: 8, h: 8,
                vx: Math.cos(ang) * 7, vy: Math.sin(ang) * 7,
                damage: 1.5 * state.difficultyMultipliers.bossDamageMult, color: '#ff88ff', mass: 0.9,
              });
            }
          }
        } else {
          // Drone swarm spawn
          for (let i = 0; i < 6; i++) {
            spawnEnemy({ archetype: 'drone', x: b.x + rand(-120, 120), y: b.y + 80, hue: b.hue });
          }
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
  const waveAtDefeat = state.wave;
  for (let i = 0; i < 6; i++) {
    setTimeout(() => {
      explode(b.x + rand(-80, 80), b.y + rand(-50, 50), choose(['#ff4444','#ffaa00','#ff44ff','#ffffff']), 30);
      addShake(15);
      sfx.bigExplode();
    }, i * 180);
  }
  setTimeout(() => {
    state.score += 2000 + waveAtDefeat * 100;
    state.bombs = Math.min(MAX_BOMBS, state.bombs + 1);
    state.dashes = Math.min(MAX_DASH, state.dashes + 1);
    if (state.multiWeaponCount < state.weaponLoadout.length) {
      spawnPickup('multifire', b.x, b.y - 40);
    }
    state.boss = null;
    state.bossActive = false;
    addFloatingText(CANVAS_W / 2, CANVAS_H / 2, 'BOSS DESTROYED', '#ff44ff', 2.6, -0.5);
    addFloatingText(CANVAS_W / 2, CANVAS_H / 2 + 36, '+ BOMB & DASH', '#ffaa00', 2.4, -0.5);
    state.waveActive = false;

    if (waveAtDefeat >= FINAL_BOSS_WAVE && !state.endlessMode) {
      if (state.running) winGame();
      return;
    }
    if (state.endlessMode && waveAtDefeat >= FINAL_BOSS_WAVE) {
      sfx.endlessDepth();
      addFloatingText(CANVAS_W / 2, CANVAS_H / 2 + 72, 'SECTOR CLEAR — PUSHING DEEPER', '#88ffcc', 2.2, -0.45);
    } else {
      sfx.bossClear();
    }
    sfx.setBgmMode('play');
    if (!sfx.isMuted()) { sfx.stopBgm(); sfx.startBgm('play'); }
    state.interWaveTimer = 1500;
  }, 1300);
}

function drawBoss(now) {
  const b = state.boss;
  if (!b) return;
  wctx.save();
  wctx.translate(b.x, b.y);

  // Hit flash overlay tint
  const flashAmt = b.flash / 80;

  if (b.type === 'dreadnought') {
    // Original Dreadnought design
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

    wctx.strokeStyle = `hsla(${b.hue}, 100%, 80%, 0.6)`;
    wctx.lineWidth = 2;
    wctx.stroke();
    wctx.beginPath();
    wctx.moveTo(-b.w / 2 + 30, -b.h / 4);
    wctx.lineTo(b.w / 2 - 30, -b.h / 4);
    wctx.moveTo(-b.w / 2 + 30, b.h / 4);
    wctx.lineTo(b.w / 2 - 30, b.h / 4);
    wctx.stroke();

  } else if (b.type === 'corsair') {
    // Wider, more spread-out design with lateral wings
    wctx.shadowColor = `hsl(${b.hue}, 100%, 50%)`;
    wctx.shadowBlur = 40;
    const grad = wctx.createRadialGradient(0, 0, 15, 0, 0, 160);
    grad.addColorStop(0, `hsl(${b.hue}, 100%, 75%)`);
    grad.addColorStop(0.3, `hsl(${b.hue}, 90%, 40%)`);
    grad.addColorStop(1, `hsl(${b.hue}, 80%, 15%)`);
    wctx.fillStyle = grad;
    wctx.beginPath();
    wctx.moveTo(0, -b.h / 2);
    wctx.lineTo(b.w / 2.5, -b.h / 4);
    wctx.lineTo(b.w / 2, b.h / 3);
    wctx.lineTo(b.w / 2.5, b.h / 2);
    wctx.lineTo(0, b.h / 2 - 10);
    wctx.lineTo(-b.w / 2.5, b.h / 2);
    wctx.lineTo(-b.w / 2, b.h / 3);
    wctx.lineTo(-b.w / 2.5, -b.h / 4);
    wctx.closePath();
    wctx.fill();

    // Wing details
    wctx.strokeStyle = `hsla(${b.hue}, 100%, 85%, 0.7)`;
    wctx.lineWidth = 2.5;
    wctx.stroke();
    wctx.strokeStyle = `hsla(${b.hue}, 100%, 60%, 0.5)`;
    wctx.lineWidth = 1;
    wctx.beginPath();
    wctx.moveTo(-b.w / 3, -b.h / 8);
    wctx.lineTo(b.w / 3, -b.h / 8);
    wctx.moveTo(-b.w / 3, b.h / 8);
    wctx.lineTo(b.w / 3, b.h / 8);
    wctx.stroke();

  } else if (b.type === 'leviathan') {
    // Massive spiky octopus-like design
    wctx.shadowColor = `hsl(${b.hue}, 100%, 50%)`;
    wctx.shadowBlur = 50;
    const grad = wctx.createRadialGradient(0, 0, 20, 0, 0, 200);
    grad.addColorStop(0, `hsl(${b.hue}, 100%, 65%)`);
    grad.addColorStop(0.2, `hsl(${b.hue}, 95%, 35%)`);
    grad.addColorStop(1, `hsl(${b.hue}, 85%, 10%)`);
    wctx.fillStyle = grad;
    wctx.beginPath();
    wctx.arc(0, 0, b.w / 2.2, 0, TAU);
    wctx.fill();

    // Tentacle spikes
    wctx.strokeStyle = `hsla(${b.hue}, 100%, 80%, 0.8)`;
    wctx.lineWidth = 3;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      const x = Math.cos(a) * (b.w / 2.2);
      const y = Math.sin(a) * (b.w / 2.2);
      wctx.beginPath();
      wctx.moveTo(x, y);
      wctx.lineTo(x * 1.4, y * 1.4);
      wctx.stroke();
    }
    // Inner detail circles
    wctx.strokeStyle = `hsla(${b.hue}, 100%, 60%, 0.4)`;
    wctx.lineWidth = 1.5;
    for (let r = 0.5; r <= 1; r += 0.25) {
      wctx.beginPath();
      wctx.arc(0, 0, (b.w / 2.2) * r, 0, TAU);
      wctx.stroke();
    }
  }

  // Cores - unified rendering for all types
  for (const c of b.cores) {
    if (c.dead) {
      wctx.fillStyle = '#220000';
      wctx.shadowBlur = 0;
      const coreSize = b.type === 'leviathan' ? 16 : 14;
      wctx.beginPath(); wctx.arc(c.ox, c.oy, coreSize, 0, TAU); wctx.fill();
      continue;
    }
    const cf = c.hp / c.maxHp;
    const pulse = 0.7 + Math.sin(now * 0.01) * 0.3;
    wctx.shadowColor = '#ffffff';
    wctx.shadowBlur = 18;
    wctx.fillStyle = `rgba(255, ${Math.floor(80 + cf * 175)}, ${Math.floor(40 + cf * 215)}, ${pulse})`;
    const coreSize = b.type === 'leviathan' ? 16 : 14;
    wctx.beginPath();
    wctx.arc(c.ox, c.oy, coreSize, 0, TAU);
    wctx.fill();
    wctx.fillStyle = '#ffffff';
    wctx.beginPath();
    wctx.arc(c.ox, c.oy, coreSize / 3, 0, TAU);
    wctx.fill();
  }

  // Hit flash overlay
  if (flashAmt > 0) {
    wctx.globalCompositeOperation = 'lighter';
    wctx.fillStyle = `rgba(255,255,255,${flashAmt * 0.5})`;
    if (b.type === 'dreadnought') {
      wctx.beginPath();
      wctx.moveTo(-b.w / 2, 0);
      wctx.lineTo(-b.w / 3, -b.h / 2);
      wctx.lineTo(b.w / 3, -b.h / 2);
      wctx.lineTo(b.w / 2, 0);
      wctx.lineTo(b.w / 3, b.h / 2);
      wctx.lineTo(-b.w / 3, b.h / 2);
      wctx.closePath();
      wctx.fill();
    } else {
      wctx.beginPath();
      wctx.arc(0, 0, b.w / 2, 0, TAU);
      wctx.fill();
    }
    wctx.globalCompositeOperation = 'source-over';
  }

  wctx.restore();
}

function bossHitTest(b, bullet) {
  // Bullet vs hull AABB
  return Math.abs(bullet.x - b.x) < b.w / 2 && Math.abs(bullet.y - b.y) < b.h / 2;
}

