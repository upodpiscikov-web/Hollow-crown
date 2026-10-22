// Screens that exist outside a run: title, hub (the Waystone), hero select,
// chronicle (lore & stats) and compendium (cards, relics, tinctures, bestiary).
import { CARDS, RELICS, POTIONS, ENEMIES, HEROES, TEXTS, HUB_LINES, LORE, ENCOUNTERS } from '../engine/registry.js';
import { RENOWN_LEVELS } from '../engine/run.js';
import { randomSeed } from '../engine/rng.js';
import { h, clear, tap, UI, ROMAN, safe, anim, pickRandom, fmtTime, cap } from './core.js';
import { spr, sprFit, icon, bgStyle, relicIcon, potionIcon, hasSprite, sprInfo } from './gfx.js';
import { cardEl } from './card.js';
import { prose, inline, splitQuote } from './text.js';
import { relicTip, potionTip } from './topbar.js';
import { tip, infoTip, toast, modal, zoomCard, confirmBox } from './overlay.js';
import { openSettings } from './settings.js';
import { sfx, music } from './sound.js';
import { particles } from './fx.js';

const ASC_DESC = [
  'The Crown’s ordinary weight.',
  'Elites are more common on the road.',
  'Normal enemies have 10% more HP.',
  'Elites have 10% more HP.',
  'Bosses have 10% more HP.',
  'Between acts you heal only 75% of your missing HP.',
  'You begin with less Max HP.',
  'You begin cursed with Regret.',
  'Enemies deal 10% more damage.',
  'Less gold, pricier shops, fewer upgraded rewards.',
  'The final boss of Act 3 is stronger.',
];

const UNLOCK_HINT = {
  witch: 'Complete your first expedition.',
  wren: 'Complete three expeditions, or reach the boss of Act 2.',
  cantor: 'Complete five expeditions, or reach Act 3.',
};

const SPEAKER_NAME = { hob: 'Hob', pell: 'Pell', peddler: 'The Pale Peddler', crown: 'The Crown', narrator: '' };

const ui = (g) => (g.meta.ui = g.meta.ui || {});

function speakerPortrait(id) {
  if (id === 'narrator') return null;
  if (HEROES[id]) return 'portrait_' + id;
  return 'npc_' + id;
}
function speakerName(id) { return HEROES[id] ? HEROES[id].name.split(' ')[0] : (SPEAKER_NAME[id] ?? cap(id)); }

function frame(cls, bg, shade) {
  const scr = h('div.screen.meta.' + cls);
  scr.appendChild(h('div.bleed.bg', { style: { background: bg } }));
  scr.appendChild(h('div.bleed.room-shade' + (shade ? '.' + shade : '')));
  return scr;
}

function backBtn(label, fn) {
  const b = h('button.btn.back', icon('ui_back', 1.25, '', '‹'), h('span', label || 'Back'));
  tap(b, fn);
  return b;
}

// ------------------------------------------------------------------ title
const title = {
  name: 'title',
  mount(root, g) {
    this.g = g;
    music('title');
    const hasRun = !!g.run;
    const tq = splitQuote(pickRandom(safe(() => TEXTS.title_quotes, null)) || 'One of you will wear me.');
    const scr = frame('title', bgStyle('bg_title'), 'title-shade');
    const menu = h('div.title-menu');
    if (hasRun) {
      const H = HEROES[g.run.hero];
      const b = h('button.btn.primary.big', h('span', 'Continue'), h('small', `${H ? H.name : ''} · Act ${ROMAN[g.run.act] || g.run.act}, floor ${g.run.floor}`));
      tap(b, () => { UI.inRun = true; UI.hubShown = true; UI.render(); }, { sound: 'confirm' });
      menu.appendChild(b);
    }
    const nb = h('button.btn.big' + (hasRun ? '' : '.primary'), h('span', 'New Expedition'));
    tap(nb, () => UI.go('hub'), { sound: 'confirm' });
    const cb = h('button.btn', 'Chronicle');
    tap(cb, () => { UI.chronFrom = 'title'; UI.go('chronicle'); });
    const sb = h('button.btn', 'Settings');
    tap(sb, () => openSettings(g));
    menu.append(nb, h('div.menu-row', cb, sb));
    scr.appendChild(h('div.title-wrap',
      h('div.logo', h('div.logo-the', 'The'), h('div.logo-main', 'Hollow'), h('div.logo-main', 'Crown'), h('div.logo-rule', h('i'), h('b', '✦'), h('i'))),
      h('div.title-quote', h('div.tq-text', { html: `“${inline(tq.quote)}”` }), tq.attr ? h('div.tq-attr', `— ${tq.attr}`) : null),
      menu));
    scr.appendChild(h('div.title-foot', 'Tap anywhere to wake the hour'));
    root.appendChild(scr);
    // Drifting ash
    this.ash = setInterval(() => { if (!document.hidden && !UI.reduced) particles(Math.random() * innerWidth, -4, 'ash', { n: 2, sp: 14, g: 40, life: 5200, wob: 20, drag: 1 }); }, 1500);
    if (UI.dev) scr.appendChild(h('div.dev-tag', 'DEV'));
  },
  unmount() { clearInterval(this.ash); },
};

// ------------------------------------------------------------------ hub
function eligibleHubLines(g) {
  const meta = g.meta, last = meta.lastRun;
  const ok = [];
  for (const l of HUB_LINES) {
    if (!l || !l.id || !Array.isArray(l.lines) || !l.lines.length) continue;
    let pass = false;
    try { pass = !!l.req(meta, last); } catch (e) { pass = false; }
    if (pass) ok.push(l);
  }
  return ok;
}

export function pickHubLine(g) {
  const meta = g.meta;
  const ok = eligibleHubLines(g);
  const unseenOnce = ok.filter((l) => l.once && !meta.hubSeen[l.id]).sort((a, b) => (b.pri || 0) - (a.pri || 0));
  if (unseenOnce.length) return unseenOnce[0];
  const rep = ok.filter((l) => !l.once);
  return rep.length ? pickRandom(rep) : null;
}

function applyHubLine(g, l) {
  const meta = g.meta;
  meta.hubSeen[l.id] = (meta.hubSeen[l.id] || 0) + 1;
  for (const f of l.sets || []) meta.flags[f] = true;
  if (l.lore && !meta.lore[l.lore]) { meta.lore[l.lore] = Date.now(); toast(`New lore in the Chronicle: <b>${safe(() => LORE[l.lore].title, 'a fragment')}</b>`, 'lore long'); }
  g.saveMeta();
}

function unreadCount(g) {
  const read = ui(g).loreRead || {};
  return Object.keys(g.meta.lore || {}).filter((id) => LORE[id] && !read[id]).length;
}

const hub = {
  name: 'hub',
  mount(root, g) {
    this.g = g; this.root = root;
    music('hub');
    this.lines = null; this.idx = 0;
    if (!UI.hubShown) {
      UI.hubShown = true;
      const last = g.meta.lastRun;
      const fresh = last ? !last.seen : !ui(g).hubVisited;
      if (fresh) {
        const l = pickHubLine(g);
        if (l) { this.lines = l.lines; applyHubLine(g, l); }
        if (last) { last.seen = true; }
        ui(g).hubVisited = true;
        g.saveMeta();
      }
    }
    this.build();
  },
  build() {
    const g = this.g, root = this.root;
    clear(root);
    const scr = frame('hub', bgStyle('bg_hub'), 'hub-shade');
    const unread = unreadCount(g);
    const embark = h('button.btn.primary.big', 'Embark');
    tap(embark, () => UI.go('heroes'), { sound: 'confirm' });
    const chron = h('button.btn', 'Chronicle', unread ? h('i.dot', String(unread)) : null);
    tap(chron, () => { UI.chronFrom = 'hub'; UI.go('chronicle'); });
    const comp = h('button.btn', 'Compendium');
    tap(comp, () => UI.go('compendium'));
    const set = h('button.btn', 'Settings');
    tap(set, () => openSettings(g));
    const menu = h('div.hub-menu', embark, chron, comp, set);
    scr.appendChild(menu);
    scr.appendChild(h('div.hub-back', backBtn('Title', () => UI.go('title'))));
    scr.appendChild(h('div.hub-sign', h('div.hs-title', 'The Waystone'), h('div.hs-sub', `${g.meta.deaths || 0} fallen · ${g.meta.wins || 0} crowned`)));
    root.appendChild(scr);
    this.scr = scr;
    this.showLine();
  },
  showLine() {
    const scr = this.scr;
    const old = scr.querySelector('.dialog');
    if (old) old.remove();
    if (!this.lines || this.idx >= this.lines.length) { scr.classList.remove('talking'); return; }
    scr.classList.add('talking');
    const [who, text] = this.lines[this.idx];
    const pid = speakerPortrait(who);
    const last = this.idx === this.lines.length - 1;
    const box = h('div.dialog' + (who === 'crown' ? '.crown' : ''),
      pid ? h('div.dlg-portrait', sprFit(pid, 64, 64)) : null,
      h('div.dlg-body', h('div.dlg-name', speakerName(who)), h('div.dlg-text', { html: inline(text) }), h('div.dlg-next', last ? '✦' : '▼')));
    scr.appendChild(box);
    anim(box, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], 220);
    tap(box, () => { this.idx++; this.showLine(); }, { sound: 'page' });
  },
  unmount() {},
};

// ------------------------------------------------------------------ hero select
function renownBar(g, id) {
  const H = g.meta.heroes[id] || {};
  const lvl = H.level || 0;
  const cur = RENOWN_LEVELS[lvl] ?? 0, next = RENOWN_LEVELS[lvl + 1];
  const p = next ? Math.max(0, Math.min(1, ((H.renown || 0) - cur) / (next - cur))) : 1;
  return h('div.renown.small',
    h('div.rn-head', h('span', `Renown level ${lvl}`), h('span.rn-gain', next ? `${(H.renown || 0) - cur}/${next - cur}` : 'Max')),
    h('div.rn-bar', h('div.rn-fill', { style: { transform: `scaleX(${p})` } })));
}

const heroes = {
  name: 'heroes',
  mount(root, g) {
    this.g = g; this.root = root;
    music('hub');
    const ids = Object.keys(HEROES);
    const last = ui(g).lastHero;
    this.sel = ids.includes(last) && g.meta.heroes[last] && g.meta.heroes[last].unlocked ? last : ids.find((i) => g.meta.heroes[i] && g.meta.heroes[i].unlocked) || ids[0];
    this.build();
  },
  build() {
    const g = this.g, root = this.root;
    clear(root);
    const scr = frame('heroes', bgStyle('bg_hub'), 'heavy');
    const ids = Object.keys(HEROES);
    const tabs = h('div.hero-tabs', ids.map((id) => {
      const H = HEROES[id], M = g.meta.heroes[id] || {};
      const un = !!M.unlocked;
      const t = h('button.hero-tab' + (id === this.sel ? '.sel' : '') + (un ? '' : '.locked'),
        h('div.ht-sprite', sprFit(H.sprite || 'hero_' + id, 44, 56, un ? '' : 'silhouette')),
        h('div.ht-name', un ? H.name.split(' ')[0] : '???'));
      tap(t, () => { this.sel = id; this.build(); }, { sound: 'select' });
      return t;
    }));
    const id = this.sel, H = HEROES[id], M = g.meta.heroes[id] || {};
    const un = !!M.unlocked;
    const quote = splitQuote(safe(() => TEXTS.hero_select[id], '')).quote;
    const detail = h('div.hero-detail');
    const art = h('div.hd-art', h('div.hd-pedestal'), sprFit(H.sprite || 'hero_' + id, 130, 170, 'hd-sprite' + (un ? '' : ' silhouette')));
    if (un) {
      art.style.setProperty('--hc', H.color);
      const info = h('div.hd-info',
        h('div.hd-claim', `Heir of ${H.claim}`),
        h('div.hd-name', H.name),
        h('div.hd-title', H.title),
        h('p.hd-blurb', H.blurb),
        h('div.hd-mech', h('b', 'Way: '), h('span', { html: inline(H.mechanic, true) })),
        quote ? h('p.hd-quote', { html: `<i>“${inline(quote)}”</i>` }) : null,
        renownBar(g, id),
        h('div.hd-stats', h('span', `${M.runs || 0} expeditions`), h('span', `${M.wins || 0} crowned`), h('span', `Best: Act ${M.bestAct || 0}`)));
      detail.append(art, info);
      // Crown weight + embark
      const max = Math.min(10, M.ascMax || 0);
      const asc = Math.min(max, (ui(g).asc && ui(g).asc[id]) || 0);
      let cur = asc;
      const ascVal = h('div.asc-val', String(cur));
      const ascDesc = h('div.asc-desc');
      const refresh = () => { ascVal.textContent = String(cur); ascDesc.textContent = ASC_DESC[cur] || ''; minus.classList.toggle('disabled', cur <= 0); plus.classList.toggle('disabled', cur >= max); };
      const minus = h('button.btn.icon-btn', '−');
      const plus = h('button.btn.icon-btn', '+');
      tap(minus, () => { if (cur > 0) { cur--; refresh(); } });
      tap(plus, () => { if (cur < max) { cur++; refresh(); } });
      const embark = h('button.btn.primary.big', 'Embark');
      tap(embark, async () => {
        if (g.run) {
          const ok = await confirmBox('An expedition is already under way. Setting out anew abandons it, and the Crown will count it a death.', { yes: 'Abandon it', danger: true });
          if (!ok) return;
          g.abandonRun();
        }
        ui(g).lastHero = id;
        ui(g).asc = ui(g).asc || {};
        ui(g).asc[id] = cur;
        g.saveMeta();
        try { g.newRun(id, cur, randomSeed()); } catch (e) { console.error('newRun failed', e); toast('The Crown refuses. (' + e.message + ')', 'warn'); return; }
        UI.inRun = true;
        UI.hubShown = true;
        sfx('bell');
        UI.render();
      }, { sound: 'confirm' });
      const asc2 = h('div.asc-box',
        h('div.asc-title', 'Crown Weight'),
        max > 0 ? h('div.asc-row', minus, ascVal, plus) : h('div.asc-row', ascVal),
        ascDesc,
        max === 0 ? h('div.asc-note', 'Win an expedition to raise the weight.') : null,
        embark);
      detail.appendChild(asc2);
      refresh();
    } else {
      detail.append(art, h('div.hd-info.locked',
        h('div.hd-name', '???'),
        h('p.hd-blurb', 'This heir has not yet answered the Crown.'),
        h('div.hd-unlock', h('span.lock', icon('ui_lock', 1.5, '', '⚿')), h('span', UNLOCK_HINT[id] || 'Keep walking.'))));
    }
    const sel = h('div.hero-main', tabs, detail);
    scr.append(h('div.hub-back', backBtn('Waystone', () => UI.go('hub'))), sel);
    root.appendChild(scr);
  },
  unmount() {},
};

// ------------------------------------------------------------------ chronicle
const CAT_NAMES = { world: 'The World', heirs: 'The Heirs', crown: 'The Crown', bestiary: 'Bestiary', letters: 'Letters' };
const END_NAMES = { crown: ['Long Live the King', 'You took the Crown.'], shatter: ['Ashfall', 'You broke the Crown.'], true: ['The Turning of the Year', 'The heart went home.'] };

const chronicle = {
  name: 'chronicle',
  mount(root, g) { this.g = g; this.root = root; this.tab = this.tab || 'lore'; this.cat = this.cat || null; this.entry = null; this.build(); music(g.run && UI.inRun ? 'hub' : 'hub'); },
  build() {
    const g = this.g, root = this.root;
    clear(root);
    const scr = frame('chronicle', bgStyle('bg_hub'), 'heavy');
    const tabs = h('div.tabs', [['lore', 'Lore'], ['endings', 'Endings'], ['stats', 'Deeds']].map(([k, label]) => {
      const t = h('button.tab' + (this.tab === k ? '.sel' : ''), label, k === 'lore' && unreadCount(g) ? h('i.dot', String(unreadCount(g))) : null);
      tap(t, () => { this.tab = k; this.entry = null; this.build(); });
      return t;
    }));
    const body = h('div.chron-body');
    if (this.tab === 'lore') this.buildLore(body);
    else if (this.tab === 'endings') this.buildEndings(body);
    else this.buildStats(body);
    const back = backBtn(UI.chronFrom === 'title' ? 'Title' : 'Waystone', () => UI.go(UI.chronFrom || 'hub'));
    scr.append(h('div.meta-head', back, h('div.meta-title', 'The Chronicle'), tabs), body);
    root.appendChild(scr);
  },
  buildLore(body) {
    const g = this.g;
    const read = (ui(g).loreRead = ui(g).loreRead || {});
    const all = Object.values(LORE);
    const cats = [...new Set(all.map((l) => l.cat || 'world'))];
    const list = h('div.lore-list');
    const text = h('div.lore-text');
    const showEntry = (l) => {
      this.entry = l.id;
      if (!read[l.id]) { read[l.id] = 1; g.saveMeta(); }
      clear(text);
      text.append(h('div.lore-title', l.title), h('div.lore-body.prose', { html: prose(l.text) }));
      anim(text, [{ opacity: 0 }, { opacity: 1 }], 250);
      for (const el of list.querySelectorAll('.lore-item')) { el.classList.toggle('sel', el.dataset.id === l.id); if (el.dataset.id === l.id) { el.classList.remove('unread'); const d = el.querySelector('.dot'); if (d) d.remove(); } }
    };
    let total = 0, got = 0;
    for (const cat of Object.keys(CAT_NAMES).filter((c) => cats.includes(c)).concat(cats.filter((c) => !CAT_NAMES[c]))) {
      const entries = all.filter((l) => (l.cat || 'world') === cat);
      total += entries.length;
      const unlocked = entries.filter((l) => g.meta.lore[l.id]);
      got += unlocked.length;
      list.appendChild(h('div.lore-cat', h('span', CAT_NAMES[cat] || cap(cat)), h('small', `${unlocked.length}/${entries.length}`)));
      for (const l of entries) {
        const un = !!g.meta.lore[l.id];
        const item = h('button.lore-item' + (un ? '' : '.locked') + (un && !read[l.id] ? '.unread' : ''), un ? l.title : '— — —', un && !read[l.id] ? h('i.dot', '') : null);
        item.dataset.id = l.id;
        if (un) tap(item, () => showEntry(l), { sound: 'page' });
        list.appendChild(item);
      }
    }
    if (!total) list.appendChild(h('div.empty-note', 'No tales are yet recorded.'));
    else if (!got) text.appendChild(h('div.empty-note', 'Nothing has been written down yet. Walk the road, and listen.'));
    else {
      const first = all.find((l) => this.entry === l.id && g.meta.lore[l.id]);
      if (first) showEntry(first); else text.appendChild(h('div.empty-note', 'Choose an entry to read.'));
    }
    body.append(list, text);
  },
  buildEndings(body) {
    const g = this.g;
    const grid = h('div.endings');
    for (const [k, [name, sub]] of Object.entries(END_NAMES)) {
      const n = g.meta.endings[k] || 0;
      const heroes = Object.keys(HEROES).filter((id) => g.meta.endings[k + '_' + id]);
      grid.appendChild(h('div.ending-card' + (n ? '' : '.locked'),
        h('div.ec-name', n ? name : '???'),
        h('div.ec-sub', n ? sub : 'Undiscovered.'),
        n ? h('div.ec-count', `Reached ${n} time${n > 1 ? 's' : ''}`) : null,
        n ? h('div.ec-heroes', heroes.map((id) => h('span', HEROES[id].name.split(' ')[0]))) : null));
    }
    body.appendChild(grid);
  },
  buildStats(body) {
    const g = this.g, m = g.meta;
    const rows = [
      ['Expeditions', m.runs], ['Crowned', m.wins], ['Fallen', m.deaths], ['Time on the road', fmtTime(m.playtime)],
      ['Bosses felled', Object.values(m.bossesDefeated || {}).reduce((a, b) => a + b, 0)],
      ['Cards found', Object.keys(m.seen.cards || {}).length], ['Relics found', Object.keys(m.seen.relics || {}).length],
      ['Foes met', Object.keys(m.seen.enemies || {}).length], ['Lore recovered', Object.keys(m.lore || {}).length],
    ];
    const killers = Object.entries(m.deathsBy || {}).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, n]) => {
      const nm = ENCOUNTERS[k] ? ENCOUNTERS[k].name || k : String(k).replace(/^event:/, '');
      return h('div.stat', h('span.st-k', nm), h('span.st-v', String(n)));
    });
    const hs = Object.keys(HEROES).map((id) => {
      const M = m.heroes[id] || {};
      return h('div.stat', h('span.st-k', HEROES[id].name.split(' ')[0]), h('span.st-v', `Lv ${M.level || 0} · ${M.wins || 0}/${M.runs || 0}`));
    });
    body.appendChild(h('div.stats-cols',
      h('div.panel', h('div.panel-title', 'Deeds'), h('div.stats-grid', rows.map(([k, v]) => h('div.stat', h('span.st-k', k), h('span.st-v', String(v ?? 0)))))),
      h('div.panel', h('div.panel-title', 'Heirs'), h('div.stats-grid', hs), killers.length ? [h('div.panel-title.sub', 'Most feared'), h('div.stats-grid', killers)] : null)));
  },
  unmount() {},
};

// ------------------------------------------------------------------ compendium
const compendium = {
  name: 'compendium',
  mount(root, g) { this.g = g; this.root = root; this.tab = this.tab || 'cards'; this.hero = this.hero || Object.keys(HEROES)[0]; this.build(); music('hub'); },
  build() {
    const g = this.g, root = this.root;
    clear(root);
    const scr = frame('compendium', bgStyle('bg_hub'), 'heavy');
    const tabs = h('div.tabs', [['cards', 'Cards'], ['relics', 'Relics'], ['potions', 'Tinctures'], ['bestiary', 'Bestiary']].map(([k, label]) => {
      const t = h('button.tab' + (this.tab === k ? '.sel' : ''), label);
      tap(t, () => { this.tab = k; this.build(); });
      return t;
    }));
    const body = h('div.comp-body');
    const grid = h('div.comp-grid');
    const sub = h('div.comp-sub');
    if (this.tab === 'cards') this.buildCards(sub, grid);
    else if (this.tab === 'relics') this.buildRelics(sub, grid);
    else if (this.tab === 'potions') this.buildPotions(sub, grid);
    else this.buildBestiary(sub, grid);
    body.append(sub, h('div.comp-scroll', grid));
    scr.append(h('div.meta-head', backBtn('Waystone', () => UI.go('hub')), h('div.meta-title', 'Compendium'), tabs), body);
    root.appendChild(scr);
  },
  heroSeen(id) { const M = this.g.meta.heroes[id]; return !!(M && M.unlocked); },
  buildCards(sub, grid) {
    const g = this.g;
    const owners = [...Object.keys(HEROES), 'neutral', 'curse'];
    sub.append(...owners.map((o) => {
      const b = h('button.chip' + (this.hero === o ? '.sel' : ''), HEROES[o] ? HEROES[o].name.split(' ')[0] : o === 'neutral' ? 'Neutral' : 'Curses');
      tap(b, () => { this.hero = o; this.build(); });
      return b;
    }));
    const RO = { starter: 0, common: 1, uncommon: 2, rare: 3, special: 4, curse: 5 };
    const list = Object.values(CARDS).filter((c) => c.hero === this.hero && c.type !== 'status').sort((a, b) => (RO[a.rarity] ?? 9) - (RO[b.rarity] ?? 9) || a.name.localeCompare(b.name));
    const seen = (c) => g.meta.seen.cards[c.id] || (c.rarity === 'starter' && this.heroSeen(c.hero));
    const n = list.filter(seen).length;
    sub.appendChild(h('div.comp-count', `${n}/${list.length} discovered`));
    for (const c of list) {
      const card = { uid: 'cp_' + c.id, id: c.id, up: 0 };
      if (seen(c)) {
        const cell = h('div.cg-cell', cardEl(card, { g, width: 88 }));
        tap(cell, () => zoomCard(g, card, { live: false }), { sound: 'cardHover' });
        grid.appendChild(cell);
      } else grid.appendChild(h('div.cg-cell', h('div.card.silhouette', { style: { fontSize: '8.8px' } }, h('span', '?'))));
    }
    if (!list.length) grid.appendChild(h('div.empty-note', 'No cards are recorded here yet.'));
  },
  buildRelics(sub, grid) {
    const g = this.g;
    const list = Object.values(RELICS).sort((a, b) => ['starter', 'common', 'uncommon', 'rare', 'boss', 'shop', 'special'].indexOf(a.rarity) - ['starter', 'common', 'uncommon', 'rare', 'boss', 'shop', 'special'].indexOf(b.rarity) || a.name.localeCompare(b.name));
    const seen = (r) => g.meta.seen.relics[r.id] || (r.rarity === 'starter' && r.hero && this.heroSeen(r.hero));
    sub.appendChild(h('div.comp-count', `${list.filter(seen).length}/${list.length} discovered`));
    for (const r of list) {
      const un = seen(r);
      const el = h('button.comp-tile.relic' + (un ? '' : '.locked'), un ? relicIcon(r, 2.5) : relicIcon(r, 2.5, 'silhouette'), h('span.ct-name', un ? r.name : '???'));
      if (un) infoTip(el, () => relicTip({ id: r.id }));
      grid.appendChild(el);
    }
    if (!list.length) grid.appendChild(h('div.empty-note', 'No relics are recorded yet.'));
  },
  buildPotions(sub, grid) {
    const g = this.g;
    const list = Object.values(POTIONS).sort((a, b) => a.name.localeCompare(b.name));
    const seen = (p) => g.meta.seen.potions[p.id];
    sub.appendChild(h('div.comp-count', `${list.filter(seen).length}/${list.length} discovered`));
    for (const p of list) {
      const un = seen(p);
      const el = h('button.comp-tile.potion' + (un ? '' : '.locked'), un ? potionIcon(p, 2.5) : potionIcon(p, 2.5, 'silhouette'), h('span.ct-name', un ? p.name : '???'));
      if (un) infoTip(el, () => potionTip(p));
      grid.appendChild(el);
    }
    if (!list.length) grid.appendChild(h('div.empty-note', 'No tinctures are recorded yet.'));
  },
  buildBestiary(sub, grid) {
    const g = this.g;
    const list = Object.values(ENEMIES).sort((a, b) => (a.act || 0) - (b.act || 0) || ['normal', 'elite', 'boss'].indexOf(a.kind) - ['normal', 'elite', 'boss'].indexOf(b.kind) || a.name.localeCompare(b.name));
    const seen = (e) => g.meta.seen.enemies[e.id];
    sub.appendChild(h('div.comp-count', `${list.filter(seen).length}/${list.length} encountered`));
    for (const e of list) {
      if (!seen(e)) { grid.appendChild(h('div.comp-tile.enemy.locked', h('div.ct-art', h('span.q', '?')), h('span.ct-name', '???'))); continue; }
      const info = sprInfo(e.sprite || 'en_' + e.id);
      const k = Math.min(1.5, 70 / Math.max(1, info.h), 90 / Math.max(1, info.w));
      const el = h('button.comp-tile.enemy.k-' + e.kind, h('div.ct-art', spr(e.sprite || 'en_' + e.id, k)), h('span.ct-name', e.name));
      infoTip(el, () => ({ title: `${e.name} · ${cap(e.kind)}${e.act ? ` · Act ${ROMAN[e.act] || e.act}` : ''}`, text: e.desc || 'Little is known.', sub: `Health: ${Array.isArray(e.hp) ? e.hp.join('–') : e.hp}` }));
      grid.appendChild(el);
    }
    if (!list.length) grid.appendChild(h('div.empty-note', 'No creatures are recorded yet.'));
  },
  unmount() {},
};

export const metaScreens = { title, hub, heroes, chronicle, compendium };
