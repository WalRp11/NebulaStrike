/* ============================================================================
  NEBULA STRIKE — Pickups & Effects
  Pickup logic, particles, specials, and combo state handling.
============================================================================ */

// ═══ 12. Pickups ══════════════════════════════════════════════════════════
const PICKUP_TYPES = ['armor', 'armor', 'speed', 'bomb', 'dash', 'gem', 'gem', 'weapon', 'multifire'];

function getRandomLockedWeaponId() {
  const locked = WEAPONS.filter(w => !state.weaponLoadout.includes(w.id));
  if (locked.length === 0) return null;
  return choose(locked).id;
}

function refreshWeaponTierFromLoadout() {
  let tier = 0;
  for (let i = WEAPONS.length - 1; i >= 0; i--) {
    if (state.weaponLoadout.includes(WEAPONS[i].id)) { tier = i; break; }
  }
  state.weaponTier = tier;
}

function enabledWeaponCount() {
  return state.weaponLoadout.reduce((sum, id) => sum + (state.weaponEnabled[id] ? 1 : 0), 0);
}

function ensureWeaponEnabledFallback() {
  if (enabledWeaponCount() > 0) return;
  if (state.weaponLoadout.includes('pulse')) state.weaponEnabled.pulse = true;
  else if (state.weaponLoadout.length) state.weaponEnabled[state.weaponLoadout[0]] = true;
}

function toggleWeaponSlot(slotIndex) {
  const weaponId = state.weaponLoadout[slotIndex];
  if (!weaponId) return;
  const wasEnabled = !!state.weaponEnabled[weaponId];
  if (wasEnabled && enabledWeaponCount() <= 1) {
    addFloatingText(state.player.x, state.player.y - 62, 'AT LEAST ONE WEAPON ACTIVE', '#ffaa66', 1.0, -1.2);
    return;
  }
  state.weaponEnabled[weaponId] = !wasEnabled;
  const w = weaponById(weaponId);
  if (!state.weaponEnabled[weaponId]) {
    addFloatingText(state.player.x, state.player.y - 58, `${w ? w.name.toUpperCase() : weaponId} OFF`, '#ff7777', 1.0, -1.1);
  } else {
    addFloatingText(state.player.x, state.player.y - 58, `${w ? w.name.toUpperCase() : weaponId} ON`, w ? w.color : '#66ffff', 1.0, -1.1);
  }
  ensureWeaponEnabledFallback();
}

function addWeaponToLoadout(weaponId, x, y) {
  if (!weaponId || state.weaponLoadout.includes(weaponId)) return false;
  state.weaponLoadout.push(weaponId);
  state.weaponEnabled[weaponId] = true;
  refreshWeaponTierFromLoadout();
  const w = weaponById(weaponId);
  sfx.weaponUpgrade();
  addFloatingText(x, y - 10, `+ ${w ? w.name.toUpperCase() : 'WEAPON'}`, w ? w.color : '#ffaa00', 2.0, -1.2);
  return true;
}

function loseWeaponsOnMajorHit() {
  const optional = state.weaponLoadout.filter(id => id !== 'pulse');
  if (optional.length === 0) return;
  const loseCount = optional.length >= BALANCE.majorHitLoseTwoThreshold ? 2 : 1;
  for (let i = 0; i < loseCount; i++) {
    const canLose = state.weaponLoadout.filter(id => id !== 'pulse');
    if (canLose.length === 0) break;
    const victim = choose(canLose);
    state.weaponLoadout = state.weaponLoadout.filter(id => id !== victim);
    delete state.weaponEnabled[victim];
    delete state.weaponCooldowns[victim];
    const w = weaponById(victim);
    addFloatingText(state.player.x + rand(-40, 40), state.player.y - 70 + i * 24, `LOST ${w ? w.name.toUpperCase() : 'WEAPON'}`, '#ff6677', 1.8, -1.0);
  }
  ensureWeaponEnabledFallback();
  refreshWeaponTierFromLoadout();
}

function spawnPickup(type, x, y, extra = {}) {
  type = type || choose(PICKUP_TYPES);
  const pickup = {
    type, x, y,
    w: 22, h: 22,
    speed: rand(1.8, 2.8),
    bob: Math.random() * TAU,
  };

  if (type === 'weapon') {
    pickup.weaponId = extra.weaponId || getRandomLockedWeaponId();
    if (!pickup.weaponId) {
      pickup.type = 'gem';
    }
  }

  state.pickups.push(pickup);
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
  } else if (p.type === 'weapon') {
    const w = weaponById(p.weaponId);
    const c = w ? w.pickupColor : '#ffffff';
    wctx.shadowColor = c; wctx.shadowBlur = 18;
    wctx.fillStyle = c;
    wctx.beginPath();
    wctx.moveTo(0, -12);
    wctx.lineTo(11, -4);
    wctx.lineTo(9, 11);
    wctx.lineTo(-9, 11);
    wctx.lineTo(-11, -4);
    wctx.closePath();
    wctx.fill();
    wctx.fillStyle = '#001020';
    wctx.font = 'bold 12px monospace'; wctx.textAlign = 'center'; wctx.textBaseline = 'middle';
    wctx.fillText('W', 0, 1);
  } else if (p.type === 'multifire') {
    wctx.shadowColor = '#ff00ff'; wctx.shadowBlur = 16;
    wctx.fillStyle = '#ff00ff';
    // Draw 3 overlapping circles to represent multiple weapons
    wctx.beginPath(); wctx.arc(-8, -4, 8, 0, TAU); wctx.fill();
    wctx.beginPath(); wctx.arc(8, -4, 8, 0, TAU); wctx.fill();
    wctx.beginPath(); wctx.arc(0, 10, 8, 0, TAU); wctx.fill();
    wctx.fillStyle = '#ffffff';
    wctx.font = 'bold 10px monospace'; wctx.textAlign = 'center'; wctx.textBaseline = 'middle';
    wctx.fillText('M', 0, 4);
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
  } else if (p.type === 'weapon') {
    const gained = addWeaponToLoadout(p.weaponId, p.x, p.y);
    if (!gained) {
      state.score += 180;
      addFloatingText(p.x, p.y - 10, '+180', '#ffaa00', 1.3, -1.4);
    }
  } else if (p.type === 'multifire') {
    state.multiWeaponCount = Math.min(state.weaponLoadout.length, state.multiWeaponCount + 1);
    addFloatingText(p.x, p.y - 10, `+MULTI (${state.multiWeaponCount})`, '#ff00ff', 1.5, -1.4);
    sfx.speedUp();
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

