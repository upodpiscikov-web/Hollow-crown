// Story presentation (workstream B): event text → beats, choice labels → outcome chips,
// a quick typewriter, speech bubbles / captions, a beat player (tap to complete / advance),
// Ken Burns scene art and a cheap ambient particle canvas (ash, fog, rain, embers, ...).
// Everything here honours settings.speed (speedOf / timeMul) and reduced motion (UI.reduced).
import { HEROES } from '../engine/registry.js';
import { spriteCanvas } from '../gfx/sprite.js';
import { h, UI, speedOf, timeMul, cap, safe } from './core.js';
import { hasSprite, spr, sprFit, icon } from './gfx.js';
import { inline, smart, prose } from './text.js';
import { S } from './scale.js';
import { modal } from './overlay.js';
import { sfx } from './sound.js';

// ------------------------------------------------------------------ speakers
const NAMES = {
  hob: 'Hob', pell: 'Pell', peddler: 'The Pale Peddler', crane: 'Crane', maren: 'Queen Maren', grall: 'Grall',
  crown: 'The Crown', mother: 'Mother', narrator: '',
};

export const speakerKey = (who) => String(who || '').toLowerCase().replace(/^(npc|portrait|hero)_/, '');

// Sprite id for a speaker: hero id → portrait_<id>, npc id → npc_<id>, a full sprite id as is.
export function speakerSprite(who) {
  if (!who || who === 'narrator') return null;
  if (/^(npc|portrait)_/.test(who) && hasSprite(who)) return who;
  const k = speakerKey(who);
  if (HEROES[k]) return hasSprite('portrait_' + k) ? 'portrait_' + k : null;
  if (hasSprite('npc_' + k)) return 'npc_' + k;
  return null;
}

export function speakerName(who) {
  const k = speakerKey(who);
  if (HEROES[k]) return HEROES[k].name.split(' ')[0];
  if (NAMES[k] != null) return NAMES[k];
  return k.split(/[_-]+/).map(cap).join(' ');
}

export const isHeroSpeaker = (who) => !!HEROES[speakerKey(who)];

// ------------------------------------------------------------------ beats
const SPEAK_RE = /^@([a-z][\w-]*)\s*:\s*/i;
const words = (s) => (String(s).trim().match(/\S+/g) || []).length;

// Split a long paragraph at sentence ends, never inside quotes or *italics*.
function sentences(s) {
  const out = [];
  let depth = 0, stars = 0, start = 0;
  const q = (ch) => {
    if (ch === '“') depth++;
    else if (ch === '”') depth = Math.max(0, depth - 1);
    else if (ch === '"') depth = depth ? 0 : 1;
    else if (ch === '*') stars++;
  };
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    q(ch);
    if (!/[.!?…]/.test(ch)) continue;
    let j = i + 1;
    while (j < s.length && /["'”’)\]*_]/.test(s[j])) { q(s[j]); j++; }
    if (j < s.length && /\s/.test(s[j]) && depth === 0 && stars % 2 === 0) { out.push(s.slice(start, j).trim()); start = j; }
    i = j - 1;
  }
  const tail = s.slice(start).trim();
  if (tail) out.push(tail);
  return out;
}

function chunk(s, target) {
  const parts = sentences(s);
  const out = [];
  let cur = '';
  for (const p of parts) {
    if (cur && words(cur) + words(p) > target) { out.push(cur); cur = p; } else cur = cur ? cur + ' ' + p : p;
  }
  if (cur) {
    if (out.length && words(cur) < 9) out[out.length - 1] += ' ' + cur;
    else out.push(cur);
  }
  return out;
}

// text (string) → [{ who, text }]. Blank lines separate beats; "@who:" marks speech.
// Old long paragraphs (> maxWords) are chunked into ~chunkWords-word beats so nothing is a wall.
export function splitBeats(text, opts = {}) {
  const raw = String(text ?? '').replace(/\r/g, '').trim();
  if (!raw) return [];
  const maxWords = opts.maxWords ?? 46, target = opts.chunkWords ?? 34;
  const out = [];
  for (const para of raw.split(/\n\s*\n/)) {
    let p = para.trim();
    if (!p) continue;
    let who = null;
    const m = SPEAK_RE.exec(p);
    if (m) { who = m[1].toLowerCase(); p = p.slice(m[0].length).trim(); }
    if (who === 'narrator') who = null;
    const parts = words(p) > maxWords ? chunk(p, target) : [p];
    parts.forEach((t, i) => out.push({ who, text: t, cont: i > 0 }));
  }
  return out;
}

// Plain text of a page (for "Read all" when there is no `long`): markers become "Name:".
export function beatsToProse(beats) {
  return beats.map((b) => (b.who ? `**${speakerName(b.who)}:** ${b.text}` : b.text)).join('\n\n');
}

// Strip one pair of enclosing quotes from a pure line of speech ("…" → …).
export function unquote(t) {
  const s = String(t).trim();
  const m = /^["“]([^"“”]+)["”]$/.exec(s);
  return m ? m[1].trim() : s;
}

// ------------------------------------------------------------------ outcome chips
// Canonical phrases from ANIMATION.md contract 2 → icon chips.
const NUMW = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, all: 'all' };
const num = (s) => (s == null ? 1 : /^\d+$/.test(s) ? +s : NUMW[String(s).toLowerCase()] ?? s);
const CHIP_RULES = [
  [/^lose (\d+%?) max(?:imum)? hp$/i, (m) => ({ k: 'maxhp', n: m[1], neg: true })],
  [/^gain (\d+%?) max(?:imum)? hp$/i, (m) => ({ k: 'maxhp', n: m[1] })],
  [/^(?:lose|take|suffer) (\d+%?) (?:hp|health|damage)$/i, (m) => ({ k: 'hp', n: m[1], neg: true })],
  [/^heal (\d+%?)(?: hp| health)?$/i, (m) => ({ k: 'heal', n: m[1] })],
  [/^(?:heal to full|fully heal|heal all(?: your)? hp)$/i, () => ({ k: 'heal', n: 'all' })],
  [/^gain (\d+) gold$/i, (m) => ({ k: 'gold', n: m[1] })],
  [/^lose (\d+) gold$/i, (m) => ({ k: 'gold', n: m[1], neg: true })],
  [/^lose all(?: your)? gold$/i, () => ({ k: 'gold', n: 'all', neg: true })],
  [/^(?:obtain|gain|take|receive) (?:a|an|1|the) (?:random )?(?:(common|uncommon|rare|boss|special|shop) )?relic\b/i, (m) => ({ k: 'relic', tier: m[1] })],
  [/^(?:obtain|gain|take|receive) (a|an|\d+|two|three) (?:random )?tinctures?\b/i, (m) => ({ k: 'potion', n: num(m[1]) })],
  [/^(?:choose|pick) (?:a|an|1) (?:(rare|uncommon|common|upgraded|colorless|neutral) )?card\b/i, (m) => ({ k: 'card', choose: true, tier: m[1] })],
  [/^(?:obtain|gain|add|receive) (?:a|an|1|the) .*?\bcard\b/i, () => ({ k: 'card' })],
  [/^remove (a|an|\d+|two|three) cards?\b/i, (m) => ({ k: 'remove', n: num(m[1]) })],
  [/^upgrade (a|an|\d+|two|three|all) (?:random )?(?:of your )?(?:\w+ )?cards?\b/i, (m) => ({ k: 'upgrade', n: num(m[1]) })],
  [/^transform (a|an|\d+|two|three) cards?\b/i, (m) => ({ k: 'transform', n: num(m[1]) })],
  [/^(?:gain|become|receive|obtain|take)\b.*\bcurse/i, (m, s) => {
    const nm = /[—–-]\s*([A-Z][\w' ]+)$/.exec(s) || /\(([^)]+)\)/.exec(s);
    return { k: 'curse', name: nm ? nm[1].trim() : '' };
  }],
  [/^fight\b/i, () => ({ k: 'fight' })],
  [/^(?:learn|hear|discover)\b/i, (m, s) => ({ k: 'lore', text: s })],
];

const CHIP_VIEW = {
  hp: (c) => ({ ic: 'ui_hp', gl: '♥', txt: `−${c.n}`, cls: 'neg', title: `Lose ${c.n} HP` }),
  heal: (c) => ({ ic: 'ui_hp', gl: '♥', txt: c.n === 'all' ? 'Full' : `+${c.n}`, cls: 'pos', title: 'Heal' }),
  maxhp: (c) => ({ ic: 'ui_hp', gl: '♥', txt: `${c.neg ? '−' : '+'}${c.n} Max`, cls: c.neg ? 'neg' : 'pos', title: 'Max HP' }),
  gold: (c) => ({ ic: 'ui_gold', gl: '●', txt: c.n === 'all' ? '−All' : `${c.neg ? '−' : '+'}${c.n}`, cls: c.neg ? 'neg' : 'gold', title: 'Gold' }),
  relic: (c) => ({ ic: 'ui_relics', gl: '✦', txt: c.tier === 'boss' ? 'Boss relic' : 'Relic', cls: 'gold', title: 'Obtain a relic' }),
  potion: (c) => ({ ic: 'pt_flask_round', gl: '⚗', txt: c.n > 1 ? `Tincture ×${c.n}` : 'Tincture', cls: 'pos', title: 'Obtain a Tincture' }),
  card: (c) => ({ ic: 'ui_deck', gl: '▤', txt: c.choose ? (c.tier === 'rare' ? 'Rare card' : 'Card') : '+Card', cls: 'pos', title: c.choose ? 'Choose a card' : 'Obtain a card' }),
  remove: (c) => ({ ic: 'ui_exhaust', gl: '✕', txt: c.n > 1 ? `Remove ×${c.n}` : 'Remove', cls: 'pos', title: 'Remove a card' }),
  upgrade: (c) => ({ ic: 'ui_star', gl: '✦', txt: c.n === 'all' ? 'Upgrade all' : c.n > 1 ? `Upgrade ×${c.n}` : 'Upgrade', cls: 'pos', title: 'Upgrade a card' }),
  transform: (c) => ({ ic: null, gl: '⟳', txt: 'Transform', cls: 'neu', title: 'Transform a card' }),
  curse: (c) => ({ ic: 'st_skull', gl: '☠', txt: c.name ? `Curse: ${c.name}` : 'Curse', cls: 'curse', title: 'Gain a Curse' }),
  fight: () => ({ ic: 'map_fight', gl: '⚔', txt: 'Fight', cls: 'neg', title: 'Fight' }),
  lore: (c) => ({ ic: 'ui_chronicle', gl: '✐', txt: c.text.length > 30 ? 'Lore' : c.text, cls: 'lore', title: c.text }),
};

// "Lose 5 HP. Gain 45 Gold." → [{k:'hp',...},{k:'gold',...}]; unknown sentences → {k:'text'}.
export function parseOutcomes(text) {
  const s = smart(String(text ?? '')).replace(/\s+/g, ' ').trim();
  if (!s) return [];
  const parts = s.split(/(?<=[.!;])\s+(?=[A-Z“"(*])/).map((x) => x.replace(/[.;]+$/, '').trim()).filter(Boolean);
  const out = [];
  for (const p of parts) {
    const clean = p.replace(/^\(|\)$/g, '').replace(/\*/g, '');
    let hit = null;
    for (const [re, fn] of CHIP_RULES) { const m = re.exec(clean); if (m) { hit = fn(m, clean); break; } }
    out.push(hit || { k: 'text', text: p });
  }
  return out;
}

export function chipEl(c) {
  if (c.k === 'text') return h('span.oc.oc-text', { html: inline(c.text, true) });
  const v = CHIP_VIEW[c.k](c);
  const ic = v.ic && hasSprite(v.ic) ? spr(v.ic, v.ic.startsWith('ui_') || v.ic.startsWith('st_') ? 1.25 : 1, 'oc-ic') : h('span.oc-gl', v.gl);
  return h('span.oc.oc-' + c.k + '.' + v.cls, { title: v.title }, ic, h('span.oc-t', v.txt));
}

// Choice label → { verb, main, chips }. "[Cut them down] Lose 5 HP. Gain 45 Gold." or plain labels.
export function choiceParts(label) {
  const raw = String(label ?? '');
  const m = /^\s*\[([^\]]+)\]\s*(.*)$/s.exec(raw);
  let verb = m ? smart(m[1]).trim() : '';
  const chips = parseOutcomes(m ? m[2] : raw);
  // No bracketed action: the first plain sentence becomes the main label.
  if (!verb) {
    const i = chips.findIndex((c) => c.k === 'text');
    if (i >= 0) { verb = chips[i].text; chips.splice(i, 1); }
  }
  return { verb, chips };
}

export function chipsRow(chips) {
  return chips.length ? h('span.oc-row', chips.map(chipEl)) : null;
}

// ------------------------------------------------------------------ typewriter
const COST = (ch) => (/[.!?…]/.test(ch) ? 7 : /[,;:—–]/.test(ch) ? 3 : 1);

export function typeCps() {
  if (UI.reduced) return Infinity;
  const sp = speedOf();
  return sp >= 3 ? Infinity : sp === 2 ? 105 : 64;
}

// Types `html` into el. A hidden copy reserves the final size so the box never jumps.
// Returns { typing(), finish(), done: Promise }.
export function typewriter(el, html, opts = {}) {
  const ghost = h('span.tw-ghost', { html, 'aria-hidden': 'true' });
  const live = h('span.tw-live', { html });
  el.append(ghost, live);
  const nodes = [];
  const walk = (n) => { for (const c of n.childNodes) { if (c.nodeType === 3) nodes.push({ n: c, s: c.data }); else walk(c); } };
  walk(live);
  const full = nodes.map((x) => x.s).join('');
  const cum = new Float32Array(full.length + 1);
  for (let i = 0; i < full.length; i++) cum[i + 1] = cum[i] + COST(full[i]);
  let finished = false, raf = 0, shown = -1, resolve;
  const done = new Promise((r) => { resolve = r; });
  const render = (n) => {
    let left = n;
    for (const x of nodes) { const take = Math.max(0, Math.min(x.s.length, left)); if (x.n.data.length !== take) x.n.data = x.s.slice(0, take); left -= x.s.length; }
  };
  const finish = () => {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(raf);
    render(full.length);
    el.classList.add('tw-done');
    resolve();
    if (opts.onDone) opts.onDone();
  };
  const cps = opts.cps ?? typeCps();
  if (!isFinite(cps) || !full.length) { finish(); return { typing: () => false, finish, done }; }
  render(0);
  const t0 = performance.now() + (opts.delay || 0);
  let i = 0;
  const tick = (now) => {
    if (finished) return;
    if (!el.isConnected && now - t0 > 500) { finish(); return; }
    const budget = Math.max(0, (now - t0) / 1000 * cps);
    while (i < full.length && cum[i + 1] <= budget) i++;
    if (i !== shown) { render(i); shown = i; }
    if (i >= full.length) finish(); else raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return { typing: () => !finished, finish, done };
}

// ------------------------------------------------------------------ beat boxes
// One beat → caption (narration) or speech bubble. side: 'left' | 'right' | 'none' (tail direction).
export function beatBox(beat, opts = {}) {
  const speech = !!beat.who;
  const key = speakerKey(beat.who);
  const cls = ['sbeat', speech ? 'speech' : 'caption'];
  if (speech) cls.push('tail-' + (opts.side || 'left'));
  if (key === 'crown') cls.push('crown');
  if (opts.cls) cls.push(opts.cls);
  const textEl = h('div.sb-text');
  const box = h('div.' + cls.join('.'),
    speech && opts.nameTag !== false ? h('div.sb-name', speakerName(beat.who)) : null,
    textEl,
    h('div.sb-next', '▼'));
  const text = speech ? unquote(beat.text) : beat.text;
  return { el: box, textEl, html: inline(text, false) };
}

// ------------------------------------------------------------------ beat player
// Plays beats one at a time into `slot`. tap(): complete the line → next beat → onEnd().
// opts: { beats, slot, side(beat) → 'left'|'right', onBeat(beat, i, box), onEnd(), auto: () => bool,
//         dots: element, sound }
export function beatPlayer(opts) {
  const beats = opts.beats || [];
  let i = -1, tw = null, box = null, ended = false, dead = false, autoT = 0;
  const dots = opts.dots;
  if (dots) { dots.innerHTML = ''; if (beats.length > 1) beats.forEach(() => dots.appendChild(h('i'))); }
  const setDots = () => { if (dots) [...dots.children].forEach((d, j) => d.classList.toggle('on', j <= i)); };
  const scheduleAuto = () => {
    clearTimeout(autoT);
    if (dead || !opts.auto || !opts.auto()) return;
    const b = beats[i];
    const ms = (1100 + Math.min(40, words(b ? b.text : '')) * 190) * Math.max(0.45, timeMul());
    autoT = setTimeout(() => { if (!dead && !(tw && tw.typing())) api.tap(); }, ms);
  };
  const show = (j, instant) => {
    i = j;
    const b = beats[j];
    const old = box;
    if (old) {
      old.classList.add('out');
      if (UI.reduced || instant) old.remove();
      else old.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-6px)' }], { duration: 120, easing: 'ease-in' }).finished.then(() => old.remove(), () => old.remove());
    }
    const side = opts.side ? opts.side(b) : 'left';
    const bb = beatBox(b, { side, cls: opts.boxCls });
    box = bb.el;
    box.dataset.i = j;
    opts.slot.appendChild(box);
    if (!UI.reduced && !instant) {
      box.animate(b.who
        ? [{ opacity: 0, transform: `scale(.86) translate(${side === 'right' ? 10 : -10}px, 6px)` }, { opacity: 1, transform: 'scale(1.03)', offset: 0.7 }, { opacity: 1, transform: 'none' }]
        : [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: Math.max(90, 200 * timeMul()), easing: 'ease-out' });
    }
    setDots();
    if (opts.onBeat) opts.onBeat(b, j, box);
    tw = typewriter(bb.textEl, bb.html, {
      cps: instant ? Infinity : undefined, delay: instant ? 0 : 60,
      onDone: () => { if (opts.onTyped) opts.onTyped(b, j, box); if (j === beats.length - 1 && opts.autoEndOnLast) end(); else scheduleAuto(); },
    });
    if (opts.sound !== false && !instant && j > 0) sfx('page');
  };
  const end = () => {
    if (ended) return;
    ended = true;
    clearTimeout(autoT);
    if (box) box.classList.add('last');
    if (opts.onEnd) opts.onEnd();
  };
  const api = {
    get index() { return i; },
    get ended() { return ended; },
    get box() { return box; },
    start() { if (!beats.length) { end(); return; } show(0); },
    tap() {
      if (dead) return 'dead';
      clearTimeout(autoT);
      if (tw && tw.typing()) { tw.finish(); return 'complete'; }
      if (i < beats.length - 1) { show(i + 1); return 'next'; }
      if (!ended) { end(); return 'end'; }
      return 'idle';
    },
    // Jump to the last beat, fully typed, and end.
    skip() {
      if (dead) return;
      clearTimeout(autoT);
      if (!beats.length) { end(); return; }
      if (i !== beats.length - 1) show(beats.length - 1, true);
      else if (tw) tw.finish();
      end();
    },
    poke() { scheduleAuto(); },
    destroy() { dead = true; clearTimeout(autoT); if (tw) tw.finish(); },
  };
  return api;
}

// ------------------------------------------------------------------ portraits ("actors")
// A framed portrait that bobs idly; .talking while its line is typing.
export function actorEl(spriteId, opts = {}) {
  const size = opts.size || 96;
  const el = h('div.actor' + (opts.side ? '.' + opts.side : ''),
    h('div.actor-bob', h('div.actor-frame', { style: { width: size + 'px', height: size + 'px' } }, sprFit(spriteId, size - 10, size - 10, 'actor-img'))),
    opts.name ? h('div.actor-name', opts.name) : null);
  el.dataset.sprite = spriteId;
  return el;
}

// ------------------------------------------------------------------ Ken Burns scene art
const bigCache = new Map();
// Nearest-neighbour ×k copy of a sprite so compositor scaling during the pan stays crisp.
export function bigSpriteURL(id, k = 4) {
  const key = id + '@' + k;
  if (bigCache.has(key)) return bigCache.get(key);
  let url = '';
  try {
    const src = spriteCanvas(hasSprite(id) ? id : 'missing');
    const c = document.createElement('canvas');
    c.width = src.width * k; c.height = src.height * k;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, 0, 0, c.width, c.height);
    url = c.toDataURL();
  } catch (e) { url = ''; }
  bigCache.set(key, url);
  return url;
}

function hash(s) { let x = 2166136261; for (const ch of String(s)) { x ^= ch.charCodeAt(0); x = Math.imul(x, 16777619); } return (x >>> 0) / 4294967296; }

// Full-bleed scene with a slow pan / zoom. Returns { el, kb }.
export function kenBurns(spriteId, opts = {}) {
  const img = h('img.kb-img.px', { src: bigSpriteURL(spriteId, opts.k || 4), alt: '', draggable: 'false' });
  const kb = h('div.kb', img);
  const el = h('div.kb-wrap' + (opts.cls ? '.' + opts.cls : ''), kb);
  if (!UI.reduced) {
    const r = hash(opts.seed || spriteId);
    const dx = (r < 0.5 ? -1 : 1) * (1.5 + r * 2), dy = (r * 7 % 1 < 0.5 ? -1 : 1) * (1 + (r * 13 % 1) * 1.5);
    const a = `scale(${1.07 + (r * 3 % 1) * 0.03}) translate(${-dx}%, ${-dy}%)`;
    const b = `scale(${1.17 + (r * 5 % 1) * 0.05}) translate(${dx}%, ${dy}%)`;
    try { kb.animate([{ transform: a }, { transform: b }], { duration: opts.duration || 26000, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' }); } catch (e) { /* old browser */ }
  } else kb.style.transform = 'scale(1.08)';
  return { el, kb };
}

// ------------------------------------------------------------------ ambient particles
// Default ambience per scene art (when the page has no `ambient` field).
const SCENE_AMB = {
  scene_road: 'ash', scene_gibbet: 'ash', scene_village: 'fog', scene_chapel: 'candles', scene_camp: 'embers', scene_ruins: 'fog',
  scene_forest: 'spirits', scene_abbey: 'rain', scene_water: 'fog', scene_shrine: 'candles', scene_crypt: 'candles', scene_city: 'ash',
  scene_court: 'candles', scene_throne: 'ash', scene_undercroft: 'spirits', scene_market: 'ash', scene_battlefield: 'embers', scene_well: 'fog',
};
const ACT_AMB = { 1: 'ash', 2: 'rain', 3: 'ash', 4: 'spirits' };
export function ambientFor(art, act, explicit) {
  if (explicit) return explicit;
  return SCENE_AMB[art] || ACT_AMB[act] || 'ash';
}

const rnd = (a, b) => a + Math.random() * (b - a);
let glowCache = null;
function glowSprite(color, size = 32) {
  glowCache = glowCache || new Map();
  const k = color + size;
  if (glowCache.has(k)) return glowCache.get(k);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  const gr = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gr.addColorStop(0, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = gr; x.fillRect(0, 0, size, size);
  glowCache.set(k, c);
  return c;
}

const KINDS = {
  ash: { n: 34, init(p, w, hh, fresh) { p.x = rnd(0, w); p.y = fresh ? rnd(0, hh) : rnd(-10, -2); p.vx = rnd(2, 7); p.vy = rnd(5, 11); p.s = Math.random() < 0.3 ? 2 : 1; p.c = ['#9e9a9c', '#d8cfb8', '#5d5a5e', '#c4bdb0'][Math.floor(rnd(0, 4))]; p.a = rnd(0.35, 0.8); p.ph = rnd(0, 6); } },
  snow: { n: 44, init(p, w, hh, fresh) { p.x = rnd(0, w); p.y = fresh ? rnd(0, hh) : rnd(-10, -2); p.vx = rnd(-2, 3); p.vy = rnd(7, 14); p.s = Math.random() < 0.35 ? 2 : 1; p.c = '#eef0f4'; p.a = rnd(0.5, 0.95); p.ph = rnd(0, 6); } },
  blood: { n: 22, init(p, w, hh, fresh) { p.x = rnd(0, w); p.y = fresh ? rnd(0, hh) : rnd(-10, -2); p.vx = rnd(-1, 2); p.vy = rnd(6, 12); p.s = Math.random() < 0.3 ? 2 : 1; p.c = ['#8a1c1c', '#5a1010', '#b02a2a'][Math.floor(rnd(0, 3))]; p.a = rnd(0.4, 0.85); p.ph = rnd(0, 6); } },
  rain: { n: 56, init(p, w, hh, fresh) { p.x = rnd(-20, w); p.y = fresh ? rnd(0, hh) : rnd(-20, -4); p.vx = rnd(18, 26); p.vy = rnd(120, 170); p.len = rnd(4, 8); p.a = rnd(0.18, 0.4); } },
  embers: { n: 24, init(p, w, hh, fresh) { p.x = rnd(0, w); p.y = fresh ? rnd(hh * 0.3, hh) : hh + rnd(1, 8); p.vx = rnd(-3, 3); p.vy = -rnd(8, 18); p.s = Math.random() < 0.25 ? 2 : 1; p.c = ['#e8a33a', '#c4501e', '#f0d27a'][Math.floor(rnd(0, 3))]; p.a = rnd(0.5, 1); p.ph = rnd(0, 6); p.life = rnd(4, 9); p.age = fresh ? rnd(0, p.life) : 0; } },
  spirits: { n: 12, init(p, w, hh, fresh) { p.x0 = rnd(0, w); p.y0 = rnd(hh * 0.2, hh * 0.9); p.rx = rnd(8, 26); p.ry = rnd(4, 12); p.sp = rnd(0.25, 0.6); p.ph = rnd(0, 6); p.drift = rnd(-3, 3); p.a = rnd(0.45, 0.9); p.trail = []; p.c = Math.random() < 0.7 ? '#7fd1c4' : '#a9c6c2'; } },
  fog: { n: 6, init(p, w, hh, fresh) { p.x = fresh ? rnd(-w * 0.3, w) : -w * 0.45; p.y = rnd(hh * 0.35, hh * 1.0); p.vx = rnd(2.5, 6); p.r = rnd(hh * 0.35, hh * 0.7); p.a = rnd(0.07, 0.15); } },
  candles: { n: 9, init(p, w, hh, fresh) { p.x = rnd(w * 0.05, w * 0.95); p.y = rnd(hh * 0.45, hh * 0.95); p.r = rnd(6, 12); p.ph = rnd(0, 6); p.a = rnd(0.35, 0.7); p.mote = 0; } },
};

// A half-resolution canvas with a few dozen particles. Stops itself when detached.
export function ambientLayer(kind, opts = {}) {
  const cv = h('canvas.amb-cv' + (opts.cls ? '.' + opts.cls : ''), { 'aria-hidden': 'true' });
  const K = KINDS[kind];
  const api = { el: cv, kind, stop() { running = false; cancelAnimationFrame(raf); } };
  if (!K || kind === 'none' || UI.reduced) { cv.style.display = 'none'; return api; }
  const res = opts.res || 2;
  const w = Math.max(16, Math.ceil((opts.w || S.W) / res)), hh = Math.max(16, Math.ceil((opts.h || S.H) / res));
  cv.width = w; cv.height = hh;
  const ctx = cv.getContext('2d');
  const density = opts.density ?? 1;
  const n = Math.max(3, Math.round(K.n * density * Math.min(1.4, (w * hh) / (422 * 195))));
  const parts = [];
  for (let i = 0; i < n; i++) { const p = {}; K.init(p, w, hh, true); parts.push(p); }
  const motes = [];
  let raf = 0, running = true, last = performance.now(), born = last, seen = false;
  const glow = kind === 'candles' ? glowSprite('rgba(240,190,90,0.9)') : kind === 'fog' ? glowSprite('rgba(200,196,206,1)', 64) : kind === 'spirits' ? glowSprite('rgba(127,209,196,0.8)', 16) : null;
  const step = (now) => {
    if (!running) return;
    if (cv.isConnected) seen = true;
    else if (seen || now - born > 3000) { running = false; return; }
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = now / 1000;
    ctx.clearRect(0, 0, w, hh);
    for (const p of parts) {
      switch (kind) {
        case 'ash': case 'snow': case 'blood':
          p.x += (p.vx + Math.sin(t * 1.3 + p.ph) * 4) * dt; p.y += p.vy * dt;
          if (p.y > hh + 2 || p.x > w + 4) K.init(p, w, hh, false);
          ctx.globalAlpha = p.a; ctx.fillStyle = p.c; ctx.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s);
          break;
        case 'rain':
          p.x += p.vx * dt; p.y += p.vy * dt;
          if (p.y > hh + 4) K.init(p, w, hh, false);
          ctx.globalAlpha = p.a; ctx.strokeStyle = '#b9c8d8'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(Math.round(p.x) + 0.5, Math.round(p.y)); ctx.lineTo(Math.round(p.x - p.vx / p.vy * p.len) + 0.5, Math.round(p.y - p.len)); ctx.stroke();
          break;
        case 'embers': {
          p.age += dt;
          p.x += (p.vx + Math.sin(t * 2 + p.ph) * 6) * dt; p.y += p.vy * dt;
          if (p.y < -4 || p.age > p.life) K.init(p, w, hh, false);
          const fl = 0.6 + 0.4 * Math.sin(t * 9 + p.ph);
          ctx.globalAlpha = p.a * fl * Math.min(1, (p.life - p.age) / 1.2); ctx.fillStyle = p.c; ctx.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s);
          break;
        }
        case 'spirits': {
          const a = t * p.sp + p.ph;
          p.x0 += p.drift * dt;
          if (p.x0 < -30) p.x0 = w + 20; else if (p.x0 > w + 30) p.x0 = -20;
          const x = p.x0 + Math.cos(a) * p.rx, y = p.y0 + Math.sin(a * 1.7) * p.ry;
          p.trail.push(x, y); if (p.trail.length > 10) p.trail.splice(0, 2);
          const pulse = 0.6 + 0.4 * Math.sin(t * 2.2 + p.ph);
          ctx.globalAlpha = p.a * 0.35 * pulse; ctx.drawImage(glow, Math.round(x - 8), Math.round(y - 8));
          ctx.fillStyle = p.c;
          for (let k = 0; k < p.trail.length; k += 2) { ctx.globalAlpha = p.a * pulse * (k + 2) / p.trail.length * 0.5; ctx.fillRect(Math.round(p.trail[k]), Math.round(p.trail[k + 1]), 1, 1); }
          ctx.globalAlpha = p.a * pulse; ctx.fillRect(Math.round(x), Math.round(y), 2, 2);
          break;
        }
        case 'fog':
          p.x += p.vx * dt;
          if (p.x - p.r > w) K.init(p, w, hh, false);
          ctx.globalAlpha = p.a; ctx.drawImage(glow, p.x - p.r, p.y - p.r * 0.5, p.r * 2, p.r);
          break;
        case 'candles': {
          const fl = 0.7 + 0.3 * Math.sin(t * 7 + p.ph) * Math.sin(t * 3.1 + p.ph * 2);
          ctx.globalAlpha = p.a * fl; ctx.drawImage(glow, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
          ctx.globalAlpha = Math.min(1, p.a * 1.6 * fl); ctx.fillStyle = '#fff0b0'; ctx.fillRect(Math.round(p.x), Math.round(p.y) - 1, 1, 2);
          p.mote -= dt;
          if (p.mote <= 0 && motes.length < 18) { p.mote = rnd(0.8, 2.6); motes.push({ x: p.x, y: p.y - 2, vy: -rnd(4, 9), ph: rnd(0, 6), life: rnd(1.5, 3), age: 0 }); }
          break;
        }
        default: break;
      }
    }
    if (motes.length) {
      ctx.fillStyle = '#f0d27a';
      for (let k = motes.length - 1; k >= 0; k--) {
        const m = motes[k];
        m.age += dt; m.y += m.vy * dt; m.x += Math.sin(t * 2 + m.ph) * 3 * dt;
        if (m.age > m.life) { motes.splice(k, 1); continue; }
        ctx.globalAlpha = 0.8 * (1 - m.age / m.life); ctx.fillRect(Math.round(m.x), Math.round(m.y), 1, 1);
      }
    }
    ctx.globalAlpha = 1;
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return api;
}

// ------------------------------------------------------------------ misc
// Stagger-in helper for lists (rewards, choices, tiles). Skipped at speed 3 / reduced motion.
export function staggerIn(els, opts = {}) {
  if (UI.reduced || speedOf() >= 3) return;
  const from = opts.from || 'translateX(26px)';
  els.forEach((el, i) => {
    if (!el || !el.animate) return;
    try {
      el.animate([{ opacity: 0, transform: from }, { opacity: 1, transform: 'none' }],
        { duration: (opts.duration || 260) * timeMul(), delay: ((opts.delay || 0) + i * (opts.step || 70)) * timeMul(), easing: 'cubic-bezier(.2,.8,.3,1.15)', fill: 'backwards' });
    } catch (e) { /* ignore */ }
  });
}

// Card flip-in (rotateY) with a stagger.
export function flipIn(els, opts = {}) {
  if (UI.reduced || speedOf() >= 3) return;
  els.forEach((el, i) => {
    if (!el || !el.animate) return;
    try {
      el.animate([
        { opacity: 0, transform: 'perspective(600px) translateY(18px) rotateY(95deg) scale(.85)' },
        { opacity: 1, transform: 'perspective(600px) translateY(-4px) rotateY(-8deg) scale(1.03)', offset: 0.7 },
        { opacity: 1, transform: 'perspective(600px) rotateY(0) scale(1)' },
      ], { duration: (opts.duration || 420) * timeMul(), delay: ((opts.delay || 0) + i * (opts.step || 110)) * timeMul(), easing: 'ease-out', fill: 'backwards' });
    } catch (e) { /* ignore */ }
  });
}

// Title letters dropping in one by one. Returns the element and total duration (ms).
export function dropLetters(text, cls = 'drop-title', opts = {}) {
  const el = h('div.' + cls);
  const chars = [...String(text)];
  const total = Math.min(opts.max || 1100, chars.length * 70);
  const step = chars.length > 1 ? total / (chars.length - 1) : 0;
  const spans = chars.map((ch) => h('span.dl', ch === ' ' ? ' ' : ch));
  el.append(...spans);
  if (!UI.reduced && speedOf() < 3) {
    spans.forEach((s, i) => {
      try {
        s.animate([
          { opacity: 0, transform: 'translateY(-34px) rotate(-8deg) scale(1.3)' },
          { opacity: 1, transform: 'translateY(3px) rotate(1deg) scale(1)', offset: 0.75 },
          { opacity: 1, transform: 'none' },
        ], { duration: 380 * timeMul(), delay: ((opts.delay || 0) + i * step) * timeMul(), easing: 'cubic-bezier(.3,.7,.4,1.2)', fill: 'backwards' });
      } catch (e) { /* ignore */ }
    });
  }
  return { el, ms: ((opts.delay || 0) + total + 380) * (UI.reduced || speedOf() >= 3 ? 0 : timeMul()), spans };
}

// The full story (page `long`, or the page text) in a scroll sheet.
export function storySheet(title, text) {
  const body = h('div.story-sheet', h('div.ss-scroll.prose', { html: prose(String(text ?? '').replace(/^@([a-z][\w-]*)\s*:\s*/gim, (m, w) => `**${speakerName(w)}:** `)) }));
  return modal({ title: title || 'The full story', cls: 'm-story', body });
}

// Auto-advance preference (per player, saved with meta).
export function storyAuto(g, v) {
  const ui = (g.meta.ui = g.meta.ui || {});
  if (v !== undefined) { ui.storyAuto = !!v; safe(() => g.saveMeta()); }
  return !!ui.storyAuto;
}

export { icon };
