// Non-combat run screens: blessing, rewards, boss relic, rest, shop, treasure,
// event, act intro, throne room, ending, death.
import { CARDS, RELICS, POTIONS, HEROES, TEXTS, EVENTS, ENCOUNTERS, ENEMIES, LORE } from '../engine/registry.js';
import { RENOWN_LEVELS } from '../engine/run.js';
import { h, clear, tap, longPress, UI, ROMAN, safe, anim, pickRandom, fmtTime, sleep, cap } from './core.js';
import { spr, sprFit, icon, bgStyle, relicIcon, potionIcon, hasSprite } from './gfx.js';
import { cardEl } from './card.js';
import { prose, inline, splitChoice } from './text.js';
import { topbar, relicTip, potionTip } from './topbar.js';
import { tip, infoTip, toast, modal, zoomCard, chooseCards, menuAt, confirmBox } from './overlay.js';
import { particlesOn, screenFlash, floatText } from './fx.js';
import { actTitle } from './map.js';
import { sfx, music } from './sound.js';

const portraitOf = (who) => {
  if (!who) return null;
  if (HEROES[who]) return 'portrait_' + who;
  return 'npc_' + who;
};

function roomShell(g, cls, bg, opts = {}) {
  const scr = h('div.screen.room.' + cls);
  scr.appendChild(h('div.bleed.bg', { style: { background: bg } }));
  scr.appendChild(h('div.bleed.room-shade' + (opts.shade ? '.' + opts.shade : '')));
  if (opts.topbar !== false && g.run) scr.appendChild(topbar(g));
  const body = h('div.room-body');
  scr.appendChild(body);
  return { scr, body };
}

const actBg = (g) => bgStyle('bg_act' + Math.min(4, (g.run && g.run.act) || 1));

function portrait(id, size = 120, cls = '') {
  return h('div.portrait' + (cls ? '.' + cls : ''), { style: { width: size + 'px', height: size + 'px' } }, sprFit(id, size - 12, size - 12, 'pt-img'));
}

// Simple full-rebuild screen helper.
function simple(name, build, opts = {}) {
  return {
    name,
    mount(root, g) { this.root = root; this.g = g; this.sig = null; if (opts.music) music(typeof opts.music === 'function' ? opts.music(g) : opts.music); this.update(g, true); },
    update(g, first) {
      const sig = opts.sig ? opts.sig(g) : null;
      if (!first && sig != null && sig === this.sig) { if (opts.patch) opts.patch(this.root, g); return; }
      this.sig = sig;
      clear(this.root);
      this.root.appendChild(build(g, this, first));
    },
    unmount() {},
  };
}

// ------------------------------------------------------------------ blessing
const blessing = simple('blessing', (g, self) => {
  const run = g.run;
  const { scr, body } = roomShell(g, 'blessing', bgStyle('bg_hub'), { shade: 'heavy' });
  const opts = run.blessing || [];
  let busy = false;
  const list = h('div.bless-list', opts.map((b, i) => {
    const btn = h('button.choice' + (b.cost ? '.cost' : '') + (b.id === 'none' ? '.plain' : ''), h('span.ch-text', { html: inline(b.label, true) }));
    tap(btn, async () => {
      if (busy) return;
      busy = true;
      list.classList.add('busy');
      try { await g.chooseBlessing(i); } catch (e) { console.error(e); }
      busy = false;
      list.classList.remove('busy');
      UI.render();
    }, { sound: 'select' });
    return btn;
  }));
  body.appendChild(h('div.bless-wrap',
    h('div.npc-col', portrait('npc_hob', 132, 'framed'), h('div.npc-name', 'Hob the Gravekeeper')),
    h('div.bless-main',
      h('div.speech', h('p', { html: inline(safe(() => TEXTS.blessing_line, null) || '“Grave goods. The dead won’t miss them, and you’ll be back for the rest soon enough. Take one.”') })),
      list)));
  return scr;
}, { music: 'hub', sig: (g) => (g.run.blessing ? 'b' : 'x') });

// ------------------------------------------------------------------ rewards
function rewardItemEl(g, it, i) {
  if (it.type === 'gold') return h('button.reward-item.gold', icon('ui_gold', 2, 'ri-ic', '●'), h('span.ri-label', `${it.n} Gold`));
  if (it.type === 'potion') { const d = POTIONS[it.id]; return h('button.reward-item.potion', potionIcon(d, 2, 'ri-ic'), h('span.ri-label', d ? d.name : it.id)); }
  if (it.type === 'relic') { const d = RELICS[it.id]; return h('button.reward-item.relic', relicIcon(d, 2, 'ri-ic'), h('span.ri-label', d ? d.name : it.id), d ? h('span.ri-sub', { html: inline(d.desc, true) }) : null); }
  if (it.type === 'card') return h('button.reward-item.card', h('span.ri-cardback'), h('span.ri-label', 'Add a card to your deck'));
  return h('button.reward-item', h('span.ri-label', it.type));
}

async function openCardReward(g, i) {
  const it = g.run.reward && g.run.reward.items[i];
  if (!it || it.type !== 'card') return;
  const cards = it.options.map((o, j) => ({ uid: 'rw' + i + '_' + j, id: o.id, up: o.up ? 1 : 0 }));
  if (!cards.length) { g.pickRewardCard(i, null); return; }
  const res = await chooseCards(g, { cards, count: 1, min: 0, offer: true, title: 'Choose a card' });
  if (res && res.length) {
    const j = cards.indexOf(res[0]);
    sfx('select');
    g.pickRewardCard(i, j);
  }
}

const reward = simple('reward', (g) => {
  const run = g.run;
  const rw = run.reward || { items: [] };
  const { scr, body } = roomShell(g, 'reward', actBg(g), { shade: 'heavy' });
  const title = rw.kind === 'treasure' ? 'Treasure' : rw.boss ? 'The Master Falls' : rw.kind === 'elite' ? 'Spoils of the Elite' : 'Spoils';
  const list = h('div.reward-list');
  rw.items.forEach((it, i) => {
    const el = rewardItemEl(g, it, i);
    if (it.type === 'card') tap(el, () => openCardReward(g, i), { sound: 'open' });
    else tap(el, () => { g.takeReward(i); }, { sound: it.type === 'gold' ? 'gold' : 'select' });
    if (it.type === 'relic') longPress(el, () => tip(el, relicTip({ id: it.id })));
    if (it.type === 'potion') longPress(el, () => tip(el, potionTip(POTIONS[it.id])));
    list.appendChild(el);
  });
  if (!rw.items.length) list.appendChild(h('div.empty-note', 'Nothing left to take.'));
  const proceed = h('button.btn.primary.proceed', rw.items.length ? 'Proceed' : 'Continue');
  tap(proceed, async () => {
    if (rw.items.some((x) => x.type === 'card' || x.type === 'relic')) {
      const ok = await confirmBox('Leave the remaining spoils behind?', { yes: 'Leave them', no: 'Stay' });
      if (!ok) return;
    }
    await g.leaveReward();
    UI.render();
  });
  body.appendChild(h('div.panel.reward-panel', h('div.panel-title', title), list, h('div.panel-foot', proceed)));
  return scr;
}, { sig: (g) => JSON.stringify(g.run.reward && g.run.reward.items) + g.run.gold + g.run.potions.join() });

// ------------------------------------------------------------------ boss relic
const bossRelic = simple('bossRelic', (g) => {
  const run = g.run;
  const { scr, body } = roomShell(g, 'bossrelic', actBg(g), { shade: 'heavy' });
  let sel = -1;
  const ids = run.bossRelics || [];
  const takeBtn = h('button.btn.primary.disabled', 'Take');
  const tiles = ids.map((id, i) => {
    const d = RELICS[id];
    const t = h('button.boss-relic', h('div.br-icon', relicIcon(d, 3.5)), h('div.br-name', d ? d.name : id), h('div.br-desc', { html: d ? inline(d.desc, true) : '' }));
    tap(t, () => {
      if (sel === i) { take(); return; }
      sel = i;
      tiles.forEach((x, j) => x.classList.toggle('sel', j === i));
      takeBtn.classList.remove('disabled');
    }, { sound: 'select' });
    return t;
  });
  const take = () => { if (sel < 0) return; sfx('relic'); g.chooseBossRelic(sel); UI.render(); };
  tap(takeBtn, take);
  const skip = h('button.btn', { onTap: async () => { if (await confirmBox('Walk on without a boss relic?', { yes: 'Walk on' })) { g.chooseBossRelic(null); UI.render(); } } }, 'Skip');
  body.appendChild(h('div.panel.boss-panel', h('div.panel-title', 'Choose a Boss Relic'), h('div.panel-sub', 'Great power, at a price.'),
    h('div.br-row', tiles.length ? tiles : h('div.empty-note', 'The hoard is empty.')), h('div.panel-foot', skip, takeBtn)));
  return scr;
}, { sig: (g) => (g.run.bossRelics || []).join() });

// ------------------------------------------------------------------ rest
const ICON_FOR_REST = { rest: ['map_rest', '♨'], smith: ['art_greatsword', '⚒'], leave: ['ui_back', '➤'] };
function restIcon(o) {
  if (ICON_FOR_REST[o.id] && !o.relic) { const [id, gl] = ICON_FOR_REST[o.id]; return icon(id, 2.5, '', gl); }
  if (o.icon && hasSprite('rl_' + o.icon)) return spr('rl_' + o.icon, 2.5, '', o.relic && RELICS[o.relic] && RELICS[o.relic].tint ? { c: RELICS[o.relic].tint } : undefined);
  if (o.relic) return relicIcon(RELICS[o.relic], 2.5);
  return icon('missing', 2.5, '', '✦');
}

const rest = simple('rest', (g) => {
  const run = g.run;
  const { scr, body } = roomShell(g, 'rest', actBg(g), { shade: 'night' });
  const H = HEROES[run.hero];
  const line = pickRandom(safe(() => TEXTS.rest_lines[run.hero], null)) || 'The fire is small, and the dark is large. It will do.';
  const fire = h('div.campfire', h('div.cf-glow'), h('div.cf-logs'), h('div.cf-flame.f1'), h('div.cf-flame.f2'), h('div.cf-flame.f3'));
  const hero = h('div.rest-hero', spr((H && H.sprite) || 'hero_' + run.hero, 2.2));
  const opts = safe(() => g.restOptions(), []);
  const done = run.rest && run.rest.done;
  let busy = false;
  const btns = h('div.rest-opts', opts.map((o) => {
    const ic = restIcon(o);
    const b = h('button.rest-opt' + (o.disabled || done ? '.disabled' : '') + (done && run.rest.did === o.id ? '.did' : ''), h('div.ro-ic', ic), h('div.ro-label', o.label), h('div.ro-desc', { html: inline(o.desc || '', true) }));
    tap(b, async () => {
      if (busy || done) return;
      busy = true;
      try { await g.restAction(o.id); } catch (e) { console.error(e); }
      busy = false;
      if (g.run && g.run.rest && g.run.rest.done) { particlesOn(fire, 'ember', { n: 24 }); }
      UI.render();
    }, { sound: 'select' });
    return b;
  }));
  const cont = h('button.btn.primary.proceed' + (done ? '' : '.ghost'), done ? 'Continue' : 'Leave');
  tap(cont, async () => {
    if (!done && !(await confirmBox('Leave the fire without resting?', { yes: 'Leave' }))) return;
    g.leaveRoom(); UI.render();
  });
  body.appendChild(h('div.rest-wrap',
    h('div.rest-scene', hero, fire),
    h('div.rest-main',
      h('div.room-title', 'Rest Site'),
      h('p.rest-line', { html: `<i>“${inline(line)}”</i>` }),
      btns,
      h('div.panel-foot', cont))));
  return scr;
}, { music: 'rest', sig: (g) => JSON.stringify(g.run.rest) + g.run.player.hp });

// ------------------------------------------------------------------ shop
const shop = {
  name: 'shop',
  mount(root, g) {
    this.root = root; this.g = g;
    music('shop');
    this.line = pickRandom(safe(() => TEXTS.shop_greet, null)) || 'Back again? Prices haven’t changed. Nothing ever changes.';
    this.build();
  },
  update() { this.build(); },
  unmount() {},
  say(text) { this.line = text; const b = this.root.querySelector('.shop-speech p'); if (b) { b.innerHTML = inline(text); anim(b, [{ opacity: 0 }, { opacity: 1 }], 300); } },
  async buy(kind, i) {
    const g = this.g;
    const ok = await g.buy(kind, i);
    if (ok) { sfx('buy'); this.say(pickRandom(safe(() => TEXTS.shop_buy, null)) || 'A fine choice. They all are, eventually.'); }
    UI.render();
  },
  build() {
    const g = this.g, run = g.run, s = run.shop;
    if (!s) return;
    const root = this.root;
    const scrollTop = root.querySelector('.shop-wares') ? root.querySelector('.shop-wares').scrollTop : 0;
    clear(root);
    const { scr, body } = roomShell(g, 'shop', actBg(g), { shade: 'heavy' });
    const priceEl = (p, sold, sale) => h('div.price' + (run.gold < p ? '.dear' : '') + (sale ? '.sale' : ''), icon('ui_gold', 1, '', '●'), h('span', String(p)));
    // Cards
    const cardsRow = h('div.shop-cards');
    s.cards.forEach((c, i) => {
      const card = { uid: 'shop' + i, id: c.id, up: c.up };
      const cell = h('div.shop-card' + (c.sold ? '.sold' : ''));
      if (!c.sold) {
        cell.appendChild(cardEl(card, { g, width: 74 }));
        cell.appendChild(priceEl(c.price, c.sold, c.sale));
        if (c.sale) cell.appendChild(h('div.sale-tag', 'Sale'));
        tap(cell, () => {
          const can = run.gold >= c.price;
          const buyBtn = h('button.btn.primary' + (can ? '' : '.disabled'), `Buy — ${c.price} gold`);
          const m = zoomCard(g, card, { extra: h('div.zoom-actions', buyBtn) });
          tap(buyBtn, () => { if (!can) { toast('Not enough gold.', 'warn'); return; } m.close(); this.buy('cards', i); }, { onDisabled: () => toast('Not enough gold.', 'warn') });
        }, { sound: 'cardHover' });
      } else cell.appendChild(h('div.sold-mark', 'Sold'));
      cardsRow.appendChild(cell);
    });
    // Relics & potions
    const goods = h('div.shop-goods');
    s.relics.forEach((r, i) => {
      const d = RELICS[r.id];
      const el = h('button.good' + (r.sold ? '.sold' : ''), r.sold ? h('div.sold-mark', 'Sold') : [relicIcon(d, 2.25, 'good-ic'), priceEl(r.price)]);
      if (!r.sold) tap(el, () => {
        const t = relicTip({ id: r.id });
        menuAt(el, d ? d.name : r.id, t.html, [{ label: `Buy — ${r.price}`, cls: 'primary', disabled: run.gold < r.price, onTap: () => run.gold >= r.price ? this.buy('relics', i) : toast('Not enough gold.', 'warn') }]);
      }, { sound: 'cardHover' });
      goods.appendChild(el);
    });
    goods.appendChild(h('div.goods-sep'));
    s.potions.forEach((p, i) => {
      const d = POTIONS[p.id];
      const el = h('button.good.potion' + (p.sold ? '.sold' : ''), p.sold ? h('div.sold-mark', 'Sold') : [potionIcon(d, 2.25, 'good-ic'), priceEl(p.price)]);
      if (!p.sold) tap(el, () => {
        menuAt(el, d ? d.name : p.id, d ? inline(d.desc, true) : '', [{ label: `Buy — ${p.price}`, cls: 'primary', disabled: run.gold < p.price, onTap: () => run.gold >= p.price ? this.buy('potions', i) : toast('Not enough gold.', 'warn') }]);
      }, { sound: 'cardHover' });
      goods.appendChild(el);
    });
    goods.appendChild(h('div.goods-sep'));
    const rm = h('button.good.removal' + (s.removed ? '.sold' : ''),
      s.removed ? h('div.sold-mark', 'Done') : [icon('ui_exhaust', 2, 'good-ic', '✕'), h('div.rm-label', 'Remove a card'), priceEl(s.removePrice)]);
    if (!s.removed) tap(rm, () => {
      if (run.gold < s.removePrice) { toast('Not enough gold.', 'warn'); sfx('error'); return; }
      this.buy('remove');
    });
    goods.appendChild(rm);

    const leave = h('button.btn.primary.proceed', 'Leave');
    tap(leave, () => {
      const l = pickRandom(safe(() => TEXTS.shop_leave, null));
      if (l) toast(`<i>“${inline(l)}”</i>`, 'long');
      g.leaveRoom(); UI.render();
    });
    body.appendChild(h('div.shop-wrap',
      h('div.shop-npc', portrait('npc_peddler', 112, 'framed'), h('div.npc-name', 'The Pale Peddler'), h('div.shop-speech', h('p', { html: inline(this.line) })), leave),
      h('div.shop-wares', h('div.shop-sec', 'Cards'), cardsRow, h('div.shop-sec', 'Relics · Tinctures · Services'), goods)));
    root.appendChild(scr);
    const w = root.querySelector('.shop-wares'); if (w) w.scrollTop = scrollTop;
  },
};

// ------------------------------------------------------------------ treasure
const treasure = simple('treasure', (g) => {
  const run = g.run;
  const t = run.treasure || {};
  const { scr, body } = roomShell(g, 'treasure', actBg(g), { shade: 'heavy' });
  const size = t.size || 'small';
  const chest = h('button.chest.' + size, icon('map_treasure', size === 'large' ? 7 : size === 'medium' ? 6 : 5, 'chest-ic', '▣'), h('div.chest-glow'));
  let opening = false;
  const open = async () => {
    if (opening) return;
    opening = true;
    sfx('chest');
    await anim(chest, [{ transform: 'rotate(0)' }, { transform: 'rotate(-4deg)' }, { transform: 'rotate(4deg)' }, { transform: 'rotate(-3deg)' }, { transform: 'rotate(0) scale(1.08)' }], 500);
    chest.classList.add('open');
    particlesOn(chest, 'gold', { n: 30 });
    screenFlash('#f0d27a', 300);
    await sleep(350);
    g.openChest();
    UI.render();
  };
  tap(chest, open, { sound: false });
  body.appendChild(h('div.treasure-wrap',
    h('div.room-title', size === 'large' ? 'A Great Chest' : size === 'medium' ? 'An Iron-bound Chest' : 'A Small Chest'),
    chest,
    h('button.btn.primary', { onTap: open }, 'Open'),
    h('button.btn.ghost.small', { onTap: () => { g.leaveRoom(); UI.render(); } }, 'Leave it be')));
  return scr;
}, { sig: () => 't' });

// ------------------------------------------------------------------ event
const event = {
  name: 'event',
  mount(root, g) { this.root = root; this.g = g; this.key = null; this.busy = false; music('act' + Math.min(4, g.run.act)); this.update(g); },
  update(g) {
    const ev = g.run.event;
    const page = safe(() => g.eventPage(), null);
    const key = ev ? ev.id + ':' + ev.page + ':' + (page ? page.text : '') : 'none';
    if (key === this.key) { this.patch(g, page); return; }
    const fresh = this.key == null || (this.key.split(':')[0] !== (ev && ev.id));
    this.key = key;
    clear(this.root);
    this.root.appendChild(this.build(g, ev, page, fresh));
  },
  unmount() {},
  patch(g, page) {
    // Refresh topbar + choice availability without replaying the text fade.
    const tb = this.root.querySelector('.topbar');
    if (tb) tb.replaceWith(topbar(g));
    if (!page) return;
    const btns = this.root.querySelectorAll('.ev-choices .choice');
    page.choices.forEach((c, j) => { const b = btns[j]; if (b) b.classList.toggle('disabled', !!c.disabled); });
  },
  build(g, ev, page, fresh) {
    const def = ev && EVENTS[ev.id];
    const { scr, body } = roomShell(g, 'event', actBg(g), { shade: 'heavy' });
    if (!page) {
      body.appendChild(h('div.panel.ev-missing', h('div.panel-title', 'The fog closes in'), h('p', 'Whatever was here is gone.'), h('button.btn.primary', { onTap: () => { g.leaveRoom(); UI.render(); } }, 'Walk on')));
      return scr;
    }
    const artId = page.art && hasSprite(page.art) ? page.art : (def && def.art && hasSprite(def.art) ? def.art : null);
    const art = h('div.ev-art', artId ? sprFit(artId, 300, 200, 'ev-img') : h('div.ev-noart', icon('map_event', 4, '', '?')));
    const textEl = h('div.ev-text.prose', { html: prose(page.text) });
    if (fresh || true) [...textEl.children].forEach((p, i) => { p.classList.add('fade-p'); p.style.animationDelay = (i * 0.28) + 's'; });
    const speaker = page.speaker ? portraitOf(page.speaker) : null;
    const choices = h('div.ev-choices', page.choices.map((c, j) => {
      const { verb, rest } = splitChoice(c.label);
      const b = h('button.choice' + (c.disabled ? '.disabled' : ''),
        verb ? h('span.ch-verb', verb) : null,
        h('span.ch-text', { html: inline(rest, true) }),
        c.disabled && c.why ? h('span.ch-why', c.why) : null);
      b.style.animationDelay = (textEl.children.length * 0.28 + j * 0.08) + 's';
      tap(b, async () => {
        if (this.busy) return;
        this.busy = true;
        this.root.classList.add('busy');
        try { await g.eventChoose(c.i); } catch (e) { console.error('event choice failed', e); toast('The moment passes.', 'warn'); }
        this.busy = false;
        if (this.root) this.root.classList.remove('busy');
        UI.render();
      }, { sound: 'page', onDisabled: () => { if (c.why) toast(c.why, 'warn'); sfx('error'); } });
      return b;
    }));
    body.appendChild(h('div.ev-wrap',
      h('div.ev-left', h('div.ev-frame', art)),
      h('div.ev-page',
        h('div.ev-head', speaker ? h('div.ev-speaker', sprFit(speaker, 40, 40)) : null, h('div.ev-title', page.title || (def && def.title) || 'Event')),
        h('div.ev-scroll', textEl, choices))));
    return scr;
  },
};

// ------------------------------------------------------------------ act intro
const actIntro = simple('actIntro', (g) => {
  const act = g.run.act;
  const intro = safe(() => TEXTS.act_intro[act], null) || {};
  const scr = h('div.screen.room.act-intro');
  scr.appendChild(h('div.bleed.bg', { style: { background: bgStyle('bg_act' + Math.min(4, act)) } }));
  scr.appendChild(h('div.bleed.room-shade.heavy'));
  const begin = h('button.btn.primary', 'Begin');
  tap(begin, () => { g.beginAct(); UI.render(); });
  scr.appendChild(h('div.ai-wrap',
    h('div.ai-act', act === 4 ? 'Act IV' : `Act ${ROMAN[act] || act}`),
    h('div.ai-title', intro.title || actTitle(act)),
    h('div.ai-rule'),
    h('div.ai-text.prose', { html: prose(intro.text || '') }),
    begin));
  return scr;
}, { music: (g) => 'act' + Math.min(4, g.run.act), sig: (g) => 'a' + g.run.act });

// ------------------------------------------------------------------ throne
const throne = simple('throne', (g) => {
  const scr = h('div.screen.room.throne');
  scr.appendChild(h('div.bleed.bg', { style: { background: bgStyle('bg_throne', 'radial-gradient(ellipse at 50% 30%, #3a2a1a 0%, #140f0c 70%)') } }));
  scr.appendChild(h('div.bleed.room-shade'));
  scr.appendChild(topbar(g));
  const opts = safe(() => g.throneOptions(), []);
  let busy = false;
  const text = safe(() => TEXTS.throne_text, null) || 'The throne room is cold. Ash drifts through a broken window and settles on the dais, where the Hollow Crown lies on its side, as if it had rolled there a moment ago and is only now coming to rest.\n\nIt is waiting. It has always been waiting.';
  scr.appendChild(h('div.throne-wrap',
    h('div.room-title.big', 'The Throne Room'),
    h('div.throne-text.prose', { html: prose(text) }),
    h('div.throne-opts', opts.map((o) => {
      const b = h('button.choice.throne-opt' + (o.disabled ? '.disabled' : ''), h('span.ch-verb', o.label), h('span.ch-text', o.desc || ''), o.disabled && o.why ? h('span.ch-why', o.why) : null);
      tap(b, async () => { if (busy || o.disabled) return; busy = true; sfx('bell'); await g.throneChoose(o.id); busy = false; UI.render(); }, { sound: false, onDisabled: () => { if (o.why) toast(o.why, 'warn'); } });
      return b;
    }))));
  return scr;
}, { music: 'act3', sig: () => 'throne' });

// ------------------------------------------------------------------ stats helpers
function statsGrid(run) {
  const s = run.stats || {};
  const rows = [
    ['Floors climbed', s.floors], ['Foes slain', s.kills], ['Elites', s.elites], ['Bosses', s.bosses],
    ['Cards played', s.cardsPlayed], ['Damage taken', s.damageTaken], ['Gold earned', s.goldEarned], ['Tinctures used', s.potionsUsed],
    ['Events', s.events], ['Time', fmtTime(Date.now() - (s.start || Date.now()))],
  ];
  return h('div.stats-grid', rows.map(([k, v]) => h('div.stat', h('span.st-k', k), h('span.st-v', String(v ?? 0)))));
}

function renownBlock(g) {
  const lr = g.meta.lastRun;
  const hero = g.run ? g.run.hero : lr && lr.hero;
  const H = hero && g.meta.heroes[hero];
  if (!lr || !H) return null;
  const lvl = H.level || 0;
  const cur = RENOWN_LEVELS[lvl] ?? 0, next = RENOWN_LEVELS[lvl + 1];
  const p = next ? Math.max(0, Math.min(1, (H.renown - cur) / (next - cur))) : 1;
  const fill = h('div.rn-fill', { style: { transform: `scaleX(${p})` } });
  return h('div.renown',
    h('div.rn-head', h('span', 'Renown'), h('span.rn-gain', `+${lr.renown || 0}`)),
    h('div.rn-bar', fill),
    h('div.rn-sub', next ? `Level ${lvl} · ${H.renown - cur}/${next - cur} to level ${lvl + 1}` : `Level ${lvl} · Renown mastered`),
    lr.levelUp ? h('div.rn-up', `Renown level ${lr.levelUp}! New cards and relics join the pool.`) : null);
}

function unlockNotes(g) {
  const meta = g.meta;
  meta.ui = meta.ui || {};
  const known = meta.ui.knownUnlocks || (meta.ui.knownUnlocks = { knight: 1 });
  const notes = [];
  for (const id of Object.keys(meta.heroes)) {
    if (meta.heroes[id].unlocked && !known[id] && HEROES[id]) { notes.push(`A new heir answers the Crown: <b>${HEROES[id].name}</b>, ${HEROES[id].title}.`); known[id] = 1; }
  }
  if (notes.length) g.saveMeta();
  return notes.length ? h('div.unlocks', notes.map((n) => h('div.unlock', { html: n }))) : null;
}

function killerName(g) {
  const lr = g.meta.lastRun;
  const k = lr && lr.killer;
  if (!k) return null;
  if (ENCOUNTERS[k]) return ENCOUNTERS[k].name || (Array.isArray(ENCOUNTERS[k].enemies) ? ENEMIES[ENCOUNTERS[k].enemies[0]]?.name : null) || 'the road';
  const id = String(k).replace(/^event:/, '');
  if (EVENTS[id]) return EVENTS[id].title;
  return null;
}

function backToWaystone(g) {
  g.closeRun();
  UI.inRun = false;
  UI.view = 'hub';
  UI.hubShown = false;
  UI.render();
}

// ------------------------------------------------------------------ death
const death = simple('death', (g) => {
  const run = g.run;
  const line = pickRandom(safe(() => TEXTS.death_lines, null)) || 'Again.';
  const scr = h('div.screen.room.death');
  scr.appendChild(h('div.bleed.death-bg'));
  const kn = killerName(g);
  const H = HEROES[run.hero];
  const rise = h('button.btn.primary', 'Rise again');
  tap(rise, () => backToWaystone(g));
  scr.appendChild(h('div.death-wrap',
    h('div.death-left',
      h('div.crown-line', { html: `“${inline(line)}”` }),
      h('div.crown-by', '— the Hollow Crown'),
      h('div.death-title', `${H ? H.name : 'The heir'} has fallen`),
      h('div.death-sub', `Act ${ROMAN[run.act] || run.act}, floor ${run.floor}${kn ? ` · slain by ${kn}` : ''}${run.asc ? ` · Crown Weight ${run.asc}` : ''}`),
      rise),
    h('div.death-right.panel', statsGrid(run), renownBlock(g), unlockNotes(g))));
  return scr;
}, { music: 'death', sig: () => 'death' });

// ------------------------------------------------------------------ ending
const ending = simple('ending', (g) => {
  const run = g.run;
  const e = run.ending || 'crown';
  const E = safe(() => TEXTS.endings[e], null) || {};
  const FALLBACK = { crown: 'Long Live the King', shatter: 'Ashfall', true: 'The Turning of the Year' };
  const text = E[run.hero] || E.default || 'And so it ended, or began.';
  const scr = h('div.screen.room.ending.e-' + e);
  scr.appendChild(h('div.bleed.bg', { style: { background: bgStyle(e === 'true' ? 'bg_title' : 'bg_throne') } }));
  scr.appendChild(h('div.bleed.room-shade.heavy'));
  const home = h('button.btn.primary', 'Return to the Waystone');
  tap(home, () => backToWaystone(g));
  scr.appendChild(h('div.ending-wrap',
    h('div.ending-main',
      h('div.end-kicker', 'Victory'),
      h('div.end-title', E.title || FALLBACK[e] || 'The End'),
      h('div.ai-rule'),
      h('div.end-text.prose', { html: prose(text) })),
    h('div.ending-side.panel', statsGrid(run), renownBlock(g), unlockNotes(g), home)));
  setTimeout(() => sfx('victory'), 300);
  return scr;
}, { music: 'victory', sig: () => 'end' });

export const roomScreens = { blessing, reward, bossRelic, rest, shop, treasure, event, actIntro, throne, death, ending };
