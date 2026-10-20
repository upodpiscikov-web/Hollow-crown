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
      thurible: { name: 'Thurible', intent: 'atk', dmg: 5, times: 2 },
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
      blade: { name: 'Fae Blade', intent: 'atk', dmg: 12 },
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
    id: 'grall_pyre', name: 'The Pyre', kind: 'normal', act: 2, hp: [30, 34],
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
    id: 'grall', name: 'Mattias Grall', kind: 'boss', act: 2, hp: [340, 350], leader: true,
    sprite: 'en_grall',
    desc: 'The Witchfinder General. He served beside the King\'s Shield once, and believes, with his whole heart, that fire is a kindness.',
    init(g, e) { g.addStatus(e, 'a2_zealotry', 5, { silent: true }); },
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
      verdict: { name: 'Verdict', intent: 'atk', dmg: (g, e) => (e.data.p2 ? 22 : 18) },
      kindle: { name: 'Bring Kindling', intent: 'debuff', fx(g, e) { addCards(g, 'ash', 2, 'draw'); block(g, e, 10); } },
      pious: { name: 'Pious Guard', intent: 'defbuff', fx(g, e) { block(g, e, 16); buff(g, e, 'might', 2); } },
      light: {
        name: 'Light the Pyre', intent: 'summon',
        fx(g, e) { e.data.lit = true; g.spawn('grall_pyre', { minion: true }); buff(g, e, 'might', 2); },
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
defineSprites({});
