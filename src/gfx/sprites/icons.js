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
S.art_axe = art('ember', (p) => {
  diagUR(p, 6, 22, 15, ['#977049', '#6e5039', '#4a3527']);     // haft
  p.poly([[16, 3], [24, 1], [28, 7], [26, 14], [20, 13], [18, 9]], '#8e98a3', { shade: 0.35 });
  p.path([[24, 1], [28, 7], [26, 14]], '#eef6f6', 1);         // edge
  p.rect(17, 7, 3, 4, '#545a63');
  p.px(18, 8, '#c9a227');
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
  pix(p, sym([
    '....zZ',
    '....Zk',
    '....56',
    '....47',
    '...457',
    '..4567',
    '.45679',
    '4567vv',
    '4bvvvv',
    '4Gbvbv',
    '4GbbbH',
    '4MGbbb',
    '.4MGGb',
    '..4444',
  ], true, 3), null, 10, 4);
});
// ---- crown
S.art_crown = art('gold', (p) => {
  pix(p, sym([
    '..I......I',
    '.Ie.....Ie',
    '.Ie....IeI',
    '.IeI..IeeI',
    '.IeeIIeeeI',
    '.IeeeeeeeI',
    'IeYeeeeeIi',
    'IjYjYjYj00',
    'IeeeeeeI00',
    'IIIIIIIiii',
  ], false, 4), null, 6, 6);
});
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
