// ACT 1 — THE ASHEN MARCHES. Grey fens, gibbets, plague villages, bandits,
// wolves and ash-cultists. Ash falls like snow since Ashfall.
//
// Every enemy here is built around one readable "puzzle":
//   Marsh Hound      Pack      — kill the pair together, or the survivor comes harder.
//   Gibbet Crow      Carrion   — kill the crows first or they feast on every corpse.
//   Coughing Dead    Stopped   — it falls at 1 HP and rises again: save a hit to finish it.
//   Ash Cultist      Rite      — a race: it gains Might every turn.
//   Marcher Cutthroat Backstab — +50% damage while you hold no Block.
//   Marcher Archer   Pavise    — ducks, then looses a huge shot: kill or brace.
//   Bog Leech        Bloodsucker — heals for whatever gets through your Block.
//   Grave Robber     Light Fingers — steals gold, flees on turn 4; kill it to get it back.
//   Wight Militiaman Hold the Line — shields its allies; kill it first.
//   Rat Swarm        Plague-Bite — tiny hits that Rot you if unblocked.
// Elites: Sir Rendrick (Choked + rope snaps at half), The Bog Mother (devours her
// brood to heal — kill the leeches she's about to eat), The Ashen Choir (three
// voices that empower each other and grieve into Might).
// Bosses: Bragg the Hound-Lord (hounds + Blood Frenzy), The Hanged Sheriff
// (Warrants + the Noose: +3 damage per card you play that turn), Mother of Rats
// (damage makes rats burst out; rats feed her and Rot you).

import { defineStatuses, defineEnemies, defineEncounters, defineTexts, defineCards } from '../../engine/registry.js';
import { defineSprites, PAL } from '../../gfx/sprite.js';
import { int } from '../../engine/rng.js';

// ------------------------------------------------------------------ helpers
const count = (g, id) => g.enemies.filter((x) => x.id === id).length;
const flee = (g, e) => {
  e.block = 0;
  e.dead = true;
  e.fled = true;
  g.emit('flee', { e });
  g.checkEnd();
};
// Cycle through a move list using a per-enemy counter (survives save/load).
const step = (e, list, key = 'i') => {
  e.data[key] = (e.data[key] ?? -1) + 1;
  return list[e.data[key] % list.length];
};
// Temporary Might loss on the player ("Shackled"), Ward-safe.
const shackle = (g, e, n) => {
  if (g.apply(g.player, 'might', -n, e)) g.addStatus(g.player, 'shackled', n);
};

// ------------------------------------------------------------------ statuses
defineStatuses([
  {
    id: 'pack', name: 'Pack', kind: 'buff', icon: 'enrage',
    desc: (n) => `When another hound of its pack dies, gains ${n} Might.`,
    enemyDied(g, o, n, dead) {
      if (!o.isPlayer && !o.dead && dead !== o && dead.st && dead.st.pack) g.apply(o, 'might', n, o);
    },
  },
  {
    id: 'carrion', name: 'Carrion', kind: 'buff', icon: 'feather',
    desc: (n) => `Whenever another creature dies, heals ${n} HP and gains 1 Might.`,
    enemyDied(g, o, n, dead) {
      if (!o.isPlayer && !o.dead && dead !== o) { g.heal(o, n); g.apply(o, 'might', 1, o); }
    },
  },
  {
    id: 'stopped', name: 'Stopped', kind: 'buff', icon: 'skull',
    desc: () => 'The first time it would die, it falls with 1 HP instead and rises next turn with 10 HP. Finish it while it lies there.',
  },
  {
    id: 'backstab', name: 'Backstab', kind: 'buff', icon: 'knife',
    desc: () => 'Deals 50% more attack damage while you have no Block.',
    atkMul: (g, o) => (!o.isPlayer && g.player.block <= 0 ? 1.5 : 1),
  },
  {
    id: 'bloodsucker', name: 'Bloodsucker', kind: 'buff', icon: 'blood',
    desc: () => 'Heals HP equal to the unblocked attack damage it deals.',
    playerAttacked(g, o, n, src, unblocked) { if (src === o && unblocked > 0 && !o.dead) g.heal(o, unblocked); },
  },
  {
    id: 'plague_bite', name: 'Plague-Bite', kind: 'buff', icon: 'rot',
    desc: (n) => `Each of its hits that deals unblocked damage applies ${n} Rot.`,
    playerAttacked(g, o, n, src, unblocked) { if (src === o && unblocked > 0) g.apply(g.player, 'rot', n, o); },
  },
  {
    id: 'light_fingers', name: 'Light Fingers', kind: 'buff', icon: 'eye',
    desc: (n) => `Has stolen ${n} Gold. Kill it before it flees to get it back.`,
  },
  {
    id: 'choked', name: 'Choked', kind: 'debuff', icon: 'chain',
    desc: (n) => `Whenever you play a card this turn, lose ${n} HP.`,
    cardPlayed(g, o, n) { if (o.isPlayer) g.loseHp(o, n, { type: 'hploss' }); },
    turnEnd(g, o) { g.removeStatus(o, 'choked'); },
  },
  {
    id: 'hanged_man', name: 'Hanged Man', kind: 'buff', icon: 'skull',
    desc: (n) => `At half HP the rope snaps: gains ${n} Might and stops guarding.`,
  },
  {
    id: 'brood_hunger', name: 'Brood-Hunger', kind: 'buff', icon: 'heart',
    desc: () => 'Devours her own leeches, healing their remaining HP + 6. Kill them before she feeds.',
  },
  {
    id: 'chorus', name: 'Chorus', kind: 'buff', icon: 'echo',
    desc: (n) => `When another voice of the Choir falls, gains ${n} Might.`,
    enemyDied(g, o, n, dead) {
      if (!o.isPlayer && !o.dead && dead !== o && dead.st && dead.st.chorus) g.apply(o, 'might', n, o);
    },
  },
  {
    id: 'hound_lord', name: 'Hound-Lord', kind: 'buff', icon: 'crown',
    desc: () => 'Whistles up fresh War Hounds when his pack is dead. At half HP, flies into a Blood Frenzy. His hounds flee if he falls.',
  },
  {
    id: 'frenzy', name: 'Blood Frenzy', kind: 'buff', icon: 'blood',
    desc: (n) => `At the end of its turn, gains ${n} Might. Takes 25% more attack damage.`,
    turnEnd(g, o, n) { g.apply(o, 'might', n, o); },
    takeMul: () => 1.25,
  },
  {
    id: 'hanging_judge', name: 'Hanging Judge', kind: 'buff', icon: 'chain',
    desc: (n) => `The Noose deals ${n} more damage for each card you played this turn. Every Warrant left in your hand at end of turn gives him 1 Might.`,
  },
  {
    id: 'teeming', name: 'Teeming', kind: 'buff', icon: 'split',
    desc: (n) => `For every ${n} HP she loses, a Rat Swarm bursts out of her.`,
  },
  {
    id: 'swarm_fed', name: 'Swarm-Fed', kind: 'buff', icon: 'mending',
    desc: (n) => `At the end of her turn, heals ${n} HP for each living Rat Swarm.`,
    turnEnd(g, o, n) {
      const k = g.enemies.filter((x) => x.id === 'rat_swarm').length;
      if (k) g.heal(o, n * k);
    },
  },
]);

// ------------------------------------------------------------------ the Sheriff's Warrant
defineCards([
  {
    id: 'sheriffs_warrant', name: 'Warrant', hero: 'status', type: 'status', rarity: 'special', cost: 1, target: 'none',
    kw: ['exhaust'], art: 'scroll', noUp: true,
    text: 'Answer the charge. If this is in your hand at end of turn, the Sheriff gains 1 Might.',
    play() {},
    endTurnInHand(g) {
      const s = g.enemies.find((x) => x.id === 'hanged_sheriff');
      if (s) g.apply(s, 'might', 1, s);
    },
  },
]);

// ------------------------------------------------------------------ enemy-specific logic
function steal(g, e, n) {
  const amt = Math.min(n, g.run.gold);
  if (amt <= 0) return;
  g.loseGold(amt);
  e.data.stolen = (e.data.stolen || 0) + amt;
  g.cb.stolen = (g.cb.stolen || 0) + amt;
  g.addStatus(e, 'light_fingers', amt);
}

function summonHounds(g, e, upTo) {
  let k = count(g, 'war_hound');
  while (k < upTo && g.enemies.length < 5) {
    if (!g.spawn('war_hound', { minion: true, front: true })) break;
    k++;
  }
  e.data.lastLoose = e.turns;
}

function spawnLeeches(g, n) {
  for (let i = 0; i < n && count(g, 'bog_leech') < 3 && g.enemies.length < 5; i++) {
    g.spawn('bog_leech', { minion: true, front: true, hp: int(g.crng, 10, 13) });
  }
}

function spawnRats(g, n, hp) {
  for (let i = 0; i < n && g.enemies.length < 5; i++) {
    g.spawn('rat_swarm', { minion: true, front: true, hp: hp || int(g.crng, 8, 10) });
  }
}

// ------------------------------------------------------------------ enemies
defineEnemies([
  // ============================================================ NORMALS
  {
    id: 'marsh_hound', name: 'Marsh Hound', kind: 'normal', act: 1, hp: [13, 16], sprite: 'en_marsh_hound',
    desc: 'Fen-dogs gone feral since Ashfall, ribs like a gibbet\'s cage. Kill one and the rest come harder.',
    init(g, e) { g.addStatus(e, 'pack', 3, { silent: true }); },
    moves: {
      bite: { name: 'Bite', intent: 'atk', dmg: 11 },
      worry: { name: 'Worry', intent: 'atk', dmg: 4, times: 2 },
      circle: { name: 'Circle', intent: 'def', fx(g, e) { g.gainBlock(e, 5, { raw: true }); } },
    },
    ai(g, e) {
      if (e.turns === 0) return g.aiPick(e, { circle: 50, worry: 50 });
      return g.aiPick(e, { bite: 50, worry: 30, circle: 20 }, { bite: 2, worry: 2, circle: 1 });
    },
  },
  {
    id: 'gibbet_crow', name: 'Gibbet Crow', kind: 'normal', act: 1, hp: [9, 12], sprite: 'en_gibbet_crow',
    desc: 'Fat on the hanged. It has learned that wherever you walk, there will be more to eat.',
    init(g, e) { g.addStatus(e, 'carrion', 4, { silent: true }); },
    moves: {
      peck: { name: 'Peck', intent: 'atk', dmg: 4, times: 2 },
      eyes: { name: 'Go for the Eyes', intent: 'atkdebuff', dmg: 6, fx(g, e) { g.apply(g.player, 'weak', 1, e); } },
    },
    ai(g, e) { return g.aiPick(e, { peck: 55, eyes: 45 }, { peck: 2, eyes: 1 }); },
  },
  {
    id: 'coughing_dead', name: 'Coughing Dead', kind: 'normal', act: 1, hp: [26, 30], sprite: 'en_coughing_dead',
    desc: 'A plague-villager who should have died years ago. The Blight did not kill it. It only stopped it.',
    init(g, e) { g.addStatus(e, 'stopped', 1, { silent: true }); },
    moves: {
      lurch: { name: 'Lurch', intent: 'atk', dmg: 17 },
      cough: { name: 'Wet Cough', intent: 'atkdebuff', dmg: 4, fx(g, e) { g.apply(g.player, 'rot', 3, e); } },
      rise: { name: 'Rises Again', intent: 'heal', fx(g, e) { e.data.fallen = false; g.heal(e, 9); } },
    },
    ai(g, e) {
      if (e.data.fallen) return 'rise';
      return g.aiPick(e, { lurch: 55, cough: 45 }, { lurch: 2, cough: 1 });
    },
    on: {
      hpLost(g, e) {
        if (e.hp <= 0 && e.st.stopped) {
          e.hp = 1;
          e.block = 0;
          e.data.fallen = true;
          g.removeStatus(e, 'stopped');
          e.move = 'rise';
          g.emit('intent', { e });
        }
      },
    },
  },
  {
    id: 'ash_cultist', name: 'Ash Cultist', kind: 'normal', act: 1, hp: [44, 50], sprite: 'en_ash_cultist',
    desc: 'They smear their faces with the ash of Ashfall and call it sacrament. Every prayer makes the next blow heavier.',
    moves: {
      rite: { name: 'Ashen Rite', intent: 'buff', fx(g, e) { g.apply(e, 'rite', 3, e); } },
      lash: { name: 'Cinder Lash', intent: 'atk', dmg: 11 },
      scatter: { name: 'Scatter Ash', intent: 'atkdebuff', dmg: 6, fx(g) { g.addCard('ash', 'discard'); } },
    },
    ai(g, e) {
      if (e.turns === 0) return 'rite';
      return g.aiPick(e, { lash: 70, scatter: 30 }, { lash: 3, scatter: 1 });
    },
  },
  {
    id: 'marcher_cutthroat', name: 'Marcher Cutthroat', kind: 'normal', act: 1, hp: [22, 26], sprite: 'en_marcher_cutthroat',
    desc: 'A deserter of the Marcher levy, red scarf over his mouth against the ash. He waits for your guard to drop.',
    init(g, e) { g.addStatus(e, 'backstab', 1, { silent: true }); },
    moves: {
      stab: { name: 'Stab', intent: 'atk', dmg: 14 },
      straps: { name: 'Cut the Straps', intent: 'atkdebuff', dmg: 8, fx(g, e) { g.apply(g.player, 'frail', 2, e); } },
      skulk: { name: 'Skulk', intent: 'def', fx(g, e) { g.gainBlock(e, 6, { raw: true }); } },
    },
    ai(g, e) {
      if (e.turns === 0) return g.aiPick(e, { straps: 50, skulk: 50 });
      return g.aiPick(e, { stab: 50, straps: 25, skulk: 25 }, { stab: 2, straps: 1, skulk: 1 });
    },
  },
  {
    id: 'marcher_archer', name: 'Marcher Archer', kind: 'normal', act: 1, hp: [18, 22], sprite: 'en_marcher_archer',
    desc: 'A longbowman of the old levy, unpaid since Ashfall. Patient behind his pavise. Very accurate.',
    moves: {
      pavise: { name: 'Behind the Pavise', intent: 'def', fx(g, e) { g.gainBlock(e, 6, { raw: true }); } },
      loose: { name: 'Loose', intent: 'atk', dmg: 22 },
      pin: { name: 'Pinning Shot', intent: 'atkdebuff', dmg: 7, fx(g, e) { g.apply(g.player, 'dread', 1, e); } },
    },
    ai(g, e) { return step(e, ['pavise', 'loose', 'pin']); },
  },
  {
    id: 'bog_leech', name: 'Bog Leech', kind: 'normal', act: 1, hp: [15, 18], sprite: 'en_bog_leech',
    desc: 'Fen-leeches the length of a man\'s arm. They grow fat on the drowned, and fatter on the living.',
    init(g, e) { g.addStatus(e, 'bloodsucker', 1, { silent: true }); },
    moves: {
      latch: { name: 'Latch On', intent: 'atk', dmg: 13 },
      swell: { name: 'Engorge', intent: 'buff', fx(g, e) { g.apply(e, 'might', 2, e); } },
    },
    ai(g, e) {
      if (e.turns === 0) return g.aiPick(e, { latch: 50, swell: 50 });
      return g.aiPick(e, { latch: 65, swell: 35 }, { latch: 2, swell: 1 });
    },
  },
  {
    id: 'grave_robber', name: 'Grave Robber', kind: 'normal', act: 1, hp: [22, 26], sprite: 'en_grave_robber',
    desc: 'He digs up the dead for their rings. You are only slightly more trouble, and carry more coin.',
    moves: {
      pilfer: { name: 'Pilfer', intent: 'atk', dmg: 13, fx(g, e) { steal(g, e, 15); } },
      shovel: { name: 'Shovel to the Skull', intent: 'atk', dmg: 19 },
      dust: { name: 'Grave-Dust', intent: 'def', fx(g, e) { g.gainBlock(e, 10, { raw: true }); } },
      flee: {
        name: 'Scarper', intent: 'flee',
        fx(g, e) {
          if (e.data.stolen && g.cb) g.cb.stolen = Math.max(0, (g.cb.stolen || 0) - e.data.stolen);
          flee(g, e);
        },
      },
    },
    ai(g, e) {
      if (e.turns === 0) return 'pilfer';
      if (e.turns === 1) return g.aiPick(e, { pilfer: 50, shovel: 50 });
      if (e.turns === 2) return 'dust';
      return 'flee';
    },
  },
  {
    id: 'wight_militiaman', name: 'Wight Militiaman', kind: 'normal', act: 1, hp: [28, 32], sprite: 'en_wight_militiaman',
    desc: 'Mustered for a war that never came. A century on it still holds the line, for anything that stands beside it.',
    moves: {
      thrust: { name: 'Pike Thrust', intent: 'atk', dmg: 19 },
      line: {
        name: 'Hold the Line', intent: 'def',
        fx(g, e) { for (const x of g.enemies) g.gainBlock(x, x === e ? 6 : 8, { raw: true }); },
      },
      bash: { name: 'Shield-Bash', intent: 'atkdef', dmg: 11, fx(g, e) { g.gainBlock(e, 5, { raw: true }); } },
    },
    ai(g, e) {
      const allies = g.enemies.length > 1;
      if (allies) return g.aiPick(e, { thrust: 40, line: 40, bash: 20 }, { thrust: 2, line: 1, bash: 1 });
      return g.aiPick(e, { thrust: 50, bash: 35, line: 15 }, { thrust: 2, line: 1, bash: 1 });
    },
  },
  {
    id: 'rat_swarm', name: 'Rat Swarm', kind: 'normal', act: 1, hp: [10, 13], sprite: 'en_rat_swarm',
    desc: 'Not a rat. Rats: a carpet of them moving as one thing, thinking as one thing. Every bite carries the Blight.',
    init(g, e) { g.addStatus(e, 'plague_bite', 1, { silent: true }); },
    moves: {
      gnaw: { name: 'Gnaw', intent: 'atkdebuff', dmg: 2, times: 3 },
      swarm: { name: 'Swarm Over', intent: 'atkdebuff', dmg: 8 },
    },
    ai(g, e) { return g.aiPick(e, { gnaw: 60, swarm: 40 }, { gnaw: 2, swarm: 2 }); },
  },
  {
    id: 'war_hound', name: 'War Hound', kind: 'normal', act: 1, hp: [13, 15], sprite: 'en_war_hound',
    desc: 'Bragg\'s mastiffs, collared in nails and fed on men. They fight harder over their brothers\' bodies.',
    init(g, e) { g.addStatus(e, 'pack', 3, { silent: true }); },
    moves: {
      rend: { name: 'Rend', intent: 'atk', dmg: 13 },
      savage: { name: 'Savage', intent: 'atk', dmg: 6, times: 2 },
    },
    ai(g, e) { return g.aiPick(e, { rend: 55, savage: 45 }, { rend: 2, savage: 2 }); },
  },

  // ============================================================ ELITES
  {
    id: 'sir_rendrick', name: 'Sir Rendrick', kind: 'elite', act: 1, hp: [98, 104], sprite: 'en_sir_rendrick',
    desc: 'Hanged at the crossroads for cowardice, eighty years ago. The rope never let him go, so he took it with him.',
    init(g, e) { g.addStatus(e, 'hanged_man', 3, { silent: true }); },
    moves: {
      chain: { name: 'Strangling Chain', intent: 'atkdebuff', dmg: 10, fx(g, e) { g.apply(g.player, 'choked', 2, e); } },
      cleave: { name: 'Headsman\'s Cleave', intent: 'atk', dmg: 28 },
      swing: { name: 'Gallows Swing', intent: 'atk', dmg: 8, times: 3 },
      brace: { name: 'Rusted Guard', intent: 'def', fx(g, e) { g.gainBlock(e, 14, { raw: true }); } },
    },
    ai(g, e) {
      if (e.data.snapped) return step(e, ['cleave', 'swing', 'chain'], 'j');
      return step(e, ['chain', 'cleave', 'brace', 'chain', 'cleave', 'swing']);
    },
    on: {
      hpLost(g, e) {
        if (!e.data.snapped && e.hp > 0 && e.hp <= e.maxHp / 2 && e.st.hanged_man) {
          e.data.snapped = true;
          const n = e.st.hanged_man;
          g.removeStatus(e, 'hanged_man');
          g.apply(e, 'might', n, e);
          g.emit('phase', { e, text: 'The rope snaps!' });
        }
      },
    },
  },
  {
    id: 'bog_mother', name: 'The Bog Mother', kind: 'elite', act: 1, hp: [82, 88], sprite: 'en_bog_mother', leader: true,
    desc: 'Something vast and soft lies under the fen-pools, and the leeches are its children. It loves them. It is also very hungry.',
    init(g, e) { g.addStatus(e, 'brood_hunger', 1, { silent: true }); },
    moves: {
      brood: { name: 'Spawn Brood', intent: 'summon', fx(g) { spawnLeeches(g, 2); } },
      grasp: {
        name: 'Mire Grasp', intent: 'atkdebuff', dmg: 16,
        fx(g) { g.addCard('mire', 'draw'); g.addCard('mire', 'draw'); },
      },
      smother: { name: 'Smother', intent: 'atk', dmg: 26 },
      devour: {
        name: 'Devour Young', intent: 'heal',
        fx(g, e) {
          const kids = g.enemies.filter((x) => x.id === 'bog_leech');
          if (!kids.length) return;
          const fat = kids.reduce((m, x) => (x.hp > m.hp ? x : m));
          const heal = fat.hp + 6;
          fat.hp = 0;
          fat.dead = true;
          g.emit('death', { e: fat });
          g.heal(e, heal);
          g.apply(e, 'might', 1, e);
          g.checkEnd();
        },
      },
    },
    ai(g, e) {
      if (e.turns === 0) return 'brood';
      const kids = count(g, 'bog_leech');
      if (!kids && !g.lastMove(e, 'brood')) return 'brood';
      if (kids && e.hp < e.maxHp * 0.8 && !g.lastMove(e, 'devour') && !g.lastMove(e, 'brood')) {
        return g.aiPick(e, { devour: 50, grasp: 25, smother: 25 }, { grasp: 1, smother: 1 });
      }
      return g.aiPick(e, { grasp: 35, smother: 40, brood: kids < 2 ? 25 : 0 }, { grasp: 1, smother: 1, brood: 1 });
    },
  },
  {
    id: 'choir_precentor', name: 'Precentor of Ash', kind: 'elite', act: 1, hp: [34, 38], sprite: 'en_choir_precentor',
    desc: 'He leads the Ashen Choir in the hymn they sang on the night the King died. They have not stopped singing.',
    init(g, e) { g.addStatus(e, 'chorus', 2, { silent: true }); },
    moves: {
      hymn: {
        name: 'Hymn of Cinders', intent: 'buff',
        fx(g, e) { for (const x of g.enemies) if (x.st.chorus) g.apply(x, 'might', 2, e); },
      },
      psalm: { name: 'Cinder Psalm', intent: 'atk', dmg: 14 },
    },
    ai(g, e) {
      return step(e, ['hymn', 'psalm', 'psalm']);
    },
  },
  {
    id: 'choir_thurifer', name: 'Thurifer of Ash', kind: 'elite', act: 1, hp: [30, 34], sprite: 'en_choir_thurifer',
    desc: 'Her censer burns the bones of the unshriven. The smoke gets into the lungs, and the mind.',
    init(g, e) { g.addStatus(e, 'chorus', 2, { silent: true }); },
    moves: {
      censer: { name: 'Censer Swing', intent: 'atk', dmg: 12 },
      smoke: {
        name: 'Choking Smoke', intent: 'debuff',
        fx(g, e) { g.addCard('ash', 'draw'); g.apply(g.player, 'weak', 1, e); },
      },
    },
    ai(g, e) {
      return step(e, ['censer', 'smoke', 'censer']);
    },
  },
  {
    id: 'choir_penitent', name: 'Penitent of Ash', kind: 'elite', act: 1, hp: [28, 32], sprite: 'en_choir_penitent',
    desc: 'He scourges himself for the sin of outliving his King, and every drop he spills is a prayer for his brothers.',
    init(g, e) { g.addStatus(e, 'chorus', 2, { silent: true }); },
    moves: {
      scourge: {
        name: 'Scourge', intent: 'def',
        fx(g, e) {
          g.loseHp(e, 3, { type: 'hploss' });
          for (const x of g.enemies) if (x !== e) g.gainBlock(x, 9, { raw: true });
          g.gainBlock(e, 4, { raw: true });
        },
      },
      flail: { name: 'Flail', intent: 'atk', dmg: 7, times: 2 },
    },
    ai(g, e) {
      return step(e, ['scourge', 'flail', 'flail']);
    },
  },

  // ============================================================ BOSSES
  {
    id: 'bragg', name: 'Bragg the Hound-Lord', kind: 'boss', act: 1, hp: 250, sprite: 'en_bragg', leader: true,
    desc: 'Captain of the Marcher levy until Ashfall; now lord of every cutthroat between the fens and the Wood. He feeds his hounds first.',
    init(g, e) { g.addStatus(e, 'hound_lord', 1, { silent: true }); },
    moves: {
      loose: { name: 'Loose the Hounds', intent: 'summon', fx(g, e) { summonHounds(g, e, 2); } },
      cleaver: { name: 'Butcher\'s Cleaver', intent: 'atk', dmg: 26 },
      sic: {
        name: 'Sic \'Em!', intent: 'atkbuff', dmg: 14,
        fx(g, e) { for (const h of g.enemies) if (h.id === 'war_hound') g.apply(h, 'might', 2, e); },
      },
      gut: { name: 'Gut-Rip', intent: 'atk', dmg: 6, times: 3 },
      frenzy: {
        name: 'Blood Frenzy', intent: 'buff',
        fx(g, e) {
          e.data.frenzy = true;
          e.data.frenzyNow = false;
          g.apply(e, 'frenzy', 1, e);
          g.gainBlock(e, 12, { raw: true });
          summonHounds(g, e, 2);
        },
      },
      hack: { name: 'Frenzied Hacking', intent: 'atk', dmg: 12, times: 2 },
    },
    ai(g, e) {
      if (e.turns === 0) return 'loose';
      if (e.data.frenzyNow) return 'frenzy';
      if (!count(g, 'war_hound') && e.turns - (e.data.lastLoose ?? 0) >= 4) return 'loose';
      if (e.data.frenzy) return step(e, ['hack', 'cleaver', 'sic'], 'j');
      return step(e, ['cleaver', 'sic', 'gut']);
    },
    on: {
      hpLost(g, e) {
        if (!e.data.frenzy && !e.data.frenzyNow && e.hp > 0 && e.hp <= e.maxHp / 2) {
          e.data.frenzyNow = true;
          e.move = 'frenzy';
          g.emit('intent', { e });
          g.emit('phase', { e, text: 'Bragg flies into a Blood Frenzy!' });
        }
      },
    },
  },
  {
    id: 'hanged_sheriff', name: 'The Hanged Sheriff', kind: 'boss', act: 1, hp: 320, sprite: 'en_hanged_sheriff',
    desc: 'He hanged three hundred men at the Marcher crossroads, all by the King\'s law. When the King died, the Sheriff\'s heart stopped. He did not.',
    init(g, e) { e.data.per = 5; g.addStatus(e, 'hanging_judge', 5, { silent: true }); },
    moves: {
      charges: {
        name: 'Read the Charges', intent: 'strongdebuff',
        fx(g, e) { const n = e.data.day ? 3 : 2; for (let i = 0; i < n; i++) g.addCard('sheriffs_warrant', 'draw'); },
      },
      manacles: { name: 'Iron Manacles', intent: 'atkdebuff', dmg: 22, fx(g, e) { shackle(g, e, 2); } },
      cudgel: { name: 'Reeve\'s Cudgel', intent: 'atk', dmg: 32 },
      noose: {
        name: 'The Noose', intent: 'atk',
        dmg: (g, e) => 5 + (e.data.per || 5) * (g.cb ? g.cb.cnt.cards : 0),
      },
      day: {
        name: 'Hanging Day', intent: 'strongdebuff',
        fx(g, e) {
          e.data.day = true;
          e.data.dayNow = false;
          e.data.per = 6;
          g.addStatus(e, 'hanging_judge', 1);
          g.gainBlock(e, 12, { raw: true });
          for (let i = 0; i < 3; i++) g.addCard('sheriffs_warrant', 'draw');
        },
      },
    },
    ai(g, e) {
      if (e.turns === 0) return 'charges';
      if (e.data.dayNow) return 'day';
      if (e.data.day) return step(e, ['cudgel', 'noose', 'manacles', 'noose', 'charges', 'noose'], 'j');
      return step(e, ['manacles', 'noose', 'cudgel', 'charges', 'noose', 'cudgel']);
    },
    on: {
      hpLost(g, e) {
        if (!e.data.day && !e.data.dayNow && e.hp > 0 && e.hp <= e.maxHp / 2) {
          e.data.dayNow = true;
          e.move = 'day';
          g.emit('intent', { e });
          g.emit('phase', { e, text: 'It is Hanging Day.' });
        }
      },
    },
  },
  {
    id: 'mother_of_rats', name: 'Mother of Rats', kind: 'boss', act: 1, hp: 250, sprite: 'en_mother_of_rats', leader: true,
    desc: 'In the plague-pits under Saltmarsh something has eaten the dead for ten years. It has grown very large. It has had a great many children.',
    init(g, e) {
      e.data.acc = 0;
      g.addStatus(e, 'teeming', 35, { silent: true });
      g.addStatus(e, 'swarm_fed', 1, { silent: true });
    },
    moves: {
      birth: { name: 'Birth the Swarm', intent: 'summon', fx(g) { spawnRats(g, 2); } },
      kiss: { name: 'Plague Kiss', intent: 'atkdebuff', dmg: 20, fx(g, e) { g.apply(g.player, 'rot', 3, e); } },
      wallow: { name: 'Wallow', intent: 'atk', dmg: 30 },
      tide: { name: 'Tide of Teeth', intent: 'atkdebuff', dmg: 8, times: 4 },
      boil: {
        name: 'The Pit Boils', intent: 'summon',
        fx(g, e) {
          e.data.boiled = true;
          e.data.boilNow = false;
          g.addStatus(e, 'plague_bite', 1);
          spawnRats(g, Math.max(0, 2 - count(g, 'rat_swarm')));
        },
      },
    },
    ai(g, e) {
      if (e.turns === 0) return 'birth';
      if (e.data.boilNow) return 'boil';
      const rats = count(g, 'rat_swarm');
      if (e.data.boiled) {
        const m = step(e, ['tide', 'wallow', 'kiss'], 'j');
        return m === 'kiss' && rats === 0 ? 'birth' : m;
      }
      const m = step(e, ['kiss', 'wallow', 'tide']);
      return m === 'tide' && rats === 0 ? 'birth' : m;
    },
    on: {
      hpLost(g, e, n) {
        if (e.hp <= 0) return;
        const per = e.st.teeming;
        if (per) {
          e.data.acc = (e.data.acc || 0) + n;
          while (e.data.acc >= per) {
            e.data.acc -= per;
            spawnRats(g, 1, 5);
          }
        }
        if (!e.data.boiled && !e.data.boilNow && e.hp <= e.maxHp / 2) {
          e.data.boilNow = true;
          e.move = 'boil';
          g.emit('intent', { e });
          g.emit('phase', { e, text: 'The pit boils with rats!' });
        }
      },
    },
  },
]);

// ------------------------------------------------------------------ encounters
defineEncounters([
  // Easy: the first three fights of the act. Mild openers.
  { id: 'a1_hounds', act: 1, pool: 'easy', enemies: ['marsh_hound', 'marsh_hound'], name: 'Marsh Hounds' },
  { id: 'a1_cultist', act: 1, pool: 'easy', enemies: ['ash_cultist'], name: 'Ash Cultist' },
  { id: 'a1_coughing', act: 1, pool: 'easy', enemies: ['coughing_dead'], name: 'The Coughing Dead' },
  { id: 'a1_robber', act: 1, pool: 'easy', enemies: ['grave_robber'], name: 'Grave Robber' },
  { id: 'a1_leech_crow', act: 1, pool: 'easy', enemies: ['bog_leech', 'gibbet_crow'], name: 'Fen Scavengers' },
  // Hard.
  { id: 'a1_pack', act: 1, pool: 'hard', enemies: ['marsh_hound', 'marsh_hound', 'marsh_hound'], name: 'The Pack' },
  { id: 'a1_bandits', act: 1, pool: 'hard', enemies: ['marcher_cutthroat', 'marcher_archer'], name: 'Marcher Bandits' },
  { id: 'a1_robbers_road', act: 1, pool: 'hard', enemies: ['marcher_cutthroat', 'grave_robber'], name: 'Robbers\' Road' },
  { id: 'a1_plague_cart', act: 1, pool: 'hard', enemies: ['coughing_dead', 'rat_swarm'], name: 'The Plague Cart' },
  { id: 'a1_murder', act: 1, pool: 'hard', enemies: ['gibbet_crow', 'gibbet_crow', 'gibbet_crow'], name: 'A Murder of Crows' },
  { id: 'a1_muster', act: 1, pool: 'hard', enemies: ['gibbet_crow', 'wight_militiaman', 'gibbet_crow'], name: 'The Dead Muster' },
  { id: 'a1_fen', act: 1, pool: 'hard', enemies: ['bog_leech', 'bog_leech', 'gibbet_crow'], name: 'Leech-Fen' },
  { id: 'a1_rats', act: 1, pool: 'hard', enemies: ['rat_swarm', 'rat_swarm', 'rat_swarm'], name: 'Plague Rats' },
  { id: 'a1_carrion_rite', act: 1, pool: 'hard', enemies: ['gibbet_crow', 'ash_cultist'], name: 'Carrion Rite' },
  { id: 'a1_wight_rats', act: 1, pool: 'hard', enemies: ['wight_militiaman', 'rat_swarm'], name: 'The Ossuary Guard' },
  // Elites.
  { id: 'a1_rendrick', act: 1, pool: 'elite', enemies: ['sir_rendrick'], name: 'Sir Rendrick, the Gibbet Knight' },
  { id: 'a1_bog_mother', act: 1, pool: 'elite', enemies: ['bog_mother'], name: 'The Bog Mother' },
  { id: 'a1_choir', act: 1, pool: 'elite', enemies: ['choir_precentor', 'choir_thurifer', 'choir_penitent'], name: 'The Ashen Choir' },
  // Bosses.
  { id: 'a1_boss_bragg', act: 1, pool: 'boss', enemies: ['bragg'], name: 'Bragg the Hound-Lord' },
  { id: 'a1_boss_sheriff', act: 1, pool: 'boss', enemies: ['hanged_sheriff'], name: 'The Hanged Sheriff' },
  { id: 'a1_boss_rats', act: 1, pool: 'boss', enemies: ['mother_of_rats'], name: 'Mother of Rats' },
]);

defineTexts({
  boss_intro: {
    a1_boss_bragg: 'Bragg wipes his cleaver on a dead man\'s coat and whistles. Out of the ash, the hounds come. "Supper, lads."',
    a1_boss_sheriff: 'The rope at his throat creaks as he unrolls the warrant. "By the authority of a dead King, I find you guilty."',
    a1_boss_rats: 'The floor of the plague-pit heaves and squeals. Something enormous lifts its blind, pink face toward you.',
  },
});

// ------------------------------------------------------------------ sprites
// All enemies face LEFT. Light from the top-left. Act palette: ash greys,
// fen umbers, bone; accents — ember eyes (beasts), bile/rot (plague),
// blood-red scarves (Marcher bandits), ash-white (cultists), rust (wights).
const RUST = '#7a4a2a';
const MUD = '#3b3226';
const FUR = '#5f5952';
const FUR_D = '#433e3a';
const FLESH_DEAD = '#9a9a80';
const PINK = '#c08a86';

// Small reusable figures.
function ratFig(p, x, y, s = 1, col = '#4e4640') {
  // A single rat facing left at (x,y) = nose. s scales.
  p.path([[x + 9 * s, y + 2 * s], [x + 13 * s, y + 4 * s], [x + 16 * s, y + 2 * s]], PINK, 1);
  p.ellipse(x + 6 * s, y + 1.5 * s, 4 * s, 2.4 * s, col, { shade: 0.25 });
  p.poly([[x, y + 1.5 * s], [x + 3 * s, y - 0.5 * s], [x + 4 * s, y + 3 * s]], col);
  p.px(x + 3 * s, y - 1 * s, PINK);
  p.px(x + 2, y + 1, '#d23a2a');
}
function leechFig(p, x, y, len, col = '#3f3a26') {
  // A small leech, mouth at (x,y), body trailing right.
  p.path([[x, y], [x + len * 0.4, y - 1], [x + len, y + 1]], col, 3);
  p.px(x, y, PINK);
}

defineSprites({
  en_marsh_hound: {
    w: 48, h: 32,
    draw(p) {
      p.path([[17, 19], [14, 25], [12, 31]], FUR_D, 2);
      p.path([[33, 19], [37, 25], [36, 31]], FUR_D, 2);
      p.path([[38, 13], [43, 17], [46, 24]], FUR_D, 3);
      p.ellipse(27, 14, 12, 6, FUR, { shade: 0.3 });
      p.eraseEllipse(28, 22, 7, 3);
      p.poly([[9, 10], [17, 5], [24, 8], [22, 18], [13, 19]], FUR, { shade: 0.3 });
      p.ellipse(9, 13, 6, 4, FUR, { shade: 0.25 });
      p.poly([[0, 14], [6, 11], [8, 16], [1, 17]], FUR_D);
      p.tri(8, 10, 9, 3, 13, 9, FUR);
      p.px(10, 6, PAL.night);
      p.path([[19, 18], [18, 25], [16, 31]], FUR, 3);
      p.path([[34, 17], [36, 24], [34, 31]], FUR, 3);
      for (let i = 0; i < 4; i++) p.line(23 + i * 3, 12, 22 + i * 3, 18, FUR_D);
      for (let i = 0; i < 6; i++) p.line(14 + i * 3, 6 + (i > 2 ? 1 : 0), 15 + i * 3, 3 + (i > 2 ? 3 : 0), FUR_D);
      p.line(1, 16, 7, 16, PAL.gore);
      p.px(2, 17, PAL.bone); p.px(5, 17, PAL.bone); p.px(3, 15, PAL.bone);
      p.glow(7, 12, PAL.ember, 2);
    },
  },
  en_war_hound: {
    w: 52, h: 38,
    draw(p) {
      const F = '#5a4636', D = '#3c2e24';
      p.path([[18, 24], [15, 31], [13, 37]], D, 3);
      p.path([[37, 24], [41, 31], [40, 37]], D, 3);
      p.path([[42, 15], [47, 13], [50, 8]], F, 3);
      p.ellipse(31, 18, 13, 8, F, { shade: 0.3 });
      p.ellipse(16, 17, 9, 10, F, { shade: 0.3 });
      p.ellipse(10, 14, 8, 6, F, { shade: 0.25 });
      p.poly([[0, 15], [6, 11], [9, 19], [2, 21]], D);
      p.poly([[1, 18], [8, 18], [7, 23], [2, 22]], D);
      p.line(2, 19, 8, 19, PAL.blood); p.line(2, 20, 7, 21, PAL.gore);
      p.px(2, 18, PAL.bone); p.px(5, 18, PAL.bone); p.px(3, 21, PAL.bone);
      p.tri(10, 9, 12, 4, 15, 10, D);
      p.rect(15, 10, 4, 14, PAL.iron, { shade: 0.3 });
      for (let i = 0; i < 4; i++) p.tri(14, 11 + i * 3, 11, 12 + i * 3, 14, 13 + i * 3, PAL.steel);
      p.path([[21, 23], [20, 30], [18, 37]], F, 4);
      p.path([[38, 23], [40, 30], [38, 37]], F, 4);
      p.line(26, 13, 33, 20, PAL.gore); p.line(30, 12, 36, 18, PAL.gore);
      p.glow(8, 13, PAL.ember, 2);
    },
  },
  en_gibbet_crow: {
    w: 30, h: 30,
    draw(p) {
      const B = '#1e1b22', W = '#2e2a36';
      p.rect(12, 26, 16, 3, PAL.wood, { shade: 0.3 });
      p.path([[14, 20], [13, 26]], PAL.stone, 1); p.path([[18, 20], [19, 26]], PAL.stone, 1);
      p.poly([[20, 12], [29, 18], [28, 24], [22, 20]], B);
      p.ellipse(16, 15, 8, 7, B, { shade: 0.25 });
      p.poly([[12, 9], [24, 10], [27, 19], [14, 19]], W, { shade: 0.3 });
      for (let i = 0; i < 3; i++) p.line(16 + i * 3, 12, 20 + i * 3, 19, B);
      p.circle(9, 8, 4.5, B, { shade: 0.25 });
      p.poly([[0, 10], [6, 6], [7, 10]], PAL.stone);
      p.line(1, 10, 6, 9, PAL.ash);
      p.glow(8, 7, PAL.ember, 1);
    },
  },
  en_coughing_dead: {
    w: 38, h: 54,
    draw(p) {
      const S = '#6b5f48', SD = '#4a4234', SK = '#a3a58a';
      // legs
      p.path([[17, 38], [15, 46], [14, 53]], SK, 3);
      p.path([[24, 38], [26, 46], [28, 53]], '#868a72', 3);
      p.rect(11, 52, 6, 2, PAL.night); p.rect(26, 52, 6, 2, PAL.night);
      // hunched torso in a tattered smock
      p.poly([[13, 20], [28, 17], [33, 28], [31, 42], [11, 42], [9, 31]], S, { shade: 0.3 });
      p.poly([[9, 38], [32, 38], [34, 45], [29, 42], [25, 47], [20, 42], [15, 47], [11, 42], [7, 45]], SD);
      p.line(11, 31, 31, 31, PAL.bark, 2);
      // buboes
      p.circle(26, 26, 2.5, PAL.bile, { shade: 0.2 }); p.px(26, 26, PAL.venom);
      p.circle(14, 36, 2, PAL.rot);
      // left arm hanging forward, reaching
      p.path([[14, 23], [8, 30], [4, 37]], SK, 3);
      p.path([[4, 37], [1, 40]], SK, 1); p.path([[4, 37], [3, 41]], SK, 1); p.path([[4, 37], [6, 41]], SK, 1);
      // right arm limp
      p.path([[29, 24], [33, 32], [32, 39]], '#868a72', 3);
      // head, thrust forward, jaw slack
      p.ellipse(15, 15, 7, 7, SK, { shade: 0.3 });
      p.poly([[19, 8], [25, 12], [25, 20], [19, 20]], '#5a4a36');
      p.ellipse(11, 20, 3, 3.5, PAL.void);
      p.path([[11, 22], [10, 27], [11, 31]], PAL.venom, 1);
      p.px(10, 33, PAL.bile);
      p.ellipse(11, 13, 2, 2, PAL.void); p.px(11, 13, PAL.sick);
      p.ellipse(17, 12, 1.6, 1.8, PAL.void);
      p.line(8, 11, 12, 9, PAL.void);
      p.speckle(PAL.bile, 0.07, 3, [8, 8, 22, 24]);
      p.speckle(PAL.rot, 0.05, 9, [10, 18, 32, 42]);
    },
  },
  en_ash_cultist: {
    w: 36, h: 56,
    draw(p) {
      const R = '#7d7873', RD = '#57524f';
      p.poly([[12, 14], [24, 12], [30, 30], [33, 54], [5, 54], [8, 30]], R, { shade: 0.3 });
      for (let i = 0; i < 4; i++) p.tri(7 + i * 7, 54, 10 + i * 7, 49, 13 + i * 7, 54, RD);
      p.rect(9, 32, 22, 2, PAL.bark);
      p.path([[14, 33], [13, 40]], PAL.bark, 1);
      p.poly([[10, 4], [19, 0], [26, 6], [26, 18], [11, 18], [8, 11]], R, { shade: 0.3 });
      p.ellipse(14, 12, 4.5, 5.5, PAL.bone, { shade: 0.2 });
      p.ellipse(13, 11, 1.4, 1.6, PAL.void); p.ellipse(16, 11, 1.2, 1.6, PAL.void);
      p.line(12, 15, 16, 15, PAL.ash);
      p.path([[22, 20], [15, 26], [8, 26]], RD, 4);
      p.line(8, 30, 3, 16, PAL.bark, 2);
      p.circle(3, 14, 2.5, PAL.ember);
      p.glow(3, 13, PAL.flame, 3);
      p.px(2, 10, PAL.ash); p.px(4, 7, PAL.stone); p.px(3, 4, PAL.ash);
      p.speckle(PAL.fog, 0.04, 5, [6, 14, 32, 54]);
    },
  },
  en_marcher_cutthroat: {
    w: 38, h: 54,
    draw(p) {
      const L = PAL.leather, LD = '#5a4129', H = '#4a3c30';
      p.path([[19, 34], [13, 44], [9, 53]], LD, 4);
      p.path([[24, 34], [29, 43], [31, 53]], LD, 4);
      p.rect(7, 51, 6, 3, PAL.night); p.rect(29, 51, 6, 3, PAL.night);
      p.poly([[13, 16], [27, 15], [30, 28], [28, 38], [14, 38], [11, 27]], L, { shade: 0.3 });
      p.line(13, 30, 28, 30, PAL.night, 2);
      p.path([[26, 19], [32, 27], [34, 31]], LD, 3);
      p.line(34, 31, 37, 27, PAL.steel, 1);
      p.poly([[12, 6], [21, 2], [27, 8], [26, 17], [13, 18], [10, 12]], H, { shade: 0.3 });
      p.ellipse(15, 11, 3.5, 4, PAL.skin, { shade: 0.2 });
      p.poly([[10, 12], [20, 12], [21, 17], [11, 18]], PAL.blood, { shade: 0.3 });
      p.poly([[19, 15], [24, 20], [21, 23]], PAL.blood);
      p.line(12, 10, 16, 10, PAL.void);
      p.px(13, 10, PAL.parch);
      p.path([[15, 20], [9, 26], [5, 27]], L, 3);
      p.poly([[0, 25], [5, 25], [5, 27], [0, 27]], PAL.steel);
      p.line(0, 25, 4, 25, PAL.frost);
    },
  },
  en_marcher_archer: {
    w: 44, h: 56,
    draw(p) {
      const C = '#4f5446', CD = '#383c32';
      p.path([[25, 36], [22, 46], [21, 55]], CD, 4);
      p.path([[30, 36], [33, 46], [34, 55]], CD, 4);
      p.poly([[30, 12], [36, 8], [39, 10], [34, 24]], PAL.bark);
      for (let i = 0; i < 3; i++) p.line(34 + i * 2, 9 - i, 31 + i * 2, 4 - i, PAL.bone);
      p.poly([[21, 14], [33, 14], [36, 30], [34, 40], [20, 40], [18, 28]], C, { shade: 0.3 });
      p.poly([[19, 34], [36, 34], [38, 44], [17, 44]], CD);
      p.line(19, 28, 34, 28, PAL.leather, 2);
      p.poly([[20, 4], [28, 1], [33, 6], [32, 15], [21, 15], [18, 10]], C, { shade: 0.3 });
      p.ellipse(22, 10, 3, 3.5, PAL.skin, { shade: 0.2 });
      p.line(20, 9, 23, 9, PAL.void);
      p.path([[8, 2], [4, 12], [3, 24], [4, 36], [8, 46]], PAL.wood, 2);
      p.line(8, 2, 8, 46, PAL.fog, 1);
      p.path([[21, 18], [14, 21], [6, 23]], C, 3);
      p.path([[28, 19], [22, 22], [16, 24]], C, 3);
      p.line(1, 24, 17, 24, PAL.bone, 1);
      p.poly([[0, 24], [3, 22], [3, 26]], PAL.steel);
      p.px(16, 23, PAL.blood); p.px(16, 25, PAL.blood);
    },
  },
  en_bog_leech: {
    w: 46, h: 26,
    draw(p) {
      const B = '#3f3a26', BL = '#5c5434';
      p.ellipse(30, 17, 15, 7, B, { shade: 0.35 });
      p.ellipse(15, 13, 9, 7, B, { shade: 0.35 });
      p.ellipse(7, 9, 6, 6, B, { shade: 0.3 });
      for (let i = 0; i < 6; i++) p.line(12 + i * 5, 10 + (i > 1 ? 3 : 0), 14 + i * 5, 23, '#2c2818');
      p.path([[12, 19], [30, 22], [44, 19]], BL, 2);
      p.path([[18, 9], [30, 11], [40, 13]], '#7c7348', 1);
      p.circle(4, 9, 4.5, PINK, { shade: 0.2 });
      p.circle(4, 9, 2.5, PAL.gore);
      for (let a = 0; a < 8; a++) p.px(Math.round(4 + Math.cos(a * 0.785) * 3.4), Math.round(9 + Math.sin(a * 0.785) * 3.4), PAL.bone);
      p.px(4, 9, PAL.void);
      p.px(15, 9, PAL.frost); p.px(28, 12, PAL.frost); p.px(9, 5, PAL.frost);
    },
  },
  en_grave_robber: {
    w: 42, h: 52,
    draw(p) {
      const T = '#5b4a38', TD = '#43362a';
      p.path([[18, 36], [14, 44], [13, 51]], TD, 4);
      p.path([[24, 36], [27, 44], [28, 51]], TD, 4);
      p.ellipse(32, 26, 8, 10, '#6e5f45', { shade: 0.3 });
      p.line(28, 17, 34, 16, PAL.bark, 2);
      p.px(33, 23, PAL.gold); p.px(35, 28, PAL.gold); p.px(30, 30, PAL.candle);
      p.poly([[12, 18], [26, 16], [30, 30], [27, 39], [12, 39], [9, 28]], T, { shade: 0.3 });
      p.line(10, 30, 28, 30, PAL.night, 2);
      p.line(14, 31, 14, 36, PAL.iron); p.circle(14, 38, 2.5, PAL.flame); p.glow(14, 38, PAL.candle, 3);
      p.line(36, 2, 6, 34, PAL.wood, 2);
      p.poly([[33, 0], [40, 2], [39, 8], [33, 6]], PAL.iron, { shade: 0.3 });
      p.ellipse(15, 12, 5, 5.5, PAL.skin, { shade: 0.25 });
      p.poly([[10, 14], [16, 13], [17, 20], [12, 20]], PAL.ash);
      p.ellipse(17, 7, 10, 2.5, TD, { shade: 0.3 });
      p.poly([[11, 6], [16, 1], [23, 3], [23, 7]], TD);
      p.line(11, 11, 14, 11, PAL.void); p.px(12, 11, PAL.parch);
      p.px(10, 13, PAL.skin);
      p.path([[14, 22], [9, 28], [7, 33]], T, 3);
      p.speckle(MUD, 0.08, 4, [9, 30, 30, 52]);
    },
  },
  en_wight_militiaman: {
    w: 44, h: 60,
    draw(p) {
      const T = '#4a5260', TD = '#363c48';
      p.line(34, 0, 26, 58, PAL.wood, 2);
      p.poly([[33, 0], [36, 0], [35, 8]], PAL.steel);
      p.path([[21, 40], [18, 50], [17, 59]], PAL.bone, 2);
      p.path([[26, 40], [29, 50], [30, 59]], PAL.bone, 2);
      p.poly([[16, 18], [30, 17], [33, 32], [31, 44], [15, 44], [13, 30]], T, { shade: 0.3 });
      for (let i = 0; i < 4; i++) p.tri(14 + i * 5, 44, 16 + i * 5, 40, 18 + i * 5, 44, TD);
      p.line(15, 33, 31, 33, PAL.bark, 2);
      p.path([[29, 21], [33, 26], [31, 30]], PAL.bone, 2);
      p.ellipse(19, 12, 6, 6, PAL.bone, { shade: 0.3 });
      p.rect(13, 14, 7, 4, PAL.bone, { shade: 0.2 });
      for (let i = 0; i < 3; i++) p.px(14 + i * 2, 16, PAL.void);
      p.ellipse(16, 11, 1.6, 1.8, PAL.void); p.ellipse(21, 11, 1.4, 1.8, PAL.void);
      p.glow(16, 11, PAL.spirit, 2);
      p.ellipse(19, 7, 11, 2.5, RUST, { shade: 0.35 });
      p.ellipse(20, 5, 7, 4, RUST, { shade: 0.35 });
      p.speckle(PAL.ember, 0.12, 2, [8, 1, 32, 10]);
      p.circle(10, 32, 10, PAL.wood, { shade: 0.35 });
      p.ring(10, 32, 10, PAL.iron, 2);
      p.circle(10, 32, 3, RUST, { shade: 0.3 });
      p.line(4, 26, 16, 38, PAL.bark);
      p.speckle(PAL.bark, 0.08, 6, [0, 22, 20, 42]);
    },
  },
  en_rat_swarm: {
    w: 52, h: 34,
    draw(p) {
      const R1 = '#5a5048', R2 = '#403934', R3 = '#6c6157';
      // Heap base, then individual rats on top so they read as bodies, not a blob.
      p.ellipse(27, 27, 23, 6, R2, { shade: 0.25 });
      ratFig(p, 2, 26, 1.4, R1);
      ratFig(p, 14, 28, 1.3, R3);
      ratFig(p, 26, 27, 1.3, R1);
      ratFig(p, 36, 28, 1.2, R3);
      ratFig(p, 6, 19, 1.4, R3);
      ratFig(p, 19, 20, 1.5, R1);
      ratFig(p, 32, 19, 1.3, R2);
      ratFig(p, 11, 11, 1.4, R1);
      ratFig(p, 24, 11, 1.5, R3);
      ratFig(p, 18, 3, 1.3, R2);
      for (const [x, y] of [[4, 25], [8, 18], [13, 10], [20, 19], [26, 10], [20, 2], [33, 18], [28, 26]]) p.glow(x, y, '#e0402e', 1);
    },
  },

  // ---------------------------------------------------------------- elites
  en_sir_rendrick: {
    w: 66, h: 78,
    draw(p) {
      const A = '#6a6c6e', AD = '#4a4c50', SC = '#5a2430';
      p.path([[38, 2], [36, 8], [37, 14]], '#8a7a50', 2);
      p.line(38, 0, 40, 3, '#8a7a50'); p.line(37, 0, 35, 2, '#8a7a50');
      p.path([[30, 52], [25, 64], [22, 77]], AD, 6);
      p.path([[40, 52], [45, 64], [47, 77]], AD, 6);
      p.rect(17, 74, 9, 4, AD); p.rect(44, 74, 9, 4, AD);
      p.poly([[22, 24], [46, 22], [50, 40], [47, 58], [23, 58], [20, 40]], SC, { shade: 0.3 });
      for (let i = 0; i < 5; i++) p.tri(22 + i * 5, 58, 25 + i * 5, 52, 28 + i * 5, 58, '#3a1820');
      p.poly([[24, 24], [44, 23], [46, 36], [26, 37]], A, { shade: 0.35 });
      p.ellipse(46, 26, 8, 6, A, { shade: 0.35 });
      p.path([[47, 29], [53, 40], [52, 50]], AD, 5);
      p.line(22, 44, 48, 44, PAL.bark, 2);
      p.circle(34, 44, 2, PAL.iron);
      p.path([[26, 30], [18, 38], [14, 42]], A, 5);
      p.ellipse(22, 25, 6, 5, A, { shade: 0.35 });
      p.poly([[27, 8], [40, 9], [41, 22], [27, 22], [25, 15]], A, { shade: 0.35 });
      p.line(26, 14, 34, 15, PAL.void, 2);
      p.glow(28, 14, PAL.ember, 2);
      for (let i = 0; i < 3; i++) p.px(28 + i * 2, 18, PAL.void);
      p.path([[30, 22], [34, 23], [39, 21], [38, 15]], '#8a7a50', 2);
      p.speckle(RUST, 0.18, 11, [14, 8, 56, 60]);
      p.poly([[10, 40], [16, 38], [16, 46], [9, 46]], PAL.bark);
      p.poly([[3, 44], [17, 42], [15, 50], [2, 74], [0, 72]], PAL.iron, { shade: 0.35 });
      p.poly([[0, 72], [2, 74], [10, 64], [8, 62]], PAL.steel);
      p.line(4, 46, 14, 44, PAL.steel);
      p.path([[50, 46], [55, 54], [53, 62], [56, 70]], PAL.iron, 1);
      p.path([[14, 46], [12, 56], [16, 62]], PAL.iron, 1);
    },
  },
  en_bog_mother: {
    w: 80, h: 64,
    draw(p) {
      const B = '#3e3a24', BD = '#2a2716', BL = '#5e5636';
      p.ellipse(44, 58, 36, 6, PAL.deep);
      p.ellipse(44, 57, 30, 4, PAL.water);
      p.ellipse(50, 40, 26, 18, B, { shade: 0.35 });
      p.ellipse(28, 34, 16, 16, B, { shade: 0.35 });
      p.ellipse(18, 24, 12, 12, B, { shade: 0.3 });
      for (let i = 0; i < 7; i++) p.path([[24 + i * 7, 22 + (i < 2 ? 4 : 0)], [26 + i * 7, 40], [24 + i * 7, 56]], BD, 1);
      p.path([[30, 48], [52, 54], [72, 48]], BL, 2);
      p.path([[30, 20], [48, 22], [66, 28]], '#7c7348', 1);
      p.circle(13, 24, 10, PINK, { shade: 0.25 });
      p.circle(13, 24, 7, '#8a4a4a');
      p.circle(13, 24, 4.5, PAL.gore);
      p.circle(13, 24, 2, PAL.void);
      for (let a = 0; a < 14; a++) p.px(Math.round(13 + Math.cos(a * 0.449) * 8.5), Math.round(24 + Math.sin(a * 0.449) * 8.5), PAL.bone);
      for (let a = 0; a < 10; a++) p.px(Math.round(13 + Math.cos(a * 0.628 + 0.3) * 5.5), Math.round(24 + Math.sin(a * 0.628 + 0.3) * 5.5), PAL.parch);
      leechFig(p, 38, 30, 9, '#2c2818');
      leechFig(p, 56, 26, 8, '#2c2818');
      leechFig(p, 62, 44, 9, '#2c2818');
      leechFig(p, 44, 46, 7, '#2c2818');
      p.px(30, 26, PAL.frost); p.px(52, 28, PAL.frost); p.px(20, 15, PAL.frost); p.px(66, 36, PAL.frost);
      p.path([[73, 56], [74, 40], [72, 32]], PAL.moss, 1);
      p.path([[76, 56], [78, 44]], PAL.moss, 1);
      p.path([[4, 56], [3, 44], [5, 38]], PAL.moss, 1);
    },
  },
  en_choir_precentor: {
    w: 40, h: 62,
    draw(p) {
      const R = '#827d77', RD = '#5a5551';
      p.poly([[14, 16], [27, 14], [33, 34], [36, 61], [6, 61], [9, 34]], R, { shade: 0.3 });
      for (let i = 0; i < 4; i++) p.tri(7 + i * 7, 61, 10 + i * 7, 55, 13 + i * 7, 61, RD);
      p.poly([[17, 16], [23, 16], [24, 58], [16, 58]], PAL.wine, { shade: 0.2 });
      for (let i = 0; i < 4; i++) p.tri(18, 22 + i * 9, 22, 22 + i * 9, 20, 26 + i * 9, PAL.gold);
      p.poly([[12, 6], [20, 0], [27, 8], [27, 18], [12, 18], [9, 11]], R, { shade: 0.3 });
      p.poly([[14, 2], [20, -1], [25, 3], [20, 6]], PAL.bone);
      p.ellipse(15, 12, 4.5, 5.5, PAL.bone, { shade: 0.2 });
      p.ellipse(13, 11, 1.4, 1.6, PAL.void); p.ellipse(16, 11, 1.2, 1.6, PAL.void);
      p.ellipse(14, 15, 1.5, 1, PAL.void);
      p.path([[14, 22], [8, 16], [6, 8]], R, 3);
      p.ellipse(6, 7, 2, 2, PAL.bone);
      p.path([[24, 22], [18, 28], [11, 29]], RD, 3);
      p.poly([[3, 27], [12, 25], [13, 33], [4, 34]], PAL.parch, { shade: 0.2 });
      p.line(8, 26, 8, 33, PAL.bark);
      p.line(4, 29, 7, 29, PAL.ash); p.line(9, 28, 12, 28, PAL.ash);
      p.speckle(PAL.fog, 0.04, 7, [6, 16, 36, 60]);
    },
  },
  en_choir_thurifer: {
    w: 44, h: 58,
    draw(p) {
      const R = '#7d7873', RD = '#57524f';
      p.poly([[18, 14], [30, 12], [36, 30], [39, 57], [11, 57], [14, 30]], R, { shade: 0.3 });
      for (let i = 0; i < 4; i++) p.tri(12 + i * 7, 57, 15 + i * 7, 51, 18 + i * 7, 57, RD);
      p.rect(15, 32, 22, 2, PAL.bark);
      p.poly([[16, 4], [25, 0], [32, 6], [32, 18], [17, 18], [14, 11]], R, { shade: 0.3 });
      p.ellipse(20, 12, 4.5, 5.5, PAL.bone, { shade: 0.2 });
      p.line(17, 11, 20, 11, PAL.void); p.line(17, 15, 21, 15, PAL.ash);
      p.path([[19, 20], [13, 24], [10, 22]], RD, 3);
      p.path([[10, 22], [7, 30], [6, 38]], PAL.iron, 1);
      p.circle(6, 41, 4, PAL.gold, { shade: 0.35 });
      p.rect(3, 40, 7, 1, '#7a5e1a');
      p.glow(6, 43, PAL.ember, 3);
      p.circle(4, 34, 2, PAL.stone); p.circle(2, 28, 2.5, PAL.ash); p.circle(4, 22, 3, '#4a474c');
      p.circle(1, 15, 2, PAL.ash);
      p.speckle(PAL.fog, 0.04, 8, [12, 14, 38, 56]);
    },
  },
  en_choir_penitent: {
    w: 40, h: 56,
    draw(p) {
      const R = '#7d7873', RD = '#57524f', SK = '#b09080';
      p.poly([[12, 32], [30, 32], [34, 55], [8, 55]], R, { shade: 0.3 });
      for (let i = 0; i < 4; i++) p.tri(9 + i * 6, 55, 12 + i * 6, 50, 15 + i * 6, 55, RD);
      p.poly([[13, 14], [27, 13], [30, 32], [12, 33], [11, 24]], SK, { shade: 0.3 });
      for (let i = 0; i < 4; i++) p.line(16 + i * 3, 16, 14 + i * 3, 30, PAL.blood);
      p.line(12, 32, 30, 31, PAL.iron, 2);
      p.path([[26, 15], [31, 24], [29, 30]], SK, 3);
      p.poly([[12, 3], [21, 0], [27, 6], [27, 16], [13, 16], [10, 10]], R, { shade: 0.3 });
      p.ellipse(15, 11, 4, 5, PAL.bone, { shade: 0.2 });
      p.line(13, 10, 16, 10, PAL.void); p.px(14, 14, PAL.void);
      p.path([[15, 18], [9, 12], [7, 6]], SK, 3);
      p.line(7, 7, 6, 2, PAL.bark, 2);
      p.path([[6, 2], [2, 6], [1, 12]], PAL.leather, 1);
      p.path([[6, 2], [3, 8], [4, 14]], PAL.leather, 1);
      p.path([[6, 2], [5, 9], [7, 15]], PAL.leather, 1);
      p.px(1, 12, PAL.iron); p.px(4, 14, PAL.iron); p.px(7, 15, PAL.iron);
      p.path([[29, 31], [33, 40], [31, 48], [35, 54]], PAL.iron, 1);
    },
  },

  // ---------------------------------------------------------------- bosses
  en_bragg: {
    w: 84, h: 100,
    draw(p) {
      const P = '#6a6460', PD = '#48433f', L = '#5c4330', LD = '#3e2d20', SK = '#b08a6c';
      p.path([[40, 70], [34, 84], [30, 98]], LD, 9);
      p.path([[54, 70], [60, 84], [62, 98]], LD, 9);
      p.rect(23, 94, 13, 6, PAL.night); p.rect(58, 94, 13, 6, PAL.night);
      p.poly([[24, 30], [66, 28], [74, 50], [70, 76], [26, 76], [20, 52]], L, { shade: 0.3 });
      p.ellipse(46, 58, 20, 14, '#6a5038', { shade: 0.3 });
      p.speckle(PAL.iron, 0.25, 21, [26, 32, 68, 52]);
      p.poly([[24, 50], [70, 48], [70, 54], [24, 56]], PAL.blood, { shade: 0.3 });
      p.rect(42, 49, 7, 7, PAL.gold, { shade: 0.3 });
      p.poly([[18, 22], [44, 14], [74, 20], [80, 40], [72, 48], [64, 34], [30, 34], [20, 44], [14, 34]], P, { shade: 0.35 });
      for (let i = 0; i < 8; i++) p.line(18 + i * 8, 26 + (i % 2) * 3, 16 + i * 8, 34 + (i % 2) * 4, PD);
      p.path([[66, 36], [74, 52], [72, 66]], L, 9);
      p.path([[72, 66], [70, 76], [64, 86], [58, 92]], PAL.iron, 1);
      p.path([[58, 92], [52, 96], [46, 94]], PAL.iron, 1);
      p.ellipse(32, 18, 10, 10, SK, { shade: 0.3 });
      p.poly([[22, 20], [36, 20], [38, 34], [30, 38], [23, 32]], '#3a2a20', { shade: 0.2 });
      p.line(25, 22, 30, 22, PAL.void, 2);
      p.px(26, 21, PAL.parch);
      p.line(33, 12, 30, 22, '#8a5a4a');
      p.poly([[20, 12], [34, 4], [50, 8], [52, 20], [40, 16], [28, 14]], P, { shade: 0.35 });
      p.poly([[18, 12], [22, 6], [26, 11]], PD);
      p.tri(30, 6, 33, 0, 36, 6, PD);
      p.poly([[14, 13], [22, 10], [24, 15], [16, 17]], PD);
      p.px(17, 13, PAL.bone); p.px(20, 15, PAL.bone);
      p.glow(24, 11, PAL.ember, 1);
      p.path([[26, 38], [16, 50], [12, 56]], L, 9);
      p.ellipse(12, 57, 5, 5, SK, { shade: 0.3 });
      p.rect(10, 58, 4, 10, PAL.bark);
      p.poly([[0, 34], [14, 34], [16, 58], [2, 58]], PAL.iron, { shade: 0.35 });
      p.line(1, 34, 1, 58, PAL.steel, 2);
      p.circle(10, 39, 2, PAL.void);
      p.speckle(PAL.blood, 0.12, 4, [0, 40, 12, 58]);
    },
  },
  en_hanged_sheriff: {
    w: 72, h: 104,
    draw(p) {
      const C = '#2c2a33', CD = '#1d1b22', SK = '#a8a898', R = '#8a7a50';
      p.path([[44, 0], [42, 10], [40, 18]], R, 2);
      p.line(44, 0, 46, 2, R); p.line(44, 0, 42, 1, R);
      p.path([[34, 74], [31, 88], [30, 102]], CD, 6);
      p.path([[44, 74], [47, 88], [48, 102]], CD, 6);
      p.rect(25, 99, 9, 5, PAL.void); p.rect(45, 99, 9, 5, PAL.void);
      p.poly([[26, 30], [50, 28], [56, 52], [60, 90], [20, 90], [22, 52]], C, { shade: 0.3 });
      p.poly([[20, 84], [26, 76], [30, 90]], CD); p.poly([[52, 80], [60, 90], [48, 90]], CD);
      p.poly([[34, 30], [44, 30], [42, 60], [36, 60]], '#5a4a3a', { shade: 0.2 });
      p.path([[28, 34], [38, 46], [50, 34]], PAL.gold, 1);
      p.path([[29, 35], [38, 47], [49, 35]], '#7a5e1a', 1);
      p.circle(38, 48, 3, PAL.gold, { shade: 0.3 });
      p.px(38, 48, PAL.candle);
      p.line(22, 62, 56, 62, PAL.bark, 2);
      p.rect(36, 61, 4, 3, PAL.steel);
      p.path([[50, 34], [56, 50], [56, 64]], C, 5);
      p.path([[56, 64], [58, 70], [55, 76]], R, 2);
      p.ring(56, 80, 5, R, 2);
      p.path([[30, 26], [32, 30], [42, 30], [43, 22]], R, 2);
      p.ellipse(34, 19, 8, 9, SK, { shade: 0.3 });
      p.ellipse(30, 18, 2, 2.2, PAL.void); p.ellipse(36, 17, 2, 2.2, PAL.void);
      p.glow(30, 18, PAL.candle, 2); p.glow(36, 17, PAL.candle, 1);
      p.poly([[27, 23], [34, 22], [33, 27], [28, 27]], '#6a6a5c');
      for (let i = 0; i < 4; i++) p.px(28 + i * 1.5, 24, PAL.void);
      p.ellipse(35, 10, 17, 3.5, CD, { shade: 0.3 });
      p.poly([[25, 10], [28, 0], [42, -1], [45, 10]], C, { shade: 0.3 });
      p.rect(27, 7, 17, 2, '#5a4a3a');
      p.path([[28, 34], [18, 44], [12, 48]], C, 5);
      p.ellipse(12, 49, 3, 3, SK);
      p.poly([[2, 40], [12, 42], [10, 70], [0, 68]], PAL.parch, { shade: 0.2 });
      p.rect(1, 38, 12, 3, PAL.bone, { shade: 0.3 });
      p.rect(0, 67, 11, 3, PAL.bone, { shade: 0.3 });
      for (let i = 0; i < 6; i++) p.line(3, 46 + i * 3.5, 9, 46.5 + i * 3.5, PAL.ash);
      p.circle(6, 64, 2, PAL.blood);
    },
  },
  en_mother_of_rats: {
    w: 110, h: 92,
    draw(p) {
      const F = '#b08a84', FD = '#8a6460', FL = '#c8a49a';
      p.ellipse(56, 86, 52, 6, PAL.night);
      p.path([[96, 72], [106, 66], [108, 52], [102, 44], [94, 48]], FD, 3);
      p.ellipse(64, 54, 38, 30, F, { shade: 0.35 });
      p.ellipse(40, 48, 22, 24, F, { shade: 0.35 });
      p.path([[78, 76], [84, 86], [80, 90]], FD, 7);
      p.path([[40, 70], [34, 84], [28, 88]], FD, 7);
      for (let i = 0; i < 5; i++) p.circle(46 + i * 9, 76 - (i % 2) * 2, 2.5, FL);
      p.speckle(PAL.rot, 0.04, 13, [30, 28, 100, 80]);
      p.speckle(PAL.gore, 0.03, 17, [30, 28, 100, 80]);
      p.ellipse(58, 40, 3, 2, PAL.bile); p.ellipse(78, 58, 4, 2.5, PAL.bile); p.ellipse(50, 62, 2.5, 2, PAL.bile);
      p.poly([[30, 26], [16, 30], [2, 42], [4, 50], [16, 52], [32, 50]], F, { shade: 0.3 });
      p.ellipse(22, 32, 8, 5, FD);
      p.circle(25, 22, 6, FD); p.circle(25, 22, 3.5, PINK);
      p.circle(14, 36, 3.5, '#d8d0c0'); p.circle(14, 36, 2, '#a8b0a0');
      p.rect(4, 49, 3, 7, PAL.bone); p.rect(8, 49, 3, 7, PAL.bone);
      p.line(6, 49, 6, 56, '#a89870');
      p.poly([[0, 42], [5, 40], [6, 45], [1, 46]], PINK);
      p.px(0, 44, PAL.void);
      p.line(2, 46, 14, 50, PAL.gore);
      for (let i = 0; i < 3; i++) { p.line(2, 41 + i, -2, 38 + i * 2, PAL.fog); }
      const RAT = '#4a423c', RAT2 = '#5c5249';
      ratFig(p, 50, 28, 1.3, RAT);
      ratFig(p, 70, 26, 1.2, RAT2);
      ratFig(p, 82, 36, 1.1, RAT);
      ratFig(p, 62, 40, 1, RAT2);
      ratFig(p, 86, 52, 1.2, RAT);
      ratFig(p, 44, 80, 1.2, RAT);
      ratFig(p, 62, 82, 1.1, RAT2);
      ratFig(p, 14, 80, 1.3, RAT);
    },
  },
});
