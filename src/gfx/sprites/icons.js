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
  P: 'p', B: 'A', A: 'a', N: 'n', '*': '+', '+': '#', '#': '-', '-': '=',
};

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
  p.circle(5.5, 22, 1.6, '#c9a227'); p.px(5, 21, '#fff3c4');   // pommel
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
  p.circle(16.5, 1.8, 1.7, '#c9a227'); p.px(16, 1, '#fff3c4');
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
  p.circle(16, 2.5, 1.6, '#c9a227'); p.px(15, 2, '#fff3c4');
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
  p.circle(21, 6, 4.2, '#8e98a3', { shade: 0.4 });
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
  p.circle(16, 12, 2.5, '#c9a227'); p.px(15, 11, '#fff3c4');
});
S.art_oath = art('gold', (p) => {
  p.ring(16, 10, 8, '#c9a227', 2);
  p.ring(16, 10, 8, '#f0d27a', 1);
  p.rect(15, 8, 3, 13, '#bccfd9'); p.rect(15, 8, 1, 13, '#eef6f6'); p.rect(17, 8, 1, 13, '#8e98a3');
  p.px(16, 21, '#8e98a3'); p.px(16, 22, '#545a63');
  p.rect(10, 6, 13, 2, '#c9a227'); p.rect(10, 6, 13, 1, '#f0d27a');
  p.rect(15, 2, 3, 4, '#6e5039');
  p.circle(16.5, 1.5, 1.5, '#c9a227');
  p.poly([[12, 9], [21, 7], [22, 10], [13, 12]], '#8a1c1c');
  p.line(13, 9, 21, 8, '#b8302a');
  p.poly([[12, 11], [14, 12], [11, 17], [10, 15]], '#8a1c1c');
  p.poly([[20, 10], [22, 10], [24, 15], [22, 16]], '#5e1212');
}, { gy: 10, fx: (p) => bloom(p, 16, 10, 5, '#fff3c4', 40) });
S.art_banner = art('ember', (p) => {
  p.rect(8, 2, 2, 22, '#6e5039'); p.rect(8, 2, 1, 22, '#977049');
  p.circle(9, 1.5, 1.5, '#c9a227');
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
  p.circle(16, 15, 2.6, '#c9a227'); p.circle(16, 15, 1.6, '#0b0a0d');
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
  p.circle(13, 7.5, 1.4, '#c4dc68'); p.circle(19, 7, 1.1, '#8fae3a'); p.px(12, 7, '#f0f8c0');
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
  p.circle(19, 4, 1, '#cfc6b0'); p.circle(12, 8, 1, '#e8dcc0');
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
  p.circle(16, 11, 3, '#f0d27a'); p.circle(16, 11, 1.6, '#fbf3df');
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
  const drop = (cx, cy, r) => shader(p, Math.floor(cx - r - 1), Math.floor(cy - r * 2.4), Math.ceil(cx + r), Math.ceil(cy + r), (x, y) => {
    const dy = y + 0.5 - cy, dx = x + 0.5 - cx;
    let ins, nx = dx / r, ny = dy / r;
    if (dy >= 0) ins = dx * dx + dy * dy <= r * r;
    else { const hw = r * Math.pow(Math.max(0, 1 + dy / (r * 2.3)), 1.5); ins = Math.abs(dx) <= hw; nx = hw ? dx / hw * 0.8 : 0; ny = dy / (r * 2.3); }
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
    if (t < 0.2) return lit(['#6e5039', '#977049', '#c29a68'], 0.5 - dx / hw * 0.4, x, y);
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

// ---- status samples
S.st_might = M(10, 10, [
  '...ZZ.....',
  '..Zkk.....',
  '..Zkk.....',
  '.ZZkZ..ZZ.',
  '.ZkkZ.Zkk.',
  'ZkkkkZkkkZ',
  'ZkkkkkkkkZ',
  'zZkkkkkkZz',
  '.zzZZZZzz.',
  '..zzzzzz..',
]);
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

defineSprites(S);
export const ICON_IDS = Object.keys(S);
