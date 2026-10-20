// Combat screen. Builds a skeleton once, then re-renders regions (hand, entities,
// piles, energy, top bar) coalesced per animation frame. FX are driven by emits.
import { CARDS, ENEMIES, ENCOUNTERS, STATUSES, HEROES, TEXTS } from '../engine/registry.js';
import { MASKS, SPIRITS } from '../engine/combat.js';
import { h, clear, tap, UI, safe, anim, sleep } from './core.js';
import { S, toStage, stageRect } from './scale.js';
import { spr, sprInfo, bgStyle, icon, hasSprite } from './gfx.js';
import { cardEl } from './card.js';
import { cardText, statusDesc, glossaryFor } from './text.js';
import { topbar, TB, updateTopbarStats } from './topbar.js';
import { tip, infoTip, toast, banner, showPile, modalOpen, hideTip } from './overlay.js';
import { floatText, particlesOn, particles, shake, screenShake, flash, pulse, screenFlash, flyGhost } from './fx.js';
import { sfx, music } from './sound.js';

const GROUND = 150;      // design px from stage bottom to the ground line
const CW = 84, CH = 118; // hand card size
const SEL_SCALE = 1.55;

const INTENT_ICON = {
  atk: ['in_atk'], atkdef: ['in_atk', 'in_def'], atkbuff: ['in_atk', 'in_buff'], atkdebuff: ['in_atk', 'in_debuff'],
  def: ['in_def'], buff: ['in_buff'], debuff: ['in_debuff'], defbuff: ['in_def', 'in_buff'], strongdebuff: ['in_strongdebuff'],
  summon: ['in_summon'], heal: ['in_heal'], sleep: ['in_sleep'], flee: ['in_flee'], unknown: ['in_unknown'], special: ['in_special'],
};
const INTENT_WORD = {
  atk: 'attack', atkdef: 'attack and defend', atkbuff: 'attack and grow stronger', atkdebuff: 'attack and hinder you',
  def: 'defend', buff: 'grow stronger', debuff: 'hinder you', defbuff: 'defend and grow stronger', strongdebuff: 'cast a terrible curse',
  summon: 'call for aid', heal: 'heal', sleep: 'sleep', flee: 'flee', unknown: 'do something unknowable', special: 'do something strange',
};

export const combatScreen = {
  name: 'combat',
  g: null, root: null, cbRef: null,
  els: {}, enemyRecs: new Map(), heroRec: null,
  handEls: new Map(), fresh: new Set(), created: new Set(),
  sel: null, drag: null, potionSlot: null, dying: new Map(),
  dirty: {}, raf: 0, flying: new Map(), confirmEnd: 0, hoverTarget: null,

  mount(root, g) {
    this.g = g; this.root = root; this.cbRef = g.cb;
    this.enemyRecs = new Map(); this.handEls = new Map(); this.fresh = new Set(); this.created = new Set();
    this.dying = new Map(); this.flying = new Map(); this.sel = null; this.drag = null; this.potionSlot = null; this.hoverTarget = null;
    const cb = g.cb;
    // Cards already in hand at mount time animate in from the draw pile.
    for (const c of cb.hand) this.fresh.add(c.uid);
    const act = Math.min(4, g.run.act || 1);
    const scr = h('div.screen.combat');
    scr.appendChild(h('div.bleed.bg', { style: { background: bgStyle('bg_act' + act) } }));
    scr.appendChild(h('div.bleed.vignette'));
    const sr = h('div.shake-root');
    const tb = h('div.tb-wrap');
    const field = h('div.field');
    field.appendChild(h('div.ground-shade'));
    const heroZone = h('div.hero-zone');
    const enemyZone = h('div.enemy-zone');
    field.append(heroZone, enemyZone);
    const hand = h('div.hand-zone');
    const energy = h('div.energy', h('div.en-orb', h('span.en-val', '3/3')));
    const drawBtn = h('button.pile.pile-draw', { 'aria-label': 'Draw pile' }, icon('ui_draw', 2, '', '▤'), h('span.pile-count', '0'), h('span.pile-lbl', 'Draw'));
    const discBtn = h('button.pile.pile-discard', { 'aria-label': 'Discard pile' }, icon('ui_discard', 2, '', '▥'), h('span.pile-count', '0'), h('span.pile-lbl', 'Discard'));
    const exhBtn = h('button.pile-exh', icon('ui_exhaust', 1.5, '', '✕'), h('span', '0'));
    const endBtn = h('button.end-turn', h('span', 'End Turn'));
    const hint = h('div.c-hint');
    sr.append(tb, field, energy, drawBtn, discBtn, exhBtn, endBtn, hand, hint);
    scr.appendChild(sr);
    root.appendChild(scr);
    this.els = { scr, sr, tb, field, heroZone, enemyZone, hand, energy, drawBtn, discBtn, exhBtn, endBtn, hint };

    tap(drawBtn, () => showPile(g, 'Draw Pile', g.cb ? g.cb.draw : [], { sort: true, note: 'Shown in no particular order.' }));
    tap(discBtn, () => showPile(g, 'Discard Pile', g.cb ? g.cb.discard : [], { reverse: true }));
    tap(exhBtn, () => showPile(g, 'Exhausted', g.cb ? g.cb.exhaust : [], {}));
    tap(endBtn, () => this.onEndTurn(), { sound: false });
    field.addEventListener('click', (e) => this.onFieldTap(e));

    TB.onPotionTarget = (slot) => this.startPotionTarget(slot);
    this.buildHero();
    this.renderAll();
    music(cb.kind === 'boss' ? 'boss' : cb.kind === 'elite' ? 'elite' : 'act' + act);
    this.intro();
  },

  async intro() {
    const g = this.g, cb = g.cb;
    if (!cb || cb.turn > 1 || cb.cnt.cards > 0) return;
    const enc = cb.encounter && ENCOUNTERS[cb.encounter];
    if (cb.kind === 'boss' && enc) {
      sfx('bossIntro');
      await banner(enc.name || 'Boss', 'boss', safe(() => TEXTS.boss_intro[cb.encounter], '') || '', 1700);
    } else if (cb.kind === 'elite') {
      sfx('eliteIntro');
      await banner(enc && enc.name ? enc.name : 'Elite', 'elite', '', 1000);
    }
    if (this.g === g && g.cb === cb && cb.turn === 1) banner('Your Turn', 'turn', '', 800);
  },

  unmount() {
    cancelAnimationFrame(this.raf); this.raf = 0;
    TB.onPotionTarget = null;
    this.endDrag(true);
    this.root = null;
  },

  update(g) {
    if (!g.cb) return; // combat just ended; screen will switch after the hold
    if (g.cb !== this.cbRef) { // a different combat (event fight etc.): remount
      const root = this.root; clear(root); this.unmount(); this.mount(root, g); return;
    }
    this.markAll();
  },

  markAll() { this.dirty = { hand: 1, piles: 1, energy: 1, hero: 1, enemies: 1, tb: 1, end: 1 }; this.schedule(); },
  mark(...keys) { for (const k of keys) this.dirty[k] = 1; this.schedule(); },
  schedule() { if (!this.raf) this.raf = requestAnimationFrame(() => { this.raf = 0; this.flush(); }); },

  renderAll() { this.dirty = { hand: 1, piles: 1, energy: 1, hero: 1, enemies: 1, tb: 1, end: 1 }; this.flush(); },

  flush() {
    const g = this.g;
    if (!this.root || !g.run || !g.cb) return;
    const d = this.dirty; this.dirty = {};
    try {
      if (d.tb) { clear(this.els.tb).appendChild(topbar(g)); }
      if (d.enemies) this.renderEnemies();
      if (d.hero) this.renderHero();
      if (d.energy) this.renderEnergy();
      if (d.piles) this.renderPiles();
      if (d.hand) this.renderHand();
      if (d.end || d.hand || d.energy) this.renderEndTurn();
      this.renderHint();
    } catch (e) { console.error('combat render', e); }
  },

  locked() {
    const cb = this.g.cb;
    return !cb || cb.busy || cb.phase !== 'player' || modalOpen() || performance.now() < UI.hold;
  },

  // ------------------------------------------------------------------ entities
  makeEntity(isHero) {
    const root = h('div.entity' + (isHero ? '.hero' : '.enemy'));
    const top = h('div.ent-top');
    const body = h('div.ent-body');
    const img = h('img.px.ent-sprite', { alt: '', draggable: 'false' });
    const fl = h('img.px.ent-flash', { alt: '', draggable: 'false' });
    const reticle = h('div.ent-reticle', h('i'), h('i'), h('i'), h('i'));
    body.append(img, fl, reticle);
    const hpFill = h('div.hp-fill'), hpGhost = h('div.hp-ghost'), hpText = h('span.hp-text');
    const blk = h('div.blk', icon('ui_block', 1.25, 'blk-ic', '◆'), h('span.blk-n'));
    const bar = h('div.ent-bar', h('div.hpbar', hpGhost, hpFill, hpText), blk);
    const st = h('div.ent-st');
    root.append(top, body, bar, st);
    return { root, top, body, img, fl, reticle, bar, hpFill, hpGhost, hpText, blk, blkN: blk.querySelector('.blk-n'), st, stSig: '', topSig: '', intentSig: '', spriteId: null };
  },

  setSprite(rec, id, scale) {
    const info = sprInfo(id);
    if (rec.spriteId !== id) {
      rec.img.src = info.url; rec.fl.src = info.url; rec.spriteId = id;
    }
    const w = Math.round(info.w * scale), hgt = Math.round(info.h * scale);
    if (rec.w !== w || rec.h !== hgt) {
      rec.w = w; rec.h = hgt;
      for (const im of [rec.img, rec.fl]) { im.style.width = w + 'px'; im.style.height = hgt + 'px'; }
      rec.body.style.width = w + 'px'; rec.body.style.height = hgt + 'px';
      rec.root.style.width = Math.max(w, 80) + 'px';
      const bw = Math.max(70, Math.min(120, Math.round(w * 0.85)));
      rec.bar.style.width = bw + 'px';
      rec.st.style.width = Math.max(bw + 16, Math.min(w, 140)) + 'px';
    }
  },

  updateBars(rec, e) {
    const p = Math.max(0, Math.min(1, e.hp / Math.max(1, e.maxHp)));
    rec.hpFill.style.transform = `scaleX(${p})`;
    rec.hpGhost.style.transform = `scaleX(${p})`;
    rec.hpText.textContent = `${Math.max(0, e.hp)}/${e.maxHp}`;
    const b = e.block || 0;
    rec.blk.classList.toggle('on', b > 0);
    rec.bar.classList.toggle('blocking', b > 0);
    rec.blkN.textContent = b;
  },

  renderStatuses(rec, e) {
    const g = this.g;
    const list = Object.keys(e.st || {}).filter((id) => e.st[id] && id !== 'minion' || (id === 'minion' && e.st[id]))
      .filter((id) => !(STATUSES[id] && STATUSES[id].kind === 'oath') && !STATUSES[id]?.hidden);
    const sig = list.map((id) => id + ':' + e.st[id]).join('|');
    if (sig === rec.stSig) return;
    rec.stSig = sig;
    clear(rec.st);
    const max = 7;
    list.slice(0, list.length > max ? max - 1 : max).forEach((id) => rec.st.appendChild(this.statusIcon(e, id)));
    if (list.length > max) {
      const more = h('div.st-ic.more', h('span', '+' + (list.length - max + 1)));
      infoTip(more, () => ({ title: 'Effects', html: list.map((id) => `<b>${STATUSES[id]?.name || id} ${e.st[id]}</b>: ${statusDesc(g, id, e.st[id], e)}`).join('<br>') }));
      rec.st.appendChild(more);
    }
    if (rec.pulse) { for (const id of rec.pulse) { const el = rec.st.querySelector(`[data-st="${id}"]`); if (el) pulse(el, 1.4, 320); } rec.pulse.clear(); }
  },

  statusIcon(e, id) {
    const g = this.g;
    const d = STATUSES[id] || { name: id, kind: 'buff', icon: id };
    const n = e.st[id];
    const el = h('div.st-ic.' + (d.kind === 'debuff' || (d.negOk && n < 0) ? 'debuff' : 'buff'),
      icon('st_' + (d.icon || id), 1.5, '', (d.name || id).slice(0, 1)),
      Math.abs(n) !== 1 || d.negOk || d.decay ? h('span.st-n', String(n)) : null);
    el.dataset.st = id;
    infoTip(el, () => ({ icon: icon('st_' + (d.icon || id), 2, '', ''), title: `${d.name || id}${n !== 1 ? ' ' + n : ''}`, text: statusDesc(g, id, n, e) }));
    return el;
  },

  buildHero() {
    const g = this.g;
    const rec = this.makeEntity(true);
    const H = HEROES[g.run.hero];
    this.setSprite(rec, (H && H.sprite) || 'hero_' + g.run.hero, 2.5);
    rec.oaths = h('div.oaths');
    rec.root.appendChild(rec.oaths);
    rec.body.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (this.trySelectedOnPlayArea()) return;
      const P = g.player;
      const mask = g.cb && g.cb.mask && MASKS[g.cb.mask];
      tip(rec.body, { title: H ? `${H.name}, ${H.title}` : 'You', text: `${P.hp}/${P.maxHp} HP${P.block ? `, ${P.block} Block` : ''}.`, sub: mask ? `<b>${mask.name}</b>: ${mask.desc}` : '' });
    });
    this.els.heroZone.appendChild(rec.root);
    this.heroRec = rec;
  },

  renderHero() {
    const g = this.g, cb = g.cb, P = g.player, rec = this.heroRec;
    if (!rec) return;
    this.updateBars(rec, P);
    this.renderStatuses(rec, P);
    // Top: mask + spirits
    const sig = `${cb.mask}|${cb.slots}|${cb.spirits.join(',')}|${g.st(P, 'soul')}`;
    if (sig !== rec.topSig) {
      rec.topSig = sig;
      clear(rec.top);
      if (cb.mask && MASKS[cb.mask]) {
        const m = MASKS[cb.mask];
        const badge = h('div.mask-badge', spr(m.icon || 'mask_' + cb.mask, 2), h('span', m.name.replace(' Mask', '')));
        infoTip(badge, () => ({ icon: spr(m.icon || 'mask_' + cb.mask, 2), title: m.name, text: m.desc }));
        rec.top.appendChild(badge);
        rec.maskBadge = badge;
      } else rec.maskBadge = null;
      const showSlots = g.run.hero === 'cantor' || cb.spirits.length > 0 || cb.slots !== 3;
      if (showSlots && cb.slots > 0) {
        const slots = h('div.spirits');
        const soul = g.st(P, 'soul');
        for (let i = 0; i < cb.slots; i++) {
          const k = cb.spirits[i];
          const s = h('div.sp-slot' + (k ? '.full' : ''), k ? spr((SPIRITS[k] && SPIRITS[k].icon) || 'sp_' + k, 1.5) : null);
          s.dataset.i = i;
          if (k && SPIRITS[k]) infoTip(s, () => ({ icon: spr(SPIRITS[k].icon || 'sp_' + k, 2), title: SPIRITS[k].name + (i === 0 ? ' (next to Release)' : ''), text: safe(() => SPIRITS[k].desc(soul), '') }));
          else infoTip(s, () => ({ title: 'Empty spirit slot', text: 'Channel a Spirit to fill it. When all slots are full, Channeling Releases the oldest Spirit.' }));
          slots.appendChild(s);
        }
        rec.top.appendChild(slots);
      }
    }
    // Oath trackers
    const oaths = Object.keys(P.st).filter((id) => STATUSES[id] && STATUSES[id].kind === 'oath' && P.st[id]);
    const osig = oaths.map((id) => id + ':' + P.st[id]).join('|');
    if (osig !== rec.oSig) {
      rec.oSig = osig;
      clear(rec.oaths);
      for (const id of oaths) {
        const d = STATUSES[id];
        const el = h('div.oath', icon('st_' + (d.icon || 'oath'), 1.75, '', '✦'), h('span.oath-n', String(P.st[id])), h('span.oath-name', d.name.replace(/^Oath of (the )?/, '')));
        el.dataset.oath = id;
        infoTip(el, () => ({ icon: icon('st_' + (d.icon || 'oath'), 2, '', ''), title: d.name, text: statusDesc(g, id, P.st[id], P), sub: `${P.st[id]} step${P.st[id] > 1 ? 's' : ''} remaining.` }));
        rec.oaths.appendChild(el);
      }
    }
  },

  enemyScale(e) {
    const d = ENEMIES[e.id] || {};
    const base = d.kind === 'boss' ? 1.5 : d.kind === 'elite' ? 1.75 : 2;
    return base * (d.scale || 1);
  },

  renderEnemies() {
    const g = this.g, cb = g.cb;
    const now = performance.now();
    let list = cb.enemies.filter((e) => !e.dead || (this.dying.get(e.uid) || 0) > now || this.enemyRecs.has(e.uid));
    // Keep slots of the fallen so the living do not shuffle around, unless crowded.
    if (list.length > 5) list = list.filter((e) => !e.dead || (this.dying.get(e.uid) || 0) > now);
    const keep = new Set(list.map((e) => e.uid));
    for (const [uid, rec] of this.enemyRecs) if (!keep.has(uid)) { rec.root.remove(); this.enemyRecs.delete(uid); }
    // Fit sprites into the zone.
    const zoneW = S.W * 0.5;
    const maxH = Math.max(110, S.H - 165 - 72);
    let total = 0;
    const scales = list.map((e) => {
      const d = ENEMIES[e.id] || {};
      const info = sprInfo(d.sprite || 'en_' + e.id);
      let s = this.enemyScale(e);
      if (info.h * s > maxH) s = maxH / info.h;
      total += Math.max(80, info.w * s) + 14;
      return s;
    });
    const fit = total > zoneW ? zoneW / total : 1;
    let prev = null;
    list.forEach((e, i) => {
      let rec = this.enemyRecs.get(e.uid);
      if (!rec) {
        rec = this.makeEntity(false);
        rec.uid = e.uid;
        rec.root.dataset.uid = e.uid;
        rec.body.addEventListener('click', (ev) => { ev.stopPropagation(); this.onEnemyTap(e.uid, rec); });
        rec.top.addEventListener('click', (ev) => { ev.stopPropagation(); this.onEnemyTap(e.uid, rec, true); });
        rec.pulse = new Set();
        this.enemyRecs.set(e.uid, rec);
      }
      const d = ENEMIES[e.id] || {};
      this.setSprite(rec, d.sprite || 'en_' + e.id, scales[i] * fit);
      rec.root.classList.toggle('boss', d.kind === 'boss');
      rec.root.classList.toggle('gone', !!e.dead && !((this.dying.get(e.uid) || 0) > now));
      // DOM order
      const want = prev ? prev.nextSibling : this.els.enemyZone.firstChild;
      if (want !== rec.root) this.els.enemyZone.insertBefore(rec.root, want);
      prev = rec.root;
      if (!e.dead) {
        this.updateBars(rec, e);
        this.renderStatuses(rec, e);
        this.renderIntent(rec, e);
      }
    });
    this.applyTargetable();
  },

  renderIntent(rec, e) {
    const g = this.g;
    const it = safe(() => g.intentOf(e), null);
    const sig = it ? `${e.move}|${it.type}|${it.dmg}|${it.times}` : 'none';
    if (sig === rec.intentSig) return;
    rec.intentSig = sig;
    rec.top.classList.remove('acted');
    clear(rec.top);
    if (!it) return;
    const icons = INTENT_ICON[it.type] || ['in_unknown'];
    const box = h('div.intent.it-' + (it.type || 'unknown'));
    const heavy = it.dmg != null && (it.dmg * (it.times || 1) >= 20 || it.dmg >= 15);
    icons.forEach((id, i) => {
      let sid = id;
      if (i === 0 && id === 'in_atk' && heavy && hasSprite('in_atk_heavy')) sid = 'in_atk_heavy';
      box.appendChild(icon(sid, i === 0 ? 1.75 : 1.25, i ? 'it-sub' : 'it-main', '?'));
    });
    if (it.dmg != null) box.appendChild(h('span.it-dmg', `${it.dmg}${it.times > 1 ? '×' + it.times : ''}`));
    rec.top.appendChild(box);
  },

  intentText(e) {
    const g = this.g;
    const it = safe(() => g.intentOf(e), null);
    if (!it) return '';
    const what = INTENT_WORD[it.type] || 'act';
    const dmg = it.dmg != null ? ` for <b>${it.dmg}</b> damage${it.times > 1 ? ` × ${it.times}` : ''}` : '';
    return `Intends to ${what}${dmg}.${it.name ? ` <i>(${it.name})</i>` : ''}`;
  },

  recOf(e) { if (!e) return null; return e.isPlayer ? this.heroRec : this.enemyRecs.get(e.uid); },

  applyTargetable() {
    const g = this.g;
    const card = this.sel != null && g.cb ? g.cb.hand.find((c) => c.uid === this.sel) : null;
    const tgt = (card && CARDS[card.id] && CARDS[card.id].target === 'enemy' && g.canPlay(card)) || this.potionSlot != null;
    for (const [uid, rec] of this.enemyRecs) {
      const e = g.byUid(uid);
      rec.root.classList.toggle('targetable', !!tgt && e && !e.dead);
      rec.root.classList.toggle('targeted', !!tgt && this.hoverTarget === uid);
    }
  },

  // ------------------------------------------------------------------ energy, piles, end turn
  renderEnergy() {
    const cb = this.g.cb;
    const v = this.els.energy.querySelector('.en-val');
    v.textContent = `${cb.energy}/${cb.maxEnergy}`;
    this.els.energy.classList.toggle('empty', cb.energy <= 0);
    const H = HEROES[this.g.run.hero];
    if (H) this.els.energy.style.setProperty('--hc', H.color);
  },

  renderPiles() {
    const cb = this.g.cb;
    this.els.drawBtn.querySelector('.pile-count').textContent = cb.draw.length;
    this.els.discBtn.querySelector('.pile-count').textContent = cb.discard.length;
    this.els.exhBtn.querySelector('span:last-child').textContent = cb.exhaust.length;
    this.els.exhBtn.classList.toggle('on', cb.exhaust.length > 0);
  },

  renderEndTurn() {
    const g = this.g, cb = g.cb;
    const b = this.els.endBtn;
    const mine = cb.phase === 'player';
    b.classList.toggle('disabled', !mine || cb.busy);
    const any = mine && cb.hand.some((c) => safe(() => g.canPlay(c), false));
    b.classList.toggle('ready', mine && !cb.busy && !any);
    const label = !mine ? 'Enemy Turn' : this.confirmEnd > performance.now() ? 'Confirm?' : 'End Turn';
    b.firstChild.textContent = label;
  },

  renderHint() {
    const g = this.g, cb = g.cb;
    const hint = this.els.hint;
    let text = '';
    if (this.potionSlot != null) text = 'Choose a target for the tincture';
    else if (this.sel != null) {
      const card = cb.hand.find((c) => c.uid === this.sel);
      const d = card && CARDS[card.id];
      if (d && safe(() => g.canPlay(card), false)) text = d.target === 'enemy' ? (g.enemies.length > 1 ? 'Tap an enemy to target' : 'Tap the card or enemy to play') : 'Tap the field or card to play';
    }
    if (hint._t !== text) {
      hint._t = text;
      clear(hint);
      if (text) {
        hint.appendChild(h('span', text));
        if (this.potionSlot != null) hint.appendChild(h('button.btn.small', { onTap: () => { this.potionSlot = null; this.applyTargetable(); this.renderHint(); } }, 'Cancel'));
      }
      hint.classList.toggle('on', !!text);
    }
  },

  onEndTurn() {
    const g = this.g, cb = g.cb;
    if (!cb || cb.phase !== 'player' || cb.busy || modalOpen()) { sfx('error'); return; }
    const any = cb.hand.some((c) => safe(() => g.canPlay(c), false));
    if (g.meta.settings.confirmEnd && any && this.confirmEnd < performance.now()) {
      this.confirmEnd = performance.now() + 2200;
      sfx('click');
      this.renderEndTurn();
      setTimeout(() => this.renderEndTurn(), 2300);
      return;
    }
    this.confirmEnd = 0;
    sfx('endTurn');
    this.deselect();
    this.potionSlot = null;
    g.endTurn();
    this.mark('end', 'hand');
  },

  // ------------------------------------------------------------------ hand
  handGeom() {
    const x0 = 100, x1 = S.W - 152;
    return { x0, x1, y: S.H - CH + 8 };
  },

  layoutHand() {
    const cb = this.g.cb;
    const cards = cb.hand.filter((c) => this.handEls.has(c.uid));
    const n = cards.length;
    const { x0, x1, y } = this.handGeom();
    const avail = x1 - x0;
    const spacing = n > 1 ? Math.min(CW * 0.96, (avail - CW) / (n - 1)) : 0;
    const total = CW + spacing * (n - 1);
    const start = x0 + (avail - total) / 2;
    const mid = (n - 1) / 2;
    const selIdx = cards.findIndex((c) => c.uid === this.sel);
    const out = new Map();
    cards.forEach((c, i) => {
      const off = i - mid;
      let x = start + i * spacing;
      let yy = y + off * off * (n > 6 ? 0.9 : 1.5);
      let rot = off * (n > 7 ? 2.2 : n > 4 ? 3 : 4);
      let sc = 1;
      if (selIdx >= 0 && i !== selIdx) x += i < selIdx ? -22 : 22;
      if (i === selIdx) {
        sc = SEL_SCALE; rot = 0; yy = S.H - CH - 2;
        const half = (CW * SEL_SCALE) / 2;
        const cx = Math.max(half + 6, Math.min(S.W - half - 6, x + CW / 2));
        x = cx - CW / 2;
      }
      out.set(c.uid, { x, y: yy, rot, sc, z: i === selIdx ? 50 : 10 + i });
    });
    return out;
  },

  handTarget(card) {
    const g = this.g;
    if (this.drag && this.drag.uid === card.uid && this.hoverTarget != null) return g.byUid(this.hoverTarget);
    const en = g.enemies;
    return en.length === 1 ? en[0] : null;
  },

  cardSig(card) {
    const g = this.g;
    const target = this.handTarget(card);
    const playable = safe(() => g.canPlay(card), false);
    const txt = cardText(g, card, { live: true, target }).html;
    return `${card.id}|${card.up}|${safe(() => g.cardCost(card), '')}|${playable}|${txt}`;
  },

  buildHandCard(card) {
    const g = this.g;
    const wrap = h('div.hcard');
    wrap.dataset.uid = card.uid;
    wrap.appendChild(cardEl(card, { g, width: CW, live: true, target: this.handTarget(card) }));
    wrap.addEventListener('pointerdown', (e) => this.onCardDown(e, card.uid, wrap));
    wrap.addEventListener('contextmenu', (e) => e.preventDefault());
    return wrap;
  },

  renderHand() {
    const g = this.g, cb = g.cb;
    const inHand = new Set(cb.hand.map((c) => c.uid));
    // Removed cards: animate to wherever they went.
    for (const [uid, el] of this.handEls) {
      if (inHand.has(uid)) continue;
      this.handEls.delete(uid);
      if (this.drag && this.drag.uid === uid) this.endDrag(true);
      if (this.sel === uid) this.sel = null;
      const where = cb.exhaust.some((c) => c.uid === uid) ? 'exhaust' : cb.draw.some((c) => c.uid === uid) ? 'draw' : 'discard';
      this.animateOut(el, where);
    }
    // New / changed cards.
    const pile = stageRect(this.els.drawBtn);
    let k = 0;
    for (const card of cb.hand) {
      let el = this.handEls.get(card.uid);
      const sig = this.cardSig(card);
      if (!el) {
        el = this.buildHandCard(card);
        el._sig = sig;
        this.handEls.set(card.uid, el);
        this.els.hand.appendChild(el);
        const created = this.created.has(card.uid);
        const fresh = this.fresh.has(card.uid) || !created;
        this.fresh.delete(card.uid); this.created.delete(card.uid);
        const sx = created ? S.W / 2 - CW / 2 : pile.cx - CW / 2;
        const sy = created ? S.H / 2 - CH / 2 - 30 : pile.cy - CH / 2;
        el.style.transition = 'none';
        el.style.transform = `translate(${sx}px, ${sy}px) rotate(${created ? 0 : -20}deg) scale(${created ? 0.8 : 0.3})`;
        el.style.opacity = '0';
        el._enterDelay = fresh || created ? k++ * (g.meta.settings.fast ? 45 : 80) : 0;
      } else if (el._sig !== sig) {
        el._sig = sig;
        const inner = cardEl(card, { g, width: CW, live: true, target: this.handTarget(card) });
        el.replaceChild(inner, el.firstChild);
      }
      el.classList.toggle('playable', cb.phase === 'player' && safe(() => g.canPlay(card), false));
      el.classList.toggle('selected', this.sel === card.uid);
    }
    // DOM order for stacking
    this.positionHand();
  },

  positionHand(instant) {
    const pos = this.layoutHand();
    // force reflow once for entering cards
    let needFlush = false;
    for (const [uid, el] of this.handEls) if (el.style.transition === 'none') needFlush = true;
    if (needFlush) void this.els.hand.offsetWidth;
    for (const [uid, el] of this.handEls) {
      if (this.drag && this.drag.uid === uid && this.drag.active) continue;
      const p = pos.get(uid);
      if (!p) continue;
      const delay = el._enterDelay || 0;
      el._enterDelay = 0;
      el.style.transition = instant ? 'none' : '';
      el.style.transitionDelay = delay ? delay + 'ms' : '';
      if (delay) setTimeout(() => sfx('draw'), delay);
      el.style.transform = `translate(${p.x}px, ${p.y}px) rotate(${p.rot}deg) scale(${p.sc})`;
      el.style.opacity = '';
      el.style.zIndex = p.z;
    }
  },

  animateOut(el, where) {
    if (where === 'exhaust') { this.burn(el); return; }
    const target = where === 'draw' ? this.els.drawBtn : this.els.discBtn;
    const r = stageRect(target);
    el.style.transition = 'transform .32s cubic-bezier(.5,0,.7,1), opacity .32s';
    el.style.transform = `translate(${r.cx - CW / 2}px, ${r.cy - CH / 2}px) rotate(25deg) scale(.25)`;
    el.style.opacity = '0';
    el.style.pointerEvents = 'none';
    setTimeout(() => el.remove(), 360);
  },

  burn(el) {
    el.style.pointerEvents = 'none';
    el.classList.add('burning');
    particlesOn(el, 'burn', { spread: 0.8, vspread: 0.9 });
    anim(el, [{ opacity: 1, filter: 'brightness(1)' }, { opacity: 0.9, filter: 'brightness(1.8) sepia(1)', offset: 0.3 }, { opacity: 0, filter: 'brightness(.3)' }], { duration: 520, fill: 'forwards' }).then(() => el.remove());
  },

  select(uid) {
    if (this.sel === uid) return;
    this.sel = uid;
    this.hoverTarget = null;
    sfx('cardSelect');
    for (const [u, el] of this.handEls) el.classList.toggle('selected', u === uid);
    this.positionHand();
    this.applyTargetable();
    this.renderHint();
    this.showKwTips();
  },

  deselect() {
    if (this.sel == null) return;
    this.sel = null;
    this.hoverTarget = null;
    for (const el of this.handEls.values()) el.classList.remove('selected');
    this.positionHand();
    this.applyTargetable();
    this.renderHint();
    this.showKwTips();
  },

  // Glossary boxes beside the selected card.
  showKwTips() {
    const old = this.els.sr.querySelector('.hand-tips');
    if (old) old.remove();
    if (this.sel == null || (this.drag && this.drag.active)) return;
    const el = this.handEls.get(this.sel);
    const card = el && el.firstChild;
    if (!card || !card._terms || !card._terms.size) return;
    const tips = glossaryFor(card._terms).slice(0, 3);
    if (!tips.length) return;
    const pos = this.layoutHand().get(this.sel);
    if (!pos) return;
    const w = CW * SEL_SCALE;
    const cx = pos.x + CW / 2;
    const box = h('div.hand-tips', tips.map((t) => h('div.kw-tip', h('b', t.term), h('span', t.text))));
    const right = cx + w / 2 + 8;
    box.style.top = (S.H - CH * SEL_SCALE - 2) + 'px';
    if (right + 170 < S.W - 4) box.style.left = right + 'px';
    else box.style.left = (cx - w / 2 - 8 - 170) + 'px';
    this.els.sr.appendChild(box);
  },

  onCardDown(e, uid, el) {
    const g = this.g;
    if (e.button && e.button !== 0) return;
    hideTip();
    if (this.locked()) { if (g.cb && g.cb.phase !== 'player') sfx('error'); return; }
    if (this.potionSlot != null) { this.potionSlot = null; this.applyTargetable(); }
    e.preventDefault();
    try { el.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
    const p = toStage(e.clientX, e.clientY);
    this.drag = { uid, el, id: e.pointerId, sx: p.x, sy: p.y, active: false, wasSel: this.sel === uid };
    const move = (ev) => this.onCardMove(ev);
    const up = (ev) => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', cancel); this.onCardUp(ev); };
    const cancel = () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', cancel); this.endDrag(false); };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', cancel);
  },

  onCardMove(ev) {
    const d = this.drag;
    if (!d) return;
    const p = toStage(ev.clientX, ev.clientY);
    if (!d.active) {
      if (Math.hypot(p.x - d.sx, p.y - d.sy) < 10) return;
      const g = this.g;
      const card = g.cb && g.cb.hand.find((c) => c.uid === d.uid);
      if (!card) return;
      d.active = true;
      d.target = CARDS[card.id] && CARDS[card.id].target === 'enemy';
      this.select(d.uid);
      d.el.classList.add('dragging');
      d.el.style.transition = 'none';
      d.el.style.zIndex = 60;
      this.showKwTips();
    }
    const sc = 1.15;
    d.el.style.transform = `translate(${p.x - CW / 2}px, ${p.y - CH * 0.55}px) scale(${sc})`;
    // Targeting
    let over = null;
    const hit = document.elementFromPoint(ev.clientX, ev.clientY);
    const ent = hit && hit.closest && hit.closest('.entity.enemy');
    if (ent && ent.dataset.uid) {
      const e = this.g.byUid(+ent.dataset.uid);
      if (e && !e.dead) over = e.uid;
    }
    if (over !== this.hoverTarget) {
      this.hoverTarget = d.target ? over : null;
      this.applyTargetable();
      if (d.target) {
        const card = this.g.cb.hand.find((c) => c.uid === d.uid);
        if (card) { const inner = cardEl(card, { g: this.g, width: CW, live: true, target: this.handTarget(card) }); d.el.replaceChild(inner, d.el.firstChild); d.el._sig = ''; }
      }
    }
    d.lastY = p.y;
    d.el.classList.toggle('will-play', !d.target ? p.y < S.H - GROUND + 6 : over != null || (this.g.enemies.length === 1 && p.y < S.H - GROUND + 6));
  },

  onCardUp(ev) {
    const d = this.drag;
    if (!d) return;
    const g = this.g;
    const card = g.cb && g.cb.hand.find((c) => c.uid === d.uid);
    if (!card) { this.endDrag(true); return; }
    if (d.active) {
      const p = toStage(ev.clientX, ev.clientY);
      const def = CARDS[card.id];
      let played = false;
      if (!safe(() => g.canPlay(card), false)) {
        this.refuse(card, d.el);
      } else if (def && def.target === 'enemy') {
        const t = this.hoverTarget != null ? this.hoverTarget : g.enemies.length === 1 && p.y < S.H - GROUND + 6 ? g.enemies[0].uid : null;
        if (t != null) { played = true; this.endDrag(false, true); this.play(card.uid, t); }
      } else if (p.y < S.H - GROUND + 6) { played = true; this.endDrag(false, true); this.play(card.uid, null); }
      if (!played) { this.endDrag(false); this.deselect(); }
      return;
    }
    // Tap
    this.drag = null;
    if (d.wasSel) {
      if (!safe(() => g.canPlay(card), false)) { this.deselect(); return; }
      const def = CARDS[card.id];
      if (def && def.target === 'enemy') {
        if (g.enemies.length === 1) this.play(card.uid, g.enemies[0].uid);
        else { sfx('error'); for (const rec of this.enemyRecs.values()) if (rec.root.classList.contains('targetable')) pulse(rec.reticle, 1.15, 260); }
      } else this.play(card.uid, null);
      return;
    }
    this.select(card.uid);
    if (!safe(() => g.canPlay(card), false)) this.refuse(card, d.el);
  },

  refuse(card, el) {
    const g = this.g;
    const why = safe(() => g.whyUnplayable(card), 'You cannot play that now.');
    toast(why, 'warn');
    sfx('error');
    if (el && el.firstChild) anim(el.firstChild, [{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(0)' }], 300);
  },

  endDrag(silent, keepSel) {
    const d = this.drag;
    this.drag = null;
    if (!d) return;
    d.el.classList.remove('dragging', 'will-play');
    d.el.style.transition = '';
    this.hoverTarget = null;
    if (!keepSel && !silent) this.positionHand();
    this.applyTargetable();
  },

  trySelectedOnPlayArea() {
    const g = this.g;
    if (this.sel == null || this.locked()) return false;
    const card = g.cb.hand.find((c) => c.uid === this.sel);
    if (!card) return false;
    const def = CARDS[card.id];
    if (!def || def.target === 'enemy') { this.deselect(); return true; }
    if (!safe(() => g.canPlay(card), false)) { this.refuse(card, this.handEls.get(card.uid)); return true; }
    this.play(card.uid, null);
    return true;
  },

  onFieldTap(e) {
    if (this.potionSlot != null) return;
    if (!this.trySelectedOnPlayArea()) hideTip();
  },

  onEnemyTap(uid, rec, onIntent) {
    const g = this.g;
    const e = g.byUid(uid);
    if (!e || e.dead) return;
    if (this.potionSlot != null && !this.locked()) {
      const slot = this.potionSlot;
      this.potionSlot = null;
      this.applyTargetable(); this.renderHint();
      g.usePotion(slot, uid);
      return;
    }
    if (this.sel != null && !this.locked()) {
      const card = g.cb.hand.find((c) => c.uid === this.sel);
      const def = card && CARDS[card.id];
      if (card && def) {
        if (!safe(() => g.canPlay(card), false)) { this.refuse(card, this.handEls.get(card.uid)); return; }
        if (def.target === 'enemy') { this.play(card.uid, uid); return; }
        this.play(card.uid, null); return;
      }
    }
    const d = ENEMIES[e.id] || {};
    const kind = d.kind === 'boss' ? 'Boss' : d.kind === 'elite' ? 'Elite' : '';
    tip(onIntent ? rec.top : rec.body, {
      title: e.name + (kind ? ` · ${kind}` : ''),
      html: `${this.intentText(e)}<br><span class="tip-dim">${e.hp}/${e.maxHp} HP${e.block ? `, ${e.block} Block` : ''}</span>`,
      sub: d.desc ? `<i>${d.desc}</i>` : '',
    });
  },

  startPotionTarget(slot) {
    this.deselect();
    this.potionSlot = slot;
    sfx('cardSelect');
    this.applyTargetable();
    this.renderHint();
  },

  async play(uid, targetUid) {
    const g = this.g;
    hideTip();
    const kw = this.els.sr.querySelector('.hand-tips'); if (kw) kw.remove();
    this.sel = null;
    this.hoverTarget = null;
    const ok = await g.playCard(uid, targetUid);
    if (!ok && this.root) {
      const card = g.cb && g.cb.hand.find((c) => c.uid === uid);
      if (card) this.refuse(card, this.handEls.get(uid));
      this.mark('hand');
    }
  },

  // Fly the played card to its target.
  flyPlayed(card, target, auto) {
    const g = this.g;
    let el = this.handEls.get(card.uid);
    const fx = document.getElementById('fx');
    if (el) { this.handEls.delete(card.uid); }
    else {
      // auto-played or created elsewhere: spawn a fresh card at the draw pile
      el = h('div.hcard', cardEl(card, { g, width: CW }));
      const r = stageRect(this.els.drawBtn);
      el.style.transform = `translate(${r.cx - CW / 2}px, ${r.cy - CH / 2}px) scale(.4)`;
    }
    if (!fx) { el.remove(); return; }
    const cur = el.style.transform;
    el.classList.remove('selected', 'dragging', 'playable', 'will-play');
    el.classList.add('flying');
    el.style.transition = 'none';
    el.style.zIndex = 5;
    fx.appendChild(el);
    const def = CARDS[card.id] || {};
    let tx = S.W * 0.5 - CW / 2, ty = S.H * 0.38 - CH / 2;
    const trec = target ? this.recOf(target) : null;
    if (trec && def.type === 'attack') { const r = stageRect(trec.body); tx = r.cx - CW / 2; ty = r.cy - CH / 2; }
    else if (def.type === 'power' || def.type === 'skill') { const r = stageRect(this.heroRec.body); tx = r.cx - CW / 2 + 70; ty = r.y - 10; }
    const mid = `translate(${tx}px, ${ty}px) rotate(0deg) scale(.95)`;
    const rec = { el, exhaust: false };
    this.flying.set(card.uid, rec);
    sfx(def.type === 'attack' ? 'cardAttack' : def.type === 'power' ? 'cardPower' : 'cardSkill');
    anim(el, [{ transform: cur || mid, opacity: 1 }, { transform: mid, opacity: 1 }], { duration: auto ? 380 : 220, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' })
      .then(() => sleep(60))
      .then(() => {
        this.flying.delete(card.uid);
        if (rec.exhaust) { el.style.transform = mid; this.burn(el); return; }
        if (def.type === 'power') {
          particlesOn(el, 'spark', { spread: 0.7 });
          return anim(el, [{ transform: mid, opacity: 1 }, { transform: `translate(${tx}px, ${ty - 40}px) scale(1.15)`, opacity: 0 }], { duration: 380, fill: 'forwards' }).then(() => el.remove());
        }
        const r = stageRect(this.els.discBtn);
        return anim(el, [{ transform: mid, opacity: 1 }, { transform: `translate(${r.cx - CW / 2}px, ${r.cy - CH / 2}px) rotate(30deg) scale(.2)`, opacity: 0.1 }], { duration: 300, easing: 'ease-in', fill: 'forwards' }).then(() => el.remove());
      });
  },

  // ------------------------------------------------------------------ emits
  onEmit(type, d) {
    const g = this.g;
    if (!this.root || !g.run) return;
    const cb = g.cb;
    if (cb && cb !== this.cbRef) return;
    switch (type) {
      case 'refresh': this.markAll(); break;
      case 'play': if (d.card) this.flyPlayed(d.card, d.target, d.auto); this.mark('hand', 'energy', 'piles'); break;
      case 'draw': if (d.card) this.fresh.add(d.card.uid); this.mark('hand', 'piles'); break;
      case 'discard': this.mark('hand', 'piles'); sfx('discard'); break;
      case 'handDiscarded': this.deselect(); this.mark('hand', 'piles', 'hero'); break;
      case 'exhaust': {
        const f = d.card && this.flying.get(d.card.uid);
        if (f) f.exhaust = true;
        else if (d.card && this.handEls.has(d.card.uid)) { const el = this.handEls.get(d.card.uid); this.handEls.delete(d.card.uid); this.burn(el); }
        sfx('exhaust');
        this.mark('hand', 'piles');
        break;
      }
      case 'shuffle': {
        sfx('shuffle');
        for (let i = 0; i < 4; i++) setTimeout(() => flyGhost(this.els.discBtn, this.els.drawBtn, 'ghost-card', 360), i * 70);
        this.mark('piles');
        break;
      }
      case 'addCard': {
        if (!d.card) break;
        if (d.where === 'hand') this.created.add(d.card.uid);
        else { const ghost = h('div.ghost-src'); ghost.style.cssText = `position:absolute;left:${S.W / 2}px;top:${S.H / 2 - 40}px;width:2px;height:2px`; this.els.sr.appendChild(ghost); flyGhost(ghost, d.where === 'discard' ? this.els.discBtn : this.els.drawBtn, 'ghost-card', 450).then(() => ghost.remove()); }
        this.mark('hand', 'piles');
        break;
      }
      case 'upgrade': { const el = d.card && this.handEls.get(d.card.uid); if (el) { particlesOn(el, 'spark'); el._sig = ''; } sfx('upgrade'); this.mark('hand'); break; }
      case 'energy': this.mark('energy', 'hand', 'end'); pulse(this.els.energy.firstChild, 1.15, 260); break;
      case 'handFull': toast('Your hand is full.', 'warn'); break;

      case 'damage': this.fxDamage(d); break;
      case 'hploss': {
        const rec = this.recOf(d.e);
        if (rec) {
          const kind = d.type === 'rot' ? 'rot' : (d.type === 'hploss' || d.type === undefined) ? 'hploss' : 'dmg';
          floatText(rec.body, d.n, kind);
          if (kind !== 'dmg') { flash(rec.fl, 200); if (d.e.isPlayer) sfx('hurt'); }
          if (d.e.isPlayer && d.n >= 1) this.hurtVignette(d.n);
        }
        this.markEnt(d.e);
        break;
      }
      case 'blockBroken': { const rec = this.recOf(d.e); if (rec) { particlesOn(rec.blk, 'block'); } sfx('blockBreak'); break; }
      case 'block': { const rec = this.recOf(d.e); if (rec) { floatText(rec.body, '+' + d.n, 'block', { at: 0.55 }); pulse(rec.blk, 1.35, 300); particlesOn(rec.body, 'block', { at: 0.6 }); } sfx('block'); this.markEnt(d.e); break; }
      case 'heal': { const rec = this.recOf(d.e); if (rec) { floatText(rec.body, '+' + d.n, 'heal'); particlesOn(rec.body, 'heal', { at: 0.7 }); } sfx('heal'); this.markEnt(d.e); break; }
      case 'rot': { const rec = this.recOf(d.e); if (rec) particlesOn(rec.body, 'bubbles', { at: 0.6 }); sfx('rot'); break; }
      case 'status': this.fxStatus(d); break;
      case 'negated': {
        const rec = this.recOf(d.e);
        const immune = d.e && !d.e.isPlayer && ENEMIES[d.e.id]?.immune?.includes(d.id);
        if (rec) { floatText(rec.body, immune ? 'Immune!' : 'Warded!', 'info'); particlesOn(rec.body, 'spirit'); }
        sfx('ward');
        this.markEnt(d.e);
        break;
      }
      case 'death': this.fxDeath(d.e); break;
      case 'flee': this.fxFlee(d.e); break;
      case 'spawn': this.fxSpawn(d.e); break;
      case 'intent': { const rec = this.recOf(d.e); if (rec) { rec.intentSig = ''; rec.top.classList.remove('acted'); } this.mark('enemies'); break; }
      case 'enemyAct': this.fxEnemyAct(d.e, d.move); break;
      case 'enemyStrike': {
        const rec = this.recOf(d.e);
        if (rec) anim(rec.body, [{ transform: 'translateX(0)' }, { transform: 'translateX(-42px) scale(1.04)', offset: 0.35 }, { transform: 'translateX(0)' }], { duration: 300, easing: 'ease-out' });
        sfx('enemyAttack');
        break;
      }
      case 'mask': {
        this.mark('hero');
        const to = d.to && MASKS[d.to];
        sfx('mask');
        requestAnimationFrame(() => {
          const rec = this.heroRec;
          if (!rec) return;
          flash(rec.fl, 260);
          if (rec.maskBadge) pulse(rec.maskBadge, 1.4, 360);
          floatText(rec.body, to ? to.name : 'Mask removed', 'buff', { at: 0.1 });
          particlesOn(rec.body, 'violet', { at: 0.2 });
        });
        break;
      }
      case 'channel': {
        this.mark('hero');
        sfx('channel');
        requestAnimationFrame(() => { const rec = this.heroRec; const slots = rec && rec.top.querySelectorAll('.sp-slot.full'); const s = slots && slots[slots.length - 1]; if (s) { pulse(s, 1.5, 360); particlesOn(s, 'spirit'); } });
        break;
      }
      case 'release': {
        const rec = this.heroRec;
        const s = rec && rec.top.querySelector('.sp-slot.full');
        if (s) particlesOn(s, 'spirit', { n: 22, sp: 160 });
        sfx('release');
        this.mark('hero');
        break;
      }
      case 'spiritPulse': { const rec = this.heroRec; const s = rec && [...rec.top.querySelectorAll('.sp-slot.full')]; if (s && s.length) s.forEach((x) => pulse(x, 1.2, 240)); sfx('spirit'); break; }
      case 'slots': this.mark('hero'); break;
      case 'oath': this.fxOath(d, false); break;
      case 'oathDone': this.fxOath(d, true); break;
      case 'turnStart': {
        if (!cb) break;
        this.mark('hand', 'piles', 'energy', 'hero', 'enemies', 'end');
        if (cb.turn > 1) { banner('Your Turn', 'turn', `Turn ${cb.turn}`, 700); sfx('turnStart'); }
        break;
      }
      case 'endTurn': banner('Enemy Turn', 'enemy', '', 650); this.mark('end'); break;
      case 'phase': {
        const rec = this.recOf(d.e);
        if (rec) { flash(rec.fl, 400); particlesOn(rec.body, 'ember', { n: 30 }); }
        screenShake(10);
        sfx('phase');
        banner(d.text || 'The battle turns', 'boss', d.e ? d.e.name : '', 1500);
        this.mark('enemies');
        break;
      }
      case 'powerUsed': break;
      case 'echo': floatText(this.heroRec.body, 'Echo!', 'info', { at: 0.1 }); sfx('echo'); break;
      case 'potion': sfx('potion'); particlesOn(this.heroRec.body, 'spirit', { at: 0.4 }); this.mark('tb'); break;
      case 'revive': screenFlash('#f0d27a', 500); if (this.heroRec) { particlesOn(this.heroRec.body, 'heal', { n: 30 }); floatText(this.heroRec.body, 'Revived!', 'heal', { big: true }); } sfx('revive'); this.mark('hero', 'tb'); break;
      case 'gold': case 'maxhp': this.mark('tb'); break;
      case 'combatWon': {
        UI.hold = performance.now() + (g.meta.settings.fast ? 700 : 1300);
        this.deselect();
        sfx('victory');
        setTimeout(() => banner('Victory', 'victory', '', 900), 250);
        break;
      }
      case 'combatLost': this.fxHeroDeath(); break;
      default: break;
    }
  },

  markEnt(e) { if (!e) return; this.mark(e.isPlayer ? 'hero' : 'enemies'); if (e.isPlayer) this.mark('tb'); },

  fxDamage(d) {
    const rec = this.recOf(d.e);
    if (!rec) return;
    if (d.blocked > 0) {
      floatText(rec.body, d.unblocked > 0 ? d.blocked : `Blocked ${d.blocked}`, 'blocked', { at: 0.55 });
      sfx('blockHit');
      pulse(rec.blk, 1.25, 200);
    }
    if (d.unblocked > 0) {
      flash(rec.fl, 200);
      shake(rec.body, d.e.isPlayer ? 7 : 5, 300);
      particlesOn(rec.body, d.type === 'burn' ? 'ember' : d.type === 'spirit' ? 'spirit' : 'blood', { at: 0.45 });
      sfx(d.e.isPlayer ? 'hurt' : d.type === 'attack' ? 'hit' : 'hitMagic');
      if (d.unblocked >= 18 || (d.e.isPlayer && d.unblocked >= 12)) screenShake(d.unblocked >= 30 ? 12 : 7);
    } else if (!d.blocked && d.amount === 0) floatText(rec.body, '0', 'blocked');
    this.markEnt(d.e);
  },

  hurtVignette(n) {
    const v = this.els.scr && this.els.scr.querySelector('.vignette');
    if (!v) return;
    anim(v, [{ boxShadow: 'inset 0 0 0 0 rgba(138,28,28,0)' }, { boxShadow: `inset 0 0 ${Math.min(120, 30 + n * 4)}px ${Math.min(40, 8 + n)}px rgba(138,28,28,.55)`, offset: 0.2 }, { boxShadow: 'inset 0 0 0 0 rgba(138,28,28,0)' }], 500);
  },

  fxStatus(d) {
    const g = this.g;
    const e = d.e;
    this.markEnt(e);
    if (!e || !d.n) return;
    const def = STATUSES[d.id];
    if (!def || def.kind === 'oath') return;
    const rec = this.recOf(e);
    if (!rec) return;
    if (rec.pulse) rec.pulse.add(d.id); else rec.pulse = new Set([d.id]);
    const neg = def.kind === 'debuff' || (def.negOk && d.n < 0);
    // Only announce applications (not ticking down).
    if (def.decay && d.n < 0) return;
    if (!def.negOk && d.n < 0) return;
    const label = `${def.name} ${d.n > 0 ? '+' : ''}${d.n}`;
    floatText(rec.body, label, neg ? 'debuff' : 'buff', { at: 0.05 });
    sfx(neg ? 'debuff' : 'buff');
    if (neg) particlesOn(rec.body, 'violet', { at: 0.3, n: 8 });
  },

  fxDeath(e) {
    const rec = this.recOf(e);
    if (!rec || e.isPlayer) return;
    const ms = this.g.meta.settings.fast ? 600 : 950;
    this.dying.set(e.uid, performance.now() + ms);
    rec.root.classList.add('dying');
    sfx('enemyDeath');
    flash(rec.fl, 260);
    setTimeout(() => {
      particlesOn(rec.body, 'dust', { spread: 0.9, vspread: 0.9, n: 36 });
      particlesOn(rec.body, 'ash', { spread: 0.8, vspread: 0.8 });
      anim(rec.body, [{ opacity: 1, transform: 'none', filter: 'brightness(1)' }, { opacity: 0, transform: 'translateY(10px) scale(.92, .7)', filter: 'brightness(2.5) grayscale(1)' }], { duration: ms - 200, easing: 'ease-in', fill: 'forwards' });
      anim(rec.bar, [{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' });
      anim(rec.st, [{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' });
      anim(rec.top, [{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' });
    }, 150);
    setTimeout(() => { this.mark('enemies'); }, ms + 30);
  },

  fxFlee(e) {
    const rec = this.recOf(e);
    if (!rec) return;
    this.dying.set(e.uid, performance.now() + 700);
    rec.root.classList.add('dying');
    floatText(rec.body, 'Fled', 'info');
    sfx('flee');
    anim(rec.root, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(90px)' }], { duration: 650, easing: 'ease-in', fill: 'forwards' });
    setTimeout(() => this.mark('enemies'), 720);
  },

  fxSpawn(e) {
    try { this.renderEnemies(); } catch (err) { console.warn(err); }
    const rec = this.recOf(e);
    if (!rec) return;
    sfx('spawn');
    anim(rec.body, [{ opacity: 0, transform: 'translateY(-24px) scale(.8)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.3,1.4,.6,1)' });
    particlesOn(rec.body, 'dust', { at: 0.95, n: 14 });
  },

  fxEnemyAct(e, move) {
    const rec = this.recOf(e);
    if (!rec) return;
    rec.top.classList.add('acted');
    if (move && move.name) {
      const lbl = h('div.move-name', move.name);
      const r = stageRect(rec.body);
      lbl.style.left = r.cx + 'px';
      lbl.style.top = Math.max(40, r.y - 34) + 'px';
      document.getElementById('fx').appendChild(lbl);
      anim(lbl, [{ opacity: 0, transform: 'translate(-50%, 6px)' }, { opacity: 1, transform: 'translate(-50%, 0)', offset: 0.15 }, { opacity: 1, transform: 'translate(-50%, 0)', offset: 0.8 }, { opacity: 0, transform: 'translate(-50%, -6px)' }], { duration: 1100 }).then(() => lbl.remove());
    }
    if (move && !move.dmg && /buff|def|heal|summon/.test(move.intent || '')) particlesOn(rec.body, move.intent === 'heal' ? 'heal' : move.intent.includes('def') ? 'block' : 'ember', { at: 0.5 });
  },

  fxOath(d, done) {
    const g = this.g;
    this.mark('hero');
    const def = STATUSES[d.id];
    const rec = this.heroRec;
    if (!rec) return;
    sfx(done ? 'oathDone' : 'oath');
    const seal = h('div.oath-stamp' + (done ? '.done' : ''), icon('st_' + ((def && def.icon) || 'oath'), 4, '', '✦'), h('span', done ? 'Oath Fulfilled' : 'Oath Sworn'), h('small', def ? def.name : ''));
    const r = stageRect(rec.body);
    seal.style.left = (r.cx + 40) + 'px';
    seal.style.top = (r.y + 10) + 'px';
    document.getElementById('fx').appendChild(seal);
    anim(seal, [
      { opacity: 0, transform: 'translate(-50%,-50%) scale(2.2) rotate(-12deg)' },
      { opacity: 1, transform: 'translate(-50%,-50%) scale(1) rotate(-6deg)', offset: 0.18 },
      { opacity: 1, transform: 'translate(-50%,-50%) scale(1) rotate(-6deg)', offset: 0.75 },
      { opacity: 0, transform: 'translate(-50%,-50%) scale(.6) rotate(0deg)' },
    ], { duration: 1300, easing: 'ease-out' }).then(() => seal.remove());
    if (done) { setTimeout(() => particlesOn(seal, 'gold', { n: 24 }), 200); }
  },

  fxHeroDeath() {
    const g = this.g;
    UI.hold = performance.now() + (g.meta.settings.fast ? 1200 : 2100);
    this.deselect();
    const rec = this.heroRec;
    sfx('heroDeath');
    if (rec) {
      flash(rec.fl, 400);
      particlesOn(rec.body, 'blood', { n: 20 });
      anim(rec.body, [{ transform: 'none', filter: 'grayscale(0)' }, { transform: 'translateY(12px) rotate(-80deg)', filter: 'grayscale(1) brightness(.5)' }], { duration: 900, easing: 'ease-in', fill: 'forwards', delay: 200 });
    }
    const veil = h('div.death-veil');
    this.els.scr.appendChild(veil);
    anim(veil, [{ opacity: 0 }, { opacity: 1 }], { duration: 1400, delay: 500, fill: 'forwards', easing: 'ease-in' });
  },
};
