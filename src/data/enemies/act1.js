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
    desc: () => 'Devours her own leeches to heal twice their remaining HP. Kill them before she feeds.',
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
    desc: (n) => `The Noose deals ${n} more damage for each card you played this turn. Every Warrant left in your hand gives him 2 Might.`,
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
    text: 'Answer the charge. If this is in your hand at end of turn, the Sheriff gains 2 Might.',
    play() {},
    endTurnInHand(g) {
      const s = g.enemies.find((x) => x.id === 'hanged_sheriff');
      if (s) g.apply(s, 'might', 2, s);
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
    g.spawn('rat_swarm', { minion: true, front: true, hp: hp || int(g.crng, 9, 11) });
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
      bite: { name: 'Bite', intent: 'atk', dmg: 5 },
      worry: { name: 'Worry', intent: 'atk', dmg: 2, times: 2 },
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
      peck: { name: 'Peck', intent: 'atk', dmg: 2, times: 2 },
      eyes: { name: 'Go for the Eyes', intent: 'atkdebuff', dmg: 3, fx(g, e) { g.apply(g.player, 'weak', 1, e); } },
    },
    ai(g, e) { return g.aiPick(e, { peck: 55, eyes: 45 }, { peck: 2, eyes: 1 }); },
  },
  {
    id: 'coughing_dead', name: 'Coughing Dead', kind: 'normal', act: 1, hp: [26, 30], sprite: 'en_coughing_dead',
    desc: 'A plague-villager who should have died years ago. The Blight did not kill it. It only stopped it.',
    init(g, e) { g.addStatus(e, 'stopped', 1, { silent: true }); },
    moves: {
      lurch: { name: 'Lurch', intent: 'atk', dmg: 8 },
      cough: { name: 'Wet Cough', intent: 'atkdebuff', dmg: 2, fx(g, e) { g.apply(g.player, 'rot', 3, e); } },
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
    id: 'ash_cultist', name: 'Ash Cultist', kind: 'normal', act: 1, hp: [36, 40], sprite: 'en_ash_cultist',
    desc: 'They smear their faces with the ash of Ashfall and call it sacrament. Every prayer makes the next blow heavier.',
    moves: {
      rite: { name: 'Ashen Rite', intent: 'buff', fx(g, e) { g.apply(e, 'rite', 2, e); } },
      lash: { name: 'Cinder Lash', intent: 'atk', dmg: 5 },
      scatter: { name: 'Scatter Ash', intent: 'atkdebuff', dmg: 3, fx(g) { g.addCard('ash', 'discard'); } },
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
      stab: { name: 'Stab', intent: 'atk', dmg: 7 },
      straps: { name: 'Cut the Straps', intent: 'atkdebuff', dmg: 4, fx(g, e) { g.apply(g.player, 'frail', 2, e); } },
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
      loose: { name: 'Loose', intent: 'atk', dmg: 13 },
      pin: { name: 'Pinning Shot', intent: 'atkdebuff', dmg: 4, fx(g, e) { g.apply(g.player, 'dread', 1, e); } },
    },
    ai(g, e) { return step(e, ['pavise', 'loose', 'pin']); },
  },
  {
    id: 'bog_leech', name: 'Bog Leech', kind: 'normal', act: 1, hp: [15, 18], sprite: 'en_bog_leech',
    desc: 'Fen-leeches the length of a man\'s arm. They grow fat on the drowned, and fatter on the living.',
    init(g, e) { g.addStatus(e, 'bloodsucker', 1, { silent: true }); },
    moves: {
      latch: { name: 'Latch On', intent: 'atk', dmg: 6 },
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
      pilfer: { name: 'Pilfer', intent: 'atk', dmg: 6, fx(g, e) { steal(g, e, 15); } },
      shovel: { name: 'Shovel to the Skull', intent: 'atk', dmg: 9 },
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
      thrust: { name: 'Pike Thrust', intent: 'atk', dmg: 9 },
      line: {
        name: 'Hold the Line', intent: 'def',
        fx(g, e) { for (const x of g.enemies) g.gainBlock(x, x === e ? 6 : 8, { raw: true }); },
      },
      bash: { name: 'Shield-Bash', intent: 'atkdef', dmg: 5, fx(g, e) { g.gainBlock(e, 5, { raw: true }); } },
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
      gnaw: { name: 'Gnaw', intent: 'atkdebuff', dmg: 1, times: 3 },
      swarm: { name: 'Swarm Over', intent: 'atkdebuff', dmg: 4 },
    },
    ai(g, e) { return g.aiPick(e, { gnaw: 60, swarm: 40 }, { gnaw: 2, swarm: 2 }); },
  },
  {
    id: 'war_hound', name: 'War Hound', kind: 'normal', act: 1, hp: [15, 17], sprite: 'en_war_hound',
    desc: 'Bragg\'s mastiffs, collared in nails and fed on men. They fight harder over their brothers\' bodies.',
    init(g, e) { g.addStatus(e, 'pack', 3, { silent: true }); },
    moves: {
      rend: { name: 'Rend', intent: 'atk', dmg: 6 },
      savage: { name: 'Savage', intent: 'atk', dmg: 3, times: 2 },
    },
    ai(g, e) { return g.aiPick(e, { rend: 55, savage: 45 }, { rend: 2, savage: 2 }); },
  },

  // ============================================================ ELITES
  {
    id: 'sir_rendrick', name: 'Sir Rendrick', kind: 'elite', act: 1, hp: [98, 104], sprite: 'en_sir_rendrick',
    desc: 'Hanged at the crossroads for cowardice, eighty years ago. The rope never let him go, so he took it with him.',
    init(g, e) { g.addStatus(e, 'hanged_man', 3, { silent: true }); },
    moves: {
      chain: { name: 'Strangling Chain', intent: 'atkdebuff', dmg: 6, fx(g, e) { g.apply(g.player, 'choked', 2, e); } },
      cleave: { name: 'Headsman\'s Cleave', intent: 'atk', dmg: 15 },
      swing: { name: 'Gallows Swing', intent: 'atk', dmg: 4, times: 3 },
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
    id: 'bog_mother', name: 'The Bog Mother', kind: 'elite', act: 1, hp: [86, 92], sprite: 'en_bog_mother', leader: true,
    desc: 'Something vast and soft lies under the fen-pools, and the leeches are its children. It loves them. It is also very hungry.',
    init(g, e) { g.addStatus(e, 'brood_hunger', 1, { silent: true }); },
    moves: {
      brood: { name: 'Spawn Brood', intent: 'summon', fx(g) { spawnLeeches(g, 2); } },
      grasp: {
        name: 'Mire Grasp', intent: 'atkdebuff', dmg: 8,
        fx(g) { g.addCard('mire', 'draw'); g.addCard('mire', 'draw'); },
      },
      smother: { name: 'Smother', intent: 'atk', dmg: 13 },
      devour: {
        name: 'Devour Young', intent: 'heal',
        fx(g, e) {
          const kids = g.enemies.filter((x) => x.id === 'bog_leech');
          if (!kids.length) return;
          const fat = kids.reduce((m, x) => (x.hp > m.hp ? x : m));
          const heal = fat.hp * 2;
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
    init(g, e) { g.addStatus(e, 'chorus', 3, { silent: true }); },
    moves: {
      hymn: {
        name: 'Hymn of Cinders', intent: 'buff',
        fx(g, e) { for (const x of g.enemies) if (x.st.chorus) g.apply(x, 'might', 2, e); },
      },
      psalm: { name: 'Cinder Psalm', intent: 'atk', dmg: 7 },
    },
    ai(g, e) {
      if (e.turns === 0) return 'hymn';
      return g.aiPick(e, { psalm: 60, hymn: 40 }, { psalm: 2, hymn: 1 });
    },
  },
  {
    id: 'choir_thurifer', name: 'Thurifer of Ash', kind: 'elite', act: 1, hp: [30, 34], sprite: 'en_choir_thurifer',
    desc: 'Her censer burns the bones of the unshriven. The smoke gets into the lungs, and the mind.',
    init(g, e) { g.addStatus(e, 'chorus', 3, { silent: true }); },
    moves: {
      censer: { name: 'Censer Swing', intent: 'atk', dmg: 6 },
      smoke: {
        name: 'Choking Smoke', intent: 'debuff',
        fx(g, e) { g.addCard('ash', 'draw'); g.addCard('ash', 'draw'); g.apply(g.player, 'weak', 1, e); },
      },
    },
    ai(g, e) {
      if (e.turns === 0) return 'smoke';
      return g.aiPick(e, { censer: 60, smoke: 40 }, { censer: 2, smoke: 1 });
    },
  },
  {
    id: 'choir_penitent', name: 'Penitent of Ash', kind: 'elite', act: 1, hp: [28, 32], sprite: 'en_choir_penitent',
    desc: 'He scourges himself for the sin of outliving his King, and every drop he spills is a prayer for his brothers.',
    init(g, e) { g.addStatus(e, 'chorus', 3, { silent: true }); },
    moves: {
      scourge: {
        name: 'Scourge', intent: 'def',
        fx(g, e) {
          g.loseHp(e, 3, { type: 'hploss' });
          for (const x of g.enemies) if (x !== e) g.gainBlock(x, 9, { raw: true });
          g.gainBlock(e, 4, { raw: true });
        },
      },
      flail: { name: 'Flail', intent: 'atk', dmg: 2, times: 3 },
    },
    ai(g, e) {
      if (e.turns === 0) return 'scourge';
      return g.aiPick(e, { flail: 55, scourge: 45 }, { flail: 2, scourge: 1 });
    },
  },

  // ============================================================ BOSSES
  {
    id: 'bragg', name: 'Bragg the Hound-Lord', kind: 'boss', act: 1, hp: 262, sprite: 'en_bragg', leader: true,
    desc: 'Captain of the Marcher levy until Ashfall; now lord of every cutthroat between the fens and the Wood. He feeds his hounds first.',
    init(g, e) { g.addStatus(e, 'hound_lord', 1, { silent: true }); },
    moves: {
      loose: { name: 'Loose the Hounds', intent: 'summon', fx(g, e) { summonHounds(g, e, 2); } },
      cleaver: { name: 'Butcher\'s Cleaver', intent: 'atk', dmg: 15 },
      sic: {
        name: 'Sic \'Em!', intent: 'atkbuff', dmg: 7,
        fx(g, e) { for (const h of g.enemies) if (h.id === 'war_hound') g.apply(h, 'might', 2, e); },
      },
      gut: { name: 'Gut-Rip', intent: 'atk', dmg: 4, times: 3 },
      frenzy: {
        name: 'Blood Frenzy', intent: 'buff',
        fx(g, e) {
          e.data.frenzy = true;
          e.data.frenzyNow = false;
          g.apply(e, 'frenzy', 2, e);
          g.gainBlock(e, 12, { raw: true });
          summonHounds(g, e, 2);
        },
      },
      hack: { name: 'Frenzied Hacking', intent: 'atk', dmg: 6, times: 2 },
    },
    ai(g, e) {
      if (e.turns === 0) return 'loose';
      if (e.data.frenzyNow) return 'frenzy';
      if (!count(g, 'war_hound') && e.turns - (e.data.lastLoose ?? 0) >= 3) return 'loose';
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
    id: 'hanged_sheriff', name: 'The Hanged Sheriff', kind: 'boss', act: 1, hp: 270, sprite: 'en_hanged_sheriff',
    desc: 'He hanged three hundred men at the Marcher crossroads, all by the King\'s law. When the King died, the Sheriff\'s heart stopped. He did not.',
    init(g, e) { e.data.per = 3; g.addStatus(e, 'hanging_judge', 3, { silent: true }); },
    moves: {
      charges: {
        name: 'Read the Charges', intent: 'strongdebuff',
        fx(g, e) { const n = e.data.day ? 3 : 2; for (let i = 0; i < n; i++) g.addCard('sheriffs_warrant', 'draw'); },
      },
      manacles: { name: 'Iron Manacles', intent: 'atkdebuff', dmg: 8, fx(g, e) { shackle(g, e, 2); } },
      cudgel: { name: 'Reeve\'s Cudgel', intent: 'atk', dmg: 13 },
      noose: {
        name: 'The Noose', intent: 'atk',
        dmg: (g, e) => 8 + (e.data.per || 3) * (g.cb ? g.cb.cnt.cards : 0),
      },
      day: {
        name: 'Hanging Day', intent: 'strongdebuff',
        fx(g, e) {
          e.data.day = true;
          e.data.dayNow = false;
          e.data.per = 4;
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
    id: 'mother_of_rats', name: 'Mother of Rats', kind: 'boss', act: 1, hp: 255, sprite: 'en_mother_of_rats', leader: true,
    desc: 'In the plague-pits under Saltmarsh something has eaten the dead for ten years. It has grown very large. It has had a great many children.',
    init(g, e) {
      e.data.acc = 0;
      g.addStatus(e, 'teeming', 40, { silent: true });
      g.addStatus(e, 'swarm_fed', 2, { silent: true });
    },
    moves: {
      birth: { name: 'Birth the Swarm', intent: 'summon', fx(g) { spawnRats(g, 2); } },
      kiss: { name: 'Plague Kiss', intent: 'atkdebuff', dmg: 8, fx(g, e) { g.apply(g.player, 'rot', 3, e); } },
      wallow: { name: 'Wallow', intent: 'atk', dmg: 16 },
      tide: { name: 'Tide of Teeth', intent: 'atkdebuff', dmg: 3, times: 4 },
      boil: {
        name: 'The Pit Boils', intent: 'summon',
        fx(g, e) {
          e.data.boiled = true;
          e.data.boilNow = false;
          g.addStatus(e, 'plague_bite', 1);
          spawnRats(g, Math.max(0, 3 - count(g, 'rat_swarm')));
        },
      },
    },
    ai(g, e) {
      if (e.turns === 0) return 'birth';
      if (e.data.boilNow) return 'boil';
      const rats = count(g, 'rat_swarm');
      if (e.data.boiled) {
        const m = step(e, ['tide', 'wallow', 'kiss'], 'j');
        return m === 'kiss' && rats < 2 ? 'birth' : m;
      }
      const m = step(e, ['kiss', 'wallow', 'tide']);
      return m === 'tide' && rats < 2 ? 'birth' : m;
    },
    on: {
      hpLost(g, e, n) {
        if (e.hp <= 0) return;
        const per = e.st.teeming;
        if (per) {
          e.data.acc = (e.data.acc || 0) + n;
          while (e.data.acc >= per) {
            e.data.acc -= per;
            spawnRats(g, 1, 6);
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

defineSprites({
});
