import { defineHeroes, HEROES } from '../engine/registry.js';

// Each hero agent may tune ONLY its own entry (deck, hp, relic).
defineHeroes([
  {
    id: 'knight', name: 'Aldous Vane', title: 'the Disgraced Knight', claim: 'Blood',
    hp: 80, gold: 99, color: '#8e98a3', accent: '#c9a227', sprite: 'hero_knight',
    deck: ['strike_knight', 'strike_knight', 'strike_knight', 'strike_knight', 'strike_knight',
      'defend_knight', 'defend_knight', 'defend_knight', 'defend_knight', 'vow_of_the_wall'],
    relic: 'broken_sigil',
    blurb: 'The king\'s bastard son, once his Shield. He stood at the door and did nothing.',
    mechanic: 'Swears Oaths — goals that pay out when fulfilled. Builds Might and Bulwark.',
  },
  {
    id: 'witch', name: 'Isolde Marrow', title: 'the Plague Witch', claim: 'Kin',
    hp: 70, gold: 99, color: '#8fae3a', accent: '#d8cfb8', sprite: 'hero_witch',
    deck: ['strike_witch', 'strike_witch', 'strike_witch', 'strike_witch', 'strike_witch',
      'defend_witch', 'defend_witch', 'defend_witch', 'defend_witch', 'blightseed'],
    relic: 'mortar_and_pestle',
    blurb: 'The king\'s niece, banished for rot-craft. She means to cure the Blight.',
    mechanic: 'Spreads Rot, Brews Draughts, and Withers her foes.',
  },
  {
    id: 'wren', name: 'Wren', title: 'the Changeling', claim: 'Ward',
    hp: 66, gold: 99, color: '#7b5aa6', accent: '#b9d3e0', sprite: 'hero_wren',
    deck: ['strike_wren', 'strike_wren', 'strike_wren', 'strike_wren', 'strike_wren',
      'defend_wren', 'defend_wren', 'defend_wren', 'defend_wren', 'borrowed_face'],
    relic: 'carved_mask',
    blurb: 'A faceless foundling, raised as the king\'s ward. Wren wears what faces they find.',
    mechanic: 'Shifts between Wolf, Moth and Owl Masks. Mimics and throws Knives.',
  },
  {
    id: 'cantor', name: 'Brother Cael', title: 'the Gravecantor', claim: 'Witness',
    hp: 72, gold: 99, color: '#f0d27a', accent: '#7a767a', sprite: 'hero_cantor',
    deck: ['strike_cantor', 'strike_cantor', 'strike_cantor', 'strike_cantor',
      'defend_cantor', 'defend_cantor', 'defend_cantor', 'defend_cantor', 'call_the_wisp', 'requiem'],
    relic: 'bone_rosary',
    blurb: 'The king\'s confessor. He heard the last confession, and he carries it still.',
    mechanic: 'Channels Spirits that act each turn, and Releases them. Bleeds for power.',
  },
]);

// ---------------------------------------------------------------- hero actions
// Every hero has free Strike and Guard buttons (defaults in engine/actions.js, override with
// `actions: { strike: { dmg }, guard: { blk }, meterMax }`) and one Special that charges as you
// play cards, take hits and Brace. `use(g, target)` may be async; `target` is 'enemy' or 'none'.
const MASKS = ['wolf', 'moth', 'owl'];
Object.assign(HEROES.knight, {
  special: {
    name: 'Shield Bash', icon: 'act_special_knight', target: 'enemy',
    desc: 'Deal 12 damage and gain 8 Block.',
    use(g, t) { g.attack(t, 12); g.block(8); },
  },
});
Object.assign(HEROES.witch, {
  special: {
    name: 'Plague Burst', icon: 'act_special_witch', target: 'none',
    desc: 'Apply 6 Rot to ALL enemies. Brew 1.',
    use(g) { g.applyAll('rot', 6); g.brew(1); },
  },
});
Object.assign(HEROES.wren, {
  special: {
    name: 'Shift & Slash', icon: 'act_special_wren', target: 'none',
    desc: 'Shift to your next Mask. Add 2 Knives to your hand.',
    use(g) {
      const i = MASKS.indexOf(g.cb.mask);
      g.setMask(MASKS[(i + 1) % MASKS.length]);
      g.addCard('knife', 'hand');
      g.addCard('knife', 'hand');
    },
  },
});
Object.assign(HEROES.cantor, {
  special: {
    name: 'Toll the Bell', icon: 'act_special_cantor', target: 'none',
    desc: 'Release all Spirits, Channel a Wisp, and gain 6 Block.',
    use(g) { g.releaseAll(); g.channel('wisp'); g.block(6); },
  },
});
