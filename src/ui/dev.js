// Dev panel (?dev=1): QA shortcuts. Never loaded into the player's view otherwise.
import { CARDS, RELICS, POTIONS, ENCOUNTERS, ENEMIES, EVENTS, HEROES, LORE } from '../engine/registry.js';
import { h, tap, UI, safe } from './core.js';
import { modal, toast, closeAllModals } from './overlay.js';

export function initDev(g) {
  const btn = h('button.dev-btn', 'DEV');
  tap(btn, () => open(g), { sound: false });
  document.getElementById('stage').appendChild(btn);
  window.__dev = { g, open: () => open(g) };
}

function opts(map, selected) {
  return Object.values(map).map((d) => h('option', { value: d.id, selected: d.id === selected }, `${d.name || d.title || d.id} (${d.id})`));
}

function row(label, ...els) { return h('div.dev-row', h('span.dev-label', label), ...els); }

function inRun(g) { return !!(g.run && UI.inRun); }

function open(g) {
  const body = h('div.dev');
  const refresh = () => { UI.inRun = !!g.run; UI.render(); };
  const need = () => { if (!g.run) { toast('Start a run first (Embark).', 'warn'); return false; } UI.inRun = true; return true; };
  const btn = (label, fn) => { const b = h('button.btn.small', label); tap(b, async () => { try { await fn(); } catch (e) { console.error(e); toast(String(e.message || e), 'warn'); } }, { sound: 'click' }); return b; };
  const sel = (map) => h('select', opts(map));

  const cardSel = sel(CARDS), relicSel = sel(RELICS), potSel = sel(POTIONS), encSel = sel(ENCOUNTERS), evSel = sel(EVENTS), loreSel = sel(LORE);
  const heroSel = h('select', Object.keys(HEROES).map((id) => h('option', { value: id }, id)));
  const actSel = h('select', [1, 2, 3, 4].map((a) => h('option', { value: a }, 'Act ' + a)));
  const kindSel = h('select', ['fight', 'elite', 'boss'].map((k) => h('option', { value: k }, k)));

  body.append(
    row('Quick start', heroSel, btn('New run', () => { if (g.run) g.abandonRun(); g.meta.heroes[heroSel.value].unlocked = true; g.newRun(heroSel.value, 0, (Math.random() * 4294967295) >>> 0); UI.inRun = true; closeAllModals(); UI.render(); }),
      btn('Skip blessing', () => { if (!need()) return; g.run.blessing = null; g.run.screen = 'map'; g.save(); closeAllModals(); refresh(); })),
    row('Resources', btn('+100 gold', () => { if (need()) { g.gainGold(100); refresh(); } }), btn('Heal', () => { if (need()) { g.run.player.hp = g.run.player.maxHp; refresh(); } }),
      btn('-10 HP', () => { if (need()) { g.run.player.hp = Math.max(1, g.run.player.hp - 10); refresh(); } }), btn('+10 Max HP', () => { if (need()) { g.gainMaxHp(10); refresh(); } })),
    row('Combat', btn('Kill all', () => { if (g.cb) { for (const e of [...g.enemies]) g.kill(e); g.afterAction(); } else toast('Not in combat.', 'warn'); }),
      btn('+3 energy', () => { if (g.cb) { g.gainEnergy(3); refresh(); } }), btn('Draw 5', () => { if (g.cb) { g.draw(5); g.emit('refresh'); } }),
      btn('Die', () => { if (g.cb) { g.player.hp = 0; g.cb.result = 'lost'; g.cb.phase = 'over'; g.afterAction(); } else if (g.run) { g.hurt(9999); refresh(); } })),
    row('Card', cardSel, btn('To deck', () => { if (need()) { g.addToDeck(cardSel.value); refresh(); } }), btn('+ upgraded', () => { if (need()) { g.addToDeck(cardSel.value, 1); refresh(); } }), btn('To hand', () => { if (g.cb) { g.addCard(cardSel.value, 'hand'); g.emit('refresh'); } else toast('Not in combat.', 'warn'); })),
    row('Relic', relicSel, btn('Add', () => { if (need()) { g.addRelic(relicSel.value); refresh(); } })),
    row('Tincture', potSel, btn('Add', () => { if (need()) { if (!g.obtainPotion(potSel.value)) toast('Belt full.', 'warn'); refresh(); } })),
    row('Encounter', encSel, kindSel, btn('Fight', async () => {
      if (!need()) return;
      const enc = ENCOUNTERS[encSel.value];
      const ids = typeof enc.enemies === 'function' ? enc.enemies(g, g.run.rng.enc) : enc.enemies;
      closeAllModals();
      g.run.screen = 'combat';
      g.run.event = null;
      await g.startCombat(ids, { kind: enc.pool === 'boss' ? 'boss' : enc.pool === 'elite' ? 'elite' : kindSel.value === 'fight' ? 'fight' : kindSel.value, encounter: enc.id });
      refresh();
    })),
    row('Event', evSel, btn('Open', () => { if (!need()) return; if (g.cb) g.run.combat = null; g.openEvent(evSel.value); closeAllModals(); refresh(); })),
    row('Rooms', btn('Shop', () => { if (need()) { g.run.combat = null; g.openShop(); closeAllModals(); refresh(); } }), btn('Rest', () => { if (need()) { g.run.combat = null; g.openRest(); closeAllModals(); refresh(); } }),
      btn('Treasure', () => { if (need()) { g.run.combat = null; g.openTreasure(); closeAllModals(); refresh(); } }), btn('Throne', () => { if (need()) { g.run.combat = null; g.run.screen = 'throne'; closeAllModals(); refresh(); } }),
      btn('Map', () => { if (need()) { g.run.combat = null; g.run.event = null; g.run.screen = 'map'; closeAllModals(); refresh(); } })),
    row('Act', actSel, btn('Jump', () => { if (!need()) return; g.run.combat = null; g.nextAct(+actSel.value); closeAllModals(); refresh(); }),
      btn('Win (crown)', () => { if (need()) { g.run.combat = null; g.finishRun('crown'); closeAllModals(); refresh(); } })),
    row('Meta', btn('Unlock heirs', () => { for (const id in g.meta.heroes) g.meta.heroes[id].unlocked = true; g.saveMeta(); toast('All heirs unlocked.'); UI.render(); }),
      btn('Weight 10', () => { for (const id in g.meta.heroes) g.meta.heroes[id].ascMax = 10; g.saveMeta(); toast('Crown Weight unlocked.'); }),
      btn('Renown +600', () => { for (const id in g.meta.heroes) { g.meta.heroes[id].renown += 600; } g.saveMeta(); toast('+600 Renown (levels apply after next run).'); })),
    row('Flags', btn('All story flags', () => {
      const f = ['knows_heart', 'met_pell', 'met_peddler', 'peddler_is_pell', 'knows_unspent', 'knows_founder', 'hob_is_aldane', 'crane_knows'];
      for (const h2 of ['knight', 'witch', 'wren', 'cantor']) { for (let i = 1; i <= 4; i++) f.push(h2 + '_' + i); f.push('truth_' + h2); }
      for (let i = 2; i <= 6; i++) f.push('pell_' + i);
      for (const k of f) g.meta.flags[k] = true;
      g.saveMeta(); toast('Story flags set.');
    }), btn('Lore', () => { for (const id of Object.keys(LORE)) if (!g.meta.lore[id]) g.meta.lore[id] = Date.now(); g.saveMeta(); toast('All lore unlocked.'); }),
      btn('Seen all', () => { for (const id of Object.keys(CARDS)) g.meta.seen.cards[id] = 1; for (const id of Object.keys(RELICS)) g.meta.seen.relics[id] = 1; for (const id of Object.keys(POTIONS)) g.meta.seen.potions[id] = 1; for (const id of Object.keys(ENEMIES)) g.meta.seen.enemies[id] = 1; g.saveMeta(); toast('Compendium filled.'); }),
      btn('Hub line reset', () => { g.meta.hubSeen = {}; if (g.meta.lastRun) g.meta.lastRun.seen = false; UI.hubShown = false; g.saveMeta(); toast('Hob will speak again.'); })));

  modal({ title: 'Dev panel', cls: 'm-dev', body });
}
