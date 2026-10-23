// Pixel-art sprite system. Sprites are drawn with primitives into a low-res
// RGBA buffer by a pure-JS rasterizer (crisp, no anti-aliasing, runs in Node
// too), then auto-outlined and shaded, and finally upscaled by the browser
// with `image-rendering: pixelated`.
//
//   defineSprites({
//     wolf: { w: 48, h: 40, draw(p) { p.ellipse(24, 26, 14, 8, PAL.ash, { shade: 0.3 }); ... } },
//   });
//
// A def may also have fx(p) / under(p): drawn after post-processing (no outline,
// alpha kept) on top of / behind the sprite, for light and motion effects.

export const SPRITES = {};
export function defineSprites(obj) {
  for (const k in obj) {
    if (SPRITES[k]) throw new Error('duplicate sprite ' + k);
    SPRITES[k] = obj[k];
  }
}

// Shared dark-fantasy palette. Use these (or shades of them) for cohesion.
export const PAL = {
  void: '#0b0a0d', ink: '#16131a', night: '#221d28', dusk: '#342c3b', bruise: '#4b3b56',
  ash: '#5d5a5e', stone: '#7a767a', fog: '#9e9a9c', bone: '#d8cfb8', parch: '#e8dcc0',
  blood: '#8a1c1c', gore: '#5a1010', ember: '#c4501e', flame: '#e8a33a', gold: '#c9a227',
  candle: '#f0d27a', rot: '#5c7a2a', bile: '#8fae3a', moss: '#3d5226', venom: '#b8d45a',
  iron: '#5a5f66', steel: '#8e98a3', frost: '#b9d3e0', ghost: '#a9c6c2', spirit: '#7fd1c4',
  violet: '#7b5aa6', lilac: '#b49ad6', wine: '#5e1f3d', rose: '#b5536b',
  bark: '#4a3527', wood: '#6e5039', leather: '#7a5a3a', skin: '#c9a48a', pale: '#d9c7b8',
  sick: '#a8b48a', water: '#2f4a5a', deep: '#1c2d38',
};

// ------------------------------------------------------------------ colors
const cache = new Map();
export function rgba(hex) {
  if (Array.isArray(hex)) return hex;
  let c = cache.get(hex);
  if (c) return c;
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((x) => x + x).join('');
  const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) : 255;
  c = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), a];
  cache.set(hex, c);
  return c;
}
export function shadeColor(c, f) {
  // f > 0 lightens toward a warm white, f < 0 darkens toward a cool black.
  const [r, g, b, a] = rgba(c);
  if (f >= 0) return [r + (255 - r) * f * 0.9, g + (245 - g) * f * 0.9, b + (225 - b) * f * 0.85, a].map(Math.round);
  const k = 1 + f;
  return [r * k, g * k, b * (k + (1 - k) * 0.15), a].map(Math.round);
}
export function mix(a, b, t) {
  const x = rgba(a), y = rgba(b);
  return [0, 1, 2, 3].map((i) => Math.round(x[i] + (y[i] - x[i]) * t));
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

// ------------------------------------------------------------------ painter
export class Painter {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.d = new Uint8ClampedArray(w * h * 4);
    this.light = [-0.6, -0.8]; // light direction (from top-left)
  }
  _set(x, y, c) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4, d = this.d;
    if (c[3] >= 255 || d[i + 3] === 0) { d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = c[3]; return; }
    const a = c[3] / 255;
    d[i] = d[i] * (1 - a) + c[0] * a; d[i + 1] = d[i + 1] * (1 - a) + c[1] * a; d[i + 2] = d[i + 2] * (1 - a) + c[2] * a;
    d[i + 3] = Math.max(d[i + 3], c[3]);
  }
  get(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
    const i = (y * this.w + x) * 4;
    return this.d[i + 3] ? [this.d[i], this.d[i + 1], this.d[i + 2], this.d[i + 3]] : null;
  }
  // Fill a span with optional volumetric shading relative to a shape's bbox.
  _span(y, x0, x1, col, o, bb) {
    const c = rgba(col);
    for (let x = Math.ceil(x0 - 0.5); x <= Math.floor(x1 - 0.5); x++) {
      if (o && o.shade && bb) {
        // normalized position inside bbox, -1..1
        const nx = ((x + 0.5) - bb.cx) / Math.max(1, bb.rx);
        const ny = ((y + 0.5) - bb.cy) / Math.max(1, bb.ry);
        let t = -(nx * this.light[0] + ny * this.light[1]) * 0.7 - 0.05; // >0 lit
        t += (BAYER[(y & 3) * 4 + (x & 3)] - 0.5) * 0.35;
        const s = o.shade;
        const f = t > 0.38 ? s * 0.8 : t < -0.38 ? -s : t < -0.05 ? -s * 0.45 : 0;
        this._set(x, y, f ? shadeColor(c, f) : c);
      } else this._set(x, y, c);
    }
  }
  px(x, y, col) { this._set(x, y, rgba(col)); return this; }
  rect(x, y, w, h, col, o) {
    const bb = { cx: x + w / 2, cy: y + h / 2, rx: w / 2, ry: h / 2 };
    for (let yy = Math.round(y); yy < Math.round(y + h); yy++) this._span(yy, x, x + w, col, o, bb);
    return this;
  }
  ellipse(cx, cy, rx, ry, col, o) {
    const bb = { cx, cy, rx, ry };
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      const dy = (y + 0.5 - cy) / ry;
      if (Math.abs(dy) > 1) continue;
      const dx = rx * Math.sqrt(1 - dy * dy);
      this._span(y, cx - dx, cx + dx, col, o, bb);
    }
    return this;
  }
  circle(cx, cy, r, col, o) { return this.ellipse(cx, cy, r, r, col, o); }
  // Filled polygon, points: [[x,y], ...]
  poly(pts, col, o) {
    let minY = Infinity, maxY = -Infinity, minX = Infinity, maxX = -Infinity;
    for (const [x, y] of pts) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); minX = Math.min(minX, x); maxX = Math.max(maxX, x); }
    const bb = { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, rx: (maxX - minX) / 2, ry: (maxY - minY) / 2 };
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const sy = y + 0.5, xs = [];
      for (let i = 0; i < pts.length; i++) {
        const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
        if ((y1 <= sy && y2 > sy) || (y2 <= sy && y1 > sy)) xs.push(x1 + ((sy - y1) / (y2 - y1)) * (x2 - x1));
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) this._span(y, xs[i], xs[i + 1], col, o, bb);
    }
    return this;
  }
  tri(x1, y1, x2, y2, x3, y3, col, o) { return this.poly([[x1, y1], [x2, y2], [x3, y3]], col, o); }
  // Thick line (width in pixels).
  line(x1, y1, x2, y2, col, w = 1) {
    if (w <= 1) {
      const c = rgba(col);
      const n = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1), 1);
      for (let i = 0; i <= n; i++) this._set(Math.round(x1 + ((x2 - x1) * i) / n), Math.round(y1 + ((y2 - y1) * i) / n), c);
      return this;
    }
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
    const nx = (-dy / len) * (w / 2), ny = (dx / len) * (w / 2);
    return this.poly([[x1 + nx, y1 + ny], [x2 + nx, y2 + ny], [x2 - nx, y2 - ny], [x1 - nx, y1 - ny]], col);
  }
  // Polyline through points with width (limbs, tails, tentacles, cracks).
  path(pts, col, w = 1) { for (let i = 0; i + 1 < pts.length; i++) this.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], col, w); return this; }
  // Ring / arc outline.
  ring(cx, cy, r, col, w = 1) {
    const c = rgba(col);
    for (let y = Math.floor(cy - r - w); y <= cy + r + w; y++)
      for (let x = Math.floor(cx - r - w); x <= cx + r + w; x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d <= r && d > r - w) this._set(x, y, c);
      }
    return this;
  }
  // Mirror the left half onto the right half (symmetric creatures, masks, armour).
  mirror() {
    const { w, h, d } = this;
    for (let y = 0; y < h; y++) for (let x = 0; x < w >> 1; x++) {
      const a = (y * w + x) * 4, b = (y * w + (w - 1 - x)) * 4;
      for (let k = 0; k < 4; k++) d[b + k] = d[a + k];
    }
    return this;
  }
  // Seeded speckle texture over existing opaque pixels.
  speckle(col, density = 0.1, seed = 7, region) {
    const c = rgba(col);
    let s = seed >>> 0;
    const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    const [x0, y0, x1, y1] = region || [0, 0, this.w, this.h];
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (this.get(x, y) && r() < density) this._set(x, y, c);
    return this;
  }
  // Recolor every opaque pixel matching `from` (exact) to `to`.
  recolor(from, to) {
    const f = rgba(from), t = rgba(to), d = this.d;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] && d[i] === f[0] && d[i + 1] === f[1] && d[i + 2] === f[2]) { d[i] = t[0]; d[i + 1] = t[1]; d[i + 2] = t[2]; }
    return this;
  }
  // Erase (cut holes: eye sockets, gaps, tattered cloth).
  erase(x, y, w = 1, h = 1) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      if (xx < 0 || yy < 0 || xx >= this.w || yy >= this.h) continue;
      this.d[(yy * this.w + xx) * 4 + 3] = 0;
    }
    return this;
  }
  eraseEllipse(cx, cy, rx, ry) {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) this.erase(x, y);
    }
    return this;
  }
  // Glowing pixel (eyes, embers): bright core + soft halo.
  glow(x, y, col, r = 2) {
    const c = rgba(col);
    for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) {
      const dd = Math.hypot(xx, yy);
      if (dd === 0) continue;
      if (dd <= r) this._set(x + xx, y + yy, [c[0], c[1], c[2], Math.round(110 * (1 - dd / (r + 0.5)))]);
    }
    this._set(x, y, shadeColor(c, 0.5));
    return this;
  }
}

// ------------------------------------------------------------------ post-processing
function postProcess(p, def) {
  const { w, h, d } = p;
  const opaque = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 96;
  // Rim light / shadow based on silhouette edges.
  if (def.rim !== false) {
    const src = new Uint8ClampedArray(d);
    const so = (x, y) => x >= 0 && y >= 0 && x < w && y < h && src[(y * w + x) * 4 + 3] > 96;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!so(x, y)) continue;
      const i = (y * w + x) * 4;
      let f = 0;
      if (!so(x, y - 1)) f += 0.22;
      if (!so(x - 1, y)) f += 0.1;
      if (!so(x, y + 1)) f -= 0.28;
      if (!so(x + 1, y)) f -= 0.12;
      if (f) { const c = shadeColor([src[i], src[i + 1], src[i + 2], src[i + 3]], f); d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; }
    }
  }
  // Hard alpha (pixel-art crispness) except intentional glows.
  for (let i = 3; i < d.length; i += 4) if (d[i] > 0 && d[i] < 255 && def.keepAlpha !== true) d[i] = d[i] > 96 ? 255 : d[i];
  // Outline.
  if (def.outline !== false) {
    const oc = rgba(def.outline || '#0b0a0d');
    const mask = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (opaque(x, y)) continue;
      if (opaque(x - 1, y) || opaque(x + 1, y) || opaque(x, y - 1) || opaque(x, y + 1)) mask.push((y * w + x) * 4);
    }
    for (const i of mask) { d[i] = oc[0]; d[i + 1] = oc[1]; d[i + 2] = oc[2]; d[i + 3] = 255; }
  }
}

function padded(p, pad) {
  const P = new Proxy(p, {
    get(t, k) {
      const v = t[k];
      if (typeof v !== 'function') return v;
      if (['rect', 'ellipse', 'circle', 'px', 'erase', 'eraseEllipse', 'glow', 'ring'].includes(k))
        return (x, y, ...a) => (v.call(t, x + pad, y + pad, ...a), P);
      if (k === 'line') return (x1, y1, x2, y2, ...a) => (v.call(t, x1 + pad, y1 + pad, x2 + pad, y2 + pad, ...a), P);
      if (k === 'tri') return (x1, y1, x2, y2, x3, y3, ...a) => (v.call(t, x1 + pad, y1 + pad, x2 + pad, y2 + pad, x3 + pad, y3 + pad, ...a), P);
      if (k === 'poly') return (pts, ...a) => (v.call(t, pts.map(([x, y]) => [x + pad, y + pad]), ...a), P);
      if (k === 'path') return (pts, ...a) => (v.call(t, pts.map(([x, y]) => [x + pad, y + pad]), ...a), P);
      if (k === 'speckle') return (c, dn, s, r) => (v.call(t, c, dn, s, r && [r[0] + pad, r[1] + pad, r[2] + pad, r[3] + pad]), P);
      return (...a) => (v.apply(t, a), P);
    },
  });
  return P;
}

// Render a sprite to raw pixels {w, h, data} (works in Node).
export function renderSprite(id, opts = {}) {
  const def = SPRITES[id];
  if (!def) throw new Error('unknown sprite ' + id);
  const pad = def.outline === false ? 0 : 1;
  const p = new Painter(def.w + pad * 2, def.h + pad * 2);
  // Offset drawing by pad so outlines are never clipped.
  const P = padded(p, pad);
  def.draw(P, opts);
  postProcess(p, def);
  // Optional effect layers (pose frames: swing smears, casting light), drawn after
  // outline/rim/hard-alpha so they stay bright, soft-edged and un-outlined:
  // `under` shows only where the sprite is see-through, `fx` goes on top.
  if (def.under) {
    const q = new Painter(p.w, p.h);
    def.under(padded(q, pad), opts);
    const a = p.d, b = q.d;
    for (let i = 0; i < a.length; i += 4) {
      const ab = b[i + 3]; if (!ab || a[i + 3] === 255) continue;
      const aa = a[i + 3] / 255, bb = ab / 255, o = aa + bb * (1 - aa);
      for (let k = 0; k < 3; k++) a[i + k] = Math.round((a[i + k] * aa + b[i + k] * bb * (1 - aa)) / o);
      a[i + 3] = Math.round(o * 255);
    }
  }
  if (def.fx) def.fx(P, opts);
  return { w: p.w, h: p.h, data: p.d };
}

// Browser: cached canvas for a sprite.
const canvasCache = new Map();
export function spriteCanvas(id, opts) {
  const k = id + (opts ? JSON.stringify(opts) : '');
  if (canvasCache.has(k)) return canvasCache.get(k);
  const r = renderSprite(id, opts);
  const c = document.createElement('canvas');
  c.width = r.w; c.height = r.h;
  const ctx = c.getContext('2d');
  ctx.putImageData(new ImageData(r.data, r.w, r.h), 0, 0);
  canvasCache.set(k, c);
  return c;
}

// Browser: a fresh <canvas> element showing the sprite (scaled with CSS).
export function spriteEl(id, scale = 2, cls = '') {
  const src = spriteCanvas(SPRITES[id] ? id : 'missing');
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  c.getContext('2d').drawImage(src, 0, 0);
  c.className = 'px ' + cls;
  c.style.width = src.width * scale + 'px';
  c.style.height = src.height * scale + 'px';
  return c;
}

const urlCache = new Map();
export function spriteURL(id) {
  if (urlCache.has(id)) return urlCache.get(id);
  const u = spriteCanvas(SPRITES[id] ? id : 'missing').toDataURL();
  urlCache.set(id, u);
  return u;
}

defineSprites({
  missing: {
    w: 16, h: 16,
    draw(p) { p.rect(2, 2, 12, 12, PAL.wine); p.rect(5, 5, 6, 6, PAL.void); },
  },
});
