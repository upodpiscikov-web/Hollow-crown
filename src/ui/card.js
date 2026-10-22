// Shared card component. Sizing: the card is 10em x 14em; set font-size (or --cw
// via .card-size helpers) to scale every part of it uniformly.
import { CARDS, HEROES } from '../engine/registry.js';
import { h, safe, cap } from './core.js';
import { spr, sprURL, hasSprite } from './gfx.js';
import { cardText, cardChips, glossaryFor } from './text.js';

const TYPE_LABEL = { attack: 'Attack', skill: 'Skill', power: 'Power', curse: 'Curse', status: 'Status' };

export function heroColor(hero) {
  const H = HEROES[hero];
  if (H) return H.color;
  if (hero === 'neutral') return '#9e9a9c';
  if (hero === 'curse') return '#7b5aa6';
  return '#7a767a';
}

// opts: { g, live (combat numbers), target, width (design px), upgradedFrom (vals), cls, price, onTap }
export function cardEl(card, opts = {}) {
  const g = opts.g;
  const def = CARDS[card.id];
  const width = opts.width || 100;
  if (!def) {
    return h('div.card.t-status.unknown' + (opts.cls ? '.' + opts.cls : ''), { style: { fontSize: width / 10 + 'px' } },
      h('div.c-frame'), h('div.c-name', h('span', 'Unknown')), h('div.c-text', h('div.c-tx', 'This card has faded from the world.')));
  }
  const type = TYPE_LABEL[def.type] ? def.type : 'skill';
  const rarity = def.rarity || 'common';
  const el = h(`div.card.t-${type}.r-${rarity}` + (card.up ? '.up' : '') + (opts.simple ? '.simple' : '') + (opts.cls ? '.' + opts.cls : ''), {
    style: { fontSize: width / 10 + 'px', '--hc': heroColor(def.hero) },
  });
  el.dataset.uid = card.uid;
  el.appendChild(h('div.c-frame'));
  // Art
  const art = h('div.c-art');
  const artId = 'art_' + (def.art || 'missing');
  if (hasSprite(artId)) art.appendChild(h('img.px.c-artimg', { src: sprURL(artId), alt: '', draggable: 'false' }));
  else art.appendChild(h('div.c-artph', h('span', cap(def.art || '?').slice(0, 1))));
  el.appendChild(art);
  // Name banner
  const nm = def.name + (card.up ? '+' : '');
  el.appendChild(h('div.c-name' + (nm.length > 16 ? '.xs' : nm.length > 11 ? '.sm' : nm.length > 9 ? '.md' : ''), h('span', nm)));
  // Cost gem
  const cost = costInfo(g, card, def, opts.live);
  if (cost) el.appendChild(h('div.c-cost' + (cost.cls ? '.' + cost.cls : ''), h('span', String(cost.text))));
  // Simple view: big effect chips instead of rules text (the full text appears when selected).
  if (opts.simple) {
    const all = cardChips(g, card, { live: opts.live, target: opts.target });
    const main = all.filter((c) => c.k !== 'kw').slice(0, 3);
    const kws = all.filter((c) => c.k === 'kw');
    const box = h('div.c-chips.n' + main.length, main.map(chipEl));
    el.appendChild(h('div.c-text', box));
    if (kws.length) art.appendChild(h('div.c-kws', kws.map((c) => h('span.kwb', { title: c.label }, c.glyph))));
    el._terms = cardText(g, card, { live: opts.live, target: opts.target }).terms;
    return el;
  }
  // Type plate + rarity gem
  el.appendChild(h('div.c-type', h('i.c-gem'), h('span', TYPE_LABEL[type])));
  // Text
  const { html, terms } = cardText(g, card, { live: opts.live, target: opts.target, upgradedFrom: opts.upgradedFrom });
  const plain = html.replace(/<[^>]+>/g, '');
  const len = plain.length;
  const tx = h('div.c-tx', { html });
  if (len > 105) tx.classList.add('tiny'); else if (len > 75) tx.classList.add('small');
  el.appendChild(h('div.c-text', tx));
  el._terms = terms;
  if (opts.price != null) el.appendChild(h('div.c-price', String(opts.price)));
  return el;
}

const CHIP_ICON = { dmg: 'in_atk', blk: 'ui_block', draw: 'ui_draw', heal: 'ui_heart', hp: 'ui_hp', energy: 'ui_energy' };
const CHIP_GLYPH = { dmg: '\u2694', blk: '\u25C6', draw: '\u25A4', heal: '+', hp: '\u2665', energy: '\u26A1' };

// One effect chip: icon + number (+ ALL / xN tags). Sized in em so it scales with the card.
function chipEl(c) {
  const iconId = c.icon || CHIP_ICON[c.k];
  const ic = iconId && hasSprite(iconId) ? h('img.px.chip-ic', { src: sprURL(iconId), alt: '', draggable: 'false' })
    : h('span.chip-gl', c.glyph || CHIP_GLYPH[c.k] || '\u2726');
  const cls = `chip.k-${c.k}` + (c.cls ? '.' + c.cls : '') + (c.neg ? '.neg' : '');
  if (c.k === 'text') return h('div.chip.k-text', c.label);
  const n = c.n == null ? null : h('span.chip-n', (c.k === 'hp' ? '\u2212' : '') + c.n);
  const times = c.times > 1 ? h('span.chip-x', '\u00D7' + c.times) : null;
  const tag = c.tag ? h('span.chip-tag', c.tag) : null;
  return h('div.' + cls, ic, n, times, tag);
}

function costInfo(g, card, def, live) {
  const printed = def.cost;
  if (printed === -1 || printed == null) return null;
  let base = printed;
  try { base = g ? g.baseCost(card) : printed; } catch (e) { /* noop */ }
  let cur = base;
  if (g) cur = safe(() => g.cardCost(card), base);
  if (cur === 'X' || base === 'X') return { text: 'X' };
  if (typeof cur !== 'number' || cur < 0) return null;
  let cls = '';
  if (typeof base === 'number') {
    if (cur < base) cls = 'cheap';
    else if (cur > base) cls = 'dear';
  }
  return { text: cur, cls };
}

// A card plus its glossary boxes, for detail views.
export function cardDetail(g, card, opts = {}) {
  const c = cardEl(card, { width: 150, ...opts, g });
  const tips = glossaryFor(c._terms || []);
  const box = h('div.card-detail', c, tips.length ? h('div.kw-tips', tips.map((t) => h('div.kw-tip', h('b', t.term), h('span', t.text)))) : null);
  return box;
}

// Upgraded copy of a card instance (for previews).
export function upgradedCopy(card) { return { ...card, up: 1, uid: 'up_' + card.uid }; }

export function canShowUpgrade(g, card) {
  return safe(() => g.canUpgrade(card), false);
}

// Sort helper for deck views.
const TYPE_ORDER = { attack: 0, skill: 1, power: 2, status: 3, curse: 4 };
const RAR_ORDER = { starter: 0, common: 1, uncommon: 2, rare: 3, special: 4, curse: 5 };
export function sortCards(cards, mode = 'type') {
  return [...cards].sort((a, b) => {
    const A = CARDS[a.id], B = CARDS[b.id];
    if (!A || !B) return !A - !B;
    if (mode === 'rarity') return (RAR_ORDER[A.rarity] ?? 9) - (RAR_ORDER[B.rarity] ?? 9) || A.name.localeCompare(B.name) || b.up - a.up;
    return (TYPE_ORDER[A.type] ?? 9) - (TYPE_ORDER[B.type] ?? 9) || A.name.localeCompare(B.name) || b.up - a.up;
  });
}
