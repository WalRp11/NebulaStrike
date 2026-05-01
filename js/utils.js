const TAU = Math.PI * 2;
const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const randi = (a, b) => Math.floor(rand(a, b));
const choose = arr => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;
const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };

function angleDiff(a, b) {
  let d = a - b;
  while (d < -Math.PI) d += TAU;
  while (d > Math.PI) d -= TAU;
  return d;
}

function weaponById(id) {
  return WEAPONS.find(w => w.id === id);
}

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
