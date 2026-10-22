// Visual effects: a single particle canvas that only runs while particles are
// alive, floating numbers, flashes and shakes (transform/opacity only).
import { h, UI, anim, timeMul } from './core.js';
import { S, stageRect } from './scale.js';

// ------------------------------------------------------------------ particles
const P = { cv: null, ctx: null, list: [], raf: 0, w: 0, h: 0 };

export function initParticles() {
  P.cv = document.getElementById('particles');
  P.ctx = P.cv.getContext('2d');
  const size = () => {
    P.w = P.cv.width = Math.ceil(window.innerWidth / 2);
    P.h = P.cv.height = Math.ceil(window.innerHeight / 2);
  };
  size();
  window.addEventListener('resize', size);
}

function step() {
  const { ctx, list } = P;
  ctx.clearRect(0, 0, P.w, P.h);
  const now = performance.now();
  let alive = 0;
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    const t = (now - p.t0) / p.life;
    if (t >= 1) { list.splice(i, 1); continue; }
    alive++;
    const dt = Math.min(0.05, (now - p.tl) / 1000);
    p.tl = now;
    p.vx *= p.drag; p.vy = p.vy * p.drag + p.g * dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.wob) p.x += Math.sin(now / 180 + p.ph) * p.wob * dt;
    ctx.globalAlpha = p.fade ? Math.max(0, 1 - t) : (t > 0.7 ? (1 - t) / 0.3 : 1);
    ctx.fillStyle = p.c;
    const s = p.s * (p.shrink ? 1 - t * 0.7 : 1);
    ctx.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), Math.max(1, Math.round(s)), Math.max(1, Math.round(s)));
  }
  ctx.globalAlpha = 1;
  if (alive) P.raf = requestAnimationFrame(step);
  else { P.raf = 0; ctx.clearRect(0, 0, P.w, P.h); }
}

// Spawn particles at a viewport point (CSS px). kind presets keep call sites short.
const PRESETS = {
  hit: { n: 10, c: ['#e8dcc0', '#c4501e', '#8a1c1c'], sp: 120, life: 450, g: 260, s: 2 },
  blood: { n: 12, c: ['#8a1c1c', '#5a1010', '#b5536b'], sp: 110, life: 600, g: 380, s: 2 },
  ash: { n: 26, c: ['#5d5a5e', '#9e9a9c', '#342c3b', '#d8cfb8'], sp: 70, life: 1300, g: -30, s: 2, wob: 30, drag: 0.97 },
  ember: { n: 16, c: ['#e8a33a', '#c4501e', '#f0d27a'], sp: 80, life: 900, g: -90, s: 2, wob: 20 },
  bubbles: { n: 10, c: ['#8fae3a', '#b8d45a', '#5c7a2a'], sp: 30, life: 900, g: -70, s: 2, wob: 25 },
  heal: { n: 14, c: ['#b8d45a', '#e8dcc0', '#8fae3a'], sp: 40, life: 900, g: -80, s: 2, wob: 15 },
  block: { n: 10, c: ['#b9d3e0', '#8e98a3', '#e8dcc0'], sp: 90, life: 450, g: 0, s: 2, drag: 0.9 },
  gold: { n: 16, c: ['#c9a227', '#f0d27a', '#e8a33a'], sp: 120, life: 800, g: 300, s: 2 },
  spirit: { n: 14, c: ['#7fd1c4', '#a9c6c2', '#e8dcc0'], sp: 90, life: 800, g: -40, s: 2, wob: 20 },
  violet: { n: 14, c: ['#b49ad6', '#7b5aa6', '#e8dcc0'], sp: 100, life: 700, g: -20, s: 2 },
  spark: { n: 12, c: ['#f0d27a', '#e8dcc0'], sp: 150, life: 500, g: 120, s: 2 },
  burn: { n: 20, c: ['#e8a33a', '#c4501e', '#5d5a5e', '#f0d27a'], sp: 50, life: 900, g: -110, s: 2, wob: 30 },
  dust: { n: 30, c: ['#d8cfb8', '#9e9a9c', '#e8dcc0', '#5d5a5e'], sp: 90, life: 1200, g: -20, s: 2, wob: 30, drag: 0.96 },
};

export function particles(x, y, kind = 'hit', opts = {}) {
  if (!P.ctx) return;
  const pr = { ...(PRESETS[kind] || PRESETS.hit), ...opts };
  let n = pr.n;
  if (UI.reduced) n = Math.ceil(n / 3);
  if (P.list.length > 400) return;
  const now = performance.now();
  const sx = x / 2, sy = y / 2; // canvas is half resolution
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = pr.sp * (0.3 + Math.random() * 0.7) / 2;
    P.list.push({
      x: sx + (pr.w ? (Math.random() - 0.5) * pr.w / 2 : 0), y: sy + (pr.hgt ? (Math.random() - 0.5) * pr.hgt / 2 : 0),
      vx: Math.cos(a) * v, vy: Math.sin(a) * v - (pr.up || 0) / 2,
      g: pr.g / 2, drag: pr.drag || 0.985, c: pr.c[i % pr.c.length], s: pr.s * (Math.random() < 0.3 ? 1.5 : 1),
      life: pr.life * (0.6 + Math.random() * 0.6), t0: now, tl: now, wob: pr.wob || 0, ph: Math.random() * 6, shrink: true,
    });
  }
  if (!P.raf) P.raf = requestAnimationFrame(step);
}

// Particles over an element's area.
export function particlesOn(el, kind, opts = {}) {
  if (!el || !el.getBoundingClientRect) return;
  const r = el.getBoundingClientRect();
  if (!r.width) return;
  particles(r.left + r.width / 2, r.top + r.height * (opts.at ?? 0.5), kind, { w: r.width * (opts.spread ?? 0.6), hgt: r.height * (opts.vspread ?? 0.5), ...opts });
}

// ------------------------------------------------------------------ floating numbers
const recent = new WeakMap(); // anchor element → {t, n}

// Show a floating label above an element (stage coordinates). kind: dmg|blocked|block|heal|rot|hploss|buff|debuff|info|gold
export function floatText(el, text, kind = 'dmg', opts = {}) {
  const fx = document.getElementById('fx');
  if (!fx || !el || !el.isConnected) return;
  const r = stageRect(el);
  if (!r.w) return;
  const now = performance.now();
  const rec = recent.get(el);
  let k = 0;
  if (rec && now - rec.t < 450) k = rec.n + 1;
  recent.set(el, { t: now, n: k });
  const delay = Math.min(k, 5) * 120 * timeMul();
  const big = opts.big || (kind === 'dmg' && +text >= 20);
  const d = h('div.float.' + kind + (big ? '.big' : ''), String(text));
  const jitter = ((k % 3) - 1) * 14;
  d.style.left = (r.cx + jitter + (opts.dx || 0)) + 'px';
  d.style.top = (r.y + r.h * (opts.at ?? 0.35)) + 'px';
  d.style.opacity = '0';
  fx.appendChild(d);
  const dur = kind === 'buff' || kind === 'debuff' || kind === 'info' ? 1300 : 1000;
  setTimeout(() => {
    d.style.opacity = '';
    anim(d, [
      { transform: 'translate(-50%, 0) scale(.6)', opacity: 0 },
      { transform: 'translate(-50%, -16px) scale(1.15)', opacity: 1, offset: 0.15 },
      { transform: 'translate(-50%, -26px) scale(1)', opacity: 1, offset: 0.7 },
      { transform: 'translate(-50%, -40px) scale(.95)', opacity: 0 },
    ], { duration: dur, easing: 'ease-out' }).then(() => d.remove());
  }, delay);
}

// ------------------------------------------------------------------ flashes & shakes
export function shake(el, strength = 6, ms = 320) {
  if (!el || UI.reduced) return;
  const s = strength;
  anim(el, [
    { transform: 'translate(0,0)' }, { transform: `translate(${-s}px, ${s * 0.3}px)` }, { transform: `translate(${s * 0.8}px, ${-s * 0.3}px)` },
    { transform: `translate(${-s * 0.5}px, 0)` }, { transform: `translate(${s * 0.3}px, 0)` }, { transform: 'translate(0,0)' },
  ], { duration: ms, easing: 'linear' });
}

export function screenShake(strength = 8) {
  const g = UI.g;
  if (!g || !g.meta.settings.shake || UI.reduced) return;
  const el = document.querySelector('.shake-root');
  if (el) shake(el, strength, 380);
}

export function flash(el, ms = 220) {
  if (!el) return;
  anim(el, [{ opacity: 0 }, { opacity: 0.9, offset: 0.25 }, { opacity: 0 }], { duration: ms, easing: 'ease-out' });
}

export function pulse(el, scale = 1.25, ms = 300) {
  if (!el) return;
  anim(el, [{ transform: 'scale(1)' }, { transform: `scale(${scale})` }, { transform: 'scale(1)' }], { duration: ms, easing: 'ease-out' });
}

export function screenFlash(color = '#fff', ms = 300) {
  const fx = document.getElementById('fx');
  if (!fx) return;
  const d = h('div.screen-flash', { style: { background: color } });
  fx.appendChild(d);
  anim(d, [{ opacity: 0.0 }, { opacity: 0.55, offset: 0.2 }, { opacity: 0 }], ms).then(() => d.remove());
}

// Fly a small ghost element from one point to another (stage coords), e.g. card to pile.
export function flyGhost(fromEl, toEl, cls = 'ghost-card', ms = 380) {
  const fx = document.getElementById('fx');
  if (!fx || !fromEl || !toEl) return Promise.resolve();
  const a = stageRect(fromEl), b = stageRect(toEl);
  if (!a.w || !b.w) return Promise.resolve();
  const g = h('div.' + cls);
  g.style.left = a.cx + 'px';
  g.style.top = a.cy + 'px';
  fx.appendChild(g);
  return anim(g, [
    { transform: 'translate(-50%,-50%) scale(1)', opacity: 0.95 },
    { transform: `translate(calc(-50% + ${b.cx - a.cx}px), calc(-50% + ${b.cy - a.cy}px)) scale(.4)`, opacity: 0.2 },
  ], { duration: ms, easing: 'cubic-bezier(.5,0,.6,1)' }).then(() => g.remove());
}

export const stageW = () => S.W;
