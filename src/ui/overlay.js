// Overlays: tooltips, toasts, banners, modals, confirm dialogs, the card-choose
// modal (g.ui.choose), pile / deck viewers and the card zoom.
import { h, $, clear, tap, longPress, UI, sleep, safe, anim, timeMul, speedOf } from './core.js';
import { S, stageRect } from './scale.js';
import { sfx } from './sound.js';
import { cardEl, cardDetail, upgradedCopy, sortCards } from './card.js';
import { CARDS } from '../engine/registry.js';

const layer = () => $('#overlay');

// ------------------------------------------------------------------ tooltips
let tipEl = null;
export function hideTip() { if (tipEl) { tipEl.remove(); tipEl = null; } }

// content: { title, text, html, sub, icon (Element) }
export function tip(anchor, content) {
  hideTip();
  const t = h('div.tip',
    content.icon ? h('div.tip-ic', content.icon) : null,
    h('div.tip-body',
      content.title ? h('div.tip-title', content.title) : null,
      content.html ? h('div.tip-text', { html: content.html }) : content.text ? h('div.tip-text', content.text) : null,
      content.sub ? h('div.tip-sub', { html: content.sub }) : null,
      content.extra || null));
  document.getElementById('stage').appendChild(t);
  tipEl = t;
  const r = anchor && anchor.getBoundingClientRect ? stageRect(anchor) : { x: S.W / 2, y: S.H / 2, w: 0, h: 0, cx: S.W / 2, cy: S.H / 2 };
  const tw = t.offsetWidth, th = t.offsetHeight;
  let x = r.cx - tw / 2;
  x = Math.max(8, Math.min(S.W - tw - 8, x));
  let y = r.y - th - 8;
  if (y < 6) y = r.y + r.h + 8;
  if (y + th > S.H - 6) y = Math.max(6, S.H - th - 6);
  t.style.left = x + 'px';
  t.style.top = y + 'px';
  anim(t, [{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], 140);
  sfx('tip');
  return t;
}

// Tap and long-press both show a tooltip (for icons with no other action).
export function infoTip(el, fn) {
  el.classList.add('pressable', 'info');
  el.addEventListener('click', (e) => { e.stopPropagation(); if (el._lpFired) { el._lpFired = false; return; } const c = fn(); if (c) tip(el, c); });
  longPress(el, () => { const c = fn(); if (c) tip(el, c); });
  return el;
}

document.addEventListener('pointerdown', (e) => {
  if (tipEl && !tipEl.contains(e.target)) hideTip();
}, true);

// ------------------------------------------------------------------ toasts
export function toast(text, kind = '', iconEl = null) {
  const box = $('#toasts');
  if (!box) return;
  while (box.children.length > 3) box.firstChild.remove();
  const t = h('div.toast' + (kind ? '.' + kind : ''), iconEl ? h('span.toast-ic', iconEl) : null, h('span', { html: text }));
  box.appendChild(t);
  anim(t, [{ opacity: 0, transform: 'translateY(-10px)' }, { opacity: 1, transform: 'none' }], 200);
  setTimeout(() => { anim(t, [{ opacity: 1 }, { opacity: 0 }], 300).then(() => t.remove()); }, kind === 'long' ? 3800 : 2300);
}

// ------------------------------------------------------------------ banners
export function banner(text, kind = '', sub = '', ms = 1000) {
  const fx = $('#fx');
  if (!fx) return Promise.resolve();
  for (const old of fx.querySelectorAll('.banner')) old.remove();
  if (speedOf() >= 3 && kind !== 'boss') return Promise.resolve();
  ms *= timeMul();
  const b = h('div.banner' + (kind ? '.' + kind : ''), h('div.banner-band', h('div.banner-text', text), sub ? h('div.banner-sub', sub) : null));
  fx.appendChild(b);
  anim(b, [{ opacity: 0, transform: 'scaleY(0.4)' }, { opacity: 1, transform: 'none' }], 220);
  return sleep(ms).then(() => anim(b, [{ opacity: 1 }, { opacity: 0 }], 260)).then(() => b.remove());
}

// ------------------------------------------------------------------ modals
const stack = [];
export function modalOpen() { return stack.length > 0; }

// opts: { title, cls, body (Element|Array), footer (Array), onClose, closable=true, dim=true }
export function modal(opts = {}) {
  const closeBtn = opts.closable !== false ? h('button.btn.icon-btn.m-close', { 'aria-label': 'Close' }, '✕') : null;
  const body = h('div.m-body', opts.body);
  const panel = h('div.m-panel' + (opts.cls ? '.' + opts.cls : ''),
    (opts.title || closeBtn) ? h('div.m-head', h('div.m-title', opts.title || ''), opts.headExtra || null, closeBtn) : null,
    body,
    opts.footer ? h('div.m-foot', opts.footer) : null);
  const root = h('div.modal' + (opts.dim === false ? '.nodim' : ''), panel);
  const api = {
    el: root, body, panel,
    close(val) {
      const i = stack.indexOf(api);
      if (i < 0) return;
      stack.splice(i, 1);
      anim(root, [{ opacity: 1 }, { opacity: 0 }], 140).then(() => root.remove());
      if (opts.onClose) opts.onClose(val);
    },
  };
  if (closeBtn) tap(closeBtn, () => api.close());
  if (opts.tapOutside ?? opts.closable !== false) {
    root.addEventListener('click', (e) => { if (e.target === root) { sfx('click'); api.close(); } });
  }
  layer().appendChild(root);
  stack.push(api);
  anim(panel, [{ opacity: 0, transform: 'translateY(10px) scale(.98)' }, { opacity: 1, transform: 'none' }], 180);
  return api;
}

export function closeAllModals() { while (stack.length) stack[stack.length - 1].close(); }
export function closeTopModal() { if (stack.length) { stack[stack.length - 1].close(); return true; } return false; }

export function confirmBox(text, opts = {}) {
  return new Promise((resolve) => {
    let done = false;
    const m = modal({
      title: opts.title || 'Are you certain?', cls: 'm-small' + (opts.danger ? ' danger' : ''),
      body: h('div.confirm-text', { html: text }),
      footer: [
        h('button.btn', { onTap: () => { done = true; m.close(); resolve(false); } }, opts.no || 'Cancel'),
        h('button.btn' + (opts.danger ? '.danger' : '.primary'), { onTap: () => { done = true; m.close(); resolve(true); } }, opts.yes || 'Confirm'),
      ],
      onClose: () => { if (!done) resolve(false); },
    });
  });
}

// ------------------------------------------------------------------ card zoom
export function zoomCard(g, card, opts = {}) {
  let showUp = false;
  const canUp = !card.up && safe(() => g.canUpgrade(card), false);
  const holder = h('div.zoom-holder');
  const draw = () => {
    clear(holder);
    const c = showUp ? upgradedCopy(card) : card;
    holder.appendChild(cardDetail(g, c, { width: 170, live: opts.live, target: opts.target, upgradedFrom: showUp ? safe(() => g.cardVals(card), null) : null }));
  };
  draw();
  const toggle = canUp && opts.noUpgradeToggle !== true ? h('button.btn.small', {
    onTap: () => { showUp = !showUp; toggle.classList.toggle('on', showUp); draw(); },
  }, 'View upgrade') : null;
  const m = modal({ cls: 'm-zoom', body: [holder, toggle ? h('div.zoom-actions', toggle) : null, opts.extra || null], closable: false, tapOutside: true });
  holder.addEventListener('click', () => { sfx('click'); m.close(); });
  return m;
}

// ------------------------------------------------------------------ card grid helper
function cardGrid(g, cards, opts = {}) {
  const grid = h('div.card-grid' + (opts.big ? '.big' : ''));
  const els = [];
  cards.forEach((card, i) => {
    const showUp = opts.showUp && opts.showUp() && !card.up && safe(() => g.canUpgrade(card), false);
    const c = cardEl(showUp ? upgradedCopy(card) : card, { g, width: opts.width || 92, live: opts.live, upgradedFrom: showUp ? safe(() => g.cardVals(card), null) : null });
    const cell = h('div.cg-cell', c);
    if (opts.onTap) tap(cell, () => opts.onTap(card, i, cell), { sound: 'cardHover' });
    longPress(cell, () => zoomCard(g, card, { live: opts.live }));
    els.push(cell);
    grid.appendChild(cell);
  });
  grid._cells = els;
  return grid;
}

// ------------------------------------------------------------------ pile / deck viewers
export function showPile(g, title, cards, opts = {}) {
  const list = opts.sort ? sortCards(cards, 'type') : opts.reverse ? [...cards].reverse() : cards;
  const body = list.length ? cardGrid(g, list, { width: 92, live: !!g.cb, onTap: (card) => zoomCard(g, card, { live: !!g.cb }) })
    : h('div.empty-note', opts.empty || 'Nothing here.');
  modal({ title: `${title} (${cards.length})`, cls: 'm-sheet', body: [opts.note ? h('div.m-note', opts.note) : null, body] });
}

export function showDeck(g, opts = {}) {
  const deck = g.run ? g.run.deck : [];
  let showUp = false;
  let mode = 'type';
  const wrap = h('div');
  const draw = () => {
    clear(wrap);
    if (!deck.length) { wrap.appendChild(h('div.empty-note', 'Your deck is empty.')); return; }
    wrap.appendChild(cardGrid(g, sortCards(deck, mode), { width: 92, showUp: () => showUp, onTap: (card) => zoomCard(g, card) }));
  };
  draw();
  const upBtn = h('button.btn.small.toggle', { onTap: () => { showUp = !showUp; upBtn.classList.toggle('on', showUp); draw(); } }, 'Upgrades');
  const sortBtn = h('button.btn.small', { onTap: () => { mode = mode === 'type' ? 'rarity' : 'type'; sortBtn.textContent = mode === 'type' ? 'By type' : 'By rarity'; draw(); } }, 'By type');
  modal({ title: `${opts.title || 'Deck'} (${deck.length})`, cls: 'm-sheet', headExtra: h('div.m-tools', sortBtn, upBtn), body: wrap });
}

// ------------------------------------------------------------------ choose modal (g.ui.choose)
// opts: { title, cards, count, min, deck, upgradePreview, offer, from }
export function chooseCards(g, opts) {
  return new Promise((resolve) => {
    const cards = opts.cards || [];
    const count = Math.max(1, Math.min(opts.count ?? 1, cards.length));
    const min = Math.max(0, Math.min(opts.min ?? count, count));
    const sel = new Set();
    const big = cards.length <= 4;
    let finished = false;
    const finish = (res) => {
      if (finished) return;
      finished = true;
      m.close('__done');
      resolve(res);
    };
    const confirmBtn = h('button.btn.primary', opts.offer ? 'Take' : 'Confirm');
    const skipBtn = min === 0 ? h('button.btn', { onTap: () => finish([]) }, opts.offer ? 'Skip' : 'Skip') : null;
    const counter = h('div.ch-count');
    const peekBtn = g.cb ? h('button.btn.small.peek-btn', 'Peek') : null;
    const update = () => {
      const n = sel.size;
      const ok = n >= Math.max(1, min) && n <= count;
      confirmBtn.classList.toggle('disabled', !ok);
      confirmBtn.style.display = n === 0 && min === 0 ? 'none' : '';
      counter.textContent = count > 1 ? `${n} / ${count} selected` : '';
      grid._cells.forEach((c, i) => c.classList.toggle('sel', sel.has(i)));
    };
    const grid = cardGrid(g, cards, {
      big, width: big ? 124 : 92, live: !!g.cb,
      onTap: (card, i) => {
        if (opts.upgradePreview && count === 1) { previewUpgrade(card, i); return; }
        if (sel.has(i)) {
          if (count === 1) { finish([cards[i]]); return; }
          sel.delete(i);
        } else {
          if (count === 1) sel.clear();
          if (sel.size >= count) return;
          sel.add(i);
        }
        update();
      },
    });
    tap(confirmBtn, () => {
      if (confirmBtn.classList.contains('disabled')) return;
      finish([...sel].sort((a, b) => a - b).map((i) => cards[i]));
    }, { sound: 'confirm' });
    const hint = count === 1 && !opts.upgradePreview ? 'Tap a card to select it, tap again to confirm.' : opts.upgradePreview ? 'Tap a card to preview its upgrade.' : `Choose ${min === count ? count : 'up to ' + count} cards.`;
    const m = modal({
      title: opts.title || 'Choose a card', cls: 'm-sheet m-choose' + (big ? ' big' : ''), closable: false,
      body: [h('div.m-note', hint), grid],
      footer: [peekBtn, h('div.grow'), counter, skipBtn, confirmBtn],
      onClose: (v) => { if (v !== '__done' && !finished) { finished = true; resolve([]); } },
    });
    if (peekBtn) {
      const on = () => m.el.classList.add('peek');
      const off = () => m.el.classList.remove('peek');
      peekBtn.addEventListener('pointerdown', on);
      peekBtn.addEventListener('pointerup', off);
      peekBtn.addEventListener('pointercancel', off);
      peekBtn.addEventListener('pointerleave', off);
    }
    update();
    sfx('open');

    function previewUpgrade(card, i) {
      const up = upgradedCopy(card);
      const before = cardDetail(g, card, { width: 140 });
      const after = cardDetail(g, up, { width: 140, upgradedFrom: safe(() => g.cardVals(card), null) });
      const pm = modal({
        title: 'Upgrade', cls: 'm-upgrade', closable: true,
        body: h('div.up-row', before, h('div.up-arrow', '➤'), after),
        footer: [
          h('button.btn', { onTap: () => pm.close() }, 'Back'),
          h('button.btn.primary', { onTap: () => { pm.close(); finish([cards[i]]); } }, 'Upgrade'),
        ],
      });
    }
  });
}

// Quick menu anchored near an element: items [{label, onTap, disabled, cls}]
export function menuAt(anchor, title, desc, items) {
  hideTip();
  const box = h('div.tip.menu',
    h('div.tip-body',
      title ? h('div.tip-title', title) : null,
      desc ? h('div.tip-text', { html: desc }) : null,
      h('div.menu-btns', items.map((it) => {
        const b = h('button.btn.small' + (it.cls ? '.' + it.cls : '') + (it.disabled ? '.disabled' : ''), it.label);
        tap(b, () => { hideTip(); it.onTap(); });
        return b;
      }))));
  document.getElementById('stage').appendChild(box);
  tipEl = box;
  const r = stageRect(anchor);
  const tw = box.offsetWidth, th = box.offsetHeight;
  box.style.left = Math.max(8, Math.min(S.W - tw - 8, r.cx - tw / 2)) + 'px';
  let y = r.y + r.h + 6;
  if (y + th > S.H - 6) y = Math.max(6, r.y - th - 6);
  box.style.top = y + 'px';
  anim(box, [{ opacity: 0 }, { opacity: 1 }], 120);
  return box;
}

export { cardGrid };
export const cardName = (id) => (CARDS[id] ? CARDS[id].name : id);
