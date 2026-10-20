// Run top bar: HP, gold, tincture belt, relics, floor/act, map peek, deck, settings.
import { RELICS, POTIONS, HEROES } from '../engine/registry.js';
import { h, tap, UI, ROMAN, safe } from './core.js';
import { spr, icon, relicIcon, potionIcon, hasSprite } from './gfx.js';
import { infoTip, menuAt, showDeck, toast, tip, hideTip } from './overlay.js';
import { inline } from './text.js';
import { sfx } from './sound.js';

// Hooks set by screens (combat sets potion targeting).
export const TB = { onPotionTarget: null, openSettings: null, openMapPeek: null };

export function topbar(g, opts = {}) {
  const run = g.run;
  const P = run.player;
  const H = HEROES[run.hero];
  const bar = h('div.topbar');
  // Hero + HP
  const hp = h('div.tb-item.tb-hp', icon('ui_hp', 1.5, 'tb-ic', '♥'), h('span.tb-val', `${Math.max(0, P.hp)}/${P.maxHp}`));
  hp.dataset.role = 'hp';
  infoTip(hp, () => ({ title: H ? `${H.name}` : 'Health', text: `Health: ${P.hp} of ${P.maxHp}. If it falls to 0, the Crown takes you back.` }));
  const gold = h('div.tb-item.tb-gold', icon('ui_gold', 1.5, 'tb-ic', '●'), h('span.tb-val', String(run.gold)));
  gold.dataset.role = 'gold';
  infoTip(gold, () => ({ title: 'Gold', text: `${run.gold} gold. Spend it with the Pale Peddler.` }));
  bar.append(h('div.tb-name', H ? H.name : ''), hp, gold);
  // Potions
  const belt = h('div.tb-belt');
  run.potions.forEach((pid, slot) => {
    const d = pid ? POTIONS[pid] : null;
    const b = h('button.tb-potion' + (d ? '' : '.empty'), d ? potionIcon(d, 1.5) : icon('ui_potion_empty', 1.5, '', '○'));
    b.dataset.slot = slot;
    if (d) tap(b, () => potionMenu(g, slot, b));
    else infoTip(b, () => ({ title: 'Empty slot', text: 'Tinctures you find are kept here.' }));
    belt.appendChild(b);
  });
  bar.appendChild(belt);
  // Relics
  const relics = h('div.tb-relics');
  for (const r of run.relics) {
    const d = RELICS[r.id];
    const b = h('div.tb-relic', relicIcon(d, 1.5), r.n != null && d && d.counter != null ? h('span.tb-count', String(r.n)) : null);
    b.dataset.relic = r.id;
    infoTip(b, () => relicTip(r));
    relics.appendChild(b);
  }
  bar.appendChild(relics);
  // Right cluster
  const right = h('div.tb-right');
  const floorLbl = run.act === 4 ? 'Beneath' : `Act ${ROMAN[run.act] || run.act}`;
  const fl = h('div.tb-floor', h('span.tb-act', floorLbl), h('span.tb-fl', `Floor ${run.floor}`));
  infoTip(fl, () => ({ title: `${floorLbl} — Floor ${run.floor}`, text: run.asc ? `Crown Weight ${run.asc}.` : 'The road to Ashgrave.' }));
  right.appendChild(fl);
  if (opts.mapPeek !== false) {
    const mb = h('button.tb-btn', { 'aria-label': 'Map' }, icon('ui_map', 1.5, '', '▦'));
    tap(mb, () => TB.openMapPeek && TB.openMapPeek());
    right.appendChild(mb);
  }
  const db = h('button.tb-btn.tb-deck', { 'aria-label': 'Deck' }, icon('ui_deck', 1.5, '', '▤'), h('span.tb-count', String(run.deck.length)));
  tap(db, () => showDeck(g));
  const sb = h('button.tb-btn', { 'aria-label': 'Settings' }, icon('ui_settings', 1.5, '', '⚙'));
  tap(sb, () => TB.openSettings && TB.openSettings());
  right.append(db, sb);
  bar.appendChild(right);
  return bar;
}

export function relicTip(r) {
  const d = RELICS[r.id];
  if (!d) return { title: r.id, text: 'An unknown relic.' };
  const counter = r.n != null && d.counter != null ? `<br><span class="tip-counter">Counter: ${r.n}</span>` : '';
  return {
    icon: relicIcon(d, 2), title: d.name, html: inline(d.desc, true) + counter,
    sub: [d.rarity ? `<span class="rar r-${d.rarity}">${d.rarity}</span>` : '', d.flavor ? `<i>${inline(d.flavor)}</i>` : ''].filter(Boolean).join('<br>'),
  };
}

export function potionTip(d) {
  if (!d) return { title: 'Tincture', text: '' };
  return { icon: potionIcon(d, 2), title: d.name, html: inline(d.desc, true), sub: d.rarity ? `<span class="rar r-${d.rarity}">${d.rarity}</span>${d.anytime ? ' · usable any time' : ''}` : '' };
}

function potionMenu(g, slot, anchor) {
  const pid = g.run.potions[slot];
  const d = POTIONS[pid];
  if (!d) return;
  const cb = g.cb;
  const inCombat = cb && cb.phase === 'player' && !cb.busy;
  const usable = inCombat || d.anytime;
  const items = [
    {
      label: 'Use', disabled: !usable || (d.target === 'enemy' && !inCombat), cls: 'primary',
      onTap: () => {
        if (!usable) { toast('This tincture can only be used in combat.'); return; }
        if (d.target === 'enemy') {
          if (g.enemies.length === 1) { g.usePotion(slot, g.enemies[0].uid); return; }
          if (TB.onPotionTarget) TB.onPotionTarget(slot);
          return;
        }
        g.usePotion(slot).then((ok) => { if (!ok) toast('You cannot use that now.'); UI.render(); });
      },
    },
    { label: 'Discard', onTap: () => { g.discardPotion(slot); sfx('discard'); UI.render(); } },
  ];
  menuAt(anchor, d.name, inline(d.desc, true), items);
}

// Lightweight in-place updates (called on gold/hp emits without full rerender).
export function updateTopbarStats(g) {
  if (!g.run) return;
  const P = g.run.player;
  for (const el of document.querySelectorAll('.tb-hp .tb-val')) el.textContent = `${Math.max(0, P.hp)}/${P.maxHp}`;
  for (const el of document.querySelectorAll('.tb-gold .tb-val')) el.textContent = String(g.run.gold);
}

export { hideTip, tip, hasSprite, spr, safe };
