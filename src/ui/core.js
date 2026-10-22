// Core UI helpers: element builder, press handling, shared UI state, render scheduling.
import { sfx } from './sound.js';

export const UI = {
  auto: false,        // Auto button state (combat)
  g: null,            // the Game
  view: 'title',      // meta view when there is no run: title | hub | heroes | chronicle | compendium
  viewArg: null,
  dev: false,
  reduced: false,     // prefers-reduced-motion
  hold: 0,            // performance.now() until which screen switches are deferred (victory / death beats)
  hubShown: false,    // one Hob exchange per Waystone visit
  render: null,       // set by main.js
  renderNow: null,
};

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// h('div.a.b', {props}, ...children)
export function h(tag, props, ...kids) {
  const parts = tag.split('.');
  const el = document.createElement(parts[0] || 'div');
  if (parts.length > 1) el.className = parts.slice(1).join(' ');
  if (props && (typeof props !== 'object' || props.nodeType || Array.isArray(props))) { kids.unshift(props); props = null; }
  if (props) {
    for (const k in props) {
      const v = props[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = (el.className ? el.className + ' ' : '') + v;
      else if (k === 'style') { if (typeof v === 'string') el.style.cssText = v; else for (const s in v) { if (s.startsWith('--')) el.style.setProperty(s, v[s]); else el.style[s] = v[s]; } }
      else if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'onTap') tap(el, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
  }
  append(el, kids);
  return el;
}

function append(el, kids) {
  for (const c of kids) {
    if (c == null || c === false || c === true) continue;
    if (Array.isArray(c)) append(el, c);
    else el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
}

export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Tap handler with click sound and suppression after long-press.
export function tap(el, fn, opts = {}) {
  el.classList.add('pressable');
  el.addEventListener('click', (ev) => {
    if (el._lpFired) { el._lpFired = false; ev.preventDefault(); return; }
    if (el.disabled || el.classList.contains('disabled')) { if (opts.onDisabled) opts.onDisabled(ev); else sfx('error'); return; }
    if (opts.sound !== false) sfx(opts.sound || 'click');
    fn(ev);
  });
  return el;
}

// Long-press (and optionally tap) → callback. Used for info tooltips.
export function longPress(el, fn, ms = 420) {
  let t = null, sx = 0, sy = 0;
  el.addEventListener('pointerdown', (e) => {
    sx = e.clientX; sy = e.clientY;
    clearTimeout(t);
    t = setTimeout(() => { el._lpFired = true; fn(e); setTimeout(() => { el._lpFired = false; }, 600); }, ms);
  });
  const cancel = () => clearTimeout(t);
  el.addEventListener('pointerup', cancel);
  el.addEventListener('pointercancel', cancel);
  el.addEventListener('pointerleave', cancel);
  el.addEventListener('pointermove', (e) => { if (Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) > 10) cancel(); });
  el.addEventListener('contextmenu', (e) => e.preventDefault());
  return el;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function pickRandom(arr) { return arr && arr.length ? arr[Math.floor(Math.random() * arr.length)] : null; }

export const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

export function cap(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }

export function fmtTime(ms) {
  const s = Math.max(0, Math.floor((ms || 0) / 1000));
  const hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60;
  return hh ? `${hh}h ${String(mm).padStart(2, '0')}m` : `${mm}m ${String(ss).padStart(2, '0')}s`;
}

// Safe accessor helpers (content arrives in parallel and may be partial).
export function safe(fn, fallback) { try { const v = fn(); return v === undefined ? fallback : v; } catch (e) { return fallback; } }

// ---- speed & view settings -------------------------------------------------
// Effective animation speed 1|2|3 (legacy `fast` counts as 2).
export function speedOf() {
  const st = UI.g && UI.g.meta && UI.g.meta.settings;
  if (!st) return 1;
  return Math.max(st.speed || 1, st.fast ? 2 : 1);
}
// Multiplier applied to every pause and animation (1x is already a little snappier than the old pacing).
export function timeMul() { return [1, 0.78, 0.45, 0.27][speedOf()] ?? 1; }
// Simple view (declutter) is the default.
export function isSimple() {
  const st = UI.g && UI.g.meta && UI.g.meta.settings;
  return !st || st.simple !== false;
}

// Animate with WAAPI if available; resolves when done. Honors reduced motion by shortening.
export function anim(el, frames, opts) {
  if (!el || !el.animate) return Promise.resolve();
  const o = typeof opts === 'number' ? { duration: opts } : { ...opts };
  if (UI.reduced) o.duration = Math.min(o.duration || 200, 120);
  if (!o.exact) o.duration = Math.max(60, (o.duration || 200) * timeMul());
  if (o.delay) o.delay *= timeMul();
  delete o.exact;
  try {
    const a = el.animate(frames, { easing: 'ease-out', fill: 'none', ...o });
    return a.finished.catch(() => {});
  } catch (e) { return Promise.resolve(); }
}
