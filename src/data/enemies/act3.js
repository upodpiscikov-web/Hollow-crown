// ACT 3 — ASHGRAVE, the capital under the Regent: crown-cultists, court phantoms,
// the undead Royal Guard, plague doctors, gilded decay.
// ACT 4 — BENEATH THE THRONE (true-ending path): the Unspent and the Hollow King.
//
// Every enemy is built around one readable rule:
//   Crown Zealot       Martyrdom — at half HP it prepares to burst; kill it or brace.
//   Gilded Sentinel    Iron Discipline (Block persists); Shield Bash hits for half its Block.
//   Court Phantom      Fades every other turn (Phantasm): strike on the turn it shows Fade.
//   Plague Doctor      Rot, and Leeching heals its most wounded ally.
//   Regent's Inquisitor Confiscate — seizes your best card from your draw pile; kill it
//                      to get the card back.
//   Chimney Wraith     Soot: Ash and Daze into your piles, little hits in numbers.
//   Ash Golem          Cinder Skin — every hit hardens it; hit hard, not often.
//   Lamplighter        Ash-Burn, and Light the Way (all allies gain Might).
//   Gargoyle           Stone form: takes no more than 5 per hit until it dives.
//   Gilt Penitent      the Saint's minion: kneels to shield her.
//   Chorister          the Choir's voices (see below).
// Elites:
//   The King's Executioner  Condemned countdown on you, then a Headsman's Blow that
//                           grows every time it falls. Light work between.
//   The Twin Heralds        if one falls, the other sounds the Return and raises it at
//                           half HP. Silence both on the same turn.
//   The Gilded Saint        Ward and Block for her flock, Anoint (Might), Canonize
//                           (new Penitents); she gains Might when one dies.
// Bosses:
//   Lord Severin Crane     Calls the Guard; once, below 60% HP, Marks the Hour and two
//                          turns later Rewrites it (HP back to the mark, debuffs gone);
//                          the Hour Grows Late (+3 Might every 3 turns).
//   The Choir Immaculate   Hymn: gains Verse each turn per living Chorister; Verse adds
//                          damage; at 12 it sings the Gloria. Killing a Chorister halves
//                          the Verse and can break the Gloria before it lands.
//   The Crowned Rival      another heir, crowned in another loop:
//     Iron King (knight)   swears Oaths you must break (shatter his Block / hurt him).
//     Blight Queen (witch) Rot on you becomes her Block; Reap hits harder per Rot;
//                          brews and drinks Black Draughts.
//     Thousand-Faced (wren) wears a new Face each turn: Wolf (hits hard, takes more),
//                          Moth (takes less), Owl (Borrowed Face copies your biggest hit).
//     Requiem King (cantor) channels Kept spirits (killable minions), then Requiem
//                          spends them all at once.
// Act 4:
//   The Unspent (E)        Multitude: Grasp hits once per body; every 60 HP lost, one lies
//                          down. Unmourned Names in your hand feed it.
//   The Hollow King (B)    Aldric's corpse; every 4th turn Aldric resists the Crown.
//                          At 0 HP the corpse falls and THE HOLLOW CROWN rises (phase 2):
//                          Hold the Hour (your hand is held, then you draw less), Take the
//                          Hour (Energy), and every third turn: "Again."

import { defineCards, defineStatuses, defineEnemies, defineEncounters, defineTexts, STATUSES } from '../../engine/registry.js';
import { defineSprites, PAL } from '../../gfx/sprite.js';
import { pick, int, rnd } from '../../engine/rng.js';

// ------------------------------------------------------------------ helpers
const num = (x, g, e) => (typeof x === 'function' ? x(g, e) : x);
const living = (g, id) => g.enemies.filter((x) => x.id === id);
const allies = (g, e) => g.enemies.filter((x) => x !== e);
const block = (g, e, n) => g.gainBlock(e, n, { raw: true });
const buff = (g, e, id, n) => g.apply(e, id, n, e);
const debuff = (g, e, id, n) => g.apply(g.player, id, n, e);
const toast = (g, text) => g.emit('toast', { text });
const seen = (g, e) => { if (typeof g.markSeen === 'function') g.markSeen('enemies', e.id); };
const sinceLast = (e, id) => { for (let i = e.hist.length - 1; i >= 0; i--) if (e.hist[i] === id) return e.hist.length - 1 - i; return 99; };
const asMinionOf = (g, e, leader) => {
  if (!e.st.minion && g.cb && g.cb.enemies.some((x) => !x.dead && x.id === leader)) g.addStatus(e, 'minion', 1, { silent: true });
};
// Step a self-tracked status to exactly n (0 removes it).
const setStatus = (g, e, id, n, silent = false) => {
  const cur = g.st(e, id);
  if (cur !== n) g.addStatus(e, id, n - cur, { silent });
};
// Remove every debuff (and negative Might/Guard) from an entity.
const cleanse = (g, e) => {
  for (const id of Object.keys(e.st)) {
    const d = STATUSES[id];
    if (d && (d.kind === 'debuff' || (d.negOk && e.st[id] < 0))) g.removeStatus(e, id);
  }
};

const UNMOURNED = 'unmourned_name';
const GLORIA = 12;
const HERALDS = ['herald_morning', 'herald_mourning'];
const KEPT = ['kept_wisp', 'kept_warden', 'kept_banshee'];
const FACES = ['face_wolf', 'face_moth', 'face_owl'];
const RIVALS = ['rival_knight', 'rival_witch', 'rival_wren', 'rival_cantor'];

// ------------------------------------------------------------------ status cards
defineCards([
  {
    id: UNMOURNED, name: 'Unmourned Name', hero: 'status', type: 'status', rarity: 'special', cost: 1, target: 'none',
    kw: ['exhaust'], art: 'grave', noUp: true,
    text: 'Say it aloud. If this is in your hand at the end of your turn, the Unspent gains 1 Multitude.',
    play() {},
    endTurnInHand(g) {
      const u = living(g, 'the_unspent')[0];
      if (u && g.st(u, 'multitude') < 8) g.addStatus(u, 'multitude', 1);
    },
  },
]);

// ------------------------------------------------------------------ statuses
defineStatuses([
  // --- normals
  {
    id: 'a3_martyrdom', name: 'Martyrdom', kind: 'buff', icon: 'zeal',
    desc: () => 'Below half HP, it stops fighting and prepares to burst. Kill it first or brace for the blast.',
  },
  {
    id: 'a3_cinder_skin', name: 'Cinder Skin', kind: 'buff', icon: 'plating',
    desc: (n) => `Whenever it takes attack damage, gains ${n} Block, and 1 more each time. Resets at the start of its turn.`,
    onAttacked(g, o, n, src, unblocked) {
      if (o.dead || unblocked <= 0) return;
      g.gainBlock(o, n, { raw: true });
      g.addStatus(o, 'a3_cinder_skin', 1, { silent: true });
    },
    turnStart(g, o) { setStatus(g, o, 'a3_cinder_skin', o.data.skin || 3, true); },
  },
  {
    id: 'a3_confiscated', name: 'Confiscated', kind: 'buff', icon: 'chain',
    desc: (n, g, o) => {
      const list = (o && o.data && o.data.seized) || [];
      return `Holds ${list.length} of your card${list.length === 1 ? '' : 's'}. They return to your hand when it dies.`;
    },
  },
  // --- elites
  {
    id: 'a3_condemned', name: 'Condemned', kind: 'debuff', icon: 'skull',
    desc: (n) => n <= 1
      ? 'The Headsman\'s Blow falls on his next turn.'
      : `The Headsman's Blow falls in ${n} turns.`,
  },
  {
    id: 'a3_twin_bond', name: 'Twin Voices', kind: 'buff', icon: 'heart',
    desc: () => 'If its twin falls, it sounds the Return on its next turn and raises them at half HP. Silence both on the same turn.',
  },
  {
    id: 'a3_saints_grief', name: 'Reliquary', kind: 'buff', icon: 'crown',
    desc: (n) => `Whenever one of her Penitents dies, she gains ${n} Might.`,
    enemyDied(g, o, n, dead) { if (!o.isPlayer && !o.dead && dead.id === 'gilt_penitent') g.apply(o, 'might', n, o); },
  },
  // --- Crane
  {
    id: 'a3_late_hour', name: 'The Hour Grows Late', kind: 'buff', icon: 'moon',
    desc: (n) => n <= 1 ? 'At the end of his turn, gains 3 Might. Then the count begins again.' : `In ${n} turns, gains 3 Might. Then the count begins again.`,
    turnEnd(g, o, n) {
      if (n <= 1) { g.apply(o, 'might', 3, o); setStatus(g, o, 'a3_late_hour', 3); } else g.addStatus(o, 'a3_late_hour', -1);
    },
  },
  {
    id: 'a3_hour_mark', name: 'Marked Hour', kind: 'buff', icon: 'eye',
    desc: (n, g, o) => {
      const hp = o && o.data && o.data.markHp != null ? o.data.markHp : '?';
      return n <= 1
        ? `On his next turn he rewrites the hour: his HP returns to ${hp} and his debuffs vanish.`
        : `In ${n} turns he rewrites the hour: his HP returns to ${hp} and his debuffs vanish.`;
    },
    turnEnd(g, o, n) {
      if (o.data.markFresh) { o.data.markFresh = false; return; }
      if (n > 1) g.addStatus(o, 'a3_hour_mark', -1);
    },
  },
  // --- Choir
  {
    id: 'a3_hymn', name: 'Hymn', kind: 'buff', icon: 'echo',
    desc: (n) => `At the end of its turn, gains ${n} Verse (1 per living Chorister). Each Chorister that dies halves its Verse.`,
    turnEnd(g, o, n) { g.apply(o, 'a3_verse', n, o); },
  },
  {
    id: 'a3_verse', name: 'Verse', kind: 'buff', icon: 'star',
    desc: (n) => `Attacks deal ${n} more damage. At ${GLORIA} Verse it sings the Gloria.`,
    atkAdd: (g, o, n) => n,
  },
  // --- Rival: the Iron King
  {
    id: 'a3_oath_wall', name: 'Oath of the Wall', kind: 'buff', icon: 'oath',
    desc: () => 'If he still has Block at the start of his next turn, he keeps it and gains 3 Might. Shatter his Block to break the oath: he becomes Weakened.',
    turnStart(g, o) {
      g.removeStatus(o, 'a3_oath_wall');
      g.removeStatus(o, 'barricade');
      if (o.block > 0) { g.apply(o, 'might', 3, o); toast(g, 'The Iron King keeps his oath.'); } else { g.apply(o, 'weak', 2, o); toast(g, 'Oath broken. The Iron King falters.'); }
    },
  },
  {
    id: 'a3_oath_vengeance', name: 'Oath of Vengeance', kind: 'buff', icon: 'oath',
    desc: (n) => `Unless he loses ${n} more HP before his next turn, he gains 4 Might. Break the oath and he becomes Weakened.`,
    hpLost(g, o, n, amount) {
      if (amount < n) { g.addStatus(o, 'a3_oath_vengeance', -amount); return; }
      g.removeStatus(o, 'a3_oath_vengeance');
      if (o.hp > 0) { g.apply(o, 'weak', 2, o); toast(g, 'Oath broken. The Iron King falters.'); }
    },
    turnStart(g, o) { g.removeStatus(o, 'a3_oath_vengeance'); g.apply(o, 'might', 4, o); toast(g, 'The Iron King keeps his oath.'); },
  },
  // --- Rival: the Blight Queen
  {
    id: 'a3_crown_of_rot', name: 'Crown of Rot', kind: 'buff', icon: 'rot',
    desc: () => 'At the start of her turn, gains Block equal to twice your Rot.',
    turnStart(g, o) { const r = g.st(g.player, 'rot'); if (r > 0) g.gainBlock(o, r * 2, { raw: true }); },
  },
  {
    id: 'a3_black_draught', name: 'Black Draughts', kind: 'buff', icon: 'brew',
    desc: (n) => `${n} Black Draught${n > 1 ? 's' : ''} brewed. When she drinks, she heals 6 and gains 2 Might for each.`,
  },
  // --- Rival: the Thousand-Faced
  {
    id: 'face_wolf', name: 'Wolf Face', kind: 'buff', icon: 'mask',
    desc: () => 'Wolf Face: deals 50% more attack damage, and takes 25% more.',
    atkMul: () => 1.5, takeMul: () => 1.25,
  },
  {
    id: 'face_moth', name: 'Moth Face', kind: 'buff', icon: 'mask',
    desc: () => 'Moth Face: takes 25% less attack damage.',
    takeMul: () => 0.75,
  },
  {
    id: 'face_owl', name: 'Owl Face', kind: 'buff', icon: 'mask',
    desc: () => 'Owl Face: her Borrowed Face copies the biggest hit you deal her this turn (at least 6).',
  },
  // --- Act 4
  {
    id: 'a4_multitude', name: 'Multitude', kind: 'buff', icon: 'skull',
    desc: (n) => `${n} bodies. Its Grasp strikes once for each. Every 60 HP it loses, one of them lies down.`,
  },
  {
    id: 'a4_aldric', name: 'Aldric\'s Will', kind: 'buff', icon: 'heart',
    desc: (n) => n <= 1
      ? 'The old king fights the Crown. On his next turn the corpse resists and does nothing.'
      : `The old king fights the Crown. In ${n} turns the corpse resists and does nothing.`,
    turnEnd(g, o, n) { if (n > 1) g.addStatus(o, 'a4_aldric', -1); },
  },
  {
    id: 'a4_stilled', name: 'Held Hour', kind: 'debuff', icon: 'chain',
    desc: (n) => n >= 2
      ? 'The hour is held. At the end of your next turn your hand is Retained; the turn after, you draw 2 fewer cards.'
      : 'At the end of this turn your hand is Retained. Next turn, draw 2 fewer cards.',
    retainAll: (g, o, n) => (n === 1 ? 1 : 0),
    turnStart(g, o) { g.addStatus(o, 'a4_stilled', -1); },
    turnEnd(g, o, n) { if (n === 1) g.addStatus(o, 'dread', 2); },
  },
  {
    id: 'a4_hour_taken', name: 'Hour Taken', kind: 'debuff', icon: 'crown',
    desc: (n) => `Lose ${n} Energy at the start of your next turn.`,
    turnStart(g, o, n) { g.gainEnergy(-n); g.removeStatus(o, 'a4_hour_taken'); },
  },
]);

// ------------------------------------------------------------------ shared logic
// Twin Heralds: when one falls, the other turns to raise it.
function heraldFalls(g, e) {
  const twin = g.enemies.find((x) => HERALDS.includes(x.id) && x !== e);
  if (!twin) return;
  const list = g.cb.enemies;
  twin.data.revive = { id: e.id, maxHp: e.maxHp, front: list.indexOf(e) < list.indexOf(twin) };
  toast(g, `${twin.name} lifts its horn to sound the Return.`);
  g.rollIntent(twin);
}
const heraldReturn = {
  name: 'Sound the Return', intent: 'summon',
  fx(g, e) {
    const r = e.data.revive;
    e.data.revive = null;
    if (!r) return;
    const n = g.spawn(r.id, { hp: Math.ceil(r.maxHp / 2), maxHp: r.maxHp, front: r.front });
    if (n) g.emit('phase', { e: n, text: `${n.name} rises to answer the call.` });
  },
};

// Choir: keep the Hymn count equal to living Choristers.
function choirSync(g) {
  const c = living(g, 'choir_immaculate')[0];
  if (c) setStatus(g, c, 'a3_hymn', living(g, 'choir_singer').length);
}

// Thousand-Faced: put on a face (removing the others).
function wearFace(g, e, face) {
  for (const f of FACES) if (f !== face && e.st[f]) g.removeStatus(e, f);
  if (!e.st[face]) g.addStatus(e, face, 1);
}
const faceOf = (e) => FACES.find((f) => e.st[f]);

// Hollow Crown moves (phase 2). "Again" repeats the previous move exactly.
const prevMove = (e) => e.hist[e.hist.length - 1];
const CROWN_MOVES = {
  hold: {
    name: 'Hold the Hour', intent: 'strongdebuff',
    fx(g, e) { if (!g.player.st.a4_stilled) debuff(g, e, 'a4_stilled', 2); block(g, e, 10); },
  },
  take: {
    name: 'Take the Hour', intent: 'strongdebuff',
    fx(g, e) { debuff(g, e, 'a4_hour_taken', 1); block(g, e, 14); },
  },
  crownfall: { name: 'Crownfall', intent: 'atk', dmg: 26 },
  hunger: { name: 'Hunger of the Socket', intent: 'atkdebuff', dmg: 7, times: 3, fx(g, e) { debuff(g, e, 'frail', 1); } },
};
const againOf = (key) => ({
  name: 'Again', intent: key,
  dmg: (g, e) => { const m = CROWN_MOVES[prevMove(e)]; return m && m.dmg != null ? num(m.dmg, g, e) : null; },
  times: (g, e) => { const m = CROWN_MOVES[prevMove(e)]; return m ? num(m.times, g, e) || 1 : 1; },
  async fx(g, e) {
    const m = CROWN_MOVES[prevMove(e)];
    if (m && m.fx) await m.fx(g, e);
    buff(g, e, 'might', 2);
    toast(g, '"Again."');
  },
});
const crownMoves = {
  ...CROWN_MOVES,
  again_atk: againOf('atk'),
  again_atkdebuff: againOf('atkdebuff'),
  again_debuff: againOf('strongdebuff'),
};

// ------------------------------------------------------------------ enemies
defineEnemies([
  // ================================================================ ACT 3 normals
  {
    id: 'crown_zealot', name: 'Crown Zealot', kind: 'normal', act: 3, hp: [42, 46], sprite: 'en_crown_zealot',
    desc: 'Branded with the circlet\'s shape. They pray to the empty socket, and the socket is listening.',
    init(g, e) { g.addStatus(e, 'a3_martyrdom', 1, { silent: true }); },
    moves: {
      scourge: { name: 'Scourge', intent: 'atk', dmg: 5, times: 2 },
      flagellate: { name: 'Flagellate', intent: 'buff', fx(g, e) { g.loseHp(e, 4, { type: 'hploss' }); buff(g, e, 'might', 3); } },
      fury: { name: 'Crown-Fury', intent: 'atk', dmg: 11 },
      martyr: {
        name: 'Martyrdom', intent: 'atk', dmg: 20,
        fx(g, e) { g.emit('phase', { e, text: 'The Zealot bursts into ash and gold.' }); g.loseHp(e, e.hp, { type: 'hploss' }); },
      },
    },
    ai(g, e) {
      if (e.data.martyr) return 'martyr';
      if (e.turns === 0) return g.aiPick(e, { flagellate: 1, scourge: 1 });
      return g.aiPick(e, { scourge: 40, fury: 35, flagellate: 25 }, { scourge: 2, fury: 1, flagellate: 1 });
    },
    on: {
      hpLost(g, e) {
        if (!e.data.martyr && e.hp > 0 && e.hp <= e.maxHp / 2) {
          e.data.martyr = true;
          g.removeStatus(e, 'a3_martyrdom');
          toast(g, 'The Zealot begins to pray aloud, and to glow.');
          g.rollIntent(e);
        }
      },
    },
  },
  {
    id: 'gilded_sentinel', name: 'Gilded Sentinel', kind: 'normal', act: 3, hp: [46, 52], sprite: 'en_gilded_sentinel',
    desc: 'The Royal Guard swore to stand until relieved. No one ever came to relieve them.',
    init(g, e) { seen(g, e); g.addStatus(e, 'barricade', 1, { silent: true }); block(g, e, 10); },
    moves: {
      wall: { name: 'Lock Shields', intent: 'def', fx(g, e) { block(g, e, 11); for (const a of allies(g, e)) block(g, a, 5); } },
      halberd: { name: 'Halberd', intent: 'atk', dmg: 12 },
      bash: {
        name: 'Shield Bash', intent: 'atk', dmg: (g, e) => 6 + Math.floor(e.block / 2),
        fx(g, e) { e.block = Math.max(0, e.block - Math.ceil(e.block / 2)); },
      },
    },
    ai(g, e) {
      if (e.block >= 16) return g.aiPick(e, { bash: 60, halberd: 40 }, { bash: 1, halberd: 1 });
      if (e.block < 8) return g.aiPick(e, { wall: 60, halberd: 40 }, { wall: 1, halberd: 1 });
      return g.aiPick(e, { wall: 35, halberd: 40, bash: 25 }, { wall: 1, halberd: 1, bash: 1 });
    },
  },
  {
    id: 'court_phantom', name: 'Court Phantom', kind: 'normal', act: 3, hp: [30, 34], sprite: 'en_court_phantom',
    desc: 'A courtier still waiting to be announced. The ball ended ninety years ago.',
    init(g, e) { e.data.off = int(g.crng, 0, 1); },
    moves: {
      fade: { name: 'Fade', intent: 'buff', fx(g, e) { buff(g, e, 'phantasm', 2); } },
      slander: { name: 'Whispered Slander', intent: 'debuff', fx(g, e) { debuff(g, e, 'weak', 1); debuff(g, e, 'dread', 1); } },
      courtesy: { name: 'Cold Courtesy', intent: 'atk', dmg: 10 },
      waltz: { name: 'Dead Waltz', intent: 'atk', dmg: 4, times: 3 },
    },
    ai(g, e) {
      if ((e.turns + e.data.off) % 2 === 1 && !g.lastMove(e, 'fade')) return 'fade';
      return g.aiPick(e, { courtesy: 40, waltz: 35, slander: 25 }, { slander: 1, courtesy: 1, waltz: 1 });
    },
  },
  {
    id: 'plague_doctor', name: 'Plague Doctor', kind: 'normal', act: 3, hp: [40, 44], sprite: 'en_plague_doctor',
    desc: 'The beak is stuffed with rue and cloves. It does not help. It was never meant to help you.',
    moves: {
      miasma: { name: 'Miasma', intent: 'debuff', fx(g, e) { debuff(g, e, 'rot', 4); } },
      lancet: { name: 'Lancet', intent: 'atkdebuff', dmg: 7, fx(g, e) { debuff(g, e, 'rot', 2); } },
      cane: { name: 'Beaked Cane', intent: 'atk', dmg: 10 },
      leech: {
        name: 'Leeching', intent: 'heal',
        fx(g, e) {
          const pool = allies(g, e).length ? allies(g, e) : [e];
          const t = pool.reduce((m, x) => (x.maxHp - x.hp > m.maxHp - m.hp ? x : m), pool[0]);
          g.heal(t, 14);
        },
      },
    },
    ai(g, e) {
      if (e.turns === 0) return 'miasma';
      const hurt = allies(g, e).some((a) => a.maxHp - a.hp >= 12);
      if (hurt && !g.lastMove(e, 'leech') && rnd(g.crng) < 0.7) return 'leech';
      return g.aiPick(e, { lancet: 40, cane: 35, miasma: 25 }, { miasma: 1, lancet: 1, cane: 2 });
    },
  },
  {
    id: 'regents_inquisitor', name: 'Regent\'s Inquisitor', kind: 'normal', act: 3, hp: [50, 54], sprite: 'en_regents_inquisitor',
    desc: 'Lord Crane\'s ledger-men. Everything you carry is contraband, and everything is taxed.',
    init(g, e) { e.data.seized = []; },
    moves: {
      confiscate: {
        name: 'Confiscate', intent: 'strongdebuff',
        fx(g, e) {
          const cb = g.cb;
          const rank = { rare: 4, uncommon: 3, common: 2, starter: 1 };
          let pool = cb.draw.filter((c) => !['status', 'curse'].includes(g.cardDef(c).type));
          if (!pool.length) pool = cb.discard.filter((c) => !['status', 'curse'].includes(g.cardDef(c).type));
          if (!pool.length) return;
          const best = Math.max(...pool.map((c) => (rank[g.cardDef(c).rarity] || 1) + (c.up ? 0.5 : 0)));
          const top = pool.filter((c) => (rank[g.cardDef(c).rarity] || 1) + (c.up ? 0.5 : 0) === best);
          const card = pick(g.crng, top);
          g.removeFromPiles(card);
          e.data.seized.push(card);
          setStatus(g, e, 'a3_confiscated', e.data.seized.length);
          toast(g, `The Inquisitor confiscates ${g.cardDef(card).name}.`);
        },
      },
      interrogate: { name: 'Interrogate', intent: 'atkdebuff', dmg: 6, times: 2, fx(g, e) { debuff(g, e, 'weak', 1); } },
      thumbscrew: { name: 'Thumbscrew', intent: 'atkdebuff', dmg: 10, fx(g, e) { debuff(g, e, 'frail', 1); } },
    },
    ai(g, e) {
      if (e.turns === 0) return 'confiscate';
      const w = { interrogate: 45, thumbscrew: 40 };
      if (e.data.seized.length < 2 && sinceLast(e, 'confiscate') >= 2) w.confiscate = 30;
      return g.aiPick(e, w, { interrogate: 1, thumbscrew: 1, confiscate: 1 });
    },
    on: {
      death(g, e) {
        const cb = g.cb;
        for (const c of e.data.seized || []) {
          if (cb.hand.length < 10) { cb.hand.push(c); g.emit('addCard', { card: c, where: 'hand' }); } else { cb.discard.push(c); g.emit('addCard', { card: c, where: 'discard' }); }
        }
        if ((e.data.seized || []).length) toast(g, 'Your confiscated cards are returned.');
        e.data.seized = [];
      },
    },
  },
  {
    id: 'chimney_wraith', name: 'Chimney Wraith', kind: 'normal', act: 3, hp: [24, 28], sprite: 'en_chimney_wraith',
    desc: 'Every hearth in Ashgrave burns the same day\'s fire. The smoke has had a century to learn to want things.',
    moves: {
      smother: { name: 'Smother', intent: 'atkdebuff', dmg: 6, fx(g) { g.addCard('ash', 'discard'); } },
      billow: { name: 'Billow', intent: 'atk', dmg: 3, times: 3 },
      choke: { name: 'Soot-Choke', intent: 'debuff', fx(g, e) { debuff(g, e, 'weak', 1); g.addCard('daze', 'draw'); } },
    },
    ai(g, e) { return g.aiPick(e, { smother: 35, billow: 40, choke: 25 }, { smother: 1, choke: 1, billow: 2 }); },
  },
  {
    id: 'ash_golem', name: 'Ash Golem', kind: 'normal', act: 3, hp: [66, 72], sprite: 'en_ash_golem',
    desc: 'Packed from the ash of Ashfall itself, and from the masonry it buried. It still smoulders at the heart.',
    immune: ['burning'],
    init(g, e) { e.data.skin = 3; g.addStatus(e, 'a3_cinder_skin', 3, { silent: true }); },
    moves: {
      crush: { name: 'Crush', intent: 'atk', dmg: 16 },
      slag: { name: 'Slag Fist', intent: 'atkdebuff', dmg: 9, fx(g) { g.addCard('ash', 'draw'); } },
      settle: { name: 'Settle', intent: 'defbuff', fx(g, e) { block(g, e, 12); buff(g, e, 'might', 2); } },
    },
    ai(g, e) {
      if (e.turns === 0) return 'slag';
      return g.aiPick(e, { crush: 40, slag: 35, settle: 25 }, { crush: 1, settle: 1, slag: 1 });
    },
  },
  {
    id: 'lamplighter', name: 'Lamplighter', kind: 'normal', act: 3, hp: [34, 38], sprite: 'en_lamplighter',
    desc: 'Lights the lamps of Ashgrave at dusk, every dusk, though it has been dusk for months.',
    moves: {
      kindle: { name: 'Kindle', intent: 'debuff', fx(g, e) { debuff(g, e, 'burning', 2); } },
      pole: { name: 'Lamp-Pole', intent: 'atk', dmg: 10 },
      flare: { name: 'Flare', intent: 'atkdebuff', dmg: 6, fx(g, e) { debuff(g, e, 'burning', 1); } },
      light: { name: 'Light the Way', intent: 'buff', fx(g, e) { for (const a of g.enemies) buff(g, a, 'might', 2); } },
    },
    ai(g, e) {
      if (e.turns === 0) return 'kindle';
      const w = { pole: 40, flare: 30, light: 15 };
      if (g.st(g.player, 'burning') < 4) w.kindle = 15;
      return g.aiPick(e, w, { kindle: 1, light: 1, flare: 1, pole: 2 });
    },
  },
  {
    id: 'gargoyle', name: 'Gargoyle', kind: 'normal', act: 3, hp: [40, 44], sprite: 'en_gargoyle',
    desc: 'Carved to keep evil off the cathedral roof. It has revised its opinion of what evil is.',
    init(g, e) { if (rnd(g.crng) < 0.5) g.addStatus(e, 'stasis_guard', 5, { silent: true }); },
    moves: {
      perch: { name: 'Turn to Stone', intent: 'defbuff', fx(g, e) { if (!e.st.stasis_guard) g.addStatus(e, 'stasis_guard', 5); block(g, e, 8); } },
      dive: { name: 'Dive', intent: 'atk', dmg: 14, fx(g, e) { g.removeStatus(e, 'stasis_guard'); } },
      rake: { name: 'Rake', intent: 'atk', dmg: 5, times: 2 },
    },
    ai(g, e) {
      if (e.st.stasis_guard) return 'dive';
      if (e.turns === 0 || g.lastMove(e, 'dive')) return 'rake';
      return 'perch';
    },
  },
  {
    id: 'gilt_penitent', name: 'Gilt Penitent', kind: 'normal', act: 3, hp: [26, 30], sprite: 'en_gilt_penitent',
    desc: 'They paid the Saint in gold leaf, one layer for every sin. Some of them can no longer bend.',
    init(g, e) { seen(g, e); asMinionOf(g, e, 'gilded_saint'); },
    moves: {
      flail: { name: 'Flail', intent: 'atk', dmg: 7 },
      kneel: { name: 'Kneel', intent: 'def', fx(g, e) { const s = living(g, 'gilded_saint')[0]; if (s) block(g, s, 9); block(g, e, 4); } },
      lash: { name: 'Gilded Lash', intent: 'buff', fx(g, e) { g.loseHp(e, 2, { type: 'hploss' }); buff(g, e, 'might', 2); } },
    },
    ai(g, e) { return g.aiPick(e, { flail: 50, kneel: 30, lash: 20 }, { kneel: 1, lash: 1, flail: 2 }); },
  },
  {
    id: 'choir_singer', name: 'Chorister', kind: 'normal', act: 3, hp: [40, 44], sprite: 'en_choir_singer',
    desc: 'One voice of forty, not quite separate yet. It sings with its eyes sewn shut.',
    init(g, e) { seen(g, e); asMinionOf(g, e, 'choir_immaculate'); choirSync(g); },
    moves: {
      note: { name: 'Shrill Note', intent: 'atk', dmg: 6 },
      harmony: { name: 'Harmony', intent: 'def', fx(g, e) { const c = living(g, 'choir_immaculate')[0]; if (c) block(g, c, 8); block(g, e, 4); } },
      descant: { name: 'Descant', intent: 'buff', fx(g, e) { const c = living(g, 'choir_immaculate')[0]; if (c) buff(g, c, 'a3_verse', 1); } },
    },
    ai(g, e) { return g.aiPick(e, { note: 50, harmony: 25, descant: 25 }, { note: 2, harmony: 1, descant: 1 }); },
  },

  // ================================================================ ACT 3 elites
  {
    id: 'kings_executioner', name: 'The King\'s Executioner', kind: 'elite', act: 3, hp: [236, 244], sprite: 'en_kings_executioner',
    desc: 'Sixty years of the Long King\'s justice. Not one of his heads ever stopped talking.',
    moves: {
      whet: { name: 'Whetstone', intent: 'buff', fx(g, e) { buff(g, e, 'might', 3); } },
      condemn: {
        name: 'Measure the Neck', intent: 'debuff',
        fx(g, e) { g.addStatus(g.player, 'a3_condemned', 2); e.data.countdown = 2; },
      },
      blow: {
        name: 'Headsman\'s Blow', intent: 'atk', dmg: (g, e) => 34 + 6 * (e.data.blows || 0),
        fx(g, e) { g.removeStatus(g.player, 'a3_condemned'); e.data.countdown = 0; e.data.blows = (e.data.blows || 0) + 1; },
      },
      hack: { name: 'Hack', intent: 'atk', dmg: 8, times: 2, fx(g, e) { if (e.data.countdown) { e.data.countdown--; g.addStatus(g.player, 'a3_condemned', -1); } } },
      drag: {
        name: 'Drag to the Block', intent: 'atkdebuff', dmg: 9,
        fx(g, e) { debuff(g, e, 'frail', 1); if (e.data.countdown) { e.data.countdown--; g.addStatus(g.player, 'a3_condemned', -1); } },
      },
    },
    ai(g, e) {
      if (e.turns === 0) return 'whet';
      if (e.data.countdown === 1) return 'blow';
      if (e.data.countdown > 1) return g.lastMove(e, 'hack') ? 'drag' : 'hack';
      if (g.lastMove(e, 'blow')) return g.aiPick(e, { hack: 50, drag: 50 });
      return 'condemn';
    },
  },
  {
    id: 'herald_morning', name: 'Herald of Morning', kind: 'elite', act: 3, hp: [108, 114], sprite: 'en_herald_morning',
    desc: 'It announced the dawn every day for ninety-one years. The same dawn, every day.',
    init(g, e) { seen(g, e); g.addStatus(e, 'a3_twin_bond', 1, { silent: true }); },
    moves: {
      fanfare: { name: 'Fanfare', intent: 'buff', fx(g, e) { for (const h of g.enemies) if (HERALDS.includes(h.id)) buff(g, h, 'might', 2); } },
      note: { name: 'Brazen Note', intent: 'atk', dmg: 12 },
      clarion: { name: 'Clarion', intent: 'atk', dmg: 4, times: 3 },
      ret: heraldReturn,
    },
    ai(g, e) {
      if (e.data.revive) return 'ret';
      if (e.turns === 0) return 'fanfare';
      return g.aiPick(e, { note: 40, clarion: 35, fanfare: 25 }, { fanfare: 1, note: 2, clarion: 1 });
    },
    on: { death: heraldFalls },
  },
  {
    id: 'herald_mourning', name: 'Herald of Mourning', kind: 'elite', act: 3, hp: [108, 114], sprite: 'en_herald_mourning',
    desc: 'It tolled for the dead every evening for ninety-one years. None of them ever came.',
    init(g, e) { seen(g, e); g.addStatus(e, 'a3_twin_bond', 1, { silent: true }); },
    moves: {
      dirge: { name: 'Dirge', intent: 'debuff', fx(g, e) { debuff(g, e, 'weak', 1); debuff(g, e, 'frail', 1); } },
      toll: { name: 'Funeral Toll', intent: 'atk', dmg: 7, times: 2 },
      shroud: { name: 'Shroud', intent: 'def', fx(g, e) { for (const h of g.enemies) if (HERALDS.includes(h.id)) block(g, h, 10); } },
      ret: heraldReturn,
    },
    ai(g, e) {
      if (e.data.revive) return 'ret';
      if (e.turns === 0) return 'dirge';
      return g.aiPick(e, { toll: 45, dirge: 25, shroud: 30 }, { dirge: 1, shroud: 1, toll: 2 });
    },
    on: { death: heraldFalls },
  },
  {
    id: 'gilded_saint', name: 'The Gilded Saint', kind: 'elite', act: 3, hp: [176, 184], sprite: 'en_gilded_saint', leader: true,
    desc: 'A reliquary in the shape of a woman. The woman is still inside.',
    init(g, e) { g.addStatus(e, 'a3_saints_grief', 2, { silent: true }); },
    moves: {
      bless: {
        name: 'Benediction', intent: 'buff',
        fx(g, e) { for (const a of g.enemies) { buff(g, a, 'ward', a === e ? 2 : 1); block(g, a, 8); } },
      },
      anoint: { name: 'Anoint', intent: 'buff', fx(g, e) { for (const a of g.enemies) buff(g, a, 'might', 2); } },
      halo: { name: 'Searing Halo', intent: 'atkdebuff', dmg: 13, fx(g, e) { debuff(g, e, 'weak', 1); } },
      radiance: { name: 'Radiance', intent: 'atk', dmg: 6, times: 2 },
      canonize: {
        name: 'Canonize', intent: 'summon',
        fx(g, e) { e.data.lastCanon = e.turns; if (g.spawn('gilt_penitent', { minion: true, front: true })) toast(g, 'Another penitent kneels and is gilded.'); },
      },
    },
    ai(g, e) {
      if (e.turns === 0) return 'bless';
      const pens = living(g, 'gilt_penitent').length;
      if (pens < 2 && e.turns - (e.data.lastCanon ?? -9) >= 3 && !g.lastMove(e, 'canonize')) return 'canonize';
      return g.aiPick(e, { halo: 35, radiance: 25, anoint: 20, bless: 20 }, { halo: 2, radiance: 1, anoint: 1, bless: 1 });
    },
  },

  // ================================================================ ACT 3 bosses
  {
    id: 'severin_crane', name: 'Lord Severin Crane', kind: 'boss', act: 3, hp: 480, sprite: 'en_severin_crane', leader: true,
    desc: 'The Regent. He has read every loop like a ledger, and balanced each one in his own favour.',
    init(g, e) { g.addStatus(e, 'a3_late_hour', 3, { silent: true }); },
    moves: {
      cane: { name: 'Ebony Cane', intent: 'atk', dmg: 15 },
      rapier: { name: 'Courtier\'s Blade', intent: 'atk', dmg: 5, times: 3 },
      dismiss: { name: 'Dismissal', intent: 'atkdebuff', dmg: 10, fx(g, e) { debuff(g, e, 'dread', 2); } },
      decree: { name: 'Decree of Regency', intent: 'strongdebuff', fx(g, e) { debuff(g, e, 'weak', 2); debuff(g, e, 'frail', 2); } },
      guard: {
        name: 'Call the Guard', intent: 'summon',
        fx(g, e) {
          e.data.lastGuard = e.turns;
          for (let i = living(g, 'gilded_sentinel').length; i < 2; i++) g.spawn('gilded_sentinel', { minion: true, hp: 24 });
        },
      },
      mark: {
        name: 'Mark the Hour', intent: 'buff',
        fx(g, e) {
          e.data.marked = true; e.data.markHp = e.hp; e.data.markFresh = true;
          g.addStatus(e, 'a3_hour_mark', 2);
          g.emit('phase', { e, text: `Crane opens his pocket-watch. "Let us remember this hour," he says. "${e.hp}."` });
        },
      },
      rewrite: {
        name: 'Rewrite the Hour', intent: 'heal',
        fx(g, e) {
          if (e.data.markHp > e.hp) g.heal(e, e.data.markHp - e.hp);
          cleanse(g, e);
          g.removeStatus(e, 'a3_hour_mark');
          g.emit('phase', { e, text: 'The watch-hands spin backward. "No," says Crane. "I preferred it as it was."' });
        },
      },
    },
    ai(g, e) {
      if (g.st(e, 'a3_hour_mark') === 1 && !e.data.markFresh) return 'rewrite';
      if (e.turns === 0) return 'guard';
      if (!e.data.marked && e.hp <= e.maxHp * 0.6) return 'mark';
      const w = { cane: 30, rapier: 25, dismiss: 20, decree: 15 };
      if (living(g, 'gilded_sentinel').length < 2 && e.turns - (e.data.lastGuard ?? 0) >= 4) w.guard = 35;
      return g.aiPick(e, w, { cane: 1, rapier: 1, dismiss: 1, decree: 1, guard: 1 });
    },
  },
  {
    id: 'choir_immaculate', name: 'The Choir Immaculate', kind: 'boss', act: 3, hp: 380, sprite: 'en_choir_immaculate', leader: true,
    desc: 'Forty court singers who would not stop for Ashfall. They have since grown into one throat.',
    init(g, e) { choirSync(g); },
    moves: {
      psalm: { name: 'Psalm of Ash', intent: 'atk', dmg: 9 },
      antiphon: { name: 'Antiphon', intent: 'atk', dmg: 4, times: 2 },
      hush: { name: 'Hush', intent: 'debuff', fx(g, e) { debuff(g, e, 'weak', 2); g.addCard('daze', 'draw'); g.addCard('daze', 'draw'); } },
      breath: {
        name: 'Draw Breath', intent: 'summon',
        fx(g, e) { e.data.lastBreath = e.turns; block(g, e, 12); if (g.spawn('choir_singer', { minion: true, front: true })) choirSync(g); },
      },
      gloria: {
        name: 'Gloria', intent: 'atk', dmg: 10, times: 3,
        fx(g, e) { g.removeStatus(e, 'a3_verse'); toast(g, 'The Gloria ends. The Choir draws breath to begin again.'); },
      },
    },
    ai(g, e) {
      if (g.st(e, 'a3_verse') >= GLORIA) return 'gloria';
      if (living(g, 'choir_singer').length < 3 && e.turns - (e.data.lastBreath ?? -1) >= 3 && !g.lastMove(e, 'breath')) return 'breath';
      return g.aiPick(e, { psalm: 40, antiphon: 35, hush: 25 }, { psalm: 2, antiphon: 1, hush: 1 });
    },
    on: {
      enemyDied(g, e, dead) {
        if (dead.id !== 'choir_singer') return;
        choirSync(g);
        const v = g.st(e, 'a3_verse');
        if (v > 0) g.addStatus(e, 'a3_verse', -Math.ceil(v / 2));
        if (e.move === 'gloria' && g.st(e, 'a3_verse') < GLORIA) {
          g.emit('phase', { e, text: 'A voice falls silent. The Gloria breaks apart into coughing.' });
          g.rollIntent(e);
        } else if (v > 0) toast(g, 'A voice falls silent. The hymn falters.');
      },
    },
  },

  // --- The Crowned Rivals
  {
    id: 'rival_knight', name: 'Aldous, the Iron King', kind: 'boss', act: 3, hp: 500, sprite: 'en_rival_knight',
    desc: 'In another loop he obeyed one order too many, and put on the Crown so no one else could.',
    moves: {
      blade: { name: 'Crownsworn Blade', intent: 'atk', dmg: 16 },
      wall: {
        name: 'Oath of the Wall', intent: 'defbuff',
        fx(g, e) { block(g, e, 22); g.addStatus(e, 'barricade', 1); g.addStatus(e, 'a3_oath_wall', 1); },
      },
      vengeance: { name: 'Oath of Vengeance', intent: 'atkbuff', dmg: 10, fx(g, e) { setStatus(g, e, 'a3_oath_vengeance', 26); } },
      sunder: { name: 'Sunder', intent: 'atkdebuff', dmg: 8, times: 2, fx(g, e) { debuff(g, e, 'frail', 2); } },
      kneel: { name: 'Kneel to Your King', intent: 'strongdebuff', fx(g, e) { debuff(g, e, 'weak', 2); debuff(g, e, 'exposed', 1); } },
    },
    ai(g, e) {
      if (e.turns % 3 === 0) return (e.turns / 3) % 2 === 0 ? 'wall' : 'vengeance';
      return g.aiPick(e, { blade: 45, sunder: 35, kneel: 20 }, { blade: 1, sunder: 1, kneel: 1 });
    },
  },
  {
    id: 'rival_witch', name: 'Isolde, the Blight Queen', kind: 'boss', act: 3, hp: 480, sprite: 'en_rival_witch',
    desc: 'She cured the Blight, in another loop. Nothing in her kingdom has rotted since. Nothing in it has grown.',
    init(g, e) { g.addStatus(e, 'a3_crown_of_rot', 1, { silent: true }); e.data.withers = 0; },
    moves: {
      bloom: { name: 'Blightbloom', intent: 'debuff', fx(g, e) { debuff(g, e, 'rot', 6); } },
      lash: { name: 'Thorned Lash', intent: 'atkdebuff', dmg: 10, fx(g, e) { debuff(g, e, 'rot', 2); } },
      reap: { name: 'Reap', intent: 'atk', dmg: (g) => Math.min(30, 8 + 2 * g.st(g.player, 'rot')) },
      brew: { name: 'Black Brew', intent: 'defbuff', fx(g, e) { block(g, e, 10); buff(g, e, 'a3_black_draught', 1); } },
      drink: {
        name: 'Drink the Dregs', intent: 'buff',
        fx(g, e) {
          const n = g.st(e, 'a3_black_draught');
          g.removeStatus(e, 'a3_black_draught');
          g.heal(e, 6 * n);
          buff(g, e, 'might', 2 * n);
        },
      },
      wither: { name: 'Wither', intent: 'strongdebuff', fx(g, e) { e.data.withers++; debuff(g, e, 'might', -1); debuff(g, e, 'weak', 2); } },
    },
    ai(g, e) {
      if (e.turns === 0) return 'bloom';
      const br = g.st(e, 'a3_black_draught');
      if (br >= 3 || (br >= 2 && rnd(g.crng) < 0.4)) return 'drink';
      if (g.st(g.player, 'rot') < 3 && sinceLast(e, 'bloom') >= 2 && rnd(g.crng) < 0.6) return 'bloom';
      const w = { lash: 30, reap: 30, brew: 25 };
      if (e.data.withers < 2) w.wither = 15;
      return g.aiPick(e, w, { wither: 1, brew: 1, reap: 1, lash: 1 });
    },
  },
  {
    id: 'rival_wren', name: 'Wren, the Thousand-Faced', kind: 'boss', act: 3, hp: 460, sprite: 'en_rival_wren',
    desc: 'In another loop Wren chose the Crown, and the Crown gave them every face but their own.',
    init(g, e) { e.data.bigHit = 0; },
    moves: {
      storm: { name: 'Knife Storm', intent: 'atk', dmg: 4, times: 4, fx(g, e) { e.data.bigHit = 0; } },
      flay: { name: 'Flay', intent: 'atkdebuff', dmg: 12, fx(g, e) { g.addCard('wound', 'discard'); e.data.bigHit = 0; } },
      wings: { name: 'Moth Wings', intent: 'def', fx(g, e) { block(g, e, 16); e.data.bigHit = 0; } },
      dust: { name: 'Moth Dust', intent: 'debuff', fx(g, e) { debuff(g, e, 'weak', 2); debuff(g, e, 'frail', 2); e.data.bigHit = 0; } },
      borrowed: {
        name: 'Borrowed Face', intent: 'atk', dmg: (g, e) => Math.max(6, Math.min(40, e.data.bigHit || 0)),
        fx(g, e) { e.data.bigHit = 0; },
      },
    },
    ai(g, e) {
      let face;
      if (e.turns === 0) face = 'face_moth';
      else face = pick(g.crng, FACES.filter((f) => f !== faceOf(e)));
      wearFace(g, e, face);
      if (face === 'face_wolf') return g.aiPick(e, { storm: 55, flay: 45 });
      if (face === 'face_moth') return g.aiPick(e, { wings: 50, dust: 50 }, { dust: 1 });
      return 'borrowed';
    },
    on: {
      enemyAttacked(g, e, tgt, unblocked, amount) { if (tgt === e) e.data.bigHit = Math.max(e.data.bigHit || 0, amount); },
    },
  },
  {
    id: 'rival_cantor', name: 'Cael, the Requiem King', kind: 'boss', act: 3, hp: 460, sprite: 'en_rival_cantor', leader: true,
    desc: 'A dead man crowned. He keeps the kingdom\'s dead the way a miser keeps coin.',
    init(g, e) { e.data.k = 0; },
    moves: {
      channel: {
        name: 'Channel the Kept', intent: 'summon',
        fx(g, e) {
          const n = e.turns === 0 ? 2 : 1;
          for (let i = 0; i < n; i++) {
            if (KEPT.reduce((t, id) => t + living(g, id).length, 0) >= 3) break;
            g.spawn(KEPT[e.data.k++ % 3], { minion: true });
          }
        },
      },
      requiem: {
        name: 'Requiem', intent: 'atk', dmg: 7,
        times: (g) => Math.max(1, KEPT.reduce((t, id) => t + living(g, id).length, 0)),
        fx(g, e) {
          for (const s of g.enemies.filter((x) => KEPT.includes(x.id))) {
            if (s.id === 'kept_warden') block(g, e, 12);
            if (s.id === 'kept_banshee') { debuff(g, e, 'weak', 1); debuff(g, e, 'frail', 1); }
            s.dead = true; s.fled = true; g.emit('flee', { e: s });
          }
          toast(g, 'The kept dead are spent, all at once.');
        },
      },
      censer: { name: 'Censer', intent: 'atk', dmg: 14 },
      bleed: { name: 'Bleed for the Dead', intent: 'buff', fx(g, e) { g.loseHp(e, 8, { type: 'hploss' }); buff(g, e, 'might', 3); } },
      rites: { name: 'Last Rites', intent: 'strongdebuff', fx(g, e) { debuff(g, e, 'weak', 2); debuff(g, e, 'frail', 2); } },
    },
    ai(g, e) {
      if (e.turns === 0) return 'channel';
      const k = KEPT.reduce((t, id) => t + living(g, id).length, 0);
      if (k >= 3 && !g.lastMove(e, 'requiem')) return 'requiem';
      const w = { censer: 35, bleed: 15, rites: 20 };
      if (k < 3) w.channel = 35;
      if (k >= 2) w.requiem = 15;
      return g.aiPick(e, w, { channel: 1, bleed: 1, rites: 1, censer: 2, requiem: 1 });
    },
  },
  {
    id: 'kept_wisp', name: 'Kept Wisp', kind: 'normal', act: 3, hp: [12, 14], sprite: 'en_kept_wisp',
    desc: 'A soul the Requiem King would not let go. It burns the colour of a candle seen through tears.',
    init(g, e) { seen(g, e); asMinionOf(g, e, 'rival_cantor'); },
    moves: { flicker: { name: 'Flicker', intent: 'atk', dmg: 5 } },
    ai() { return 'flicker'; },
  },
  {
    id: 'kept_warden', name: 'Kept Warden', kind: 'normal', act: 3, hp: [16, 18], sprite: 'en_kept_warden',
    desc: 'A dead soldier still guarding his king. He has forgotten which king.',
    init(g, e) { seen(g, e); asMinionOf(g, e, 'rival_cantor'); },
    moves: { shelter: { name: 'Shelter', intent: 'def', fx(g, e) { const c = living(g, 'rival_cantor')[0]; if (c) block(g, c, 7); } } },
    ai() { return 'shelter'; },
  },
  {
    id: 'kept_banshee', name: 'Kept Banshee', kind: 'normal', act: 3, hp: [12, 14], sprite: 'en_kept_banshee',
    desc: 'She was a mourner once. Now she is the mourning.',
    init(g, e) { seen(g, e); asMinionOf(g, e, 'rival_cantor'); },
    moves: {
      keen: { name: 'Keen', intent: 'debuff', fx(g, e) { debuff(g, e, 'frail', 1); } },
      wail: { name: 'Wail', intent: 'atk', dmg: 4 },
    },
    ai(g, e) { return g.lastMove(e, 'keen') ? 'wail' : 'keen'; },
  },

  // ================================================================ ACT 4
  {
    id: 'the_unspent', name: 'The Unspent', kind: 'elite', act: 4, hp: [296, 304], sprite: 'en_the_unspent',
    desc: 'A century of deaths that were never allowed to happen, heaped beneath the throne. They are so tired.',
    init(g, e) { g.addStatus(e, 'a4_multitude', 5, { silent: true }); e.data.lost = 0; },
    moves: {
      grasp: { name: 'Grasping Hands', intent: 'atk', dmg: 4, times: (g, e) => Math.max(1, g.st(e, 'a4_multitude')) },
      heave: { name: 'Heave', intent: 'atk', dmg: 24 },
      swell: {
        name: 'More Arrive', intent: 'defbuff',
        fx(g, e) { if (g.st(e, 'a4_multitude') < 8) g.addStatus(e, 'a4_multitude', 1); block(g, e, 16); },
      },
      names: {
        name: 'Unmourned Names', intent: 'debuff',
        fx(g, e) { g.addCard(UNMOURNED, 'draw'); g.addCard(UNMOURNED, 'draw'); debuff(g, e, 'weak', 1); },
      },
    },
    ai(g, e) {
      if (e.turns === 0) return 'names';
      const w = { grasp: 40, heave: 25, swell: 15 };
      if (sinceLast(e, 'names') >= 2) w.names = 20;
      return g.aiPick(e, w, { grasp: 2, heave: 1, swell: 1, names: 1 });
    },
    on: {
      hpLost(g, e, n) {
        e.data.lost = (e.data.lost || 0) + n;
        let fell = 0;
        while (e.data.lost >= 60 && g.st(e, 'a4_multitude') > 1) { e.data.lost -= 60; g.addStatus(e, 'a4_multitude', -1); fell++; }
        if (g.st(e, 'a4_multitude') <= 1) e.data.lost = Math.min(e.data.lost, 59);
        if (fell && e.hp > 0) toast(g, fell > 1 ? 'Some of the dead let go, and lie down at last.' : 'One of the dead lets go, and lies down at last.');
      },
    },
  },
  {
    id: 'held_hand', name: 'Held Hand', kind: 'normal', act: 4, hp: [16, 20], sprite: 'en_held_hand',
    desc: 'A hand reaching up through the floor of the Undercroft. It only wants someone to hold it.',
    init(g, e) { seen(g, e); asMinionOf(g, e, 'hollow_king'); },
    moves: {
      clutch: { name: 'Clutch', intent: 'atk', dmg: 6 },
      drag: { name: 'Drag Down', intent: 'debuff', fx(g, e) { debuff(g, e, 'frail', 1); } },
    },
    ai(g, e) { return g.aiPick(e, { clutch: 65, drag: 35 }, { drag: 1 }); },
  },
  {
    id: 'hollow_king', name: 'The Hollow King', kind: 'boss', act: 4, hp: 300, sprite: 'en_hollow_king', leader: true,
    desc: 'King Aldric IV: ninety-one years on the throne, and still sitting. The Crown wears him like a glove.',
    init(g, e) { g.addStatus(e, 'a4_aldric', 4, { silent: true }); },
    moves: {
      scepter: { name: 'Scepter of Iron', intent: 'atk', dmg: 18 },
      reign: { name: 'The Long Reign', intent: 'atk', dmg: 3, times: 6 },
      decree: { name: 'Last Decree', intent: 'strongdebuff', fx(g, e) { debuff(g, e, 'weak', 2); debuff(g, e, 'frail', 2); } },
      held: {
        name: 'Call the Held', intent: 'summon',
        fx(g, e) { for (let i = living(g, 'held_hand').length; i < 2; i++) g.spawn('held_hand', { minion: true }); },
      },
      resist: {
        name: 'Aldric Resists', intent: 'sleep',
        fx(g, e) {
          setStatus(g, e, 'a4_aldric', 5, true);
          g.emit('phase', { e, text: '"Please," the corpse whispers, in an old man\'s voice. "Let me go."' });
        },
      },
    },
    ai(g, e) {
      if (g.st(e, 'a4_aldric') === 1) return 'resist';
      if (e.turns === 0) return 'held';
      const w = { scepter: 35, reign: 30, decree: 20 };
      if (!living(g, 'held_hand').length && !g.lastMove(e, 'held')) w.held = 30;
      return g.aiPick(e, w, { scepter: 1, reign: 1, decree: 1, held: 1 });
    },
    on: {
      death(g, e) {
        const c = g.spawn('hollow_crown', { front: true });
        if (!c) return;
        const text = g.run.hero === 'wren'
          ? 'The corpse falls at last. The Crown lifts free of it and turns toward you, humming. "There you are."'
          : 'The corpse falls at last. The Crown does not.';
        g.emit('phase', { e: c, text });
      },
    },
  },
  {
    id: 'hollow_crown', name: 'The Hollow Crown', kind: 'boss', act: 4, hp: 400, sprite: 'en_hollow_crown',
    desc: 'An iron circlet with an empty socket. It has held the hour for four hundred years, and it is not finished.',
    init(g, e) { seen(g, e); },
    moves: crownMoves,
    ai(g, e) {
      if (e.turns === 0) return 'hold';
      const last = prevMove(e);
      if (e.turns % 3 === 2 && CROWN_MOVES[last] && !(last === 'hold' && g.player.st.a4_stilled)) {
        const it = CROWN_MOVES[last].intent;
        return it === 'atk' ? 'again_atk' : it === 'atkdebuff' ? 'again_atkdebuff' : 'again_debuff';
      }
      const w = { crownfall: 30, hunger: 30, take: 20 };
      if (!g.player.st.a4_stilled) w.hold = 20;
      return g.aiPick(e, w, { crownfall: 1, hunger: 1, take: 1, hold: 1 });
    },
  },
]);

// ------------------------------------------------------------------ encounters
defineEncounters([
  // easy (first three fights of the act)
  { id: 'a3_zealot_pair', act: 3, pool: 'easy', enemies: ['crown_zealot', 'crown_zealot'], name: 'Crown Zealots' },
  { id: 'a3_wraith_flue', act: 3, pool: 'easy', enemies: ['chimney_wraith', 'chimney_wraith', 'chimney_wraith'], name: 'Chimney Wraiths' },
  { id: 'a3_ash_golem', act: 3, pool: 'easy', enemies: ['ash_golem'], name: 'Ash Golem' },
  { id: 'a3_doctors_round', act: 3, pool: 'easy', enemies: ['crown_zealot', 'plague_doctor'], name: 'The Doctor\'s Round' },
  { id: 'a3_lamplighters', act: 3, pool: 'easy', enemies: ['lamplighter', 'lamplighter'], name: 'Lamplighters' },
  // hard
  { id: 'a3_zealot_procession', act: 3, pool: 'hard', enemies: ['crown_zealot', 'crown_zealot', 'crown_zealot'], name: 'Procession of the Crown' },
  { id: 'a3_honor_guard', act: 3, pool: 'hard', enemies: ['gilded_sentinel', 'plague_doctor'], name: 'Honour Guard' },
  { id: 'a3_inquest', act: 3, pool: 'hard', enemies: ['crown_zealot', 'regents_inquisitor'], name: 'The Inquest' },
  { id: 'a3_phantom_court', act: 3, pool: 'hard', enemies: ['court_phantom', 'court_phantom', 'court_phantom'], name: 'The Phantom Court' },
  { id: 'a3_gargoyles', act: 3, pool: 'hard', enemies: ['gargoyle', 'gargoyle'], name: 'Gargoyles' },
  { id: 'a3_lamplit_flue', act: 3, pool: 'hard', enemies: ['lamplighter', 'chimney_wraith', 'chimney_wraith'], name: 'Lamplight and Soot' },
  { id: 'a3_golem_lamp', act: 3, pool: 'hard', enemies: ['ash_golem', 'lamplighter'], name: 'Kindled Golem' },
  { id: 'a3_audience', act: 3, pool: 'hard', enemies: ['court_phantom', 'regents_inquisitor'], name: 'An Audience' },
  { id: 'a3_cathedral_roof', act: 3, pool: 'hard', enemies: ['gargoyle', 'plague_doctor'], name: 'The Cathedral Roof' },
  { id: 'a3_shield_wall', act: 3, pool: 'hard', enemies: ['gilded_sentinel', 'gilded_sentinel'], weight: 0.7, name: 'The Shield Wall' },
  // elites
  { id: 'a3_executioner', act: 3, pool: 'elite', enemies: ['kings_executioner'], name: 'The King\'s Executioner' },
  { id: 'a3_heralds', act: 3, pool: 'elite', enemies: ['herald_morning', 'herald_mourning'], name: 'The Twin Heralds' },
  { id: 'a3_gilded_saint', act: 3, pool: 'elite', enemies: ['gilt_penitent', 'gilded_saint', 'gilt_penitent'], name: 'The Gilded Saint' },
  // bosses
  { id: 'a3_crane', act: 3, pool: 'boss', enemies: ['severin_crane'], name: 'Lord Severin Crane' },
  { id: 'a3_choir', act: 3, pool: 'boss', enemies: ['choir_singer', 'choir_singer', 'choir_singer', 'choir_immaculate'], name: 'The Choir Immaculate' },
  {
    id: 'a3_rival', act: 3, pool: 'boss', name: 'The Crowned Rival',
    enemies: (g, rng) => {
      const list = RIVALS.filter((id) => id !== 'rival_' + g.run.hero);
      return [pick(rng, list.length ? list : RIVALS)];
    },
  },
  // act 4
  { id: 'a4_unspent', act: 4, pool: 'elite', enemies: ['the_unspent'], name: 'The Unspent' },
  { id: 'a4_hollow_king', act: 4, pool: 'boss', enemies: ['hollow_king'], name: 'The Hollow King' },
]);

defineTexts({
  boss_intro: {
    a3_crane: 'Lord Severin Crane closes his ledger and does not rise. "I have watched you die before, heir. I took notes. Shall we begin at the part where you lose?"',
    a3_choir: 'Forty voices, one throat. The hymn has not paused since the night of Ashfall, and it does not mean to pause for you.',
    a3_rival: 'Someone already sits the Regent\'s throne, wearing the Crown — an heir called in some other loop, who answered. "You\'re late," they say, in a voice you almost know.',
    a4_unspent: 'The floor of the Undercroft rises like a tide coming in: a century of the dead, still waiting to be allowed.',
    a4_hollow_king: 'King Aldric sits the throne beneath the throne, ninety-one years dead and still sitting. The Crown turns his head toward you. "Again," it says, with his mouth.',
  },
});
