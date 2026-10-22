// Icons & card art — THE HOLLOW CROWN.
//
// Everything here is hand-placed pixel art (ASCII maps) or small primitive
// compositions. Conventions:
//   - Light comes from the TOP-LEFT everywhere. Right/bottom sides are darker.
//   - Small icons are transparent; the engine adds a 1px dark outline.
//   - Card art (`art_*`, 32×24) is full-bleed: a dark vignette ground tinted by
//     a "mood", a soft glow behind the subject, falling ash, then the subject
//     (outlined + rim-lit by this file's own layer pass) and a drop shadow.
//   - Relic icons take `opts.c` (tint) for their main material; potions take
//     `opts.c` as the liquid colour. Tint ramps use the symbols = - # + *.
//
// ASCII legend (see BASE below):
//   . transparent   0-9 grey ramp (0 void … 7 bone, 8 parchment, 9 near-white)
//   q r R s S  reds (deep→bright)      o O  ember / flame orange
//   y j Y c w  golds (dark→white-gold) m M G b v  greens (moss→venom)
//   i I e f F  steel (dark→frost)      t T h H  spirit teal (dark→pale)
//   u U l L    violets                 x X z Z k  browns (bark→tan)
//   p P        skin                    a A B  deep water blues
//   n N        wine / rose             = - # + *  TINT ramp (opts.c)

import { defineSprites, Painter, rgba, shadeColor } from '../sprite.js';

// ------------------------------------------------------------------ palette
const BASE = {
  0: '#0b0a0d', 1: '#16131a', 2: '#241f2b', 3: '#363040', 4: '#57535c', 5: '#79747a', 6: '#a19c9c', 7: '#cfc6b0', 8: '#e8dcc0', 9: '#fbf3df',
  q: '#3a0b10', r: '#5e1212', R: '#8a1c1c', s: '#b8302a', S: '#e0644c',
  o: '#c4501e', O: '#e8a33a',
  y: '#5e4612', j: '#8f6f1a', Y: '#c9a227', c: '#f0d27a', w: '#fff3c4',
  m: '#253318', M: '#3d5226', G: '#5c7a2a', b: '#8fae3a', v: '#c4dc68',
  i: '#33373e', I: '#545a63', e: '#8e98a3', f: '#bccfd9', F: '#eef6f6',
  t: '#24504c', T: '#3f8a80', h: '#7fd1c4', H: '#cff5ec',
  u: '#2b2135', U: '#4b3b5e', l: '#7b5aa6', L: '#b49ad6',
  x: '#2c1e16', X: '#4a3527', z: '#6e5039', Z: '#977049', k: '#c29a68',
  p: '#9a735c', P: '#c9a48a',
  a: '#16242e', A: '#2a4556', B: '#4c7890',
  n: '#5e1f3d', N: '#b5536b',
  C: '#7fb0c8', D: '#bfe0ec',
};
const hexOf = (c) => '#' + rgba(c).slice(0, 3).map((v) => (v | 0).toString(16).padStart(2, '0')).join('');
const sh = (c, f) => hexOf(shadeColor(c, f));
// Tint ramp for opts.c: = darkest, - dark, # base, + light, * highlight.
const rampCache = new Map();
function ramp(c) {
  let r = rampCache.get(c);
  if (!r) {
    r = { '=': sh(c, -0.62), '-': sh(c, -0.34), '#': hexOf(c), '+': sh(c, 0.32), '*': sh(c, 0.68) };
    rampCache.set(c, r);
  }
  return r;
}
// One-step-darker lookup, used to shade the mirrored (right) half of symmetric maps.
const DARKER = {
  9: '8', 8: '7', 7: '6', 6: '5', 5: '4', 4: '3', 3: '2', 2: '1', 1: '0',
  S: 's', s: 'R', R: 'r', r: 'q', O: 'o', w: 'c', c: 'Y', Y: 'j', j: 'y',
  v: 'b', b: 'G', G: 'M', M: 'm', F: 'f', f: 'e', e: 'I', I: 'i',
  H: 'h', h: 'T', T: 't', L: 'l', l: 'U', U: 'u', k: 'Z', Z: 'z', z: 'X', X: 'x',
  P: 'p', B: 'A', A: 'a', D: 'C', C: 'B', N: 'n', '*': '+', '+': '#', '#': '-', '-': '=',
};

// NOTE: the engine's sprite proxy does not pad `circle()` for the outline border
// (it pads ellipse/rect/px/... only), so circles are always drawn via ellipse().
const circ = (p, x, y, r, c, o) => p.ellipse(x, y, r, r, c, o);

// Draw an ASCII pixel map. `pal` maps chars → colours (merged over BASE).
function pix(p, rows, pal, ox = 0, oy = 0) {
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') continue;
      const col = (pal && pal[ch]) || BASE[ch];
      if (col) p.px(ox + x, oy + y, col);
    }
  }
}
// Build full rows from left halves (centre column included when odd=true).
// Mirrored pixels further than `from` columns from the centre get one shade darker.
function sym(half, odd = true, from = 2) {
  return half.map((s) => {
    const n = s.length, right = [];
    for (let i = n - (odd ? 2 : 1); i >= 0; i--) {
      const dist = n - 1 - i;
      const ch = s[i];
      right.push(dist >= from && DARKER[ch] ? DARKER[ch] : ch);
    }
    return s + right.join('');
  });
}

// Sprite factories ----------------------------------------------------------
// Plain map sprite (engine adds outline). rim:false — maps are hand-shaded.
function M(w, h, rows, pal, extra) {
  return { w, h, rim: false, rows, draw(p) { pix(p, rows, pal); if (extra) extra(p); } };
}
// Plain map sprite WITH the engine's rim light (flat-colour glyphs).
function MR(w, h, rows, pal, extra) {
  return { w, h, rows, draw(p) { pix(p, rows, pal); if (extra) extra(p); } };
}
// Tinted map sprite: tint ramp symbols take opts.c (or the default).
function MT(w, h, rows, def, pal, extra) {
  return {
    w, h, rim: false, rows,
    draw(p, o) {
      const c = (o && o.c) || def;
      const t = ramp(c);
      pix(p, rows, pal ? { ...pal, ...t } : t);
      if (extra) extra(p, c, t);
    },
  };
}

// ------------------------------------------------------------------ card art
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const bay = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];
const MOODS = {
  steel:  { bg: ['#08090c', '#0f1217', '#171c23', '#212833', '#2c3644'], glow: '#9fb3c4' },
  ember:  { bg: ['#0a0706', '#150c09', '#22120c', '#331a0f', '#4a2412'], glow: '#e0702a' },
  blood:  { bg: ['#0a0607', '#16090b', '#230d10', '#341215', '#4a181b'], glow: '#b02a2a' },
  rot:    { bg: ['#07090a', '#0d120b', '#141d0f', '#1d2a14', '#283a1a'], glow: '#8fae3a' },
  spirit: { bg: ['#06090b', '#0a1314', '#0f1e1e', '#152b2a', '#1d3c3a'], glow: '#7fd1c4' },
  violet: { bg: ['#08070b', '#110d17', '#1a1423', '#251c33', '#322646'], glow: '#9a78c8' },
  gold:   { bg: ['#0a0907', '#15110a', '#211a0d', '#302511', '#433315'], glow: '#e8c050' },
  night:  { bg: ['#08080b', '#100f15', '#18171f', '#22202b', '#2e2b39'], glow: '#8a8494' },
  water:  { bg: ['#06080b', '#0a1117', '#0f1a22', '#152430', '#1d3242'], glow: '#6fa0bc' },
};
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// Dark vignette ground + glow + mist + falling ash.
function ground(p, mood, seed, gx = 16, gy = 11) {
  const m = MOODS[mood], bg = m.bg;
  for (let y = 0; y < 24; y++) for (let x = 0; x < 32; x++) {
    const dx = (x + 0.5 - gx) / 17, dy = (y + 0.5 - gy) / 13;
    const r = Math.sqrt(dx * dx + dy * dy);
    let t = (1.08 - r) * 3.3;
    if (y >= 19) t += 0.35 * (y - 18) / 5; // low mist on the ground
    const idx = Math.max(0, Math.min(4, Math.floor(t + bay(x, y) - 0.5)));
    p.px(x, y, bg[idx]);
  }
  // soft glow behind the subject (posterised + dithered)
  const g = rgba(m.glow);
  for (let y = 0; y < 24; y++) for (let x = 0; x < 32; x++) {
    const d = Math.hypot((x + 0.5 - gx) / 1.15, y + 0.5 - gy) / 11;
    if (d >= 1) continue;
    const lv = Math.floor((1 - d) * (1 - d) * 3 + bay(x, y) - 0.4);
    if (lv > 0) p.px(x, y, [g[0], g[1], g[2], 14 + lv * 13]);
  }
  // ash
  const R = rng(seed);
  const n = 7 + ((R() * 4) | 0);
  for (let i = 0; i < n; i++) {
    const x = (R() * 32) | 0, y = (R() * 23) | 0;
    const b = R();
    p.px(x, y, b > 0.75 ? [190, 182, 170, 170] : b > 0.35 ? [130, 124, 120, 130] : [90, 86, 90, 120]);
  }
}
// Layer post-pass (rim light + outline), same rules as the engine's.
function finishLayer(L, rim = 0.8, oc = '#0b0a0d') {
  const { w, h, d } = L;
  const src = new Uint8ClampedArray(d);
  const so = (x, y) => x >= 0 && y >= 0 && x < w && y < h && src[(y * w + x) * 4 + 3] > 96;
  if (rim) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!so(x, y)) continue;
    let f = 0;
    if (!so(x, y - 1)) f += 0.2;
    if (!so(x - 1, y)) f += 0.1;
    if (!so(x, y + 1)) f -= 0.25;
    if (!so(x + 1, y)) f -= 0.12;
    if (f) {
      const i = (y * w + x) * 4;
      const c = shadeColor([src[i], src[i + 1], src[i + 2], 255], f * rim);
      d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2];
    }
  }
  for (let i = 3; i < d.length; i += 4) if (d[i] > 96) d[i] = 255;
  if (oc) {
    const o = rgba(oc), mask = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (so(x, y)) continue;
      if (so(x - 1, y) || so(x + 1, y) || so(x, y - 1) || so(x, y + 1)) mask.push((y * w + x) * 4);
    }
    for (const i of mask) { d[i] = o[0]; d[i + 1] = o[1]; d[i + 2] = o[2]; d[i + 3] = 255; }
  }
}
function blit(p, L, dx = 0, dy = 0, tint) {
  const { w, h, d } = L;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (!d[i + 3]) continue;
    p.px(x + dx, y + dy, tint || [d[i], d[i + 1], d[i + 2], d[i + 3]]);
  }
}
// Card art factory. obj(L, mood) draws the subject on a transparent layer.
// opts: back(p, m) before subject, fx(p, m) after, gx/gy glow centre, rim, shadow.
function art(mood, obj, o = {}) {
  return {
    w: 32, h: 24, outline: false, rim: false,
    draw(p) {
      const m = MOODS[mood];
      ground(p, mood, o.seed || hashStr(String(obj)), o.gx ?? 16, o.gy ?? 11);
      if (o.back) o.back(p, m);
      const L = new Painter(32, 24);
      obj(L, m);
      finishLayer(L, o.rim ?? 0.8);
      if (o.shadow !== false) blit(p, L, 1, 1, [0, 0, 0, 110]);
      blit(p, L);
      if (o.fx) o.fx(p, m);
    },
  };
}
// Helpers for subjects --------------------------------------------------------
// 45° band going up-right from (x,y) for len px; cols = colours from the
// upper-left edge to the lower-right edge (each one diagonal wide).
function diagUR(p, x, y, len, cols) {
  for (let i = 0; i < len; i++) cols.forEach((c, k) => p.px(x + i + k, y - i, c));
}
function diagDR(p, x, y, len, cols) {
  for (let i = 0; i < len; i++) cols.forEach((c, k) => p.px(x + i - k, y + i, c));
}
// Soft additive glow blob for fx (dithered, posterised).
function bloom(p, cx, cy, r, col, a = 60) {
  const g = rgba(col);
  for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / r;
    if (d >= 1) continue;
    const lv = Math.floor((1 - d) * 3 + bay(x, y) - 0.5);
    if (lv > 0) p.px(x, y, [g[0], g[1], g[2], Math.min(255, (a * lv) / 3)]);
  }
}

// Per-pixel fill: fn(x, y) returns a colour or null.
function shader(p, x0, y0, x1, y1, fn) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const c = fn(x, y); if (c) p.px(x, y, c); }
}
// Pick from a dark→light colour array by t (0..1) with ordered dither.
function lit(cols, t, x, y, d = 0.7) {
  const n = cols.length;
  return cols[Math.max(0, Math.min(n - 1, Math.floor(t * n + (bay(x, y) - 0.5) * d)))];
}
// Sphere lighting (light from the top-left) for a point inside a unit disc.
function sphere(nx, ny) {
  const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
  return Math.max(0, Math.min(0.999, 0.5 - 0.42 * nx - 0.5 * ny + 0.25 * (nz - 0.5)));
}
// Shaded ball.
function ball(p, cx, cy, r, cols, ry = r) {
  shader(p, Math.floor(cx - r - 1), Math.floor(cy - ry - 1), Math.ceil(cx + r), Math.ceil(cy + ry), (x, y) => {
    const nx = (x + 0.5 - cx) / r, ny = (y + 0.5 - cy) / ry;
    if (nx * nx + ny * ny > 1) return null;
    return lit(cols, sphere(nx, ny), x, y);
  });
}

const S = {}; // all sprite defs, registered at the bottom

// ---- card art: weapons
S.art_sword = art('steel', (p) => {
  diagUR(p, 10, 17, 14, ['#eef6f6', '#bccfd9', '#7d8894']);   // blade
  diagUR(p, 11, 16, 12, ['#9fb0bc']);                          // fuller
  p.px(24, 3, '#eef6f6'); p.px(25, 3, '#bccfd9'); p.px(25, 2, '#eef6f6');
  diagDR(p, 6, 14, 6, ['#f0d27a', '#c9a227', '#8f6f1a']);      // crossguard
  diagUR(p, 6, 21, 4, ['#977049', '#6e5039']);                 // grip
  circ(p, 5.5, 22, 1.6, '#c9a227'); p.px(5, 21, '#fff3c4');   // pommel
});
// ---- shield
S.art_shield = art('steel', (p) => {
  pix(p, sym([
    '..ttttttt',
    '.tYYYYYYY',
    '.tYeeeeee',
    '.tYefffff',
    '.tYefRRRR',
    '.tYefRsss',
    '.tYefRscc',
    '.tYefRscw',
    '.tYefRscc',
    '.tYeeRsss',
    '..tYeeRRR',
    '..tYeeeee',
    '...tYeeee',
    '...tYYeee',
    '....tYYee',
    '.....ttYY',
    '.......tt',
  ], true, 3), { t: '#5e4612' }, 7, 3);
});
// ---- skull
S.art_skull = art('night', (p) => {
  pix(p, sym([
    '....7777',
    '..778888',
    '.7889998',
    '.7899988',
    '78898888',
    '78888888',
    '78000088',
    '70000008',
    '70000108',
    '78000088',
    '.7888880',
    '..767700',
    '..777777',
    '..708080',
    '...77777',
  ], false, 3), null, 8, 3);
});
// ---- flame
S.art_flame = art('ember', (p) => {
  p.poly([[16, 1], [21, 8], [23, 14], [21, 20], [16, 22], [11, 20], [9, 14], [12, 9], [13, 12], [15, 6]], '#c4501e');
  p.poly([[16, 7], [19, 12], [20, 16], [18, 20], [16, 21], [13, 19], [12, 15], [14, 12]], '#e8a33a');
  p.poly([[16, 12], [18, 16], [17, 20], [15, 20], [14, 16]], '#fff3c4');
}, { gy: 13, shadow: false, fx: (p) => { bloom(p, 16, 15, 9, '#e8a33a', 50); } });
// ---- flask
S.art_flask = art('rot', (p) => {
  const cx = 16, cy = 14.5, r = 7.5, surf = 12;
  shader(p, 8, 6, 24, 23, (x, y) => {
    const nx = (x + 0.5 - cx) / r, ny = (y + 0.5 - cy) / r;
    if (nx * nx + ny * ny > 1) return null;
    if (y < surf) return lit(['#1f2a24', '#2d3b33', '#3d4d44'], sphere(nx, ny), x, y);
    if (y === surf) return '#c4dc68';
    return lit(['#3d5226', '#5c7a2a', '#8fae3a', '#a8c44a'], sphere(nx, ny) * 0.9 + 0.1, x, y);
  });
  p.rect(14, 3, 5, 5, '#2d3b33'); p.rect(14, 3, 1, 5, '#57635c');
  p.rect(13, 3, 7, 1, '#57635c');
  p.rect(14, 0, 5, 3, '#6e5039'); p.rect(14, 0, 2, 3, '#977049');
  p.path([[10, 11], [10, 14], [11, 17]], '#e8f0e0', 1); p.px(12, 9, '#a8b8a8');
  p.px(17, 15, '#c4dc68'); p.px(19, 17, '#c4dc68'); p.px(15, 18, '#a8c44a');
}, { gy: 13, fx: (p) => { p.px(19, 5, '#8fae3a'); p.px(21, 3, '#5c7a2a'); p.px(13, 1, '#5c7a2a'); } });
// ---- ghost
S.art_ghost = art('spirit', (p) => {
  pix(p, sym([
    '....hhh',
    '..hHHHH',
    '.hHHHHH',
    '.hHH0HH',
    'hHH000H',
    'hHH000H',
    'hHHH0HH',
    'hhHHHHH',
    'ThhHHH0',
    'ThhhHHh',
    'TThhhhh',
    'TThhhhh',
    '.TThhhh',
    '.T.Thhh',
    '...T.Th',
  ], true, 3), null, 9, 4);
}, { shadow: false, fx: (p) => bloom(p, 16, 10, 10, '#7fd1c4', 35) });

// ---- batch 1: arms & armour
S.art_greatsword = art('ember', (p) => {
  p.ellipse(16, 22.5, 9, 2, '#2c1e16');                       // earth mound
  p.ellipse(15, 22, 5, 1, '#4a3527');
  p.rect(14, 9, 5, 12, '#bccfd9');                             // blade
  p.rect(14, 9, 1, 12, '#eef6f6');
  p.rect(16, 10, 1, 10, '#8e98a3');                            // fuller
  p.rect(17, 9, 1, 12, '#8e98a3');
  p.rect(18, 9, 1, 12, '#545a63');
  p.rect(15, 21, 3, 1, '#8e98a3');
  p.rect(8, 7, 17, 2, '#c9a227');                              // crossguard
  p.rect(8, 7, 17, 1, '#f0d27a');
  p.px(7, 6, '#c9a227'); p.px(25, 6, '#8f6f1a');
  p.rect(15, 3, 3, 4, '#6e5039');                              // grip
  for (let y = 3; y < 7; y += 2) p.rect(15, y, 3, 1, '#977049');
  circ(p, 16.5, 1.8, 1.7, '#c9a227'); p.px(16, 1, '#fff3c4');
}, { gy: 12, fx: (p) => { bloom(p, 21, 18, 3, '#e8a33a', 50); p.px(22, 16, '#f0d27a'); p.px(11, 14, '#e8a33a'); } });
S.art_axe = art('ember', (p) => {
  diagUR(p, 5, 22, 17, ['#977049', '#6e5039', '#4a3527']);    // haft
  shader(p, 12, 0, 31, 20, (x, y) => {
    const dx = x + 0.5 - 21, dy = y + 0.5 - 9;
    const d = Math.hypot(dx, dy * 0.82);
    if (d > 8.2) return null;
    if (Math.hypot((x + 0.5 - 12.5) / 7, (y + 0.5 - 9) / 8.6) < 1) return null; // concave beard
    if (d > 7.1) return '#eef6f6';
    return lit(['#545a63', '#8e98a3', '#bccfd9'], 0.55 - dx * 0.04 - dy * 0.05, x, y);
  });
  p.rect(17, 5, 4, 7, '#545a63'); p.rect(17, 5, 4, 1, '#8e98a3'); p.rect(17, 5, 1, 7, '#8e98a3');
  p.px(19, 7, '#c9a227'); p.px(19, 9, '#c9a227');
  diagUR(p, 20, 5, 3, ['#977049', '#6e5039']);
});
S.art_dagger = art('blood', (p) => {
  circ(p, 16, 2.5, 1.6, '#c9a227'); p.px(15, 2, '#fff3c4');
  p.rect(15, 4, 3, 3, '#4b3b5e'); p.rect(15, 5, 3, 1, '#7b5aa6');
  p.rect(11, 7, 11, 2, '#c9a227'); p.rect(11, 7, 11, 1, '#f0d27a'); p.px(10, 6, '#c9a227'); p.px(22, 6, '#8f6f1a');
  p.poly([[14, 9], [19, 9], [18.6, 15], [16.5, 19.5], [14.4, 15]], '#bccfd9');
  p.rect(14, 9, 1, 6, '#eef6f6'); p.rect(16, 9, 1, 9, '#8e98a3'); p.rect(18, 9, 1, 6, '#545a63');
  p.poly([[14.5, 14], [18.5, 13], [18, 16], [16.5, 19.5], [15, 16]], '#8a1c1c');
  p.px(15, 14, '#b8302a'); p.px(16, 15, '#b8302a');
}, { fx: (p) => { p.px(16, 20, '#8a1c1c'); p.px(16, 22, '#b8302a'); p.px(16, 23, '#5e1212'); } });
S.art_spear = art('steel', (p) => {
  diagUR(p, 4, 22, 15, ['#977049', '#6e5039']);                // shaft
  p.poly([[18, 9], [18.6, 4.2], [26, 1], [22.8, 8.4]], '#bccfd9');
  diagUR(p, 19, 8, 7, ['#eef6f6']);
  diagUR(p, 20, 8, 6, ['#8e98a3']);
  p.rect(17, 8, 2, 2, '#c9a227');
  p.path([[17, 10], [16, 13], [15, 15]], '#8a1c1c', 1); p.path([[18, 10], [18, 13], [17, 15]], '#b8302a', 1);
});
S.art_mace = art('steel', (p) => {
  diagUR(p, 6, 22, 12, ['#977049', '#6e5039', '#4a3527']);
  diagUR(p, 6, 22, 4, ['#4b3b5e', '#2b2135', '#2b2135']);
  p.rect(17, 7, 3, 3, '#545a63');
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + 0.39;
    p.tri(21 + Math.cos(a) * 3, 6 + Math.sin(a) * 3, 21 + Math.cos(a) * 7.2, 6 + Math.sin(a) * 7.2, 21 + Math.cos(a + 0.5) * 3, 6 + Math.sin(a + 0.5) * 3, '#8e98a3');
  }
  circ(p, 21, 6, 4.2, '#8e98a3', { shade: 0.4 });
  p.px(19, 4, '#eef6f6'); p.px(20, 4, '#bccfd9');
});
S.art_bow = art('night', (p) => {
  p.path([[13, 1], [16, 3], [18, 6], [19, 9], [19, 15], [18, 18], [16, 21], [13, 23]], '#6e5039', 2);
  p.path([[13, 1], [16, 3], [18, 6], [19, 9]], '#977049', 1);
  p.px(12, 0, '#977049'); p.px(12, 23, '#4a3527');
  p.line(13, 2, 8, 12, '#cfc6b0'); p.line(8, 12, 13, 22, '#a19c9c');
  p.line(6, 12, 25, 12, '#977049');
  p.tri(24, 9.5, 29, 12.5, 24, 15.5, '#bccfd9'); p.px(25, 11, '#eef6f6');
  p.rect(5, 10, 4, 1, '#b8302a'); p.rect(5, 13, 4, 1, '#8a1c1c'); p.px(4, 9, '#b8302a'); p.px(4, 14, '#8a1c1c');
  p.rect(18, 11, 2, 3, '#4a3527');
});
S.art_fist = art('ember', (p) => {
  pix(p, [
    '...fFe.fFe.fFe....',
    '..fFFefFFefFFeffe.',
    '..fFeefFeefFeefFe.',
    '..feeIfeeIfeeIfeI.',
    '..eeIIeeIIeeIIeII.',
    '..iIIiiIIiiIIiiIi.',
    '.fffffffeIIeIIeIi.',
    'fFFFFFFfeeIeeIeIi.',
    'feeeeeeeIiIIiIIIi.',
    'iIIIIIIIiIIIIIIIi.',
    '.iiiiiiiIIIIIIIii.',
    '..eIIIIIIIIIIIIi..',
    '..cYYYYYYYYYYYYj..',
    '..feeeeeeeeeeeeI..',
    '..eIIIIIIIIIIIIi..',
    '..eIIIIIIIIIIIIi..',
    '..cYYYYjYYYjYYYj..',
  ], null, 7, 4);
}, { fx: (p) => { p.line(4, 3, 6, 5, '#f0d27a'); p.line(27, 3, 25, 5, '#f0d27a'); p.line(3, 8, 5, 8, '#e8a33a'); p.line(28, 9, 26, 9, '#e8a33a'); } });
S.art_tower_shield = art('steel', (p) => {
  pix(p, sym([
    '..iiiiii',
    '.ieeeeee',
    'ieYeeeee',
    'ieefffff',
    'iefZZZzz',
    'iefZkZzX',
    'ieeZZZzz',
    'iefZZzzX',
    'ieYZZZzz',
    'iefZkZzX',
    'iefZZZzz',
    'ieeZZzzX',
    'iefZZZzz',
    'ieYZkZzX',
    'iefZZZzz',
    'iefZZzzX',
    'ieeeeeee',
    '.ieeeeee',
    '..iiiiii',
  ], false, 3), { Z: '#8a1c1c', k: '#b8302a', z: '#5e1212', X: '#3a0b10' }, 8, 3);
  circ(p, 16, 12, 2.5, '#c9a227'); p.px(15, 11, '#fff3c4');
});
S.art_oath = art('gold', (p) => {
  p.ring(16, 10, 8, '#c9a227', 2);
  p.ring(16, 10, 8, '#f0d27a', 1);
  p.rect(15, 8, 3, 13, '#bccfd9'); p.rect(15, 8, 1, 13, '#eef6f6'); p.rect(17, 8, 1, 13, '#8e98a3');
  p.px(16, 21, '#8e98a3'); p.px(16, 22, '#545a63');
  p.rect(10, 6, 13, 2, '#c9a227'); p.rect(10, 6, 13, 1, '#f0d27a');
  p.rect(15, 2, 3, 4, '#6e5039');
  circ(p, 16.5, 1.5, 1.5, '#c9a227');
  p.poly([[12, 9], [21, 7], [22, 10], [13, 12]], '#8a1c1c');
  p.line(13, 9, 21, 8, '#b8302a');
  p.poly([[12, 11], [14, 12], [11, 17], [10, 15]], '#8a1c1c');
  p.poly([[20, 10], [22, 10], [24, 15], [22, 16]], '#5e1212');
}, { gy: 10, fx: (p) => bloom(p, 16, 10, 5, '#fff3c4', 40) });
S.art_banner = art('ember', (p) => {
  p.rect(8, 2, 2, 22, '#6e5039'); p.rect(8, 2, 1, 22, '#977049');
  circ(p, 9, 1.5, 1.5, '#c9a227');
  p.rect(7, 4, 18, 2, '#4a3527'); p.rect(7, 4, 18, 1, '#6e5039');
  p.poly([[10, 6], [24, 6], [24, 18], [22, 16], [21, 19], [18, 15], [16, 20], [13, 16], [11, 18], [10, 16]], '#8a1c1c', { shade: 0.25 });
  p.rect(23, 6, 1, 11, '#5e1212');
  pix(p, [
    'c.c.c',
    'YcYcY',
    'YYYYY',
    'j.0.j',
    'jjjjj',
  ], null, 15, 8);
});
S.art_crown = art('gold', (p) => {
  const iron = '#8e98a3';
  p.tri(6, 13, 7.5, 5, 10, 13, iron); p.tri(10, 13, 12, 7, 14, 13, iron);
  p.tri(13, 13, 16, 2, 19, 13, iron);
  p.tri(18, 13, 20, 7, 22, 13, iron); p.tri(22, 13, 24.5, 5, 26, 13, iron);
  p.rect(6, 12, 20, 7, iron, { shade: 0.3 });
  p.rect(6, 13, 20, 1, '#c9a227'); p.rect(6, 17, 20, 1, '#8f6f1a');
  p.line(7, 6, 7, 11, '#eef6f6'); p.line(16, 4, 14, 11, '#bccfd9'); p.line(12, 8, 11, 11, '#bccfd9');
  p.px(7, 5, '#f0d27a'); p.px(16, 2, '#f0d27a'); p.px(24, 5, '#c9a227'); p.px(12, 7, '#f0d27a'); p.px(20, 7, '#c9a227');
  circ(p, 16, 15, 2.6, '#c9a227'); circ(p, 16, 15, 1.6, '#0b0a0d');
  p.px(15, 13, '#fff3c4');
}, { gy: 12 });
S.art_scythe = art('spirit', (p) => {
  p.path([[20, 23], [15, 3]], '#6e5039', 2);
  p.path([[20, 23], [15, 3]], '#977049', 1);
  p.rect(16, 13, 3, 2, '#4a3527');
  p.poly([[16, 2], [11, 1], [6, 2], [2, 6], [1, 11], [4, 7], [8, 5], [13, 5], [16, 5]], '#8e98a3', { shade: 0.3 });
  p.path([[1, 11], [4, 7], [8, 5], [13, 5], [16, 5]], '#eef6f6', 1);
  p.rect(14, 2, 3, 4, '#545a63');
}, { gx: 12, gy: 9, fx: (p) => { p.px(5, 14, '#7fd1c4'); p.px(9, 17, '#cff5ec'); p.px(24, 6, '#7fd1c4'); } });
S.art_claw = art('blood', (p) => {
  for (let i = 0; i < 3; i++) {
    const x0 = 16 + i * 5, x1 = 6 + i * 5;
    p.poly([[x0, 2], [(x0 + x1) / 2 - 1.6, 12], [x1, 22], [(x0 + x1) / 2 + 1.6, 12]], '#8a1c1c');
    p.poly([[x0, 3], [(x0 + x1) / 2 - 0.8, 12], [x1, 21], [(x0 + x1) / 2 + 0.8, 12]], '#e0644c');
    p.line(x0 - 1, 5, x1 + 2, 19, '#fbf3df');
  }
}, { shadow: true, fx: (p) => { p.px(26, 4, '#b8302a'); p.px(28, 7, '#8a1c1c'); p.px(4, 20, '#b8302a'); } });
S.art_knife = art('violet', (p) => {
  const knife = (x, y, dir) => {
    // dir: 0 up, -1 up-left, 1 up-right
    if (dir === 0) {
      p.rect(x, y, 2, 7, '#bccfd9'); p.rect(x, y, 1, 7, '#eef6f6'); p.px(x, y - 1, '#eef6f6');
      p.rect(x - 1, y + 7, 4, 1, '#c9a227'); p.rect(x, y + 8, 2, 4, '#4b3b5e'); p.px(x, y + 9, '#7b5aa6'); p.px(x, y + 11, '#7b5aa6');
    } else {
      const s = dir;
      for (let i = 0; i < 7; i++) { p.px(x + s * i, y - i, '#eef6f6'); p.px(x + s * i + s, y - i, '#bccfd9'); p.px(x + s * i + s, y - i + 1, '#8e98a3'); }
      for (let i = -1; i <= 2; i++) p.px(x - s * 1 + s * i, y + 1 + i, '#c9a227');
      for (let i = 1; i <= 4; i++) { p.px(x - s * i, y + i + 1, '#4b3b5e'); p.px(x - s * i + s, y + i + 1, i % 2 ? '#7b5aa6' : '#4b3b5e'); }
    }
  };
  knife(9, 12, -1); knife(23, 12, 1); knife(15, 6, 0);
});

// ---- batch 2: organic & alchemy
S.art_bone = art('night', (p) => {
  const bone = (x0, y0, x1, y1, cols, kn) => {
    p.line(x0, y0, x1, y1, cols[1], 3);
    p.line(x0, y0, x1, y1, cols[2], 1);
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, px = -uy, py = ux;
    for (const [x, y, s] of [[x0, y0, -1], [x1, y1, 1]]) {
      ball(p, x + px * 1.6 + ux * s * 0.6, y + py * 1.6 + uy * s * 0.6, 2.1, kn);
      ball(p, x - px * 1.6 + ux * s * 0.6, y - py * 1.6 + uy * s * 0.6, 2.1, kn);
    }
  };
  bone(24, 4, 8, 19, ['#79747a', '#a19c9c', '#cfc6b0'], ['#79747a', '#a19c9c', '#cfc6b0']);
  bone(8, 4, 24, 19, ['#a19c9c', '#cfc6b0', '#fbf3df'], ['#a19c9c', '#cfc6b0', '#e8dcc0', '#fbf3df']);
});
S.art_cauldron = art('rot', (p) => {
  p.rect(9, 18, 2, 5, '#33373e'); p.rect(21, 18, 2, 5, '#33373e');
  ball(p, 16, 14, 9.5, ['#1a1c22', '#262a31', '#33373e', '#4a4f58'], 7);
  p.ellipse(16, 8.5, 10.5, 2.4, '#545a63');
  p.ellipse(16, 8.2, 10.5, 1.2, '#8e98a3');
  p.ellipse(16, 8.8, 8.8, 1.6, '#5c7a2a');
  p.ellipse(15, 8.6, 6, 1, '#8fae3a');
  circ(p, 13, 7.5, 1.4, '#c4dc68'); circ(p, 19, 7, 1.1, '#8fae3a'); p.px(12, 7, '#f0f8c0');
  p.rect(5, 12, 2, 3, '#545a63'); p.rect(25, 12, 2, 3, '#33373e');
}, { gy: 9, fx: (p) => {
  bloom(p, 16, 22, 5, '#e8a33a', 70);
  p.tri(13, 23, 14.5, 19, 16, 23, '#c4501e'); p.tri(15.5, 23, 17, 18, 18.5, 23, '#e8a33a'); p.px(17, 21, '#fff3c4');
  p.px(12, 4, '#8fae3a'); p.px(14, 2, '#5c7a2a'); p.px(19, 3, '#8fae3a'); p.px(21, 1, '#5c7a2a'); p.px(17, 5, '#c4dc68');
} });
S.art_herb = art('rot', (p) => {
  p.path([[16, 23], [16, 17], [15, 11], [15, 5], [16, 2]], '#3d5226', 1);
  const leaf = (x, y, dir, len, c1, c2) => {
    const tx = x + dir * len, ty = y - len * 0.55;
    p.poly([[x, y], [(x + tx) / 2, (y + ty) / 2 - 2], [tx, ty], [(x + tx) / 2 + dir * 0.5, (y + ty) / 2 + 1.5]], c1);
    p.line(x, y, tx, ty, c2);
  };
  leaf(16, 18, -1, 7, '#5c7a2a', '#8fae3a'); leaf(16, 15, 1, 7, '#5c7a2a', '#3d5226');
  leaf(15, 12, -1, 6, '#8fae3a', '#c4dc68'); leaf(15, 9, 1, 6, '#5c7a2a', '#8fae3a');
  leaf(15, 6, -1, 4, '#8fae3a', '#c4dc68'); leaf(15, 5, 1, 4, '#8fae3a', '#5c7a2a');
  p.rect(14, 19, 4, 2, '#977049'); p.px(14, 19, '#c29a68');
  circ(p, 19, 4, 1, '#cfc6b0'); circ(p, 12, 8, 1, '#e8dcc0');
});
S.art_mushroom = art('rot', (p) => {
  const shroom = (cx, top, rw, rh, stemH, sw) => {
    p.rect(cx - sw / 2, top + rh - 1, sw, stemH, '#cfc6b0', { shade: 0.3 });
    shader(p, Math.floor(cx - rw - 1), top - 1, Math.ceil(cx + rw), top + rh + 1, (x, y) => {
      const nx = (x + 0.5 - cx) / rw, ny = (y + 0.5 - (top + rh)) / rh;
      if (ny > 0.15 || nx * nx + ny * ny > 1) return null;
      if (ny > -0.05) return '#5e1212';
      return lit(['#5e1212', '#8a1c1c', '#b8302a', '#e0644c'], sphere(nx, ny + 0.3), x, y);
    });
  };
  shroom(10, 13, 4, 3.5, 6, 2);
  shroom(23, 15, 3, 2.5, 5, 2);
  shroom(16, 5, 7.5, 6, 10, 4);
  for (const [x, y] of [[12, 7], [15, 5], [19, 6], [13, 9], [17, 8], [21, 9], [9, 12], [11, 14], [22, 16], [24, 14]]) p.px(x, y, '#e8dcc0');
  p.px(16, 4, '#fbf3df');
  p.rect(5, 22, 23, 2, '#2c1e16');
}, { gy: 12 });
S.art_rot = art('rot', (p) => {
  pix(p, sym([
    '....7777',
    '..77v888',
    '.7v8v898',
    '.7v8v988',
    '7vb8b888',
    '7bG88b88',
    '7G00008b',
    'b0000v0G',
    'b000vvv0',
    '7b0000vb',
    '.7b8b8G0',
    '..bGb7G0',
    '..b77777',
    '..b0G080',
    '..bGb7b7',
    '..b..bG.',
    '..G...b.',
    '......G.',
  ], false, 3), { 7: '#b0b48a', 8: '#c8c8a0', 9: '#e2e2c0' }, 8, 2);
}, { fx: (p) => { p.px(5, 5, '#0b0a0d'); p.px(7, 4, '#0b0a0d'); p.px(26, 8, '#0b0a0d'); p.px(25, 6, '#0b0a0d'); p.px(17, 22, '#8fae3a'); p.px(22, 22, '#5c7a2a'); p.px(11, 21, '#5c7a2a'); } });
S.art_spark = art('gold', (p) => {
  const bolt = (pts) => { p.path(pts, '#e8a33a', 2); p.path(pts, '#fff3c4', 1); };
  bolt([[16, 11], [13, 7], [15, 5], [11, 1]]);
  bolt([[16, 11], [21, 9], [22, 5], [27, 3]]);
  bolt([[16, 11], [11, 13], [9, 17], [4, 18]]);
  bolt([[16, 11], [19, 15], [18, 19], [23, 22]]);
  bolt([[16, 11], [24, 13], [29, 13]]);
  bolt([[16, 11], [8, 9], [3, 7]]);
  circ(p, 16, 11, 3, '#f0d27a'); circ(p, 16, 11, 1.6, '#fbf3df');
}, { shadow: false, fx: (p) => { bloom(p, 16, 11, 8, '#fff3c4', 60); p.px(6, 4, '#f0d27a'); p.px(26, 19, '#f0d27a'); p.px(28, 7, '#e8a33a'); } });
S.art_drop = art('water', (p) => {
  shader(p, 8, 1, 24, 22, (x, y) => {
    const cx = 16, cy = 14, r = 6.5;
    const dy = y + 0.5 - cy, dx = x + 0.5 - cx;
    let inside = false, nx = dx / r, ny = dy / r;
    if (dy >= 0) inside = dx * dx + dy * dy <= r * r;
    else { const hw = r * Math.pow(Math.max(0, 1 + dy / 12.5), 1.6); inside = Math.abs(dx) <= hw; nx = hw ? dx / hw * 0.8 : 0; ny = dy / 12.5; }
    if (!inside) return null;
    return lit(['#16242e', '#2a4556', '#4c7890', '#7fb0c8', '#bfe0ec'], sphere(nx, ny) * 0.95, x, y);
  });
  p.path([[12, 13], [12, 16], [13, 18]], '#eef6f6', 1); p.px(13, 11, '#bfe0ec');
}, { gy: 13, fx: (p) => { p.ellipse(16, 22, 9, 1.5, '#2a4556'); p.eraseEllipse; p.ellipse(16, 22, 6, 0.8, '#16242e'); } });
S.art_blood = art('blood', (p) => {
  const drop = (cx, cy, r) => shader(p, Math.floor(cx - r - 1), Math.floor(cy - r * 2.7), Math.ceil(cx + r), Math.ceil(cy + r), (x, y) => {
    const dy = y + 0.5 - cy, dx = x + 0.5 - cx;
    let ins, nx = dx / r, ny = dy / r;
    if (dy >= 0) ins = dx * dx + dy * dy <= r * r;
    else { const hw = r * Math.pow(Math.max(0, 1 + dy / (r * 2.6)), 2); ins = Math.abs(dx) <= hw; nx = hw ? dx / hw * 0.8 : 0; ny = dy / (r * 2.6); }
    if (!ins) return null;
    return lit(['#3a0b10', '#5e1212', '#8a1c1c', '#b8302a', '#e0644c'], sphere(nx, ny), x, y);
  });
  drop(16, 11, 5); drop(8, 6, 2.6); drop(24, 8, 2.2);
  p.ellipse(16, 21, 8, 1.6, '#5e1212'); p.ellipse(15, 20.8, 5, 0.8, '#8a1c1c');
  p.px(7, 20, '#8a1c1c'); p.px(25, 21, '#8a1c1c'); p.px(23, 19, '#5e1212');
  p.px(14, 9, '#fbf3df');
});
S.art_heart = art('blood', (p) => {
  p.rect(13, 2, 3, 6, '#8a1c1c'); p.rect(13, 2, 1, 6, '#b8302a');
  p.rect(17, 1, 3, 6, '#5e1212'); p.rect(17, 1, 1, 6, '#8a1c1c');
  p.path([[19, 4], [22, 2], [24, 3]], '#4b3b5e', 2);
  shader(p, 5, 3, 27, 23, (x, y) => {
    const X = (x + 0.5 - 16) / 9.5, Y = -(y + 0.5 - 12) / 9.5 + 0.1;
    const v = Math.pow(X * X + Y * Y - 0.6, 3) - X * X * Y * Y * Y;
    if (v > 0) return null;
    return lit(['#3a0b10', '#5e1212', '#8a1c1c', '#b8302a', '#e0644c'], sphere(X * 0.9, -Y * 0.9 - 0.05), x, y);
  });
  p.path([[12, 9], [14, 12], [13, 16]], '#3a0b10', 1); p.path([[20, 8], [19, 12], [21, 15]], '#3a0b10', 1);
  p.px(10, 8, '#fbf3df'); p.px(11, 7, '#e0644c');
}, { gy: 12 });
S.art_eye = art('violet', (p) => {
  shader(p, 3, 4, 29, 20, (x, y) => {
    const X = (x + 0.5 - 16) / 13, Y = (y + 0.5 - 12) / 7;
    const lid = 1 - X * X;
    if (Math.abs(Y) > lid) return null;
    if (Math.abs(Y) > lid - 0.22) return Y < 0 ? '#9a735c' : '#6e5039';
    const d = Math.hypot(x + 0.5 - 16, y + 0.5 - 12);
    if (d < 1.8) return '#0b0a0d';
    if (d < 4.6) return lit(['#4b3b5e', '#7b5aa6', '#b49ad6'], 0.5 - (x - 16) * 0.08 - (y - 12) * 0.1, x, y);
    if (d < 5.4) return '#2b2135';
    return lit(['#a19c9c', '#cfc6b0', '#e8dcc0'], 0.6 - Y * 0.6, x, y);
  });
  p.path([[5, 12], [8, 11], [9, 12]], '#b8302a', 1); p.path([[26, 12], [23, 13], [22, 12]], '#b8302a', 1); p.px(7, 13, '#b8302a'); p.px(24, 10, '#b8302a');
  p.px(14, 10, '#fbf3df'); p.px(15, 10, '#fbf3df');
  p.path([[5, 6], [10, 4], [16, 3.5], [22, 4], [27, 6]], '#2b2135', 1);
}, { shadow: false });
S.art_hand = art('night', (p) => {
  pix(p, [
    '.......PP......',
    '....PP.PP......',
    '...PPP.PPP.....',
    '...PPP.PPP.PP..',
    '...PPP.PPP.PPP.',
    '...PPP.PPP.PPP.',
    '...PPPPPPPpPPP.',
    '...PPPPPPPPPPp.',
    'P..PPPPPPPPPPp.',
    'PP.8PPPPPPPPPp.',
    'PPP8PPPPPPPPPp.',
    '.PP8PPPPPPPPPp.',
    '.PPPPPPPPPPPp..',
    '..PPPPPPPPPPp..',
    '...PPPPPPPPpp..',
    '....PPPPPPPp...',
    '....pPPPPPpp...',
    '....pPPPPPpp...',
    '....3333333....',
    '...333333333...',
  ], { P: '#cfb8a4', p: '#9a8070', 8: '#e8dcc8', 3: '#4a3a50' }, 8, 2);
  p.px(11, 3, '#e8dcc8'); p.px(15, 1, '#e8dcc8'); p.px(19, 5, '#e8dcc8');
  p.line(14, 8, 14, 9, '#9a8070'); p.line(17, 9, 17, 10, '#9a8070');
}, { fx: (p) => { p.rect(5, 22, 22, 2, '#1a1414'); p.px(9, 21, '#2c1e16'); p.px(22, 21, '#2c1e16'); } });
S.art_tooth = art('blood', (p) => {
  shader(p, 8, 1, 24, 23, (x, y) => {
    const t = (y + 0.5 - 2) / 20; // 0 top → 1 tip
    if (t < 0 || t > 1) return null;
    const curve = 3.5 * t * t;
    const cx = 15 + curve - 1;
    const hw = t < 0.25 ? 4 + t * 4 : 5 * (1 - t) * 1.25 + 0.2;
    const dx = x + 0.5 - cx;
    if (Math.abs(dx) > hw) return null;
    if (t < 0.2) return (t < 0.12 && Math.abs(dx) < 1) ? null : lit(['#57535c', '#79747a', '#a19c9c'], 0.5 - dx / hw * 0.4, x, y);
    return lit(['#a19c9c', '#cfc6b0', '#e8dcc0', '#fbf3df'], 0.6 - dx / hw * 0.45 - t * 0.15, x, y);
  });
  p.px(18, 21, '#b8302a'); p.px(18, 20, '#8a1c1c'); p.px(17, 19, '#8a1c1c'); p.px(19, 22, '#8a1c1c');
}, { gy: 11 });
S.art_wisp = art('spirit', (p) => {
  p.poly([[16, 1], [19, 6], [22, 9], [21, 15], [16, 19], [11, 15], [10, 9], [13, 7], [14, 3]], '#3f8a80');
  p.poly([[16, 5], [19, 9], [20, 14], [16, 18], [12, 14], [12, 10], [15, 9]], '#7fd1c4');
  ball(p, 16, 14, 4, ['#7fd1c4', '#cff5ec', '#fbfffb']);
  p.px(14, 13, '#24504c'); p.px(18, 13, '#24504c');
}, { shadow: false, gy: 13, fx: (p) => { bloom(p, 16, 13, 10, '#7fd1c4', 55); p.px(9, 19, '#7fd1c4'); p.px(23, 18, '#cff5ec'); p.px(7, 6, '#3f8a80'); } });
S.art_lantern = art('gold', (p) => {
  p.line(16, 0, 16, 2, '#33373e');
  p.ring(16, 3, 1.5, '#545a63', 1);
  p.poly([[11, 6], [21, 6], [19, 4], [13, 4]], '#545a63');
  p.rect(11, 6, 10, 1, '#8e98a3');
  ball(p, 16, 12.5, 5, ['#c4501e', '#e8a33a', '#f0d27a', '#fff3c4'], 6);
  p.rect(11, 7, 1, 12, '#33373e'); p.rect(20, 7, 1, 12, '#33373e'); p.rect(15.5, 7, 1, 12, '#33373e');
  p.rect(10, 19, 12, 2, '#545a63'); p.rect(10, 19, 12, 1, '#8e98a3');
  p.rect(12, 21, 8, 1, '#33373e');
}, { gy: 12, fx: (p) => bloom(p, 16, 13, 11, '#f0d27a', 45) });
S.art_candle = art('gold', (p) => {
  p.ellipse(16, 21, 8, 2, '#8f6f1a'); p.ellipse(16, 20.5, 7, 1.2, '#c9a227'); p.rect(14, 21, 4, 2, '#5e4612');
  p.rect(13, 9, 6, 12, '#cfc6b0', { shade: 0.35 });
  p.rect(13, 9, 6, 1, '#e8dcc0');
  p.rect(13, 10, 1, 4, '#e8dcc0'); p.rect(18, 10, 1, 6, '#a19c9c'); p.px(12, 13, '#cfc6b0'); p.px(12, 14, '#cfc6b0'); p.px(19, 16, '#a19c9c');
  p.line(16, 7, 16, 9, '#2c1e16');
  p.poly([[16, 1], [18, 5], [17, 8], [15, 8], [14, 5]], '#e8a33a');
  p.poly([[16, 4], [17, 6], [16, 8], [15, 6]], '#fff3c4');
}, { gy: 8, fx: (p) => bloom(p, 16, 5, 8, '#f0d27a', 60) });

// ---- masks (shared by mask_* icons and card art)
const MASK_BLANK = sym([
  '....7788',
  '..778888',
  '.7888899',
  '.7888999',
  '78888888',
  '78800088',
  '78000008',
  '78800088',
  '78888888',
  '78888888',
  '.7888888',
  '.7888888',
  '..788888',
  '..778888',
  '...77788',
  '.....777',
], false, 3);
const MASK_WOLF = sym([
  '.5......',
  '.65.....',
  '.665....',
  '.6665555',
  '.6666666',
  '56666666',
  '5R006666',
  '56R00666',
  '566R6667',
  '.5666677',
  '..566677',
  '...56677',
  '....5667',
  '....5600',
  '.....500',
  '......55',
], false, 3);
const MASK_MOTH = sym([
  '......h.',
  '.......h',
  'tTT....7',
  'tThhTT.7',
  'tThHHhT7',
  'tThH000h',
  'tThH000h',
  'tThHhhhh',
  '.tThhhh7',
  '..tTTh77',
  '...tThT7',
  '..tThhT7',
  '..tThT.7',
  '...tt..7',
  '.......7',
], false, 3);
const MASK_OWL = sym([
  '.x......',
  '.zx.....',
  '.Zzxxxxx',
  'xZZzzzzz',
  'zZYYYYzz',
  'zYY00YYz',
  'zY0000Yz',
  'zY0000Yk',
  'zYY00YYk',
  'zZYYYYkO',
  '.zZZZkkO',
  '.zZZkkkO',
  '..zZZkkk',
  '...zZZkk',
  '....zzZk',
  '......zz',
], false, 3);
S.mask_wolf = M(16, 16, MASK_WOLF);
S.mask_moth = M(16, 16, [...MASK_MOTH, '................']);
S.mask_owl = M(16, 16, MASK_OWL);
const maskArt = (mood, rows, ribbon) => art(mood, (p) => {
  p.path([[8, 8], [4, 10], [2, 14]], ribbon, 1); p.path([[24, 8], [28, 10], [30, 13]], ribbon, 1);
  pix(p, rows, null, 8, 4);
}, { gy: 11 });
S.art_mask = maskArt('violet', MASK_BLANK, '#7b5aa6');
S.art_mask_wolf = maskArt('blood', MASK_WOLF, '#8a1c1c');
S.art_mask_moth = maskArt('spirit', MASK_MOTH, '#3f8a80');
S.art_mask_owl = maskArt('gold', MASK_OWL, '#977049');
// ---- batch 3: night, light, objects
S.art_feather = art('night', (p) => {
  shader(p, 1, 0, 31, 23, (x, y) => {
    const X = x + 0.5 - 5, Y = y + 0.5 - 22.5;
    const u = (X - Y) / Math.SQRT2 / 28, v = (X + Y) / Math.SQRT2;
    if (u < 0 || u > 1) return null;
    if (Math.abs(v) < 0.75) return u < 0.16 ? '#cfc6b0' : '#fbf3df';
    if (u < 0.15) return null;
    const w = Math.sin(Math.PI * Math.pow((u - 0.15) / 0.85, 0.7)) * 5.6;
    if (Math.abs(v) > w) return null;
    if ((u > 0.4 && u < 0.43 && v < -1) || (u > 0.62 && u < 0.645 && v > 1)) return null;
    return v < 0 ? lit(['#79747a', '#a19c9c', '#cfc6b0', '#e8dcc0'], 0.9 - Math.abs(v) / 9, x, y) : lit(['#57535c', '#79747a', '#a19c9c'], 0.85 - Math.abs(v) / 7, x, y);
  });
});
S.art_moon = art('night', (p) => {
  shader(p, 5, 1, 27, 23, (x, y) => {
    const nx = (x + 0.5 - 15) / 9.5, ny = (y + 0.5 - 12) / 9.5;
    if (nx * nx + ny * ny > 1) return null;
    if (Math.hypot(x + 0.5 - 20, y + 0.5 - 9) < 8.3) return null;
    return lit(['#79747a', '#a19c9c', '#cfc6b0', '#e8dcc0', '#fbf3df'], sphere(nx, ny) + 0.1, x, y);
  });
  circ(p, 10, 15, 1.2, '#a19c9c'); circ(p, 13, 19, 0.9, '#a19c9c'); p.px(8, 10, '#a19c9c');
}, { gx: 14, fx: (p) => { p.px(25, 18, '#e8dcc0'); p.px(27, 4, '#cfc6b0'); p.px(23, 21, '#a19c9c'); } });
S.art_sun = art('gold', (p) => {
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2, L = k % 2 ? 8.5 : 11, w = k % 2 ? 0.16 : 0.2;
    p.tri(16 + Math.cos(a - w) * 6, 12 + Math.sin(a - w) * 6, 16 + Math.cos(a) * L, 12 + Math.sin(a) * L, 16 + Math.cos(a + w) * 6, 12 + Math.sin(a + w) * 6, k % 2 ? '#c9a227' : '#f0d27a');
  }
  ball(p, 16, 12, 6.2, ['#c4501e', '#e8a33a', '#f0d27a', '#fff3c4']);
}, { shadow: false, fx: (p) => bloom(p, 16, 12, 9, '#fff3c4', 40) });
S.art_star = art('violet', (p) => {
  const star = (cx, cy, L, s, c1, c2) => {
    p.poly([[cx, cy - L], [cx + s, cy - s], [cx + L, cy], [cx + s, cy + s], [cx, cy + L], [cx - s, cy + s], [cx - L, cy], [cx - s, cy - s]], c1);
    p.line(cx, cy - L + 1, cx, cy + L - 1, c2); p.line(cx - L + 1, cy, cx + L - 1, cy, c2);
  };
  star(16, 11, 10, 2, '#b49ad6', '#fbf3df');
  p.poly([[16, 6], [19, 8], [21, 11], [19, 14], [16, 16], [13, 14], [11, 11], [13, 8]], '#e8dcc0');
  star(16, 11, 10, 1.2, '#e8dcc0', '#fbf3df');
  star(6, 5, 3, 0.8, '#7b5aa6', '#b49ad6'); star(26, 18, 3, 0.8, '#7b5aa6', '#b49ad6');
}, { shadow: false, fx: (p) => { bloom(p, 16, 11, 7, '#fbf3df', 55); p.px(25, 4, '#b49ad6'); p.px(7, 19, '#b49ad6'); } });
S.art_bell = art('gold', (p) => {
  p.ring(16, 3, 2, '#5e4612', 1);
  shader(p, 5, 3, 27, 21, (x, y) => {
    const t = (y + 0.5 - 4) / 15; if (t < 0 || t > 1) return null;
    const hw = 4 + 1.5 * t + 5.5 * Math.pow(t, 3);
    const dx = x + 0.5 - 16; if (Math.abs(dx) > hw) return null;
    if (t > 0.86) return lit(['#5e4612', '#8f6f1a', '#c9a227'], 0.7 - dx / hw * 0.5, x, y);
    return lit(['#5e4612', '#8f6f1a', '#c9a227', '#f0d27a', '#fff3c4'], 0.62 - dx / hw * 0.55 - (t < 0.15 ? 0 : 0.05), x, y);
  });
  p.rect(9, 15, 14, 1, '#8f6f1a');
  circ(p, 16, 21, 1.6, '#5e4612');
}, { fx: (p) => { p.path([[4, 9], [3, 12], [4, 15]], '#c9a227', 1); p.path([[28, 9], [29, 12], [28, 15]], '#c9a227', 1); } });
S.art_book = art('night', (p) => {
  p.rect(10, 4, 14, 17, '#cfc6b0'); for (let y = 5; y < 21; y += 2) p.rect(22, y, 2, 1, '#a19c9c');
  p.rect(8, 3, 15, 18, '#5e1f3d', { shade: 0.25 });
  p.rect(8, 3, 2, 18, '#3a0b10'); p.rect(10, 3, 1, 18, '#7a2a4a');
  p.rect(12, 6, 9, 12, '#3a0b10');
  p.rect(13, 7, 7, 10, '#5e1f3d');
  pix(p, ['.YYY.', 'Y.0.Y', 'Y000Y', 'Y.0.Y', '.YYY.'], { 0: '#c9a227' }, 14, 9);
  p.rect(21, 11, 3, 3, '#c9a227'); p.px(21, 11, '#f0d27a');
  p.rect(8, 3, 3, 2, '#c9a227'); p.rect(8, 19, 3, 2, '#8f6f1a'); p.rect(20, 3, 3, 2, '#c9a227'); p.rect(20, 19, 3, 2, '#8f6f1a');
});
S.art_scroll = art('gold', (p) => {
  p.rect(7, 6, 18, 12, '#e8dcc0', { shade: 0.2 });
  for (let y = 8; y < 16; y += 2) p.rect(10, y, y === 14 ? 7 : 12, 1, '#977049');
  ball(p, 6.5, 12, 2.2, ['#977049', '#c29a68', '#e8dcc0'], 7);
  ball(p, 25.5, 12, 2.2, ['#977049', '#c29a68', '#e8dcc0'], 7);
  p.rect(5, 4, 3, 1, '#6e5039'); p.rect(5, 19, 3, 1, '#6e5039'); p.rect(24, 4, 3, 1, '#6e5039'); p.rect(24, 19, 3, 1, '#6e5039');
  p.poly([[19, 17], [21, 17], [22, 22], [20, 20], [18, 22]], '#8a1c1c');
  ball(p, 20, 16.5, 2.4, ['#5e1212', '#8a1c1c', '#b8302a']);
  p.px(19, 16, '#e0644c');
});
S.art_chain = art('steel', (p) => {
  for (let i = 0; i < 5; i++) {
    const cx = 5 + i * 5.5, cy = 20 - i * 4.2;
    if (i % 2 === 0) { p.ring(cx, cy, 3.6, '#8e98a3', 2); p.ring(cx, cy, 3.6, '#bccfd9', 1); }
    else { p.line(cx - 3.5, cy + 2.6, cx + 3.5, cy - 2.6, '#8e98a3', 3); p.line(cx - 3.5, cy + 2.6, cx + 3.5, cy - 2.6, '#eef6f6', 1); }
  }
  p.rect(26, 0, 2, 3, '#545a63');
});
S.art_grave = art('night', (p) => {
  p.ellipse(16, 22, 12, 3, '#2c1e16'); p.ellipse(15, 21, 9, 1.4, '#3d5226');
  shader(p, 9, 2, 23, 21, (x, y) => {
    const dx = x + 0.5 - 16, dy = y + 0.5 - 8;
    if (Math.abs(dx) > 6.5) return null;
    if (dy < 0 && Math.hypot(dx, dy) > 6.5) return null;
    if (y > 20) return null;
    return lit(['#363040', '#57535c', '#79747a', '#a19c9c'], 0.6 - dx * 0.06 - dy * 0.015, x, y);
  });
  p.rect(15, 5, 2, 10, '#2b2135'); p.rect(12, 8, 8, 2, '#2b2135');
  p.px(12, 13, '#3d5226'); p.px(11, 15, '#5c7a2a'); p.px(21, 16, '#3d5226');
  p.line(19, 3, 21, 7, '#363040');
}, { gy: 10, fx: (p) => { p.px(8, 20, '#5c7a2a'); p.px(23, 20, '#5c7a2a'); p.px(24, 19, '#3d5226'); } });
S.art_wing = art('night', (p) => {
  const cols = ['#363040', '#57535c', '#79747a', '#a19c9c', '#cfc6b0'];
  const jx = 26, jy = 4;
  for (let k = 0; k < 7; k++) {
    const a = Math.PI * (0.58 + k * 0.1), L = 12 + (6 - k) * 1.4 + 3;
    const pts = [];
    for (let t = 0; t <= 1; t += 0.06) pts.push([jx + Math.cos(a - t * 0.12) * L * t, jy + Math.sin(a - t * 0.12) * L * t, 2.6 - t * 1.5]);
    tube(p, pts, cols.map((c, i) => cols[Math.max(0, i - (k % 2 ? 1 : 0))]), { d: 0.2 });
  }
  const arm = []; for (let t = 0; t <= 1; t += 0.06) arm.push([27 - t * 13, 3 + t * 3 - Math.sin(t * Math.PI) * 1.4, 1.8 - t * 0.5]);
  tube(p, arm, ['#57535c', '#a19c9c', '#cfc6b0', '#fbf3df', '#ffffff']);
  circ(p, 27, 3.6, 2, '#a19c9c'); p.px(26, 3, '#fbf3df');
}, { gx: 18 });
S.art_web = art('night', (p) => {
  const cx = 16, cy = 10, N = 8, cols = '#a19c9c';
  const sp = [];
  for (let k = 0; k < N; k++) { const a = (k / N) * Math.PI * 2 + 0.2; sp.push(a); p.line(cx, cy, cx + Math.cos(a) * 16, cy + Math.sin(a) * 11, '#57535c'); }
  for (const r of [3, 6, 9.5]) for (let k = 0; k < N; k++) {
    const a = sp[k], b = sp[(k + 1) % N];
    p.line(cx + Math.cos(a) * r * 1.3, cy + Math.sin(a) * r * 0.9, cx + Math.cos(b) * r * 1.3, cy + Math.sin(b) * r * 0.9, cols);
  }
  p.line(21, 0, 21, 14, '#a19c9c');
  ball(p, 21, 16, 2.2, ['#16131a', '#363040', '#57535c']);
  circ(p, 21, 13.5, 1.2, '#363040');
  p.path([[19, 15], [17, 13], [17, 12]], '#16131a', 1); p.path([[23, 15], [25, 13], [25, 12]], '#16131a', 1);
  p.path([[19, 17], [17, 19], [17, 20]], '#16131a', 1); p.path([[23, 17], [25, 19], [25, 20]], '#16131a', 1);
  p.px(20, 16, '#b8302a'); p.px(22, 16, '#b8302a');
}, { rim: 0.4 });
S.art_thorn = art('blood', (p) => {
  const pts = [];
  for (let t = 0; t <= 1; t += 0.01) pts.push([4 + t * 24, 12 + Math.sin(t * Math.PI * 2) * 6]);
  p.path(pts, '#2c1e16', 3); p.path(pts, '#4a3527', 2);
  p.path(pts.map(([x, y]) => [x, y - 1]), '#6e5039', 1);
  for (let i = 4; i < pts.length - 2; i += 8) {
    const [x, y] = pts[i], [x2, y2] = pts[i + 1];
    const dx = x2 - x, dy = y2 - y, L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L, s = (i / 8) % 2 ? 1 : -1;
    p.tri(x - dx * 1.2, y - dy * 1.2, x + dx * 1.2, y + dy * 1.2, x + nx * 3.5 * s + dx, y + ny * 3.5 * s + dy, '#977049');
    p.px(Math.round(x + nx * 3.2 * s + dx), Math.round(y + ny * 3.2 * s + dy), '#cfc6b0');
  }
  p.poly([[9, 8], [11, 5], [13, 8], [11, 9]], '#3d5226'); p.poly([[21, 16], [24, 15], [23, 18]], '#3d5226');
}, { fx: (p) => { p.px(24, 7, '#b8302a'); p.px(24, 8, '#8a1c1c'); p.px(24, 10, '#8a1c1c'); } });
S.art_swirl = art('violet', (p) => {
  let prev = null;
  for (let t = 0; t < 1; t += 0.004) {
    const a = t * Math.PI * 5.2, r = 1 + t * 10;
    const x = 16 + Math.cos(a) * r * 1.2, y = 11.5 + Math.sin(a) * r * 0.9;
    const w = 1 + t * 2.2;
    if (prev) p.line(prev[0], prev[1], x, y, t > 0.5 ? '#7b5aa6' : '#b49ad6', w);
    prev = [x, y];
  }
  prev = null;
  for (let t = 0.05; t < 1; t += 0.004) {
    const a = t * Math.PI * 5.2, r = 1 + t * 10;
    const x = 16 + Math.cos(a) * r * 1.2, y = 11.5 + Math.sin(a) * r * 0.9 - 0.6;
    if (prev) p.line(prev[0], prev[1], x, y, '#e2d6f2', 1);
    prev = [x, y];
  }
}, { shadow: false, fx: (p) => bloom(p, 16, 11.5, 5, '#fbf3df', 60) });

// ---- batch 4: creatures, magic, remaining objects
S.art_rune = art('spirit', (p) => {
  shader(p, 9, 2, 23, 22, (x, y) => {
    const dx = x + 0.5 - 16, dy = y + 0.5 - 12;
    const hw = 6 - Math.max(0, -dy - 6) * 0.9 + (dy > 0 ? dy * 0.08 : 0);
    if (Math.abs(dx) > hw || dy < -9.5 || dy > 9.5) return null;
    return lit(['#363040', '#57535c', '#79747a', '#a19c9c'], 0.6 - dx * 0.06 - dy * 0.02, x, y);
  });
  const g = '#7fd1c4';
  p.line(16, 6, 16, 18, g); p.line(16, 9, 12, 6, g); p.line(16, 9, 20, 6, g); p.line(16, 14, 12, 17, g); p.line(16, 12, 20, 15, g);
  p.px(13, 20, '#3d5226'); p.px(19, 21, '#5c7a2a');
}, { fx: (p) => { bloom(p, 16, 12, 6, '#7fd1c4', 45); p.px(16, 11, '#cff5ec'); p.px(16, 7, '#cff5ec'); } });
S.art_coin = art('gold', (p) => {
  for (let i = 0; i < 5; i++) { p.ellipse(23, 20 - i * 2, 5.5, 2, '#8f6f1a'); p.ellipse(23, 19.4 - i * 2, 5.5, 1.5, i === 4 ? '#f0d27a' : '#c9a227'); }
  for (let i = 0; i < 3; i++) { p.ellipse(8, 21 - i * 2, 4.5, 1.6, '#8f6f1a'); p.ellipse(8, 20.5 - i * 2, 4.5, 1.2, '#c9a227'); }
  ball(p, 14, 11, 7, ['#5e4612', '#8f6f1a', '#c9a227', '#f0d27a', '#fff3c4']);
  p.ring(14, 11, 7, '#8f6f1a', 1);
  p.ring(14, 11, 5.4, '#8f6f1a', 1);
  pix(p, ['j.j.j', 'jjjjj', 'jjjjj'], null, 12, 10);
  p.px(11, 6, '#fff3c4'); p.px(10, 7, '#fff3c4');
}, { gy: 13 });
S.art_key = art('gold', (p) => {
  p.ring(9, 8, 5, '#c9a227', 3); p.ring(9, 8, 5, '#f0d27a', 1);
  circ(p, 9, 8, 1.2, '#8f6f1a');
  diagDR(p, 12, 11, 13, ['#f0d27a', '#c9a227', '#8f6f1a']);
  p.rect(19, 18, 2, 4, '#c9a227'); p.rect(22, 20, 2, 3, '#8f6f1a'); p.rect(19, 21, 5, 1, '#8f6f1a');
  p.px(13, 12, '#fff3c4'); p.px(5, 5, '#fff3c4');
}, { gy: 11 });
S.art_hourglass = art('violet', (p) => {
  p.rect(9, 1, 14, 2, '#6e5039'); p.rect(9, 1, 14, 1, '#977049');
  p.rect(9, 21, 14, 2, '#4a3527'); p.rect(9, 21, 14, 1, '#6e5039');
  p.rect(10, 3, 1, 18, '#977049'); p.rect(21, 3, 1, 18, '#4a3527');
  shader(p, 11, 3, 20, 20, (x, y) => {
    const dy = y + 0.5 - 12, hw = 0.8 + Math.pow(Math.abs(dy) / 8.5, 1.4) * 4.6;
    const dx = x + 0.5 - 16;
    if (Math.abs(dx) > hw) return null;
    const sand = (dy < 0 && dy > -4.5) || (dy > 0 && (dy > 5 || (Math.abs(dx) < 0.8)) || (dy > 3 && Math.abs(dx) < 6 - (dy - 3) * -1.6 && dy > 8.5 - (3 - Math.abs(dx)) * 1.3));
    if (sand) return lit(['#8f6f1a', '#c9a227', '#f0d27a'], 0.6 - dx * 0.1, x, y);
    return Math.abs(dx) > hw - 1 ? '#7b5aa6' : (dx < -1.5 ? '#4b3b5e' : '#2b2135');
  });
  p.px(13, 5, '#e2d6f2'); p.px(13, 6, '#b49ad6'); p.px(13, 16, '#b49ad6');
}, { gy: 12 });
S.art_wolf = art('night', (p) => {
  p.poly([[1, 17], [5, 14], [9, 12.6], [14, 12], [17, 10.4], [18.6, 7.4], [19.6, 4.6], [21, 3], [26, 1.4], [28.4, 1.9], [27.6, 3.4], [24.8, 4.8], [23, 7.4], [22.6, 11], [23.4, 15], [25, 19.5], [22.4, 19.5], [21, 16], [19, 14.6], [16, 15], [15, 19.5], [12.6, 19.5], [12.6, 14.6], [9.6, 14.4], [8.4, 19.5], [6, 19.5], [6, 14.8], [3.2, 16.4]], '#1f1b27');
  p.poly([[20.2, 3.6], [21.2, 0], [23.8, 2.6]], '#1f1b27');
  p.px(2, 17, '#1f1b27'); p.px(1, 16, '#1f1b27');
  p.px(24, 3, '#e0644c');
  p.rect(0, 20, 32, 4, '#16131a'); p.rect(2, 19, 5, 1, '#16131a'); p.rect(17, 19, 6, 1, '#16131a'); p.rect(27, 19, 4, 1, '#16131a');
}, { rim: 0.35, shadow: false, gy: 8, gx: 22, back: (p) => { ball(p, 21.5, 8.5, 8.6, ['#57535c', '#79747a', '#a19c9c', '#cfc6b0', '#e8dcc0']); p.px(18, 6, '#a19c9c'); p.px(24, 12, '#79747a'); p.px(19, 11, '#a19c9c'); } });
S.art_raven = art('night', (p) => {
  pix(p, [
    '.....1222.........',
    '....12UU22........',
    '..0012OU222.......',
    '00002222222.......',
    '..001222U222......',
    '....12222U222.....',
    '....122222U222....',
    '....1222222U222...',
    '.....12222222U22..',
    '......122222222U2.',
    '.......12222222222',
    '........1222222122',
    '.........112221.12',
    '..........3..3...1',
    '.........33.33....',
  ], { 1: '#0b0a0d', 2: '#241f2b', U: '#4b3b5e', 0: '#57535c', O: '#e8a33a', 3: '#79747a' }, 7, 4);
  p.path([[2, 19], [12, 19], [22, 20], [30, 18]], '#2c1e16', 2); p.path([[2, 19], [12, 19], [22, 20], [30, 18]], '#4a3527', 1);
  p.line(24, 20, 27, 23, '#2c1e16', 1);
}, { gy: 10 });
S.art_moth = art('night', (p) => {
  shader(p, 2, 1, 30, 22, (x, y) => {
    const dx = Math.abs(x + 0.5 - 16), dy = y + 0.5 - 11;
    const up = Math.hypot((dx - 6.5) / 7.5, (dy + 3.5) / 6.2) < 1 && dy < 2;
    const lo = Math.hypot((dx - 4.5) / 4.8, (dy - 5) / 5) < 1 && dy > 0;
    if (!up && !lo) return null;
    const side = x + 0.5 < 16 ? 0.15 : -0.1;
    if (up && Math.hypot(dx - 7.5, dy + 3.5) < 2.2) return Math.hypot(dx - 7.5, dy + 3.5) < 1.1 ? '#0b0a0d' : '#c29a68';
    if (up && Math.abs(dy + 3.5 - (dx - 6) * 0.25) < 0.5 && dx > 10) return '#6e5039';
    return lit(up ? ['#6e5039', '#977049', '#c29a68', '#e8dcc0'] : ['#4a3527', '#6e5039', '#977049'], 0.55 + side - dy * 0.03, x, y);
  });
  p.rect(15, 4, 2, 15, '#363040'); p.rect(15, 4, 1, 15, '#57535c');
  circ(p, 16, 4.5, 1.6, '#57535c');
  p.path([[15, 3], [13, 0]], '#79747a', 1); p.path([[17, 3], [19, 0]], '#79747a', 1);
}, { gy: 10, fx: (p) => { p.px(5, 20, '#cfc6b0'); p.px(27, 3, '#a19c9c'); } });
S.art_owl = art('night', (p) => {
  pix(p, sym([
    '.x......',
    '.zx.....',
    '.zZxxxxx',
    'xZZZZZZz',
    'zZkkkZZz',
    'zkOOOOkz',
    'zkO00Okk',
    'zkO00Okk',
    'zkkOOkkY',
    'xzkkkkkY',
    'xzZkZkZk',
    'xzZZkZkZ',
    'xzzZkZkZ',
    '.xzZZkZk',
    '.xzzZZkZ',
    '..xzzZZk',
    '...xYxYx',
  ], false, 3), { O: '#e8a33a' }, 8, 2);
  p.path([[3, 19], [12, 19], [22, 19], [29, 20]], '#2c1e16', 2); p.path([[3, 19], [12, 19], [22, 19], [29, 20]], '#4a3527', 1);
}, { gy: 10 });
S.art_tree = art('night', (p) => {
  const br = (x, y, a, L, w, d) => {
    const ex = x + Math.cos(a) * L, ey = y + Math.sin(a) * L;
    p.line(x, y, ex, ey, '#16131a', w);
    if (d > 0) { br(ex, ey, a - 0.62 - d * 0.04, L * 0.74, Math.max(1, w - 1), d - 1); br(ex, ey, a + 0.52, L * 0.7, Math.max(1, w - 1), d - 1); if (d > 2) br(ex, ey, a - 0.05, L * 0.6, 1, d - 2); }
  };
  br(16, 23, -Math.PI / 2 - 0.04, 6.2, 3, 4);
  p.poly([[11, 23], [13.4, 20.4], [18.6, 20.4], [21, 23]], '#16131a');
  p.px(10, 23, '#16131a'); p.px(22, 23, '#16131a');
}, { rim: 0, gy: 10, shadow: false, back: (p) => { ball(p, 16, 10.5, 9, ['#57535c', '#79747a', '#a19c9c', '#cfc6b0', '#e8dcc0']); p.px(12, 6, '#a19c9c'); p.px(20, 14, '#79747a'); p.px(14, 14, '#a19c9c'); },
  fx: (p) => { p.px(4, 18, '#363040'); p.px(27, 19, '#363040'); } });
S.art_sigil = art('blood', (p) => {
  p.ring(16, 11.5, 10, '#b8302a', 1); p.ring(16, 11.5, 8.5, '#8a1c1c', 1);
  const pts = []; for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (k * 4 * Math.PI) / 5; pts.push([16 + Math.cos(a) * 8, 11.5 + Math.sin(a) * 8]); }
  p.path([...pts, pts[0]], '#e0644c', 1);
  for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; p.px(Math.round(16 + Math.cos(a) * 9.3 - 0.5), Math.round(11.5 + Math.sin(a) * 9.3 - 0.5), '#fbf3df'); }
  circ(p, 16, 11.5, 1.5, '#fbf3df');
}, { shadow: false, rim: 0, fx: (p) => bloom(p, 16, 11.5, 10, '#e0644c', 35) });
S.art_prayer = art('gold', (p) => {
  pix(p, sym([
    '....PP.',
    '...PPP.',
    '...PPPp',
    '..PPPPp',
    '..PP8Pp',
    '..PPPPp',
    '.PPPPPp',
    '.PP8PPp',
    '.PPPPPp',
    'PPPPPPp',
    'PP8PPPp',
    'PPPPPPp',
    'PPPPPpp',
    'PPPPppU',
    'UUUUUUU',
    'UUUUUUU',
  ], false, 3), { 8: '#f0e2d0', P: '#c9a48a', p: '#8a6450', U: '#4b3b5e' }, 9, 4);
  p.px(15, 4, '#0b0a0d'); p.px(16, 4, '#0b0a0d'); p.px(15, 5, '#5a3a30'); p.px(16, 5, '#5a3a30');
  p.rect(9, 18, 14, 1, '#2b2135');
}, { gy: 10, back: (p) => {
  for (let k = 0; k < 11; k++) { const a = -Math.PI / 2 + (k - 5) * 0.28; p.line(16, 6, Math.round(16 + Math.cos(a) * 15), Math.round(6 + Math.sin(a) * 15), [240, 210, 122, 50]); }
}, fx: (p) => bloom(p, 16, 4, 6, '#fff3c4', 50) });
S.art_cloak = art('violet', (p) => {
  pix(p, sym([
    '.....444',
    '....4555',
    '...45555',
    '..455111',
    '..451000',
    '..451000',
    '.4551h00',
    '.4551100',
    '.4555111',
    '45555511',
    '45555551',
    '45565551',
    '45565550',
    '45565550',
    '45565550',
    '45565550',
    '4556555.',
    '.4.55.5.',
  ], false, 3), { 4: '#2b2135', 5: '#4b3b5e', 6: '#6a5480', h: '#cff5ec' }, 8, 3);
  circ(p, 16, 12.5, 1.2, '#c9a227');
}, { gy: 10 });
S.art_mirror = art('violet', (p) => {
  p.rect(15, 16, 3, 7, '#8f6f1a'); p.rect(15, 16, 1, 7, '#c9a227'); circ(p, 16.5, 22.5, 1.6, '#c9a227');
  shader(p, 7, 0, 26, 18, (x, y) => {
    const nx = (x + 0.5 - 16.5) / 8, ny = (y + 0.5 - 8.5) / 8.5;
    const d = nx * nx + ny * ny;
    if (d > 1) return null;
    if (d > 0.7) return lit(['#5e4612', '#8f6f1a', '#c9a227', '#f0d27a'], sphere(nx, ny), x, y);
    const sh = Math.abs((x - y) + 0 - 4) < 1.2 || Math.abs((x - y) - 1) < 0.6;
    if (sh) return '#e2d6f2';
    return lit(['#2b2135', '#4b3b5e', '#7b5aa6', '#b49ad6'], 0.7 - nx * 0.3 - ny * 0.4, x, y);
  });
  p.px(16, 0, '#f0d27a'); p.px(9, 4, '#f0d27a');
}, { gy: 9, fx: (p) => { p.px(22, 4, '#fbf3df'); } });

// ---- status samples
S.st_guard = M(10, 10, [
  '.ffffffff.',
  'feeeeeeeeI',
  'feFeeeeeeI',
  'feFeeeeeeI',
  'feeeeeeeeI',
  '.feeeeeeI.',
  '.feeeeeeI.',
  '..feeeeI..',
  '...feeI...',
  '....II....',
]);
S.st_rot = M(10, 10, [
  '..vvvvvv..',
  '.vbbbbbbG.',
  'vbbbbbbbbG',
  'vb00bb00bG',
  'vb00bb00bG',
  '.bbbb0bbG.',
  '..bGbbGb..',
  '..b.bG.b..',
  '..G.G..G..',
  '....b.....',
]);
// ---- relic sample
S.rl_ring = MT(16, 16, [
  '......cwc.......',
  '.....cRsRc......',
  '......YRY.......',
  '.....=-#*-=.....',
  '...=-#+**+#-=...',
  '..=-#+....+#-=..',
  '..-#+......+#-..',
  '.=-#........#-=.',
  '.=-#........#-=.',
  '.=-+........#-=.',
  '..-#+......+#-..',
  '..=-#+....+#-=..',
  '...=-#####-==...',
  '.....=-----=....',
  '................',
  '................',
], '#c9a227');
// ---- potion sample
S.pt_flask_round = MT(12, 16, [
  '....xzzx....',
  '....zZkz....',
  '....xzzx....',
  '....5776....',
  '....4.65....',
  '...4.6.65...',
  '..4..6..65..',
  '.4-#####+65.',
  '4-#####**+65',
  '4-######*#64',
  '4-#######-54',
  '4=-#####--54',
  '.4=-----=-5.',
  '..44====44..',
  '...444444...',
  '............',
], '#8a1c1c');

// =================================================================== STATUS ICONS (10×10)
// Buffs are warm / bright; debuffs are sickly green or blood red. Each has a
// clear silhouette so it reads at ~2× on a phone.
const C = (w, h, fn) => ({ w, h, rim: false, draw: fn });
S.st_might = M(10, 10, [
  '..PPPPPP..',
  '.PPpPPpPPp',
  '.PPpPPpPPp',
  '.PPPPPPPPp',
  'PPPPPPPPPp',
  'PpPPPPPPp.',
  '.pPPPPPpp.',
  '..RRRRRR..',
  '..RsRsRR..',
  '..rrrrrr..',
]);
S.st_exposed = M(10, 10, [
  '.ffffffff.',
  'feeeeSeeeI',
  'feFeSSeeeI',
  'feeeeSSeeI',
  'feeeSSeeeI',
  '.feeeSeeI.',
  '.feeSeeeI.',
  '..feeSeI..',
  '...feeI...',
  '....II....',
]);
S.st_weak = C(10, 10, (p) => {
  const d = (cells, c) => cells.forEach(([x, y]) => p.px(x, y, c));
  d([[4, 5], [5, 4]], '#bccfd9'); d([[5, 5], [6, 4]], '#8e98a3'); d([[4, 6], [5, 6]], '#545a63');
  d([[7, 2], [8, 1], [9, 0]], '#bccfd9'); d([[8, 2], [9, 1]], '#8e98a3'); d([[7, 3]], '#545a63');
  d([[6, 3]], '#b8302a'); d([[6, 2], [7, 4]], '#8a1c1c');
  d([[2, 5], [3, 6], [4, 7]], '#c9a227'); d([[3, 5]], '#8f6f1a'); d([[2, 4]], '#8f6f1a');
  d([[2, 7], [1, 8]], '#977049'); d([[3, 7]], '#6e5039'); d([[0, 9], [1, 9]], '#c9a227');
});
S.st_frail = C(10, 10, (p) => {
  const pts = []; for (let t = 0; t <= 1.001; t += 0.08) pts.push([2.6 + t * 4.8, 7.4 - t * 4.8, 1.15]);
  tube(p, pts, ['#57535c', '#a19c9c', '#cfc6b0', '#fbf3df'], { d: 0.2 });
  for (const [x, y] of [[3.5, 8.5], [1.5, 6.5], [8.5, 3.5], [6.5, 1.5]]) ball(p, x, y, 1.25, ['#79747a', '#cfc6b0', '#e8dcc0', '#fbf3df']);
  for (const [x, y, c] of [[4, 4, '#8a1c1c'], [5, 5, '#e0644c'], [5, 6, '#8a1c1c'], [6, 6, '#5e1212'], [3, 3, '#5e1212'], [4, 5, '#3a0b10']]) p.px(x, y, c);
});
S.st_ward = C(10, 10, (p) => {
  p.ring(5, 5, 5, '#3f8a80', 1); p.ring(5, 5, 4, '#24504c', 1);
  p.ring(5, 5, 5, '#7fd1c4', 1);
  for (const [x, y] of [[1, 2], [1, 3]]) p.px(x, y, '#cff5ec');
  p.line(5, 2, 5, 7, '#cff5ec', 1); p.line(5, 4, 3, 2, '#7fd1c4', 1); p.line(5, 4, 7, 2, '#7fd1c4', 1); p.line(5, 6, 3, 7, '#7fd1c4', 1); p.line(5, 6, 7, 7, '#7fd1c4', 1);
});
S.st_thorns = C(10, 10, (p) => {
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
    p.line(Math.floor(5 + Math.cos(a) * 2.6), Math.floor(5 + Math.sin(a) * 2.6), Math.floor(5 + Math.cos(a) * 4.8), Math.floor(5 + Math.sin(a) * 4.8), k % 2 ? '#a19c9c' : '#e8dcc0', 1);
  }
  ball(p, 5, 5, 3, ['#16210f', '#3d5226', '#5c7a2a', '#8fae3a']);
  p.px(4, 4, '#c4dc68'); p.px(5, 7, '#253318');
});
S.st_plating = M(10, 10, [
  '.ffffffff.',
  'fcee..eecI',
  'feeeeeeeeI',
  'IIIIIIIIii',
  '.ffffffff.',
  'fceeeeeecI',
  'feeeeeeeeI',
  'IIIIIIIIii',
  '..iiiiii..',
  '..........',
]);
S.st_mending = M(10, 10, [
  '...bbbb...',
  '...bvvG...',
  '...bvvG...',
  'bbbbvvGGGG',
  'bvvvvvvvvG',
  'bvvvvvvvGG',
  'bbbbvvGGGG',
  '...bvvG...',
  '...bvvG...',
  '...GGGG...',
]);
S.st_rite = C(10, 10, (p) => {
  p.ring(5, 5, 5, '#c4501e', 1); p.ring(5, 5, 4, '#5e1212', 1); p.ring(5, 5, 5, '#c4501e', 1);
  p.px(1, 2, '#e8a33a'); p.px(2, 1, '#e8a33a'); p.px(8, 8, '#8a1c1c'); p.px(1, 7, '#8a1c1c');
  p.poly([[5, 2], [7, 5], [6.5, 7], [5, 8], [3.5, 7], [3, 5], [4, 4]], '#e8a33a');
  p.poly([[5, 4], [6, 6], [5, 7.5], [4, 6]], '#fff3c4');
});
S.st_bulwark = M(10, 10, [
  'ffffffffff',
  'feeeeeeeeI',
  'feeeYYeeeI',
  'feYYYYYYeI',
  'feeeYYeeeI',
  'feeeYYeeeI',
  'feeeYYeeeI',
  '.feeYYeeI.',
  '..feYYeI..',
  '...IIII...',
]);
S.st_soul = M(10, 10, [
  '....h.....',
  '....hh....',
  '...hHHh...',
  '..hHHHHh..',
  '..hHHHHT..',
  '.hHH0H0HT.',
  '.hHHHHHHT.',
  '.hHHHHHHT.',
  '..hhHHhT..',
  '...TTTT...',
]);
S.st_vigor = C(10, 10, (p) => {
  p.poly([[6.5, 0], [1.5, 5.5], [4.8, 5.5], [3, 10], [8.5, 3.8], [5.4, 3.8], [8, 0]], '#e8a33a');
  p.poly([[6.6, 1], [3.2, 5.2], [5.6, 5.2], [4.2, 8.3], [7.2, 3.4], [4.6, 3.4], [7, 1]], '#f0d27a');
  p.px(6, 1, '#fff3c4'); p.px(5, 3, '#fff3c4');
});
S.st_shackled = C(10, 10, (p) => {
  p.ring(3, 3, 3.1, '#545a63', 2); p.ring(3, 3, 3.1, '#bccfd9', 1);
  p.ring(7, 7, 3.1, '#33373e', 2); p.ring(7, 7, 3.1, '#8e98a3', 1);
  p.px(5, 5, '#eef6f6'); p.px(4, 4, '#8e98a3'); p.px(5, 4, '#545a63'); p.px(4, 5, '#545a63'); p.px(6, 6, '#545a63');
  p.px(0, 9, '#8a1c1c'); p.px(9, 0, '#8a1c1c');
});
S.st_dread = M(10, 10, [
  '..........',
  '..666666..',
  '.68888886.',
  '6888RR8886',
  '688R00R886',
  '.688RR886.',
  '..666666..',
  '...B...B..',
  '...B...B..',
  '...f...f..',
]);
S.st_burning = C(10, 10, (p) => {
  p.poly([[5, 0], [7, 3], [8.5, 5.5], [8, 8], [5, 9], [2, 8], [1.5, 5.5], [3, 3.5], [3.8, 4.8]], '#8a1c1c');
  p.poly([[5, 2.5], [7, 5.5], [6.8, 8], [5, 8.6], [3.2, 7.6], [3, 5.5], [4.4, 4.5]], '#c4501e');
  p.poly([[5, 5], [6.2, 7], [5, 8.2], [3.8, 7]], '#e8a33a');
  p.px(8, 1, '#79747a'); p.px(1, 2, '#57535c'); p.px(9, 4, '#a19c9c'); p.px(0, 5, '#79747a'); p.px(2, 9, '#363040'); p.px(7, 9, '#363040');
});
S.st_phantasm = M(10, 10, [
  '..hhhhhh..',
  '.hHHHHHHh.',
  'hHHHHHHHHh',
  'hH00HH00Hh',
  'hH00HH00Hh',
  'hHHHHHHHHh',
  'hHHH00HHHT',
  'hHHHHHHHHT',
  'hHHHHHHHHT',
  'hh.hhhh.TT',
]);
const EYE = (iris, lash) => [
  '..........',
  '..666666..',
  '.68888886.',
  '688' + iris[0] + iris[0] + iris[0] + iris[0] + '886',
  '688' + iris[0] + '00' + iris[0] + '886',
  '.68' + iris[1] + iris[1] + iris[1] + iris[1] + '86.',
  '..666666..',
  '..........',
  '..........',
  '..........',
];
S.st_insight = C(10, 10, (p) => {
  pix(p, [
    '...........',
  ].slice(0, 0));
  pix(p, [
    '..........',
    '..........',
    '...6666...',
    '.68888886.',
    '68hhhhhh86',
    '68hH00Hh86',
    '.68hhhh86.',
    '...6666...',
    '..........',
    '..........',
  ]);
  p.px(5, 0, '#f0d27a'); p.px(2, 1, '#e8a33a'); p.px(8, 1, '#e8a33a'); p.px(5, 1, '#fff3c4');
});
S.st_eye = M(10, 10, [
  '..........',
  '...6666...',
  '.66888866.',
  '6888llll86',
  '688l00ll86',
  '.688llll6.',
  '..666666..',
  '..........',
  '..........',
  '..........',
]);
S.st_zeal = C(10, 10, (p) => {
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2, x = 5 + Math.cos(a) * 4.4, y = 5 + Math.sin(a) * 4.4;
    p.px(Math.floor(x), Math.floor(y), k % 2 ? '#c9a227' : '#f0d27a');
    if (k % 2 === 0) p.px(Math.floor(5 + Math.cos(a) * 3.6), Math.floor(5 + Math.sin(a) * 3.6), '#e8a33a');
  }
  ball(p, 5, 5, 2.9, ['#c4501e', '#e8a33a', '#f0d27a', '#fff3c4']);
});
S.st_enrage = M(10, 10, [
  'S........S',
  'sS......Ss',
  'sS......Ss',
  '.sS....Ss.',
  '.sSS..SSs.',
  '..sSSSSs..',
  '...ssss...',
  '...Y..Y...',
  '..........',
  '..........',
]);
S.st_split = C(10, 10, (p) => {
  ball(p, 3.2, 5.4, 3.2, ['#3d5226', '#5c7a2a', '#8fae3a', '#c4dc68']);
  ball(p, 6.8, 5.4, 3.2, ['#3d5226', '#5c7a2a', '#8fae3a', '#c4dc68']);
  p.px(4, 3, '#253318'); p.px(5, 4, '#253318'); p.px(5, 5, '#253318'); p.px(5, 6, '#253318'); p.px(4, 7, '#253318'); p.px(5, 8, '#253318');
  p.px(0, 0, '#b8302a'); p.px(9, 0, '#b8302a');
});
S.st_minion = M(10, 10, [
  '..........',
  '..........',
  '...8888...',
  '..888888..',
  '..800800..',
  '..888888..',
  '...8008...',
  '...8888...',
  '...8888...',
  '..........',
]);
S.st_oath = C(10, 10, (p) => {
  p.rect(1, 2, 8, 6, '#e8dcc0'); p.rect(1, 2, 8, 1, '#fbf3df');
  ball(p, 1.5, 5, 1.6, ['#977049', '#c29a68', '#e8dcc0'], 4); ball(p, 8.5, 5, 1.6, ['#6e5039', '#977049', '#c29a68'], 4);
  p.rect(3, 3, 4, 1, '#977049'); p.rect(3, 5, 3, 1, '#977049');
  p.poly([[5, 6], [6.5, 6], [7, 9], [5.8, 8], [4.5, 9]], '#8a1c1c');
  ball(p, 5.5, 6.2, 2.1, ['#5e1212', '#8a1c1c', '#b8302a', '#e0644c']);
});
S.st_mask = M(10, 10, [
  '..LLLLLL..',
  '.LLLLYYLLl',
  'LLLLLLLLLl',
  'L00LLLL00l',
  'LL000LL000',
  'LLL00LL00l',
  '.LLLLLLLll',
  '.LLLLLLll.',
  '..LLLLll..',
  '...llll...',
]);
S.st_spirit = C(10, 10, (p) => {
  p.ring(5, 5, 4.8, '#24504c', 1);
  ball(p, 5, 5, 3.6, ['#24504c', '#3f8a80', '#7fd1c4', '#cff5ec', '#ffffff']);
  p.px(0, 4, '#7fd1c4'); p.px(9, 5, '#7fd1c4'); p.px(5, 0, '#3f8a80'); p.px(5, 9, '#3f8a80');
});
S.st_brew = M(10, 10, [
  '....ZZ....',
  '....ff....',
  '....fe....',
  '...fbbe...',
  '..fbbvbe..',
  '.fbbvvbbe.',
  '.fbbbbbbe.',
  '.fGbbbbGe.',
  '..fGGGGe..',
  '...eeee...',
]);
S.st_echo = C(10, 10, (p) => {
  p.ring(5, 5, 5, '#4b3b5e', 1); p.ring(5, 5, 5, '#7b5aa6', 1); p.ring(5, 5, 4, '#4b3b5e', 1);
  p.ring(5, 5, 2.8, '#b49ad6', 1); p.px(4, 4, '#fbf3df'); p.px(5, 5, '#e2d6f2');
  p.px(1, 2, '#b49ad6'); p.px(2, 1, '#b49ad6');
});
S.st_knife = C(10, 10, (p) => {
  p.line(8, 1, 3, 6, '#eef6f6', 1); p.line(9, 2, 4, 7, '#8e98a3', 1); p.line(8, 2, 4, 6, '#bccfd9', 1);
  p.px(9, 0, '#eef6f6'); p.px(9, 1, '#bccfd9');
  p.line(2, 5, 5, 8, '#c9a227', 1); p.px(2, 6, '#8f6f1a');
  p.line(1, 8, 3, 6, '#6e5039', 1); p.px(2, 8, '#4a3527'); p.px(0, 9, '#c9a227'); p.px(1, 9, '#8f6f1a');
});
S.st_blood = M(10, 10, [
  '....S.....',
  '....sS....',
  '...sSS....',
  '...sSsR...',
  '..sSSSsR..',
  '.sSwSSsRR.',
  '.sSSSSsRR.',
  '.sSSSsRRR.',
  '..sssRRR..',
  '...rrrr...',
]);
S.st_crown = M(10, 10, [
  '..........',
  '.c..cc..c.',
  '.Yc.YY.cY.',
  '.YYcYYcYY.',
  '.YYYYYYYY.',
  '.YcYYYYcY.',
  '.jjjjjjjj.',
  '.jRjjSjjRj'.slice(0, 10),
  '.yyyyyyyy.',
  '..........',
]);
S.st_skull = M(10, 10, [
  '..888888..',
  '.88888888.',
  '.88888888.',
  '.80088008.',
  '.80088008.',
  '.88888888.',
  '..880088..',
  '..888888..',
  '..808080..',
  '..........',
]);
S.st_moon = C(10, 10, (p) => {
  shader(p, 0, 0, 9, 9, (x, y) => {
    const nx = (x + 0.5 - 5) / 4.8, ny = (y + 0.5 - 5) / 4.8;
    if (nx * nx + ny * ny > 1) return null;
    if (Math.hypot(x + 0.5 - 7.4, y + 0.5 - 3.8) < 3.9) return null;
    return lit(['#79747a', '#a19c9c', '#cfc6b0', '#fbf3df'], sphere(nx, ny) + 0.12, x, y, 0.4);
  });
  p.px(8, 7, '#cfc6b0'); p.px(9, 1, '#a19c9c');
});
S.st_star = C(10, 10, (p) => {
  const pts = [];
  for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, r = k % 2 ? 2.1 : 5; pts.push([5 + Math.cos(a) * r, 5.4 + Math.sin(a) * r]); }
  p.poly(pts, '#c9a227');
  p.poly(pts.map(([x, y]) => [5 + (x - 5) * 0.62, 5.4 + (y - 5.4) * 0.62]), '#f0d27a');
  p.px(4, 4, '#fff3c4'); p.px(5, 3, '#fff3c4');
});
S.st_flame = C(10, 10, (p) => {
  p.poly([[5, 0], [7, 3], [8.6, 5.6], [8, 8], [5, 9.4], [2, 8], [1.4, 5.6], [3, 3.4], [3.9, 4.8]], '#c4501e');
  p.poly([[5, 2.5], [7, 5.5], [6.8, 8], [5, 8.8], [3.2, 7.8], [3, 5.5], [4.4, 4.5]], '#e8a33a');
  p.poly([[5, 5], [6.2, 7], [5, 8.4], [3.8, 7]], '#fff3c4');
});
S.st_chain = C(10, 10, (p) => {
  for (const [x, y, c] of [[2.4, 7.6, '#8e98a3'], [7.6, 2.4, '#8e98a3'], [5, 5, '#eef6f6']]) { p.ring(x, y, 2.5, c, 1); }
  p.ring(5, 5, 2.5, '#bccfd9', 1);
  p.px(0, 8, '#545a63'); p.px(9, 1, '#545a63'); p.px(4, 3, '#33373e'); p.px(6, 7, '#33373e');
});
S.st_feather = C(10, 10, (p) => {
  p.poly([[1, 9], [2, 5], [5, 1], [9, 0], [8, 4], [5, 7], [2, 9]], '#cfc6b0');
  p.poly([[2.5, 8], [3, 5], [5.5, 2], [8.2, 1], [7.2, 4], [4.5, 6.8]], '#e8dcc0');
  p.line(0, 9, 8, 1, '#79747a', 1); p.px(4, 4, '#a19c9c'); p.px(6, 5, '#a19c9c');
});
S.st_heart = M(10, 10, [
  '.RRR..RRR.',
  'RSwSRRSsSR',
  'RSSSSSSSsR',
  'RSSSSSSssR',
  '.RSSSSSsR.',
  '..RSSSsR..',
  '...RSsR...',
  '....RR....',
  '..........',
  '..........',
]);

// =================================================================== RELIC ICONS (16×16)
// T = tint ramp [darkest, dark, base, light, highlight] built from opts.c.
function pip(pts, x, y) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
// Polygon filled with top-left lighting from a colour array (dark→light).
function fillLit(p, pts, cols, o = {}) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = (x1 - x0) / 2 || 1, ry = (y1 - y0) / 2 || 1;
  const lx = o.lx ?? 0.4, ly = o.ly ?? 0.42;
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
    if (!pip(pts, x + 0.5, y + 0.5)) continue;
    const t = 0.52 - lx * ((x + 0.5 - cx) / rx) - ly * ((y + 0.5 - cy) / ry) + (o.bias || 0);
    p.px(x, y, lit(cols, t, x, y, o.d ?? 0.3));
  }
}
// Cylinder shading: vertical (light left→right) or horizontal (top→bottom).
function cyl(p, x, y, w, h, cols, vert = true) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const t = vert ? 1 - (i + 0.5) / w * 0.95 : 1 - (j + 0.5) / h * 0.95;
    p.px(x + i, y + j, lit(cols, t, x + i, y + j, 0.25));
  }
}
// Tapered tube along sampled points [[x,y,halfWidth],...], lit from the top-left.
function tube(p, pts, cols, o = {}) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const [x, y, w] of pts) { x0 = Math.min(x0, x - w); y0 = Math.min(y0, y - w); x1 = Math.max(x1, x + w); y1 = Math.max(y1, y + w); }
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
    const px = x + 0.5, py = y + 0.5;
    let bi = -1, bd = 1e9;
    for (let i = 0; i < pts.length; i++) { const d = Math.hypot(px - pts[i][0], py - pts[i][1]); if (d < bd) { bd = d; bi = i; } }
    const [sx, sy, w] = pts[bi];
    if (bd > w) continue;
    const nx = (px - sx) / w, ny = (py - sy) / w;
    const t = 0.5 - 0.5 * (nx * 0.6 + ny * 0.8) * (o.k ?? 0.9) + (o.bias || 0);
    p.px(x, y, lit(cols, t, x, y, o.d ?? 0.3));
  }
}
const RL = (def, fn) => ({
  w: 16, h: 16,
  draw(p, o) {
    const c = (o && o.c) || def, t = ramp(c);
    fn(p, [t['='], t['-'], t['#'], t['+'], t['*']], c);
  },
});
const BR = ['#4a3527', '#6e5039', '#977049', '#c29a68']; // wood / leather
S.rl_amulet = RL('#c9a227', (p, T) => {
  for (let i = 0; i <= 9; i++) {
    const a = i % 2 ? '#8e98a3' : '#eef6f6', b = i % 2 ? '#545a63' : '#8e98a3';
    p.px(Math.round(2 + (5 * i) / 9), i, a); p.px(Math.round(3 + (5 * i) / 9), i, '#545a63');
    p.px(Math.round(13 - (5 * i) / 9), i, b); p.px(Math.round(12 - (5 * i) / 9), i, '#33373e');
  }
  fillLit(p, [[8, 6], [13.5, 10.5], [8, 16], [2.5, 10.5]], T);
  p.line(8, 7, 3, 11, T[4]); p.line(8, 7, 13, 11, T[2]);
  ball(p, 8, 11, 2.6, ['#3a0b10', '#8a1c1c', '#b8302a', '#e0644c']);
  p.px(7, 10, '#fbf3df');
});
S.rl_coin = RL('#c9a227', (p, T) => {
  circ(p, 8, 8, 7.2, T[1]); circ(p, 8, 8, 6.4, T[2]);
  fillLit(p, [[3, 8], [4, 4], [8, 1.6], [12, 4], [13, 8], [12, 12], [8, 14.4], [4, 12]], [T[2], T[3], T[4]], { bias: -0.05 });
  p.ring(8, 8, 7.2, T[0], 1); p.ring(8, 8, 4.8, T[1], 1);
  p.rect(7, 5, 2, 6, T[1]); p.rect(5, 7, 6, 2, T[1]); p.px(7, 6, T[4]); p.px(6, 7, T[4]);
  p.px(4, 4, T[4]); p.px(5, 3, T[4]);
});
S.rl_skull = RL('#d8cfb8', (p, T) => {
  ball(p, 8, 6.8, 6, T, 5.6);
  fillLit(p, [[4.5, 10], [11.5, 10], [11, 15], [5, 15]], T);
  p.ellipse(5.6, 7.6, 1.8, 2.1, '#0b0a0d'); p.ellipse(10.4, 7.6, 1.8, 2.1, '#0b0a0d');
  p.px(8, 10, '#0b0a0d'); p.px(7, 11, '#0b0a0d'); p.px(8, 11, '#0b0a0d');
  for (const x of [6, 8, 10]) p.line(x, 13, x, 15, T[0]);
  p.px(5, 5, T[4]); p.px(6, 4, T[4]);
});
S.rl_bottle = RL('#5c7a2a', (p, T) => {
  cyl(p, 6, 4, 4, 4, T);
  p.rect(5, 1, 6, 3, '#6e5039'); p.rect(5, 1, 6, 1, '#977049'); p.rect(10, 2, 1, 2, '#4a3527');
  ball(p, 8, 10.6, 5.4, T, 5);
  p.rect(5, 6, 6, 2, T[2]); p.px(6, 7, T[3]);
  p.rect(5, 10, 6, 3, '#e8dcc0'); p.rect(6, 11, 4, 1, '#977049'); p.px(7, 11, '#5e1212'); p.px(9, 11, '#5e1212');
  p.px(5, 8, T[4]); p.px(5, 9, T[4]); p.px(6, 7, T[4]);
});
S.rl_tooth = RL('#e8dcc0', (p, T) => {
  fillLit(p, [[2.5, 1], [13.5, 1], [14.5, 4], [13.5, 8.5], [2.5, 8.5], [1.5, 4]], T, { bias: 0.1 });
  fillLit(p, [[3, 8], [7, 8], [6.4, 15], [5, 15]], T, { bias: -0.05 });
  fillLit(p, [[9, 8], [13, 8], [11.2, 15], [9.6, 15]], T, { bias: -0.15 });
  p.line(8, 2, 8, 6, T[1]); p.line(5, 4, 11, 4, T[1]);
  p.px(4, 2, T[4]); p.px(5, 2, T[4]); p.px(3, 3, T[4]);
});
S.rl_feather = RL('#cfc6b0', (p, T) => {
  fillLit(p, [[1, 15], [2.5, 9.5], [6, 4.5], [14, 0.5], [14.5, 7], [10, 11.5], [4.5, 14.5]], T, { lx: 0.25, ly: 0.25 });
  p.line(0, 15, 12, 2, T[0]); p.line(0, 14, 12, 1, T[3]);
  p.line(6, 9, 10, 8, T[1]); p.line(5, 12, 9, 11, T[1]); p.line(8, 6, 12, 5, T[1]);
  p.line(13, 1, 14, 0, T[4]);
});
S.rl_key = RL('#c9a227', (p, T) => {
  p.ring(4.5, 4.5, 4.8, T[1], 3); p.ring(4.5, 4.5, 4.8, T[2], 2); p.ring(4.5, 4.5, 4.8, T[4], 1);
  p.ring(4.5, 4.5, 3, T[0], 1);
  p.line(7, 7, 13, 13, T[1], 2); p.line(7, 6, 13, 12, T[3], 1);
  p.rect(12, 10, 3, 2, T[1]); p.rect(13, 12, 3, 2, T[2]); p.rect(10, 13, 2, 2, T[1]);
  p.px(14, 14, T[4]);
});
S.rl_book = RL('#7a2a4a', (p, T) => {
  p.rect(4, 2, 10, 13, '#e8dcc0'); p.rect(13, 3, 1, 11, '#a19c9c');
  cyl(p, 2, 1, 11, 14, T, false);
  p.rect(2, 1, 3, 14, T[1]); p.rect(2, 1, 1, 14, T[2]); p.line(5, 1, 5, 14, T[0]);
  p.rect(7, 4, 5, 5, T[1]); p.rect(8, 5, 3, 3, T[3]);
  p.rect(9, 6, 1, 1, '#c9a227'); p.rect(2, 1, 3, 2, '#c9a227'); p.rect(2, 13, 3, 2, '#8f6f1a');
  p.rect(11, 1, 2, 2, '#c9a227'); p.rect(11, 13, 2, 2, '#8f6f1a');
  p.rect(7, 11, 5, 1, T[1]); p.px(7, 10, T[4]);
});
S.rl_candle = RL('#e8dcc0', (p, T) => {
  p.ellipse(8, 14, 5.5, 1.6, '#5e4612'); p.ellipse(8, 13.6, 5, 1.2, '#c9a227'); p.rect(6, 12, 4, 2, '#8f6f1a');
  cyl(p, 5, 6, 6, 8, T);
  p.rect(5, 6, 6, 1, T[4]); p.px(4, 8, T[3]); p.px(4, 9, T[3]); p.px(11, 10, T[1]);
  p.line(8, 4, 8, 6, '#2c1e16');
  p.poly([[8, 0], [10, 3], [9.4, 5], [6.6, 5], [6, 3]], '#e8a33a');
  p.poly([[8, 2], [9, 4], [8, 5], [7, 4]], '#fff3c4');
});
S.rl_bell = RL('#c9a227', (p, T) => {
  p.ring(8, 2.4, 2, T[1], 1);
  fillLit(p, [[6, 3], [10, 3], [11.3, 6], [12.2, 11], [14.6, 13], [1.4, 13], [3.8, 11], [4.7, 6]], T);
  p.rect(2, 12, 12, 1, T[4]); p.rect(2, 13, 12, 1, T[0]);
  p.line(6, 4, 5, 10, T[4]);
  ball(p, 8, 14.6, 1.5, [T[0], T[1], T[2], T[3]]);
});
S.rl_chalice = RL('#c9a227', (p, T) => {
  fillLit(p, [[2.5, 1], [13.5, 1], [12.5, 6], [10, 9], [6, 9], [3.5, 6]], T);
  p.ellipse(8, 1.8, 5.2, 1.1, '#5e1212'); p.ellipse(7.5, 1.6, 3, 0.6, '#b8302a');
  p.line(3, 1, 13, 1, T[4]);
  cyl(p, 7, 9, 2, 3, T);
  ball(p, 8, 10.6, 1.9, T);
  fillLit(p, [[3.5, 14.5], [12.5, 14.5], [10.5, 12], [5.5, 12]], T);
  p.rect(3, 14, 10, 1, T[0]);
});
S.rl_dagger = RL('#bccfd9', (p, T) => {
  fillLit(p, [[8, 0], [10.4, 3], [10.4, 10], [5.6, 10], [5.6, 3]], T, { lx: 0.55, ly: 0.1 });
  p.line(8, 1, 8, 9, T[0]); p.line(7, 2, 7, 9, T[4]);
  p.rect(3, 10, 10, 2, '#c9a227'); p.rect(3, 10, 10, 1, '#f0d27a'); p.px(2, 9, '#c9a227'); p.px(13, 9, '#8f6f1a');
  cyl(p, 7, 12, 2, 3, ['#2c1e16', '#4a3527', '#6e5039']); p.px(7, 13, '#977049');
  ball(p, 8, 15, 1.4, ['#8f6f1a', '#c9a227', '#f0d27a']);
});
S.rl_gem = RL('#b8302a', (p, T) => {
  p.poly([[5, 2], [11, 2], [10, 6], [6, 6]], T[4]);
  p.poly([[5, 2], [6, 6], [1.8, 6]], T[3]);
  p.poly([[11, 2], [14.2, 6], [10, 6]], T[2]);
  p.poly([[1.8, 6], [6, 6], [8, 14.5]], T[2]);
  p.poly([[6, 6], [10, 6], [8, 14.5]], T[3]);
  p.poly([[10, 6], [14.2, 6], [8, 14.5]], T[1]);
  p.line(6, 6, 10, 6, T[4]); p.px(6, 3, '#ffffff'); p.px(7, 3, '#ffffff'); p.px(4, 5, '#ffffff'); p.px(7, 8, T[4]);
});
S.rl_eye = RL('#7b5aa6', (p, T) => {
  ball(p, 8, 8, 6.6, ['#79747a', '#a19c9c', '#cfc6b0', '#e8dcc0', '#fbf3df']);
  p.path([[2, 9], [4, 8], [5, 9]], '#b8302a', 1); p.path([[14, 7], [12, 8], [11, 7]], '#b8302a', 1); p.path([[8, 14], [9, 12]], '#b8302a', 1); p.path([[7, 2], [8, 3]], '#b8302a', 1);
  ball(p, 8, 8, 3.7, T);
  circ(p, 8, 8, 1.7, '#0b0a0d');
  p.px(6, 6, '#ffffff'); p.px(7, 6, '#ffffff'); p.px(6, 7, T[4]);
});
S.rl_hand = RL('#c9a48a', (p, T) => {
  const finger = (x, y, w, h) => cyl(p, x, y, w, h, T);
  finger(2.5, 5, 2, 6); finger(5, 2, 2, 8); finger(7.5, 1, 2, 9); finger(10, 3, 2, 7); finger(12.5, 6, 2, 5);
  ball(p, 8.4, 10.5, 5.6, T, 4.6);
  fillLit(p, [[1, 9], [4, 9], [6, 13], [3, 13]], T, { bias: -0.05 });
  p.rect(4, 13, 9, 3, '#2b2135'); p.rect(4, 13, 9, 1, '#4b3b5e');
  for (const [x, y] of [[3, 5], [5, 2], [8, 1], [10, 3], [13, 6]]) p.px(x, y, T[4]);
  for (const x of [2, 4, 7, 9, 11]) p.px(x + 1, 6 + (x > 5 ? -2 : 1), T[0]);
});
S.rl_horn = RL('#d8cfb8', (p, T) => {
  const pts = [];
  for (let t = 0; t <= 1; t += 0.025) {
    const x = (1 - t) * (1 - t) * 3.5 + 2 * t * (1 - t) * 0.5 + t * t * 14.5, y = (1 - t) * (1 - t) * 13.5 + 2 * t * (1 - t) * 1.5 + t * t * 1.5;
    pts.push([x, y, 3.6 * Math.pow(Math.max(0, 1 - t), 0.85) + 0.7]);
  }
  tube(p, pts, T, { d: 0.12 });
  for (const k of [10, 18, 26]) { const [x, y, w] = pts[k]; p.line(Math.round(x - w * 0.7), Math.round(y + w * 0.7), Math.round(x + w * 0.7), Math.round(y - w * 0.7), T[1]); }
  const [bx, by, bw] = pts[0]; p.ellipse(bx, by + 0.3, bw + 0.2, 1.7, '#2c1e16'); p.ellipse(bx - 0.4, by, bw - 0.6, 1, '#6e5039');
  const [tx, ty] = pts[pts.length - 6]; p.px(Math.round(tx - 1), Math.round(ty - 1), T[4]);
});
S.rl_bone = RL('#d8cfb8', (p, T) => {
  p.line(3, 12, 12, 3, T[1], 3); p.line(3, 11, 12, 2, T[2], 2); p.line(2, 11, 11, 2, T[4], 1);
  for (const [x, y] of [[2.5, 13], [4, 14], [1, 11.5], [2.5, 10]]) ball(p, x, y, 1.9, T);
  for (const [x, y] of [[13, 2.5], [14.5, 4], [12, 1], [11, 3]]) ball(p, x, y, 1.9, T);
  p.px(8, 7, T[0]); p.px(9, 6, T[0]);
});
S.rl_rosary = RL('#8a1c1c', (p, T) => {
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2 - Math.PI / 2 + 0.26, x = 8 + Math.cos(a) * 5.6, y = 6 + Math.sin(a) * 5;
    if (y > 10.8 && Math.abs(x - 8) < 2.5) continue;
    ball(p, x, y, k % 3 === 0 ? 1.6 : 1.25, T);
  }
  p.px(8, 11, T[1]); ball(p, 8, 11.5, 1.2, T); ball(p, 8, 13, 1.1, T);
  p.rect(7, 13, 2, 3, '#c9a227'); p.rect(6, 14, 4, 1, '#c9a227'); p.px(7, 13, '#f0d27a'); p.px(6, 14, '#f0d27a');
});
S.rl_sigil = RL('#e0644c', (p, T) => {
  circ(p, 8, 8, 7.3, '#363040'); circ(p, 8, 8, 6.6, '#241f2b');
  fillLit(p, [[2, 6], [4, 3], [8, 1.4], [12, 3], [14, 6], [14, 10], [12, 13], [8, 14.6], [4, 13], [2, 10]], ['#16131a', '#241f2b', '#363040'], { bias: -0.1 });
  p.ring(8, 8, 6.4, T[2], 1); p.ring(8, 8, 4.4, T[1], 1);
  p.line(8, 4, 8, 12, T[3]); p.line(8, 8, 5, 5, T[3]); p.line(8, 8, 11, 5, T[3]); p.line(8, 4, 8, 12, T[3]);
  p.px(7, 4, T[4]); p.px(8, 3, T[2]); p.px(8, 12, T[1]);
});
// ---- relics, part 2
S.rl_mask = RL('#d8cfb8', (p, T) => {
  fillLit(p, [[2, 3], [8, 1.2], [14, 3], [14.6, 8], [12, 12.4], [8, 15.4], [4, 12.4], [1.4, 8]], T, { bias: 0.05 });
  p.poly([[3.2, 6.2], [7, 7.2], [6.6, 9], [3.8, 8.4]], '#0b0a0d'); p.poly([[12.8, 6.2], [9, 7.2], [9.4, 9], [12.2, 8.4]], '#0b0a0d');
  p.line(3, 5, 7, 6, T[0]); p.line(13, 5, 9, 6, T[0]);
  p.line(8, 8, 8, 12, T[1]); p.px(7, 12, T[1]); p.px(9, 12, T[1]);
  p.line(5, 11, 7, 13, T[1]); p.line(11, 11, 9, 13, T[1]);
  p.px(8, 3, '#8a1c1c'); p.px(8, 4, '#b8302a'); p.px(3, 3, T[4]); p.px(4, 2, T[4]);
  p.px(1, 7, '#0b0a0d'); p.px(14, 7, '#0b0a0d');
});
S.rl_crown = RL('#c9a227', (p, T) => {
  fillLit(p, [[2, 9], [3, 3], [6, 7], [8, 1], [10, 7], [13, 3], [14, 9]], T, { bias: 0.05 });
  cyl(p, 2, 9, 12, 5, T, false);
  p.rect(2, 9, 12, 1, T[4]); p.rect(2, 13, 12, 1, T[0]);
  for (const [x, y] of [[3, 3], [8, 1], [13, 3]]) { p.px(x, y, T[4]); }
  p.rect(7, 10, 2, 2, '#0b0a0d'); p.rect(6, 11, 4, 1, T[1]); circ(p, 8, 11, 1.4, '#7a1a1a'); p.px(7, 10, '#e0644c');
  for (const x of [4, 11]) p.px(x, 11, T[0]);
});
S.rl_lantern = RL('#8e98a3', (p, T) => {
  p.ring(8, 2.2, 2.2, T[1], 1);
  fillLit(p, [[5.5, 4.5], [10.5, 4.5], [12, 6], [4, 6]], T);
  p.rect(4, 5, 8, 8, '#e8a33a'); p.rect(5, 6, 6, 6, '#f0d27a'); p.rect(6, 7, 4, 4, '#fff3c4');
  p.poly([[8, 6], [9.5, 9], [8, 11.5], [6.5, 9]], '#e8a33a'); p.poly([[8, 8], [9, 10], [8, 11], [7, 10]], '#fffbe0');
  cyl(p, 4, 5, 1, 8, T); cyl(p, 11, 5, 1, 8, T); p.rect(7, 5, 2, 8, T[1]); p.px(7, 5, T[3]);
  fillLit(p, [[3, 13], [13, 13], [12, 15.5], [4, 15.5]], T);
  p.rect(3, 13, 10, 1, T[4]);
});
S.rl_mirror = RL('#c9a227', (p, T) => {
  cyl(p, 7, 11, 2, 5, T);
  ball(p, 8, 6.6, 6, T, 6.4);
  shader(p, 2, 0, 14, 13, (x, y) => {
    const nx = (x + 0.5 - 8) / 4.4, ny = (y + 0.5 - 6.6) / 4.9;
    if (nx * nx + ny * ny > 1) return null;
    if (Math.abs((x - y) - 1) < 1 || Math.abs((x - y) - 4) < 0.6) return '#e6f4f8';
    return lit(['#2a4556', '#4c7890', '#7fb0c8', '#bfe0ec'], 0.7 - nx * 0.25 - ny * 0.4, x, y);
  });
  p.px(2, 6, T[4]); p.px(3, 3, T[4]); p.px(5, 1, T[4]); p.px(7, 15, T[0]);
});
S.rl_hourglass = RL('#977049', (p, T) => {
  p.poly([[4.5, 3], [11.5, 3], [8.6, 7.6], [8.6, 8.4], [11.5, 13], [4.5, 13], [7.4, 8.4], [7.4, 7.6]], '#4c7890');
  p.poly([[5.2, 3.2], [8, 3.2], [7.6, 7.6], [5.6, 4.8]], '#7fb0c8');
  p.poly([[6, 5.2], [10, 5.2], [8.2, 7.8]], '#f0d27a'); p.poly([[5.5, 13], [10.5, 13], [9.4, 10.8], [6.6, 10.8]], '#f0d27a'); p.line(8, 8, 8, 10, '#fff3c4');
  p.px(6, 12, '#c9a227'); p.px(9, 12, '#c9a227');
  cyl(p, 2, 1, 12, 2, T, false); cyl(p, 2, 13, 12, 2, T, false);
  p.rect(2, 1, 12, 1, T[4]); p.rect(2, 14, 12, 1, T[0]);
  cyl(p, 3, 3, 1, 10, T); cyl(p, 12, 3, 1, 10, T);
});
S.rl_scroll = RL('#d8c9a0', (p, T) => {
  cyl(p, 3, 3, 10, 10, T, false);
  p.rect(5, 6, 6, 1, T[0]); p.rect(5, 8, 5, 1, T[0]); p.rect(5, 10, 6, 1, T[1]);
  ball(p, 8, 3, 1.7, T, 1.7); p.rect(2, 2, 12, 2, T[3]); p.rect(2, 3, 12, 1, T[2]); p.rect(2, 2, 12, 1, T[4]);
  p.rect(2, 12, 12, 2, T[2]); p.rect(2, 13, 12, 1, T[1]); p.rect(2, 12, 12, 1, T[3]);
  p.px(1, 2, T[1]); p.px(1, 3, T[1]); p.px(14, 2, T[1]); p.px(14, 3, T[1]); p.px(1, 12, T[0]); p.px(14, 12, T[0]); p.px(1, 13, T[0]); p.px(14, 13, T[0]);
  p.poly([[10, 10], [12, 10], [12.6, 15.4], [11, 14], [9.4, 15.4]], '#8a1c1c');
  ball(p, 11, 11, 2.2, ['#3a0b10', '#5e1212', '#8a1c1c', '#b8302a', '#e0644c']);
});
S.rl_seed = RL('#b0793a', (p, T) => {
  ball(p, 8, 10, 4.9, T, 5.2);
  p.line(8, 14, 8, 15, T[0]);
  p.ellipse(8, 5.6, 5.8, 3.2, T[1]); p.ellipse(7.5, 5.2, 5.2, 2.7, T[2]);
  for (let x = 3; x < 13; x += 2) for (let y = 3; y < 8; y += 2) p.px(x + (y % 4 ? 1 : 0), y, T[0]);
  p.rect(7, 1, 2, 3, T[0]); p.px(7, 1, T[3]); p.px(5, 4, T[4]); p.px(6, 3, T[3]); p.px(5, 9, T[4]); p.px(5, 10, T[4]);
  p.px(10, 1, '#5c7a2a'); p.px(11, 0, '#8fae3a');
});
S.rl_flower = RL('#b5536b', (p, T) => {
  cyl(p, 7, 8, 2, 8, ['#253318', '#3d5226', '#5c7a2a']);
  fillLit(p, [[9, 13], [15, 10], [14, 14], [10, 15]], ['#253318', '#3d5226', '#5c7a2a', '#8fae3a']);
  fillLit(p, [[7, 12], [1.5, 10.5], [2.5, 14], [6.5, 14.5]], ['#253318', '#3d5226', '#5c7a2a', '#8fae3a']);
  for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (k * Math.PI * 2) / 5; ball(p, 8 + Math.cos(a) * 3.6, 5.5 + Math.sin(a) * 3.6, 2.7, T); }
  ball(p, 8, 5.5, 2, ['#8f6f1a', '#c9a227', '#f0d27a', '#fff3c4']);
});
S.rl_rope = RL('#b8905a', (p, T) => {
  p.ring(8, 8, 7.2, T[1], 3); p.ring(8, 8, 7.2, T[2], 2); p.ring(8, 8, 7.2, T[3], 1);
  p.ring(8, 8, 4.4, T[1], 3); p.ring(8, 8, 4.4, T[2], 2); p.ring(8, 8, 4.4, T[3], 1);
  for (let k = 0; k < 20; k++) { const a = (k / 20) * Math.PI * 2; const r = k % 2 ? 6.4 : 3.6; p.px(Math.floor(8 + Math.cos(a) * (r + 0.7)), Math.floor(8 + Math.sin(a) * (r + 0.7)), k % 4 ? T[0] : T[4]); }
  p.path([[13, 11], [14, 14], [12, 15]], T[2], 2); p.px(12, 15, T[0]);
});
S.rl_nail = RL('#8e98a3', (p, T) => {
  p.ellipse(8, 2.6, 4.6, 2.1, T[1]); p.ellipse(8, 2.2, 4.3, 1.8, T[2]); p.ellipse(7.4, 1.8, 2.8, 0.9, T[3]); p.rect(5, 1, 3, 1, T[4]);
  cyl(p, 7, 3, 2, 10, T);
  fillLit(p, [[7, 12.5], [9, 12.5], [8.2, 15.8], [7.8, 15.8]], T);
  p.px(8, 6, '#7a3a1a'); p.px(8, 7, '#a0522d'); p.px(7, 10, '#7a3a1a'); p.px(8, 9, T[0]);
  p.px(6, 2, T[0]); p.px(10, 2, T[0]);
});
S.rl_egg = RL('#d8cfb8', (p, T) => {
  shader(p, 1, 0, 15, 16, (x, y) => {
    const nx = (x + 0.5 - 8) / 5.6, ny = (y + 0.5 - 8.6) / 7;
    if (nx * nx * (1 - 0.24 * ny) + ny * ny > 1) return null;
    const v = hashStr(x + ',' + y) % 13;
    if (v === 0) return T[0]; if (v === 1) return T[1];
    return lit(T, sphere(nx, ny) * 0.95 + 0.05, x, y, 0.25);
  });
  p.px(5, 4, T[4]); p.px(6, 3, T[4]); p.px(5, 5, T[4]);
});
S.rl_heart = RL('#b8302a', (p, T) => {
  shader(p, 0, 0, 15, 15, (x, y) => {
    const X = (x + 0.5 - 8) / 6.6, Y = -(y + 0.5 - 7.6) / 6.6 + 0.12;
    if (Math.pow(X * X + Y * Y - 0.62, 3) - X * X * Y * Y * Y > 0) return null;
    return lit(T, sphere(X * 0.9, -Y * 0.9 - 0.05), x, y, 0.3);
  });
  p.path([[4, 4], [3, 6]], T[4], 1); p.px(5, 3, T[4]); p.px(4, 3, T[4]);
  p.path([[9, 5], [8, 8], [10, 10]], T[0], 1);
});
S.rl_moon = RL('#e8dcc0', (p, T) => {
  shader(p, 0, 0, 15, 15, (x, y) => {
    const nx = (x + 0.5 - 8) / 7, ny = (y + 0.5 - 8) / 7;
    if (nx * nx + ny * ny > 1) return null;
    if (Math.hypot(x + 0.5 - 11.2, y + 0.5 - 6) < 5.8) return null;
    return lit(T, sphere(nx, ny) + 0.1, x, y, 0.3);
  });
  p.px(3, 9, T[0]); p.px(4, 10, T[0]); p.px(5, 12, T[1]); p.px(3, 6, T[1]); p.px(12, 12, T[4]); p.px(14, 3, T[3]); p.px(13, 1, T[2]);
});
S.rl_sun = RL('#e8a33a', (p, T) => {
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2, w = 0.2, r0 = 4.8, r1 = k % 2 ? 6.8 : 8;
    p.tri(8 + Math.cos(a - w) * r0, 8 + Math.sin(a - w) * r0, 8 + Math.cos(a) * r1, 8 + Math.sin(a) * r1, 8 + Math.cos(a + w) * r0, 8 + Math.sin(a + w) * r0, k % 2 ? T[1] : T[3]);
  }
  ball(p, 8, 8, 4.8, [T[1], T[2], T[3], T[4], T[4]]);
  p.px(7, 8, T[1]); p.px(9, 8, T[1]); p.px(8, 10, T[1]); p.px(7, 10, T[1]); p.px(9, 10, T[1]);
});
S.rl_chain = RL('#8e98a3', (p, T) => {
  const L = [[3, 13, 0], [6.3, 9.7, 1], [9.7, 6.3, 0], [13, 3, 1]];
  for (const [x, y, v] of L) {
    if (!v) { p.ring(x, y, 3, T[1], 2); p.ring(x, y, 3, T[3], 1); p.ring(x - 0.3, y - 0.3, 3, T[4], 1); }
  }
  for (const [x, y, v] of L) if (v) { p.line(Math.round(x - 2), Math.round(y + 1.5), Math.round(x + 2), Math.round(y - 2.5), T[1], 3); p.line(Math.round(x - 2), Math.round(y + 1.5), Math.round(x + 2), Math.round(y - 2.5), T[3], 1); }
  p.px(1, 12, T[0]); p.px(14, 2, T[4]);
});
S.rl_pouch = RL('#8a5a34', (p, T) => {
  ball(p, 8, 10, 6, T, 5.2);
  fillLit(p, [[6, 5], [10, 5], [11, 9], [5, 9]], T, { bias: -0.05 });
  fillLit(p, [[3.5, 1.5], [8, 3.5], [12.5, 1.5], [11.5, 5.5], [4.5, 5.5]], T, { bias: 0.1 });
  p.line(5, 6, 11, 6, '#c9a227'); p.line(5, 7, 11, 7, T[0]);
  p.path([[10, 6], [13, 8], [13, 11]], '#c9a227', 1); p.path([[10, 7], [12, 10], [11, 12]], '#8f6f1a', 1);
  p.px(4, 10, T[4]); p.px(4, 11, T[4]); p.px(5, 13, T[3]);
  p.px(13, 12, '#c9a227'); p.px(13, 13, '#8f6f1a');
});
S.rl_dice = RL('#d8cfb8', (p, T) => {
  p.poly([[8, 1], [14.5, 4.4], [8, 7.8], [1.5, 4.4]], T[4]);
  p.poly([[1.5, 4.4], [8, 7.8], [8, 15], [1.5, 11.6]], T[2]);
  p.poly([[14.5, 4.4], [8, 7.8], [8, 15], [14.5, 11.6]], T[1]);
  p.line(1, 4, 8, 7, T[4]); p.line(8, 7, 14, 4, T[3]);
  const pip = '#16131a';
  p.px(7, 4, pip); p.px(8, 4, pip); p.px(8, 5, pip);
  p.px(3, 7, pip); p.px(3, 8, pip); p.px(6, 11, pip); p.px(6, 12, pip);
  p.px(10, 8, pip); p.px(12, 7, pip); p.px(11, 10, pip); p.px(10, 12, pip); p.px(12, 11, pip);
});
S.rl_whistle = RL('#d8cfb8', (p, T) => {
  cyl(p, 3, 6, 10, 4, T, false);
  cyl(p, 0, 7, 4, 2, T, false);
  p.rect(7, 5, 3, 1, T[1]); p.rect(8, 6, 2, 1, '#0b0a0d'); p.px(2, 7, '#0b0a0d');
  p.rect(3, 6, 10, 1, T[4]); p.rect(3, 9, 10, 1, T[0]);
  p.path([[12, 6], [14, 3], [11, 2], [9, 4]], '#977049', 1); p.px(9, 4, '#6e5039');
  p.px(13, 7, T[0]); p.px(13, 8, T[0]);
});
S.rl_cloak = RL('#4b3b5e', (p, T) => {
  fillLit(p, [[8, 1], [11, 3], [12, 6.5], [14.5, 15], [1.5, 15], [4, 6.5], [5, 3]], T, { bias: -0.05 });
  p.ellipse(8, 5.2, 2.6, 3.2, '#0b0a0d'); p.px(7, 5, '#7fd1c4'); p.px(9, 5, '#7fd1c4');
  p.line(4, 7, 3, 14, T[1]); p.line(12, 7, 13, 14, T[0]); p.line(8, 9, 8, 15, T[1]);
  p.line(6, 10, 5, 15, T[1]); p.line(10, 10, 11, 15, T[0]);
  ball(p, 8, 8.4, 1.5, ['#8f6f1a', '#c9a227', '#f0d27a']);
  p.rect(2, 14, 12, 1, T[0]);
});
S.rl_bowl = RL('#977049', (p, T) => {
  fillLit(p, [[1, 6], [15, 6], [13.4, 11.4], [10.5, 14.4], [5.5, 14.4], [2.6, 11.4]], T, { lx: 0.3, ly: 0.35 });
  p.ellipse(8, 6, 7.2, 1.9, T[3]); p.ellipse(8, 6.4, 6.2, 1.3, '#241f2b'); p.ellipse(8, 6.5, 5.2, 0.9, '#5e1212'); p.px(6, 6, '#8a1c1c');
  p.rect(5, 14, 6, 1, T[0]); p.rect(6, 9, 5, 1, T[1]); p.px(3, 8, T[4]); p.px(3, 9, T[4]);
  p.px(7, 3, '#79747a'); p.px(8, 2, '#57535c'); p.px(9, 1, '#79747a'); p.px(10, 3, '#57535c');
});
S.rl_shell = RL('#e0a8a0', (p, T) => {
  fillLit(p, [[8, 14], [1, 7], [2.5, 3.5], [8, 1.5], [13.5, 3.5], [15, 7]], T, { bias: 0.05 });
  for (let k = 0; k < 7; k++) { const a = Math.PI + (k * Math.PI) / 6 - 0.0; p.line(8, 13, Math.round(8 + Math.cos(a) * 7), Math.round(13 + Math.sin(a) * 11.5), k % 2 ? T[1] : T[3]); }
  p.rect(6, 13, 4, 2, T[1]); p.px(6, 13, T[3]);
  p.line(2, 6, 4, 3, T[4]);
});
S.rl_stone = RL('#7a767a', (p, T) => {
  fillLit(p, [[3, 4], [7, 1.8], [12, 3], [14.2, 7], [13, 12], [9, 14.6], [4, 13], [1.8, 8]], T);
  p.px(4, 5, T[4]); p.px(5, 4, T[4]); p.px(10, 3, T[3]); p.px(12, 11, T[0]); p.px(10, 13, T[0]);
  const g = '#7fd1c4';
  p.line(8, 5, 8, 12, g); p.line(8, 7, 11, 5, g); p.line(8, 9, 11, 11, g);
  p.px(8, 8, '#cff5ec');
});
S.rl_idol = RL('#a0764a', (p, T) => {
  ball(p, 8, 3.8, 3, T);
  fillLit(p, [[4.5, 6.5], [11.5, 6.5], [12.5, 11], [11, 14.2], [5, 14.2], [3.5, 11]], T);
  fillLit(p, [[2.5, 7.5], [4.8, 7.5], [4.4, 12], [2.6, 12]], T, { bias: -0.1 }); fillLit(p, [[11.2, 7.5], [13.5, 7.5], [13.4, 12], [11.6, 12]], T, { bias: -0.2 });
  p.rect(4, 14, 8, 2, T[1]); p.rect(4, 14, 8, 1, T[3]);
  p.px(7, 3, '#e0644c'); p.px(9, 3, '#e0644c'); p.line(7, 5, 9, 5, T[0]);
  p.line(7, 8, 9, 8, T[0]); p.line(6, 10, 10, 10, T[1]); p.px(8, 12, T[0]);
  p.rect(6, 0, 4, 1, T[2]); p.px(5, 1, T[3]); p.px(10, 1, T[1]);
});
S.rl_pipe = RL('#6e5039', (p, T) => {
  const stem = []; for (let t = 0; t <= 1; t += 0.05) stem.push([2.5 + t * 6, 13.5 - Math.sin(t * Math.PI) * 2 - t * 2.5, 1.1]);
  tube(p, stem, T);
  p.px(1, 14, '#0b0a0d'); p.px(2, 14, '#0b0a0d'); p.px(1, 13, '#16131a');
  ball(p, 11, 8.5, 3.8, T, 4.4);
  p.ellipse(11, 5.4, 3.6, 1.2, T[3]); p.ellipse(11, 5.6, 2.6, 0.7, '#16131a'); p.px(10, 5, '#e8a33a');
  p.rect(7, 10, 2, 3, '#8f6f1a'); p.px(7, 10, '#f0d27a');
  p.px(9, 7, T[4]); p.px(9, 8, T[4]);
  p.px(11, 3, '#79747a'); p.px(12, 2, '#a19c9c'); p.px(11, 1, '#79747a'); p.px(13, 0, '#57535c');
});
S.rl_spoon = RL('#bccfd9', (p, T) => {
  shader(p, 7, 0, 16, 9, (x, y) => {
    const dx = x + 0.5 - 11.2, dy = y + 0.5 - 4.4, along = (-dx + dy) / Math.SQRT2, across = (dx + dy) / Math.SQRT2;
    const a = along / 4.8, c = across / 3.3;
    if (a * a + c * c > 1) return null;
    if (a * a + c * c < 0.5) return lit([T[0], T[1], T[2]], 0.55 + c * 0.35 + a * 0.2, x, y, 0.25);
    return lit(T, 0.6 - c * 0.5 - a * 0.25, x, y, 0.3);
  });
  const h = []; for (let t = 0; t <= 1; t += 0.05) h.push([9 - t * 6, 6.5 + t * 7, 1.15 + t * 0.4]);
  tube(p, h, T);
  p.px(10, 2, T[4]); p.px(9, 3, T[4]);
  circ(p, 2.8, 14, 1.3, T[2]);
});
S.rl_thimble = RL('#c9a227', (p, T) => {
  fillLit(p, [[4, 4.5], [12, 4.5], [13, 14], [3, 14]], T, { lx: 0.55, ly: 0.1 });
  ball(p, 8, 4.8, 4, T, 2.6);
  for (let y = 4; y < 12; y += 2) for (let x = 5 + ((y / 2) % 2); x < 12; x += 2) p.px(x, y, T[0]);
  cyl(p, 2, 12, 12, 3, T, false); p.rect(2, 12, 12, 1, T[4]); p.rect(2, 14, 12, 1, T[0]);
  p.px(5, 8, T[4]);
});
S.rl_locket = RL('#c9a227', (p, T) => {
  for (let i = 0; i <= 6; i++) {
    p.px(Math.round(3 + (4.5 * i) / 6), i, i % 2 ? '#8e98a3' : '#eef6f6'); p.px(Math.round(12 - (4.5 * i) / 6), i, i % 2 ? '#545a63' : '#bccfd9');
  }
  p.px(7, 7, '#8e98a3'); p.px(8, 7, '#545a63'); p.rect(7, 6, 2, 1, T[1]);
  ball(p, 8, 11, 4.8, T, 5.4);
  p.ring(8, 11, 5, T[0], 1); p.ring(8, 11, 3.5, T[1], 1);
  shader(p, 5, 8, 11, 14, (x, y) => { const X = (x + 0.5 - 8) / 2.3, Y = -(y + 0.5 - 10.7) / 2.3 + 0.1; return Math.pow(X * X + Y * Y - 0.62, 3) - X * X * Y * Y * Y <= 0 ? '#8a1c1c' : null; });
  p.px(7, 10, '#e0644c'); p.px(5, 8, T[4]); p.px(6, 7, T[4]); p.px(12, 11, T[0]); p.px(8, 15, T[0]);
});
S.rl_map = RL('#d8c9a0', (p, T) => {
  fillLit(p, [[1.5, 3], [5.5, 2], [10.5, 3.2], [14.5, 2.2], [14.5, 13], [10.5, 14], [5.5, 12.8], [1.5, 14]], T, { lx: 0.3, ly: 0.3, bias: 0.05 });
  p.line(5, 3, 6, 13, T[1]); p.line(10, 3, 11, 13, T[1]); p.line(6, 3, 6, 12, T[3]); p.line(11, 3, 11, 12, T[3]);
  const r = '#8a1c1c';
  p.px(3, 11, r); p.px(4, 10, r); p.px(5, 9, r); p.px(7, 9, r); p.px(8, 8, r); p.px(9, 7, r); p.px(10, 6, r);
  p.line(12, 5, 14, 7, '#b8302a'); p.line(14, 5, 12, 7, '#b8302a');
  p.px(3, 5, T[0]); p.px(4, 5, T[0]); p.px(8, 12, T[0]); p.px(9, 12, T[0]);
  p.rect(2, 3, 2, 1, T[4]);
});
S.rl_quill = RL('#e8dcc0', (p, T) => {
  circ(p, 11, 14.2, 3.4, '#16131a'); p.ellipse(11, 12, 3.4, 1.1, '#363040'); p.ellipse(11, 12.1, 2.4, 0.6, '#0b0a0d'); p.rect(8, 14, 6, 2, '#241f2b'); p.px(9, 13, '#57535c');
  fillLit(p, [[2, 13], [3.5, 8], [7, 3], [14.4, 0.4], [14.2, 6.4], [10, 10.2], [5, 12.6]], T, { lx: 0.25, ly: 0.25 });
  p.line(1, 14, 11, 2, T[0]); p.line(1, 13, 11, 1, T[3]);
  p.line(6, 8, 10, 7, T[1]); p.line(5, 10, 9, 9, T[1]); p.line(9, 5, 12, 4, T[1]);
  p.px(0, 15, '#0b0a0d'); p.px(1, 15, '#16131a'); p.px(1, 14, '#241f2b');
});
S.rl_mortar = RL('#8e98a3', (p, T) => {
  fillLit(p, [[1.5, 7], [14.5, 7], [12.6, 12.4], [10.4, 14.6], [5.6, 14.6], [3.4, 12.4]], T, { lx: 0.3, ly: 0.4 });
  p.ellipse(8, 7, 7, 1.7, T[3]); p.ellipse(8, 7.3, 5.9, 1.2, '#241f2b');
  p.px(5, 7, '#5c7a2a'); p.px(7, 6, '#8fae3a'); p.px(9, 7, '#5c7a2a'); p.px(11, 7, '#3d5226');
  p.rect(5, 14, 6, 2, T[1]); p.rect(5, 14, 6, 1, T[3]);
  const pe = []; for (let t = 0; t <= 1; t += 0.05) pe.push([8.5 + t * 5.5, 8 - t * 6.5, 1.6 - t * 0.2]);
  tube(p, pe, T);
  ball(p, 14, 1.8, 1.9, T); p.px(3, 9, T[4]); p.px(3, 10, T[4]);
});

// =================================================================== POTION ICONS (12×16)
// opts.c = liquid colour. Glass is neutral grey-bone; cork/lid fixed.
const GLASS = ['#363040', '#57535c', '#8a8590', '#cfc6b0'];
function glassBody(p, inside, level, T) {
  // inside(x,y) -> {d, nx, ny} or null; d>0.62 is the glass wall.
  for (let y = 0; y < 16; y++) for (let x = 0; x < 12; x++) {
    const r = inside(x + 0.5, y + 0.5);
    if (!r) continue;
    if (r.d > 0.66) p.px(x, y, lit(GLASS, 0.62 - r.nx * 0.42 - r.ny * 0.4, x, y, 0.2));
    else if (y + 0.5 < level) p.px(x, y, (x + y) % 5 === 0 ? '#2d2a35' : '#241f2b');
    else if (y + 0.5 < level + 1) p.px(x, y, T[4]);
    else p.px(x, y, lit([T[0], T[1], T[2], T[3]], 0.55 - r.nx * 0.35 - r.ny * 0.3 + 0.12, x, y, 0.35));
  }
}
const PT = (def, fn) => ({
  w: 12, h: 16,
  draw(p, o) {
    const c = (o && o.c) || def, t = ramp(c);
    fn(p, [t['='], t['-'], t['#'], t['+'], t['*']], c);
  },
});
S.pt_flask_tall = PT('#8a1c1c', (p, T) => {
  glassBody(p, (x, y) => { const nx = (x - 6) / 4.1, ny = (y - 10.2) / 5.6; const d = nx * nx + ny * ny; return d <= 1 ? { d, nx, ny } : null; }, 9, T);
  p.rect(5, 2, 2, 3, GLASS[2]); p.rect(5, 2, 1, 3, GLASS[3]); p.rect(6, 3, 1, 2, GLASS[1]);
  p.rect(4, 4, 4, 1, GLASS[2]);
  p.rect(4, 1, 4, 1, GLASS[3]); p.rect(5, 0, 2, 2, '#6e5039'); p.px(5, 0, '#977049');
  p.px(3, 8, '#fbf3df'); p.px(3, 9, '#fbf3df'); p.px(4, 7, '#cfc6b0');
});
S.pt_vial = PT('#5c7a2a', (p, T) => {
  glassBody(p, (x, y) => {
    const nx = (x - 6) / 3.3;
    if (Math.abs(nx) > 1 || y < 3 || y > 15) return null;
    if (y > 12) { const ny = (y - 12) / 3, d = nx * nx + ny * ny; return d <= 1 ? { d: Math.max(d, 0.5 + Math.abs(nx) * 0.2), nx, ny } : null; }
    return { d: Math.abs(nx) * Math.abs(nx), nx, ny: 0 };
  }, 7, T);
  p.rect(3, 2, 6, 2, GLASS[2]); p.rect(3, 2, 6, 1, GLASS[3]); p.rect(9, 3, 1, 1, GLASS[1]);
  p.rect(4, 0, 4, 3, '#6e5039'); p.rect(4, 0, 2, 3, '#977049'); p.rect(7, 1, 1, 2, '#4a3527');
  p.px(4, 8, '#fbf3df'); p.px(4, 9, '#fbf3df'); p.px(4, 10, '#cfc6b0');
  p.px(7, 10, T[4]); p.px(6, 12, T[4]);
});
S.pt_jar = PT('#8a1c1c', (p, T) => {
  glassBody(p, (x, y) => {
    const nx = (x - 6) / 5.3, ny = (y - 9.4) / 5.6;
    if (Math.abs(nx) > 1 || Math.abs(ny) > 1) return null;
    const cx = Math.max(0, Math.abs(nx) - 0.6) / 0.4, cy = Math.max(0, Math.abs(ny) - 0.6) / 0.4;
    const r = cx * cx + cy * cy;
    if (r > 1) return null;
    return { d: Math.max(Math.abs(nx), Math.abs(ny), Math.sqrt(r) * 0.9) * 0.95 + 0.05, nx, ny };
  }, 7, T);
  p.rect(2, 2, 8, 3, '#6e5039'); p.rect(2, 2, 8, 1, '#977049'); p.rect(2, 4, 8, 1, '#4a3527'); p.rect(3, 1, 6, 1, '#6e5039');
  p.rect(3, 4, 6, 1, '#4a3527');
  p.px(3, 8, '#fbf3df'); p.px(3, 9, '#fbf3df');
  circ(p, 7, 11, 1.3, T[3]); p.px(6, 10, T[4]); p.px(5, 13, T[4]); p.px(8, 8, T[4]);
});
S.pt_skull_flask = PT('#5c7a2a', (p, T) => {
  glassBody(p, (x, y) => {
    const nx = (x - 6) / 5.4, ny = (y - 8.8) / 4.9;
    const cran = nx * nx + ny * ny, d1 = cran <= 1 ? cran : 9;
    let r = null;
    if (d1 <= 1) r = { d: d1, nx, ny };
    if (y >= 11 && y <= 15 && Math.abs(x - 6) <= 3.3) r = { d: Math.max(0.2, Math.abs(x - 6) / 3.3 - 0.1, (y - 11) / 5), nx: (x - 6) / 3.3, ny: (y - 13) / 2 };
    return r;
  }, 6, T);
  p.rect(5, 2, 2, 3, GLASS[2]); p.rect(4, 4, 4, 1, GLASS[2]);
  p.rect(4, 0, 4, 3, '#6e5039'); p.rect(4, 0, 2, 3, '#977049');
  p.ellipse(3.8, 8.2, 1.6, 1.9, '#0b0a0d'); p.ellipse(8.2, 8.2, 1.6, 1.9, '#0b0a0d');
  p.px(6, 10, '#0b0a0d'); p.px(5, 11, '#0b0a0d'); p.px(7, 11, '#0b0a0d');
  p.px(5, 13, '#16131a'); p.px(7, 13, '#16131a'); p.px(6, 14, '#16131a');
  p.px(2, 6, '#fbf3df'); p.px(3, 5, '#cfc6b0'); p.px(2, 7, '#cfc6b0');
});
S.pt_horn_cup = PT('#c4501e', (p, T) => {
  const pts = [];
  for (let t = 0; t <= 1; t += 0.03) pts.push([1.8 + t * 6.8, 14.6 - t * 9.4 - Math.sin(t * Math.PI) * 1.4, 0.8 + Math.pow(t, 1.3) * 3.2]);
  tube(p, pts, ['#2c1e16', '#4a3527', '#6e5039', '#977049', '#c29a68'], { d: 0.15 });
  const [ox, oy] = pts[pts.length - 1];
  const ca = Math.cos(0.66), sa = Math.sin(0.66); // opening faces up-right
  const ell = (rA, rB, f) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 12; x++) { const dx = x + 0.5 - ox, dy = y + 0.5 - oy; const u = (dx * ca + dy * sa) / rA, v = (-dx * sa + dy * ca) / rB; if (u * u + v * v <= 1) { const c = f(x, y, u, v); if (c) p.px(x, y, c); } } };
  ell(4.4, 2.5, () => '#c9a227');
  ell(3.8, 2, (x, y, u, v) => '#5e4612');
  ell(3.4, 1.7, (x, y, u, v) => lit([T[1], T[2], T[3]], 0.55 - u * 0.2 - v * 0.3, x, y, 0.3));
  p.px(Math.round(ox - 1.6), Math.round(oy - 0.4), T[4]);
  const [bx, by] = pts[Math.floor(pts.length * 0.5)];
  p.line(Math.round(bx - 1.6), Math.round(by + 1.4), Math.round(bx + 1.6), Math.round(by - 1.4), '#c9a227', 2); p.px(Math.round(bx - 1), Math.round(by + 1), '#f0d27a');
  p.px(1, 15, '#c9a227'); p.px(2, 15, '#8f6f1a');
});
// =================================================================== INTENT ICONS (14×14)
// Colour code: attack red, defend blue, buff gold, debuff green, special violet, neutral bone.
S.in_atk = C(14, 14, (p) => {
  p.line(3, 10, 11, 2, '#8a1c1c', 3); p.line(3, 9, 11, 1, '#e0644c', 1); p.line(4, 10, 12, 2, '#b8302a', 1);
  p.px(13, 0, '#fbf3df'); p.px(12, 1, '#fbf3df'); p.px(13, 1, '#e0644c'); p.px(12, 0, '#e0644c');
  p.line(2, 6, 7, 11, '#c9a227', 2); p.line(2, 5, 6, 9, '#f0d27a', 1); p.px(1, 6, '#8f6f1a'); p.px(8, 12, '#8f6f1a');
  p.line(1, 12, 4, 9, '#4a3527', 2); p.px(0, 13, '#c9a227'); p.px(1, 13, '#8f6f1a');
});
S.in_atk_heavy = C(14, 14, (p) => {
  p.line(2, 13, 9, 5, '#4a3527', 2); p.line(1, 13, 8, 5, '#977049', 1);
  shader(p, 4, 0, 13, 10, (x, y) => {
    const dx = x + 0.5 - 9.5, dy = y + 0.5 - 4.6, d = Math.hypot(dx, dy * 0.9);
    if (d > 5.1) return null;
    if (Math.hypot((x + 0.5 - 5.4) / 3.4, (y + 0.5 - 4.6) / 5) < 1) return null;
    if (d > 4.2) return '#e0644c';
    return lit(['#8a1c1c', '#b8302a', '#e0644c'], 0.5 - dx * 0.06 - dy * 0.08, x, y, 0.3);
  });
  p.rect(7, 3, 2, 4, '#5e1212'); p.px(7, 4, '#c9a227');
  p.px(11, 1, '#fbf3df'); p.px(12, 2, '#fbf3df');
});
S.in_def = MR(14, 14, sym([
  '.eeeeee',
  'eCCCCCC',
  'eCDDCCC',
  'eCDCBBB',
  'eCCBBBB',
  'eCCBBBB',
  'eCBBBBB',
  '.eCBBBB',
  '.eCBBBB',
  '..eCBBB',
  '...eCBB',
  '....eCB',
  '.....ee',
  '......e',
], false, 3), null);
S.in_buff = C(14, 14, (p) => {
  fillLit(p, [[7, 0], [13.5, 7], [9, 7], [9, 13.5], [5, 13.5], [5, 7], [0.5, 7]], ['#8f6f1a', '#c9a227', '#f0d27a', '#fff3c4'], { lx: 0.45, ly: 0.4 });
  p.line(7, 1, 2, 6, '#fff3c4'); p.line(6, 8, 6, 12, '#f0d27a');
  p.px(11, 12, '#e8a33a'); p.px(12, 10, '#c4501e'); p.px(2, 11, '#e8a33a');
});
S.in_debuff = C(14, 14, (p) => {
  fillLit(p, [[5, 0.5], [9, 0.5], [9, 7], [13.5, 7], [7, 13.5], [0.5, 7], [5, 7]], ['#253318', '#3d5226', '#5c7a2a', '#8fae3a', '#c4dc68'], { lx: 0.45, ly: 0.4 });
  p.line(6, 1, 6, 6, '#c4dc68'); p.px(2, 7, '#8fae3a'); p.px(12, 3, '#5c7a2a'); p.px(1, 11, '#3d5226'); p.px(12, 11, '#5c7a2a');
  p.px(7, 12, '#253318');
});
S.in_strongdebuff = MR(14, 14, [
  '....bbbbbb....',
  '..bbvvvvvvbb..',
  '.bvvvvvvvvvvG.',
  '.bvvvvvvvvvvG.',
  'bvvv000vv000vG',
  'bvvv0S0vv0S0vG',
  'bvvv000vv000vG',
  '.bvvvvv00vvvG.',
  '..bvvvvvvvvG..',
  '...bvbvbvbvG..',
  '...G.G.G.G.G..',
  '..............',
  '..............',
  '..............',
], null);
S.in_unknown = MR(14, 14, [
  '....888888....',
  '...88888888...',
  '..888....888..',
  '..88......88..',
  '..........88..',
  '.........888..',
  '........888...',
  '.......888....',
  '......88......',
  '......88......',
  '..............',
  '......88......',
  '......88......',
  '..............',
], { 8: '#cfc6b0' });
S.in_sleep = C(14, 14, (p) => {
  const Z = (x, y, w, h, t, c1, c2) => {
    p.rect(x, y, w, t, c1); p.rect(x, y + h - t, w, t, c2);
    p.line(x + w - 1, y + t - 1, x, y + h - t, c1, t);
  };
  Z(1, 6, 8, 7, 2, '#b49ad6', '#7b5aa6');
  Z(8, 0, 5, 5, 1, '#e2d6f2', '#b49ad6');
  p.px(12, 10, '#7b5aa6'); p.px(12, 11, '#4b3b5e');
});
S.in_summon = C(14, 14, (p) => {
  p.ellipse(7, 11, 6.4, 2.6, '#4b3b5e'); p.ellipse(7, 11, 5.4, 1.8, '#1a1423'); p.ring(7, 11, 6.4, '#9a78c8', 1);
  p.ellipse(7, 11, 6.4, 2.6, [154, 120, 200, 0]);
  for (const [x, y] of [[2, 11], [12, 11], [7, 9], [7, 13]]) p.px(x, y, '#b49ad6');
  p.ellipse(7, 5, 3.2, 3, '#cfc6b0'); p.rect(5, 7, 4, 3, '#cfc6b0');
  p.ellipse(5.7, 5, 0.9, 1.1, '#0b0a0d'); p.ellipse(8.3, 5, 0.9, 1.1, '#0b0a0d'); p.px(7, 7, '#0b0a0d');
  p.px(6, 9, '#57535c'); p.px(8, 9, '#57535c');
  p.px(3, 3, '#b49ad6'); p.px(11, 2, '#e2d6f2'); p.px(12, 5, '#b49ad6'); p.px(2, 7, '#7b5aa6');
});
S.in_flee = C(14, 14, (p) => {
  fillLit(p, [[13.5, 7], [7, 1.5], [7, 4.8], [4, 4.8], [4, 9.2], [7, 9.2], [7, 12.5]], ['#545a63', '#8e98a3', '#bccfd9', '#eef6f6'], { lx: 0.4, ly: 0.4 });
  p.line(0, 5, 2, 5, '#8e98a3'); p.line(0, 7, 3, 7, '#545a63'); p.line(1, 9, 3, 9, '#8e98a3');
  p.px(8, 3, '#eef6f6');
});
S.in_heal = C(14, 14, (p) => {
  fillLit(p, [[5, 0.5], [9, 0.5], [9, 5], [13.5, 5], [13.5, 9], [9, 9], [9, 13.5], [5, 13.5], [5, 9], [0.5, 9], [0.5, 5], [5, 5]], ['#253318', '#3d5226', '#5c7a2a', '#8fae3a', '#c4dc68'], { lx: 0.4, ly: 0.4, bias: 0.05 });
  p.line(6, 1, 6, 4, '#c4dc68'); p.line(1, 6, 4, 6, '#c4dc68'); p.px(6, 6, '#eaf5b0');
  p.px(12, 1, '#c4dc68'); p.px(1, 12, '#8fae3a');
});
S.in_special = MR(14, 14, [
  '..............',
  '....666666....',
  '..6688888866..',
  '.668888888866.',
  '6688NNNNNN8866',
  '688NNN00NNN886',
  '688NN0w00NN886',
  '688NN0000NN886',
  '6688NN00NN8866',
  '.668NNNNNN866.',
  '..6688888866..',
  '....666666....',
  '..............',
  '..............',
], { 6: '#4b3b5e', 8: '#cfc6b0', N: '#b5536b', w: '#fbf3df', 0: '#0b0a0d' });

// =================================================================== MAP ICONS (16×16)
S.map_fight = C(16, 16, (p) => {
  const blade = (tx, ty, gx, gy, hx, hy, hi) => {
    p.line(tx, ty, gx, gy, '#545a63', 3); p.line(tx, ty, gx, gy, '#8e98a3', 2); p.line(tx + hi, ty - 1, gx + hi, gy - 1, '#eef6f6', 1);
    p.px(tx - Math.sign(gx - tx), ty - 1, '#eef6f6');
    const gdx = -(hy - gy), gdy = hx - gx; // perpendicular
    const L = Math.hypot(gdx, gdy) || 1;
    p.line(Math.round(gx - (gdx / L) * 3), Math.round(gy - (gdy / L) * 3), Math.round(gx + (gdx / L) * 3), Math.round(gy + (gdy / L) * 3), '#c9a227', 2);
    p.line(Math.round(gx - (gdx / L) * 3), Math.round(gy - (gdy / L) * 3 - 1), Math.round(gx + (gdx / L) * 3), Math.round(gy + (gdy / L) * 3 - 1), '#f0d27a', 1);
    p.line(gx + Math.sign(hx - gx), gy + Math.sign(hy - gy), hx, hy, '#6e5039', 2);
    p.px(hx + Math.sign(hx - gx), hy + Math.sign(hy - gy), '#c9a227'); p.px(hx, hy, '#8f6f1a');
  };
  blade(14, 1, 5, 10, 1, 13, -1);
  blade(1, 1, 10, 10, 14, 13, 1);
});
S.map_elite = C(16, 16, (p) => {
  const R = ['#3a0b10', '#8a1c1c', '#b8302a', '#e0644c'];
  const horn = (s) => { const pts = []; for (let t = 0; t <= 1; t += 0.06) pts.push([8 + s * (4.2 + Math.sin(t * 2.2) * 2.8 + t * 0.2), 7 - t * 6.4 + (t * t) * 0.2, 1.7 * (1 - t) + 0.6]); tube(p, pts, s < 0 ? R : R.map((c) => c), { k: 1 }); };
  horn(-1); horn(1);
  ball(p, 8, 9.2, 5.1, ['#57535c', '#79747a', '#a19c9c', '#cfc6b0', '#e8dcc0'], 4.7);
  p.rect(5, 12, 6, 3, '#a19c9c'); p.rect(5, 12, 1, 3, '#cfc6b0'); p.rect(10, 12, 1, 3, '#79747a');
  p.ellipse(6, 9.4, 1.5, 1.7, '#0b0a0d'); p.ellipse(10, 9.4, 1.5, 1.7, '#0b0a0d');
  p.px(6, 9, '#e8a33a'); p.px(10, 9, '#e8a33a'); p.px(6, 10, '#c4501e'); p.px(10, 10, '#c4501e');
  p.px(8, 11, '#0b0a0d'); p.px(7, 12, '#16131a'); p.px(9, 12, '#16131a');
  p.px(7, 14, '#16131a'); p.px(9, 14, '#16131a');
});
S.map_event = C(16, 16, (p) => {
  fillLit(p, [[2, 1.6], [5, 1.2], [9, 2], [14, 1.4], [14.4, 6], [13.6, 10], [14.4, 14.4], [9, 13.8], [5, 14.6], [1.6, 14], [2.4, 9], [1.6, 5]], ['#6e5039', '#977049', '#c29a68', '#e8dcc0', '#fbf3df'], { lx: 0.3, ly: 0.35, bias: 0.12 });
  pix(p, [
    '.####.',
    '##..##',
    '....##',
    '...##.',
    '..##..',
    '..##..',
    '......',
    '..##..',
    '..##..',
  ], { '#': '#5e1212' }, 5, 3);
  p.px(5, 4, '#8a1c1c'); p.px(6, 3, '#8a1c1c');
});
S.map_rest = C(16, 16, (p) => {
  p.ellipse(8, 14.4, 7, 1.4, '#2c1e16');
  p.line(2, 14, 13, 11, '#2c1e16', 3); p.line(2, 13, 13, 10, '#6e5039', 2); p.line(2, 12, 12, 10, '#977049', 1);
  p.line(3, 11, 14, 14, '#4a3527', 3); p.line(3, 10, 14, 13, '#6e5039', 2); p.line(4, 10, 13, 12, '#977049', 1);
  p.ellipse(2.2, 12.8, 1.2, 1.5, '#4a3527'); p.ellipse(13.8, 12.8, 1.2, 1.5, '#2c1e16');
  p.poly([[8, 0.5], [10.6, 4], [12, 7.5], [11, 11], [8, 12], [5, 11], [4, 7.5], [5.4, 5], [6.4, 6.4], [7, 3]], '#c4501e');
  p.poly([[8, 4], [10, 7.5], [9.6, 10.6], [8, 11.4], [6.4, 10.4], [6, 7.6], [7.2, 6.4]], '#e8a33a');
  p.poly([[8, 7], [9, 9.4], [8, 11], [7, 9.4]], '#fff3c4');
  p.px(12, 3, '#e8a33a'); p.px(3, 5, '#c4501e'); p.px(13, 6, '#f0d27a'); p.px(4, 2, '#e8a33a');
});
S.map_shop = C(16, 16, (p) => {
  S.rl_pouch.draw(p, { c: '#8a5a34' });
  const coin = (x, y) => { p.ellipse(x, y + 0.5, 2.8, 1.5, '#8f6f1a'); p.ellipse(x, y, 2.8, 1.5, '#c9a227'); p.ellipse(x - 0.3, y - 0.2, 1.6, 0.7, '#f0d27a'); };
  coin(12.6, 14.3); coin(13.2, 12.6); coin(3.2, 14.6);
  p.px(2, 11, '#c9a227');
});
S.map_treasure = C(16, 16, (p) => {
  const W = ['#2c1e16', '#4a3527', '#6e5039', '#977049', '#c29a68'];
  fillLit(p, [[1.5, 8], [14.5, 8], [14.5, 14.5], [1.5, 14.5]], W, { lx: 0.3, ly: 0.4, bias: -0.1 });
  fillLit(p, [[1.5, 8.6], [1.5, 5.5], [3.6, 2.6], [8, 1.6], [12.4, 2.6], [14.5, 5.5], [14.5, 8.6]], W, { lx: 0.35, ly: 0.45, bias: 0.12 });
  for (const x of [4, 10]) { cyl(p, x, 2, 2, 13, ['#8f6f1a', '#c9a227', '#f0d27a']); }
  p.rect(1, 8, 14, 1, '#16131a'); p.rect(1, 14, 14, 1, '#16131a');
  p.rect(6, 7, 4, 4, '#8f6f1a'); p.rect(6, 7, 4, 1, '#f0d27a'); p.rect(7, 8, 2, 2, '#c9a227'); p.px(8, 9, '#0b0a0d'); p.px(8, 10, '#0b0a0d');
  p.px(3, 4, '#fbf3df'); p.px(2, 5, '#f0d27a'); p.px(12, 3, '#f0d27a');
});
S.map_boss = C(16, 16, (p) => {
  const G = ['#5e4612', '#8f6f1a', '#c9a227', '#f0d27a', '#fff3c4'];
  fillLit(p, [[1, 10], [1.4, 2.2], [4.6, 6.4], [6, 4.4], [8, 0.8], [10, 4.4], [11.4, 6.4], [14.6, 2.2], [15, 10]], G, { bias: 0.05 });
  cyl(p, 1, 9, 14, 6, G, false); p.rect(1, 9, 14, 1, G[4]); p.rect(1, 14, 14, 1, G[0]);
  ball(p, 8, 7.4, 3.9, ['#57535c', '#79747a', '#a19c9c', '#cfc6b0', '#e8dcc0'], 3.6);
  p.rect(6, 9, 4, 3, '#a19c9c'); p.rect(6, 9, 1, 3, '#cfc6b0');
  p.rect(5, 6, 2, 2, '#0b0a0d'); p.rect(9, 6, 2, 2, '#0b0a0d'); p.px(5, 6, '#e0644c'); p.px(10, 6, '#e0644c');
  p.px(8, 9, '#0b0a0d'); p.px(7, 11, '#16131a'); p.px(9, 11, '#16131a');
  for (const [x, y] of [[3, 11], [8, 12.4], [13, 11]]) circ(p, x, y, 0.9, '#8a1c1c');
});
// =================================================================== UI ICONS
S.ui_energy = C(14, 14, (p) => {
  ball(p, 7, 7, 6, ['#1f1405', '#4a3510', '#8f6f1a', '#c9a227']);
  p.ring(7, 7, 6.2, '#0b0a0d', 1);
  p.poly([[9, 1.6], [3.4, 7.8], [6.6, 7.8], [5, 12.6], [10.8, 6], [7.6, 6]], '#8f6f1a');
  p.poly([[8.6, 2.4], [4.4, 7.2], [7.2, 7.2], [6, 11], [9.8, 6.6], [7.2, 6.6]], '#fff3c4');
  p.px(3, 3, '#f0d27a'); p.px(2, 4, '#c9a227');
});
S.ui_gold = C(12, 12, (p) => {
  circ(p, 6, 6, 5.5, '#8f6f1a'); circ(p, 6, 6, 4.8, '#c9a227');
  fillLit(p, [[1.6, 6], [3, 3], [6, 1.4], [9, 3], [10.4, 6], [9, 9], [6, 10.6], [3, 9]], ['#c9a227', '#f0d27a', '#fff3c4'], { bias: -0.1 });
  p.ring(6, 6, 5.5, '#5e4612', 1); p.ring(6, 6, 3.4, '#8f6f1a', 1);
  p.rect(5, 4, 2, 4, '#8f6f1a'); p.px(5, 4, '#fff3c4'); p.px(3, 3, '#fff3c4');
});
S.ui_hp = C(12, 12, (p) => {
  shader(p, 0, 0, 11, 11, (x, y) => {
    const X = (x + 0.5 - 6) / 5.4, Y = -(y + 0.5 - 6) / 5.4 + 0.1;
    if (Math.pow(X * X + Y * Y - 0.62, 3) - X * X * Y * Y * Y > 0) return null;
    return lit(['#3a0b10', '#5e1212', '#8a1c1c', '#b8302a', '#e0644c'], sphere(X * 0.9, -Y * 0.9 - 0.05), x, y, 0.25);
  });
  p.px(3, 2, '#fbf3df'); p.px(2, 3, '#f0a090');
});
S.ui_block = MR(12, 12, sym([
  '.eeeee',
  'eCCCCC',
  'eCDCCB',
  'eCCCBB',
  'eCCBBB',
  'eCBBBB',
  '.eCBBB',
  '.eCBBB',
  '..eCBB',
  '...eCB',
  '....ee',
  '......',
], false, 2), null);
const CARD = (p, x, y, w, h, border = '#c9a227', face = '#3a2f4a', gem) => {
  p.rect(x, y, w, h, '#0b0a0d'); p.rect(x, y, w, h, border); p.rect(x + 1, y + 1, w - 2, h - 2, face);
  p.rect(x + 1, y + 1, w - 2, 1, '#4b3b5e'); p.rect(x, y, w, 1, '#f0d27a');
  if (gem) { p.rect(x + (w >> 1) - 1, y + (h >> 1) - 1, 2, 2, gem); }
};
S.ui_deck = C(14, 14, (p) => {
  CARD(p, 5, 0, 8, 11, '#8f6f1a', '#2b2135');
  CARD(p, 3, 1, 8, 11, '#a98820', '#33283f');
  CARD(p, 1, 3, 8, 11, '#c9a227', '#3a2f4a', '#e0644c');
  p.px(2, 4, '#fff3c4');
});
S.ui_draw = C(14, 14, (p) => {
  CARD(p, 0, 5, 7, 9, '#8f6f1a', '#2b2135'); CARD(p, 1, 4, 7, 9, '#c9a227', '#3a2f4a', '#7fd1c4');
  p.poly([[11, 0], [14, 5], [8, 5]], '#cff5ec'); p.rect(10, 5, 2, 7, '#7fd1c4'); p.rect(10, 5, 1, 7, '#cff5ec'); p.rect(11, 5, 1, 7, '#3f8a80');
});
S.ui_discard = C(14, 14, (p) => {
  CARD(p, 0, 0, 7, 9, '#8f6f1a', '#2b2135'); CARD(p, 1, 1, 7, 9, '#c9a227', '#3a2f4a');
  p.rect(10, 1, 2, 7, '#b8302a'); p.rect(10, 1, 1, 7, '#e0644c'); p.rect(11, 1, 1, 7, '#8a1c1c');
  p.poly([[11, 13], [14, 8], [8, 8]], '#e0644c');
  p.rect(0, 12, 7, 2, '#57535c'); p.rect(0, 12, 7, 1, '#a19c9c');
});
S.ui_exhaust = C(14, 14, (p) => {
  CARD(p, 2, 4, 9, 10, '#5e4612', '#241f2b');
  p.poly([[2, 7], [4, 5.6], [5, 8], [7, 5], [8.6, 7.4], [10, 5.4], [11, 7.5], [11, 9], [2, 9]], '#0b0a0d');
  p.poly([[6.5, 0], [9, 3.6], [10.4, 6.4], [9.4, 9.4], [6.5, 10.4], [3.6, 9.2], [3, 6.4], [4.4, 4], [5.2, 5.2]], '#c4501e');
  p.poly([[6.5, 3.6], [8.4, 6.6], [8, 9], [6.5, 9.6], [5, 8.6], [4.8, 6.6], [5.8, 5.6]], '#e8a33a');
  p.poly([[6.5, 6.4], [7.4, 8.2], [6.5, 9.2], [5.6, 8.2]], '#fff3c4');
  p.px(11, 2, '#79747a'); p.px(12, 0, '#57535c'); p.px(1, 3, '#79747a');
});
S.ui_map = C(16, 16, (p) => { S.rl_map.draw(p, { c: '#d8c9a0' }); });
S.ui_settings = C(14, 14, (p) => {
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8, w = 0.28;
    p.poly([[7 + Math.cos(a - w) * 4.2, 7 + Math.sin(a - w) * 4.2], [7 + Math.cos(a - w * 0.75) * 6.7, 7 + Math.sin(a - w * 0.75) * 6.7], [7 + Math.cos(a + w * 0.75) * 6.7, 7 + Math.sin(a + w * 0.75) * 6.7], [7 + Math.cos(a + w) * 4.2, 7 + Math.sin(a + w) * 4.2]], '#8e98a3');
  }
  ball(p, 7, 7, 5, ['#33373e', '#545a63', '#8e98a3', '#bccfd9', '#eef6f6']);
  p.eraseEllipse(7, 7, 2, 2);
  p.ring(7, 7, 2.4, '#33373e', 1);
});
S.ui_potion_empty = {
  w: 12, h: 16, outline: false, rim: false,
  draw(p) {
    const m = [];
    for (let y = 0; y < 16; y++) { m[y] = []; for (let x = 0; x < 12; x++) { const body = Math.hypot(x + 0.5 - 6, y + 0.5 - 10.4) <= 5.2; const neck = x >= 4 && x <= 7 && y >= 2 && y <= 6; const lip = x >= 3 && x <= 8 && y === 1; const cork = x >= 4 && x <= 7 && y === 0; m[y][x] = body || neck || lip || cork; } }
    for (let y = 0; y < 16; y++) for (let x = 0; x < 12; x++) {
      if (!m[y][x]) continue;
      const edge = !(m[y - 1] && m[y - 1][x]) || !(m[y + 1] && m[y + 1][x]) || !m[y][x - 1] || !m[y][x + 1];
      if (edge) { if ((x + y) % 3 !== 2) p.px(x, y, '#7a757f'); }
      else p.px(x, y, [150, 144, 160, 34]);
    }
    p.px(3, 9, [200, 195, 210, 90]); p.px(3, 10, [200, 195, 210, 90]);
  },
};
S.ui_chronicle = C(14, 14, (p) => {
  p.rect(3, 1, 10, 12, '#e8dcc0'); p.rect(12, 2, 1, 10, '#a19c9c');
  cyl(p, 1, 0, 11, 13, ['#2c0a14', '#5e1f3d', '#7a2a4a', '#9a3a5a'], false);
  p.rect(1, 0, 3, 13, '#3a0b20'); p.rect(1, 0, 1, 13, '#5e1f3d'); p.line(4, 0, 4, 12, '#16131a');
  p.rect(6, 3, 5, 5, '#3a0b20'); p.rect(7, 4, 3, 3, '#c9a227'); p.px(8, 5, '#3a0b20'); p.px(7, 4, '#fff3c4');
  p.rect(1, 0, 3, 2, '#c9a227'); p.rect(1, 11, 3, 2, '#8f6f1a'); p.rect(9, 0, 2, 2, '#c9a227'); p.rect(9, 11, 2, 2, '#8f6f1a');
  p.path([[10, 13], [10, 14]], '#8a1c1c', 1);
});
S.ui_back = C(12, 12, (p) => {
  fillLit(p, [[0.5, 6], [5.6, 0.8], [5.6, 4], [11.5, 4], [11.5, 8], [5.6, 8], [5.6, 11.2]], ['#79747a', '#a19c9c', '#cfc6b0', '#fbf3df'], { lx: 0.4, ly: 0.4 });
  p.line(5, 2, 2, 5, '#fbf3df');
});
S.ui_lock = C(12, 14, (p) => {
  p.ring(6, 5.4, 3.7, '#33373e', 2); p.ring(6, 5.4, 3.7, '#8e98a3', 1); p.rect(2, 5, 8, 3, '#0b0a0d');
  p.rect(2, 5, 1, 4, '#8e98a3'); p.rect(9, 5, 1, 4, '#545a63');
  fillLit(p, [[1, 7], [11, 7], [11, 13.5], [1, 13.5]], ['#5e4612', '#8f6f1a', '#c9a227', '#f0d27a'], { lx: 0.4, ly: 0.4 });
  p.rect(1, 7, 10, 1, '#f0d27a');
  circ(p, 6, 9.8, 1.3, '#16131a'); p.rect(5, 10, 2, 2, '#16131a');
});
S.ui_star = C(14, 14, (p) => {
  const pts = [];
  for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, r = k % 2 ? 3 : 6.9; pts.push([7 + Math.cos(a) * r, 7.5 + Math.sin(a) * r]); }
  fillLit(p, pts, ['#5e4612', '#8f6f1a', '#c9a227', '#f0d27a', '#fff3c4'], { lx: 0.35, ly: 0.4, bias: 0.12 });
  p.px(5, 5, '#fff3c4'); p.px(6, 3, '#fff3c4'); p.px(7, 1, '#fffbe0');
});
// =================================================================== SPIRITS (14×14) & MASKS
S.sp_wisp = C(14, 14, (p) => {
  const cols = ['#24504c', '#3f8a80', '#7fd1c4', '#cff5ec', '#ffffff'];
  shader(p, 0, 0, 13, 13, (x, y) => {
    const cx = 6.6, cy = 8.6, r = 4.7, dx = x + 0.5 - cx, dy = y + 0.5 - cy;
    let ins, nx = dx / r, ny = dy / r;
    if (dy >= 0) ins = dx * dx + dy * dy <= r * r;
    else { const hw = r * Math.pow(Math.max(0, 1 + dy / 9), 1.55); ins = Math.abs(dx + dy * 0.3) <= hw; nx = hw ? (dx + dy * 0.3) / hw * 0.8 : 0; ny = dy / 9; }
    if (!ins) return null;
    return lit(cols, sphere(nx, ny) * 0.92 + 0.08, x, y, 0.35);
  });
  p.px(5, 8, '#0b0a0d'); p.px(5, 9, '#16131a'); p.px(9, 8, '#0b0a0d'); p.px(9, 9, '#16131a');
  p.px(11, 1, '#cff5ec'); p.px(12, 3, '#7fd1c4'); p.px(1, 11, '#3f8a80'); p.px(0, 13, '#24504c'); p.px(2, 13, '#24504c');
});
S.sp_warden = C(14, 14, (p) => {
  ball(p, 7, 7, 6.2, ['#16242e', '#2a4556', '#4c7890', '#7fb0c8', '#bfe0ec']);
  p.ring(7, 7, 6.4, '#0f1a22', 1);
  pix(p, ['FFFFFF', 'F0000F', 'F0000F', 'F0000F', '.F00F.', '..FF..'], { F: '#eef6f6', 0: '#16242e' }, 4, 3);
  p.rect(6, 4, 2, 4, '#7fb0c8'); p.rect(5, 5, 4, 1, '#7fb0c8');
  p.px(2, 3, '#ffffff'); p.px(11, 2, '#bfe0ec');
});
S.sp_lantern = C(14, 14, (p) => {
  p.ring(7, 1.6, 1.6, '#8e98a3', 1);
  fillLit(p, [[4.4, 3.4], [9.6, 3.4], [11, 4.8], [3, 4.8]], ['#33373e', '#545a63', '#8e98a3', '#bccfd9']);
  p.rect(3, 4, 8, 7, '#e8a33a'); p.rect(4, 5, 6, 5, '#f0d27a'); p.rect(5, 6, 4, 3, '#fff3c4');
  p.poly([[7, 5], [8.6, 7.4], [7, 9.6], [5.4, 7.4]], '#fffbe0');
  cyl(p, 3, 4, 1, 7, ['#33373e', '#545a63', '#8e98a3']); cyl(p, 10, 4, 1, 7, ['#33373e', '#545a63', '#8e98a3']);
  fillLit(p, [[2, 11], [12, 11], [11, 13.5], [3, 13.5]], ['#33373e', '#545a63', '#8e98a3', '#bccfd9']);
  p.px(1, 3, '#f0d27a'); p.px(12, 2, '#e8a33a'); p.px(13, 7, '#f0d27a'); p.px(0, 8, '#e8a33a');
});
S.sp_banshee = C(14, 14, (p) => {
  p.poly([[1.4, 3.4], [7, 0.4], [12.6, 3.4], [13.6, 13.6], [11, 10.4], [9.6, 13.6], [7, 11], [4.4, 13.6], [3, 10.4], [0.4, 13.6]], '#4b3b5e');
  p.poly([[2.6, 4], [7, 1.4], [11.4, 4], [12, 10], [10.6, 8], [9.4, 11], [7, 8.4], [4.6, 11], [3.4, 8], [2, 10]], '#7b5aa6');
  ball(p, 7, 6.4, 3.9, ['#7b5aa6', '#b49ad6', '#e2d6f2', '#fbf3df'], 4.5);
  p.poly([[4.4, 4.8], [6.4, 5.8], [6, 7], [4.4, 6.4]], '#0b0a0d'); p.poly([[9.6, 4.8], [7.6, 5.8], [8, 7], [9.6, 6.4]], '#0b0a0d');
  p.ellipse(7, 9, 1.5, 1.9, '#0b0a0d'); p.px(7, 8, '#3a0b20');
  p.px(5, 4, '#fbf3df'); p.px(0, 5, '#7b5aa6'); p.px(13, 6, '#7b5aa6');
});

defineSprites(S);
export const ICON_IDS = Object.keys(S);
