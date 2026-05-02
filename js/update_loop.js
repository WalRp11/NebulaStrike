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
  refreshWeaponTierFromLoadout();
}

function update(dt, now) {
  if (typeof sfx.syncAmbientState === 'function') sfx.syncAmbientState(state);
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
    if (!state.charging) {
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
    const shieldRatio = p.armor / p.maxArmor;
    const rad = 80 + shieldRatio * 40;
    const rad2 = rad * rad;
    const force = 0.045 + shieldRatio * 0.045;
    for (const e of state.enemies) {
      const dx = e.x - p.x, dy = e.y - p.y;
      const d2 = dx * dx + dy * dy;
      if (d2 >= rad2 || d2 < 0.01) continue;
      const d = Math.sqrt(d2);
      e.x += (dx / d) * (rad - d) * force;
      e.y += (dy / d) * (rad - d) * force;
    }
    for (const m of state.meteors) {
      const dx = m.x - p.x, dy = m.y - p.y;
      const d2 = dx * dx + dy * dy;
      if (d2 >= rad2 || d2 < 0.01) continue;
      const d = Math.sqrt(d2);
      m.x += (dx / d) * (rad - d) * force;
      m.y += (dy / d) * (rad - d) * force;
    }

    // Deflect enemy ammo: costs energy based on momentum and kinetic energy.
    const deflectRadius = rad + 15;
    const deflectR2 = deflectRadius * deflectRadius;
    for (const eb of state.enemyBullets) {
      const dx = eb.x - p.x;
      const dy = eb.y - p.y;
      const d2 = dx * dx + dy * dy;
      if (d2 >= deflectR2 || d2 <= 0.01) continue;
      const d = Math.sqrt(d2);
      if (eb.deflectLock && eb.deflectLock > now) continue;

      const nx = dx / d;
      const ny = dy / d;
      const speed = Math.sqrt(eb.vx * eb.vx + eb.vy * eb.vy) || 1;
      
      // Physics-based deflection cost: momentum (linear) + kinetic energy (quadratic)
      const bulletMass = eb.mass || 0.5;
      const momentum = bulletMass * speed;
      const kineticEnergy = 0.5 * bulletMass * speed * speed;
      const baseCost = (BALANCE.shieldMass * momentum * BALANCE.deflectMomentumCost) + (kineticEnergy * BALANCE.deflectEnergyMultiplier);
      const armorCost = baseCost * state.difficultyMultipliers.shieldCostMult;
      
      // Deflection power reduced by heavier bullets (relative mass matters)
      const relativeShieldMass = BALANCE.shieldMass / (BALANCE.shieldMass + bulletMass);
      const power = clamp(0.20 + shieldRatio * relativeShieldMass * BALANCE.shieldDeflectPower, 0.20, BALANCE.shieldDeflectPower);
      
      const outSpeed = speed * (1.0 + shieldRatio * BALANCE.shieldDeflectSpeedBoost);
      eb.vx = lerp(eb.vx, nx * outSpeed, power);
      eb.vy = lerp(eb.vy, ny * outSpeed, power);
      eb.color = '#66ffff';
      eb.deflected = true;
      eb.deflectLock = now + 110;

      p.armor = Math.max(0, p.armor - armorCost);
      spawnParticle(eb.x, eb.y, nx * 1.2, ny * 1.2, rand(1.4, 2.8), '#66ffff', 0.06);
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
  if (state.waveActive && Math.random() < BALANCE.wavePickupChance * dts) {
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
    } else if (e.arch === 'specter') {
      // Phase in/out, erratic movement
      e.phaseTimer -= dt;
      if (e.phaseTimer <= 0) {
        e.state = e.state === 'phase' ? 'hunt' : 'phase';
        e.phaseTimer = rand(600, 1400);
      }
      const targetX = e.state === 'hunt' ? state.player.x : rand(100, CANVAS_W - 100);
      e.x += (targetX - e.x) * 0.015 * dts;
      e.y += e.speed * dts * state.gameSpeed;
      if (e.state === 'hunt' && e.shotCooldown > 0 && now - e.lastShot > e.shotCooldown / state.gameSpeed) {
        e.lastShot = now;
        enemyShoot(e, now);
      }
    } else if (e.arch === 'swarm') {
      // Chaotic orbital movement
      e.x += Math.sin(e.swayAngle) * 2.2 * dts;
      e.y += e.speed * dts * state.gameSpeed;
      e.swayAngle += 0.08 * dts;
      if (e.shotCooldown > 0 && now - e.lastShot > e.shotCooldown / state.gameSpeed && e.y > 100) {
        e.lastShot = now;
        // Burst of 3 bullets in spread
        for (let i = -1; i <= 1; i++) {
          const a = Math.atan2(state.player.y - e.y, state.player.x - e.x) + i * 0.3;
          state.enemyBullets.push({
            x: e.x, y: e.y, w: 6, h: 6,
            vx: Math.cos(a) * 5.5, vy: Math.sin(a) * 5.5,
            damage: 0.8, color: '#ff8844',
          });
        }
        sfx.enemyShoot();
      }
    } else if (e.arch === 'pulsar') {
      // Slow deliberate movement with bursts
      e.x += Math.sin(e.swayAngle * 0.5) * 0.8 * dts;
      e.y += e.speed * dts * state.gameSpeed;
      if (e.shotCooldown > 0 && now - e.lastShot > e.shotCooldown / state.gameSpeed) {
        e.lastShot = now;
        // Expanding ring of bullets
        const n = 16;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU;
          state.enemyBullets.push({
            x: e.x, y: e.y, w: 7, h: 7,
            vx: Math.cos(a) * 4.8, vy: Math.sin(a) * 4.8,
            damage: 1, color: '#66ff66',
          });
        }
        sfx.enemyShoot();
      }
    } else if (e.arch === 'tank') {
      // Slow but steady
      e.x += Math.sin(e.swayAngle) * e.sway * 0.4 * dts;
      e.y += e.speed * dts * state.gameSpeed;
      if (e.shotCooldown > 0 && now - e.lastShot > e.shotCooldown / state.gameSpeed && e.y > 100) {
        e.lastShot = now;
        // Heavy cannon shot
        const a = Math.atan2(state.player.y - e.y, state.player.x - e.x);
        state.enemyBullets.push({
          x: e.x, y: e.y, w: 10, h: 10,
          vx: Math.cos(a) * 5.2, vy: Math.sin(a) * 5.2,
          damage: 2, color: '#ffff44',
        });
        sfx.enemyShoot();
      }
    } else if (e.arch === 'phantom') {
      // Rapid erratic dodging
      const dashChance = 0.25 * dts;
      if (Math.random() < dashChance) {
        e.dashDir = { x: Math.random() - 0.5, y: Math.random() - 0.5 };
        const m = Math.hypot(e.dashDir.x, e.dashDir.y);
        e.dashDir.x /= m; e.dashDir.y /= m;
      }
      if (!e.dashDir) e.dashDir = { x: 0, y: 0 };
      e.x += (e.dashDir.x * 3 + Math.sin(e.swayAngle) * 0.5) * dts;
      e.y += Math.max(e.speed * 0.8, e.y - state.player.y < -100 ? e.speed : e.speed * 0.6) * dts * state.gameSpeed;
      if (e.shotCooldown > 0 && now - e.lastShot > e.shotCooldown / state.gameSpeed) {
        e.lastShot = now;
        enemyShoot(e, now);
      }
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
    if (eb.deflected) {
      let consumed = false;

      for (let j = state.enemies.length - 1; j >= 0; j--) {
        const e = state.enemies[j];
        if (!rectsOverlap({ x: eb.x, y: eb.y, w: eb.w * 2, h: eb.h * 2 }, e)) continue;
        e.hp -= Math.max(1, eb.damage * 1.5);
        e.flash = 110;
        explode(eb.x, eb.y, '#66ffff', 6);
        if (e.hp <= 0) onEnemyDeath(e, j);
        consumed = true;
        break;
      }

      if (!consumed && state.boss && bossHitTest(state.boss, { x: eb.x, y: eb.y, w: eb.w * 1.4, h: eb.h * 1.4 })) {
        damageBoss(state.boss, eb.x, eb.y, Math.max(1, eb.damage));
        explode(eb.x, eb.y, '#66ffff', 6);
        consumed = true;
      }

      if (consumed) {
        state.enemyBullets.splice(i, 1);
        continue;
      }
    }

    if (!eb.deflected && p.invincible <= 0 && state.dashIframes <= 0 && rectsOverlap({x:eb.x,y:eb.y,w:eb.w,h:eb.h}, p)) {
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
    const d2 = dx * dx + dy * dy;
    const magnetR2 = 140 * 140;
    if (d2 > 0.01 && d2 < magnetR2) {
      const d = Math.sqrt(d2);
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
  const explosionColor = e.arch === 'kamikaze' ? '#ff6600' : e.arch === 'specter' ? '#00ff88' : e.arch === 'tank' ? '#ffaa44' : '#ffaa00';
  explode(e.x, e.y, explosionColor, 22);
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
    else if (e.arch === 'specter') baseScore = 150;
    else if (e.arch === 'swarm') baseScore = 60;
    else if (e.arch === 'pulsar') baseScore = 190;
    else if (e.arch === 'tank') baseScore = 250;
    else if (e.arch === 'phantom') baseScore = 140;
    state.score += baseScore * mult;
    if (mult > 1) addFloatingText(e.x, e.y, `+${baseScore * mult}`, '#ffdd44', 0.9, -1.3);
  }
  // Pickup chance
  const dropRoll = Math.random();
  const heavyDropChance = (e.arch === 'shielded' || e.arch === 'tank' || e.arch === 'pulsar') ? 0.7 : 0.08;
  if (dropRoll < heavyDropChance) spawnPickup(undefined, e.x, e.y);
  if (Math.random() < BALANCE.globalWeaponDropChance) {
    spawnPickup('weapon', e.x + rand(-8, 8), e.y + rand(-8, 8));
  }
  const eliteTypes = ['sniper', 'shielded', 'specter', 'tank', 'pulsar', 'phantom'];
  if (eliteTypes.includes(e.arch) && Math.random() < BALANCE.eliteWeaponDropChance) {
    spawnPickup('weapon', e.x + rand(-10, 10), e.y + rand(-10, 10));
  }
  // Multifire pickup (more common in later waves)
  if (state.multiWeaponCount < state.weaponLoadout.length) {
    const multifireChance = 0.03 + state.wave * 0.005;
    if (eliteTypes.includes(e.arch) && Math.random() < multifireChance) {
      spawnPickup('multifire', e.x, e.y);
    }
  }
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
  loseWeaponsOnMajorHit();
  resetCombo();
  p.invincible = 2200;
  sfx.playerHit();
  explode(p.x, p.y, '#ff2222', 24);
  addShake(18);
  state.flash = 0.5; state.flashColor = '#ff0000';
  if (state.lives <= 0) endGame();
}

