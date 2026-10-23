// Helpers for pose frames (hero_<id>_atk/_cast/_guard/_hurt, en_<id>_atk/_hurt).
// A pose keeps its base sprite's w/h and foot baseline; the body above the feet
// is shifted per row band (lean / crouch) and limbs + weapons are re-posed.
import { PAL, mix } from './sprite.js';

// Wrap a painter so everything drawn through it is offset by off(y) -> [dx, dy]
// (integers). Points (poly/path/line/tri vertices) are offset individually, so a
// shape spanning several bands slants (a lean); centred primitives (ellipse,
// rect, px, glow...) move rigidly with the band of their centre, which keeps
// faces and small details crisp.
export function xf(p, off) {
  const O = (x, y) => { const d = off(y); return [x + d[0], y + d[1]]; };
  const W = new Proxy(p, {
    get(t, k) {
      if (k === 'at') return (y) => xf(p, () => off(y)); // rigid group at row y
      if (k === 'off') return off;
      const v = t[k];
      if (typeof v !== 'function') return v;
      switch (k) {
        case 'poly': return (pts, ...a) => (t.poly(pts.map(([x, y]) => O(x, y)), ...a), W);
        case 'path': return (pts, ...a) => (t.path(pts.map(([x, y]) => O(x, y)), ...a), W);
        case 'line': return (x1, y1, x2, y2, ...a) => { const A = O(x1, y1), B = O(x2, y2); t.line(A[0], A[1], B[0], B[1], ...a); return W; };
        case 'tri': return (x1, y1, x2, y2, x3, y3, ...a) => { const A = O(x1, y1), B = O(x2, y2), C = O(x3, y3); t.tri(A[0], A[1], B[0], B[1], C[0], C[1], ...a); return W; };
        case 'rect': return (x, y, w, h, ...a) => { const d = off(y + h / 2); t.rect(x + d[0], y + d[1], w, h, ...a); return W; };
        case 'erase': return (x, y, w = 1, h = 1) => { const d = off(y + h / 2); t.erase(x + d[0], y + d[1], w, h); return W; };
        case 'speckle': return (c, dn, s, r) => {
          if (!r) t.speckle(c, dn, s);
          else { const d = off((r[1] + r[3]) / 2); t.speckle(c, dn, s, [r[0] + d[0], r[1] + d[1], r[2] + d[0], r[3] + d[1]]); }
          return W;
        };
        case 'ellipse': case 'circle': case 'glow': case 'ring': case 'px': case 'eraseEllipse':
          return (x, y, ...a) => { const d = off(y); t[k](x + d[0], y + d[1], ...a); return W; };
        default: return (...a) => (v.apply(t, a), W);
      }
    },
  });
  return W;
}

// Row bands: bands([[yEnd, dx, dy], ...], [dx, dy]) -> off(y). The first band
// whose yEnd is greater than y wins; rows below every band get the fallback.
export function bands(list, rest = [0, 0]) {
  return (y) => { for (const b of list) if (y < b[0]) return [b[1], b[2]]; return rest; };
}

// Smooth lean: control rows [[y, dx, dy], ...] (ascending y), linearly
// interpolated and rounded; rows above the first / below the last are clamped.
export function lean(pts) {
  return (y) => {
    if (y <= pts[0][0]) return [pts[0][1], pts[0][2]];
    for (let i = 1; i < pts.length; i++) if (y <= pts[i][0]) {
      const [y0, x0, v0] = pts[i - 1], [y1, x1, v1] = pts[i], t = (y - y0) / (y1 - y0);
      return [Math.round(x0 + (x1 - x0) * t), Math.round(v0 + (v1 - v0) * t)];
    }
    const l = pts[pts.length - 1]; return [l[1], l[2]];
  };
}

// Rotate/scale helpers for limbs and weapons.
export const deg = (a) => (a * Math.PI) / 180;
export const polar = (cx, cy, r, a) => [cx + Math.cos(deg(a)) * r, cy + Math.sin(deg(a)) * r];

// Motion smear: a crescent along an ellipse (rx, ry) around (cx, cy), sweeping
// from angle a0 (the thin tail) to a1 (the thick head, where the weapon is),
// th pixels thick at the head. Degrees: 0 = right, 90 = down. Meant for the fx
// layer (def.fx): a soft translucent body plus a bright core along the outer rim.
export function smear(p, cx, cy, rx, ry, th, a0, a1, col = '#eef3f6', o = {}) {
  const n = Math.max(8, Math.ceil(Math.abs(a1 - a0) / 4));
  const outer = [], inner = [], core = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = deg(a0 + (a1 - a0) * t);
    const w = Math.max(0.6, th * Math.pow(t, o.taper ?? 0.8));
    const c = Math.cos(a), s = Math.sin(a);
    outer.push([cx + c * rx, cy + s * ry]);
    inner.unshift([cx + c * (rx - w), cy + s * (ry - w)]);
    core.unshift([cx + c * (rx - w * 0.45), cy + s * (ry - w * 0.45)]);
  }
  p.poly(outer.concat(inner), withAlpha(col, o.alpha ?? 0x70));
  p.poly(outer.concat(core), withAlpha(o.core || '#ffffff', o.coreAlpha ?? 0xe0));
  return p;
}

// Soft light (fx layer): radial alpha falloff + hot core.
export function bloom(p, x, y, col, r = 5, a = 150) {
  const c = typeof col === 'string' ? hexRGB(col) : col;
  for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) {
    const d = Math.hypot(xx, yy);
    if (d > r) continue;
    const k = Math.pow(1 - d / (r + 0.5), 1.6);
    p.px(x + xx, y + yy, [c[0], c[1], c[2], Math.round(a * k)]);
  }
  p.px(x, y, '#fffbe8');
  return p;
}

// Translucent copy of a colour (alpha 0-255); <= 96 stays see-through.
export function withAlpha(col, a) {
  const c = typeof col === 'string' ? hexRGB(col) : col;
  return [c[0], c[1], c[2], a];
}
function hexRGB(h) {
  h = h.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

// A 4-point twinkle (opaque core + translucent arms).
export function twinkle(p, x, y, col = PAL.candle, r = 1) {
  p.px(x, y, '#fff6dc');
  for (let i = 1; i <= r; i++) {
    const c = i === 1 ? col : withAlpha(col, 0x58);
    p.px(x - i, y, c).px(x + i, y, c).px(x, y - i, c).px(x, y + i, c);
  }
  return p;
}

// Speed lines (translucent streaks) trailing behind a moving part.
export function streaks(p, pts, col = '#e9eef2', a = 0x50) {
  for (const [x1, y1, x2, y2] of pts) p.line(x1, y1, x2, y2, withAlpha(col, a));
  return p;
}

// Soft magic aura: stacked translucent glows (never opaque, so no outline).
export function aura(p, x, y, col, r = 5) {
  p.glow(x, y, col, Math.min(7, r));
  if (r > 3) p.glow(x, y, mix(col, '#ffffff', 0.35), Math.max(2, r - 3));
  return p;
}
