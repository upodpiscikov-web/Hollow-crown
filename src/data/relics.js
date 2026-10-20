// Generic relics (no hero field) + special event relics. Systems & balance designer.
//
// Engine notes for whoever edits this next:
// - combatStart fires BEFORE the first turn's Block reset, so Block granted "at the
//   start of combat" is given on turnStart(turn === 1) instead. Statuses are safe
//   to apply in combatStart.
// - Modifier hooks (maxEnergy, priceMul, drawMod, ...) MUST be functions.
// - hpLost / enemyDied / cardPlayed etc. fire for every entity: check isPlayer.
// - All randomness uses the run's seeded streams.
import { defineRelics, CARDS } from '../engine/registry.js';
import { pick, chance, int } from '../engine/rng.js';

const P = (g) => g.player;
const spellAll = (g, n) => { for (const e of g.enemies) g.damage(e, n, { type: 'spell', src: g.player }); };
const healAny = (g, n) => (g.cb ? g.healPlayer(n) : g.healOut(n));
const isType = (g, card, t) => CARDS[card.id] && CARDS[card.id].type === t;

// Curses an Ossuary Key can inflict (never the unremovable one).
const CHEST_CURSES = ['doubt', 'shame', 'hunger', 'grief', 'rot_touched', 'debt', 'crowns_whisper'];

defineRelics([
  // ================================================================ COMMON
  {
    id: 'iron_thimble', name: 'Iron Thimble', rarity: 'common', icon: 'thimble', tint: '#8e98a3',
    desc: 'Start each combat with 10 Block.',
    flavor: 'A soldier\'s widow sewed his shroud with it. It has guarded one small finger ever since.',
    turnStart(g, r, turn) { if (turn === 1) g.gainBlock(P(g), 10, { raw: true }); },
  },
  {
    id: 'gallows_rope', name: 'Gallows Rope', rarity: 'common', icon: 'rope', tint: '#a08a62',
    desc: 'At the start of each combat, apply 1 Exposed to ALL enemies.',
    flavor: 'Cut from the Hanged Sheriff\'s tree. Everything it touches remembers how to fall.',
    combatStart(g) { g.applyAll('exposed', 1); },
  },
  {
    id: 'briar_charm', name: 'Briar Charm', rarity: 'common', icon: 'amulet', tint: '#5c7a2a',
    desc: 'Start each combat with 3 Thorns.',
    flavor: 'Fen-wives plait them for their sons. "Let the world bleed a little first."',
    combatStart(g) { g.applySelf('thorns', 3); },
  },
  {
    id: 'mourners_veil', name: 'Mourner\'s Veil', rarity: 'common', icon: 'cloak', tint: '#342c3b',
    desc: 'The first time you lose HP each combat, draw 3 cards.',
    flavor: 'Black lace, starched with salt. Nobody in Morrow has worn one properly in ninety years.',
    combatStart(g, r) { r.used = false; },
    hpLost(g, r, e) {
      if (!e || !e.isPlayer || r.used || !g.cb || g.cb.phase === 'over') return;
      r.used = true;
      g.draw(3);
    },
  },
  {
    id: 'sextons_hourglass', name: 'Sexton\'s Hourglass', rarity: 'common', icon: 'hourglass', tint: '#c9a227', counter: 0,
    desc: 'Every 3 turns, gain 1 Energy.',
    flavor: 'He turned it at every burial. Since Ashfall, the sand has never quite run out.',
    turnStart(g, r) {
      r.n = (r.n || 0) + 1;
      if (r.n >= 3) { r.n = 0; g.gainEnergy(1); }
    },
  },
  {
    id: 'corpse_candle', name: 'Corpse Candle', rarity: 'common', icon: 'candle', tint: '#a9c6c2',
    desc: 'Gain 1 Energy on the first turn of each combat.',
    flavor: 'Marsh-lights gathered in a jar. They lead travellers astray, but they lead them quickly.',
    turnStart(g, r, turn) { if (turn === 1) g.gainEnergy(1); },
  },
  {
    id: 'executioners_tally', name: 'Executioner\'s Tally', rarity: 'common', icon: 'skull', tint: '#d8cfb8', counter: 0,
    desc: 'Every 10 Attacks you play, gain 1 Energy.',
    flavor: 'A notched thighbone. The headsman of Ashgrave ran out of room around the year of the Long King\'s fiftieth.',
    cardPlayed(g, r, card) {
      if (!isType(g, card, 'attack')) return;
      r.n = (r.n || 0) + 1;
      if (r.n >= 10) { r.n = 0; g.gainEnergy(1); }
    },
  },
  {
    id: 'mere_stone', name: 'Mere-Stone', rarity: 'common', icon: 'stone', tint: '#7a8a94',
    desc: 'Start each combat with 1 Guard.',
    flavor: 'Worn smooth by a century of a drowned queen\'s fingers.',
    combatStart(g) { g.applySelf('guard', 1); },
  },
  {
    id: 'wolfs_tooth', name: 'Wolf\'s Tooth', rarity: 'common', icon: 'tooth', tint: '#e8dcc0',
    desc: 'Start each combat with 1 Might.',
    flavor: 'Pulled from one of the Hound-Lord\'s pack. It still wants to bite something.',
    combatStart(g) { g.applySelf('might', 1); },
  },
  {
    id: 'coffin_pillow', name: 'Coffin Pillow', rarity: 'common', icon: 'moon', tint: '#b9a7c9',
    desc: 'Resting at a rest site heals 15 more HP.',
    flavor: 'Stuffed with lavender and grave-wool. Hob insists you take it. "Not using it yet."',
    restHealAdd() { return 15; },
  },
  {
    id: 'bloodroot', name: 'Bloodroot', rarity: 'common', icon: 'flower', tint: '#b5536b',
    desc: 'Raise your Max HP by 7.',
    flavor: 'It grows where the Blight has passed. Bitter, red, and stubbornly alive.',
    pickup(g) { g.gainMaxHp(7); },
  },
  {
    id: 'apothecary_belt', name: 'Apothecary\'s Belt', rarity: 'common', icon: 'pouch', tint: '#7a5a3a',
    desc: 'Gain 2 Tincture slots.',
    flavor: 'Loops for twelve vials. The plague doctor who owned it needed eleven.',
    pickup(g) { g.addPotionSlots(2); },
  },
  {
    id: 'plague_doctors_mask', name: 'Plague Doctor\'s Mask', rarity: 'common', icon: 'mask', tint: '#d8cfb8',
    desc: 'Whenever you use a Tincture, heal 5 HP.',
    flavor: 'The beak is packed with rue and clove. It keeps out the stench, if not the Blight.',
    potionUsed(g) { healAny(g, 5); },
  },
  {
    id: 'war_horn', name: 'War Horn', rarity: 'common', icon: 'horn', tint: '#c4501e',
    desc: 'Start each combat with 8 Vigor.',
    flavor: 'It sounded the charge at the Battle of Greyford. Nobody who heard it walked away.',
    combatStart(g) { g.applySelf('vigor', 8); },
  },
  {
    id: 'hobs_tea', name: 'Hob\'s Tea Tin', rarity: 'common', icon: 'bowl', tint: '#6e5039',
    desc: 'Whenever you Rest at a rest site, gain 2 Energy on the first turn of your next combat.',
    flavor: 'Nettle, chicory, and something he will not name. "Puts the life back in you. Mostly."',
    rested(g, r) { r.ready = true; },
    turnStart(g, r, turn) { if (turn === 1 && r.ready) { r.ready = false; g.gainEnergy(2); } },
  },
  {
    id: 'beggars_bowl', name: 'Beggar\'s Bowl', rarity: 'common', icon: 'bowl', tint: '#9e9a9c',
    desc: 'Whenever you enter a room, gain 12 Gold. Stops working the first time you buy anything at a shop.',
    flavor: 'The beggars of Ashgrave are never refused. No one remembers why that rule began.',
    canSpawn(g) { return g.run.act <= 2; },
    floorEnter(g, r) { if (!r.broken) g.gainGold(12); },
    purchase(g, r) { r.broken = true; },
  },
  {
    id: 'peddlers_token', name: 'Peddler\'s Token', rarity: 'common', icon: 'coin', tint: '#d8cfb8',
    desc: 'Whenever you enter a shop, heal 15 HP.',
    flavor: 'Porcelain, painted with a smile. Present it and the Peddler pours you something warm.',
    shopEnter(g) { g.healOut(15); },
  },
  {
    id: 'witch_bottle', name: 'Witch-Bottle', rarity: 'common', icon: 'bottle', tint: '#8fae3a', counter: 2,
    desc: 'Negate the next 2 Curses you would obtain.',
    flavor: 'Bent pins, rosemary, and a little of your own blood. Bury it by the door.',
    curseBlock(g, r) { return (r.n || 0) > 0 ? 1 : 0; },
  },

  // ================================================================ UNCOMMON
  {
    id: 'headsmans_quill', name: 'Headsman\'s Quill', rarity: 'uncommon', icon: 'quill', tint: '#5e1f3d', counter: 0,
    desc: 'Every 10th Attack you play deals double damage.',
    flavor: 'Every name he wrote, he later struck through.',
    atkMul(g, r, ctx) {
      return ctx && ctx.card && (r.n || 0) >= 9 && isType(g, ctx.card, 'attack') ? 2 : 1;
    },
    cardPlayed(g, r, card) { if (isType(g, card, 'attack')) r.n = ((r.n || 0) + 1) % 10; },
  },
  {
    id: 'book_of_hours', name: 'Book of Hours', rarity: 'uncommon', icon: 'book', tint: '#c9a227',
    desc: 'If you play no Attacks during your turn, gain 1 Energy next turn.',
    flavor: 'A prayer for every hour. The pages for the hours after Ashfall are blank.',
    turnEnd(g) { if (g.cb && g.cnt.attacks === 0) g.applySelf('next_energy', 1); },
  },
  {
    id: 'knucklebones', name: 'Knucklebones', rarity: 'uncommon', icon: 'dice', tint: '#e8dcc0',
    desc: 'Whenever you play 3 Attacks in a single turn, gain 1 Might.',
    flavor: 'The Royal Guard gambled with them on watch. They are still waiting for someone to throw.',
    turnStart(g, r) { r.c = 0; },
    cardPlayed(g, r, card) {
      if (!isType(g, card, 'attack')) return;
      r.c = (r.c || 0) + 1;
      if (r.c % 3 === 0) g.applySelf('might', 1);
    },
  },
  {
    id: 'seal_breaker', name: 'Seal-Breaker', rarity: 'uncommon', icon: 'dagger', tint: '#9e9a9c',
    desc: 'Whenever you play 3 Skills in a single turn, deal 5 damage to ALL enemies.',
    flavor: 'A letter-knife from the Regent\'s desk. It has opened a great many secrets, and a few throats.',
    turnStart(g, r) { r.c = 0; },
    cardPlayed(g, r, card) {
      if (!isType(g, card, 'skill')) return;
      r.c = (r.c || 0) + 1;
      if (r.c % 3 === 0) spellAll(g, 5);
    },
  },
  {
    id: 'scriveners_ink', name: 'Scrivener\'s Ink', rarity: 'uncommon', icon: 'scroll', tint: '#16131a', counter: 0,
    desc: 'Every 10 cards you play, draw 1 card.',
    flavor: 'Oak-gall and iron. The monks of the Drowned Abbey wrote with it until the water rose.',
    cardPlayed(g, r) {
      r.n = (r.n || 0) + 1;
      if (r.n >= 10) { r.n = 0; g.draw(1); }
    },
  },
  {
    id: 'plague_censer', name: 'Plague Censer', rarity: 'uncommon', icon: 'lantern', tint: '#8fae3a',
    desc: 'At the start of your turn, deal 3 damage to ALL enemies.',
    flavor: 'They swung these through the plague villages to purify the air. It made things worse.',
    turnStart(g) { spellAll(g, 3); },
  },
  {
    id: 'raven_feather', name: 'Raven Feather', rarity: 'uncommon', icon: 'feather', tint: '#342c3b',
    desc: 'Whenever an enemy dies, gain 1 Energy and draw 1 card.',
    flavor: 'The ravens of Morrow grew fat on Ashfall. They are always first to know.',
    enemyDied(g) {
      if (!g.cb || g.cb.phase === 'over' || !g.enemies.length) return;
      g.gainEnergy(1);
      g.draw(1);
    },
  },
  {
    id: 'marrow_bone', name: 'Marrow Bone', rarity: 'uncommon', icon: 'bone', tint: '#d9c7b8',
    desc: 'If your HP is at or below half at the end of combat, heal 12 HP.',
    flavor: 'Crack it, suck it, live another day. The first rule of the Marches.',
    combatEnd(g, r, won) { if (won && P(g).hp <= P(g).maxHp / 2) g.healPlayer(12); },
  },
  {
    id: 'clay_effigy', name: 'Clay Effigy', rarity: 'uncommon', icon: 'idol', tint: '#a0603a',
    desc: 'Whenever you lose HP in combat, gain 3 Block next turn.',
    flavor: 'Hedge-witches mould them in your likeness. It takes the next blow, and the one after.',
    hpLost(g, r, e) { if (e && e.isPlayer && g.cb && g.cb.phase !== 'over') g.addStatus(P(g), 'next_block', 3); },
  },
  {
    id: 'saints_finger', name: 'Saint\'s Finger', rarity: 'uncommon', icon: 'hand', tint: '#e8dcc0',
    desc: 'At the start of each boss combat, heal 25 HP.',
    flavor: 'Saint Odile\'s, in a silver sleeve. There are nine of her fingers in Morrow. She had ten.',
    combatStart(g) { if (g.cb.kind === 'boss') g.healPlayer(25); },
  },
  {
    id: 'hedge_witchs_cards', name: 'Hedge-Witch\'s Cards', rarity: 'uncommon', icon: 'eye', tint: '#7b5aa6',
    desc: 'Card rewards contain 1 more card.',
    flavor: 'Every reading is the same now: the Tower, the Crown, and the Hanged Man.',
    cardChoices() { return 1; },
  },
  {
    id: 'sin_eaters_bread', name: 'Sin-Eater\'s Bread', rarity: 'uncommon', icon: 'bowl', tint: '#c9a77a',
    desc: 'Whenever you obtain a Curse, raise your Max HP by 6.',
    flavor: 'Laid on the breast of the dead and eaten by a stranger, who takes the sins as his own.',
    cardAdded(g, r, card) { if (isType(g, card, 'curse')) g.gainMaxHp(6); },
  },
  {
    id: 'widows_ring', name: 'Widow\'s Ring', rarity: 'uncommon', icon: 'ring', tint: '#5a5f66',
    desc: 'Whenever you Exhaust a card, gain 2 Block.',
    flavor: 'Iron, not gold. Gold is for the living.',
    cardExhausted(g) { if (g.cb && g.cb.phase !== 'over') g.gainBlock(P(g), 2, { raw: true }); },
  },
  {
    id: 'poachers_snare', name: 'Poacher\'s Snare', rarity: 'uncommon', icon: 'chain', tint: '#5a5f66',
    desc: 'Elites start combat with 25% less HP.',
    flavor: 'Set for the King\'s deer. In the Weeping Wood, something larger keeps springing it.',
    combatStart(g) {
      if (g.cb.kind !== 'elite') return;
      for (const e of g.enemies) {
        const n = Math.floor(e.hp * 0.25);
        if (n > 0) { e.hp -= n; g.emit('hploss', { e, n, type: 'relic' }); }
      }
    },
  },
  {
    id: 'pilgrims_shell', name: 'Pilgrim\'s Shell', rarity: 'uncommon', icon: 'shell', tint: '#e8dcc0', tier: 1,
    desc: 'Whenever you enter a rest site, heal 3 HP for every 5 cards in your deck.',
    flavor: 'Worn by those who walked to Ashgrave to see the Long King. Now they walk away from it.',
    floorEnter(g, r, type) { if (type === 'rest') g.healOut(Math.floor(g.run.deck.length / 5) * 3); },
  },

  // ================================================================ RARE
  {
    id: 'stolen_hour', name: 'The Stolen Hour', rarity: 'rare', icon: 'locket', tint: '#c9a227', counter: 1, tier: 1,
    desc: 'When you would die, heal to 50% of your Max HP instead. Works once.',
    flavor: 'An hour the Crown forgot to hold, folded small and hidden in a locket. Spend it well.',
    revive(g, r) {
      if (!r.n) return false;
      r.n = 0;
      P(g).hp = Math.max(1, Math.floor(P(g).maxHp * 0.5));
      return true;
    },
  },
  {
    id: 'old_guard_whetstone', name: 'Whetstone of the Old Guard', rarity: 'rare', icon: 'stone', tint: '#8e98a3', counter: 0,
    desc: 'Rest sites gain "Hone": permanently start each combat with 1 more Might (up to 3).',
    flavor: 'The Royal Guard sharpened their blades on it every dawn for ninety years. It is worn to a sliver.',
    combatStart(g, r) { if (r.n) g.applySelf('might', r.n); },
    restOption: {
      id: 'hone', label: 'Hone', icon: 'stone',
      desc: 'Permanently start each combat with 1 more Might.',
      can(g, r) { return (r.n || 0) < 3; },
      use(g, r) { r.n = (r.n || 0) + 1; return true; },
    },
  },
  {
    id: 'hobs_pipe', name: 'Hob\'s Pipe', rarity: 'rare', icon: 'pipe', tint: '#6e5039',
    desc: 'Rest sites gain "Smoke": remove a card from your deck.',
    flavor: 'Clay, chipped, and older than it has any right to be. The smoke smells like rain on fresh earth.',
    restOption: {
      id: 'smoke', label: 'Smoke', icon: 'pipe',
      desc: 'Remove a card from your deck.',
      can(g) { return g.run.deck.some((c) => !CARDS[c.id].unremovable); },
      async use(g) { const p = await g.removeCardChoice(1); return p.length > 0; },
    },
  },
  {
    id: 'rampart_chain', name: 'Rampart Chain', rarity: 'rare', icon: 'chain', tint: '#8e98a3',
    desc: 'At the start of your turn, lose only 15 Block instead of all of it.',
    flavor: 'It once held the portcullis of Ashgrave\'s Gate. The gate fell. The chain did not.',
    combatStart(g, r) { r.keep = 0; },
    roundEnd(g, r) {
      const p = P(g);
      r.keep = p.st.bulwark || p.st.barricade ? 0 : Math.max(0, p.block - 15);
    },
    turnStart(g, r) {
      if (!r.keep) return;
      const p = P(g);
      p.block = Math.min(999, p.block + r.keep);
      g.emit('block', { e: p, n: r.keep });
      r.keep = 0;
    },
  },
  {
    id: 'withered_hand', name: 'Withered Hand', rarity: 'rare', icon: 'hand', tint: '#7a6a5a',
    desc: 'Whenever you play a Power, a random card in your hand costs 0 this turn.',
    flavor: 'A hand of glory, cut from a hanged thief. It still knows how to open things.',
    cardPlayed(g, r, card) {
      if (!isType(g, card, 'power')) return;
      const opts = g.hand.filter((c) => { const k = g.cardCost(c); return typeof k === 'number' && k > 0; });
      if (opts.length) pick(g.srng, opts).costTurn = 0;
    },
  },
  {
    id: 'wayside_shrine', name: 'Wayside Shrine', rarity: 'rare', icon: 'idol', tint: '#d8cfb8',
    desc: 'Whenever an enemy attack would deal 5 or less damage to you, it deals 1 instead.',
    flavor: 'A saint no bigger than your thumb, her face rubbed away by a thousand prayers for small mercies.',
    modDamageTaken(g, r, a, opts) { return opts && opts.type === 'attack' && a > 1 && a <= 5 ? 1 : a; },
  },
  {
    id: 'leaden_heart', name: 'Leaden Heart', rarity: 'rare', icon: 'heart', tint: '#5a5f66',
    desc: 'Whenever you would lose HP, lose 1 less.',
    flavor: 'Embalmers of the old kings replaced the heart with lead, so it could never be stolen.',
    modHpLoss(g, r, n) { return Math.max(0, n - 1); },
  },
  {
    id: 'fools_top', name: 'Fool\'s Top', rarity: 'rare', icon: 'dice', tint: '#b5536b', tier: 2,
    desc: 'Whenever your hand is empty during your turn, draw 1 card.',
    flavor: 'Pell spins it on his palm while he talks. It has never once fallen over.',
    cardPlayed(g) { if (g.cb && g.cb.phase === 'player' && g.hand.length === 0) g.draw(1); },
    cardDiscarded(g) { if (g.cb && g.cb.phase === 'player' && !g.cb.playing && g.hand.length === 0) g.draw(1); },
  },
  {
    id: 'weeping_branch', name: 'Weeping Branch', rarity: 'rare', icon: 'flower', tint: '#3d5226', tier: 2,
    desc: 'Whenever you Exhaust a card, add a random card to your hand.',
    flavor: 'Cut from the Weeping Wood. Where it drips, something new always grows.',
    cardExhausted(g) {
      if (!g.cb || g.cb.phase === 'over') return;
      const [id] = g.randomCards({ count: 1, rng: g.srng });
      if (id) g.addCard(id, 'hand');
    },
  },
  {
    id: 'mourning_censer', name: 'Mourning Censer', rarity: 'rare', icon: 'lantern', tint: '#a9c6c2', counter: 0, tier: 1,
    desc: 'Every 6 turns, gain 1 Phantasm.',
    flavor: 'Burn myrrh for the dead and, for a moment, you become one of them.',
    turnStart(g, r) {
      r.n = (r.n || 0) + 1;
      if (r.n >= 6) { r.n = 0; g.applySelf('phantasm', 1); }
    },
  },

  // ================================================================ BOSS
  {
    id: 'ossuary_key', name: 'Ossuary Key', rarity: 'boss', icon: 'key', tint: '#d8cfb8',
    desc: 'Gain 1 Energy each turn. Whenever you open a chest, obtain a random Curse.',
    flavor: 'It opens every bone-house in Morrow. Something always follows you out.',
    maxEnergy() { return 1; },
    chestOpened(g) { g.addToDeck(pick(g.run.rng.misc, CHEST_CURSES)); },
  },
  {
    id: 'grave_penny', name: 'Grave-Penny', rarity: 'boss', icon: 'coin', tint: '#7a8a6a',
    desc: 'Gain 1 Energy each turn. You can no longer gain Gold.',
    flavor: 'Taken from a dead man\'s eye. He still wants it back, and so does every merchant in Morrow.',
    maxEnergy() { return 1; },
    noGold() { return 1; },
  },
  {
    id: 'tarnished_circlet', name: 'Tarnished Circlet', rarity: 'boss', icon: 'crown', tint: '#8a7a4a',
    desc: 'Gain 1 Energy each turn. Card rewards contain 2 fewer cards.',
    flavor: 'A pretender\'s crown, hammered out of church plate. The Hollow Crown did not call him.',
    maxEnergy() { return 1; },
    cardChoices() { return -2; },
  },
  {
    id: 'anvil_of_aldane', name: 'Anvil of Aldane', rarity: 'boss', icon: 'stone', tint: '#3a3a40',
    desc: 'Gain 1 Energy each turn. You can no longer Smith at rest sites.',
    flavor: 'Aldane the Founder forged the first crown of Morrow upon it. It has refused every hammer since.',
    canSpawn(g) { return !g.hasRelic('crown_splinter'); },
    maxEnergy() { return 1; },
    noSmith() { return 1; },
  },
  {
    id: 'blight_heart', name: 'Blight-Heart', rarity: 'boss', icon: 'heart', tint: '#5c7a2a',
    desc: 'Gain 1 Energy each turn. ALL enemies start combat with 1 Might.',
    flavor: 'Still beating, softly, in a nest of black roots. The rot feeds you. It feeds them more.',
    maxEnergy() { return 1; },
    combatStart(g) { for (const e of g.enemies) g.apply(e, 'might', 1, e); },
  },
  {
    id: 'scolds_bridle', name: 'Scold\'s Bridle', rarity: 'boss', icon: 'chain', tint: '#5a5f66',
    desc: 'Gain 1 Energy each turn. You cannot play more than 6 cards each turn.',
    flavor: 'An iron cage for the head, with a spike for the tongue. The Witchfinder had a cartful.',
    maxEnergy() { return 1; },
    canPlay(g) { return !g.cb || g.cnt.cards < 6; },
  },
  {
    id: 'fools_eye', name: 'The Fool\'s Eye', rarity: 'boss', icon: 'eye', tint: '#b49ad6',
    desc: 'Draw 2 more cards each turn. Whenever you draw a card, its cost becomes random (0-3) for this combat.',
    flavor: 'A glass eye in motley colours. Look through it and nothing costs what it should.',
    drawMod() { return 2; },
    cardDrawn(g, r, card) {
      const c = g.baseCost(card);
      if (typeof c === 'number' && c >= 0) card.costCombat = int(g.srng, 0, 3);
    },
  },
  {
    id: 'long_kings_hourglass', name: 'The Long King\'s Hourglass', rarity: 'boss', icon: 'hourglass', tint: '#e8dcc0',
    desc: 'At the end of your turn, you no longer discard your hand.',
    flavor: 'It stood by his bed for ninety-one years. The sand has not moved since Ashfall.',
    retainAll() { return 1; },
  },

  // ================================================================ SHOP
  {
    id: 'peddlers_smile', name: 'The Peddler\'s Smile', rarity: 'shop', icon: 'mask', tint: '#e8dcc0',
    desc: 'Removing a card at a shop always costs 50 Gold.',
    flavor: 'Porcelain, cracked across one cheek. "Keep it. I have another."',
    pickup(g) { if (g.run.shop && !g.run.shop.removed) g.run.shop.removePrice = smilePrice(g); },
    shopEnter(g) { if (g.run.shop) g.run.shop.removePrice = smilePrice(g); },
  },
  {
    id: 'peddlers_favour', name: 'Peddler\'s Favour', rarity: 'shop', icon: 'scroll', tint: '#c9a227',
    desc: 'Shop prices are halved.',
    flavor: 'A writ of credit signed with a jester\'s cap. "Old friends pay old prices."',
    priceMul() { return 0.5; },
    pickup(g) {
      const s = g.run.shop;
      if (!s) return;
      for (const k of ['cards', 'relics', 'potions']) for (const it of s[k] || []) if (!it.sold) it.price = Math.round(it.price * 0.5);
      if (!s.removed) s.removePrice = Math.round(s.removePrice * 0.5);
    },
  },
  {
    id: 'peddlers_spoon', name: 'Peddler\'s Spoon', rarity: 'shop', icon: 'spoon', tint: '#b9d3e0',
    desc: 'Whenever you Exhaust a card that is not a Curse or Status, 50% chance to put it in your discard pile instead.',
    flavor: 'Silver, bent double. "It stirs things back up. Don\'t ask me how."',
    cardExhausted(g, r, card) {
      if (!g.cb || g.cb.phase === 'over') return;
      const t = CARDS[card.id].type;
      if (t === 'curse' || t === 'status' || t === 'power') return;
      if (!chance(g.crng, 0.5)) return;
      const i = g.cb.exhaust.indexOf(card);
      if (i < 0) return;
      g.cb.exhaust.splice(i, 1);
      g.cb.discard.push(card);
      g.emit('addCard', { card, where: 'discard' });
    },
  },
  {
    id: 'funeral_wine', name: 'Funeral Wine', rarity: 'shop', icon: 'chalice', tint: '#5e1f3d',
    desc: 'Raise your Max HP by 7. Heal all of your HP.',
    flavor: 'Poured at every wake in Morrow, back when there were wakes. This bottle has waited a long time.',
    pickup(g) { g.gainMaxHp(7); g.healOut(P(g).maxHp); },
  },

  // ================================================================ SPECIAL (events)
  {
    id: 'hobs_spade', name: 'Hob\'s Spade', rarity: 'special', icon: 'spoon', tint: '#7a5a3a',
    desc: 'Rest sites gain "Dig": obtain a random relic.',
    flavor: 'The handle is worn to the shape of his hands. He has dug a great many graves with it. Some of them twice.',
    restOption: {
      id: 'dig', label: 'Dig', icon: 'spoon',
      desc: 'Obtain a random relic.',
      use(g) { return !!g.obtainRelic(); },
    },
  },
  {
    id: 'pells_bell', name: 'Pell\'s Bell', rarity: 'special', icon: 'bell', tint: '#c9a227',
    desc: 'At the start of each combat, apply 1 Weakened and 1 Exposed to ALL enemies.',
    flavor: 'Torn from the Fool\'s cap. It rings when nobody shakes it, always in the wrong key.',
    combatStart(g) { g.applyAll('weak', 1); g.applyAll('exposed', 1); },
  },
  {
    id: 'kings_signet', name: 'The King\'s Signet', rarity: 'special', icon: 'ring', tint: '#c9a227',
    desc: 'Shop prices are 25% lower. Elites drop 15 more Gold.',
    flavor: 'Aldric IV\'s seal-ring. It still opens doors in Ashgrave, though the hand that wore it is cold.',
    priceMul() { return 0.75; },
    combatEnd(g, r, won) { if (won && g.cb && g.cb.kind === 'elite') g.gainGold(15); },
  },
  {
    id: 'maren_locket', name: 'Maren\'s Locket', rarity: 'special', icon: 'locket', tint: '#b9d3e0',
    desc: 'Start each combat with 1 Ward and 3 Plating.',
    flavor: 'Inside, a curl of dark hair and a space where a second portrait was scratched away.',
    combatStart(g) { g.applySelf('ward', 1); g.applySelf('plating', 3); },
  },
  {
    id: 'founders_nail', name: 'The Founder\'s Nail', rarity: 'special', icon: 'nail', tint: '#5a5f66',
    desc: 'Gain 1 Energy each turn. At the start of each combat, shuffle a Regret into your draw pile.',
    flavor: 'Hammered from the same iron as the Crown. It remembers being a promise.',
    maxEnergy() { return 1; },
    combatStart(g) { g.addCard('regret', 'draw'); },
  },
  {
    id: 'witchfinders_brand', name: 'Witchfinder\'s Brand', rarity: 'special', icon: 'sun', tint: '#c4501e',
    desc: 'Whenever an enemy dies, deal 5 damage to ALL enemies.',
    flavor: 'Grall\'s iron, still warm. Guilt, it seems, is catching.',
    enemyDied(g) { if (g.cb && g.cb.phase !== 'over' && g.enemies.length) spellAll(g, 5); },
  },
  {
    id: 'drowned_rosary', name: 'Drowned Rosary', rarity: 'special', icon: 'rosary', tint: '#2f4a5a',
    desc: 'At the start of your turn, if you have no Block, gain 4 Block.',
    flavor: 'Recovered from the abbey mere, beads swollen with black water. The prayers on it never finished.',
    turnStart(g) { if (P(g).block === 0) g.gainBlock(P(g), 4, { raw: true }); },
  },
  {
    id: 'antler_shard', name: 'Antler of the Old King', rarity: 'special', icon: 'horn', tint: '#d8cfb8',
    desc: 'Start each combat with 2 Thorns and 2 Plating.',
    flavor: 'Broken from the Antlered King\'s crown in some forgotten war. The Wood still wants it back.',
    combatStart(g) { g.applySelf('thorns', 2); g.applySelf('plating', 2); },
  },
  {
    id: 'severed_oath', name: 'Severed Oath', rarity: 'special', icon: 'scroll', tint: '#8a1c1c',
    desc: 'Start each combat with 2 Might. Lose 1 HP at the start of each of your turns.',
    flavor: 'A vow on vellum, cut clean through. What was sworn still bleeds.',
    combatStart(g) { g.applySelf('might', 2); },
    turnStart(g) { g.loseHp(P(g), 1, { type: 'hploss' }); },
  },
  {
    id: 'mothers_seed', name: 'The Mother\'s Seed', rarity: 'special', icon: 'seed', tint: '#8fae3a',
    desc: 'Whenever you win a combat, raise your Max HP by 1.',
    flavor: 'Pale and warm as a sleeping thing. Under the hill, something is waiting for spring.',
    combatEnd(g, r, won) { if (won) g.gainMaxHp(1); },
  },
  {
    id: 'crown_splinter', name: 'Splinter of the Crown', rarity: 'special', icon: 'crown', tint: '#5a5f66',
    desc: 'Gain 1 Energy each turn. You can no longer Rest at rest sites.',
    flavor: 'A sliver of black iron that will not stay in its box. It does not let you sleep. It does not need you to.',
    maxEnergy() { return 1; },
    noRest() { return 1; },
  },
  {
    id: 'grave_lantern', name: 'Grave Lantern', rarity: 'special', icon: 'lantern', tint: '#f0d27a',
    desc: 'Draw 2 more cards on the first turn of each combat.',
    flavor: 'Hob hangs one over every fresh grave, "so they can find their way out, if they must."',
    drawMod(g, r, first) { return first ? 2 : 0; },
  },
  {
    id: 'regents_seal', name: 'The Regent\'s Seal', rarity: 'special', icon: 'sigil', tint: '#8a1c1c',
    desc: 'Start each combat with 10 Block. Gain 10 Gold after each combat.',
    flavor: 'Crane\'s wax, Crane\'s crest. Every door in Ashgrave opens for it, and every door is watched.',
    turnStart(g, r, turn) { if (turn === 1) g.gainBlock(P(g), 10, { raw: true }); },
    combatEnd(g, r, won) { if (won) g.gainGold(10); },
  },
]);

function smilePrice(g) { return Math.max(1, Math.round(50 * g.mulMod(g.player, 'priceMul'))); }
