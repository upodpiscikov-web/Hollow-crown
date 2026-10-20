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
          const n = vnoise(x / sc, y / (sc * 0.35), seed) * 0.7 + vnoise(x / (sc * 0.4), y / (sc * 0.2), seed + 5) * 0.3;
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

// ------------------------------------------------------------------ backgrounds (256x144)
const BG = { w: 256, h: 144, outline: false, rim: false };

defineSprites({
  bg_act1: {
    ...BG,
    draw(p) {
      const S = surf(p);
      // pewter sky
      S.sky(0, 92, [mix(PAL.night, PAL.ash, 0.25), mix(PAL.dusk, PAL.ash, 0.45), mix(PAL.ash, PAL.dusk, 0.25), PAL.ash, mix(PAL.ash, PAL.fog, 0.35)]);
      S.glow(186, 38, 34, PAL.fog, 0.35); // sun, a coin behind the haze
      p.circle(186, 38, 7, mix(PAL.fog, PAL.bone, 0.3));
      S.fog(26, 9, dk(PAL.ash, 0.2), 0.45, 11, 30); S.fog(46, 6, PAL.fog, 0.25, 12, 24); S.fog(60, 8, dk(PAL.ash, 0.1), 0.35, 13, 28);
      // far hills with gibbets on the horizon
      const far = mix(PAL.ash, PAL.stone, 0.25);
      S.fillBelow((x) => 74 - fbm(x / 40, 5) * 14, far, 100);
      for (const [x, h] of [[38, 15], [64, 11], [152, 14], [214, 17]]) gibbet(p, x, 74 - fbm(x / 40, 5) * 14 + 1, h, far === 0 ? 0 : mix(PAL.dusk, PAL.ash, 0.35), mix(PAL.dusk, PAL.ash, 0.35));
      S.fog(76, 7, PAL.fog, 0.4, 14, 22);
      const mid = mix(PAL.dusk, PAL.ash, 0.45);
      S.fillBelow((x) => 84 - fbm(x / 26 + 10, 6) * 9, mid, 100);
      for (const [x, h, s] of [[16, 24, 2], [104, 18, 3], [118, 12, 4], [236, 26, 5]]) deadTree(p, x, 84 - fbm(x / 26 + 10, 6) * 9 + 2, h, mid, s, (s % 2 ? 0.15 : -0.12));
      S.fog(88, 6, PAL.stone, 0.45, 15, 26);
      // the fen: dull ground, pools holding the sky
      const ground = mix(PAL.dusk, PAL.moss, 0.25), groundD = mix(PAL.night, PAL.moss, 0.2);
      S.sky(90, 144, [mix(ground, PAL.ash, 0.25), ground, mix(ground, groundD, 0.5), groundD]);
      const r = rng(77);
      for (let i = 0; i < 9; i++) {
        const py = 92 + r() * 14, pw = 14 + r() * 30, px0 = r() * 256;
        p.ellipse(px0, py, pw, 1.2 + r() * 1.5, mix(PAL.ash, PAL.fog, 0.15 + r() * 0.2));
        p.ellipse(px0 - 2, py + 0.6, pw * 0.7, 0.8, mix(PAL.ash, PAL.dusk, 0.3));
      }
      for (let i = 0; i < 14; i++) reeds(p, Math.floor(r() * 250), 0, 0, PAL.night, 0); // no-op guard
      for (const [x0, x1, y] of [[0, 30, 97], [70, 92, 95], [140, 170, 99], [200, 236, 96]]) reeds(p, x0, x1, y, mix(PAL.night, PAL.moss, 0.3), x0 + 3, 5);
      S.texture(0, 100, 256, 144, mix(ground, PAL.ash, 0.2), 0.4, 4, 21);
      S.texture(0, 104, 256, 144, groundD, 0.5, 6, 22);
      S.fog(100, 8, PAL.fog, 0.22, 16, 40);
      // falling ash (sparser over the calm lower third)
      S.ash(260, 101, [PAL.fog, PAL.stone, PAL.bone], 0, 96);
      S.ash(50, 102, [PAL.stone, PAL.ash], 96, 144);
      S.vignette(0.9);
    },
  },
});
