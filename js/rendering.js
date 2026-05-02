/* ============================================================================
   NEBULA STRIKE — Rendering Systems
   Draw pipeline extracted from systems module.
============================================================================ */

const meteorRadialCache = new Map();

function meteorBodyGradient(wctx, size) {
  const key = Math.round(size);
  let g = meteorRadialCache.get(key);
  if (!g) {
    const half = key / 2;
    g = wctx.createRadialGradient(-key / 4, -key / 4, 1, 0, 0, half);
    g.addColorStop(0, '#aa9977');
    g.addColorStop(1, '#443322');
    meteorRadialCache.set(key, g);
  }
  return g;
}

function drawStarShape(s, fillStyle) {
  wctx.fillStyle = fillStyle;
  if (s.r < 1.08) {
    const r = s.r;
    wctx.fillRect(s.x - r, s.y - r, r * 2, r * 2);
  } else {
    wctx.beginPath();
    wctx.arc(s.x, s.y, s.r, 0, TAU);
    wctx.fill();
  }
}

// ═══ 17. Draw ═════════════════════════════════════════════════════════════
function drawBackground() {
  // Tile background canvas with parallax
  const off = state.bgScroll * 0.3;
  wctx.drawImage(bgCanvas, 0, off - bgCanvas.height);
  wctx.drawImage(bgCanvas, 0, off);

  // Mid stars
  for (const s of state.starsFar) {
    const a = 0.3 + Math.sin(s.twinkle) * 0.2 + s.bright * 0.4;
    wctx.globalAlpha = a;
    drawStarShape(s, '#ffffff');
  }
  for (const s of state.starsMid) {
    const a = 0.5 + Math.sin(s.twinkle * 1.5) * 0.25 + s.bright * 0.3;
    wctx.globalAlpha = a;
    drawStarShape(s, '#cce0ff');
  }
  for (const s of state.starsNear) {
    const a = 0.7 + Math.sin(s.twinkle * 2) * 0.3 + s.bright * 0.3;
    wctx.globalAlpha = Math.min(1, a);
    drawStarShape(s, '#ffffff');
    // streak
    wctx.fillRect(s.x - 0.5, s.y - s.speed * 4, 1, s.speed * 4);
  }
  wctx.globalAlpha = 1;
}

function drawEnemy(e, now) {
  wctx.save();
  wctx.translate(e.x, e.y);
  wctx.drawImage(e.sprite, -e.sprite.width / 2, -e.sprite.height / 2);

  // Shielded arc
  if (e.arch === 'shielded' && e.hp > 0) {
    wctx.strokeStyle = `rgba(120, 200, 255, ${0.5 + Math.sin(now * 0.005) * 0.2})`;
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
  wctx.fillStyle = meteorBodyGradient(wctx, m.size);
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
  wctx.shadowColor = eb.deflected ? '#66ffff' : eb.color;
  wctx.shadowBlur = 14;
  wctx.fillStyle = eb.deflected ? '#66ffff' : eb.color;
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
  const n = state.particles.length;
  const shadowAmt = n > 300 ? 0 : n > 160 ? 5 : 8;
  for (const pa of state.particles) {
    wctx.globalAlpha = Math.max(0, pa.life);
    wctx.shadowColor = pa.color;
    wctx.shadowBlur = shadowAmt;
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
  const waveLabel = state.endlessMode
    ? `WAVE ${state.wave || 1}  ·  ∞`
    : `WAVE ${state.wave || 1}`;
  ctx.fillText(waveLabel, CANVAS_W / 2, 24);
  const equipped = state.weaponLoadout.map(id => weaponById(id)).filter(Boolean);
  const activeEquipped = state.weaponLoadout
    .filter(id => state.weaponEnabled[id])
    .map(id => weaponById(id))
    .filter(Boolean);
  const primaryColor = activeEquipped.length ? activeEquipped[activeEquipped.length - 1].color : '#00ffff';
  ctx.font = 'bold 14px Orbitron, monospace';
  ctx.fillStyle = primaryColor;
  ctx.shadowColor = primaryColor;
  ctx.shadowBlur = 4;
  const loadoutText = activeEquipped.map(w => w.name).join(' + ');
  const clipped = loadoutText.length > 42 ? `${loadoutText.slice(0, 39)}...` : loadoutText;
  ctx.fillText(clipped.toUpperCase(), CANVAS_W / 2, 48);

  // Weapon slot strip (1..8) with enabled/disabled indication.
  const slotY = 40;
  const slotStartX = CANVAS_W / 2 - 160;
  const slotW = 40;
  const slotH = 15;
  for (let i = 0; i < 8; i++) {
    const x = slotStartX + i * slotW;
    const wid = state.weaponLoadout[i];
    const w = wid ? weaponById(wid) : null;
    const enabled = !!(wid && state.weaponEnabled[wid]);
    ctx.shadowBlur = 0;
    ctx.fillStyle = wid ? (enabled ? 'rgba(0,25,45,0.92)' : 'rgba(35, 8, 12, 0.85)') : 'rgba(0,0,0,0.35)';
    ctx.fillRect(x, slotY, slotW - 4, slotH);
    ctx.strokeStyle = wid ? (enabled ? (w ? w.color : '#66ffff') : '#ff5566') : 'rgba(130,150,170,0.30)';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(x, slotY, slotW - 4, slotH);
    ctx.textAlign = 'center';
    ctx.font = 'bold 9px "Press Start 2P", monospace';
    ctx.fillStyle = wid ? (enabled ? '#ffffff' : '#ff99aa') : 'rgba(190, 210, 230, 0.45)';
    const icon = w ? w.icon : '-';
    ctx.fillText(icon, x + (slotW - 4) / 2, slotY + 7);
    ctx.font = 'bold 8px Orbitron, monospace';
    ctx.fillText(String(i + 1), x + (slotW - 4) / 2, slotY + 13);
  }

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
  // Lighter filter than before: fewer GPU passes, pairs with smaller bloom buffer (BLOOM_DIV).
  bctx.filter = 'brightness(1.32) blur(1px)';
  bctx.drawImage(worldCanvas, 0, 0, bloomCanvas.width, bloomCanvas.height);
  bctx.filter = 'none';

  // Composite world to main
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.drawImage(worldCanvas, 0, 0);
  // Add bloom additively
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.58;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(bloomCanvas, 0, 0, CANVAS_W, CANVAS_H);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

function draw(now = performance.now()) {
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
  for (const e of state.enemies) drawEnemy(e, now);
  for (const pk of state.pickups) drawPickup(pk, now);
  if (state.boss) drawBoss(now);
  for (const b of state.bullets) drawBullet(b);
  for (const eb of state.enemyBullets) drawEnemyBullet(eb);
  drawParticles();
  drawPlayer(now);
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

