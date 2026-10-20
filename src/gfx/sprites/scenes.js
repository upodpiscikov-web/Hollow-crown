// Scenes (event art, 96x64) and backgrounds (256x144).
// Painted procedurally: dithered gradients, noise fog, silhouette layers, ash.
// All defs use outline:false + rim:false, so the painter's buffer is unpadded
// and helpers write to it directly for speed.
import { defineSprites, PAL, rgba, mix, shadeColor } from '../sprite.js';

// ------------------------------------------------------------------ helpers
const BY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const by = (x, y) => BY[(y & 3) * 4 + (x & 3)];
const C = (c) => rgba(c);
const dk = (c, f) => shadeColor(c, -f);
const lt = (c, f) => shadeColor(c, f);

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
function hash2(x, y, s) {
  let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
// 1-D fractal noise in 0..1 (ridgelines, skylines).
const fbm = (x, s) => vnoise(x, 0.5, s) * 0.6 + vnoise(x * 2.1, 3.5, s + 9) * 0.28 + vnoise(x * 4.7, 7.5, s + 23) * 0.12;

// Surface: direct access to the painter's buffer.
function surf(p) {
  const d = p.d, W = p.w, H = p.h;
  const S = {
    p, d, W, H,
    set(x, y, c) {
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      const i = (y * W + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
    },
    get(x, y) { const i = (y * W + x) * 4; return [d[i], d[i + 1], d[i + 2], 255]; },
    blend(x, y, c, a) {
      if (x < 0 || y < 0 || x >= W || y >= H || a <= 0) return;
      const i = (y * W + x) * 4;
      if (a >= 1) { d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255; return; }
      d[i] += (c[0] - d[i]) * a; d[i + 1] += (c[1] - d[i + 1]) * a; d[i + 2] += (c[2] - d[i + 2]) * a; d[i + 3] = 255;
    },
    // dithered, stepped alpha: keeps the pixel-art banding instead of smooth blends
    dblend(x, y, c, a, steps = 4) {
      const q = Math.floor(a * steps + by(x, y)) / steps;
      if (q > 0) S.blend(x, y, c, Math.min(1, q));
    },
    // vertical gradient through colour stops with ordered dither
    sky(y0, y1, stops, x0 = 0, x1 = W) {
      const cs = stops.map(C), n = cs.length - 1;
      for (let y = Math.max(0, y0); y < Math.min(H, y1); y++) {
        const t = ((y - y0) / Math.max(1, y1 - y0 - 1)) * n;
        const i = Math.min(n - 1, Math.floor(t)), f = t - i;
        for (let x = x0; x < x1; x++) S.set(x, y, by(x, y) < f ? cs[i + 1] : cs[i]);
      }
    },
    // fill below a top-line function; col may be a colour or (x,y,depth)=>colour
    fillBelow(top, col, y1 = H, x0 = 0, x1 = W) {
      const fn = typeof col === 'function' ? col : null, c = fn ? null : C(col);
      for (let x = x0; x < x1; x++) {
        const t = Math.round(top(x));
        for (let y = Math.max(0, t); y < Math.min(H, y1); y++) S.set(x, y, fn ? fn(x, y, y - t) : c);
      }
    },
    // horizontal band of noisy fog centred on yc
    fog(yc, hh, col, amt, seed = 1, sc = 18, x0 = 0, x1 = W) {
      const c = C(col);
      for (let y = Math.max(0, Math.floor(yc - hh)); y < Math.min(H, Math.ceil(yc + hh)); y++) {
        const fy = 1 - Math.abs(y - yc) / hh;
        if (fy <= 0) continue;
        for (let x = x0; x < x1; x++) {
          const n = vnoise(x / sc, y / (sc * 0.35), seed);
          S.dblend(x, y, c, amt * fy * (0.35 + n * 0.9));
        }
      }
    },
    // radial light pool / glow
    glow(cx, cy, r, col, amt, ry = r) {
      const c = C(col);
      for (let y = Math.max(0, Math.floor(cy - ry)); y < Math.min(H, Math.ceil(cy + ry)); y++)
        for (let x = Math.max(0, Math.floor(cx - r)); x < Math.min(W, Math.ceil(cx + r)); x++) {
          const dd = Math.hypot((x + 0.5 - cx) / r, (y + 0.5 - cy) / ry);
          if (dd < 1) S.dblend(x, y, c, amt * (1 - dd) * (1 - dd), 5);
        }
    },
    // darken toward the frame edges
    vignette(amt, col = PAL.void) {
      const c = C(col);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const dx = (x - W / 2) / (W / 2), dy = (y - H / 2) / (H / 2);
        const v = Math.max(0, Math.hypot(dx * 0.85, dy) - 0.62);
        if (v > 0) S.dblend(x, y, c, Math.min(1, v * amt), 5);
      }
    },
    // global colour grade
    grade(col, amt) { const c = C(col); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) S.blend(x, y, c, amt); },
    // falling ash: single specks and short drifting flakes
    ash(n, seed, cols = [PAL.fog, PAL.stone], y0 = 0, y1 = H, x0 = 0, x1 = W) {
      const r = rng(seed), cs = cols.map(C);
      for (let i = 0; i < n; i++) {
        const x = Math.floor(x0 + r() * (x1 - x0)), y = Math.floor(y0 + r() * (y1 - y0)), c = cs[(r() * cs.length) | 0];
        S.blend(x, y, c, 0.55 + r() * 0.45);
        if (r() < 0.25) S.blend(x + 1, y + 1, c, 0.4);
      }
    },
    // mirror the rows above yLine into the water below, darkened, with ripples
    reflect(yLine, y1, tintCol, tintAmt = 0.4, seed = 3, x0 = 0, x1 = W) {
      const c = C(tintCol);
      for (let y = yLine; y < Math.min(H, y1); y++) {
        const sy = 2 * yLine - y - 1;
        if (sy < 0) continue;
        const off = Math.round((vnoise(y * 0.7, 0.5, seed) - 0.5) * (2 + (y - yLine) * 0.15));
        for (let x = x0; x < x1; x++) {
          const sx = Math.max(0, Math.min(W - 1, x + off));
          const src = S.get(sx, sy);
          S.set(x, y, src);
          S.blend(x, y, c, tintAmt + ((y + (x >> 3)) % 5 === 0 ? 0.12 : 0));
        }
      }
    },
    // per-pixel noise texture on a rectangle (ground, stone)
    texture(x0, y0, x1, y1, col, amt, sc = 3, seed = 4) {
      const c = C(col);
      for (let y = Math.max(0, y0); y < Math.min(H, y1); y++) for (let x = Math.max(0, x0); x < Math.min(W, x1); x++) {
        const n = vnoise(x / sc, y / (sc * 0.6), seed);
        if (n > 0.55) S.dblend(x, y, c, (n - 0.55) * amt * 2.2, 3);
      }
    },
  };
  return S;
}

// ------------------------------------------------------------------ silhouette props
function deadTree(p, x, y, h, col, seed = 1, lean = 0) {
  const r = rng(seed);
  const tw = Math.max(1, Math.round(h / 12));
  const branch = (bx, by0, ang, len, w, depth) => {
    const ex = bx + Math.cos(ang) * len, ey = by0 + Math.sin(ang) * len;
    p.line(bx, by0, ex, ey, col, w);
    if (depth <= 0 || len < 2.5) return;
    const k = 2 + ((r() * 2) | 0);
    for (let i = 0; i < k; i++) {
      const t = 0.45 + r() * 0.55;
      branch(bx + (ex - bx) * t, by0 + (ey - by0) * t, ang + (r() - 0.5) * 1.6, len * (0.45 + r() * 0.25), Math.max(1, w - 1), depth - 1);
    }
  };
  branch(x, y, -Math.PI / 2 + lean, h * 0.55, tw + 1, 0);
  const tx = x + Math.cos(-Math.PI / 2 + lean) * h * 0.55, ty = y + Math.sin(-Math.PI / 2 + lean) * h * 0.55;
  branch(tx, ty, -Math.PI / 2 + lean * 1.4 - 0.3, h * 0.45, tw, 3);
  branch(tx, ty, -Math.PI / 2 + lean + 0.7, h * 0.35, tw, 2);
  branch(x + (tx - x) * 0.5, y + (ty - y) * 0.5, -Math.PI / 2 - 0.9, h * 0.3, Math.max(1, tw - 1), 2);
}
function weepTree(p, x, y, h, col, seed = 1, spread = 1) {
  const r = rng(seed);
  const tw = Math.max(2, Math.round(h / 9));
  p.poly([[x - tw, y], [x + tw, y], [x + tw * 0.5, y - h * 0.7], [x - tw * 0.4, y - h * 0.7]], col);
  p.path([[x - tw, y], [x - tw * 3, y + 1]], col, 2); p.path([[x + tw, y], [x + tw * 3, y + 1]], col, 2);
  const cx = x, cy = y - h * 0.75;
  p.ellipse(cx, cy, h * 0.42 * spread, h * 0.22, col);
  const n = Math.round(h * 0.9 * spread);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI - Math.PI;
    const sx = cx + Math.cos(a) * h * 0.42 * spread * (0.6 + r() * 0.4), sy = cy + Math.sin(a) * h * 0.18;
    const len = h * (0.25 + r() * 0.45);
    p.path([[sx, sy], [sx + (r() - 0.5) * 3, sy + len * 0.6], [sx + (r() - 0.5) * 4, sy + len]], col, 1);
  }
}
function pine(p, x, y, h, w, col) {
  for (let i = 0; i < 4; i++) {
    const ty = y - h + (i * h) / 4.5, bw = w * (0.35 + i * 0.22);
    p.tri(x - bw, ty + h / 3.2, x + bw, ty + h / 3.2, x, ty, col);
  }
  p.rect(x - 0.5, y - h / 5, 1.5, h / 5, col);
}
function gibbet(p, x, y, h, col, body = PAL.dusk, sway = 0) {
  const w = Math.max(1, Math.round(h / 14));
  p.rect(x, y - h, w + 1, h, col);
  p.rect(x - 1, y - h, h * 0.45, w, col);
  p.line(x + 1, y - h * 0.75, x + h * 0.22, y - h + 1, col, 1);
  const hx = x + h * 0.42, hy = y - h;
  p.line(hx, hy, hx + sway, hy + h * 0.18, col, 1);
  const by0 = hy + h * 0.18;
  if (h > 20) {
    p.ellipse(hx + sway, by0 + h * 0.16, h * 0.08, h * 0.17, body);
    p.ring(hx + sway, by0 + h * 0.16, h * 0.1, col, 1);
    p.line(hx + sway - h * 0.1, by0 + h * 0.16, hx + sway + h * 0.1, by0 + h * 0.16, col, 1);
  } else {
    p.rect(hx + sway - 1, by0, 2, Math.max(2, h * 0.28), body);
  }
}
function crow(p, x, y, col, s = 1) {
  p.path([[x - 2 * s, y - s], [x, y], [x + 2 * s, y - s]], col, 1);
}
function house(p, x, y, w, h, wall, roof, opts = {}) {
  p.rect(x, y - h, w, h, wall, opts.shade ? { shade: opts.shade } : undefined);
  const rh = opts.rh || h * 0.8;
  p.poly([[x - 1.5, y - h + 0.5], [x + w / 2, y - h - rh], [x + w + 1.5, y - h + 0.5]], roof, opts.shade ? { shade: opts.shade } : undefined);
  if (opts.chimney) p.rect(x + w * 0.7, y - h - rh * 0.9, 2, rh * 0.6, roof);
  if (opts.lit) for (const [lx, ly] of opts.lit) p.rect(x + lx, y - h + ly, 2, 2, opts.litCol || PAL.candle);
  if (opts.door) p.rect(x + opts.door, y - Math.min(5, h * 0.55), 2, Math.min(5, h * 0.55), dk(wall, 0.6));
}
function spire(p, x, y, w, h, col, opts = {}) {
  p.rect(x, y - h, w, h, col);
  const ph = opts.ph || w * 2.2;
  p.tri(x - (opts.flare || 0.5), y - h + 0.5, x + w + (opts.flare || 0.5), y - h + 0.5, x + w / 2, y - h - ph, opts.roof || col);
  if (opts.gild) { p.line(x + w / 2, y - h - ph, x + w / 2 + (w > 4 ? 1 : 0), y - h - ph * 0.4, opts.gild); }
  if (opts.win) for (let yy = y - h + 3; yy < y - 3; yy += opts.winGap || 6) if (w >= 3) p.px(x + Math.floor(w / 2), yy, opts.win);
}
function dome(p, x, y, r, col, gild) {
  p.ellipse(x, y, r, r * 0.9, col);
  p.rect(x - r, y, r * 2, r * 0.6, col);
  p.line(x, y - r * 0.9, x, y - r * 1.6, gild || col, 1);
  if (gild) p.px(Math.round(x - r * 0.4), Math.round(y - r * 0.5), gild);
}
function reeds(p, x0, x1, y, col, seed = 2, hmax = 6) {
  const r = rng(seed);
  for (let x = x0; x < x1; x++) {
    if (r() < 0.45) continue;
    const h = 1 + r() * hmax;
    p.line(x, y, x + (r() - 0.5) * 2, y - h, col, 1);
  }
}
function graveCross(p, x, y, h, col) {
  p.rect(x, y - h, 1, h, col);
  p.rect(x - Math.floor(h / 3), y - h + Math.floor(h / 4), Math.floor(h / 3) * 2 + 1, 1, col);
}
function headstone(p, x, y, w, h, col) {
  p.rect(x, y - h + w / 2, w, h - w / 2, col);
  p.ellipse(x + w / 2, y - h + w / 2, w / 2, w / 2, col);
}
function arch(p, x, y, w, h, col, thick = 2) {
  // pointed gothic arch outline (filled frame)
  const r = w / 2;
  p.rect(x, y - h + r, thick, h - r, col);
  p.rect(x + w - thick, y - h + r, thick, h - r, col);
  for (let a = 0; a <= 1; a += 0.04) {
    const t = a * Math.PI / 2;
    const lx = x + r - Math.cos(t) * r * 0.2 - (1 - Math.sin(t)) * 0, ly = y - h + r - Math.sin(t) * r;
    p.rect(x + (1 - Math.cos(t)) * 0 + Math.sin(t) * r * 0.9 - 0, ly, thick, thick, col);
    p.rect(x + w - thick - Math.sin(t) * r * 0.9, ly, thick, thick, col);
    void lx;
  }
}


// light shaft (god-ray) from (x0,y0) widening toward (x1,y1)
function shaft(S, x0, y0, x1, y1, w0, w1, col, amt) {
  const c = C(col), lo = Math.min(y0, y1), hi = Math.max(y0, y1);
  for (let y = lo; y <= hi; y++) {
    const t = (y - y0) / (y1 - y0 || 1);
    const cx = x0 + (x1 - x0) * t, w = (w0 + (w1 - w0) * t) / 2;
    for (let x = Math.floor(cx - w); x <= Math.ceil(cx + w); x++) {
      const e = 1 - Math.abs(x - cx) / (w + 0.01);
      if (e > 0) S.dblend(x, y, c, amt * Math.min(1, e * 1.6) * (1 - t * 0.4), 4);
    }
  }
}
// pointed-arch opening (doors, windows): fn(x,y,tx,ty) -> colour|null
function opening(S, cx, yb, hw, hs, ha, fn) {
  for (let y = Math.floor(yb - hs - ha); y <= yb; y++) {
    let half = hw;
    if (y < yb - hs) { const t = (yb - hs - y) / ha; if (t > 1) continue; half = hw * (1 - Math.pow(t, 1.8)); }
    for (let x = Math.ceil(cx - half); x <= Math.floor(cx + half - 1); x++) {
      const c = fn(x, y, (x - cx) / hw, (yb - y) / (hs + ha));
      if (c) S.set(x, y, c);
    }
  }
}
const grad = (c0, c1) => { const a = C(c0), b = C(c1); return (x, y, tx, ty) => (by(x, y) < ty ? b : a); };
// smoke plume: rising, drifting, widening puffs
function plume(S, x0, y0, rise, drift, col, amt, seed) {
  const r = rng(seed);
  for (let i = 0; i < 16; i++) {
    const t = i / 15;
    S.glow(x0 + drift * t + (r() - 0.5) * 3, y0 - rise * t, 2.5 + t * 9, col, amt * (1 - t * 0.55), (2.5 + t * 9) * 0.8);
  }
}

// ------------------------------------------------------------------ backgrounds (256x144)
const BG = { w: 256, h: 144, outline: false, rim: false };

defineSprites({
  // ---------------------------------------------------------------- Act 1
  bg_act1: {
    ...BG,
    draw(p) {
      const S = surf(p);
      S.sky(0, 96, [mix(PAL.night, PAL.ash, 0.3), mix(PAL.dusk, PAL.ash, 0.5), mix(PAL.ash, PAL.stone, 0.25), mix(PAL.stone, PAL.fog, 0.45), mix(PAL.fog, PAL.bone, 0.15)]);
      S.glow(188, 58, 46, PAL.bone, 0.3);
      p.circle(188, 58, 6, mix(PAL.fog, PAL.bone, 0.5));
      S.fog(30, 8, PAL.dusk, 0.35, 11, 30); S.fog(66, 7, PAL.bone, 0.22, 12, 24);
      // far hills with small gibbets
      const farC = mix(PAL.ash, PAL.stone, 0.3), dark = mix(PAL.night, PAL.ash, 0.25);
      const t1 = (x) => 82 - fbm(x / 40, 5) * 12;
      S.fillBelow(t1, farC, 110);
      for (const [x, h] of [[36, 13], [80, 10], [140, 12], [226, 14]]) gibbet(p, x, t1(x) + 1, h, dark, dark);
      S.fog(86, 8, PAL.fog, 0.5, 14, 22);
      // mid ridge, darker, with the big gibbets and dead trees
      const midC = mix(PAL.night, PAL.ash, 0.4), t2 = (x) => 94 - fbm(x / 26 + 10, 6) * 9;
      S.fillBelow(t2, midC, 112);
      gibbet(p, 60, t2(60) + 2, 30, dark, mix(PAL.ink, PAL.dusk, 0.5), 1);
      gibbet(p, 198, t2(198) + 2, 36, dark, mix(PAL.ink, PAL.dusk, 0.5), -1);
      for (const [x, h, sd] of [[14, 26, 2], [118, 17, 3], [132, 11, 4], [244, 24, 5]]) deadTree(p, x, t2(x) + 2, h, dark, sd, sd % 2 ? 0.15 : -0.12);
      crow(p, 92, 62, dark); crow(p, 98, 58, dark); crow(p, 168, 50, dark); crow(p, 174, 55, dark);
      S.fog(100, 6, PAL.fog, 0.4, 15, 26);
      // the fen: dull umber ground, pools holding the sky
      const ground = mix(PAL.dusk, PAL.moss, 0.3), groundD = mix(PAL.night, PAL.moss, 0.2);
      S.sky(102, 144, [mix(ground, PAL.ash, 0.2), ground, mix(ground, groundD, 0.5), groundD]);
      const r = rng(77);
      for (let i = 0; i < 9; i++) {
        const py = 104 + r() * 10, pw = 14 + r() * 28, px0 = r() * 256;
        p.ellipse(px0, py, pw, 1 + r() * 1.4, mix(PAL.ash, PAL.fog, 0.2 + r() * 0.25));
        p.ellipse(px0 - 2, py + 0.7, pw * 0.7, 0.7, mix(PAL.ash, PAL.dusk, 0.35));
      }
      for (const [x0, x1, y] of [[0, 34, 106], [74, 96, 104], [146, 172, 108], [204, 240, 105]]) reeds(p, x0, x1, y, mix(PAL.night, PAL.moss, 0.3), x0 + 3, 5);
      S.texture(0, 108, 256, 144, mix(ground, PAL.ash, 0.2), 0.35, 4, 21);
      S.fog(110, 6, PAL.fog, 0.2, 16, 40);
      S.ash(120, 101, [PAL.fog, PAL.stone, PAL.bone], 0, 100);
      S.ash(26, 102, [PAL.stone, PAL.ash], 100, 144);
      S.vignette(0.8);
    },
  },

  // ---------------------------------------------------------------- Act 2
  bg_act2: {
    ...BG,
    draw(p) {
      const S = surf(p);
      S.sky(0, 100, [PAL.void, mix(PAL.deep, PAL.ink, 0.4), mix(PAL.water, PAL.deep, 0.45), mix(PAL.water, PAL.ghost, 0.2)]);
      S.glow(196, 30, 44, PAL.ghost, 0.22);
      p.circle(196, 30, 5, mix(PAL.ghost, PAL.water, 0.35));
      S.fog(32, 8, PAL.ghost, 0.16, 31, 34);
      // far hazy treeline
      const farC = mix(PAL.water, PAL.deep, 0.4), nearC = mix(PAL.deep, PAL.ink, 0.55), tl = (x) => 90 - fbm(x / 22, 41) * 9;
      S.fillBelow(tl, farC, 100);
      for (let x = 2; x < 256; x += 5 + ((x * 7) % 4)) pine(p, x, tl(x) + 3, 12 + hash2(x, 1, 5) * 12, 4.5, farC);
      S.fog(88, 7, PAL.ghost, 0.28, 32, 24);
      // the drowned abbey, half-sunk in the mere
      const yW = 100, ab = mix(PAL.ink, PAL.deep, 0.5), win = mix(PAL.spirit, PAL.deep, 0.4);
      p.rect(86, yW - 24, 62, 24, ab);                                  // nave
      p.poly([[84, yW - 24], [117, yW - 40], [150, yW - 24]], ab);        // roof, holed
      p.erase(104, yW - 33, 9, 6); p.erase(118, yW - 30, 5, 5);
      p.rect(150, yW - 48, 13, 48, ab);                                  // tower
      p.poly([[149, yW - 48], [152, yW - 55], [155, yW - 50], [158, yW - 58], [161, yW - 51], [164, yW - 48]], ab); // broken top
      p.rect(70, yW - 15, 17, 15, ab); p.poly([[69, yW - 15], [78, yW - 24], [88, yW - 15]], ab); // transept
      for (const x of [92, 102, 112, 124, 134]) opening(S, x, yW - 5, 2, 6, 4, grad(PAL.deep, win));
      opening(S, 156, yW - 28, 2, 4, 3, grad(PAL.deep, win)); opening(S, 156, yW - 10, 1.5, 3, 2, grad(PAL.deep, win));
      opening(S, 78, yW - 3, 2, 4, 3, grad(PAL.deep, win));
      S.glow(118, yW - 14, 26, PAL.spirit, 0.12);
      S.fog(yW - 3, 5, PAL.ghost, 0.5, 33, 20);
      // marshy banks either side
      S.fillBelow((x) => yW + 1 - (x < 70 ? (70 - x) * 0.08 : x > 190 ? (x - 190) * 0.1 : -3), nearC, yW + 3, 0, 70);
      S.fillBelow((x) => yW - 1 - (x - 190) * 0.1, nearC, yW + 3, 190, 256);
      reeds(p, 0, 70, yW, nearC, 3, 7); reeds(p, 186, 256, yW, nearC, 4, 8);
      // water: reflect everything above, ripple, mist
      S.reflect(yW + 3, 144, PAL.deep, 0.5, 5);
      const r = rng(55);
      for (let i = 0; i < 40; i++) { const y = 104 + r() * 38, x = r() * 250, w = 3 + r() * 10; for (let k = 0; k < w; k++) S.blend(x + k, y, PAL.ghost.length ? C(PAL.ghost) : [0, 0, 0], 0.16); }
      S.fog(108, 4, PAL.ghost, 0.3, 34, 28);
      // framing weeping trees
      const tree = mix(PAL.void, PAL.deep, 0.35);
      weepTree(p, 14, 144, 104, tree, 7, 1.05);
      weepTree(p, 246, 144, 96, tree, 8, 0.95);
      S.fog(140, 4, PAL.ghost, 0.12, 35, 30);
      S.ash(40, 61, [PAL.ghost, PAL.frost], 0, 100); // pollen / spores
      S.vignette(0.9, PAL.void);
    },
  },

  // ---------------------------------------------------------------- Act 3
  bg_act3: {
    ...BG,
    draw(p) {
      const S = surf(p);
      S.sky(0, 100, [mix(PAL.ink, PAL.wine, 0.35), mix(PAL.dusk, PAL.wine, 0.4), mix(PAL.bruise, PAL.ember, 0.3), mix(PAL.ember, PAL.ash, 0.45), mix(PAL.flame, PAL.ash, 0.55)]);
      S.glow(150, 92, 70, PAL.flame, 0.28, 46);
      S.fog(40, 10, PAL.wine, 0.3, 61, 36);
      // smoke columns drifting right
      for (const [x, y, rise, dr, sd] of [[60, 98, 74, 30, 1], [110, 100, 82, 38, 2], [196, 98, 70, 28, 3], [236, 100, 60, 24, 4]]) plume(S, x, y, rise, dr, mix(PAL.ink, PAL.ash, 0.4), 0.55, sd);
      // far skyline, hazy
      const far = mix(PAL.dusk, PAL.ember, 0.22), mid = mix(PAL.night, PAL.wine, 0.45), near = mix(PAL.ink, PAL.void, 0.4);
      let r = rng(9);
      for (let x = -4; x < 260;) { const w = 4 + ((r() * 6) | 0), h = 14 + r() * 22; spire(p, x, 100, w, h, far, { ph: r() < 0.6 ? 8 + r() * 12 : 3, roof: far }); x += w + ((r() * 3) | 0); }
      S.fog(98, 6, PAL.flame, 0.22, 62, 26);
      // mid skyline with the great cathedral
      r = rng(21);
      for (let x = -2; x < 258;) {
        const w = 5 + ((r() * 7) | 0), h = 16 + r() * 26;
        if (x > 108 && x < 190) { x = 190; continue; }
        spire(p, x, 106, w, h, mid, { ph: r() < 0.55 ? 10 + r() * 16 : 3, roof: mid, gild: r() < 0.5 ? PAL.gold : null, win: r() < 0.5 ? mix(PAL.flame, PAL.wine, 0.3) : null, winGap: 7 });
        x += w + ((r() * 2) | 0);
      }
      // cathedral / palace, gilded and decaying
      const cat = mid;
      p.rect(112, 58, 74, 48, cat);
      dome(p, 149, 52, 17, cat, PAL.gold);
      spire(p, 108, 106, 8, 62, cat, { ph: 22, roof: cat, gild: PAL.gold });
      spire(p, 182, 106, 8, 70, cat, { ph: 24, roof: cat, gild: PAL.gold });
      spire(p, 128, 106, 6, 54, cat, { ph: 18, roof: cat, gild: PAL.gold });
      spire(p, 166, 106, 6, 60, cat, { ph: 18, roof: cat, gild: PAL.gold });
      p.erase(182, 36, 3, 4); p.erase(130, 52, 2, 3); // broken stone
      for (const x of [118, 126, 140, 152, 164, 174]) opening(S, x, 90, 2, 6, 4, grad(mix(PAL.night, PAL.wine, 0.4), mix(PAL.flame, PAL.ember, 0.4)));
      opening(S, 149, 106, 5, 8, 8, grad(mix(PAL.ink, PAL.wine, 0.3), mix(PAL.flame, PAL.ember, 0.5)));
      for (const [x, y] of [[149, 30], [111, 40], [185, 32], [131, 49], [169, 44]]) p.px(x, y, PAL.candle);
      S.fog(104, 5, PAL.flame, 0.2, 63, 24);
      // near wall and gate-road
      S.sky(104, 144, [mix(PAL.ink, PAL.wine, 0.25), PAL.void]);
      for (let x = 0; x < 256; x += 8) p.rect(x, 100, 5, 5, near);
      p.rect(0, 104, 256, 6, near);
      S.texture(0, 110, 256, 144, mix(PAL.dusk, PAL.wine, 0.4), 0.28, 3, 66);
      p.rect(0, 109, 256, 1, mix(PAL.dusk, PAL.wine, 0.45));
      S.ash(130, 67, [PAL.fog, PAL.stone, PAL.ember], 0, 110);
      S.ash(40, 68, [PAL.stone, PAL.ember], 110, 144);
      S.vignette(0.85);
    },
  },

  // ---------------------------------------------------------------- Act 4
  bg_act4: {
    ...BG,
    draw(p) {
      const S = surf(p), d = p.d, vx = 128, vy = 84;
      const stone = C(mix(PAL.dusk, PAL.stone, 0.18)), void_ = C(PAL.void), bone = C(mix(PAL.bone, PAL.ghost, 0.3)), glowc = C(mix(PAL.ghost, PAL.bone, 0.45));
      const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, 255];
      for (let y = 0; y < 144; y++) for (let x = 0; x < 256; x++) {
        const dx = x - vx, dy = y - vy, ax = Math.abs(dx) / 128;
        const ay = dy < 0 ? -dy / 90 * (1 + ax * 0.15) : dy / 56;
        const m = Math.pow(Math.pow(ax, 2.7) + Math.pow(ay, 2.7), 1 / 2.7);
        const b = m >= 1 ? 0 : Math.log(Math.max(m, 0.003)) / Math.log(0.66);
        const k = Math.floor(b), fr = b - k;
        const depth = Math.min(1, Math.max(0, b / 10));       // 0 near .. 1 far
        let c;
        const lum = 0.1 + depth * depth * 0.62;
        const rib = fr < 0.3;
        if (m < 0.012) c = glowc;
        else {
          let base = rib ? stone : mixc(stone, void_, 0.5);
          // wall bands shaded across the band; rib lit on its top edge
          base = mixc(void_, base, Math.min(1, lum * 1.5));
          if (!rib && dy < 0) {
            // ossuary skulls packed into the walls (not in the calm lower third)
            const cs = Math.max(2, Math.round(2 + m * 4));
            const cx = Math.floor(x / cs), cy = Math.floor(y / cs);
            if (y < 112 && hash2(cx, cy, 3) < 0.4) {
              const lx = x - cx * cs, ly = y - cy * cs;
              const eye = cs >= 3 && ly === 1 && (lx === 1 || lx === cs - 2);
              const jaw = cs >= 4 && ly === cs - 1 && lx % 2 === 0;
              if (!jaw) base = mixc(base, eye ? void_ : bone, eye ? 0.9 : 0.55 * Math.min(1, lum * 2.2));
            } else if (hash2(x, y, 9) < 0.08) base = mixc(base, bone, 0.18);
          }
          if (dy > 0) base = mixc(base, void_, 0.18 + (y - vy) / 120 * 0.3); // floor
          const g = Math.max(0, 1 - m * 1.4);                   // glow bleeding from the far end
          c = mixc(base, glowc, g * g * 0.8);
        }
        const i = (y * 256 + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
      }
      // pale light pooling on the floor
      shaft(S, vx, vy + 4, vx, 144, 10, 70, PAL.ghost, 0.2);
      S.glow(vx, vy + 2, 38, PAL.bone, 0.3, 24);
      // roots breaking through the vaults
      const rr = rng(88);
      for (let i = 0; i < 16; i++) {
        const x0 = rr() * 256, len = 14 + rr() * 38;
        p.path([[x0, 0], [x0 + (rr() - 0.5) * 8, len * 0.5], [x0 + (rr() - 0.5) * 12, len]], mix(PAL.bark, PAL.void, 0.35), 1 + ((rr() * 2) | 0));
      }
      for (let i = 0; i < 8; i++) { const x0 = rr() * 256, y0 = 10 + rr() * 50; p.px(x0, y0, PAL.bile); }
      S.fog(vy + 12, 7, PAL.ghost, 0.25, 71, 30);
      S.ash(40, 72, [PAL.bone, PAL.ghost], 0, 120);
      S.vignette(0.9);
    },
  },

  // ---------------------------------------------------------------- Hub
  bg_hub: {
    ...BG,
    draw(p) {
      const S = surf(p);
      S.sky(0, 100, [mix(PAL.night, PAL.bruise, 0.45), mix(PAL.bruise, PAL.ash, 0.3), mix(PAL.wine, PAL.ash, 0.35), mix(PAL.ember, PAL.ash, 0.5), mix(PAL.flame, PAL.fog, 0.35)]);
      S.fog(40, 7, PAL.bruise, 0.3, 81, 34); S.fog(70, 5, PAL.rose, 0.16, 82, 30);
      S.glow(70, 96, 70, PAL.flame, 0.22, 30);
      // far hills + dead woods
      const farC = mix(PAL.bruise, PAL.ash, 0.4), t1 = (x) => 88 - fbm(x / 36, 85) * 12;
      S.fillBelow(t1, farC, 108);
      for (let x = 3; x < 256; x += 7 + ((x * 3) % 5)) if (hash2(x, 2, 7) < 0.6) deadTree(p, x, t1(x) + 1, 8 + hash2(x, 3, 7) * 9, mix(PAL.night, PAL.bruise, 0.45), x, 0);
      S.fog(94, 6, PAL.rose, 0.2, 83, 26);
      // graveyard slope
      const g0 = mix(PAL.dusk, PAL.moss, 0.25), g1 = mix(PAL.night, PAL.moss, 0.2), t2 = (x) => 98 - fbm(x / 50 + 3, 86) * 5;
      S.fillBelow(t2, (x, y, dp) => (by(x, y) < Math.min(1, dp / 28) ? g1 : g0), 144);
      // Hob's hut, lantern-lit (left)
      const hut = mix(PAL.ink, PAL.bark, 0.45), roof = mix(PAL.night, PAL.bark, 0.3);
      p.rect(28, 98, 38, 20, hut); p.poly([[24, 98], [47, 80], [70, 98]], roof);
      p.rect(58, 80, 5, 12, hut);
      p.rect(36, 104, 7, 6, PAL.candle); p.line(39, 104, 39, 109, hut); p.line(36, 107, 42, 107, hut);
      p.rect(50, 106, 8, 12, mix(PAL.void, PAL.bark, 0.3));
      S.glow(39, 107, 18, PAL.candle, 0.42, 14);
      // lantern on a post by the door
      p.rect(70, 100, 1, 16, hut); p.rect(68, 98, 5, 1, hut); p.rect(69, 99, 3, 3, PAL.candle); S.glow(70, 100, 14, PAL.flame, 0.45);
      plume(S, 61, 80, 30, 8, mix(PAL.ash, PAL.dusk, 0.3), 0.4, 6);
      // the Waystone: tall standing stone, runes faintly lit
      const stoneC = mix(PAL.night, PAL.ash, 0.4);
      p.poly([[170, 112], [172, 54], [176, 40], [182, 36], [188, 42], [191, 60], [193, 112]], stoneC, { shade: 0.3 });
      p.poly([[181, 36], [188, 42], [191, 60], [193, 112], [186, 112], [187, 60]], mix(stoneC, PAL.void, 0.4));
      for (const [x, y] of [[178, 58], [182, 66], [180, 74], [184, 82], [179, 90], [183, 98]]) { p.px(x, y, mix(PAL.spirit, PAL.ghost, 0.2)); p.px(x + 1, y + 1, PAL.spirit); }
      S.glow(181, 74, 20, PAL.spirit, 0.16, 36);
      // graves: rows receding (smaller further), fresh mounds in front
      const rr = rng(33);
      for (let row = 0; row < 3; row++) {
        const y = 106 + row * 9, sc = 0.7 + row * 0.3;
        for (let x = 84 + ((row * 17) % 9); x < 250; x += 16 + ((rr() * 8) | 0)) {
          if (x > 164 && x < 198) continue;
          const c = mix(PAL.night, PAL.ash, 0.3 + row * 0.04);
          if (rr() < 0.5) headstone(p, x, y, 4 * sc + 1, 7 * sc + 1, c); else graveCross(p, x, y, 7 * sc + 2, c);
          p.ellipse(x + 2, y + 1, 5 * sc, 1.4, mix(PAL.bark, PAL.night, 0.45));
        }
      }
      for (const [x, y] of [[100, 125], [116, 129], [214, 127]]) {
        p.ellipse(x, y, 9, 2.4, mix(PAL.bark, PAL.dusk, 0.35), { shade: 0.2 });
        graveCross(p, x, y - 1, 9, mix(PAL.wood, PAL.ash, 0.3));
      }
      p.line(230, 131, 231, 119, PAL.wood, 1); p.rect(229, 118, 4, 3, PAL.iron); // spade in the soil
      p.ellipse(228, 133, 8, 2, mix(PAL.bark, PAL.dusk, 0.4));
      // worn path
      p.poly([[52, 118], [62, 118], [96, 144], [40, 144]], mix(PAL.dusk, PAL.ash, 0.15));
      S.texture(0, 108, 256, 144, mix(g0, PAL.ash, 0.2), 0.3, 4, 87);
      S.fog(112, 5, PAL.bruise, 0.28, 84, 32);
      S.ash(40, 88, [PAL.fog, PAL.stone], 0, 120);
      S.vignette(0.8);
    },
  },
});
