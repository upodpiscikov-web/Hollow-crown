// Pixel-art FX sprites for combat (slashes, claws, projectiles, rings, bubbles...), drawn in code
// at low resolution and cached as data URLs. Shown as <img class="px"> scaled by whole-ish factors so
// they sit with the game's pixel art. Workstream A (combat VFX) owns this file.

const cache = new Map();

function hex(c) {
  const v = parseInt(c.slice(1), 16);
  return c.length === 4 ? [((v >> 8) & 15) * 17, ((v >> 4) & 15) * 17, (v & 15) * 17] : [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

// Build (once) a w x h sprite. draw(px, w, h) where px(x, y, color, alpha=1).
function make(key, w, h, draw) {
  let v = cache.get(key);
  if (v) return v;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  const d = img.data;
  const px = (x, y, col, a = 1) => {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= w || y >= h || a <= 0) return;
    const [r, g, b] = hex(col);
    const i = (y * w + x) * 4;
    d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = Math.max(d[i + 3], Math.round(Math.min(1, a) * 255));
  };
  try { draw(px, w, h); } catch (e) { /* never break combat over a sprite */ }
  ctx.putImageData(img, 0, 0);
  v = { url: c.toDataURL(), w, h };
  cache.set(key, v);
  return v;
}

const disc = (px, cx, cy, r, col, a = 1) => {
  for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px(x, y, col, a);
};
const line = (px, x0, y0, x1, y1, col, a = 1, th = 1) => {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2 + 1;
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
    if (th <= 1) px(x, y, col, a); else disc(px, x, y, th / 2, col, a);
  }
};

const ART = {
  // Sword-swing crescent, thick on the right, fading toward the top tip (swing goes top → bottom).
  slash: (col = '#f0d27a', edge = '#ffffff') => make('slash' + col + edge, 40, 40, (px) => {
    const cx = 18, cy = 20, R = 18, cx2 = 12.5;
    for (let y = 0; y < 40; y++) for (let x = 0; x < 40; x++) {
      const d1 = Math.hypot(x - cx, y - cy), d2 = Math.hypot(x - cx2, y - cy);
      if (d1 > R || d2 <= R - 1) continue;
      const ang = Math.atan2(y - cy, x - cx); // -pi/2 top .. pi/2 bottom
      const a = Math.max(0, Math.min(1, 0.15 + 0.85 * ((ang + Math.PI / 2) / Math.PI)));
      const t = R - d1;
      px(x, y, t < 1.4 ? edge : t < 3 ? '#fff6d8' : col, a * (t < 3 ? 1 : 0.85));
    }
  }),
  // Three raking claw marks (top-right to bottom-left).
  claw: (col = '#ff4a3a') => make('claw' + col, 30, 30, (px) => {
    for (let k = 0; k < 3; k++) {
      const ox = k * 7;
      for (let i = 0; i <= 22; i++) {
        const t = i / 22, x = 25 - ox + -16 * t, y = 2 + ox * 0.35 + 25 * t;
        const th = Math.sin(t * Math.PI) * 2.2 + 0.4;
        disc(px, x, y, th, '#4a0c0c', 0.9);
      }
      for (let i = 0; i <= 22; i++) {
        const t = i / 22, x = 25 - ox + -16 * t, y = 2 + ox * 0.35 + 25 * t;
        const th = Math.sin(t * Math.PI) * 1.4;
        disc(px, x, y, th, col);
        if (t > 0.2 && t < 0.8) px(x, y, '#ffd8c8');
      }
    }
  }),
  // Jaws: a row of teeth pointing down (top) or up (bottom).
  jaw: (up = false) => make('jaw' + up, 26, 9, (px) => {
    for (let x = 0; x < 26; x++) for (let y = 0; y < 3; y++) px(x, up ? 8 - y : y, '#5a1414');
    for (let t = 0; t < 6; t++) {
      const x0 = 1 + t * 4;
      for (let y = 0; y < 6; y++) {
        const half = Math.max(0, 2 - Math.floor(y / 2));
        for (let x = x0 + 2 - half; x <= x0 + 2 + half - (y > 3 ? 1 : 0); x++) px(x, up ? 8 - (y + 1) : y + 1, y === 0 ? '#c8bfa8' : '#f4ecd8');
      }
    }
  }),
  // Throwing knife pointing right.
  knife: () => make('knife', 15, 5, (px) => {
    for (let x = 0; x < 4; x++) { px(x, 2, '#3a2418'); px(x, 1, '#5a3a24'); }
    px(4, 0, '#c9a227'); px(4, 1, '#c9a227'); px(4, 2, '#8a6a17'); px(4, 3, '#8a6a17'); px(4, 4, '#c9a227');
    for (let x = 5; x < 14; x++) { px(x, 1, '#ffffff'); px(x, 2, '#c8d0d8'); if (x < 13) px(x, 3, '#8e98a3'); }
    px(14, 2, '#ffffff');
  }),
  // Arrow pointing right.
  arrow: () => make('arrow', 22, 5, (px) => {
    for (let x = 4; x < 18; x++) px(x, 2, '#7a5a3a');
    for (let x = 0; x < 5; x++) { px(x, 1, x % 2 ? '#e8dcc0' : '#a02e2e'); px(x, 3, x % 2 ? '#e8dcc0' : '#a02e2e'); }
    px(18, 1, '#c8d0d8'); px(18, 2, '#ffffff'); px(18, 3, '#c8d0d8'); px(19, 1, '#8e98a3'); px(19, 2, '#ffffff'); px(19, 3, '#8e98a3'); px(20, 2, '#ffffff'); px(21, 2, '#c8d0d8');
    px(18, 0, '#8e98a3'); px(18, 4, '#8e98a3');
  }),
  // Rot glob: green blob with highlight and a drip.
  glob: () => make('glob', 11, 11, (px) => {
    disc(px, 5, 5, 4.6, '#2e3e14');
    disc(px, 5, 5, 3.8, '#6a8a2a');
    disc(px, 4.4, 4.4, 2.6, '#8fae3a');
    disc(px, 3.5, 3.5, 1, '#d8e88a');
    px(6, 9, '#6a8a2a'); px(6, 10, '#2e3e14');
  }),
  // Glowing orb (magic, ash, choir): white core, coloured body, soft halo.
  orb: (col = '#b49ad6', halo = '#7b5aa6') => make('orb' + col + halo, 13, 13, (px) => {
    disc(px, 6, 6, 6.2, halo, 0.35);
    disc(px, 6, 6, 4.6, halo, 0.85);
    disc(px, 6, 6, 3.6, col);
    disc(px, 5.5, 5.5, 1.8, '#ffffff');
  }),
  // Spirit wisp pointing right: bright head with a tapering tail.
  wisp: (col = '#7fd1c4') => make('wisp' + col, 16, 9, (px) => {
    for (let x = 0; x < 11; x++) { const r = (x / 11) * 2.6; disc(px, x, 4 + Math.sin(x * 0.9) * 0.8, r, col, 0.35 + 0.5 * (x / 11)); }
    disc(px, 11.5, 4, 3.4, col);
    disc(px, 12, 4, 2.1, '#e8fff8');
    px(12, 4, '#ffffff');
  }),
  // Thin pixel ring.
  ring: (col = '#e8dcc0', size = 48, th = 2) => make('ring' + col + size + th, size, size, (px) => {
    const c = (size - 1) / 2, R = c - 0.5;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const d = Math.hypot(x - c, y - c); if (d <= R && d > R - th) px(x, y, col, d > R - 1 ? 1 : 0.7); }
  }),
  // Rune circle: double ring, tick marks and dots.
  rune: (col = '#f0d27a') => make('rune' + col, 41, 41, (px) => {
    const c = 20;
    for (let y = 0; y < 41; y++) for (let x = 0; x < 41; x++) {
      const d = Math.hypot(x - c, y - c);
      if (d <= 20 && d > 19) px(x, y, col);
      if (d <= 15 && d > 14.2) px(x, y, col, 0.7);
    }
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      line(px, c + Math.cos(a) * 15, c + Math.sin(a) * 15, c + Math.cos(a) * 19, c + Math.sin(a) * 19, col);
      const b = a + Math.PI / 8;
      px(c + Math.cos(b) * 17, c + Math.sin(b) * 17, '#ffffff');
    }
    for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2 - Math.PI / 2; line(px, c + Math.cos(a) * 14, c + Math.sin(a) * 14, c + Math.cos(a + 2.094) * 14, c + Math.sin(a + 2.094) * 14, col, 0.55); }
  }),
  // Shield bubble: ellipse outline with a highlight arc and faint fill.
  bubble: (col = '#9ad4f4') => make('bubble' + col, 44, 58, (px) => {
    const cx = 21.5, cy = 28.5, rx = 21, ry = 28;
    for (let y = 0; y < 58; y++) for (let x = 0; x < 44; x++) {
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (d > 1) continue;
      if (d > 0.88) px(x, y, col, 0.95);
      else if (d > 0.7) px(x, y, col, 0.28);
      else px(x, y, col, 0.1);
    }
    for (let a = 3.5; a < 4.6; a += 0.04) px(cx + Math.cos(a) * (rx - 4), cy + Math.sin(a) * (ry - 4), '#ffffff', 0.95);
    for (let a = 0.3; a < 0.6; a += 0.05) px(cx + Math.cos(a) * (rx - 4), cy + Math.sin(a) * (ry - 4), '#ffffff', 0.7);
  }),
  // 4-point sparkle.
  star: (col = '#fff6d8') => make('star' + col, 9, 9, (px) => {
    for (let i = 0; i < 9; i++) { const a = 1 - Math.abs(i - 4) / 5; px(4, i, col, a); px(i, 4, col, a); }
    px(4, 4, '#ffffff'); px(3, 3, col, 0.5); px(5, 5, col, 0.5); px(3, 5, col, 0.5); px(5, 3, col, 0.5);
  }),
  // Puffy cloud (plague, ash).
  cloud: (col = '#6a8a2a', hi = '#8fae3a', lo = '#3e5220') => make('cloud' + col, 34, 22, (px) => {
    const blobs = [[9, 13, 7], [17, 9, 8], [25, 13, 7], [14, 15, 6], [21, 15, 6]];
    for (const [x, y, r] of blobs) disc(px, x, y, r + 1, lo, 0.9);
    for (const [x, y, r] of blobs) disc(px, x, y, r, col);
    for (const [x, y, r] of blobs) disc(px, x - 1.5, y - 2, r * 0.55, hi);
  }),
  // Bell (Cantor's Toll), used when no art sprite exists.
  bell: () => make('bell', 20, 22, (px) => {
    for (let y = 3; y < 18; y++) { const half = 3 + (y - 3) * 0.45 + (y > 14 ? 2 : 0); for (let x = Math.round(10 - half); x <= Math.round(10 + half); x++) px(x, y, x < 10 - half + 2 ? '#8a6a17' : x > 10 + half - 2 ? '#6a4a10' : '#c9a227'); }
    for (let x = 2; x < 19; x++) px(x, 18, '#6a4a10');
    disc(px, 10, 20, 1.6, '#4a3a14');
    for (let x = 8; x <= 12; x++) px(x, 2, '#6a4a10'); px(9, 1, '#6a4a10'); px(11, 1, '#6a4a10'); px(10, 0, '#6a4a10');
    for (let y = 5; y < 15; y++) px(8, y, '#f0d27a', 0.9);
  }),
  // Pale noose loop / ash mote etc. could go here.
};

export function fxArt(kind, ...args) {
  const f = ART[kind] || ART.star;
  return f(...args);
}

// <img> for an FX sprite at a scale (design px per sprite px).
export function fxImg(kind, scale = 2, args = []) {
  const s = fxArt(kind, ...args);
  const img = document.createElement('img');
  img.className = 'px vx';
  img.src = s.url;
  img.alt = '';
  img.draggable = false;
  const w = Math.round(s.w * scale), hh = Math.round(s.h * scale);
  img.style.width = w + 'px';
  img.style.height = hh + 'px';
  img._w = w; img._h = hh;
  return img;
}
