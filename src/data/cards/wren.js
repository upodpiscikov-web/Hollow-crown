// Wren, the Changeling (WARD). Masks & Shift, Knives, Mimic, Faceless.
//
// Masks are engine stances (g.setMask / g.cb.mask). Changing mask = Shift.
// Text conventions used on every Wren card:
//   "Wear the Wolf Mask."  -> g.setMask('wolf')
//   "In the Wolf Mask, X"  -> X only if g.cb.mask === 'wolf'
//   "Remove your Mask."    -> g.setMask(null)
//   "If unmasked, X"       -> X only if no mask is worn (the Faceless archetype)
import { defineCards, defineStatuses, defineRelics, definePotions } from '../../engine/registry.js';
import { pick } from '../../engine/rng.js';

const MASK_IDS = ['wolf', 'moth', 'owl'];
const maskIs = (g, m) => !!(g.cb && g.cb.mask === m);
const unmasked = (g) => !!(g.cb && !g.cb.mask);

// Let the player pick a mask other than the one they wear (via choice cards).
async function chooseMask(g, title = 'Choose a face') {
  const opts = MASK_IDS.filter((m) => m !== g.cb.mask);
  const cards = opts.map((m) => g.makeCard('wear_' + m));
  const [c] = await g.choose({ cards, count: 1, min: 1, title, always: true });
  g.setMask(c ? c.id.slice(5) : opts[0]);
}

function addKnives(g, n, up) {
  for (let i = 0; i < n; i++) g.addCard('knife', 'hand', { up: up ? 1 : 0 });
}

// Move a card from the discard pile back to hand (if there is room).
function returnToHand(g, c) {
  const cb = g.cb;
  if (cb.hand.length >= 10) return false;
  const i = cb.discard.indexOf(c);
  if (i < 0) return false;
  cb.discard.splice(i, 1);
  cb.hand.push(c);
  g.emit('addCard', { card: c, where: 'hand' });
  return true;
}

// Enemy buffs Wren can take with Stolen Face (only ones that make sense on her).
const STEALABLE = ['might', 'thorns', 'plating', 'rite', 'ward'];

// ---------------------------------------------------------------- statuses
defineStatuses([
  {
    id: 'wren_echo', name: 'Echo', kind: 'buff', icon: 'echo',
    desc: (n) => `Your next ${n > 1 ? n + ' cards are' : 'card is'} played an extra time this turn.`,
    extraPlays(g, o, n, card) {
      if (!o.isPlayer || n <= 0 || g.cardDef(card).wrenNoEcho) return 0;
      g.addStatus(o, 'wren_echo', -1, { silent: true });
      return 1;
    },
    turnEnd(g, o) { g.removeStatus(o, 'wren_echo'); },
  },
  {
    id: 'wren_restless', name: 'Restless', kind: 'buff', icon: 'feather',
    desc: () => 'Whenever you Shift, every Flit in your discard pile returns to your hand.',
    shift(g, o) {
      if (!o.isPlayer || !g.cb) return;
      for (const c of g.cb.discard.filter((x) => x.id === 'flit_wren')) returnToHand(g, c);
    },
  },
  {
    id: 'wren_many_faces', name: 'Many Faces', kind: 'buff', icon: 'mask',
    desc: (n) => `Whenever you Shift, gain ${n} Block.`,
    shift(g, o, n) { if (o.isPlayer) g.block(n); },
  },
  {
    id: 'wren_hunters_moon', name: "Hunter's Moon", kind: 'buff', icon: 'moon',
    desc: (n) => `Whenever you wear the Wolf Mask, draw ${n} card${n > 1 ? 's' : ''}.`,
    shift(g, o, n, from, to) { if (o.isPlayer && to === 'wolf') g.draw(n); },
  },
  {
    id: 'wren_sleeve', name: 'Sleeve of Knives', kind: 'buff', icon: 'knife',
    desc: (n) => `At the start of your turn, add ${n} Knife${n > 1 ? 's' : ''} to your hand.`,
    turnStart(g, o, n) { addKnives(g, n); },
  },
  {
    id: 'wren_smooth_skin', name: 'Smooth Skin', kind: 'buff', icon: 'heart',
    desc: (n) => `While unmasked, Attacks deal ${n} more damage and cards give ${n} more Block.`,
    atkAdd: (g, o, n) => (unmasked(g) ? n : 0),
    blockAdd: (g, o, n) => (unmasked(g) ? n : 0),
  },
  {
    id: 'wren_hall', name: 'Hall of Mirrors', kind: 'buff', icon: 'eye',
    desc: (n) => `At the start of your turn, the first ${n > 1 ? n + ' cards' : 'card'} you play ${n > 1 ? 'are' : 'is'} played an extra time.`,
    turnStart(g, o, n) { g.addStatus(o, 'wren_echo', n); },
  },
  {
    id: 'wren_cloud', name: 'Cloud of Moths', kind: 'buff', icon: 'star',
    desc: (n) => `Whenever you play a card, deal ${n} damage to ALL enemies.`,
    cardPlayed(g, o, n) {
      if (!o.isPlayer) return;
      for (const e of [...g.enemies]) g.damage(e, n, { type: 'spell', src: o });
    },
  },
  {
    id: 'wren_second_skin', name: 'Second Skin', kind: 'buff', icon: 'crown',
    desc: () => 'Your Masks\' effects are doubled.',
    atkMul: (g) => (maskIs(g, 'wolf') ? 4 / 3 : 1),     // 1.5 -> 2.0
    takeMul: (g) => (maskIs(g, 'wolf') ? 1.2 : 1),      // 1.25 -> 1.5
    blockMul: (g) => (maskIs(g, 'moth') ? 4 / 3 : 1),   // 1.5 -> 2.0
    drawMod: (g) => (maskIs(g, 'owl') ? 1 : 0),         // +1 -> +2
    owlExitAdd: () => 2,                                // 2 -> 4 Energy
  },
  {
    id: 'wren_catch', name: 'Catch the Blade', kind: 'buff', icon: 'knife',
    desc: (n) => `Until your next turn, whenever you are attacked, add ${n} Knife${n > 1 ? 's' : ''} to your hand.`,
    onAttacked(g, o, n) { if (o.isPlayer) addKnives(g, n); },
    turnStart(g, o) { g.removeStatus(o, 'wren_catch'); },
  },
]);

// ---------------------------------------------------------------- cards
defineCards([
  // ============================================================ starters
  {
    id: 'strike_wren', name: 'Strike', hero: 'wren', type: 'attack', rarity: 'starter', cost: 1, target: 'enemy',
    v: { dmg: 6 }, up: { dmg: 3 }, art: 'dagger',
    text: 'Deal {dmg} damage.',
    play(g, v, t) { g.attack(t, v.dmg); },
  },
  {
    id: 'defend_wren', name: 'Defend', hero: 'wren', type: 'skill', rarity: 'starter', cost: 1, target: 'none',
    v: { blk: 5 }, up: { blk: 3 }, art: 'cloak',
    text: 'Gain {blk} Block.',
    play(g, v) { g.block(v.blk); },
  },
  {
    id: 'borrowed_face', name: 'Borrowed Face', hero: 'wren', type: 'skill', rarity: 'starter', cost: 1, target: 'none',
    v: { blk: 4 }, up: { blk: 3 }, art: 'mask',
    text: 'Wear a Mask of your choice. Gain {blk} Block.',
    async play(g, v) { await chooseMask(g, 'Borrow a face'); g.block(v.blk); },
  },

  // ============================================================ tokens
  {
    id: 'knife', name: 'Knife', hero: 'wren', type: 'attack', rarity: 'special', cost: 0, target: 'enemy',
    v: { dmg: 4 }, up: { dmg: 2 }, kw: ['exhaust'], art: 'knife',
    text: 'Deal {dmg} damage.',
    play(g, v, t) { g.attack(t, v.dmg); },
  },
  {
    id: 'wear_wolf', name: 'Wolf Mask', hero: 'wren', type: 'skill', rarity: 'special', cost: 0, target: 'none',
    kw: ['exhaust'], art: 'mask_wolf', noUp: true,
    text: 'Wear the Wolf Mask. Attacks deal 50% more damage; you take 25% more.',
    play(g) { g.setMask('wolf'); },
  },
  {
    id: 'wear_moth', name: 'Moth Mask', hero: 'wren', type: 'skill', rarity: 'special', cost: 0, target: 'none',
    kw: ['exhaust'], art: 'mask_moth', noUp: true,
    text: 'Wear the Moth Mask. Block from cards is increased by 50%.',
    play(g) { g.setMask('moth'); },
  },
  {
    id: 'wear_owl', name: 'Owl Mask', hero: 'wren', type: 'skill', rarity: 'special', cost: 0, target: 'none',
    kw: ['exhaust'], art: 'mask_owl', noUp: true,
    text: 'Wear the Owl Mask. Draw 1 more card each turn. Leaving it gives 2 Energy.',
    play(g) { g.setMask('owl'); },
  },

  // ============================================================ commons — attacks
  {
    id: 'bare_teeth', name: 'Bare Teeth', hero: 'wren', type: 'attack', rarity: 'common', cost: 1, target: 'enemy',
    v: { dmg: 6 }, up: { dmg: 3 }, tier: 0, art: 'mask_wolf',
    text: 'Deal {dmg} damage. Wear the Wolf Mask.',
    play(g, v, t) { g.attack(t, v.dmg); g.setMask('wolf'); },
  },
  {
    id: 'pounce_wren', name: 'Pounce', hero: 'wren', type: 'attack', rarity: 'common', cost: 1, target: 'enemy',
    v: { dmg: 8, ex: 1 }, up: { dmg: 2, ex: 1 }, tier: 0, art: 'wolf',
    text: 'Deal {dmg} damage. In the Wolf Mask, apply {ex} Exposed.',
    play(g, v, t) { g.attack(t, v.dmg); if (maskIs(g, 'wolf')) g.apply(t, 'exposed', v.ex); },
  },
  {
    id: 'wingbeat', name: 'Wingbeat', hero: 'wren', type: 'attack', rarity: 'common', cost: 1, target: 'enemy',
    v: { dmg: 6, blk: 5 }, up: { dmg: 2, blk: 2 }, tier: 3, art: 'wing',
    text: 'Deal {dmg} damage. In the Moth Mask, gain {blk} Block.',
    play(g, v, t) { g.attack(t, v.dmg); if (maskIs(g, 'moth')) g.block(v.blk); },
  },
  {
    id: 'flit_wren', name: 'Flit', hero: 'wren', type: 'attack', rarity: 'common', cost: 0, target: 'enemy',
    v: { dmg: 4 }, up: { dmg: 2 }, tier: 0, art: 'feather',
    text: 'Deal {dmg} damage. Whenever you Shift, this returns to your hand from the discard pile.',
    onDraw(g) { if (!g.st(g.player, 'wren_restless')) g.addStatus(g.player, 'wren_restless', 1, { silent: true }); },
    play(g, v, t) {
      if (!g.st(g.player, 'wren_restless')) g.addStatus(g.player, 'wren_restless', 1, { silent: true });
      g.attack(t, v.dmg);
    },
  },
  {
    id: 'rake_wren', name: 'Rake', hero: 'wren', type: 'attack', rarity: 'common', cost: 1, target: 'enemy',
    v: { dmg: 3 }, up: { dmg: 1 }, tier: 1, art: 'claw',
    text: 'Deal {dmg} damage twice, plus once more for each time you Shifted this turn.',
    play(g, v, t) { g.attack(t, v.dmg, 2 + g.cnt.shifts); },
  },
  {
    id: 'nobodys_blow', name: "Nobody's Blow", hero: 'wren', type: 'attack', rarity: 'common', cost: 1, target: 'enemy',
    v: { dmg: 9 }, up: { dmg: 3 }, tier: 0, art: 'fist',
    text: 'Deal {dmg} damage. Remove your Mask.',
    play(g, v, t) { g.attack(t, v.dmg); g.setMask(null); },
  },
  {
    id: 'strangers_smile', name: "Stranger's Smile", hero: 'wren', type: 'attack', rarity: 'common', cost: 1, target: 'enemy',
    v: { dmg: 8, w: 2 }, up: { dmg: 2, w: 1 }, tier: 0, art: 'eye',
    text: 'Deal {dmg} damage. If unmasked, apply {w} Weakened.',
    play(g, v, t) { g.attack(t, v.dmg); if (unmasked(g)) g.apply(t, 'weak', v.w); },
  },
  {
    id: 'glint_wren', name: 'Glint', hero: 'wren', type: 'attack', rarity: 'common', cost: 1, target: 'enemy',
    v: { dmg: 6 }, up: { dmg: 3 }, tier: 0, art: 'dagger',
    text: 'Deal {dmg} damage. Add a Knife to your hand.',
    play(g, v, t) { g.attack(t, v.dmg); addKnives(g, 1); },
  },
  {
    id: 'mirror_shard', name: 'Mirror Shard', hero: 'wren', type: 'attack', rarity: 'common', cost: 0, target: 'enemy',
    v: { dmg: 4 }, up: { dmg: 2 }, tier: 2, art: 'mirror',
    text: 'Deal {dmg} damage. Add a copy of this card to your discard pile.',
    play(g, v, t, card) { g.attack(t, v.dmg); g.copyCard(card, 'discard'); },
  },

  // ============================================================ commons — skills
  {
    id: 'dust_of_wings', name: 'Dust of Wings', hero: 'wren', type: 'skill', rarity: 'common', cost: 1, target: 'none',
    v: { blk: 5 }, up: { blk: 3 }, tier: 0, art: 'mask_moth',
    text: 'Wear the Moth Mask. Gain {blk} Block.',
    play(g, v) { g.setMask('moth'); g.block(v.blk); },
  },
  {
    id: 'owls_vigil', name: "Owl's Vigil", hero: 'wren', type: 'skill', rarity: 'common', cost: 1, target: 'none',
    v: { blk: 4 }, up: { blk: 3 }, tier: 0, art: 'mask_owl',
    text: 'Gain {blk} Block. Wear the Owl Mask.',
    play(g, v) { g.block(v.blk); g.setMask('owl'); },
  },
  {
    id: 'silent_wings', name: 'Silent Wings', hero: 'wren', type: 'skill', rarity: 'common', cost: 1, target: 'none',
    v: { blk: 7, n: 2 }, up: { blk: 3 }, tier: 0, art: 'owl',
    text: 'Gain {blk} Block. In the Owl Mask, draw {n} cards.',
    play(g, v) { g.block(v.blk); if (maskIs(g, 'owl')) g.draw(v.n); },
  },
  {
    id: 'blinding_dust', name: 'Blinding Dust', hero: 'wren', type: 'skill', rarity: 'common', cost: 1, target: 'none',
    v: { w: 1, blk: 6 }, up: { w: 1, blk: 2 }, tier: 0, art: 'moth',
    text: 'Apply {w} Weakened to ALL enemies. In the Moth Mask, gain {blk} Block.',
    play(g, v) { g.applyAll('weak', v.w); if (maskIs(g, 'moth')) g.block(v.blk); },
  },
  {
    id: 'quick_change_wren', name: 'Quick Change', hero: 'wren', type: 'skill', rarity: 'common', cost: 0, target: 'none',
    v: { n: 1 }, up: { n: 1 }, kw: ['exhaust'], tier: 0, art: 'swirl',
    text: 'Wear a Mask of your choice. Draw 1 card.',
    upText: 'Wear a Mask of your choice. Draw 2 cards.',
    async play(g, v) { await chooseMask(g, 'Change your face'); g.draw(v.n); },
  },
  {
    id: 'blank_stare', name: 'Blank Stare', hero: 'wren', type: 'skill', rarity: 'common', cost: 1, target: 'none',
    v: { blk: 7 }, up: { blk: 3 }, tier: 0, art: 'mask',
    text: 'Gain {blk} Block. Remove your Mask.',
    play(g, v) { g.block(v.blk); g.setMask(null); },
  },
  {
    id: 'bare_face', name: 'Bare Face', hero: 'wren', type: 'skill', rarity: 'common', cost: 1, target: 'none',
    v: { n: 2 }, up: { n: 1 }, tier: 0, art: 'hand',
    text: 'Remove your Mask. Draw {n} cards.',
    play(g, v) { g.setMask(null); g.draw(v.n); },
  },
  {
    id: 'hidden_blades', name: 'Hidden Blades', hero: 'wren', type: 'skill', rarity: 'common', cost: 1, target: 'none',
    v: { k: 3 }, up: { k: 1 }, tier: 0, art: 'knife',
    text: 'Add {k} Knives to your hand.',
    play(g, v) { addKnives(g, v.k); },
  },
  {
    id: 'feint_wren', name: 'Feint', hero: 'wren', type: 'skill', rarity: 'common', cost: 1, target: 'none',
    v: { blk: 6, k: 1 }, up: { k: 1 }, tier: 0, art: 'cloak',
    text: 'Gain {blk} Block. Add a Knife to your hand.',
    upText: 'Gain {blk} Block. Add 2 Knives to your hand.',
    play(g, v) { g.block(v.blk); addKnives(g, v.k); },
  },

  // ============================================================ uncommons — attacks
  {
    id: 'run_with_the_pack', name: 'Run with the Pack', hero: 'wren', type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy',
    v: { dmg: 3, n: 3 }, up: { n: 1 }, tier: 0, art: 'wolf',
    text: 'Deal {dmg} damage {n} times. Wear the Wolf Mask.',
    play(g, v, t) { g.attack(t, v.dmg, v.n); g.setMask('wolf'); },
  },
  {
    id: 'moonfang', name: 'Moonfang', hero: 'wren', type: 'attack', rarity: 'uncommon', cost: 2, target: 'enemy',
    v: { dmg: 15, w: 2 }, up: { dmg: 5 }, tier: 4, art: 'moon',
    text: 'Deal {dmg} damage. In the Wolf Mask, apply {w} Weakened.',
    play(g, v, t) { g.attack(t, v.dmg); if (maskIs(g, 'wolf')) g.apply(t, 'weak', v.w); },
  },
  {
    id: 'swoop_wren', name: 'Swoop', hero: 'wren', type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy',
    v: { dmg: 8 }, up: { dmg: 3 }, tier: 0, art: 'owl',
    text: 'Deal {dmg} damage. If the enemy intends to attack, wear the Owl Mask.',
    play(g, v, t) {
      const it = g.intentOf(t);
      const attacking = !!(it && it.dmg != null);
      g.attack(t, v.dmg);
      if (attacking) g.setMask('owl');
    },
  },
  {
    id: 'masquerade_wren', name: 'Masquerade', hero: 'wren', type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy',
    v: { dmg: 5, per: 2 }, up: { per: 1 }, tier: 0, art: 'mask',
    text: 'Deal {dmg} damage, plus {per} for each time you Shifted this combat.',
    play(g, v, t) { g.attack(t, v.dmg + v.per * g.tot.shifts); },
  },
  {
    id: 'nobody_home', name: 'Nobody Home', hero: 'wren', type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy',
    v: { dmg: 9 }, up: { dmg: 3 }, tier: 1, art: 'ghost',
    text: 'Deal {dmg} damage. If unmasked, gain 1 Energy.',
    play(g, v, t) { g.attack(t, v.dmg); if (unmasked(g)) g.gainEnergy(1); },
  },
  {
    id: 'curtain_call', name: 'Curtain Call', hero: 'wren', type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy',
    v: { dmg: 6 }, up: { dmg: 2 }, tier: 0, art: 'star',
    text: 'Deal {dmg} damage for each other Attack you played this turn.',
    play(g, v, t) { if (g.cnt.attacks > 0) g.attack(t, v.dmg, g.cnt.attacks); },
  },
  {
    id: 'silver_rain', name: 'Silver Rain', hero: 'wren', type: 'attack', rarity: 'uncommon', cost: 1, target: 'none',
    v: { dmg: 5 }, up: { dmg: 2 }, tier: 4, art: 'spark',
    text: 'Exhaust every Knife in your hand. Deal {dmg} damage to ALL enemies for each.',
    play(g, v) {
      const ks = g.hand.filter((c) => c.id === 'knife');
      for (const k of ks) g.exhaustCard(k);
      if (ks.length) g.attackAll(v.dmg, ks.length);
    },
  },
  {
    id: 'pickpocket_wren', name: 'Pickpocket', hero: 'wren', type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy',
    v: { dmg: 6, n: 2 }, up: { n: 1 }, kw: ['exhaust'], tier: 3, art: 'coin',
    text: 'Deal {dmg} damage. Take {n} Might from the enemy.',
    play(g, v, t) {
      g.attack(t, v.dmg);
      if (t && !t.dead && g.apply(t, 'might', -v.n)) g.applySelf('might', v.n);
    },
  },
  {
    id: 'rob_blind', name: 'Rob Blind', hero: 'wren', type: 'attack', rarity: 'uncommon', cost: 1, target: 'enemy',
    v: { dmg: 8 }, up: { dmg: 3 }, tier: 2, art: 'key',
    text: 'Take all of the enemy\'s Block, then deal {dmg} damage.',
    play(g, v, t) {
      const b = t.block || 0;
      if (b > 0) {
        t.block = 0;
        g.emit('blockBroken', { e: t });
        g.gainBlock(g.player, b, { raw: true });
      }
      g.attack(t, v.dmg);
    },
  },

  // ============================================================ uncommons — skills
  {
    id: 'hush_wren', name: 'Hush', hero: 'wren', type: 'skill', rarity: 'uncommon', cost: 1, target: 'none',
    v: { n: 3 }, up: { n: 1 }, tier: 2, art: 'mask_owl',
    text: 'If in the Owl Mask, draw {n} cards. Otherwise, wear the Owl Mask.',
    play(g, v) { if (maskIs(g, 'owl')) g.draw(v.n); else g.setMask('owl'); },
  },
  {
    id: 'cocoon_wren', name: 'Cocoon', hero: 'wren', type: 'skill', rarity: 'uncommon', cost: 2, target: 'none',
    v: { blk: 10 }, up: { blk: 4 }, tier: 0, art: 'web',
    text: 'Wear the Moth Mask. Gain {blk} Block and 1 Bulwark.',
    play(g, v) { g.setMask('moth'); g.block(v.blk); g.applySelf('bulwark', 1); },
  },
  {
    id: 'blank_slate', name: 'Blank Slate', hero: 'wren', type: 'skill', rarity: 'uncommon', cost: 0, target: 'none',
    v: { e: 1 }, up: { e: 1 }, kw: ['exhaust'], tier: 0, art: 'scroll',
    text: 'Remove your Mask. Gain {e} Energy. Draw 1 card.',
    play(g, v) { g.setMask(null); g.gainEnergy(v.e); g.draw(1); },
  },
  {
    id: 'turn_out_your_pockets', name: 'Turn Out Your Pockets', hero: 'wren', type: 'skill', rarity: 'uncommon', cost: 1, target: 'none',
    tier: 0, art: 'coin',
    text: 'Discard your hand. Add a Knife to your hand for each card discarded.',
    upText: 'Discard your hand. Add an upgraded Knife to your hand for each card discarded.',
    play(g, v, t, card) {
      const cards = [...g.hand];
      for (const c of cards) g.discardCard(c);
      addKnives(g, cards.length, card.up);
    },
  },
  {
    id: 'catch_the_blade', name: 'Catch the Blade', hero: 'wren', type: 'skill', rarity: 'uncommon', cost: 1, target: 'none',
    v: { blk: 6 }, up: { blk: 3 }, tier: 1, art: 'hand',
    text: 'Gain {blk} Block. Until your next turn, when attacked, add a Knife to your hand.',
    play(g, v) { g.block(v.blk); g.addStatus(g.player, 'wren_catch', 1); },
  },
  {
    id: 'reflection_wren', name: 'Reflection', hero: 'wren', type: 'skill', rarity: 'uncommon', cost: 1, upCost: 0, target: 'none',
    tier: 0, art: 'mirror', wrenNoEcho: true,
    text: 'Your next card this turn is played an extra time.',
    play(g) { g.addStatus(g.player, 'wren_echo', 1); },
  },
  {
    id: 'mimicry_wren', name: 'Mimicry', hero: 'wren', type: 'skill', rarity: 'uncommon', cost: 1, upCost: 0, target: 'none',
    tier: 0, art: 'eye',
    text: 'Add a copy of a card in your hand to your hand.',
    async play(g, v, t, card) {
      const [c] = await g.chooseHand(1, 'Choose a card to mimic', (x) => x !== card && x.id !== 'mimicry_wren');
      if (c) g.copyCard(c, 'hand');
    },
  },

  // ============================================================ uncommons — powers
  {
    id: 'many_faces', name: 'Many Faces', hero: 'wren', type: 'power', rarity: 'uncommon', cost: 1, target: 'none',
    v: { blk: 4 }, up: { blk: 2 }, tier: 0, art: 'mask',
    text: 'Whenever you Shift, gain {blk} Block.',
    play(g, v) { g.applySelf('wren_many_faces', v.blk); },
  },
  {
    id: 'hunters_moon', name: "Hunter's Moon", hero: 'wren', type: 'power', rarity: 'uncommon', cost: 1, upCost: 0, target: 'none',
    tier: 0, art: 'moon',
    text: 'Whenever you wear the Wolf Mask, draw 2 cards.',
    play(g) { g.applySelf('wren_hunters_moon', 2); },
  },
  {
    id: 'sleeve_of_knives', name: 'Sleeve of Knives', hero: 'wren', type: 'power', rarity: 'uncommon', cost: 1, target: 'none',
    upKw: { add: ['innate'] }, tier: 0, art: 'knife',
    text: 'At the start of your turn, add a Knife to your hand.',
    play(g) { g.applySelf('wren_sleeve', 1); },
  },
  {
    id: 'smooth_skin', name: 'Smooth Skin', hero: 'wren', type: 'power', rarity: 'uncommon', cost: 1, target: 'none',
    v: { n: 2 }, up: { n: 1 }, tier: 3, art: 'hand',
    text: 'While unmasked, Attacks deal {n} more damage and cards give {n} more Block.',
    play(g, v) { g.applySelf('wren_smooth_skin', v.n); },
  },

  // ============================================================ rares
  {
    id: 'wild_hunt', name: 'The Wild Hunt', hero: 'wren', type: 'attack', rarity: 'rare', cost: 2, target: 'none',
    v: { dmg: 5 }, up: { dmg: 2 }, tier: 0, art: 'wolf',
    text: 'Wear the Wolf Mask. Deal {dmg} damage to ALL enemies 3 times.',
    play(g, v) { g.setMask('wolf'); g.attackAll(v.dmg, 3); },
  },
  {
    id: 'moth_to_the_flame', name: 'Moth to the Flame', hero: 'wren', type: 'attack', rarity: 'rare', cost: 2, upCost: 1, target: 'none',
    tier: 1, art: 'flame',
    text: 'Deal damage equal to your Block to ALL enemies.',
    play(g) { const b = g.player.block; if (b > 0) g.attackAll(b); },
  },
  {
    id: 'looking_glass_knife', name: 'Looking-Glass Knife', hero: 'wren', type: 'attack', rarity: 'rare', cost: 1, target: 'enemy',
    v: { dmg: 8 }, up: { dmg: 4 }, tier: 2, art: 'knife',
    text: 'Deal {dmg} damage twice. Each play lowers this card\'s damage by 2 this combat.',
    play(g, v, t, card) {
      g.attack(t, v.dmg, 2);
      card.bonus = { ...(card.bonus || {}), dmg: ((card.bonus && card.bonus.dmg) || 0) - 2 };
    },
  },
  {
    id: 'mirror_mirror', name: 'Mirror, Mirror', hero: 'wren', type: 'attack', rarity: 'rare', cost: 1, target: 'enemy',
    v: { dmg: 4 }, up: { dmg: 5 }, tier: 3, art: 'mirror',
    text: 'Deal {dmg} damage, plus all the damage the enemy intends to deal.',
    play(g, v, t) {
      const it = g.intentOf(t);
      const mirrored = it && it.dmg != null ? it.dmg * (it.times || 1) : 0;
      g.attack(t, v.dmg + mirrored);
    },
  },
  {
    id: 'thousand_faces', name: 'A Thousand Faces', hero: 'wren', type: 'skill', rarity: 'rare', cost: 1, upCost: 0, target: 'none',
    tier: 0, art: 'mask',
    text: 'Wear the Wolf Mask, then the Moth Mask, then the Owl Mask.',
    play(g) { g.setMask('wolf'); g.setMask('moth'); g.setMask('owl'); },
  },
  {
    id: 'stolen_face', name: 'Stolen Face', hero: 'wren', type: 'skill', rarity: 'rare', cost: 1, upCost: 0, target: 'enemy',
    v: { w: 2 }, kw: ['exhaust'], tier: 5, art: 'eye',
    text: 'Steal the enemy\'s Might, Thorns, Plating, Rite and Ward. Apply {w} Weakened.',
    play(g, v, t) {
      for (const id of STEALABLE) {
        const n = g.st(t, id);
        if (n > 0) { g.removeStatus(t, id); g.applySelf(id, n); }
      }
      g.apply(t, 'weak', v.w);
    },
  },
  {
    id: 'nobody_there', name: 'Nobody There', hero: 'wren', type: 'skill', rarity: 'rare', cost: 2, upCost: 1, target: 'none',
    kw: ['exhaust'], tier: 4, art: 'ghost',
    text: 'Remove your Mask. Gain 1 Phantasm.',
    play(g) { g.setMask(null); g.applySelf('phantasm', 1); },
  },
  {
    id: 'hall_of_mirrors', name: 'Hall of Mirrors', hero: 'wren', type: 'power', rarity: 'rare', cost: 3, target: 'none',
    kw: ['ethereal'], upKw: { remove: ['ethereal'] }, tier: 0, art: 'mirror', wrenNoEcho: true,
    text: 'The first card you play each turn is played an extra time.',
    play(g) { g.applySelf('wren_hall', 1); },
  },
  {
    id: 'cloud_of_moths', name: 'Cloud of Moths', hero: 'wren', type: 'power', rarity: 'rare', cost: 2, target: 'none',
    v: { n: 1 }, up: { n: 1 }, tier: 0, art: 'moth',
    text: 'Whenever you play a card, deal {n} damage to ALL enemies.',
    play(g, v) { g.applySelf('wren_cloud', v.n); },
  },
  {
    id: 'second_skin', name: 'Second Skin', hero: 'wren', type: 'power', rarity: 'rare', cost: 2, upCost: 1, target: 'none',
    tier: 5, art: 'mask',
    text: 'Your Masks\' effects are doubled.',
    play(g) { if (!g.st(g.player, 'wren_second_skin')) g.applySelf('wren_second_skin', 1); },
  },
]);

// ---------------------------------------------------------------- relics
defineRelics([
  {
    id: 'carved_mask', name: 'Carved Mask', rarity: 'starter', hero: 'wren', icon: 'mask', tint: '#c8b08a',
    desc: 'The first time you Shift each turn, gain 4 Block.',
    flavor: 'Limewood, whittled by a lonely child who wanted to know what a face felt like.',
    combatStart(g, r) { r.t = 0; },
    shift(g, r) {
      if (!g.cb || r.t === g.cb.turn) return;
      r.t = g.cb.turn;
      g.gainBlock(g.player, 4, { raw: true });
    },
  },
  {
    id: 'cutlers_whetstone', name: "Cutler's Whetstone", rarity: 'common', hero: 'wren', icon: 'stone', tint: '#9aa3ab',
    desc: 'Knives deal 2 more damage.',
    flavor: 'Lifted from a knife-grinder\'s cart in Ashgrave. He never noticed. Nobody ever notices.',
    atkAdd(g, r, ctx) { return ctx && ctx.card && ctx.card.id === 'knife' ? 2 : 0; },
  },
  {
    id: 'plain_veil', name: 'Plain Veil', rarity: 'common', hero: 'wren', icon: 'cloak', tint: '#d8d4cc',
    desc: 'At the start of your turn, if you are unmasked, gain 3 Block.',
    flavor: 'Mourners wear them so no one can see their grief. Wren wears one so no one can see nothing.',
    turnStart(g) { if (g.cb && !g.cb.mask) g.gainBlock(g.player, 3, { raw: true }); },
  },
  {
    id: 'silvered_hand_mirror', name: 'Silvered Hand Mirror', rarity: 'uncommon', hero: 'wren', icon: 'mirror', tint: '#b9d3e0',
    desc: 'The first card you play each combat is played an extra time.',
    flavor: 'The reflection moves a moment late, as if deciding whether to agree.',
    combatStart(g, r) { r.used = false; },
    extraPlays(g, r, card) {
      if (r.used || g.cardDef(card).wrenNoEcho) return 0;
      r.used = true;
      return 1;
    },
  },
  {
    id: 'barn_owl_feather', name: 'Barn-Owl Feather', rarity: 'uncommon', hero: 'wren', icon: 'feather', tint: '#c9a87a',
    desc: 'Whenever you leave the Owl Mask, gain 1 additional Energy.',
    flavor: 'Soft enough to fall without a sound. Owls are the only birds that never ask who you are.',
    owlExitAdd() { return 1; },
  },
  {
    id: 'marens_locket', name: "Maren's Locket", rarity: 'rare', hero: 'wren', icon: 'locket', tint: '#7fa3a8',
    desc: 'The first time you Shift each turn, draw 1 card.',
    flavor: 'Found in the reeds of the mere. Inside, a lock of violet hair, and the word "Mine."',
    combatStart(g, r) { r.t = 0; },
    shift(g, r) {
      if (!g.cb || r.t === g.cb.turn) return;
      r.t = g.cb.turn;
      g.draw(1);
    },
  },
  {
    id: 'mask_of_many_moons', name: 'Mask of Many Moons', rarity: 'boss', hero: 'wren', icon: 'moon', tint: '#b9a6e0',
    desc: 'Gain 1 Energy at the start of each turn. At the start of your turn, you Shift into a random different Mask.',
    flavor: 'Every face it shows is borrowed from a night that has not happened yet.',
    maxEnergy() { return 1; },
    turnStart(g) {
      if (!g.cb) return;
      const opts = MASK_IDS.filter((m) => m !== g.cb.mask);
      g.setMask(pick(g.crng, opts));
    },
  },
]);

// ---------------------------------------------------------------- tinctures
definePotions([
  {
    id: 'tincture_of_quicksilver', name: 'Tincture of Quicksilver', rarity: 'common', hero: 'wren',
    target: 'none', icon: 'vial', color: '#c0c8d0',
    desc: 'Add 3 Knives to your hand.',
    async use(g, t, mul) { addKnives(g, 3 * mul); },
  },
  {
    id: 'mirror_water', name: 'Mirror-Water', rarity: 'uncommon', hero: 'wren',
    target: 'none', icon: 'flask_tall', color: '#8fb8d8',
    desc: 'Your next 2 cards this turn are played an extra time.',
    async use(g, t, mul) { g.addStatus(g.player, 'wren_echo', 2 * mul); },
  },
]);
