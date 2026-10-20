// Sprite helpers for the DOM: cached data URLs with graceful fallbacks.
import { SPRITES, spriteCanvas } from '../gfx/sprite.js';

const cache = new Map(); // key -> {url, w, h}

export const hasSprite = (id) => !!(id && SPRITES[id]);

export function sprInfo(id, opts) {
  const key = (id || 'missing') + (opts ? JSON.stringify(opts) : '');
  let v = cache.get(key);
  if (v) return v;
  let c = null;
  try { c = spriteCanvas(SPRITES[id] ? id : 'missing', opts); } catch (e) {
    console.warn('sprite failed:', id, e && e.message);
    try { c = spriteCanvas('missing'); } catch (e2) { c = null; }
  }
  if (c) v = { url: c.toDataURL(), w: c.width, h: c.height, missing: !SPRITES[id] };
  else v = { url: '', w: 16, h: 16, missing: true };
  cache.set(key, v);
  return v;
}

export const sprURL = (id, opts) => sprInfo(id, opts).url;

// <img> showing a sprite at an integer-ish scale (design px).
export function spr(id, scale = 2, cls = '', opts) {
  const s = sprInfo(id, opts);
  const img = document.createElement('img');
  img.className = 'px ' + cls;
  img.src = s.url;
  img.alt = '';
  img.draggable = false;
  img.width = Math.round(s.w * scale);
  img.height = Math.round(s.h * scale);
  img.style.width = img.width + 'px';
  img.style.height = img.height + 'px';
  return img;
}

// Sprite sized to fit a box (w x h design px), keeping aspect.
export function sprFit(id, w, h, cls = '', opts) {
  const s = sprInfo(id, opts);
  const k = Math.min(w / s.w, h / s.h);
  return spr(id, k, cls, opts);
}

// CSS background value for a backdrop sprite (bg_*), with a gradient fallback.
export function bgStyle(id, fallback) {
  if (!hasSprite(id)) return fallback || 'radial-gradient(ellipse at 50% 30%, #2a2430 0%, #141117 60%, #0b0a0d 100%)';
  return `url(${sprURL(id)}) center / cover no-repeat`;
}

export function relicIcon(relicDef, scale = 1.5, cls = '') {
  if (!relicDef) return spr('missing', scale, cls);
  return spr('rl_' + relicDef.icon, scale, cls, relicDef.tint ? { c: relicDef.tint } : undefined);
}

export function potionIcon(potionDef, scale = 1.5, cls = '') {
  if (!potionDef) return spr('ui_potion_empty', scale, cls);
  return spr('pt_' + potionDef.icon, scale, cls, potionDef.color ? { c: potionDef.color } : undefined);
}

// Icon or a tiny text glyph fallback when the art team has not drawn it yet.
export function icon(id, scale = 1, cls = '', glyph) {
  if (!hasSprite(id) && glyph) {
    const s = document.createElement('span');
    s.className = 'glyph ' + cls;
    s.textContent = glyph;
    return s;
  }
  return spr(id, scale, cls);
}
