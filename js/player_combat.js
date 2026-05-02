/* ============================================================================
  NEBULA STRIKE — Player & Weapons
  Player drawing/motion helpers and weapon fire behavior.
============================================================================ */

// ═══ 8. Player ════════════════════════════════════════════════════════════
function drawPlayer(now) {
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
    const t = Math.min(1, (now - state.chargeStart) / CHARGE_FULL_MS);
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
    const pulse = 1 + Math.sin(now * 0.005) * 0.04;
    const inner = (38 + a * 16) * pulse;
    const outer = (56 + a * 50) * pulse;
    wctx.strokeStyle = `rgba(0, 255, 255, ${0.35 + a * 0.45})`;
    wctx.lineWidth = 2.5 + a * 1.4;
    wctx.shadowColor = '#00ffff';
    wctx.shadowBlur = 18 + a * 10;
    wctx.beginPath();
    wctx.arc(0, 0, inner, 0, TAU);
    wctx.stroke();
    wctx.strokeStyle = `rgba(120, 255, 255, ${0.15 + a * 0.35})`;
    wctx.lineWidth = 1.5 + a;
    wctx.beginPath();
    wctx.arc(0, 0, outer, 0, TAU);
    wctx.stroke();
    wctx.fillStyle = `rgba(0, 200, 255, ${a * 0.1})`;
    wctx.beginPath();
    wctx.arc(0, 0, outer, 0, TAU);
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
function fireWeapon(w, now, px, py) {
  const last = state.weaponCooldowns[w.id] || 0;
  if (now - last < w.cooldown) return false;
  state.weaponCooldowns[w.id] = now;
  sfx.shoot(w.type);

  let fired = 0;
  const pushBullet = bullet => { state.bullets.push(bullet); fired++; };

  if (w.type === 'bullet') pushBullet(makeBullet(px, py, 0, w));
  else if (w.type === 'double') {
    pushBullet(makeBullet(px - 12, py, 0, w));
    pushBullet(makeBullet(px + 12, py, 0, w));
  } else if (w.type === 'spread') {
    pushBullet(makeBullet(px, py, 0, w));
    pushBullet(makeBullet(px - 10, py, -2.5, w));
    pushBullet(makeBullet(px + 10, py,  2.5, w));
    pushBullet(makeBullet(px - 18, py, -4.2, w));
    pushBullet(makeBullet(px + 18, py,  4.2, w));
  } else if (w.type === 'beam') {
    pushBullet({ x: px, y: py + 8, w: 6, h: 14, speed: w.speed, damage: w.damage, color: w.color, type: 'beam', dx: rand(-0.6, 0.6), mass: w.mass });
  } else if (w.type === 'laser') {
    pushBullet({ x: px, y: py, w: 5, h: 30, speed: w.speed, damage: w.damage, color: w.color, type: 'laser', dx: 0, mass: w.mass });
  } else if (w.type === 'rocket') {
    pushBullet({
      x: px, y: py, w: 9, h: 20, speed: w.speed, damage: w.damage,
      color: w.color, type: 'rocket', vx: 0, vy: -5, angle: -Math.PI / 2, turnRate: 0.09, mass: w.mass
    });
  } else if (w.type === 'burst') {
    pushBullet({ x: px, y: py, w: 5, h: 22, speed: w.speed, damage: w.damage, color: w.color, type: 'laser', dx: -0.8, mass: w.mass });
    pushBullet({ x: px, y: py, w: 5, h: 26, speed: w.speed + 1, damage: w.damage * 1.05, color: '#ffffff', type: 'laser', dx: 0, mass: w.mass });
    pushBullet({ x: px, y: py, w: 5, h: 22, speed: w.speed, damage: w.damage, color: w.color, type: 'laser', dx: 0.8, mass: w.mass });
  } else if (w.type === 'shard') {
    for (let k = -2; k <= 2; k++) {
      pushBullet({ x: px + k * 5, y: py, w: 4, h: 11, speed: w.speed + Math.abs(k) * 0.25, damage: w.damage, color: w.color, type: 'bullet', dx: k * 1.6, mass: w.mass });
    }
  }

  state.shotsFired += fired;
  return fired > 0;
}

function shoot(now) {
  const px = state.player.x;
  const py = state.player.y - state.player.h / 2;

  // Fire only first N weapons based on multiWeaponCount
  let firedCount = 0;
  for (const wid of state.weaponLoadout) {
    if (firedCount >= state.multiWeaponCount) break;
    if (!state.weaponEnabled[wid]) continue;
    const w = weaponById(wid);
    if (!w) continue;
    fireWeapon(w, now, px, py);
    firedCount++;
  }
}

function makeBullet(x, y, dx, w) {
  return { x, y, w: 5, h: 12, speed: w.speed, damage: w.damage * state.difficultyMultipliers.playerDamageMult, color: w.color, type: 'bullet', dx, mass: w.mass };
}

function fireChargedShot() {
  const t = clamp((performance.now() - state.chargeStart) / CHARGE_FULL_MS, 0.2, 1);
  const px = state.player.x;
  const py = state.player.y - state.player.h / 2;
  state.bullets.push({
    x: px, y: py, w: 18 + t * 36, h: 50 + t * 60,
    speed: 18, damage: (4 + t * 12) * state.difficultyMultipliers.playerDamageMult,
    color: `hsl(${280 + t * 60}, 100%, 70%)`,
    type: 'charged', dx: 0, pierce: 99, life: 1500, mass: 2.0 + t * 3.0
  });
  state.shotsFired++;
  sfx.chargedRelease();
  addShake(8 + t * 6);
  for (let i = 0; i < 30; i++) spawnParticle(px + rand(-20, 20), py, rand(-3, 3), rand(-6, -1), rand(2, 6), '#ff88ff', 0.04);
}

