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
    // remember the backdrop so shapes can be 'cut out' of later layers (broken roofs, gaps)
    snap() { S._snap = new Uint8ClampedArray(d); },
    cut(x, y, w, h) {
      const sn = S._snap;
      for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const i = (yy * W + xx) * 4; d[i] = sn[i]; d[i + 1] = sn[i + 1]; d[i + 2] = sn[i + 2]; d[i + 3] = 255;
      }
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
        const dx = (x - W / 2) / (W / 2), dy = (y - H / 2) / (H / 2), q = dx * dx * 0.7225 + dy * dy;
        if (q <= 0.3844) continue; // inside the clear centre
        S.dblend(x, y, c, Math.min(1, (Math.sqrt(q) - 0.62) * amt), 5);
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
  if (opts.gild) { p.line(x + w / 2, y - h - ph, x + w / 2, y - h - ph + Math.min(4, ph * 0.3), opts.gild); p.px(x + w / 2, y - h - ph, PAL.candle); }
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


// allocation-free colour lerp for per-pixel loops: writes into out
const mixTo = (o, a, b, t) => { o[0] = a[0] + (b[0] - a[0]) * t; o[1] = a[1] + (b[1] - a[1]) * t; o[2] = a[2] + (b[2] - a[2]) * t; return o; };

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
      S.sky(100, 144, [mix(PAL.water, PAL.deep, 0.5), PAL.deep]); // water body (reflection overwrites it)
      S.glow(196, 30, 44, PAL.ghost, 0.22);
      p.circle(196, 30, 5, mix(PAL.ghost, PAL.water, 0.35));
      S.fog(32, 8, PAL.ghost, 0.16, 31, 34);
      // far hazy treeline
      const farC = mix(PAL.water, PAL.deep, 0.4), nearC = mix(PAL.deep, PAL.ink, 0.55), tl = (x) => 90 - fbm(x / 22, 41) * 9;
      S.fillBelow(tl, farC, 100);
      for (let x = 2; x < 256; x += 5 + ((x * 7) % 4)) pine(p, x, tl(x) + 3, 12 + hash2(x, 1, 5) * 12, 4.5, farC);
      S.fog(88, 7, PAL.ghost, 0.28, 32, 24);
      S.snap();
      // the drowned abbey, half-sunk in the mere
      const yW = 100, ab = mix(PAL.ink, PAL.deep, 0.5), win = mix(PAL.spirit, PAL.deep, 0.4);
      p.rect(86, yW - 24, 62, 24, ab);                                  // nave
      p.poly([[84, yW - 24], [117, yW - 40], [150, yW - 24]], ab);        // roof, holed
      S.cut(104, yW - 33, 9, 6); S.cut(118, yW - 30, 5, 5);
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
      S.sky(100, 110, [mix(PAL.ember, PAL.wine, 0.3), mix(PAL.ink, PAL.wine, 0.25)]);
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
      S.snap();
      // cathedral / palace, gilded and decaying
      const cat = mid;
      p.rect(112, 58, 74, 48, cat);
      dome(p, 149, 52, 17, cat, PAL.gold);
      spire(p, 108, 106, 8, 62, cat, { ph: 22, roof: cat, gild: PAL.gold });
      spire(p, 182, 106, 8, 70, cat, { ph: 24, roof: cat, gild: PAL.gold });
      spire(p, 128, 106, 6, 54, cat, { ph: 18, roof: cat, gild: PAL.gold });
      spire(p, 166, 106, 6, 60, cat, { ph: 18, roof: cat, gild: PAL.gold });
      S.cut(182, 36, 3, 4); S.cut(130, 52, 2, 3); // broken stone
      const lit = mix(PAL.flame, PAL.ember, 0.45), unlit = mix(PAL.night, PAL.wine, 0.25);
      for (const [x, y] of [[118, 84], [126, 84], [172, 84], [180, 84], [118, 72], [180, 70], [128, 70], [170, 70]]) { p.rect(x, y, 2, 5, hash2(x, y, 4) < 0.55 ? lit : unlit); }
      opening(S, 149, 106, 5, 8, 7, () => mix(PAL.ember, PAL.wine, 0.35));
      p.line(112, 58, 186, 58, mix(PAL.gold, PAL.wine, 0.45)); p.line(112, 59, 186, 59, mix(PAL.gold, PAL.wine, 0.7));
      p.line(132, 40, 166, 40, mix(PAL.gold, PAL.wine, 0.55));
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
      const S = surf(p), d = p.d, vx = 128, vy = 82;
      const stone = C(mix(PAL.stone, PAL.bruise, 0.3)), void_ = C(PAL.void), bone = C(mix(PAL.bone, PAL.ghost, 0.3)), glowc = C(mix(PAL.ghost, PAL.bone, 0.5));
      const L66 = Math.log(0.66), c = [0, 0, 0];
      for (let y = 0; y < 144; y++) for (let x = 0; x < 256; x++) {
        const dx = x - vx, dy = y - vy, ax = Math.abs(dx) / 126;
        const ay = dy < 0 ? (-dy / 84) * (1 + ax * 0.2) : dy / 60;
        const m = Math.cbrt(ax * ax * ax + ay * ay * ay);
        const b = m >= 1 ? 0 : Math.log(Math.max(m, 0.004)) / L66;
        const fr = b - Math.floor(b);
        const lum = 0.12 + Math.min(1, b / 9) * 0.55;
        if (m < 0.02) { c[0] = glowc[0]; c[1] = glowc[1]; c[2] = glowc[2]; }
        else if (fr < 0.26) {
          // stone rib: lit along its upper-left edge, dark on the lower-right
          mixTo(c, void_, stone, Math.min(1, lum * 1.7 * (fr < 0.07 ? 1.25 : fr > 0.2 ? 0.55 : 1)));
        } else {
          mixTo(c, void_, stone, lum * 0.5);
          if (dy < 0 && y < 116) {
            // ossuary: round skulls packed into the vault walls
            const cs = Math.max(2, Math.round(2 + m * 4.5)), cx = Math.floor(x / cs), cy = Math.floor(y / cs);
            if (hash2(cx, cy, 3) < 0.6) {
              const nx = (x - cx * cs + 0.5) / cs - 0.5, ny = (y - cy * cs + 0.5) / cs - 0.5;
              const eye = cs >= 4 && (Math.abs(nx) - 0.17) * (Math.abs(nx) - 0.17) + (ny + 0.05) * (ny + 0.05) < 0.018;
              const skull = (nx / 0.46) * (nx / 0.46) + ((ny + 0.08) / 0.42) * ((ny + 0.08) / 0.42) < 1 || (Math.abs(nx) < 0.2 && ny > 0.3);
              if (eye) mixTo(c, c, void_, 0.9); else if (skull) mixTo(c, c, bone, Math.min(0.62, 0.18 + lum * 0.85));
            }
          } else if (dy > 0) mixTo(c, c, void_, 0.15);
        }
        const g = 1 - m * 1.6;
        if (g > 0) mixTo(c, c, glowc, g * g * 0.7);
        const i = (y * 256 + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
      }
      // pale light pooling on the floor, far below
      shaft(S, vx, vy + 4, vx, 144, 12, 60, PAL.ghost, 0.18);
      S.glow(vx, vy + 1, 30, PAL.bone, 0.22, 16);
      // roots breaking through the vaults
      const rr = rng(88);
      for (let i = 0; i < 18; i++) {
        const x0 = rr() * 256, len = 12 + rr() * 40;
        p.path([[x0, 0], [x0 + (rr() - 0.5) * 8, len * 0.5], [x0 + (rr() - 0.5) * 12, len]], mix(PAL.bark, PAL.void, 0.3), 1 + ((rr() * 2) | 0));
      }
      for (let i = 0; i < 10; i++) { const x0 = rr() * 256, y0 = 8 + rr() * 60; p.px(x0, y0, mix(PAL.bile, PAL.moss, 0.4)); }
      S.ash(40, 72, [PAL.bone, PAL.ghost], 0, 120);
      S.vignette(0.95);
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

  // ---------------------------------------------------------------- Throne room
  bg_throne: {
    ...BG,
    draw(p) {
      const S = surf(p), VX = 128, VY = 72;
      const wall = mix(PAL.night, PAL.dusk, 0.45), wallD = mix(PAL.ink, PAL.night, 0.5), floor = mix(PAL.ink, PAL.dusk, 0.4), ceil = mix(PAL.void, PAL.night, 0.5);
      const pj = (z) => 1 / (1 + z);
      // shell (flat fills; texture comes from light, not per-pixel shading)
      p.rect(0, 0, 256, 144, ceil);
      p.poly([[0, 0], [90, 31], [90, 93], [0, 144]], wall);
      p.poly([[256, 0], [166, 31], [166, 93], [256, 144]], wallD);
      S.sky(31, 93, [mix(PAL.night, PAL.wine, 0.12), mix(PAL.wine, PAL.ink, 0.35)], 90, 166);
      const f0 = C(mix(PAL.ink, PAL.dusk, 0.22)), f1 = C(mix(PAL.ink, PAL.dusk, 0.34)), cp = C(mix(PAL.wine, PAL.gore, 0.25)), gd = C(PAL.gold), vd = C(PAL.void), cc = [0, 0, 0];
      for (let y = 93; y < 144; y++) {
        const t = (y - 93) / 51, xl = Math.round(90 - 90 * t), xr = Math.round(166 + 90 * t), z = 72 / (y - 72) - 1, fade = 0.15 + t * 0.55;
        for (let x = xl; x < xr; x++) {
          const u = ((x - 128) * (1 + z)) / 128, au = Math.abs(u);
          if (au < 0.25) mixTo(cc, cp, vd, 0.1 + t * 0.5);
          else if (au < 0.29) mixTo(cc, gd, vd, 0.45 + t * 0.4);
          else mixTo(cc, ((Math.floor(z * 3) + Math.floor(u * 7)) & 1) ? f1 : f0, vd, fade);
          const i = (y * 256 + x) * 4; p.d[i] = cc[0]; p.d[i + 1] = cc[1]; p.d[i + 2] = cc[2]; p.d[i + 3] = 255;
        }
      }
      // great windows on the left wall throw cold light across the floor
      for (const [za, zb] of [[0.3, 0.75], [1.0, 1.4], [1.7, 2.0]]) {
        const xa = 128 - 128 * pj(za), xb = 128 - 128 * pj(zb);
        const ta = 72 - 130 * pj(za), tb = 72 - 130 * pj(zb), ba = 72 - 14 * pj(za), bb = 72 - 14 * pj(zb);
        p.poly([[xa, ta], [xb, tb], [xb, bb], [xa, ba]], mix(PAL.fog, PAL.frost, 0.2), { shade: 0 });
        p.poly([[xa, ta], [xb, tb], [xb, tb + (bb - tb) * 0.35], [xa, ta + (ba - ta) * 0.35]], mix(PAL.fog, PAL.bone, 0.45));
        p.line((xa + xb) / 2, (ta + tb) / 2, (xa + xb) / 2, (ba + bb) / 2, wallD, 1);
        p.line(xa, (ta + ba) / 2, xb, (tb + bb) / 2, wallD, 1);
        shaft(S, (xa + xb) / 2, (ba + bb) / 2, (xa + xb) / 2 + 64 * pj(za) * 2.2, 140 * (1 - pj(za) * 0.2), 10 * pj(za) * 2, 38 * pj(za) * 2, PAL.bone, 0.16);
      }
      // columns, banners and ribs (back to front)
      for (const z of [2.0, 1.3, 0.65, 0.12]) {
        const s = pj(z), xl = 128 - 128 * s, xr = 128 + 128 * s, yb = 72 + 72 * s, yt = 72 - 140 * s, w = Math.max(3, 17 * s);
        const col = mix(PAL.ash, PAL.dusk, 0.45 + z * 0.1);
        p.path([[xl, yt - 2], [128, yt - 36 * s - 12], [xr, yt - 2]], mix(PAL.ink, PAL.dusk, 0.3), Math.max(1, 3 * s));
        for (const [xc, dir] of [[xl, 1], [xr, -1]]) {
          p.rect(xc - w / 2, yt, w, yb - yt, col, { shade: 0.35 });
          p.rect(xc - w * 0.75, yb - 5 * s - 1, w * 1.5, 5 * s + 1, mix(col, PAL.void, 0.3));
          p.rect(xc - w * 0.7, yt, w * 1.4, 4 * s + 1, mix(col, PAL.gold, 0.18));
          // tattered banner
          const bx = xc + dir * w * 0.9, bw = Math.max(3, 9 * s), bh = 62 * s, by0 = yt + 10 * s;
          p.poly([[bx - bw / 2, by0], [bx + bw / 2, by0], [bx + bw / 2, by0 + bh], [bx + bw / 4, by0 + bh - 6 * s], [bx, by0 + bh + 1], [bx - bw / 4, by0 + bh - 5 * s], [bx - bw / 2, by0 + bh - 2 * s]], mix(PAL.wine, PAL.void, 0.2 + z * 0.1), { shade: 0.3 });
          p.rect(bx - bw / 2, by0, bw, Math.max(1, 3 * s), PAL.gold);
          p.rect(bx - Math.max(1, bw * 0.15), by0 + 8 * s, Math.max(1, bw * 0.3), Math.max(2, 10 * s), mix(PAL.gold, PAL.wine, 0.4));
        }
      }
      // the dais and the throne
      p.rect(100, 90, 52, 3, mix(PAL.dusk, PAL.ash, 0.2)); p.rect(106, 87, 40, 3, mix(PAL.dusk, PAL.ash, 0.3)); p.rect(112, 84, 28, 3, mix(PAL.dusk, PAL.ash, 0.4));
      p.rect(118, 84, 16, 9, mix(PAL.wine, PAL.gore, 0.2));
      p.poly([[117, 84], [117, 52], [122, 40], [128, 33], [134, 40], [139, 52], [139, 84]], mix(PAL.ink, PAL.dusk, 0.25), { shade: 0.25 });
      p.line(117, 84, 117, 52, mix(PAL.gold, PAL.bark, 0.4)); p.line(139, 84, 139, 52, mix(PAL.gold, PAL.bark, 0.55));
      p.path([[117, 52], [122, 40], [128, 33], [134, 40], [139, 52]], mix(PAL.gold, PAL.bark, 0.35), 1);
      p.rect(115, 74, 5, 10, mix(PAL.ink, PAL.dusk, 0.3)); p.rect(136, 74, 5, 10, mix(PAL.ink, PAL.dusk, 0.3)); // arms
      p.rect(120, 76, 16, 8, mix(PAL.wine, PAL.void, 0.45));
      // the Crown, waiting on the seat
      S.glow(128, 74, 16, PAL.rose, 0.35, 10);
      p.rect(124, 73, 8, 2, PAL.iron); p.px(124, 71, PAL.steel); p.px(126, 70, PAL.steel); p.px(128, 70, PAL.steel); p.px(130, 70, PAL.steel); p.px(131, 71, PAL.steel); p.px(128, 74, PAL.wine);
      // atmosphere: a cold shaft from the broken roof onto the dais
      shaft(S, 128, 8, 128, 92, 8, 46, PAL.bone, 0.1);
      p.line(120, 40, 120, 52, mix(PAL.gold, PAL.bark, 0.2)); p.px(128, 33, PAL.candle);
      S.fog(96, 6, PAL.fog, 0.2, 91, 36, 90, 166);
      S.ash(110, 92, [PAL.fog, PAL.bone, PAL.stone], 0, 130);
      S.vignette(0.9);
    },
  },

  // ---------------------------------------------------------------- Title
  bg_title: {
    ...BG,
    draw(p) {
      const S = surf(p);
      S.sky(0, 144, [PAL.void, mix(PAL.ink, PAL.night, 0.5), mix(PAL.night, PAL.wine, 0.25), mix(PAL.ink, PAL.wine, 0.15)]);
      // the great window: cold pewter light
      opening(S, 128, 104, 34, 44, 52, grad(mix(PAL.ash, PAL.fog, 0.2), mix(PAL.fog, PAL.bone, 0.55)));
      S.glow(128, 56, 60, PAL.bone, 0.2, 70);
      for (const x of [112, 128, 144]) p.rect(x - 0.5, 6, 1, 98, PAL.ink);
      for (const y of [30, 52, 76]) p.rect(94, y, 68, 1, PAL.ink);
      p.ring(128, 22, 9, PAL.ink, 1); p.ring(128, 22, 4, PAL.ink, 1);
      for (const x of [94, 162]) p.rect(x - 1, 60, 2, 44, PAL.void);
      // god-rays through falling ash
      shaft(S, 116, 40, 60, 140, 14, 46, PAL.bone, 0.12);
      shaft(S, 128, 40, 128, 140, 16, 60, PAL.bone, 0.14);
      shaft(S, 140, 40, 196, 140, 14, 46, PAL.bone, 0.12);
      // back columns, hazy
      for (const x of [58, 198]) { p.rect(x - 7, 14, 14, 100, mix(PAL.night, PAL.dusk, 0.4), { shade: 0.3 }); p.rect(x - 9, 14, 18, 5, mix(PAL.dusk, PAL.ash, 0.2)); p.rect(x - 9, 108, 18, 6, mix(PAL.dusk, PAL.ash, 0.2)); }
      S.fog(100, 9, PAL.fog, 0.28, 95, 30);
      // floor: dark polished stone with the window's reflection
      S.sky(112, 144, [mix(PAL.ink, PAL.dusk, 0.3), PAL.void]);
      shaft(S, 128, 112, 128, 144, 22, 50, PAL.bone, 0.14);
      for (let i = 0; i < 7; i++) p.line(128 + (i - 3) * 6, 112, 128 + (i - 3) * 44, 144, mix(PAL.void, PAL.dusk, 0.35), 1);
      for (const y of [118, 126, 136]) p.rect(0, y, 256, 1, mix(PAL.void, PAL.dusk, 0.3));
      // the throne, backlit
      const T = mix(PAL.ink, PAL.void, 0.3), rimc = mix(PAL.ash, PAL.fog, 0.4);
      p.rect(72, 124, 112, 6, mix(PAL.night, PAL.dusk, 0.4)); p.rect(88, 118, 80, 6, mix(PAL.night, PAL.dusk, 0.5)); p.rect(102, 112, 52, 6, mix(PAL.night, PAL.dusk, 0.6));
      p.poly([[108, 112], [108, 60], [114, 46], [122, 34], [128, 22], [134, 34], [142, 46], [148, 60], [148, 112]], T);
      p.path([[108, 112], [108, 60], [114, 46], [122, 34], [128, 22], [134, 34], [142, 46], [148, 60], [148, 112]], rimc, 1);
      p.tri(104, 62, 110, 62, 107, 48, T); p.tri(146, 62, 152, 62, 149, 48, T);
      p.rect(104, 98, 8, 14, T); p.rect(144, 98, 8, 14, T); p.rect(106, 96, 44, 4, T); // arms + seat
      p.line(104, 98, 111, 98, rimc); p.line(145, 98, 152, 98, rimc);
      p.rect(113, 100, 30, 12, mix(PAL.wine, PAL.void, 0.5));
      p.line(128, 30, 128, 90, mix(PAL.ink, PAL.dusk, 0.35)); // seam in the backrest
      // the Hollow Crown, floating above the empty seat
      S.glow(128, 88, 30, PAL.wine, 0.5, 20); S.glow(128, 88, 14, PAL.rose, 0.35, 9);
      p.poly([[116, 90], [140, 90], [140, 94], [134, 96], [128, 97], [122, 96], [116, 94]], PAL.iron, { shade: 0.4 });
      for (const [x, t, w] of [[117, 80, 3], [123, 77, 3], [128, 72, 3], [133, 77, 3], [139, 80, 3]]) p.tri(x - w, 91, x + w, 91, x, t, PAL.iron, { shade: 0.3 });
      p.line(116, 91, 140, 91, PAL.steel); p.px(128, 72, PAL.fog); p.px(123, 77, PAL.stone); p.px(133, 77, PAL.stone);
      p.ellipse(128, 93, 2, 1.6, PAL.void); p.glow(128, 93, PAL.rose, 3);
      p.px(119, 93, PAL.ember).px(137, 94, PAL.ember);
      // ash, heavy and slow
      S.ash(380, 96, [PAL.fog, PAL.stone, PAL.bone], 0, 144);
      S.ash(90, 97, [PAL.bone, PAL.frost], 0, 112, 86, 172);
      S.vignette(1.1);
    },
  },
});

// ------------------------------------------------------------------ scenes (96x64)
const SC = { w: 96, h: 64, outline: false, rim: false };
const moonAt = (S, p, x, y, r, col = mix(PAL.fog, PAL.bone, 0.45), halo = PAL.bone) => { S.glow(x, y, r * 4, halo, 0.28); p.circle(x, y, r, col); };
const inkC = (a = 0.4) => mix(PAL.ink, PAL.dusk, a);
const spook = '#a9c6c2aa', spookD = '#7fd1c488';

defineSprites({
  // A signpost at a fork in the fens, crows watching.
  scene_road: {
    ...SC,
    draw(p) {
      const S = surf(p);
      S.sky(0, 38, [mix(PAL.night, PAL.ash, 0.3), mix(PAL.ash, PAL.stone, 0.3), mix(PAL.stone, PAL.fog, 0.45), mix(PAL.fog, PAL.bone, 0.2)]);
      S.glow(18, 36, 24, PAL.bone, 0.35, 12);
      S.fillBelow((x) => 35 - fbm(x / 20, 3) * 5, mix(PAL.ash, PAL.stone, 0.25), 44);
      S.fog(37, 4, PAL.fog, 0.5, 2, 14);
      S.sky(38, 64, [mix(PAL.dusk, PAL.moss, 0.3), mix(PAL.night, PAL.moss, 0.2)]);
      S.texture(0, 40, 96, 64, mix(PAL.dusk, PAL.ash, 0.2), 0.4, 3, 5);
      const road = mix(PAL.ash, PAL.bone, 0.22), roadF = mix(road, PAL.stone, 0.3);
      p.poly([[44, 49], [53, 49], [28, 38], [16, 38]], roadF);
      p.poly([[45, 49], [54, 49], [86, 38], [74, 38]], roadF);
      p.poly([[30, 64], [67, 64], [54, 48], [43, 48]], road);
      p.line(41, 64, 46, 50, dk(road, 0.3)); p.line(56, 64, 51, 50, dk(road, 0.3));
      reeds(p, 0, 26, 52, mix(PAL.night, PAL.moss, 0.3), 3, 5); reeds(p, 70, 96, 50, mix(PAL.night, PAL.moss, 0.3), 4, 5);
      const dark = mix(PAL.night, PAL.ash, 0.2);
      deadTree(p, 11, 62, 36, dark, 4, 0.1);
      const wood = mix(PAL.bark, PAL.ash, 0.25), woodD = mix(PAL.ink, PAL.bark, 0.4);
      p.rect(47, 22, 3, 31, wood, { shade: 0.3 });
      p.poly([[50, 24], [66, 24], [70, 26.5], [66, 29], [50, 29]], wood, { shade: 0.3 });
      p.poly([[47, 31], [33, 31], [29, 33.5], [33, 36], [47, 36]], wood, { shade: 0.3 });
      p.poly([[50, 39], [62, 41], [61, 44], [50, 42]], woodD, { shade: 0.2 });
      for (const [x, y, l] of [[53, 26, 8], [36, 33, 7]]) p.line(x, y, x + l, y, woodD);
      p.rect(46, 18, 5, 4, PAL.bone, { shade: 0.3 }); p.px(47, 19, PAL.void); p.px(49, 19, PAL.void); p.px(48, 21, PAL.void);
      p.ellipse(64, 22, 2.6, 1.8, PAL.void); p.tri(66, 21, 69, 22, 66, 23, PAL.void); p.px(65, 21, PAL.ember);
      crow(p, 22, 14, dark); crow(p, 28, 18, dark); crow(p, 78, 12, dark);
      S.fog(52, 4, PAL.fog, 0.28, 6, 16);
      S.ash(40, 7, [PAL.fog, PAL.bone], 0, 64);
      S.vignette(0.8);
    },
  },

  // The gibbet on its hill, the hanged man turning in the wind.
  scene_gibbet: {
    ...SC,
    draw(p) {
      const S = surf(p);
      S.sky(0, 46, [mix(PAL.night, PAL.ash, 0.25), mix(PAL.dusk, PAL.ash, 0.4), mix(PAL.ash, PAL.stone, 0.3), mix(PAL.stone, PAL.fog, 0.35)]);
      moonAt(S, p, 68, 20, 8);
      S.fog(26, 4, PAL.dusk, 0.3, 3, 14);
      S.fillBelow((x) => 38 - fbm(x / 18, 11) * 8, mix(PAL.ash, PAL.stone, 0.15), 50);
      S.fog(40, 4, PAL.fog, 0.4, 4, 14);
      const hill = mix(PAL.night, PAL.moss, 0.25), blk = mix(PAL.void, PAL.night, 0.4);
      S.fillBelow((x) => 46 - Math.max(0, 15 - Math.abs(x - 42) * 0.4) + fbm(x / 8, 5) * 2, hill, 64);
      S.texture(0, 40, 96, 64, mix(hill, PAL.ash, 0.2), 0.4, 3, 6);
      // gibbet
      p.rect(36, 6, 3, 28, blk); p.rect(36, 6, 24, 3, blk); p.line(38, 17, 46, 9, blk, 2); p.rect(34, 33, 7, 2, blk);
      p.line(56, 9, 56, 17, mix(PAL.bark, PAL.fog, 0.3));
      const body = mix(PAL.ink, PAL.dusk, 0.35);
      p.circle(56.5, 19.5, 2.4, body); p.px(57, 19, PAL.stone);
      p.poly([[52.5, 22], [60.5, 22], [61, 34], [59, 37], [57, 35], [55, 38], [53, 35], [52, 33]], body, { shade: 0.2 });
      p.line(52, 23, 51, 31, body, 2); p.line(61, 23, 62, 30, body, 1);
      p.line(54, 36, 54, 42, body, 1); p.line(58, 36, 59, 42, body, 1);
      p.circle(52, 8, 1.2, PAL.void); p.ellipse(46, 6, 2.2, 1.5, PAL.void); p.ellipse(41, 5, 2.2, 1.5, PAL.void);
      crow(p, 18, 24, blk); crow(p, 24, 28, blk); crow(p, 80, 34, blk);
      for (const [x, y] of [[20, 56], [70, 58], [30, 60]]) { p.rect(x, y, 3, 2, PAL.bone); p.px(x, y, PAL.fog); }
      p.line(60, 52, 66, 56, PAL.bone); p.line(64, 52, 63, 57, PAL.fog);
      reeds(p, 0, 96, 62, mix(PAL.night, PAL.moss, 0.35), 5, 4);
      S.fog(58, 5, PAL.fog, 0.25, 7, 16);
      S.ash(26, 8, [PAL.fog, PAL.bone], 0, 64);
      S.vignette(0.9);
    },
  },

  // A plague village in fog: a marked door, a cart of the dead.
  scene_village: {
    ...SC,
    draw(p) {
      const S = surf(p);
      S.sky(0, 40, [mix(PAL.night, PAL.ash, 0.3), mix(PAL.ash, PAL.stone, 0.3), mix(PAL.stone, PAL.fog, 0.4)]);
      S.glow(70, 34, 22, PAL.bone, 0.25, 10);
      const far = mix(PAL.ash, PAL.stone, 0.3), mid = mix(PAL.dusk, PAL.ash, 0.4), near = mix(PAL.night, PAL.bark, 0.45), roof = mix(PAL.ink, PAL.bark, 0.3);
      for (const [x, w, h] of [[4, 9, 7], [20, 10, 8], [52, 9, 8], [76, 11, 7]]) house(p, x, 38, w, h, far, mix(far, PAL.night, 0.3), { rh: 6 });
      S.fog(38, 4, PAL.fog, 0.55, 2, 14);
      S.sky(38, 64, [mix(PAL.dusk, PAL.bark, 0.3), mix(PAL.night, PAL.bark, 0.3)]);
      house(p, 10, 48, 16, 11, mid, mix(mid, PAL.night, 0.5), { rh: 8, chimney: true });
      house(p, 62, 49, 18, 12, mid, mix(mid, PAL.night, 0.5), { rh: 9, lit: [[3, 4]], litCol: mix(PAL.flame, PAL.ember, 0.4) });
      plume(S, 26, 38, 22, 10, mix(PAL.ash, PAL.dusk, 0.3), 0.5, 3);
      S.fog(50, 4, PAL.fog, 0.4, 4, 14);
      // the foreground house, its door marked
      house(p, 32, 58, 26, 20, near, roof, { rh: 12, chimney: true, shade: 0.2 });
      p.rect(42, 49, 7, 9, PAL.void); p.rect(42, 49, 7, 1, dk(near, 0.6));
      p.line(43, 51, 47, 56, PAL.blood, 1); p.line(47, 51, 43, 56, PAL.blood, 1); p.px(45, 50, PAL.blood);
      p.rect(35, 45, 4, 4, mix(PAL.void, PAL.bark, 0.3)); p.rect(53, 45, 3, 4, mix(PAL.flame, PAL.ember, 0.45)); S.glow(54.5, 47, 8, PAL.flame, 0.3);
      // plague cart, heaped with shrouds
      const bk = mix(PAL.bark, PAL.void, 0.25);
      p.poly([[2, 50], [27, 50], [25, 57], [4, 57]], bk, { shade: 0.2 });
      p.ellipse(10, 49, 6, 3, mix(PAL.bone, PAL.ash, 0.4), { shade: 0.3 }); p.ellipse(20, 48, 5, 3.4, mix(PAL.fog, PAL.ash, 0.4), { shade: 0.3 });
      p.line(7, 47, 12, 49, dk(PAL.bone, 0.4)); p.line(28, 46, 33, 44, bk, 1); p.line(26, 51, 33, 49, bk, 1);
      p.ring(9, 59, 4.5, PAL.iron, 1); p.ring(21, 59, 4.5, PAL.iron, 1); p.line(9, 55, 9, 63, PAL.iron); p.line(5, 59, 13, 59, PAL.iron); p.line(21, 55, 21, 63, PAL.iron); p.line(17, 59, 25, 59, PAL.iron);
      p.rect(64, 58, 20, 1, dk(near, 0.3)); crow(p, 72, 38, PAL.void);
      S.texture(0, 58, 96, 64, mix(PAL.bark, PAL.ash, 0.3), 0.4, 3, 8);
      S.fog(58, 5, PAL.fog, 0.3, 5, 16);
      S.ash(30, 9, [PAL.fog, PAL.bone], 0, 64);
      S.vignette(0.85);
    },
  },

  // A small chapel on a hill, one warm doorway.
  scene_chapel: {
    ...SC,
    draw(p) {
      const S = surf(p);
      S.sky(0, 58, [mix(PAL.night, PAL.bruise, 0.4), mix(PAL.dusk, PAL.ash, 0.4), mix(PAL.ash, PAL.stone, 0.4), mix(PAL.stone, PAL.fog, 0.35)]);
      moonAt(S, p, 78, 16, 5, mix(PAL.fog, PAL.bone, 0.3));
      S.fog(30, 5, PAL.bruise, 0.3, 11, 14);
      const hill = mix(PAL.night, PAL.moss, 0.2), wall = mix(PAL.night, PAL.dusk, 0.4), roof = mix(PAL.void, PAL.night, 0.5);
      S.fillBelow((x) => 54 - Math.max(0, 12 - Math.abs(x - 40) * 0.25), hill, 64);
      S.snap();
      // nave + belltower
      p.rect(20, 32, 36, 20, wall, { shade: 0.25 });
      p.poly([[17, 33], [38, 18], [59, 33]], roof, { shade: 0.2 }); S.cut(44, 25, 5, 5);
      p.rect(54, 14, 13, 38, wall, { shade: 0.3 });
      p.poly([[52, 15], [60.5, 2], [69, 15]], roof, { shade: 0.2 });
      opening(S, 60.5, 28, 3.5, 4, 3, () => PAL.void);
      p.circle(60.5, 24, 2, PAL.gold, { shade: 0.3 }); p.px(60, 27, PAL.candle); p.line(60.5, 20, 60.5, 22, PAL.iron);
      opening(S, 36, 52, 5, 7, 6, grad(mix(PAL.flame, PAL.ember, 0.5), PAL.candle));
      S.glow(36, 50, 22, PAL.candle, 0.4, 14);
      p.poly([[31, 52], [41, 52], [48, 64], [24, 64]], mix(PAL.flame, PAL.bark, 0.55));
      opening(S, 25, 44, 2, 4, 3, () => PAL.void); opening(S, 48, 42, 2, 4, 3, () => mix(PAL.spirit, PAL.deep, 0.5));
      p.line(20, 32, 20, 52, dk(wall, 0.4)); p.line(55, 34, 55, 52, mix(wall, PAL.fog, 0.28)); p.line(66, 15, 66, 52, mix(wall, PAL.fog, 0.3)); p.line(17, 33, 38, 19, mix(roof, PAL.fog, 0.25));
      // graves and a dead tree
      const dark = mix(PAL.night, PAL.ash, 0.25);
      for (const [x, y, t] of [[6, 58, 0], [14, 60, 1], [74, 58, 1], [84, 61, 0], [88, 56, 1]]) t ? headstone(p, x, y, 4, 8, dark) : graveCross(p, x, y, 8, dark);
      deadTree(p, 90, 62, 30, dark, 2, -0.12);
      S.texture(0, 52, 96, 64, mix(hill, PAL.ash, 0.2), 0.35, 3, 9);
      S.fog(58, 5, PAL.bruise, 0.3, 12, 16);
      S.ash(22, 13, [PAL.fog, PAL.bone], 0, 64);
      S.vignette(0.85);
    },
  },

  // A camp fire in the dark, the only warm thing for miles.
  scene_camp: {
    ...SC,
    draw(p) {
      const S = surf(p);
      S.sky(0, 64, [PAL.void, mix(PAL.ink, PAL.deep, 0.5), mix(PAL.night, PAL.moss, 0.2)]);
      S.ash(26, 21, [PAL.frost, PAL.bone], 0, 26);
      for (let x = -2; x < 100; x += 5 + ((x * 3) % 3)) pine(p, x, 47 + hash2(x, 1, 9) * 4, 22 + hash2(x, 2, 9) * 16, 7, mix(PAL.void, PAL.moss, 0.2));
      S.sky(46, 64, [mix(PAL.ink, PAL.moss, 0.22), PAL.void]);
      S.glow(56, 52, 38, PAL.ember, 0.4, 26);
      const tent = mix(PAL.leather, PAL.ink, 0.45);
      p.poly([[4, 58], [19, 33], [36, 58]], tent, { shade: 0.2 });
      p.poly([[19, 33], [36, 58], [23, 58]], mix(tent, PAL.flame, 0.25));
      p.poly([[19, 38], [26, 58], [14, 58]], PAL.void);
      p.line(19, 33, 19, 30, PAL.wood, 1);
      // fire ring, logs, flames
      for (const [x, y] of [[46, 58], [50, 60], [57, 61], [64, 60], [68, 58]]) p.ellipse(x, y, 2.5, 1.6, mix(PAL.ash, PAL.stone, 0.3), { shade: 0.3 });
      p.line(48, 59, 62, 55, PAL.bark, 2); p.line(49, 55, 65, 59, mix(PAL.bark, PAL.wood, 0.3), 2);
      p.poly([[50, 56], [52, 48], [55, 42], [57, 36], [59, 43], [62, 49], [64, 56]], PAL.ember);
      p.poly([[52, 56], [54, 49], [57, 42], [60, 49], [62, 56]], PAL.flame);
      p.poly([[54, 56], [56, 50], [57, 46], [59, 51], [60, 56]], PAL.candle);
      p.glow(57, 52, PAL.flame, 6);
      for (const [x, y] of [[53, 34], [60, 31], [56, 27], [63, 36], [51, 40]]) p.px(x, y, hash2(x, y, 3) < 0.5 ? PAL.flame : PAL.candle);
      // log seat, kettle on a tripod, bedroll
      p.rect(70, 57, 14, 4, mix(PAL.bark, PAL.flame, 0.2), { shade: 0.3 }); p.rect(70, 57, 2, 4, PAL.wood);
      p.line(44, 50, 49, 57, PAL.iron, 1); p.line(54, 50, 51, 57, PAL.iron, 1); p.line(49, 50, 49, 56, PAL.iron, 1);
      p.rect(47, 51, 5, 4, mix(PAL.iron, PAL.ember, 0.2), { shade: 0.3 }); p.line(46, 51, 53, 51, PAL.steel);
      p.ellipse(32, 62, 7, 2, mix(PAL.wine, PAL.night, 0.45), { shade: 0.25 });
      S.fog(60, 4, PAL.deep, 0.25, 22, 16);
      S.vignette(1.0);
    },
  },

  // A ruined gatehouse; a ghostly sentry still keeps watch.
  scene_ruins: {
    ...SC,
    draw(p) {
      const S = surf(p);
      S.sky(0, 56, [mix(PAL.night, PAL.ash, 0.2), mix(PAL.dusk, PAL.ash, 0.4), mix(PAL.ash, PAL.stone, 0.35)]);
      moonAt(S, p, 74, 15, 6, mix(PAL.fog, PAL.bone, 0.3));
      S.fog(34, 5, PAL.fog, 0.25, 31, 14);
      const st = mix(PAL.night, PAL.dusk, 0.4), stD = mix(PAL.ink, PAL.night, 0.5);
      S.fillBelow((x) => 50 - fbm(x / 20, 12) * 4, mix(PAL.night, PAL.moss, 0.25), 64);
      S.snap();
      // twin towers, the left one broken
      p.rect(14, 20, 20, 34, st, { shade: 0.3 });
      p.poly([[14, 20], [17, 15], [20, 19], [24, 13], [27, 18], [31, 16], [34, 20]], st, { shade: 0.3 });
      p.rect(62, 12, 20, 42, st, { shade: 0.3 });
      p.rect(60, 10, 24, 4, mix(st, PAL.ash, 0.2)); for (const x of [60, 66, 72, 78]) p.rect(x, 7, 4, 4, st);
      p.rect(32, 28, 32, 26, st, { shade: 0.2 });
      S.cut(36, 28, 5, 2); S.cut(50, 28, 4, 3); S.cut(14, 32, 3, 5);
      p.line(33, 20, 33, 54, mix(st, PAL.fog, 0.3)); p.line(81, 12, 81, 54, mix(st, PAL.fog, 0.3)); p.line(14, 20, 14, 54, dk(st, 0.4));
      opening(S, 48, 54, 11, 18, 9, () => PAL.void);
      p.rect(37, 28, 22, 3, stD);
      // portcullis, half-raised
      for (let x = 38; x < 59; x += 3) p.line(x, 28, x, 38, PAL.iron, 1);
      for (const y of [30, 34, 38]) p.line(38, y, 58, y, PAL.iron, 1);
      for (const x of [38, 41, 44, 47, 50, 53, 56]) p.tri(x - 1, 38, x + 1, 38, x, 41, PAL.iron);
      // the sentry
      S.glow(48, 46, 14, PAL.spirit, 0.28, 16);
      p.ellipse(48, 48, 3.5, 7, spook); p.circle(48, 39, 2.6, spook); p.rect(45, 37, 7, 2, '#c7ddd8bb');
      p.line(54, 35, 54, 54, '#a9c6c299', 1); p.tri(53, 35, 55, 35, 54, 31, '#c7ddd8cc');
      p.px(47, 40, PAL.spirit); p.px(49, 40, PAL.spirit);
      // windows, ivy, rubble
      opening(S, 24, 40, 2, 4, 3, () => PAL.void); opening(S, 72, 36, 2, 5, 3, () => PAL.void);
      p.path([[62, 12], [62, 24], [64, 36]], PAL.moss, 1); p.path([[34, 24], [34, 38]], PAL.moss, 1); p.px(63, 26, PAL.rot).px(35, 30, PAL.rot);
      for (const [x, y, w] of [[4, 56, 8], [20, 58, 7], [70, 57, 9], [84, 59, 8], [34, 60, 6]]) { p.ellipse(x, y, w / 2, 2, st, { shade: 0.3 }); p.px(x - 1, y - 2, PAL.fog); }
      S.texture(0, 54, 96, 64, mix(PAL.moss, PAL.ash, 0.2), 0.4, 3, 12);
      S.fog(57, 5, PAL.fog, 0.35, 32, 16);
      S.ash(14, 14, [PAL.fog], 0, 64);
      S.vignette(0.85);
    },
  },

  // The Weeping Wood: fae lights, a ring of mushrooms, something with antlers watching.
  scene_forest: {
    ...SC,
    draw(p) {
      const S = surf(p);
      S.sky(0, 64, [PAL.void, mix(PAL.deep, PAL.ink, 0.5), mix(PAL.water, PAL.moss, 0.25)]);
      S.glow(48, 26, 34, PAL.ghost, 0.18, 30);
      const far = mix(PAL.deep, PAL.moss, 0.3), mid = mix(PAL.ink, PAL.moss, 0.2), nearC = mix(PAL.void, PAL.deep, 0.4);
      for (let x = 2; x < 96; x += 6) { p.rect(x, 4, 2, 50, far); }
      S.fog(30, 10, PAL.ghost, 0.2, 41, 14);
      S.glow(49, 22, 18, PAL.ghost, 0.5, 16);
      // the antlered one, glimpsed between trunks
      const el = mix(PAL.void, PAL.night, 0.3);
      p.poly([[44, 54], [44, 36], [47, 31], [51, 31], [54, 36], [54, 54]], el); p.ellipse(49, 28, 3, 3.6, el);
      p.path([[46, 26], [43, 19], [40, 15], [37, 14]], el, 2); p.path([[43, 19], [42, 13], [43, 10]], el, 1); p.path([[41, 16], [38, 17]], el, 1);
      p.path([[52, 26], [55, 19], [58, 15], [61, 14]], el, 2); p.path([[55, 19], [56, 13], [55, 10]], el, 1); p.path([[57, 16], [60, 17]], el, 1);
      p.px(48, 28, PAL.venom).px(50, 28, PAL.venom); p.glow(48, 28, PAL.venom, 1); p.glow(50, 28, PAL.venom, 1);
      S.fog(44, 6, PAL.ghost, 0.28, 42, 14);
      for (const [x, w] of [[16, 6], [78, 7]]) { p.rect(x, 0, w, 62, mid, { shade: 0.2 }); }
      weepTree(p, 10, 64, 56, nearC, 3, 0.9); weepTree(p, 88, 64, 52, nearC, 4, 0.9);
      p.rect(0, 0, 4, 64, nearC); p.rect(92, 0, 4, 64, nearC);
      S.sky(54, 64, [mix(PAL.ink, PAL.moss, 0.25), PAL.void]);
      // mushroom ring + fae lights
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2, x = 48 + Math.cos(a) * 19, y = 58 + Math.sin(a) * 3.5;
        p.rect(x - 0.5, y - 1, 1, 2, PAL.bone); p.ellipse(x, y - 2, 2, 1.2, i % 3 ? PAL.lilac : PAL.rose, { shade: 0.3 }); p.px(x, y - 2, PAL.bone);
        if (i % 2) S.glow(x, y - 2, 5, PAL.lilac, 0.25);
      }
      for (const [x, y, c] of [[30, 38, PAL.venom], [62, 34, PAL.lilac], [38, 24, PAL.spirit], [70, 48, PAL.venom], [26, 50, PAL.lilac], [56, 20, PAL.spirit]]) { S.glow(x, y, 6, c, 0.4); p.px(x, y, mix(c, PAL.bone, 0.6)); }
      S.ash(28, 15, [PAL.venom, PAL.spirit], 6, 56);
      S.vignette(1.0);
    },
  },

  // The drowned abbey in its mere, windows lit with cold spirit-light.
  scene_abbey: {
    ...SC,
    draw(p) {
      const S = surf(p);
      S.sky(0, 44, [PAL.void, mix(PAL.deep, PAL.ink, 0.4), mix(PAL.water, PAL.deep, 0.4), mix(PAL.water, PAL.ghost, 0.25)]);
      moonAt(S, p, 78, 12, 4, mix(PAL.ghost, PAL.frost, 0.3), PAL.ghost);
      S.fillBelow((x) => 36 - fbm(x / 12, 41) * 5, mix(PAL.water, PAL.deep, 0.45), 42);
      for (let x = 2; x < 96; x += 5) pine(p, x, 38, 7 + hash2(x, 1, 5) * 7, 3.5, mix(PAL.water, PAL.deep, 0.45));
      S.fog(36, 4, PAL.ghost, 0.3, 32, 14);
      S.snap();
      const ab = mix(PAL.ink, PAL.deep, 0.5), win = mix(PAL.spirit, PAL.deep, 0.25), yW = 42;
      p.rect(14, yW - 16, 40, 16, ab); p.poly([[12, yW - 16], [34, yW - 28], [56, yW - 16]], ab); S.cut(26, yW - 22, 6, 4);
      p.rect(56, yW - 34, 11, 34, ab); p.poly([[55, yW - 34], [58, yW - 40], [60, yW - 36], [63, yW - 43], [66, yW - 35], [68, yW - 34]], ab);
      p.rect(2, yW - 9, 12, 9, ab); p.poly([[1, yW - 9], [8, yW - 15], [15, yW - 9]], ab);
      for (const x of [18, 25, 32, 40, 47]) opening(S, x, yW - 3, 2, 5, 3, grad(PAL.deep, win));
      opening(S, 61.5, yW - 20, 2, 4, 3, grad(PAL.deep, win)); opening(S, 61.5, yW - 7, 1.5, 3, 2, grad(PAL.deep, win));
      S.glow(34, yW - 8, 22, PAL.spirit, 0.16);
      S.fog(yW - 2, 3, PAL.ghost, 0.5, 33, 14);
      S.reflect(yW + 2, 64, PAL.deep, 0.45, 5);
      for (let i = 0; i < 18; i++) { const y = 45 + hash2(i, 1, 3) * 18, x = hash2(i, 2, 3) * 90; for (let k = 0; k < 5; k++) S.blend(x + k, y, C(PAL.ghost), 0.2); }
      reeds(p, 0, 22, 64, mix(PAL.void, PAL.deep, 0.4), 6, 8); reeds(p, 76, 96, 64, mix(PAL.void, PAL.deep, 0.4), 7, 7);
      S.fog(48, 3, PAL.ghost, 0.3, 34, 16);
      S.vignette(0.9);
    },
  },

  // A black mere under the moon. Something pale floats in it, hair spread like weed.
  scene_water: {
    ...SC,
    draw(p) {
      const S = surf(p);
      S.sky(0, 30, [PAL.void, mix(PAL.deep, PAL.ink, 0.5), mix(PAL.water, PAL.deep, 0.5)]);
      S.glow(66, 12, 30, PAL.ghost, 0.2);
      S.fog(26, 4, PAL.ghost, 0.22, 51, 14);
      S.fillBelow((x) => 29 - fbm(x / 10, 52) * 4, mix(PAL.deep, PAL.ink, 0.5), 32);
      for (let x = 0; x < 96; x += 6) if (hash2(x, 3, 3) < 0.6) deadTree(p, x + 2, 30, 8 + hash2(x, 4, 3) * 8, mix(PAL.void, PAL.deep, 0.4), x, 0);
      S.fog(31, 3, PAL.ghost, 0.4, 53, 14);
      S.reflect(32, 64, PAL.deep, 0.55, 8);
      // moon above, its road broken across the water
      p.circle(66, 12, 6, mix(PAL.ghost, PAL.frost, 0.35)); p.px(64, 10, PAL.frost);
      for (let y = 33; y < 64; y++) { const w = 1 + (y - 33) * 0.1; for (let x = Math.floor(66 - w); x < 66 + w; x++) if (hash2(x, y, 5) < 0.42) S.blend(x, y, C(PAL.frost), 0.45); }
      // the lady in the mere: face, closed eyes, hair drifting like weed
      S.glow(30, 48, 18, PAL.spirit, 0.25, 12);
      const weed = mix(PAL.deep, PAL.moss, 0.45), weed2 = mix(PAL.moss, PAL.rot, 0.2), r = rng(61);
      for (let i = 0; i < 26; i++) { const side = i % 2 ? 1 : -1, l = 6 + r() * 20; p.path([[30 + side * 4, 46], [30 + side * (6 + l * 0.35), 50 + r() * 3], [30 + side * (5 + l), 53 + r() * 5]], i % 3 ? weed : weed2, 1); }
      p.ellipse(30, 48, 5, 6.2, mix(PAL.ghost, PAL.frost, 0.3), { shade: 0.3 });
      p.poly([[25, 44], [30, 40], [35, 44], [34, 42], [30, 41], [26, 42]], weed);
      p.line(27, 47, 29, 47, PAL.deep); p.line(31, 47, 33, 47, PAL.deep); p.line(29, 51, 31, 51, mix(PAL.rose, PAL.deep, 0.5)); p.px(30, 49, mix(PAL.ghost, PAL.deep, 0.3));
      p.rect(22, 53, 17, 12, mix(PAL.deep, PAL.ink, 0.35)); // the water closes over her shoulders
      S.reflect(53, 64, PAL.deep, 0.6, 9, 22, 39);
      for (const [rx, ry, a] of [[8, 1.6, 0.5], [13, 2.4, 0.4], [20, 3.4, 0.3]]) for (let t = 0; t < 60; t++) { const an = (t / 60) * Math.PI * 2; S.blend(Math.round(30 + Math.cos(an) * rx * 1.5), Math.round(54 + Math.sin(an) * ry), C(PAL.frost), a); }
      reeds(p, 0, 14, 64, mix(PAL.void, PAL.deep, 0.4), 9, 9); reeds(p, 78, 96, 64, mix(PAL.void, PAL.deep, 0.4), 10, 8);
      S.vignette(1.0);
    },
  },

  // A root-wrapped shrine to something old, ringed by candles.
  scene_shrine: {
    ...SC,
    draw(p) {
      const S = surf(p);
      S.sky(0, 64, [PAL.void, mix(PAL.ink, PAL.moss, 0.2), mix(PAL.night, PAL.moss, 0.3)]);
      for (let x = 0; x < 96; x += 9) p.rect(x, 0, 3, 50, mix(PAL.ink, PAL.moss, 0.25));
      S.fog(26, 10, PAL.moss, 0.25, 61, 14);
      const st = mix(PAL.ash, PAL.moss, 0.25);
      p.rect(24, 22, 48, 36, st, { shade: 0.3 }); p.poly([[20, 24], [48, 8], [76, 24]], st, { shade: 0.3 });
      opening(S, 48, 58, 14, 16, 12, grad(PAL.void, mix(PAL.moss, PAL.ink, 0.5)));
      // the carved face of the Lady, half-swallowed by roots
      p.ellipse(48, 40, 8, 10, mix(PAL.pale, PAL.sick, 0.25), { shade: 0.3 });
      p.rect(42, 37, 5, 1, PAL.moss); p.rect(50, 37, 5, 1, PAL.moss); p.line(46, 46, 51, 46, dk(PAL.pale, 0.4)); p.line(48, 38, 48, 43, dk(PAL.pale, 0.3));
      S.glow(48, 40, 18, PAL.bile, 0.18, 18);
      const r = rng(19);
      for (let i = 0; i < 12; i++) { const x0 = 22 + r() * 52; p.path([[x0, 8 + r() * 14], [x0 + (r() - 0.5) * 12, 30 + r() * 10], [x0 + (r() - 0.5) * 20, 50 + r() * 12]], mix(PAL.bark, PAL.void, 0.15 + r() * 0.3), 1 + ((r() * 2) | 0)); }
      S.ash(40, 62, [PAL.moss, PAL.rot], 20, 60);
      // altar slab, offerings, candles
      p.rect(22, 54, 52, 5, mix(PAL.ash, PAL.dusk, 0.3), { shade: 0.3 });
      for (const [x, y] of [[26, 52], [34, 53], [42, 52], [54, 52], [62, 53], [70, 52], [18, 60], [78, 60], [30, 61], [66, 61]]) {
        p.rect(x, y - 2, 2, 3, PAL.bone); p.px(x, y - 3, PAL.flame); p.px(x, y - 4, PAL.candle); S.glow(x, y - 3, 6, PAL.flame, 0.35);
      }
      for (const [x, y] of [[46, 52], [50, 52]]) { p.rect(x, y, 3, 2, PAL.bone); p.px(x, y, PAL.void); }
      p.px(40, 54, PAL.rose).px(41, 53, PAL.lilac).px(58, 54, PAL.rose);
      S.sky(60, 64, [mix(PAL.ink, PAL.moss, 0.3), PAL.void]);
      S.vignette(1.0);
    },
  },

  // Steps down into a crypt, torches guttering at the door.
  scene_crypt: {
    ...SC,
    draw(p) {
      const S = surf(p), d = p.d;
      const stone = C(mix(PAL.dusk, PAL.stone, 0.2)), void_ = C(PAL.void), glowc = C(mix(PAL.ghost, PAL.bone, 0.4)), c = [0, 0, 0];
      const vx = 48, vy = 34, L = Math.log(0.7);
      for (let y = 0; y < 64; y++) for (let x = 0; x < 96; x++) {
        const dx = x - vx, dy = y - vy, ax = Math.abs(dx) / 46, ay = dy < 0 ? -dy / 32 : dy / 30;
        const m = Math.cbrt(ax * ax * ax + ay * ay * ay), b = m >= 1 ? 0 : Math.log(Math.max(m, 0.01)) / L, fr = b - Math.floor(b);
        const lum = 0.14 + Math.min(1, b / 6) * 0.5;
        if (dy > 0) { const step = Math.floor(b * 1.2 + (fr > 0.5 ? 0.5 : 0)); mixTo(c, void_, stone, lum * (fr < 0.5 ? 1.1 : 0.6) * (step % 2 ? 1 : 0.9)); }
        else mixTo(c, void_, stone, lum * (fr < 0.3 ? 1.5 : 0.55));
        const g = 1 - m * 1.8; if (g > 0) mixTo(c, c, glowc, g * g * 0.8);
        const i = (y * 96 + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
      }
      // stair risers descending toward the light
      for (let k = 0; k < 9; k++) {
        const y = Math.round(vy + 2 + 28 * Math.pow(0.62, k)), w = Math.min(40, 6 + (y - vy) * 1.15);
        p.line(vx - w, y, vx + w, y, mix(PAL.stone, PAL.bone, 0.15)); p.line(vx - w, y + 1, vx + w, y + 1, mix(PAL.void, PAL.dusk, 0.3));
      }
      // heavy door-frame and sarcophagi
      const fr_ = mix(PAL.ash, PAL.dusk, 0.35);
      p.rect(0, 0, 8, 64, fr_, { shade: 0.3 }); p.rect(88, 0, 8, 64, fr_, { shade: 0.3 }); p.rect(0, 0, 96, 6, fr_, { shade: 0.3 });
      p.ellipse(10, 60, 14, 4, mix(PAL.ash, PAL.bruise, 0.2), { shade: 0.3 }); p.ellipse(86, 61, 14, 4, mix(PAL.ash, PAL.bruise, 0.2), { shade: 0.3 });
      p.rect(4, 56, 12, 2, mix(PAL.bone, PAL.ash, 0.3)); p.rect(80, 57, 12, 2, mix(PAL.bone, PAL.ash, 0.3));
      // torches
      for (const x of [12, 83]) { p.rect(x, 22, 2, 8, PAL.wood); p.poly([[x - 2, 22], [x + 4, 22], [x + 1, 12]], PAL.ember); p.poly([[x - 1, 22], [x + 3, 22], [x + 1, 15]], PAL.flame); p.px(x + 1, 19, PAL.candle); S.glow(x + 1, 20, 24, PAL.flame, 0.45, 22); }
      // cobwebs
      p.path([[8, 6], [16, 8], [22, 12]], PAL.fog, 1); p.path([[8, 6], [12, 12], [14, 20]], PAL.fog, 1); p.path([[88, 6], [80, 8], [74, 12]], PAL.fog, 1);
      shaft(S, vx, vy + 2, vx, 64, 6, 30, PAL.ghost, 0.15);
      S.ash(14, 17, [PAL.bone], 6, 60);
      S.vignette(0.9);
    },
  },

  // Ashgrave's gates under a smoke-red sky.
  scene_city: {
    ...SC,
    draw(p) {
      const S = surf(p);
      S.sky(0, 58, [mix(PAL.ink, PAL.wine, 0.35), mix(PAL.bruise, PAL.ember, 0.3), mix(PAL.ember, PAL.ash, 0.45), mix(PAL.flame, PAL.ash, 0.55)]);
      S.glow(48, 44, 34, PAL.flame, 0.3, 20);
      plume(S, 22, 44, 36, 14, mix(PAL.ink, PAL.ash, 0.4), 0.5, 5); plume(S, 74, 44, 32, 12, mix(PAL.ink, PAL.ash, 0.4), 0.5, 6);
      const far = mix(PAL.dusk, PAL.ember, 0.2), mid = mix(PAL.night, PAL.wine, 0.45), near = mix(PAL.ink, PAL.void, 0.4);
      let r = rng(31);
      for (let x = -2; x < 98;) { const w = 3 + ((r() * 4) | 0), h = 8 + r() * 14; spire(p, x, 46, w, h, far, { ph: 4 + r() * 10, roof: far }); x += w + 1; }
      S.fog(44, 3, PAL.flame, 0.25, 33, 14);
      r = rng(41);
      for (let x = -2; x < 98;) { const w = 4 + ((r() * 5) | 0), h = 10 + r() * 18; if (x > 30 && x < 66) { x = 66; continue; } spire(p, x, 52, w, h, mid, { ph: 5 + r() * 12, roof: mid, gild: r() < 0.4 ? PAL.gold : null }); x += w + 1; }
      // the great gate: twin towers, portcullis, gilded cornice
      p.rect(28, 20, 14, 38, mid, { shade: 0.2 }); p.rect(54, 20, 14, 38, mid, { shade: 0.2 }); p.rect(40, 30, 16, 28, mid, { shade: 0.2 });
      p.tri(27, 20, 43, 20, 35, 6, mid); p.tri(53, 20, 69, 20, 61, 6, mid);
      p.px(35, 6, PAL.candle); p.px(61, 6, PAL.candle); p.line(35, 6, 35, 9, PAL.gold); p.line(61, 6, 61, 9, PAL.gold);
      p.line(28, 30, 68, 30, mix(PAL.gold, PAL.wine, 0.4)); p.line(40, 31, 56, 31, mix(PAL.gold, PAL.wine, 0.6));
      opening(S, 48, 58, 8, 14, 8, () => mix(PAL.ember, PAL.wine, 0.3));
      for (let x = 41; x < 56; x += 3) p.line(x, 36, x, 46, mix(PAL.ink, PAL.wine, 0.3), 1);
      for (const y of [38, 42, 46]) p.line(40, y, 56, y, mix(PAL.ink, PAL.wine, 0.3), 1);
      for (const [x, y] of [[33, 28], [63, 28], [33, 38], [63, 38]]) p.rect(x, y, 2, 4, mix(PAL.flame, PAL.ember, 0.4));
      S.sky(54, 64, [mix(PAL.ink, PAL.wine, 0.25), PAL.void]);
      p.poly([[42, 58], [54, 58], [64, 64], [32, 64]], mix(PAL.dusk, PAL.wine, 0.45));
      S.ash(30, 18, [PAL.fog, PAL.ember], 0, 64);
      S.vignette(0.9);
    },
  },

  // The court of phantoms: a long table, a feast of ghosts.
  scene_court: {
    ...SC,
    draw(p) {
      const S = surf(p);
      S.sky(0, 64, [PAL.void, mix(PAL.ink, PAL.wine, 0.3), mix(PAL.night, PAL.wine, 0.35)]);
      // tall arched windows behind
      for (const x of [12, 34, 56, 78]) { opening(S, x + 3, 40, 5, 22, 9, grad(mix(PAL.deep, PAL.night, 0.4), mix(PAL.ghost, PAL.deep, 0.45))); p.rect(x + 2, 8, 1, 32, PAL.ink); }
      const wallC = mix(PAL.night, PAL.wine, 0.3);
      for (const x of [3, 25, 47, 69, 91]) p.rect(x, 0, 3, 42, wallC, { shade: 0.2 });
      // floor and the long table, in perspective
      S.sky(42, 64, [mix(PAL.ink, PAL.wine, 0.2), PAL.void]);
      const tbl = mix(PAL.bark, PAL.wine, 0.3);
      p.poly([[30, 44], [66, 44], [90, 60], [6, 60]], tbl, { shade: 0.25 });
      p.poly([[6, 60], [90, 60], [90, 63], [6, 63]], mix(tbl, PAL.void, 0.5));
      p.poly([[44, 44], [52, 44], [54, 60], [42, 60]], mix(PAL.wine, PAL.rose, 0.12));
      // candelabras
      for (const [x, y, h] of [[38, 47, 6], [58, 47, 6], [26, 53, 8], [70, 53, 8]]) { p.rect(x, y - h, 1, h, PAL.gold); for (const dx of [-2, 0, 2]) { p.px(x + dx, y - h - 1, PAL.candle); p.px(x + dx, y - h - 2, PAL.flame); } S.glow(x, y - h, 10, PAL.flame, 0.35, 8); }
      // phantoms seated both sides, one at the head
      for (const [x, y, s] of [[20, 52, 1.2], [76, 52, 1.2], [30, 47, 0.9], [66, 47, 0.9], [34, 44, 0.7], [62, 44, 0.7]]) {
        p.ellipse(x, y + 4 * s, 5 * s, 8 * s, spook); p.circle(x, y - 6 * s, 3 * s, '#c7ddd8bb');
        p.px(x - 1, y - 6 * s, PAL.deep); p.px(x + 1, y - 6 * s, PAL.deep); p.px(x, y - 4.5 * s, PAL.deep);
        if (s > 1) p.rect(x - 2, y - 10 * s + 1, 5, 2, '#d8cfb8bb');
        p.ellipse(x, y + 12 * s, 6 * s, 1.5, spookD);
      }
      p.poly([[44, 22], [52, 22], [53, 40], [43, 40]], mix(PAL.ink, PAL.gold, 0.2));
      p.ellipse(48, 30, 6, 8, '#a9c6c299'); p.circle(48, 21, 3.4, '#c7ddd8aa'); p.px(47, 21, PAL.deep).px(49, 21, PAL.deep);
      p.poly([[45, 17], [46, 14], [48, 16], [50, 14], [51, 17]], mix(PAL.gold, PAL.bark, 0.2));
      S.fog(58, 4, PAL.ghost, 0.2, 35, 16);
      S.ash(16, 19, [PAL.ghost], 0, 64);
      S.vignette(0.9);
    },
  },

  // The throne with the Crown waiting on it.
  scene_throne: {
    ...SC,
    draw(p) {
      const S = surf(p);
      S.sky(0, 64, [PAL.void, mix(PAL.ink, PAL.night, 0.5), mix(PAL.ink, PAL.wine, 0.2)]);
      opening(S, 48, 48, 22, 28, 22, grad(mix(PAL.ash, PAL.fog, 0.2), mix(PAL.fog, PAL.bone, 0.5)));
      for (const x of [37, 48, 59]) p.rect(x, 4, 1, 44, PAL.ink); for (const y of [16, 30]) p.rect(26, y, 44, 1, PAL.ink);
      shaft(S, 48, 24, 48, 64, 14, 44, PAL.bone, 0.14);
      for (const x of [8, 88]) { p.rect(x - 4, 0, 8, 54, mix(PAL.night, PAL.dusk, 0.3), { shade: 0.3 }); p.rect(x - 5, 52, 10, 4, mix(PAL.dusk, PAL.ash, 0.2)); }
      const T = mix(PAL.ink, PAL.void, 0.3), rim = mix(PAL.ash, PAL.fog, 0.4);
      p.poly([[34, 52], [34, 26], [38, 18], [44, 10], [48, 4], [52, 10], [58, 18], [62, 26], [62, 52]], T);
      p.path([[34, 52], [34, 26], [38, 18], [44, 10], [48, 4], [52, 10], [58, 18], [62, 26], [62, 52]], rim, 1);
      p.rect(31, 42, 6, 12, T); p.rect(59, 42, 6, 12, T); p.rect(33, 40, 30, 3, T); p.rect(37, 44, 22, 10, mix(PAL.wine, PAL.void, 0.45));
      p.rect(24, 54, 48, 4, mix(PAL.night, PAL.dusk, 0.45)); p.rect(18, 58, 60, 6, mix(PAL.night, PAL.dusk, 0.35));
      S.glow(48, 36, 22, PAL.wine, 0.5, 14); S.glow(48, 36, 10, PAL.rose, 0.35, 7);
      p.poly([[40, 40], [56, 40], [55, 43], [48, 44], [41, 43]], PAL.iron, { shade: 0.4 });
      for (const [x, t] of [[41, 33], [45, 30], [48, 27], [51, 30], [55, 33]]) p.tri(x - 2, 40, x + 2, 40, x, t, PAL.iron, { shade: 0.3 });
      p.line(40, 40, 56, 40, PAL.steel); p.ellipse(48, 42, 1.6, 1.2, PAL.void); p.glow(48, 42, PAL.rose, 2);
      S.ash(70, 23, [PAL.fog, PAL.bone], 0, 64);
      S.vignette(1.0);
    },
  },

  // Beneath the throne: a vault of the Unspent.
  scene_undercroft: {
    ...SC,
    draw(p) {
      const S = surf(p);
      S.sky(0, 64, [PAL.void, mix(PAL.ink, PAL.bruise, 0.3), mix(PAL.night, PAL.bruise, 0.2)]);
      const st = mix(PAL.dusk, PAL.stone, 0.15);
      for (const x of [14, 34, 62, 82]) { p.rect(x - 3, 0, 6, 50, st, { shade: 0.3 }); }
      for (const [a, b] of [[14, 34], [62, 82]]) p.path([[a, 4], [(a + b) / 2, -6], [b, 4]], st, 3);
      p.path([[34, 4], [48, -8], [62, 4]], st, 3);
      // grate in the ceiling, pale light falling through
      p.rect(40, 0, 16, 5, PAL.void); for (let x = 41; x < 56; x += 3) p.line(x, 0, x, 5, PAL.iron, 1);
      shaft(S, 48, 5, 48, 52, 14, 46, PAL.bone, 0.3);
      S.glow(48, 52, 26, PAL.ghost, 0.3, 10);
      // heaps of bones and skulls
      const r = rng(77);
      p.ellipse(48, 58, 40, 9, mix(PAL.dusk, PAL.stone, 0.3));
      for (let i = 0; i < 90; i++) {
        const x = 12 + r() * 72, y = 50 + r() * 12, edge = Math.abs(x - 48) / 36;
        if (y < 56 - (1 - edge) * 8 + 6 && r() < 0.9) {
          const sk = r() < 0.4;
          if (sk) { p.circle(x, y, 1.8, PAL.bone); p.px(x - 1, y, PAL.void); p.px(x + 1, y, PAL.void); } else p.line(x, y, x + (r() - 0.5) * 6, y + (r() - 0.5) * 3, r() < 0.5 ? PAL.bone : PAL.fog, 1);
        }
      }
      // the Unspent, standing in the dark
      for (const [x, y, h] of [[8, 54, 24], [26, 52, 20], [72, 52, 22], [89, 56, 26]]) {
        p.ellipse(x, y - h * 0.3, 3, h * 0.35, '#7fd1c455'); p.circle(x, y - h * 0.75, 2.4, '#a9c6c277');
        p.px(x - 1, y - h * 0.75, PAL.spirit); p.px(x + 1, y - h * 0.75, PAL.spirit);
      }
      p.path([[0, 20], [8, 24], [10, 34]], PAL.bark, 1); p.path([[96, 14], [88, 22], [90, 32]], PAL.bark, 1); p.path([[22, 0], [26, 10], [24, 20]], PAL.bark, 1);
      S.fog(52, 5, PAL.ghost, 0.3, 36, 14);
      S.ash(26, 24, [PAL.bone], 4, 58, 34, 62);
      S.vignette(1.0);
    },
  },

  // A midnight market under lanterns; the peddler waits at his stall.
  scene_market: {
    ...SC,
    draw(p) {
      const S = surf(p);
      S.sky(0, 64, [PAL.void, mix(PAL.ink, PAL.bruise, 0.4), mix(PAL.night, PAL.bruise, 0.3)]);
      const hz = mix(PAL.dusk, PAL.bruise, 0.3);
      for (const [x, w, h] of [[2, 14, 28], [20, 10, 22], [70, 12, 26], [84, 12, 30]]) house(p, x, 46, w, h, hz, mix(hz, PAL.void, 0.4), { rh: 8 });
      S.fog(40, 6, PAL.bruise, 0.35, 71, 14);
      S.sky(46, 64, [mix(PAL.ink, PAL.bark, 0.3), PAL.void]);
      // stalls with sagging striped canopies
      const stall = (x, y, w, c1, c2) => {
        p.rect(x, y - 4, 2, 24, PAL.wood); p.rect(x + w - 2, y - 4, 2, 24, PAL.wood);
        for (let i = 0; i < w; i += 3) p.poly([[x + i, y - 4], [x + i + 3, y - 4], [x + i + 3, y + 3 + (i % 2)], [x + i, y + 3]], ((i / 3) | 0) % 2 ? c1 : c2, { shade: 0.2 });
        p.rect(x, y + 14, w, 3, PAL.bark);
      };
      stall(4, 30, 24, mix(PAL.wine, PAL.ash, 0.3), mix(PAL.bone, PAL.ash, 0.5));
      stall(68, 30, 24, mix(PAL.moss, PAL.ash, 0.2), mix(PAL.bone, PAL.ash, 0.5));
      stall(30, 28, 36, mix(PAL.wine, PAL.gore, 0.2), mix(PAL.gold, PAL.bark, 0.4));
      // wares
      for (const [x, y, c] of [[8, 45, PAL.bile], [12, 45, PAL.rose], [16, 45, PAL.venom], [72, 45, PAL.bone], [78, 45, PAL.gold], [84, 45, PAL.lilac]]) { p.rect(x, y, 2, 3, c); p.px(x, y, PAL.bone); }
      // the peddler: hood, a wide grin, a pack
      p.poly([[42, 56], [43, 38], [48, 33], [53, 38], [54, 56]], mix(PAL.bark, PAL.dusk, 0.5), { shade: 0.3 });
      p.ellipse(48, 38, 4, 4.5, PAL.void); p.rect(45, 41, 7, 1, PAL.bone); for (const x of [46, 48, 50]) p.px(x, 42, PAL.bone); p.px(46, 38, PAL.candle); p.px(50, 38, PAL.candle);
      p.ellipse(57, 46, 3, 5, mix(PAL.leather, PAL.bark, 0.4), { shade: 0.3 });
      // lantern strings
      for (const [xa, xb, y] of [[0, 48, 24], [48, 96, 24], [10, 60, 16]]) {
        for (let i = 0; i <= 8; i++) { const t = i / 8, x = xa + (xb - xa) * t, yy = y + Math.sin(t * Math.PI) * 5; p.px(x, yy - 1, PAL.iron); p.rect(x - 1, yy, 2, 3, i % 2 ? PAL.flame : PAL.candle); S.glow(x, yy + 1, 8, PAL.flame, 0.3, 7); }
      }
      S.glow(48, 50, 26, PAL.flame, 0.2, 14);
      S.texture(0, 56, 96, 64, mix(PAL.bark, PAL.ash, 0.3), 0.4, 3, 18);
      S.fog(60, 4, PAL.bruise, 0.3, 72, 16);
      S.ash(14, 25, [PAL.fog], 0, 64);
      S.vignette(0.95);
    },
  },

  // The field after the battle: spears planted, banners hanging, crows.
  scene_battlefield: {
    ...SC,
    draw(p) {
      const S = surf(p);
      S.sky(0, 46, [mix(PAL.night, PAL.ash, 0.25), mix(PAL.dusk, PAL.ash, 0.3), mix(PAL.ash, PAL.ember, 0.25), mix(PAL.ember, PAL.ash, 0.5)]);
      S.glow(70, 46, 34, PAL.flame, 0.25, 12);
      for (const [x, rise, dr] of [[14, 36, 10], [80, 34, -8]]) plume(S, x, 46, rise, dr, mix(PAL.ink, PAL.ash, 0.4), 0.5, x);
      S.fillBelow((x) => 46 - fbm(x / 20, 8) * 4, mix(PAL.night, PAL.ash, 0.3), 52);
      S.fog(46, 3, PAL.ember, 0.25, 9, 14);
      S.sky(48, 64, [mix(PAL.dusk, PAL.ash, 0.2), mix(PAL.night, PAL.ash, 0.15), PAL.void]);
      S.texture(0, 50, 96, 64, mix(PAL.ash, PAL.dusk, 0.3), 0.5, 3, 10);
      const dark = mix(PAL.void, PAL.night, 0.4), wood = mix(PAL.bark, PAL.void, 0.3);
      // planted spears and swords, banners
      for (const [x, y, h, lean] of [[10, 56, 30, 0.15], [24, 58, 26, -0.2], [38, 54, 22, 0.1], [62, 56, 28, -0.12], [78, 58, 32, 0.18], [88, 55, 24, -0.1]]) {
        p.line(x, y, x + lean * h, y - h, wood, 1);
        p.tri(x + lean * h - 1, y - h, x + lean * h + 1, y - h, x + lean * h, y - h - 4, PAL.steel);
      }
      p.poly([[24, 33], [34, 36], [32, 43], [26, 42], [24, 44]], mix(PAL.wine, PAL.void, 0.2), { shade: 0.3 }); p.px(28, 38, PAL.gold); p.px(29, 39, PAL.gold);
      p.poly([[78.5, 27], [88, 31], [86, 37], [81, 36], [79, 40]], mix(PAL.bruise, PAL.void, 0.3), { shade: 0.3 }); p.px(83, 32, PAL.gold);
      p.line(0, 52, 6, 55, dark); p.line(50, 54, 56, 52, dark);
      p.ellipse(46, 60, 4, 1.6, PAL.iron, { shade: 0.3 }); p.ring(15, 61, 3, PAL.iron, 1); p.px(15, 61, PAL.steel);
      for (const [x, y] of [[52, 58], [30, 61], [70, 61]]) { p.rect(x, y, 3, 2, PAL.bone); p.px(x, y, PAL.fog); }
      crow(p, 30, 14, dark); crow(p, 36, 18, dark); crow(p, 56, 10, dark); crow(p, 60, 15, dark); crow(p, 66, 12, dark);
      p.ellipse(52, 58, 2.5, 1.5, dark); p.tri(54, 57, 57, 58, 54, 59, dark);
      S.ash(46, 11, [PAL.fog, PAL.stone, PAL.ember], 0, 64);
      S.vignette(0.85);
    },
  },

  // An old well, breathing cold light.
  scene_well: {
    ...SC,
    draw(p) {
      const S = surf(p);
      S.sky(0, 44, [PAL.void, mix(PAL.ink, PAL.deep, 0.5), mix(PAL.water, PAL.deep, 0.4), mix(PAL.water, PAL.ghost, 0.2)]);
      moonAt(S, p, 18, 14, 4, mix(PAL.ghost, PAL.frost, 0.3), PAL.ghost);
      S.fog(34, 5, PAL.ghost, 0.25, 81, 14);
      S.fillBelow((x) => 40 - fbm(x / 14, 82) * 4, mix(PAL.deep, PAL.ink, 0.5), 46);
      S.sky(42, 64, [mix(PAL.ink, PAL.moss, 0.3), PAL.void]);
      S.texture(0, 44, 96, 64, mix(PAL.moss, PAL.ash, 0.3), 0.35, 3, 14);
      deadTree(p, 80, 56, 40, mix(PAL.void, PAL.deep, 0.4), 6, -0.12); deadTree(p, 10, 58, 26, mix(PAL.void, PAL.deep, 0.4), 8, 0.1);
      const st = mix(PAL.ash, PAL.dusk, 0.25);
      // glow rising from the shaft
      shaft(S, 48, 46, 48, 6, 18, 8, PAL.spirit, 0.2);
      S.glow(48, 44, 24, PAL.spirit, 0.4, 14);
      // little roof on posts, crank and rope
      p.rect(33, 18, 2, 28, PAL.wood); p.rect(61, 18, 2, 28, PAL.wood);
      p.poly([[29, 20], [48, 10], [67, 20]], mix(PAL.ink, PAL.bark, 0.35), { shade: 0.2 });
      p.rect(34, 24, 28, 2, PAL.wood); p.line(60, 24, 66, 24, PAL.iron, 1); p.circle(66, 24, 1.4, PAL.iron);
      p.line(48, 26, 48, 38, mix(PAL.bark, PAL.fog, 0.3)); p.rect(46, 38, 5, 4, PAL.wood);
      // stone ring of the well
      p.ellipse(48, 48, 18, 7, st, { shade: 0.3 }); p.rect(30, 48, 36, 9, st, { shade: 0.25 }); p.ellipse(48, 57, 18, 5, dk(st, 0.2));
      p.ellipse(48, 47, 14, 5, mix(PAL.spirit, PAL.deep, 0.55)); p.ellipse(48, 47, 9, 3, mix(PAL.spirit, PAL.ghost, 0.45)); p.ellipse(48, 46.5, 4, 1.5, mix(PAL.ghost, PAL.bone, 0.5));
      for (const [x, y] of [[34, 52], [42, 54], [52, 53], [60, 51], [38, 57], [56, 58]]) p.line(x, y, x + 4, y, dk(st, 0.4));
      for (const [x, y] of [[40, 38], [54, 30], [47, 22], [58, 40], [43, 16]]) { p.px(x, y, mix(PAL.spirit, PAL.bone, 0.5)); S.glow(x, y, 3, PAL.spirit, 0.3); }
      S.fog(58, 4, PAL.ghost, 0.28, 83, 16);
      S.vignette(1.0);
    },
  },
});
