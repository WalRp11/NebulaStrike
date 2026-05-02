/* Canvas layers, sprite cache, and static background art — loaded before gameplay modules. */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = CANVAS_W;
canvas.height = CANVAS_H;

const worldCanvas = document.createElement('canvas');
worldCanvas.width = CANVAS_W;
worldCanvas.height = CANVAS_H;
const wctx = worldCanvas.getContext('2d');

const BLOOM_DIV = 4;
const bloomCanvas = document.createElement('canvas');
bloomCanvas.width = CANVAS_W / BLOOM_DIV;
bloomCanvas.height = CANVAS_H / BLOOM_DIV;
const bctx = bloomCanvas.getContext('2d');

const bgCanvas = document.createElement('canvas');
bgCanvas.width = CANVAS_W;
bgCanvas.height = CANVAS_H * 2;
const bgctx = bgCanvas.getContext('2d');

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

function paintNebulaBackground() {
  const g = bgctx;
  const grad = g.createLinearGradient(0, 0, 0, bgCanvas.height);
  grad.addColorStop(0, '#02021a');
  grad.addColorStop(0.5, '#06031c');
  grad.addColorStop(1, '#020010');
  g.fillStyle = grad;
  g.fillRect(0, 0, bgCanvas.width, bgCanvas.height);

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
    const r = rand(180, 480);
    const col = choose(nebulaColors);
    const rg = g.createRadialGradient(cx, cy, 0, cx, cy, r);
    rg.addColorStop(0, col);
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg;
    g.beginPath();
    g.arc(cx, cy, r, 0, TAU);
    g.fill();
  }

  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 600; i++) {
    const x = rand(0, bgCanvas.width);
    const y = rand(0, bgCanvas.height);
    const r = rand(0.3, 1.2);
    const a = rand(0.3, 0.9);
    g.fillStyle = `rgba(${randi(180, 255)}, ${randi(200, 255)}, 255, ${a})`;
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fill();
  }

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
    g.beginPath();
    g.arc(px, py, pr, 0, TAU);
    g.fill();
    const hg = g.createRadialGradient(px, py, pr, px, py, pr * 2.2);
    hg.addColorStop(0, `hsla(${hue}, 80%, 60%, 0.18)`);
    hg.addColorStop(1, `hsla(${hue}, 80%, 60%, 0)`);
    g.fillStyle = hg;
    g.beginPath();
    g.arc(px, py, pr * 2.2, 0, TAU);
    g.fill();
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

paintNebulaBackground();
