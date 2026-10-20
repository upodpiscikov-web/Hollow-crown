// ACT 2 — The Weeping Wood & the Drowned Abbey.
// Enemies, encounters, enemy-only statuses, the Floodwater status card, boss
// intro lines, and every `en_*` sprite for the act.
//
// Design notes (one readable rule per enemy):
//   Drowned Monk     clogs your deck with Mire; sodden robes give Plating.
//   Hollow Novice    support: Dread (draw less), shields the choir.
//   Willow-wight     Regrowth; Entwine stops your Attacks for a turn.
//   Thornling        Thorns; punishes many small hits.
//   Glamour-kin      Reactive: hitting it changes its intent (always to a different one).
//   Zealot           Martyr's Zeal: gains Might when an ally dies.
//   Pyre-Bearer      Ash-Burn; killing it extinguishes your Ash-Burn.
//   Lantern Moth     Swarm: each moth hits harder for every other moth alive.
//   Antlered Hart    telegraphed Gore; deal enough damage while it charges to stagger it.
//   Thornwarden (E)  Hedge of Briars: a turn where attacking it hurts badly.
//   Inquisitor (E)   Hex, then Brands that feed a scaling Sentence.
//   Mere-Hag (E)     Sinking (draw less each turn) — climb out by playing Mire.
//   Grall (B)        Skills feed his Fervor; at half HP he lights a Pyre that empowers him.
//   Antlered King(B) Glamour hides his intent until you hurt him enough; at half HP the
//                    glamour falls and he devours his court.
//   Drowned Abbess(B) Floodwater spreads if you hold it; she sinks (Phantasm) before her
//                    Undertow, which grows with every Floodwater in your deck.

import { defineCards, defineStatuses, defineEnemies, defineEncounters, defineTexts } from '../../engine/registry.js';
import { defineSprites, PAL } from '../../gfx/sprite.js';
import { pick, weighted } from '../../engine/rng.js';

// ------------------------------------------------------------------ helpers
const num = (x, g, e) => (typeof x === 'function' ? x(g, e) : x);
const inPlayerTurn = (g) => !!(g.cb && g.cb.phase === 'player');
const others = (g, e, id) => g.enemies.filter((x) => x !== e && x.id === id);
const countCards = (g, id) => {
  const cb = g.cb;
  if (!cb) return 0;
  let n = 0;
  for (const p of ['hand', 'draw', 'discard']) for (const c of cb[p]) if (c.id === id) n++;
  return n;
};
const addCards = (g, id, n, where = 'draw') => { for (let i = 0; i < n; i++) g.addCard(id, where); };
const block = (g, e, n) => g.gainBlock(e, n, { raw: true });
const buff = (g, e, id, n) => g.apply(e, id, n, e);
const debuff = (g, e, id, n) => g.apply(g.player, id, n, e);

// ------------------------------------------------------------------ status card
defineCards([
  {
    id: 'mere_floodwater', name: 'Floodwater', hero: 'status', type: 'status', rarity: 'special',
    cost: 1, target: 'none', kw: ['exhaust'], art: 'drop', noUp: true,
    text: 'Bail it out. If this is in your hand at the end of your turn, add a copy to your draw pile.',
    play() {},
    endTurnInHand(g) { g.addCard('mere_floodwater', 'draw'); },
  },
]);

// ------------------------------------------------------------------ statuses
defineStatuses([
  {
    id: 'a2_swarm', name: 'Swarm', kind: 'buff', icon: 'feather',
    desc: () => 'Deals 1 more damage per hit for each other Lantern Moth.',
  },
  {
    id: 'a2_martyr', name: "Martyr's Zeal", kind: 'buff', icon: 'enrage',
    desc: (n) => `Whenever another enemy dies, gains ${n} Might.`,
    enemyDied(g, o, n, dead) {
      if (!o.isPlayer && !o.dead && o !== dead && !dead.fled) g.apply(o, 'might', n, o);
    },
  },
  {
    id: 'a2_pyre_keeper', name: 'Pyre-Keeper', kind: 'buff', icon: 'flame',
    desc: () => 'When it dies, your Ash-Burn is extinguished.',
    died(g) { if (g.st(g.player, 'burning')) g.removeStatus(g.player, 'burning'); },
  },
  {
    id: 'a2_charging', name: 'Lowered Antlers', kind: 'buff', icon: 'enrage',
    desc: (n) => `Charging! Make it lose ${n} more HP this turn to stagger it and stop the Gore.`,
  },
  {
    id: 'a2_briars', name: 'Raised Briars', kind: 'buff', icon: 'thorns',
    desc: (n) => `Until its next turn, when attacked deals ${n} damage back.`,
    onAttacked(g, o, n, src) { if (src && src !== o && !src.dead) g.damage(src, n, { type: 'thorns', src: o }); },
    turnStart(g, o) { g.removeStatus(o, 'a2_briars'); },
  },
  {
    id: 'a2_branded', name: 'Branded', kind: 'debuff', icon: 'eye',
    desc: (n) => `The Inquisitor's Sentence deals ${n * 5} more damage. Sentence consumes all Brands.`,
  },
  {
    id: 'a2_sinking', name: 'Sinking', kind: 'debuff', icon: 'chain',
    desc: (n) => `Draw ${n} fewer card${n > 1 ? 's' : ''} each turn. Each Mire you play lifts 1 Sinking.`,
    drawMod: (g, o, n) => (o.isPlayer ? -n : 0),
    cardPlayed(g, o, n, card) { if (o.isPlayer && card.id === 'mire') g.addStatus(o, 'a2_sinking', -1); },
  },
  {
    id: 'a2_zealotry', name: 'Zealotry', kind: 'buff', icon: 'eye',
    desc: (n) => `Whenever you play a Skill, gains 1 Fervor (max ${n}).`,
    cardPlayed(g, o, n, card) {
      if (o.isPlayer || o.dead || g.cardDef(card).type !== 'skill') return;
      if (g.st(o, 'a2_fervor') < n) g.addStatus(o, 'a2_fervor', 1);
    },
    turnEnd(g, o) { if (o.st.a2_fervor) g.removeStatus(o, 'a2_fervor'); },
  },
  {
    id: 'a2_fervor', name: 'Fervor', kind: 'buff', icon: 'zeal',
    desc: (n) => `Each hit of his attacks deals ${n} more damage. Burns out at the end of his turn.`,
    atkAdd: (g, o, n) => n,
  },
  {
    id: 'a2_glamour', name: 'Glamour', kind: 'buff', icon: 'mask',
    desc: (n) => `His intent is hidden. Make him lose ${n} more HP this turn to see through it.`,
  },
  {
    id: 'a2_tide', name: 'Rising Mere', kind: 'buff', icon: 'moon',
    desc: (n, g) => `Undertow deals ${n} more damage for each Floodwater in your deck${g && g.cb ? ` (${countCards(g, 'mere_floodwater')} now)` : ''}.`,
  },
]);

// ------------------------------------------------------------------ boss logic helpers
const GLAMOUR = 12; // HP the Antlered King must lose in one turn to reveal his intent

function grallPhase2(g, e) {
  if (e.data.p2 || e.hp <= 0) return;
  e.data.p2 = true;
  g.emit('phase', { e, text: '"Then let the fire decide." Grall drives a stake into the earth and calls for pitch.' });
  if (inPlayerTurn(g)) g.rollIntent(e);
}

function kingPhase2(g, e) {
  if (e.data.p2 || e.hp <= 0) return;
  e.data.p2 = true;
  g.removeStatus(e, 'a2_glamour');
  e.name = 'The Antlered King, Unglamoured';
  g.emit('phase', { e, text: 'The glamour falls. Beneath the fair face: bark, rot, and a crown of antlers that has never been a crown.' });
  if (inPlayerTurn(g)) g.rollIntent(e);
}

function abbessPhase2(g, e) {
  if (e.data.p2 || e.hp <= 0) return;
  e.data.p2 = true;
  e.name = 'Maren, the Drowned Queen';
  const text = g.run.hero === 'wren'
    ? 'The wimple tears away. A queen\'s drowned face, and a crown gone green. "Little stolen thing. Do you know what you are, yet?"'
    : 'The wimple tears away. Beneath it, a queen\'s drowned face, and a crown gone green with the mere.';
  g.emit('phase', { e, text });
  if (inPlayerTurn(g)) g.rollIntent(e);
}

// The Antlered King's moves while glamoured (resolved by the hidden 'veiled' move,
// or directly once the glamour is pierced and his true intent revealed).
const KING_SECRETS = {
  court: {
    name: 'Call the Court', intent: 'summon',
    fx(g, e) {
      e.data.sh.push('court');
      const n = 2 - others(g, e, 'fae_courtier').length;
      for (let i = 0; i < n; i++) g.spawn('fae_courtier', { minion: true, front: true });
    },
  },
  blade: {
    name: 'Glamoured Blade', intent: 'atk', dmg: 15,
    fx(g, e) { e.data.sh.push('blade'); },
  },
  beguile: {
    name: 'Beguile', intent: 'strongdebuff',
    fx(g, e) { e.data.sh.push('beguile'); debuff(g, e, 'weak', 2); debuff(g, e, 'frail', 2); },
  },
  revel: {
    name: 'Midsummer Revel', intent: 'defbuff',
    fx(g, e) {
      e.data.sh.push('revel');
      for (const x of g.enemies) buff(g, x, 'might', 2);
      block(g, e, 12);
    },
  },
};

// ------------------------------------------------------------------ enemies
defineEnemies([
  // ================================================================ NORMALS
  {
    id: 'drowned_monk', name: 'Drowned Monk', kind: 'normal', act: 2, hp: [46, 50],
    sprite: 'en_drowned_monk',
    desc: 'A brother of the abbey who walked into the mere at vespers and walked back out at matins. He still keeps the hours.',
    init(g, e) { g.addStatus(e, 'plating', 2, { silent: true }); },
    moves: {
      chant: { name: 'Bog Chant', intent: 'debuff', fx(g) { addCards(g, 'mire', 2, 'draw'); } },
      fist: { name: 'Sodden Fist', intent: 'atk', dmg: 12 },
      drag: { name: 'Drag to the Mere', intent: 'atkdebuff', dmg: 8, fx(g) { g.addCard('mire', 'hand'); } },
    },
    ai(g, e) {
      if (e.turns === 0) return 'chant';
      return g.aiPick(e, { fist: 45, drag: 35, chant: 20 }, { fist: 2, drag: 1, chant: 1 });
    },
  },
  {
    id: 'hollow_novice', name: 'Hollow Novice', kind: 'normal', act: 2, hp: [24, 28],
    sprite: 'en_hollow_novice',
    desc: 'Too young for the vows when the water came. The abbey kept them anyway.',
    moves: {
      toll: { name: 'Toll the Drowned Bell', intent: 'debuff', fx(g, e) { debuff(g, e, 'dread', 1); } },
      thurible: { name: 'Thurible', intent: 'atk', dmg: 4, times: 2 },
      vigil: { name: 'Vigil', intent: 'def', fx(g) { for (const x of g.enemies) block(g, x, 4); } },
    },
    ai(g, e) {
      const tolling = others(g, e, 'hollow_novice').some((x) => x.move === 'toll');
      return g.aiPick(e, { toll: tolling ? 0 : 25, thurible: 50, vigil: 25 }, { toll: 1, thurible: 2, vigil: 1 });
    },
  },
  {
    id: 'willow_wight', name: 'Willow-wight', kind: 'normal', act: 2, hp: [54, 58],
    sprite: 'en_willow_wight',
    desc: 'The weeping willows drink from the mere. Some of them drank something that had drowned there.',
    init(g, e) { g.addStatus(e, 'regrowth', 3, { silent: true }); },
    moves: {
      lash: { name: 'Weeping Lash', intent: 'atk', dmg: 4, times: 3 },
      boughs: { name: 'Strangling Boughs', intent: 'atk', dmg: 11 },
      entwine: {
        name: 'Entwine', intent: 'strongdebuff',
        fx(g, e) { debuff(g, e, 'entangled', 1); block(g, e, 8); },
      },
    },
    ai(g, e) {
      if (e.turns === 0) return 'lash';
      const recent = e.hist.slice(-2).includes('entwine');
      return g.aiPick(e, { lash: 35, boughs: 35, entwine: recent ? 0 : 30 }, { lash: 1, boughs: 1, entwine: 1 });
    },
  },
  {
    id: 'thornling', name: 'Thornling', kind: 'normal', act: 2, hp: [18, 22],
    sprite: 'en_thornling',
    desc: 'A briar-sprite no taller than a hound, all spite and needles. They nest in the eyes of the dead.',
    init(g, e) { g.addStatus(e, 'thorns', 2, { silent: true }); },
    moves: {
      prick: { name: 'Prick', intent: 'atk', dmg: 6 },
      scratch: { name: 'Scratch', intent: 'atk', dmg: 3, times: 2 },
      bristle: { name: 'Bristle', intent: 'defbuff', fx(g, e) { buff(g, e, 'thorns', 1); block(g, e, 5); } },
    },
    ai(g, e) {
      if (e.turns === 0) return 'prick';
      return g.aiPick(e, { prick: 45, scratch: 35, bristle: 20 }, { prick: 2, scratch: 1, bristle: 1 });
    },
  },
  {
    id: 'glamour_kin', name: 'Glamour-kin', kind: 'normal', act: 2, hp: [30, 36],
    sprite: 'en_glamour_kin',
    desc: 'A fae noble\'s cast-off glamour, wearing whatever face you fear. Strike it and it becomes something else.',
    init(g, e) { g.addStatus(e, 'reactive', 1, { silent: true }); },
    moves: {
      blade: { name: 'Fae Blade', intent: 'atk', dmg: 11 },
      kiss: { name: 'Kiss of Briars', intent: 'atk', dmg: 4, times: 3 },
      bewitch: { name: 'Bewitch', intent: 'debuff', fx(g, e) { debuff(g, e, 'weak', 2); } },
      fade: { name: 'Fade', intent: 'def', fx(g, e) { block(g, e, 11); } },
    },
    ai(g, e) {
      const w = { blade: 30, kiss: 30, bewitch: 20, fade: 20 };
      // Reacting to a hit: always become something different.
      if (inPlayerTurn(g) && e.move) { delete w[e.move]; return g.aiPick(e, w); }
      return g.aiPick(e, w, { blade: 1, kiss: 1, bewitch: 1, fade: 1 });
    },
  },
  {
    id: 'zealot', name: 'Witch-hunter Zealot', kind: 'normal', act: 2, hp: [40, 44],
    sprite: 'en_zealot',
    desc: 'Grall\'s men wear the brand they give: a crown burned into the palm, so they never forget whose fire it is.',
    init(g, e) { g.addStatus(e, 'a2_martyr', 3, { silent: true }); },
    moves: {
      denounce: { name: 'Denounce', intent: 'debuff', fx(g, e) { debuff(g, e, 'exposed', 1); } },
      cudgel: { name: 'Cudgel', intent: 'atk', dmg: 11 },
      hymn: { name: 'Hymn of Purity', intent: 'defbuff', fx(g, e) { buff(g, e, 'might', 2); block(g, e, 6); } },
    },
    ai(g, e) {
      if (e.turns === 0) return 'denounce';
      return g.aiPick(e, { cudgel: 55, denounce: 20, hymn: 25 }, { cudgel: 2, denounce: 1, hymn: 1 });
    },
  },
  {
    id: 'pyre_bearer', name: 'Pyre-Bearer', kind: 'normal', act: 2, hp: [36, 40],
    sprite: 'en_pyre_bearer',
    desc: 'Carries the coals from burning to burning, and has never once let them go out.',
    init(g, e) { g.addStatus(e, 'a2_pyre_keeper', 1, { silent: true }); },
    moves: {
      torch: { name: 'Torch', intent: 'atkdebuff', dmg: 7, fx(g, e) { debuff(g, e, 'burning', 1); } },
      kindle: { name: 'Kindle', intent: 'debuff', fx(g) { addCards(g, 'ash', 2, 'draw'); } },
      fan: { name: 'Fan the Coals', intent: 'defbuff', fx(g, e) { buff(g, e, 'might', 1); block(g, e, 7); } },
    },
    ai(g, e) {
      if (e.turns === 0) return 'kindle';
      return g.aiPick(e, { torch: 45, kindle: 25, fan: 30 }, { torch: 1, kindle: 1, fan: 1 });
    },
  },
  {
    id: 'lantern_moth', name: 'Lantern Moth', kind: 'normal', act: 2, hp: [11, 14],
    sprite: 'en_lantern_moth',
    desc: 'Moths that drank from the corpse-lights over the mere. They glow brightest where they bite.',
    init(g, e) { g.addStatus(e, 'a2_swarm', 1, { silent: true }); },
    moves: {
      flit: { name: 'Flit', intent: 'atk', dmg: (g, e) => 1 + others(g, e, 'lantern_moth').length, times: 2 },
      dazzle: { name: 'Dazzle', intent: 'debuff', fx(g) { g.addCard('daze', 'draw'); } },
    },
    ai(g, e) {
      return g.aiPick(e, { flit: 70, dazzle: 30 }, { flit: 3, dazzle: 1 });
    },
  },
  {
    id: 'antlered_hart', name: 'Antlered Hart', kind: 'normal', act: 2, hp: [50, 54],
    sprite: 'en_antlered_hart',
    desc: 'A white hart of the Antlered King\'s hunt, gone feral and grey. Its antlers are hung with the bones of hunters.',
    moves: {
      stamp: { name: 'Stamp', intent: 'atk', dmg: 9 },
      trample: { name: 'Trample', intent: 'atk', dmg: 5, times: 2 },
      lower: {
        name: 'Lower Antlers', intent: 'defbuff',
        fx(g, e) { block(g, e, 6); g.addStatus(e, 'a2_charging', 12); },
      },
      gore: { name: 'Gore', intent: 'atk', dmg: 22, fx(g, e) { g.removeStatus(e, 'a2_charging'); } },
      staggered: { name: 'Staggered', intent: 'sleep', fx(g, e) { g.removeStatus(e, 'a2_charging'); } },
    },
    ai(g, e) {
      if (g.lastMove(e, 'lower')) return 'gore';
      if (e.turns % 3 === 1) return 'lower';
      return g.aiPick(e, { stamp: 50, trample: 50 }, { stamp: 1, trample: 1 });
    },
    on: {
      hpLost(g, e, n) {
        if (!e.st.a2_charging || e.move !== 'gore' || !inPlayerTurn(g) || e.hp <= 0) return;
        if (e.st.a2_charging > n) { g.addStatus(e, 'a2_charging', -n); return; }
        g.removeStatus(e, 'a2_charging');
        e.move = 'staggered';
        g.emit('intent', { e });
      },
    },
  },

  // ---------------------------------------------------------------- summons
  {
    id: 'fae_courtier', name: 'Fae Courtier', kind: 'normal', act: 2, hp: [20, 24],
    sprite: 'en_fae_courtier',
    desc: 'Masked nobles of the Antlered Court. Their faces are glamours; beneath them, nothing at all.',
    init(g, e) { g.addStatus(e, 'minion', 1, { silent: true }); },
    moves: {
      rapier: { name: 'Rapier', intent: 'atk', dmg: 7 },
      devotion: {
        name: 'Devotion', intent: 'def',
        fx(g, e) { const k = g.enemies.find((x) => x.id === 'antlered_king'); block(g, k || e, 9); },
      },
      mock: { name: 'Mockery', intent: 'debuff', fx(g, e) { debuff(g, e, 'frail', 1); } },
    },
    ai(g, e) {
      return g.aiPick(e, { rapier: 50, devotion: 30, mock: 20 }, { rapier: 2, devotion: 1, mock: 1 });
    },
  },
  {
    id: 'grall_pyre', name: 'The Pyre', kind: 'normal', act: 2, hp: [26, 30],
    sprite: 'en_grall_pyre',
    desc: 'A stake, a chain, and kindling soaked in pitch. Grall builds one wherever he stops for the night.',
    init(g, e) { g.addStatus(e, 'a2_pyre_keeper', 1, { silent: true }); },
    moves: {
      blaze: {
        name: 'Blaze', intent: 'debuff',
        fx(g, e) {
          debuff(g, e, 'burning', 1);
          const gr = g.enemies.find((x) => x.id === 'grall');
          if (gr) buff(g, gr, 'might', 1);
        },
      },
    },
    ai() { return 'blaze'; },
    on: {
      death(g, e) {
        const gr = g.enemies.find((x) => x.id === 'grall');
        if (gr) gr.data.pyreDiedAt = gr.turns;
      },
    },
  },

  // ================================================================ ELITES
  {
    id: 'thornwarden', name: 'The Thornwarden', kind: 'elite', act: 2, hp: [144, 150],
    sprite: 'en_thornwarden',
    desc: 'A fae knight sworn to the hedge between the Wood and the world. Its armour grew on it, ring by ring, for three hundred years.',
    init(g, e) { g.addStatus(e, 'thorns', 2, { silent: true }); },
    moves: {
      lance: { name: 'Briar Lance', intent: 'atk', dmg: 15 },
      lash: { name: 'Thornlash', intent: 'atk', dmg: 5, times: 3 },
      bind: { name: 'Rootbind', intent: 'atkdebuff', dmg: 8, fx(g, e) { debuff(g, e, 'strangle', 1); } },
      hedge: {
        name: 'Hedge of Briars', intent: 'defbuff',
        fx(g, e) { block(g, e, 12); buff(g, e, 'thorns', 1); g.addStatus(e, 'a2_briars', 5); },
      },
    },
    ai(g, e) {
      if (e.turns % 3 === 1) return 'hedge';
      if (e.turns === 0) return 'lance';
      return g.aiPick(e, { lance: 35, lash: 35, bind: 30 }, { lance: 1, lash: 1, bind: 1 });
    },
  },
  {
    id: 'inquisitor', name: 'The Inquisitor', kind: 'elite', act: 2, hp: [156, 164],
    sprite: 'en_inquisitor',
    desc: 'Grall\'s right hand. He has never once lost his temper, and never once found anyone innocent.',
    moves: {
      accuse: {
        name: 'Accusation', intent: 'strongdebuff',
        fx(g, e) { debuff(g, e, 'hex', 1); debuff(g, e, 'a2_branded', 1); },
      },
      brand: { name: 'Hot Iron', intent: 'atkdebuff', dmg: 9, fx(g, e) { debuff(g, e, 'a2_branded', 2); } },
      question: {
        name: 'The Question', intent: 'debuff',
        fx(g, e) { debuff(g, e, 'weak', 2); debuff(g, e, 'a2_branded', 1); },
      },
      litany: { name: 'Litany of Judgement', intent: 'defbuff', fx(g, e) { block(g, e, 14); buff(g, e, 'might', 2); } },
      sentence: {
        name: 'Sentence', intent: 'atk', dmg: (g) => 8 + 5 * g.st(g.player, 'a2_branded'),
        fx(g) { g.removeStatus(g.player, 'a2_branded'); },
      },
    },
    ai(g, e) {
      if (e.turns === 0) return 'accuse';
      const step = (e.turns - 1) % 3;
      if (step === 0) return 'brand';
      if (step === 1) return e.hist.includes('question') && !e.hist.slice(-3).includes('litany') ? 'litany' : 'question';
      return 'sentence';
    },
  },
  {
    id: 'mere_hag', name: 'The Mere-Hag', kind: 'elite', act: 2, hp: [172, 180],
    sprite: 'en_mere_hag',
    desc: 'The abbey\'s nuns paid her in candles not to come up the steps. When the candles stopped, the water came instead.',
    moves: {
      tangle: {
        name: 'Weed-Tangle', intent: 'debuff',
        fx(g) { g.addCard('mire', 'hand'); addCards(g, 'mire', 2, 'draw'); },
      },
      drag: {
        name: 'Drag Under', intent: 'atkdebuff', dmg: 10,
        fx(g, e) { if (g.st(g.player, 'a2_sinking') < 3) debuff(g, e, 'a2_sinking', 1); },
      },
      clutch: { name: 'Drowning Grip', intent: 'atk', dmg: 6, times: 3 },
      brew: { name: 'Bog-Brew', intent: 'defbuff', fx(g, e) { block(g, e, 12); buff(g, e, 'might', 2); } },
    },
    ai(g, e) {
      if (e.turns === 0) return 'tangle';
      if (e.turns === 1) return 'drag';
      const mired = countCards(g, 'mire') >= 6;
      return g.aiPick(e, { tangle: mired ? 0 : 20, drag: 30, clutch: 30, brew: 20 }, { tangle: 1, drag: 1, clutch: 1, brew: 1 });
    },
  },

  // ================================================================ BOSSES
  {
    id: 'grall', name: 'Mattias Grall', kind: 'boss', act: 2, hp: [326, 336], leader: true,
    sprite: 'en_grall',
    desc: 'The Witchfinder General. He served beside the King\'s Shield once, and believes, with his whole heart, that fire is a kindness.',
    init(g, e) { g.addStatus(e, 'a2_zealotry', 4, { silent: true }); },
    moves: {
      open: {
        name: 'Kindle the Faggots', intent: 'debuff',
        fx(g, e) { e.data.opened = true; addCards(g, 'ash', 3, 'draw'); },
      },
      open_witch: {
        name: '"There you are, witch."', intent: 'debuff',
        fx(g, e) { e.data.opened = true; addCards(g, 'ash', 3, 'draw'); },
      },
      open_knight: {
        name: '"Captain Vane."', intent: 'debuff',
        fx(g, e) { e.data.opened = true; addCards(g, 'ash', 3, 'draw'); },
      },
      scourge: { name: 'Iron Scourge', intent: 'atk', dmg: (g, e) => (e.data.p2 ? 6 : 5), times: 3 },
      verdict: { name: 'Verdict', intent: 'atk', dmg: (g, e) => (e.data.p2 ? 20 : 17) },
      kindle: { name: 'Bring Kindling', intent: 'debuff', fx(g, e) { addCards(g, 'ash', 2, 'draw'); block(g, e, 10); } },
      pious: { name: 'Pious Guard', intent: 'defbuff', fx(g, e) { block(g, e, 16); buff(g, e, 'might', 2); } },
      light: {
        name: 'Light the Pyre', intent: 'summon',
        fx(g, e) { e.data.lit = true; g.spawn('grall_pyre', { minion: true }); block(g, e, 10); },
      },
      burn: { name: 'Burn the Witch', intent: 'atkdebuff', dmg: 10, fx(g, e) { debuff(g, e, 'burning', 2); } },
      relight: {
        name: 'Relight the Pyre', intent: 'summon',
        fx(g, e) { e.data.pyreDiedAt = null; g.spawn('grall_pyre', { minion: true }); },
      },
    },
    ai(g, e) {
      if (!e.data.opened) return g.run.hero === 'witch' ? 'open_witch' : g.run.hero === 'knight' ? 'open_knight' : 'open';
      if (e.data.p2) {
        if (!e.data.lit) return 'light';
        const pyre = g.enemies.some((x) => x.id === 'grall_pyre');
        if (!pyre && e.data.pyreDiedAt != null && e.turns - e.data.pyreDiedAt >= 2) return 'relight';
        return g.aiPick(e, { burn: 35, scourge: 35, verdict: 30 }, { burn: 1, scourge: 1, verdict: 1 });
      }
      return g.aiPick(e, { scourge: 35, verdict: 30, kindle: 20, pious: 15 }, { scourge: 1, verdict: 1, kindle: 1, pious: 1 });
    },
    on: {
      hpLost(g, e) { if (e.hp <= e.maxHp / 2) grallPhase2(g, e); },
    },
  },
  {
    id: 'antlered_king', name: 'The Antlered King', kind: 'boss', act: 2, hp: [370, 380], leader: true,
    sprite: 'en_antlered_king',
    desc: 'Lord of the Weeping Wood and first servant of the Lady Under the Hill. He has worn a fair face for four hundred years. It was never his.',
    init(g, e) { e.data.sh = []; },
    moves: {
      ...KING_SECRETS,
      veiled: {
        name: 'Glamour', intent: 'unknown',
        async fx(g, e) {
          const m = KING_SECRETS[e.data.secret];
          if (!m) return;
          const dmg = g.moveDmg(e, m);
          if (dmg != null) g.enemyHit(e, dmg, num(m.times, g, e) || 1);
          if (!e.dead && g.cb.phase !== 'over' && m.fx) await m.fx(g, e);
        },
      },
      unveil: {
        name: 'Feast of the Court', intent: 'buff',
        fx(g, e) {
          e.data.unveiled = true;
          let eaten = 0;
          for (const c of others(g, e, 'fae_courtier')) { g.loseHp(c, c.hp, { type: 'hploss' }); eaten++; }
          buff(g, e, 'might', 2 + 3 * eaten);
          block(g, e, 12);
        },
      },
      gore: { name: 'Crown of Antlers', intent: 'atk', dmg: 24 },
      hunt: { name: 'The Wild Hunt', intent: 'atk', dmg: 5, times: 4 },
      rotbloom: { name: 'Rot-Bloom', intent: 'atkdebuff', dmg: 10, fx(g, e) { debuff(g, e, 'rot', 4); } },
      bellow: { name: 'Bellow of the Stag', intent: 'defbuff', fx(g, e) { block(g, e, 14); buff(g, e, 'might', 2); } },
    },
    ai(g, e) {
      if (e.data.p2) {
        if (!e.data.unveiled) return 'unveil';
        return g.aiPick(e, { gore: 30, hunt: 30, rotbloom: 25, bellow: 15 }, { gore: 1, hunt: 1, rotbloom: 1, bellow: 1 });
      }
      // Glamoured: pick a hidden move and show only "Glamour".
      const court = others(g, e, 'fae_courtier').length;
      const last = e.data.sh[e.data.sh.length - 1];
      const opts = [];
      if (court < 2 && e.turns > 0) opts.push(['court', court === 0 ? 55 : 30]);
      opts.push(['blade', 30]);
      opts.push(['beguile', 20]);
      if (court > 0) opts.push(['revel', 15]);
      const list = opts.filter(([k]) => k !== last);
      e.data.secret = weighted(g.crng, list.length ? list : opts, (o) => o[1])[0];
      const cur = g.st(e, 'a2_glamour');
      if (cur !== GLAMOUR) g.addStatus(e, 'a2_glamour', GLAMOUR - cur, { silent: true });
      return 'veiled';
    },
    on: {
      hpLost(g, e, n) {
        if (e.hp <= 0) return;
        if (!e.data.p2 && e.hp <= e.maxHp / 2) { kingPhase2(g, e); return; }
        if (e.data.p2 || e.move !== 'veiled' || !inPlayerTurn(g) || !e.st.a2_glamour) return;
        if (e.st.a2_glamour > n) { g.addStatus(e, 'a2_glamour', -n); return; }
        g.removeStatus(e, 'a2_glamour');
        e.move = e.data.secret;
        g.emit('intent', { e });
      },
    },
  },
  {
    id: 'drowned_abbess', name: 'The Drowned Abbess', kind: 'boss', act: 2, hp: [344, 352],
    sprite: 'en_drowned_abbess',
    desc: 'She came to the abbey veiled, twenty years ago, and asked the sisters to hide something for her. Then she walked into the mere.',
    init(g, e) { g.addStatus(e, 'a2_tide', 2, { silent: true }); },
    moves: {
      hesitate: {
        name: '"...Little one?"', intent: 'sleep',
        fx(g, e) { e.data.hesitated = true; g.emit('phase', { e, text: 'She reaches for you across the water — and stops, as if she has remembered something.' }); },
      },
      vespers: {
        name: 'Vespers for the Drowned', intent: 'atkdebuff', dmg: 6,
        fx(g, e) { e.data.step = (e.data.step || 0) + 1; addCards(g, 'mere_floodwater', e.data.p2 ? 3 : 2, 'draw'); },
      },
      embrace: {
        name: 'Cold Embrace', intent: 'atkdebuff', dmg: 13,
        fx(g, e) { e.data.step = (e.data.step || 0) + 1; g.addCard('mere_floodwater', 'discard'); },
      },
      crown: {
        name: 'The Drowned Crown', intent: 'atk', dmg: 7, times: 3,
        fx(g, e) { e.data.step = (e.data.step || 0) + 1; },
      },
      sink: {
        name: 'Sink Beneath the Mere', intent: 'buff',
        fx(g, e) { e.data.step = (e.data.step || 0) + 1; e.data.sinking = true; },
      },
      undertow: {
        name: 'Undertow', intent: 'atk',
        dmg: (g, e) => 12 + g.st(e, 'a2_tide') * countCards(g, 'mere_floodwater'),
        fx(g, e) { e.data.step = (e.data.step || 0) + 1; },
      },
      rise: {
        name: 'Remember the Crown', intent: 'buff',
        fx(g, e) { e.data.risen = true; e.data.step = 0; buff(g, e, 'might', 3); },
      },
    },
    ai(g, e) {
      if (!e.data.hesitated && e.turns === 0 && g.run.hero === 'wren') return 'hesitate';
      if (e.data.p2 && !e.data.risen) return 'rise';
      const cyc = e.data.p2 ? ['crown', 'vespers', 'sink', 'undertow'] : ['vespers', 'embrace', 'sink', 'undertow'];
      return cyc[(e.data.step || 0) % cyc.length];
    },
    on: {
      // She slips under the water after her turn ends, so she stays intangible
      // through your whole next turn.
      roundEnd(g, e) {
        if (!e.data.sinking) return;
        e.data.sinking = false;
        g.addStatus(e, 'phantasm', 1);
      },
      hpLost(g, e) { if (e.hp <= e.maxHp / 2) abbessPhase2(g, e); },
    },
  },
]);

// ------------------------------------------------------------------ encounters
defineEncounters([
  // easy (first three fights of the act)
  { id: 'a2_drowned_monk', act: 2, pool: 'easy', enemies: ['drowned_monk'], name: 'A Drowned Monk' },
  { id: 'a2_thornlings', act: 2, pool: 'easy', enemies: ['thornling', 'thornling'], name: 'Thornlings' },
  { id: 'a2_moths', act: 2, pool: 'easy', enemies: ['lantern_moth', 'lantern_moth', 'lantern_moth'], name: 'Lantern Moths' },
  { id: 'a2_hart', act: 2, pool: 'easy', enemies: ['antlered_hart'], name: 'The White Hart' },
  { id: 'a2_glamour', act: 2, pool: 'easy', enemies: ['lantern_moth', 'glamour_kin'], name: 'A Glamour by Moonlight' },
  // hard
  { id: 'a2_witch_hunters', act: 2, pool: 'hard', enemies: ['zealot', 'pyre_bearer'], weight: 1.4, name: 'Witch-hunters' },
  { id: 'a2_vespers', act: 2, pool: 'hard', enemies: ['hollow_novice', 'drowned_monk'], name: 'Vespers' },
  { id: 'a2_choir', act: 2, pool: 'hard', enemies: ['hollow_novice', 'hollow_novice', 'hollow_novice'], weight: 0.8, name: 'The Hollow Choir' },
  { id: 'a2_weeping_grove', act: 2, pool: 'hard', enemies: ['thornling', 'willow_wight'], name: 'The Weeping Grove' },
  {
    id: 'a2_fae_revel', act: 2, pool: 'hard', name: 'A Fae Revel',
    enemies: (g, rng) => pick(rng, [['glamour_kin', 'lantern_moth', 'glamour_kin'], ['lantern_moth', 'glamour_kin', 'lantern_moth', 'lantern_moth']]),
  },
  { id: 'a2_moth_cloud', act: 2, pool: 'hard', enemies: ['lantern_moth', 'lantern_moth', 'lantern_moth', 'lantern_moth'], weight: 0.8, name: 'Moth-cloud' },
  { id: 'a2_wild_hunt', act: 2, pool: 'hard', enemies: ['lantern_moth', 'antlered_hart', 'lantern_moth'], name: 'The Hunt Gone Wild' },
  { id: 'a2_thicket', act: 2, pool: 'hard', enemies: ['thornling', 'thornling', 'thornling'], weight: 0.8, name: 'Thicket' },
  { id: 'a2_inquest', act: 2, pool: 'hard', enemies: ['zealot', 'zealot'], weight: 0.8, name: 'The Inquest' },
  { id: 'a2_burning_party', act: 2, pool: 'hard', enemies: ['thornling', 'pyre_bearer', 'thornling'], weight: 0.7, name: 'Burning the Briars' },
  // elites
  { id: 'a2_thornwarden', act: 2, pool: 'elite', enemies: ['thornwarden'], name: 'The Thornwarden' },
  { id: 'a2_inquisitor', act: 2, pool: 'elite', enemies: ['inquisitor'], name: 'The Inquisitor' },
  { id: 'a2_mere_hag', act: 2, pool: 'elite', enemies: ['mere_hag'], name: 'The Mere-Hag' },
  // bosses
  { id: 'a2_boss_grall', act: 2, pool: 'boss', enemies: ['grall'], name: 'Mattias Grall, the Witchfinder General' },
  { id: 'a2_boss_antlered_king', act: 2, pool: 'boss', enemies: ['fae_courtier', 'fae_courtier', 'antlered_king'], name: 'The Antlered King' },
  { id: 'a2_boss_abbess', act: 2, pool: 'boss', enemies: ['drowned_abbess'], name: 'The Drowned Abbess' },
]);

defineTexts({
  boss_intro: {
    a2_boss_grall: 'Mattias Grall lifts the brand from the coals. "Kneel and be judged. The fire is merciful. I am only thorough."',
    a2_boss_antlered_king: 'Music without musicians. A lord steps from between the weeping trees, too fair to look at, and the whole Wood bows.',
    a2_boss_abbess: 'Bells ring somewhere under the mere. A veiled abbess rises from the black water, weeping, and the cold comes up with her.',
  },
});

// ================================================================== SPRITES
// Enemies face LEFT. Drawn back-to-front; outline + rim light are automatic.
const VERDIGRIS = '#5f8f7a';
const PITCH = '#2a2420';
const eyes = (p, pts, col, r = 1) => { for (const [x, y] of pts) p.glow(x, y, col, r); };
const drips = (p, pts, col = PAL.frost) => { for (const [x, y, l] of pts) p.rect(x, y, 1, l || 2, col); };
const strands = (p, list, col, w = 1) => { for (const s of list) p.path(s, col, w); };
const flame = (p, cx, base, h, w) => {
  p.poly([[cx - w, base], [cx - w * 0.6, base - h * 0.55], [cx - w * 0.2, base - h * 0.45], [cx, base - h], [cx + w * 0.3, base - h * 0.5], [cx + w * 0.7, base - h * 0.6], [cx + w, base]], PAL.ember);
  p.poly([[cx - w * 0.6, base], [cx - w * 0.3, base - h * 0.45], [cx, base - h * 0.75], [cx + w * 0.4, base - h * 0.4], [cx + w * 0.6, base]], PAL.flame);
  p.poly([[cx - w * 0.3, base], [cx, base - h * 0.4], [cx + w * 0.3, base]], PAL.candle);
};

defineSprites({
  // ------------------------------------------------------------ normals
  en_lantern_moth: {
    w: 34, h: 30,
    draw(p) {
      // wings swept up and back (side view, facing left)
      p.poly([[16, 14], [20, 2], [28, 0], [33, 8], [28, 16]], PAL.violet, { shade: 0.3 });   // upper wing
      p.poly([[16, 16], [27, 18], [32, 26], [22, 29], [15, 22]], PAL.bruise, { shade: 0.3 }); // lower wing
      p.path([[17, 14], [26, 4]], PAL.lilac, 1); p.path([[18, 15], [30, 10]], PAL.lilac, 1);
      p.path([[17, 17], [28, 24]], PAL.violet, 1);
      p.circle(26, 8, 3, PAL.candle); p.circle(26, 8, 1.5, PAL.ink);                           // eyespot
      p.circle(25, 23, 2, PAL.flame); p.px(25, 23, PAL.ink);
      // glowing lantern abdomen
      p.ellipse(19, 20, 5, 3.5, PAL.flame, { shade: 0.2 });
      p.ellipse(19, 20, 2.5, 2, PAL.candle);
      p.glow(19, 20, PAL.candle, 5);
      // fuzzy thorax + head
      p.ellipse(14, 15, 5, 5, PAL.dusk, { shade: 0.35 });
      p.speckle(PAL.fog, 0.2, 4, [9, 10, 20, 20]);
      p.circle(9, 13, 3.5, PAL.dusk, { shade: 0.35 });
      p.px(7, 12, PAL.candle); p.px(7, 13, PAL.candle);
      p.glow(7, 12, PAL.candle, 1);
      // feathered antennae
      p.path([[8, 10], [5, 5], [2, 2]], PAL.bone, 1); p.path([[10, 10], [10, 4], [8, 0]], PAL.bone, 1);
      p.px(4, 5, PAL.bone); p.px(3, 4, PAL.bone); p.px(11, 6, PAL.bone); p.px(9, 3, PAL.bone);
      // legs
      p.path([[12, 19], [10, 24]], PAL.dusk, 1); p.path([[15, 19], [14, 25]], PAL.dusk, 1);
    },
  },
  en_thornling: {
    w: 36, h: 34,
    draw(p) {
      const cx = 18, cy = 17;
      const spikes = [[18, 1], [28, 4], [34, 14], [32, 26], [5, 5], [1, 15], [10, 1], [25, 0], [33, 20]];
      for (const [x, y] of spikes) p.tri(cx + (x - cx) * 0.5 - 2.5, cy + (y - cy) * 0.5, cx + (x - cx) * 0.5 + 2.5, cy + (y - cy) * 0.5 + 1.5, x, y, PAL.bone);
      p.path([[12, 26], [9, 32], [5, 33]], PAL.bark, 2); p.path([[22, 27], [24, 32], [28, 33]], PAL.bark, 2);
      p.circle(cx, cy, 11, PAL.bark, { shade: 0.4 });
      p.ellipse(21, 10, 7, 3, PAL.moss, { shade: 0.3 }); p.ellipse(26, 20, 3, 2, PAL.moss);
      p.path([[9, 12], [26, 24]], PAL.wood, 1); p.path([[13, 24], [28, 10]], PAL.wood, 1);
      p.ellipse(11, 21, 5, 3, PAL.void);                                                       // grin
      for (const x of [8, 10, 12, 14]) p.tri(x, 19, x + 1, 22, x + 2, 19, PAL.bone);
      p.ellipse(9, 13, 2.5, 2.5, PAL.void); p.ellipse(15, 13, 2.5, 2.5, PAL.void);
      eyes(p, [[9, 13], [15, 13]], PAL.venom, 2);
      p.tri(3, 22, 8, 19, 6, 26, PAL.bone);
    },
  },
  en_glamour_kin: {
    w: 38, h: 54,
    draw(p) {
      p.poly([[22, 14], [36, 6], [37, 22], [30, 30]], PAL.lilac, { shade: 0.25 });          // moth-wing cloak
      p.poly([[22, 20], [35, 30], [31, 40], [24, 34]], PAL.violet, { shade: 0.25 });
      p.circle(32, 14, 2, PAL.ghost); p.px(32, 14, PAL.bruise);
      p.poly([[13, 18], [27, 18], [30, 36], [24, 46], [20, 53], [16, 44], [10, 36]], PAL.violet, { shade: 0.35 }); // body
      p.poly([[16, 36], [24, 36], [21, 50], [19, 53]], PAL.bruise);
      strands(p, [[[14, 40], [12, 47], [14, 52]], [[25, 42], [27, 48], [25, 52]]], PAL.lilac);
      p.ellipse(19, 10, 8, 8, PAL.bruise, { shade: 0.3 });                                  // hood/hair
      p.poly([[12, 8], [8, 18], [13, 22]], PAL.bruise);
      p.ellipse(14, 11, 5, 6, PAL.bone, { shade: 0.3 });                                    // mask
      p.erase(11, 9, 2, 2); p.erase(15, 9, 2, 2);
      p.path([[11, 14], [13, 15], [16, 13]], PAL.wine, 1);
      p.tri(18, 4, 21, 0, 21, 6, PAL.lilac); p.tri(12, 4, 13, -1, 15, 4, PAL.lilac);
      p.path([[14, 24], [8, 28], [3, 27]], PAL.pale, 2);                                    // reaching arm
      p.path([[3, 27], [0, 25]], PAL.pale, 1); p.path([[3, 27], [0, 28]], PAL.pale, 1); p.path([[4, 27], [1, 30]], PAL.pale, 1);
      p.glow(12, 10, PAL.spirit, 1); p.glow(16, 10, PAL.spirit, 1);
      p.speckle(PAL.lilac, 0.05, 11, [8, 18, 32, 50]);
    },
  },
  en_drowned_monk: {
    w: 44, h: 58,
    draw(p) {
      p.poly([[12, 16], [32, 16], [40, 56], [4, 56]], PAL.water, { shade: 0.35 });          // robe
      p.poly([[22, 24], [26, 24], [30, 56], [20, 56]], PAL.deep);                           // fold
      p.poly([[4, 56], [8, 50], [12, 56], [17, 51], [22, 56], [28, 50], [33, 56], [37, 51], [40, 56]], PAL.deep);
      p.rect(9, 32, 27, 3, PAL.wood); p.path([[16, 34], [14, 44], [16, 47]], PAL.wood, 1);   // rope belt
      p.ellipse(20, 14, 11, 11, PAL.water, { shade: 0.35 });                                // hood
      p.poly([[9, 14], [16, 6], [22, 13], [20, 24], [11, 23]], PAL.void);                   // hood opening (face left)
      p.ellipse(14, 17, 4, 5, PAL.sick, { shade: 0.3 });                                    // bloated face
      p.rect(12, 15, 2, 1, PAL.void); p.rect(15, 15, 1, 1, PAL.void); p.rect(12, 19, 3, 1, PAL.gore);
      p.poly([[12, 24], [4, 30], [2, 36], [8, 36], [16, 30]], PAL.water, { shade: 0.3 });   // sleeve
      p.ellipse(4, 37, 3, 3, PAL.sick, { shade: 0.3 });                                     // hand
      p.path([[3, 39], [2, 43]], PAL.sick, 1); p.path([[5, 39], [5, 42]], PAL.sick, 1);
      strands(p, [[[10, 8], [7, 18], [8, 26]], [[26, 6], [30, 14], [29, 24]], [[30, 18], [34, 28], [33, 36]], [[18, 30], [19, 40]]], PAL.moss);
      strands(p, [[[12, 6], [10, 12]], [[33, 22], [36, 31]]], PAL.rot);
      drips(p, [[2, 45, 2], [6, 44, 1], [10, 57, 1], [35, 57, 1], [24, 57, 1]]);
      p.speckle(PAL.moss, 0.04, 3, [4, 36, 40, 56]);
    },
  },
  en_hollow_novice: {
    w: 32, h: 46,
    draw(p) {
      p.poly([[12, 14], [24, 14], [30, 45], [8, 45]], PAL.stone, { shade: 0.35 });
      p.poly([[8, 45], [11, 41], [15, 45], [19, 41], [23, 45], [27, 41], [30, 45]], PAL.ash);
      p.rect(17, 18, 2, 27, PAL.ash);
      p.ellipse(18, 11, 8, 9, PAL.stone, { shade: 0.35 });                                  // hood
      p.poly([[10, 10], [15, 4], [19, 10], [18, 19], [11, 18]], PAL.ink);
      p.ellipse(14, 12, 3, 5, PAL.pale, { shade: 0.2 });
      p.rect(12, 10, 2, 2, PAL.void); p.rect(15, 10, 1, 2, PAL.void);
      p.px(12, 11, PAL.spirit); p.px(15, 11, PAL.spirit);
      p.rect(13, 15, 2, 1, PAL.void);
      p.path([[13, 20], [8, 25], [6, 24]], PAL.stone, 3);                                    // arm
      p.circle(6, 24, 1.5, PAL.pale);
      p.path([[6, 25], [5, 33]], PAL.iron, 1);                                               // chain
      p.ellipse(5, 35, 3, 2.5, PAL.iron, { shade: 0.3 });                                    // thurible
      p.rect(3, 34, 5, 1, PAL.ember);
      p.glow(5, 35, PAL.flame, 3);
      strands(p, [[[5, 32], [3, 27], [5, 22], [3, 17]]], PAL.fog);
      p.speckle(PAL.ash, 0.05, 9, [8, 20, 30, 44]);
    },
  },
  en_willow_wight: {
    w: 62, h: 64,
    draw(p) {
      // weeping canopy behind
      strands(p, [[[40, 10], [50, 22], [54, 44]], [[44, 8], [56, 20], [60, 40]], [[36, 12], [44, 30], [46, 50]], [[48, 12], [58, 30], [57, 52]]], PAL.moss, 2);
      p.path([[32, 40], [44, 54], [50, 63]], PAL.bark, 4); p.path([[24, 46], [16, 56], [8, 63]], PAL.bark, 4);  // roots
      p.path([[28, 50], [28, 63]], PAL.bark, 3); p.path([[36, 48], [38, 63]], PAL.bark, 3);
      p.poly([[22, 14], [38, 12], [42, 30], [40, 50], [22, 52], [18, 32]], PAL.bark, { shade: 0.35 });  // trunk
      p.path([[30, 16], [32, 34], [30, 48]], PAL.wood, 1); p.path([[36, 18], [38, 40]], PAL.wood, 1);
      p.ellipse(25, 26, 4, 3, PAL.void); p.ellipse(33, 25, 3, 3, PAL.void);                 // face
      eyes(p, [[25, 26], [33, 25]], PAL.spirit);
      p.poly([[22, 34], [32, 33], [30, 42], [24, 42]], PAL.void);
      p.px(24, 35, PAL.bone); p.px(28, 34, PAL.bone); p.px(26, 41, PAL.bone);
      p.path([[24, 22], [12, 26], [4, 34]], PAL.bark, 3);                                   // reaching branch arm
      p.path([[4, 34], [0, 32]], PAL.bark, 1); p.path([[4, 34], [1, 38]], PAL.bark, 1); p.path([[6, 33], [3, 40]], PAL.bark, 1);
      p.ellipse(32, 9, 18, 9, PAL.moss, { shade: 0.35 });                                    // canopy dome
      p.ellipse(22, 8, 8, 5, PAL.rot, { shade: 0.3 });
      strands(p, [[[16, 10], [12, 22], [11, 36]], [[20, 14], [17, 28], [16, 42]], [[14, 8], [8, 18], [8, 30]], [[46, 12], [48, 26]], [[28, 16], [26, 22]]], PAL.moss, 2);
      strands(p, [[[18, 12], [14, 26], [14, 34]], [[44, 14], [50, 30], [51, 40]], [[10, 12], [6, 22]]], PAL.rot, 1);
      p.speckle(PAL.bile, 0.06, 5, [14, 0, 52, 16]);
      drips(p, [[11, 38, 2], [16, 44, 1], [8, 32, 2]], PAL.ghost);
    },
  },
  en_zealot: {
    w: 40, h: 58,
    draw(p) {
      p.path([[16, 44], [14, 57]], PAL.ink, 4); p.path([[24, 44], [26, 57]], PAL.ink, 4);       // legs
      p.rect(10, 55, 7, 3, PAL.leather); p.rect(24, 55, 7, 3, PAL.leather);
      p.poly([[11, 20], [29, 20], [32, 48], [8, 48]], PAL.night, { shade: 0.35 });            // coat
      p.rect(19, 22, 2, 26, PAL.ink);
      p.rect(9, 36, 23, 3, PAL.leather); p.rect(18, 36, 4, 3, PAL.gold);
      p.poly([[12, 19], [28, 19], [25, 25], [15, 25]], PAL.bone, { shade: 0.2 });            // collar
      p.ellipse(18, 14, 5, 6, PAL.skin, { shade: 0.3 });                                       // face
      p.tri(13, 14, 11, 17, 14, 17, PAL.skin);                                                // nose
      p.rect(14, 12, 2, 1, PAL.ink); p.rect(14, 17, 3, 1, PAL.gore);
      p.rect(9, 7, 21, 2, PAL.ink);                                                            // brim
      p.poly([[13, 7], [14, -1], [25, -1], [26, 7]], PAL.ink, { shade: 0.2 });                 // capotain
      p.rect(13, 5, 13, 2, PAL.leather); p.rect(17, 5, 3, 2, PAL.gold);
      p.path([[14, 24], [8, 30], [6, 26]], PAL.night, 3);                                      // arm raised
      p.circle(6, 25, 2, PAL.skin);
      p.path([[7, 26], [2, 12]], PAL.wood, 3);                                                 // cudgel
      p.ellipse(2, 11, 3, 4, PAL.wood, { shade: 0.3 }); p.px(1, 9, PAL.iron); p.px(4, 12, PAL.iron); p.px(1, 13, PAL.iron);
      p.glow(6, 26, PAL.ember, 1);                                                             // brand on palm
    },
  },
  en_pyre_bearer: {
    w: 42, h: 58,
    draw(p) {
      p.path([[18, 44], [16, 57]], PAL.bark, 4); p.path([[26, 44], [28, 57]], PAL.bark, 4);
      p.poly([[12, 20], [32, 20], [36, 48], [8, 48]], PAL.dusk, { shade: 0.35 });            // coat
      p.poly([[14, 26], [28, 26], [30, 50], [12, 50]], PAL.leather, { shade: 0.3 });         // apron
      p.speckle(PAL.ink, 0.08, 4, [12, 26, 30, 50]);
      p.ellipse(22, 13, 8, 9, PAL.dusk, { shade: 0.35 });                                    // hood
      p.poly([[14, 12], [19, 6], [22, 12], [21, 20], [14, 19]], PAL.ink);
      p.rect(14, 14, 7, 5, PAL.bone);                                                          // scarf mask
      p.path([[14, 16], [20, 16]], PAL.ash, 1);
      p.px(16, 11, PAL.flame); p.px(19, 11, PAL.flame);
      p.path([[16, 26], [10, 30], [8, 26]], PAL.dusk, 3);                                      // arm
      p.path([[9, 52], [6, 14]], PAL.wood, 2);                                                 // pole
      p.rect(1, 10, 11, 5, PAL.iron); p.rect(0, 9, 13, 2, PAL.iron);                          // brazier
      p.circle(8, 27, 2, PAL.skin);
      flame(p, 6, 10, 10, 6);
      p.glow(6, 6, PAL.candle, 3);
      p.px(10, 1, PAL.flame); p.px(3, 0, PAL.ember);
    },
  },
  en_antlered_hart: {
    w: 64, h: 58,
    draw(p) {
      p.path([[46, 36], [48, 46], [47, 57]], PAL.stone, 3); p.path([[30, 36], [28, 46], [29, 57]], PAL.stone, 3); // far legs
      p.ellipse(40, 30, 17, 9, PAL.fog, { shade: 0.35 });                                     // body
      p.path([[52, 26], [58, 30], [60, 36]], PAL.fog, 2);                                     // tail
      p.path([[52, 36], [55, 46], [54, 57]], PAL.fog, 3); p.path([[34, 37], [32, 47], [33, 57]], PAL.fog, 3); // near legs
      p.rect(31, 55, 4, 2, PAL.ink); p.rect(52, 55, 4, 2, PAL.ink);
      p.poly([[26, 24], [18, 30], [14, 36], [20, 38], [30, 34]], PAL.fog, { shade: 0.3 });   // neck lowered
      p.ellipse(12, 37, 7, 4, PAL.bone, { shade: 0.3 });                                       // head
      p.ellipse(5, 38, 2, 2, PAL.ash);
      p.glow(11, 35, PAL.spirit, 1);
      p.tri(16, 33, 20, 30, 19, 35, PAL.fog);                                                  // ear
      // antlers sweeping forward-up
      p.path([[14, 33], [10, 24], [6, 14], [8, 4]], PAL.bark, 2);
      p.path([[10, 24], [2, 20]], PAL.bark, 2); p.path([[7, 16], [0, 10]], PAL.bark, 1); p.path([[7, 10], [12, 2]], PAL.bark, 1);
      p.path([[17, 32], [20, 22], [24, 12], [22, 3]], PAL.bark, 2);
      p.path([[20, 22], [28, 18]], PAL.bark, 2); p.path([[23, 14], [30, 8]], PAL.bark, 1); p.path([[24, 9], [19, 4]], PAL.bark, 1);
      p.path([[2, 20], [2, 26]], PAL.bone, 1); p.rect(1, 26, 3, 2, PAL.bone);                 // hung bones
      p.path([[28, 18], [28, 23]], PAL.bone, 1); p.circle(28, 24, 1.5, PAL.bone);
      p.speckle(PAL.stone, 0.05, 12, [24, 22, 56, 40]);
    },
  },
  en_fae_courtier: {
    w: 32, h: 48,
    draw(p) {
      p.poly([[16, 12], [30, 4], [31, 26], [24, 34]], PAL.lilac, { shade: 0.3 });            // wing cape
      p.circle(27, 12, 2, PAL.ghost); p.px(27, 12, PAL.violet);
      p.path([[14, 34], [12, 47]], PAL.night, 2); p.path([[19, 34], [21, 47]], PAL.night, 2);
      p.poly([[11, 14], [22, 14], [23, 34], [10, 34]], PAL.moss, { shade: 0.35 });           // doublet
      p.rect(15, 16, 2, 18, PAL.gold);
      p.poly([[9, 13], [12, 6], [16, 12], [21, 6], [24, 13]], PAL.bone);                       // ruff collar
      p.ellipse(15, 8, 4, 5, PAL.bone, { shade: 0.25 });                                       // mask
      p.erase(12, 7, 2, 1); p.erase(15, 7, 2, 1);
      p.glow(12, 7, PAL.venom, 1);
      p.tri(13, 3, 15, -1, 16, 4, PAL.violet); p.tri(17, 3, 20, 0, 19, 5, PAL.violet);
      p.path([[12, 18], [8, 22], [6, 21]], PAL.moss, 2);
      p.line(6, 21, 0, 28, PAL.steel, 1); p.rect(5, 20, 3, 2, PAL.gold);                      // rapier
    },
  },
  en_grall_pyre: {
    w: 38, h: 60,
    draw(p) {
      p.rect(17, 4, 4, 52, PAL.wood, { shade: 0.3 });                                          // stake
      p.rect(9, 12, 20, 3, PAL.wood);                                                           // crossbar
      p.path([[12, 15], [13, 24], [17, 26]], PAL.iron, 1); p.path([[26, 15], [25, 24], [21, 26]], PAL.iron, 1);
      p.ring(19, 30, 4, PAL.iron, 1);
      flame(p, 19, 50, 26, 14);
      flame(p, 10, 52, 14, 6); flame(p, 29, 52, 15, 6);
      for (let i = 0; i < 6; i++) p.ellipse(6 + i * 5, 54, 5, 3, i % 2 ? PAL.bark : PAL.wood, { shade: 0.3 });
      for (let i = 0; i < 5; i++) p.ellipse(8 + i * 5.5, 57, 5, 2.5, i % 2 ? PAL.wood : PAL.bark, { shade: 0.3 });
      p.glow(19, 40, PAL.candle, 5);
      p.px(12, 20, PAL.flame); p.px(28, 22, PAL.ember); p.px(24, 10, PAL.flame);
    },
  },

  // ------------------------------------------------------------ elites
  en_thornwarden: {
    w: 74, h: 80,
    draw(p) {
      p.poly([[34, 26], [56, 24], [66, 70], [44, 74]], PAL.moss, { shade: 0.3 });             // cloak
      strands(p, [[[56, 30], [64, 50], [70, 76]], [[50, 40], [56, 62], [54, 78]]], PAL.rot, 1);
      p.path([[38, 54], [34, 77]], PAL.bark, 6); p.path([[48, 54], [52, 77]], PAL.bark, 6);     // legs
      p.rect(29, 74, 9, 4, PAL.wood); p.rect(48, 74, 9, 4, PAL.wood);
      p.poly([[30, 24], [52, 24], [56, 56], [28, 56]], PAL.bark, { shade: 0.4 });             // torso armour
      p.path([[30, 34], [54, 36]], PAL.wood, 1); p.path([[29, 44], [55, 46]], PAL.wood, 1);
      strands(p, [[[30, 28], [42, 40], [36, 52], [50, 56]], [[52, 26], [40, 30], [46, 44]]], PAL.moss, 2);
      for (const [x, y] of [[36, 37], [44, 32], [40, 48], [48, 52], [33, 47]]) p.tri(x, y, x + 2, y - 4, x + 3, y, PAL.bone);
      p.ellipse(54, 28, 8, 6, PAL.bark, { shade: 0.3 });                                       // pauldron
      p.ellipse(40, 16, 9, 10, PAL.bark, { shade: 0.4 });                                      // helm
      p.rect(31, 15, 9, 3, PAL.void);                                                           // visor
      eyes(p, [[33, 16], [37, 16]], PAL.venom);
      for (const [x1, y1, x2, y2] of [[34, 8, 28, 0], [40, 6, 38, -2], [46, 8, 50, 0], [48, 12, 56, 6]]) p.path([[x1, y1], [x2, y2]], PAL.bark, 2);
      p.tri(27, 2, 30, 1, 28, -2, PAL.bone); p.tri(55, 7, 57, 4, 58, 7, PAL.bone);
      // briar lance couched, pointing left
      p.path([[50, 40], [2, 30]], PAL.wood, 3);
      p.tri(0, 30, 8, 27, 8, 33, PAL.bone);
      for (let x = 10; x < 46; x += 6) { const y = 30 + (x / 48) * 10; p.tri(x, y - 1, x + 2, y - 5, x + 3, y - 1, PAL.moss); p.tri(x + 3, y + 1, x + 4, y + 4, x + 6, y + 1, PAL.moss); }
      p.path([[34, 30], [26, 36], [24, 34]], PAL.bark, 4);                                      // arm on lance
      // woven thorn shield
      p.ellipse(28, 52, 9, 12, PAL.wood, { shade: 0.35 });
      p.path([[22, 44], [34, 60]], PAL.bark, 1); p.path([[34, 44], [22, 60]], PAL.bark, 1); p.path([[20, 52], [36, 52]], PAL.bark, 1);
      p.glow(28, 52, PAL.bile, 2);
    },
  },
  en_inquisitor: {
    w: 60, h: 78,
    draw(p) {
      p.poly([[18, 24], [40, 24], [50, 76], [10, 76]], PAL.wine, { shade: 0.35 });             // robe
      p.poly([[10, 76], [14, 70], [20, 76], [26, 70], [32, 76], [38, 70], [44, 76], [50, 76]], PAL.gore);
      p.rect(28, 30, 3, 46, PAL.gold);
      p.poly([[14, 20], [44, 20], [48, 44], [30, 38], [10, 44]], PAL.ink, { shade: 0.25 });    // mantle
      p.ellipse(28, 14, 10, 12, PAL.ink, { shade: 0.25 });                                      // cowl
      p.poly([[17, 12], [24, 4], [30, 10], [30, 24], [18, 24]], PAL.void);
      p.ellipse(23, 15, 5, 7, PAL.iron, { shade: 0.35 });                                       // iron mask
      p.rect(19, 13, 3, 1, PAL.void); p.rect(24, 13, 2, 1, PAL.void); p.rect(22, 15, 1, 4, PAL.steel);
      p.glow(20, 13, PAL.ember, 1);
      p.rect(19, 19, 6, 1, PAL.void);
      // chained book at the hip
      p.path([[34, 40], [38, 50]], PAL.iron, 1);
      p.rect(34, 50, 9, 11, PAL.leather, { shade: 0.3 }); p.rect(34, 50, 9, 1, PAL.gold); p.rect(37, 54, 3, 3, PAL.gold);
      // arm with branding iron
      p.path([[20, 28], [12, 36], [8, 33]], PAL.wine, 5);
      p.circle(8, 33, 2.5, PAL.pale);
      p.path([[10, 35], [1, 14]], PAL.iron, 2);
      p.rect(0, 9, 5, 6, PAL.ember); p.rect(1, 10, 3, 4, PAL.flame);
      p.glow(2, 11, PAL.candle, 4);
      p.px(4, 7, PAL.flame); p.px(0, 6, PAL.ember);
    },
  },
  en_mere_hag: {
    w: 78, h: 70,
    draw(p) {
      p.ellipse(40, 64, 37, 5, PAL.deep);                                                       // the mere
      // hunched, drowned body: dark so the face and hands pop
      p.poly([[30, 36], [52, 24], [68, 38], [66, 64], [24, 64], [22, 46]], PAL.moss, { shade: 0.35 });
      p.poly([[40, 44], [66, 42], [66, 64], [36, 64]], PAL.deep);
      p.speckle(PAL.rot, 0.12, 21, [22, 26, 68, 64]);
      p.ellipse(52, 30, 12, 8, PAL.rot, { shade: 0.3 });                                        // humped shoulder
      // hair: dark mass behind the face, weed streaming over the body
      p.ellipse(26, 26, 14, 14, PAL.ink, { shade: 0.2 });
      strands(p, [[[22, 14], [12, 32], [10, 54]], [[28, 12], [34, 36], [32, 58]], [[34, 16], [48, 34], [52, 58]], [[40, 20], [58, 36], [62, 58]], [[18, 18], [14, 40], [16, 58]]], PAL.moss, 2);
      strands(p, [[[24, 14], [18, 34], [20, 52]], [[36, 18], [44, 40], [46, 56]]], PAL.rot, 1);
      // the face, big and pale-green
      p.ellipse(22, 28, 9, 10, PAL.sick, { shade: 0.35 });
      p.tri(13, 28, 6, 36, 15, 34, PAL.sick);                                                    // hooked nose
      p.ellipse(18, 25, 3, 2.5, PAL.void); p.ellipse(25, 24, 3, 2.5, PAL.void);                 // sockets
      eyes(p, [[18, 25], [25, 24]], PAL.candle, 2);
      p.poly([[14, 37], [27, 37], [25, 43], [16, 43]], PAL.void);                               // maw
      for (const x of [15, 18, 21, 24]) p.tri(x, 37, x + 1.5, 40, x + 3, 37, PAL.bone);
      for (const x of [17, 20, 23]) p.tri(x, 43, x + 1.5, 40, x + 3, 43, PAL.bone);
      // long bony arms: one reaching up-left, one trailing in the water
      p.path([[34, 44], [22, 46], [10, 38]], PAL.pale, 4);
      p.path([[10, 38], [4, 28]], PAL.pale, 2);
      for (const [dx, dy] of [[-5, -6], [-7, -2], [-6, 3]]) p.path([[4, 28 + (dy > 0 ? 6 : 0)], [4 + dx, 28 + dy + (dy > 0 ? 6 : 0)]], PAL.bone, 1);
      p.path([[44, 52], [30, 58], [18, 60]], PAL.pale, 4);
      for (const [dx, dy] of [[-6, -3], [-7, 0], [-5, 3]]) p.path([[18, 60], [18 + dx, 60 + dy]], PAL.bone, 1);
      // ripples
      p.ellipse(40, 66, 34, 2, PAL.water);
      p.rect(8, 64, 8, 1, PAL.ghost); p.rect(52, 66, 10, 1, PAL.ghost); p.rect(30, 67, 6, 1, PAL.ghost);
      drips(p, [[6, 40, 3], [12, 46, 2], [3, 36, 2], [48, 56, 2]], PAL.frost);
    },
  },

  // ------------------------------------------------------------ bosses
  en_grall: {
    w: 86, h: 106,
    draw(p) {
      p.poly([[30, 34], [62, 32], [76, 100], [22, 102]], PAL.dusk, { shade: 0.3 });            // cape
      p.path([[38, 76], [34, 104]], PAL.ink, 7); p.path([[52, 76], [56, 104]], PAL.ink, 7);    // legs
      p.rect(27, 100, 11, 5, PAL.leather); p.rect(52, 100, 11, 5, PAL.leather);
      p.poly([[30, 34], [58, 34], [62, 82], [26, 82]], PAL.night, { shade: 0.35 });           // coat
      p.rect(43, 38, 2, 44, PAL.ink);
      p.poly([[32, 38], [56, 38], [54, 58], [34, 58]], PAL.steel, { shade: 0.4 });            // cuirass
      p.rect(28, 60, 33, 4, PAL.leather); p.rect(41, 60, 6, 4, PAL.gold);
      p.poly([[30, 32], [58, 32], [54, 42], [34, 42]], PAL.bone, { shade: 0.25 });            // falling collar
      p.ellipse(42, 24, 8, 10, PAL.skin, { shade: 0.3 });                                      // face
      p.tri(35, 23, 32, 28, 36, 28, PAL.skin);
      p.poly([[34, 28], [46, 28], [44, 36], [38, 37], [34, 32]], PAL.fog, { shade: 0.2 });     // grey beard
      p.rect(36, 20, 4, 1, PAL.ink); p.glow(37, 21, PAL.ember, 1);
      p.rect(35, 18, 6, 1, PAL.fog);
      p.rect(26, 13, 34, 3, PAL.ink);                                                           // brim
      p.poly([[32, 13], [34, 0], [52, 0], [54, 13]], PAL.ink, { shade: 0.2 });                // capotain
      p.rect(32, 10, 22, 3, PAL.leather); p.rect(39, 10, 6, 3, PAL.gold); p.rect(41, 11, 2, 1, PAL.ink);
      // torch arm raised forward
      p.path([[34, 42], [22, 48], [16, 40]], PAL.night, 6);
      p.circle(15, 39, 3, PAL.leather);
      p.path([[16, 42], [10, 20]], PAL.wood, 3);
      p.rect(7, 18, 7, 4, PAL.iron);
      flame(p, 10, 19, 16, 7);
      p.glow(10, 12, PAL.candle, 5);
      p.px(4, 4, PAL.flame); p.px(15, 2, PAL.ember); p.px(8, 0, PAL.flame);
      // iron scourge hanging from the other hand
      p.path([[56, 44], [64, 60], [62, 66]], PAL.night, 6);
      p.circle(62, 67, 3, PAL.leather);
      p.rect(60, 68, 4, 6, PAL.wood);
      for (const dx of [-4, 0, 4]) p.path([[62, 74], [62 + dx, 84], [62 + dx * 1.5, 92]], PAL.iron, 1);
      for (const dx of [-4, 0, 4]) p.circle(62 + dx * 1.5, 92, 1.5, PAL.steel);
    },
  },
  en_antlered_king: {
    w: 110, h: 112,
    draw(p) {
      // great antlers
      const A = PAL.bark;
      p.path([[50, 28], [40, 16], [30, 6], [22, 0]], A, 4); p.path([[40, 16], [26, 18], [12, 12]], A, 3);
      p.path([[30, 6], [18, 4], [10, -1]], A, 2); p.path([[26, 18], [16, 24], [6, 22]], A, 2); p.path([[36, 12], [36, 2]], A, 2);
      p.path([[62, 28], [72, 16], [82, 6], [90, 0]], A, 4); p.path([[72, 16], [86, 18], [100, 12]], A, 3);
      p.path([[82, 6], [94, 4], [102, -1]], A, 2); p.path([[86, 18], [96, 24], [106, 22]], A, 2); p.path([[76, 12], [76, 2]], A, 2);
      for (const [x, y] of [[12, 12], [6, 22], [100, 12], [106, 22], [22, 0], [90, 0]]) p.circle(x, y, 1.5, PAL.bone);
      strands(p, [[[18, 21], [18, 30]], [[95, 21], [95, 32]], [[30, 10], [29, 18]]], PAL.moss, 1);
      // robes
      p.poly([[40, 44], [72, 44], [96, 110], [16, 110]], PAL.night, { shade: 0.3 });
      p.poly([[44, 46], [68, 46], [80, 110], [32, 110]], PAL.moss, { shade: 0.35 });
      p.poly([[50, 50], [62, 50], [64, 110], [48, 110]], PAL.rot, { shade: 0.3 });
      strands(p, [[[36, 60], [26, 86], [22, 108]], [[76, 60], [86, 86], [92, 108]], [[56, 54], [56, 108]]], PAL.dusk, 1);
      p.speckle(PAL.bile, 0.03, 31, [20, 60, 96, 110]);
      for (let i = 0; i < 9; i++) p.ellipse(20 + i * 9, 107, 6, 4, i % 2 ? PAL.moss : PAL.rot, { shade: 0.3 });  // leaf hem
      // mantle of leaves at shoulders
      p.ellipse(56, 46, 22, 8, PAL.rot, { shade: 0.35 });
      p.speckle(PAL.moss, 0.25, 7, [34, 38, 78, 54]);
      // head: long pale face, glowing eyes, crown at antler base
      p.ellipse(56, 30, 9, 15, PAL.bone, { shade: 0.35 });
      p.ellipse(52, 26, 3, 2, PAL.void); p.ellipse(60, 26, 3, 2, PAL.void);
      eyes(p, [[52, 26], [60, 26]], PAL.spirit, 2);
      p.path([[52, 36], [56, 40], [60, 36]], PAL.ash, 1);
      p.rect(55, 29, 2, 5, PAL.parch);
      p.poly([[46, 18], [48, 12], [51, 17], [54, 10], [56, 16], [58, 10], [61, 17], [64, 12], [66, 18], [64, 21], [48, 21]], PAL.gold, { shade: 0.3 });
      p.glow(56, 15, PAL.venom, 1);
      // staff in the forward hand (left)
      p.path([[40, 56], [26, 66], [22, 62]], PAL.night, 6);
      p.path([[22, 64], [20, 56]], PAL.bone, 2); p.path([[24, 64], [24, 57]], PAL.bone, 2);
      p.path([[20, 110], [16, 30]], PAL.wood, 3);
      p.circle(16, 26, 5, PAL.bone, { shade: 0.3 });                                           // stag skull finial
      p.erase(14, 25, 2, 2); p.path([[13, 22], [8, 12]], PAL.bark, 1); p.path([[19, 22], [24, 12]], PAL.bark, 1);
      p.glow(16, 30, PAL.spirit, 2);
      // moths about him
      for (const [x, y] of [[8, 46], [100, 52], [92, 38]]) { p.tri(x - 3, y - 2, x, y, x - 3, y + 2, PAL.lilac); p.tri(x + 3, y - 2, x, y, x + 3, y + 2, PAL.lilac); }
    },
  },
  en_drowned_abbess: {
    w: 92, h: 108,
    draw(p) {
      // the mere beneath her
      p.ellipse(46, 102, 44, 6, PAL.deep);
      p.ellipse(46, 101, 36, 3, PAL.water);
      // veil streaming back (right) and down
      p.poly([[38, 12], [66, 10], [88, 50], [84, 96], [62, 100], [52, 40]], PAL.ghost, { shade: 0.3 });
      strands(p, [[[66, 20], [78, 50], [80, 92]], [[60, 30], [68, 64], [70, 96]]], PAL.frost, 1);
      // habit
      p.poly([[30, 36], [58, 36], [68, 98], [20, 98]], PAL.deep, { shade: 0.3 });
      p.poly([[36, 40], [52, 40], [56, 98], [32, 98]], PAL.water, { shade: 0.3 });
      // dissolving hem
      p.poly([[20, 98], [24, 90], [28, 99], [34, 91], [40, 100], [46, 90], [52, 100], [58, 91], [64, 99], [68, 98]], PAL.deep);
      for (const [x, y] of [[22, 92], [30, 88], [50, 86], [62, 90], [40, 84]]) p.eraseEllipse(x, y, 2, 3);
      // wimple
      p.ellipse(42, 24, 14, 16, PAL.bone, { shade: 0.3 });
      p.poly([[28, 30], [56, 30], [60, 44], [24, 44]], PAL.bone, { shade: 0.25 });
      // face, turned left, mournful
      p.ellipse(38, 24, 7, 9, PAL.pale, { shade: 0.35 });
      p.ellipse(35, 22, 2, 2, PAL.void); p.ellipse(41, 22, 2, 1.5, PAL.void);
      p.px(35, 22, PAL.spirit); p.px(41, 22, PAL.spirit);
      p.path([[35, 24], [34, 30]], PAL.spirit, 1); p.path([[41, 24], [41, 28]], PAL.spirit, 1);   // tears
      p.path([[35, 30], [38, 29], [40, 30]], PAL.ash, 1);
      // verdigris crown over the veil
      p.poly([[30, 12], [32, 6], [35, 11], [38, 4], [42, 10], [46, 4], [49, 11], [52, 6], [54, 12], [52, 15], [32, 15]], VERDIGRIS, { shade: 0.35 });
      p.px(38, 9, PAL.spirit); p.px(46, 9, PAL.spirit);
      // hood of black veil over crown edge
      p.poly([[54, 8], [62, 10], [66, 24], [56, 22]], PAL.ink);
      // clasped hands with rosary
      p.poly([[30, 50], [44, 48], [46, 56], [32, 60]], PAL.water, { shade: 0.3 });
      p.ellipse(32, 54, 4, 4, PAL.pale, { shade: 0.3 });
      p.path([[32, 58], [30, 68], [34, 74]], PAL.bone, 1);
      for (const [x, y] of [[30, 62], [31, 66], [32, 70], [34, 74]]) p.px(x, y, PAL.bone);
      p.rect(33, 75, 3, 1, PAL.bone); p.rect(34, 74, 1, 3, PAL.bone);
      // weed and drips
      strands(p, [[[26, 40], [22, 56], [24, 70]], [[60, 44], [64, 60]]], PAL.moss, 1);
      drips(p, [[24, 74, 3], [30, 78, 2], [58, 80, 2], [44, 82, 3], [20, 100, 2]], PAL.frost);
      p.glow(32, 54, PAL.ghost, 3);
    },
  },
});
