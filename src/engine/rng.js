// Seeded, serializable RNG streams. Each stream is a plain {s} object so the
// whole run (including mid-combat state) can be saved and resumed exactly.

export function newStream(seed) {
  return { s: (seed >>> 0) || 0x9e3779b9 };
}

// mulberry32 step: returns float in [0,1)
export function rnd(r) {
  let t = (r.s = (r.s + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export const int = (r, a, b) => a + Math.floor(rnd(r) * (b - a + 1));
export const chance = (r, p) => rnd(r) < p;
export const pick = (r, arr) => arr[Math.floor(rnd(r) * arr.length)];

export function shuffle(r, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd(r) * (i + 1));
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}

// items: array, w: item => weight
export function weighted(r, items, w) {
  let total = 0;
  for (const it of items) total += Math.max(0, w(it));
  if (total <= 0) return items[0];
  let x = rnd(r) * total;
  for (const it of items) {
    x -= Math.max(0, w(it));
    if (x < 0) return it;
  }
  return items[items.length - 1];
}

// Derive a fresh stream from a master seed + label (stable across versions).
export function derive(seed, label) {
  let h = (seed >>> 0) ^ 0x811c9dc5;
  for (let i = 0; i < label.length; i++) {
    h ^= label.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return newStream(h);
}

export function randomSeed() {
  return (Math.random() * 0xffffffff) >>> 0;
}
