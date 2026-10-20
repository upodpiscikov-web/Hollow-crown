// Act 1 events: the Ashen Marches. Grey fen, gibbets, plague villages, ash-snow,
// and people stuck in the morning after Ashfall without knowing it.
// Helpers are exported for any.js.
import { defineEvents, CARDS, RELICS, ENEMIES, ENCOUNTERS } from '../../engine/registry.js';
import { rnd, pick } from '../../engine/rng.js';

// ------------------------------------------------------------------ helpers
export const P = (...paras) => paras.filter(Boolean).join('\n\n');
export const isHero = (id) => (g) => g.run.hero === id;
export const byHero = (g, map) => map[g.run.hero] ?? map.def ?? '';
export const roll = (g) => rnd(g.run.rng.events);
export const hasGold = (n) => (g) => g.run.gold >= n || `You need ${n} gold.`;
export const hasHp = (n) => (g) => g.player.hp > n || 'You are too weak.';
export const hasRoom = (g) => g.run.potions.includes(null) || 'Your tincture belt is full.';
export const removable = (g) => g.run.deck.filter((c) => CARDS[c.id] && !CARDS[c.id].unremovable);
export const curses = (g) => g.run.deck.filter((c) => CARDS[c.id] && CARDS[c.id].type === 'curse' && !CARDS[c.id].unremovable);

// Add a curse; falls back to the base curse if a teammate's id is missing.
export function curse(g, id) { return g.addToDeck(CARDS[id] ? id : 'regret'); }

// Grant a special relic, or a tier relic if it is missing / already owned.
export function relic(g, id, fallback = 'uncommon') {
  if (id && RELICS[id] && !g.hasRelic(id)) { g.obtainRelic(id); return id; }
  return g.obtainRelic(fallback);
}

// Pick a relic id now for a post-fight reward (special if available, else from the pool).
export function rewardRelic(g, id, rarity = 'common') {
  if (id && RELICS[id] && !g.hasRelic(id)) return id;
  return g.takeRelicFromPool(rarity) || 'random';
}

// Remove a random removable card (no choice).
export function removeRandom(g, list) {
  const pool = list || removable(g);
  if (!pool.length) return null;
  const c = pick(g.run.rng.events, pool);
  g.removeFromDeck(c);
  return c;
}

// Offer N random cards (falls back to the hero's pool if the requested one is empty).
export async function offerRandom(g, opts = {}, title) {
  const n = opts.count || 3;
  let ids = g.randomCards({ ...opts, count: n, rng: g.run.rng.events });
  if (!ids.length) ids = g.randomCards({ count: n, rarity: opts.rarity, rng: g.run.rng.events });
  if (!ids.length) ids = g.randomCards({ count: n, rng: g.run.rng.events });
  if (!ids.length) return null;
  return g.offerCards(opts.up ? ids.map((id) => ({ id, up: 1 })) : ids, { title, forced: !!opts.forced });
}

// Event fight. Uses the listed enemies if they all exist; otherwise a random
// encounter of the current act (so the event never breaks while enemies change).
// Returns the resume page id only if no fight could be started.
export async function fight(g, ids, opts = {}) {
  const { pool = 'easy', ...rest } = opts;
  let enemies = (ids || []).filter((id) => ENEMIES[id]);
  if (!ids || !ids.length || enemies.length < ids.length) {
    let list = Object.values(ENCOUNTERS).filter((e) => e.act === g.run.act && e.pool === pool && (!e.req || e.req(g)));
    if (!list.length) list = Object.values(ENCOUNTERS).filter((e) => e.act === g.run.act && (e.pool === 'easy' || e.pool === 'hard'));
    if (!list.length) return rest.resume;
    const enc = pick(g.run.rng.events, list);
    enemies = typeof enc.enemies === 'function' ? enc.enemies(g, g.run.rng.events) : enc.enemies;
  }
  await g.eventCombat(enemies, rest);
  return undefined;
}

const leave = (label = '[Leave]') => ({ label, end: true });

// Preferred Act 1 enemies for event fights (fallback: random Act 1 encounter).
const FOES = {
  wolves: ['marsh_wolf', 'marsh_wolf'],
  deserters: ['deserter', 'deserter_crossbow'],
  archer: ['deserter_crossbow'],
  rats: ['plague_rat', 'plague_rat', 'plague_rat'],
  corpse: ['risen_corpse'],
  cultists: ['ash_cultist', 'ash_cultist'],
  hunters: ['bounty_hunter', 'bounty_hunter'],
};

// ------------------------------------------------------------------ events
defineEvents([
  // ---------------------------------------------------------------- 1
  {
    id: 'a1_gibbet_choir', title: 'The Gibbet Choir', acts: [1], art: 'scene_gibbet',
    pages: {
      start: {
        text: (g) => P(
          'Six men hang from the gibbet at Sorrow Cross, and all six of them are singing.',
          'It is not a good song. It is a poacher\'s catch about a fat buck and a fatter sheriff, and they have plainly sung it a great many times. Their faces are the colour of the sky. Their ropes creak in time. Ash has settled on their shoulders like dandruff.',
          'The one on the end, the youngest, white-bearded and seventy if he\'s a day, breaks off when he sees you. "Sheriff hangs us every morning," he says, around the rope. "Dawn, regular as bells. We don\'t die. Next day he comes back and hangs us again. Very particular man." He turns a little in the wind. "Don\'t suppose you\'ve a knife?"',
          byHero(g, {
            knight: 'You know his face. Dickon Fletch. You arrested him yourself, years ago, for the same buck, and let him off because his mother cried. He knows you too. "Captain," he says, without rancour.',
            witch: 'Out of habit you reach up and take his wrist. No pulse. Skin as warm as new bread. He watches you with polite interest while you think about that.',
            wren: '"What does it feel like?" you ask. He gives the question real thought. "Like waiting to sneeze," he says at last. "For ever."',
            cantor: '"You\'ve a look about you, Brother," he says kindly. "Like you\'ve been where we are. No offence meant."',
          }),
        ),
        choices: [
          { label: '[Cut them down] Lose 5 HP. Gain 45 Gold.', req: hasHp(5), fx(g) { g.hurt(5); g.gainGold(45); return 'cut'; } },
          { label: '[Ask who hangs them] Learn of the Sheriff.', fx(g) { g.unlockLore('lore_hanged_sheriff'); g.unlockLore('lore_letter_hanging_writ'); return 'sheriff'; } },
          { label: '[Sing along] Heal 10 HP.', fx(g) { g.healOut(10); return 'sing'; } },
          { label: '[Pay their fine under Forest Law] Lose 30 Gold. Obtain a relic.', show: isHero('knight'), req: hasGold(30), fx(g) { g.loseGold(30); relic(g, null, 'common'); return 'fine'; } },
          { label: '[Cut a length of hangman\'s rope] Obtain a Tincture.', show: isHero('witch'), req: hasRoom, fx(g) { g.obtainPotion(); return 'rope'; } },
          leave('[Leave them singing]'),
        ],
      },
      sheriff: {
        text: P(
          '"Thomas Gallow," says Dickon. "Sheriff of the Marches. Hanged two hundred of us, regular. Then his own deputies hanged *him*, night before Ashfall, for taking poachers\' bribes. Which is rich, seeing as he took ours."',
          '"Rope held. He didn\'t die. Cut himself down at dawn with the noose still on and went straight back to work. Keeps the King\'s peace like a man with something to prove. He hangs us to remind himself that hanging works."',
          'A writ is nailed to the gibbet post, the ink still glossy. It lists their names and their crime, and beneath, underlined three times: *to be repeated as necessary.*',
        ),
        choices: [
          { label: '[Cut them down] Lose 5 HP. Gain 45 Gold.', req: hasHp(5), fx(g) { g.hurt(5); g.gainGold(45); return 'cut'; } },
          leave('[Leave them singing]'),
        ],
      },
      cut: {
        text: P(
          'The rope is tarred and stiff, and the men come down one at a time, heavily, all elbows. The last of them lands on you. Something in your shoulder makes a noise you don\'t like.',
          'They stand about in the ash rubbing their necks, oddly shy. Then the eldest digs in his shirt and presses a purse on you, heavy with the silver they were hanged for. "Venison money," he says. "Never got to spend it. You have it."',
          'He looks east, toward the Sheriff\'s house. "He\'ll have us up again tomorrow, mind. But tonight we\'ll be home for supper."',
          'They go off down the road still singing, slightly better than before.',
        ),
        choices: [leave()],
      },
      sing: {
        text: P(
          'You don\'t know the words, but the chorus is mostly the word *buck*, and you pick it up fast.',
          'The Sorrow Cross choir is delighted. They take it from the top. They take it from the top again. By the fourth verse Dickon is weeping with laughter around his rope, and you find, absurdly, that your own chest has loosened: that something you have carried since the Waystone has been set down, for a while, in the ash.',
          'When you go, they call after you to come back tomorrow. They\'ll be here. They\'re always here.',
        ),
        choices: [leave()],
      },
      fine: {
        text: P(
          '"There is a writ for this," you tell them. "Forest Law. A poacher\'s neck may be redeemed at five shillings the head, payable to the Crown." You count it onto the gibbet step: thirty in silver, more than the law asks, but the law was written for younger men.',
          'Dickon stares at the coins. "Nobody\'s ever *paid* for us," he says.',
          '"Nobody ever read the writ," you say, and cut the first rope.',
          'Before they go, Dickon\'s father digs under the gibbet stone and brings up something wrapped in oilcloth: a thing they stole long ago and never dared to sell. "For the Captain," he says. "Who read the writ."',
        ),
        choices: [leave()],
      },
      rope: {
        text: P(
          'A hangman\'s rope is worth its weight in silver to anyone who knows what to do with it, and you know several things. You climb the post, select the cleanest length above Dickon\'s head, and saw at it with your knife.',
          '"Thief," says the eldest, upside down and deeply offended.',
          '"Witch," says the second.',
          '"Both," you agree, and climb down with your prize. By the time you reach the road the choir has started up again: a new verse, about you, and not complimentary. It rhymes *Isolde* with *mouldy*. You have heard worse. You have been called worse by bishops.',
        ),
        choices: [leave()],
      },
    },
  },

  // ---------------------------------------------------------------- 2
  {
    id: 'a1_long_wake', title: 'The Long Wake', acts: [1], art: 'scene_village',
    pages: {
      start: {
        text: (g) => P(
          'There is a wake in Brackwater, and the corpse is complaining about the soup.',
          'She sits upright in an open coffin on the kitchen table: Granny Hesketh, a hundred and twelve years old, dead since Ashfall night. Around her sit her great-grandchildren, grey-haired themselves, red-eyed with exhaustion in their funeral black.',
          '"Third time we\'ve buried her," a man mutters. "Third time she\'s walked home. Mud on the good rug, every time."',
          '"I can hear you, Edwin," says Granny Hesketh. "Too much salt in this. I\'m dead, not deaf." She fixes you with a filmy eye. "You. You\'ve the look of somebody who knows how this is meant to go. Can you make it *stick*?"',
          byHero(g, {
            cantor: 'When you offer the family your condolences, Edwin turns to his sister and asks if she heard something. Only the old woman in the coffin looks at you. "Don\'t mind them, Brother," she says. "They never could hear anything worth hearing."',
            witch: 'She is not breathing. Her colour is wrong for the living and wrong for the dead. You find you have taken a step closer without deciding to.',
          }),
        ),
        choices: [
          { label: '[Carry her to the churchyard] Lose 6 HP. Gain 50 Gold.', req: hasHp(6), fx(g) { g.hurt(6); g.gainGold(50); return 'carry'; } },
          { label: '[Ask what she needs]', fx(g) { g.unlockLore('lore_long_years'); return 'ask'; } },
          { label: '[Eat the funeral cake] Heal 15 HP.', fx(g) { g.healOut(15); return 'cake'; } },
          { label: '[Take a skin scraping] Obtain a Tincture.', show: isHero('witch'), req: hasRoom, fx(g) { g.obtainPotion(); return 'sample'; } },
          { label: '[Say the last rites over her] Upgrade a card.', show: isHero('cantor'), async fx(g) { await g.upgradeCardChoice(1); return 'rites'; } },
          leave(),
        ],
      },
      carry: {
        text: P(
          'Edwin takes the head, you take the foot, and two cousins take the middle. It is a mile to the churchyard through ankle-deep ash and knee-deep fen, and Granny Hesketh criticises every step of it.',
          '"Mind the bump. MIND the... Edwin, you great ox. When I was a girl we carried our dead *properly*."',
          '"When you were a girl," says Edwin through his teeth, "the dead had the decency to lie still."',
          'You lower her into the hole she climbed out of that morning. The family presses coins on you: a lot of coins, for people this poor. They have done the sum, you suspect. Your fee, against another day of this. "She\'ll be home by supper," says Edwin. "But it\'s the thought."',
        ),
        choices: [leave()],
      },
      ask: {
        text: P(
          'She beckons you close. Her breath smells of nothing at all.',
          '"Under the old king nobody died, you know. Not properly. I buried no one for ninety years. Not my mother, not my husband\'s mother, not the vicar, who was a hundred and sixty and blind as a mole. We all just went on. Getting older. Not getting *anywhere*."',
          '"My Ned went at Ashfall, same as me. He\'s out walking somewhere. Can\'t find his way back to his grave any more than I can stay in mine." She holds out her hand. Sunk into the knuckle is a thin gold ring. "Take it. It\'s no use to me. If you see him, give it back. Tell him I waited."',
        ),
        choices: [
          { label: '[Take the ring] Obtain a relic. Add Grief to your deck.', fx(g) { relic(g, null, 'uncommon'); curse(g, 'grief'); return 'ring'; } },
          { label: '[Close her hand over it]', next: 'refuse' },
        ],
      },
      ring: {
        text: P(
          'It slides off easily, as if it had been waiting. It is lighter than it looks and heavier than it should be.',
          '"There," says Granny Hesketh, and lies back in her coffin with her arms folded. "Now somebody put the lid on, and nobody bring me any more of that soup."',
          'You walk out of Brackwater with the ring in your pocket. It stays warm. Every so often, without meaning to, you find you have taken it out and are looking down the road, as though somebody might be coming along it.',
        ),
        choices: [leave()],
      },
      refuse: {
        text: P(
          'You fold her fingers back over the ring. "Give it him yourself," you say.',
          'She laughs, a dry sound like a hinge. "Cheek," she says, pleased. "You\'ll go far. Further than me, anyhow."',
          'When you leave, she is telling Edwin exactly where she wants to be buried this time, and which way she wants to face, and that if he puts her by the Pennywhistles again she will walk home on purpose.',
        ),
        choices: [leave()],
      },
      cake: {
        text: P(
          'The funeral cake is dense and dark, studded with fruit and soaked in something that makes your eyes water. It is the best thing you have eaten in a very long time.',
          '"Third batch," says the woman who cut it for you, wearily. "I bake one for every funeral. It goes stale faster than she stays dead."',
          'You eat two slices. The warmth of it goes all the way down. Behind you, as you leave, Granny Hesketh is asking whether anybody thought to save *her* a piece.',
        ),
        choices: [leave()],
      },
      sample: {
        text: P(
          '"Hold still," you tell the corpse.',
          '"I beg your pardon?"',
          'A thin scraping from the back of her hand; a nail paring; and, while she is still drawing breath to object, a single grey hair. Into the vials they go. No decay. No rigor. Tissue as fresh as if she died this morning, which, depending on how you count, she did.',
          '"Young woman," says Granny Hesketh, "in a hundred and twelve years I have never been so insulted."',
          '"Then you\'ve led a sheltered life," you say, corking the vial. "Lie down, madam. You\'re contaminating the sample."',
        ),
        choices: [leave()],
      },
      rites: {
        text: P(
          'You kneel by the coffin and begin the old words, the ones the Order taught you for a use you were never given. Around you the family goes on eating, talking, weeping. Edwin reaches past you for the salt. Not one of them looks your way.',
          'Granny Hesketh listens to every word. When you reach the commendation, she lays a cold hand on yours.',
          '"Not yet, Brother," she says gently. "It won\'t take. Somebody\'s got to ring the bell first, and nobody\'s rung it in a hundred years." She squeezes your fingers. "But thank you. Nobody\'s ever said that over me. You\'ve a lovely voice. Did anyone ever tell you?"',
        ),
        choices: [leave()],
      },
    },
  },

  // ---------------------------------------------------------------- 3
  {
    id: 'a1_ferryman', title: 'The Fen Ferry', acts: [1], art: 'scene_water',
    pages: {
      start: {
        text: (g) => P(
          'The causeway ends at black water, and the black water goes on.',
          'A flat boat waits in the reeds. The man poling it is tall and patient and so thin that the ash falls through his coat where the cloth has worn to lace. He holds out a hand without looking at you.',
          '"Toll," he says. "Silver, or a memory. I\'m not particular which. Silver spends. Memories keep."',
          'You reach for your purse, and he sighs. "You always pay in silver," he says. "Every night, same as the last. You\'ve crossed here before. You don\'t remember. They never remember." He tilts his head at the far bank, invisible in the murk. "Or you could wade it. Folk do. Some of them come out the other side."',
          byHero(g, { cantor: 'He glances at your habit and inclines his head, as one tradesman to another. "Brother."' }),
        ),
        choices: [
          { label: '[Pay in silver] Lose 25 Gold.', req: hasGold(25), fx(g) { g.loseGold(25); g.unlockLore('lore_ashen_marches'); return 'silver'; } },
          { label: '[Pay with a memory] Remove a random card from your deck.', req: (g) => removable(g).length > 0 || 'You have nothing he wants.', fx(g) { removeRandom(g); return 'memory'; } },
          { label: '[Wade across] Lose 8 HP. Obtain a Tincture.', req: hasHp(8), fx(g) { g.hurt(8); g.obtainPotion(); return 'wade'; } },
          { label: '[Ask how many times you have crossed]', next: 'ask' },
        ],
      },
      ask: {
        text: P(
          'He considers the question as if nobody has asked it before. Possibly nobody has.',
          '"Every night," he says. "Same as the ash. You come down the causeway, you reach for your purse, I tell you about memories, you ask me that." He shrugs, and his coat whispers. "Sometimes you\'re a big man with a sword. Sometimes a woman with green on her hands. Sometimes a thing with no face at all. Once a priest, who paid me in prayers, which I\'m not meant to take."',
          'He looks at you properly for the first time. His eyes are the colour of the water.',
          '"You\'re all the same passenger, I reckon. Now. Silver, or a memory?"',
        ),
        choices: [
          { label: '[Pay in silver] Lose 25 Gold.', req: hasGold(25), fx(g) { g.loseGold(25); g.unlockLore('lore_ashen_marches'); return 'silver'; } },
          { label: '[Pay with a memory] Remove a random card from your deck.', req: (g) => removable(g).length > 0 || 'You have nothing he wants.', fx(g) { removeRandom(g); return 'memory'; } },
          { label: '[Wade across] Lose 8 HP. Obtain a Tincture.', req: hasHp(8), fx(g) { g.hurt(8); g.obtainPotion(); return 'wade'; } },
        ],
      },
      silver: {
        text: P(
          'He takes the coins without looking at them and drops them over the side, one by one. They make no splash. "Silver spends," he says again, poling out into the black. "Only not here."',
          'The crossing takes longer than it should. Once, something large moves under the boat, and the ferryman says "Not today" in a firm voice, and it goes away.',
          'On the far bank he tells you which roads are drowned and which are watched, which villages still bake bread and which have stopped. It is good advice. You have the uncomfortable feeling that you have heard every word of it before.',
        ),
        choices: [leave()],
      },
      memory: {
        text: (g) => P(
          byHero(g, { knight: 'Before he reaches in, you say: "Take the door. Take that night." He pauses. "That one\'s not for sale," he says. "It\'s holding you up."' }),
          '"Hold still," he says, and reaches into your head the way a man reaches into a coat pocket. It doesn\'t hurt. That is the worst part. He draws something out, small and bright, like a minnow, looks at it, and tucks it inside his coat. "Fair toll."',
          'On the far bank you stand a long while, trying to think what it was. A face? A trick of the hands? Some small thing you used to do without thinking? It\'s gone. There is only a smooth place where it was, like the gap where a tooth came out, and you keep touching it.',
        ),
        choices: [leave()],
      },
      wade: {
        text: P(
          '"Suit yourself," says the ferryman.',
          'The water is cold enough to stop your heart, and you have to wait, gasping, for it to start again. You wade until you can\'t, and swim until you can wade, and somewhere in the middle your foot strikes something hard in the mud: a little stoppered bottle, still sealed, lost by somebody who didn\'t make it.',
          'You crawl out on the far bank grey with silt and shaking. The ferryman is already there, his boat drawn up in the reeds. He did not pass you. You would have seen.',
          '"Some of them come out," he says, satisfied. "I do like it when they come out."',
        ),
        choices: [leave()],
      },
    },
  },

  // ---------------------------------------------------------------- 4
  {
    id: 'a1_wolf_siege', title: 'The Shepherd\'s Siege', acts: [1], art: 'scene_camp',
    pages: {
      start: {
        text: P(
          'In a field of dead barley a shepherd stands on a rock with his crook raised over his head, and around the rock, in a patient ring, sit seven wolves.',
          'No one moves. The shepherd\'s arms tremble. The wolves\' tongues loll. The sheep are long gone.',
          '"Nineteen days," the shepherd calls, hoarse. "Nineteen days I\'ve stood here. They won\'t come up and I won\'t come down. I\'ve not slept. I\'ve not eaten. I don\'t get hungry. That\'s the odd part."',
          'The largest wolf turns its head to look at you. It wears a collar of hammered brass. Its eyes are perfectly intelligent and perfectly bored.',
          '"Please," says the shepherd. "Either way. I just want it to be *over*."',
        ),
        choices: [
          { label: '[Drive off the wolves] Fight.', fx(g) { return fight(g, FOES.wolves, { resume: 'won', reward: { gold: 25 } }); } },
          { label: '[Look at the brass collar]', fx(g) { g.unlockLore('lore_bragg'); return 'collar'; } },
          { label: '[Lead them away] Lose 8 HP. Choose an attack card.', req: hasHp(8), async fx(g) { g.hurt(8); if (g.run.over) return; await offerRandom(g, { type: 'attack' }, 'The shepherd\'s gift'); return 'lead'; } },
          { label: '[Put on the Wolf Mask and walk into the ring] Gain 40 Gold.', show: isHero('wren'), fx(g) { g.gainGold(40); return 'wren'; } },
          leave('[Leave him to it]'),
        ],
      },
      collar: {
        text: P(
          'You crouch, slowly, as near as you dare. The big wolf allows it. The collar is stamped with a snarling hound\'s head and the motto of the house of Bragg: *WE HUNT WHAT RUNS.*',
          '"Lord Bragg\'s," the shepherd calls. "His hounds went mad at Ashfall. Ran off into the fen with the wolves, and him after them on all fours, howling. He hunts with them now. Every dawn you hear his horn."',
          'The wolf yawns, showing you a great deal of tooth. On the inside of the collar, where it would lie against the throat, is a name scratched by some kennel-boy long ago: *Faithful.*',
        ),
        choices: [
          { label: '[Drive off the wolves] Fight.', fx(g) { return fight(g, FOES.wolves, { resume: 'won', reward: { gold: 25 } }); } },
          { label: '[Lead them away] Lose 8 HP. Choose an attack card.', req: hasHp(8), async fx(g) { g.hurt(8); if (g.run.over) return; await offerRandom(g, { type: 'attack' }, 'The shepherd\'s gift'); return 'lead'; } },
          leave('[Leave him to it]'),
        ],
      },
      won: {
        text: P(
          'The last wolf breaks and runs, and the shepherd comes down off his rock like a man climbing out of a well. His knees won\'t hold him. He sits in the barley and laughs, and stops laughing, and cries a little.',
          'He gives you what he has: a purse of copper and a pat on the arm. Then he looks at the road home, and at the rock, and at the dark line of the fen where the wolves went.',
          '"They\'ll be back tomorrow, won\'t they," he says. "Same as everything."',
          'You don\'t answer. He goes home anyway. That, you think, is the bravest thing you have seen all day.',
        ),
        choices: [leave()],
      },
      lead: {
        text: P(
          'You cut your palm and let it drip, and walk backward, slowly, into the barley. Seven heads turn. Seven noses lift.',
          'You run. They follow, unhurried, the way wolves do when they know how it ends. You lead them a mile through dead barley and into the reeds, where the ground gives way and you go in to the waist and they don\'t, quite. The big one gets your calf before you\'re clear.',
          'When you limp back, the shepherd is gone. On the rock he has left the one thing he owned worth having: his grandfather\'s skinning knife, and scratched beside it in the lichen, a clumsy picture of a person with a wolf running behind them, and the word *THANK*.',
        ),
        choices: [leave()],
      },
      wren: {
        text: P(
          'You slip on the Wolf Mask and walk into the ring.',
          'Seven heads swing round. The big one rises, hackles up, and stops. It sniffs. It takes a step toward you, and another, and puts its nose to the hem of your coat and breathes in, long and slow, the way a dog smells someone come home.',
          'Then all seven lie down in the barley, chins on paws, and watch you. They don\'t bow. But it\'s close.',
          '"What did you *say* to them?" asks the shepherd, climbing down, pressing his purse into your hands. "Nothing," you tell him, truthfully. You aren\'t sure you like how easy it was. When you look back from the road, they are still watching, as if you might change your mind and stay.',
        ),
        choices: [leave()],
      },
    },
  },

  // ---------------------------------------------------------------- 5
  {
    id: 'a1_deserters_bridge', title: 'Kettle Ford', acts: [1], art: 'scene_road',
    pages: {
      start: {
        text: (g) => P(
          'The bridge at Kettle Ford is held by six men and women in the rags of the King\'s grey. They have stretched a chain across the road and hung a sign from it, painted with care: TOLL 40 CROWNS. BY ORDER OF NOBODY.',
          g.run.hero === 'cantor'
            ? 'Their leader, a broad, scarred woman with a sergeant\'s knot on her shoulder, recites the terms to the road: "Toll\'s forty. Or round by the fen, which is three days and leeches. Or try us." She says it to the empty causeway behind you, the way she must have said it a thousand times, and her eyes slide past you as if waiting for someone to arrive.'
            : 'Their leader is a broad, scarred woman with a sergeant\'s knot still pinned to her shoulder. "Toll\'s forty," she says. "Or you can go round by the fen, which is three days and leeches. Or you can try us." Behind her a man winds a crossbow with the slowness of long practice. "We\'d rather you paid. Fighting\'s thirsty work, and the ale ran out at Ashfall."',
          byHero(g, { knight: 'Then she sees your face, and her own goes flat. "Well," she says. "Captain Vane. Look what the ash dragged in." Somebody behind her spits. "Heard you held a door, Captain. Heard you held it *real* well."' }),
        ),
        choices: [
          { label: '[Pay the toll] Lose 40 Gold.', req: hasGold(40), fx(g) { g.loseGold(40); return 'paid'; } },
          { label: '[Fight your way across] Fight.', fx(g) { return fight(g, FOES.deserters, { resume: 'won', reward: { gold: 40 } }); } },
          { label: '[Go round by the fen] Lose 8 HP.', req: hasHp(8), fx(g) { g.hurt(8); return 'fen'; } },
          { label: '[Give her an order] Cross freely. Obtain a Tincture.', show: isHero('knight'), fx(g) { g.obtainPotion(); return 'order'; } },
          { label: '[Walk past them] Cross freely.', show: isHero('cantor'), next: 'unseen' },
        ],
      },
      paid: {
        text: P(
          'You count forty crowns into the sergeant\'s palm. She counts them again, carefully, and nods, and two of her people lower the chain. "Pleasure doing business. Mind the third plank. And if you see the Regent\'s men on the far road, you never saw us."',
          '"What do you spend it on," you ask, "out here?"',
          'She looks honestly puzzled. "Spend it? Nothing to buy. We just like to count it, evenings." She jingles the purse. "It\'s something that goes up."',
        ),
        choices: [leave('[Cross]')],
      },
      won: {
        text: P(
          'The last of them goes over the parapet into the ford with a yell and a splash, comes up swearing, and wades for the far bank without looking back. The sergeant holds out longest. When she yields she does it properly, hilt first, the way the army taught her.',
          '"Fair fight," she says, nursing her arm. "Toll box is under the bridge. Take it. We\'ll have it back off the next one."',
          'You take it. There is a great deal more than forty crowns in it. They really have been counting.',
        ),
        choices: [leave('[Cross]')],
      },
      fen: {
        text: P(
          'Three days, she said, and leeches. It is not three days. It only feels like it.',
          'The fen path is a rumour more than a path. You go in to the knee, the thigh, the waist. The leeches find you within the hour: fat grey sluggish things that drop off after a while looking disappointed, as if your blood was not what they had hoped. Ash falls on the black water and floats there in little grey continents that drift apart as you wade through.',
          'You come out on the road beyond Kettle Ford, filthy and lighter by a pint or two, in plain sight of the bridge. The deserters wave.',
        ),
        choices: [leave()],
      },
      order: {
        text: P(
          '"Sergeant," you say, in the voice. "Lower that chain."',
          'You see it go through her: the old reflex, twelve years of drill, the hand already moving before the mind can stop it. Two of her people have the chain down before she does.',
          'She doesn\'t salute. She stands very straight and says, "Last order you gave, Captain, was *let no one in.* Whole army knows how that went." You have no answer. You never have.',
          'She tosses you something as you pass: a soldier\'s flask, dented, half full. "For the road. Not for you. For *him*. He was a good king before he went strange. He\'d want his Shield to have a drink."',
        ),
        choices: [leave('[Cross]')],
      },
      unseen: {
        text: P(
          'You walk across Kettle Ford bridge.',
          'No one stops you. No one so much as glances your way. The sergeant goes on reciting the toll to the empty causeway; the crossbowman goes on winding. One of the younger ones, as you pass close enough to touch, shivers suddenly and pulls up her collar. "Cold one," she mutters.',
          'On the far side you look back and raise a hand in blessing. No one returns it.',
          'Soldiers\' manners, you tell yourself. The poor light. The ash. They have learned, out here, not to look at what they cannot afford to see.',
        ),
        choices: [leave()],
      },
    },
  },

  // ---------------------------------------------------------------- 6
  {
    id: 'a1_corpse_candles', title: 'Corpse-Candles', acts: [1], art: 'scene_water',
    pages: {
      start: {
        text: (g) => P(
          'Lights over the fen: pale, blue, bobbing at knee height. Corpse-candles, the Marchfolk call them, and they say three things about them. Follow them and they\'ll lead you to treasure. Follow them and they\'ll lead you to drown. And: there are more of them than there used to be.',
          'There are a great many of them tonight. They drift toward you through the reeds, unhurried, and stop just out of reach, as if waiting to see what you\'ll do.',
          'One of them, nearer than the rest, makes a small sound. It might be the wind in the reeds. It might be a child saying, very quietly, *this way.*',
          byHero(g, { witch: '"Marsh gas," you say firmly, to no one. The light tilts, as if amused.', wren: 'They are curious about you. You can tell. You are curious about them too.' }),
        ),
        choices: [
          { label: '[Follow the lights] Either obtain a relic, or lose 12 HP.', req: hasHp(12), fx(g) {
            if (roll(g) < 0.5) { g.obtainRelic(); return 'treasure'; }
            g.hurt(12); return 'mire';
          } },
          { label: '[Catch one in a bottle] Lose 3 HP. Obtain a Tincture.', req: (g) => (hasHp(3)(g) === true ? hasRoom(g) : hasHp(3)(g)), fx(g) { g.hurt(3); g.obtainPotion(); return 'catch'; } },
          { label: '[Sing to them] Choose a card.', show: isHero('cantor'), async fx(g) { await offerRandom(g, {}, 'The candles\' gift'); return 'hymn'; } },
          leave('[Keep to the causeway]'),
        ],
      },
      treasure: {
        text: P(
          'The lights lead you off the causeway and into the reeds, and the ground holds: tussock to tussock, root to root, exactly where they hover. They are patient with you. When you stumble, they wait.',
          'They stop over a hummock of black peat. When you dig, your fingers find the corner of a box, iron-bound, older than the Long King. Whoever buried it never came back for it.',
          'One of the lights comes close to your ear. *It was ours,* it says, in a voice like a child\'s. *Nobody found us. Now somebody has.* And they draw back across the water, bobbing gently, in what you can only call satisfaction.',
        ),
        choices: [leave()],
      },
      mire: {
        text: P(
          'The lights lead you off the causeway and into the reeds, and the ground holds, and holds, and then doesn\'t.',
          'You go in to the chest in a single breath. The mud is cold and fat and it *pulls*. The lights gather above you, a ring of soft blue faces, peering down with grave curiosity.',
          'You get an arm over a root. You get a knee onto a tussock. You haul yourself out by your fingernails, inch by sucking inch, and lie on the bank retching black water while they drift away across the fen, already looking for someone else.',
          '*Nearly,* says one of them wistfully, as it goes. *Nearly had a friend.*',
        ),
        choices: [leave()],
      },
      catch: {
        text: P(
          'You uncork an empty bottle and wait, very still, until one of the smaller lights drifts close enough to scoop. It goes in easily. Too easily. It is cold enough to burn; the glass frosts in your hand, and the skin of your fingers with it.',
          'Inside, the light beats slowly against the stopper, like a pulse.',
          'If you hold it close, you think you can hear it humming: a nursery tune, very faint, as if through a wall. You will find a use for it. You try not to think too hard about what it is.',
        ),
        choices: [leave()],
      },
      hymn: {
        text: P(
          'You do the only thing you know how to do in the presence of the dead. You sing.',
          'The *Lux Perpetua*, low and slow. Your voice goes out over the water and does not echo. And the lights come, hundreds of them, drifting in from every corner of the fen until they ring you like candles round a bier, hanging at the height of a kneeling man, listening.',
          'They do not frighten you. That is the strange thing. They feel, as they press close, like a congregation that has waited a long time for its priest. They feel like kin.',
          'When the hymn ends they dip, all together, like grass in a wind, and go.',
        ),
        choices: [leave()],
      },
    },
  },

  // ---------------------------------------------------------------- 7
  {
    id: 'a1_plague_doctor', title: 'The Beaked Man', acts: [1], art: 'scene_village',
    pages: {
      start: {
        text: P(
          'In the square at Sallow Green, under a sky the colour of dishwater, a plague doctor has set up his table. The beak of his mask is stuffed with lavender and wormwood; you can smell it from the well. Behind him on straw pallets lie his patients: grey-skinned, open-eyed, perfectly still.',
          '"Blight," he says, his voice muffled by leather. "Not catching, I\'m fairly sure. Not *very* catching." He gestures at his instruments: lancets, leeches in a jar, a row of brown bottles. "I bleed them. I purge them. They do not improve, but neither, you\'ll notice, do they get worse. That\'s medicine."',
          'He looks you up and down. "You\'ve a poor colour yourself. Care for a bleeding?"',
        ),
        choices: [
          { label: '[Submit to a bleeding] Lose 6 HP. Remove a card from your deck.', req: (g) => (hasHp(6)(g) === true ? (removable(g).length > 0 || 'Nothing to remove.') : hasHp(6)(g)), async fx(g) { g.hurt(6); if (g.run.over) return; await g.removeCardChoice(1, 'Choose a card to bleed out'); return 'bleed'; } },
          { label: '[Buy his theriac] Lose 35 Gold. Obtain 2 Tinctures.', req: (g) => (hasGold(35)(g) === true ? hasRoom(g) : hasGold(35)(g)), fx(g) { g.loseGold(35); g.obtainPotion(); g.obtainPotion(); return 'theriac'; } },
          { label: '[Read his casebook]', fx(g) { g.unlockLore('lore_blight'); return 'notes'; } },
          { label: '[Correct his dosages] Obtain a Tincture. Choose a card.', show: isHero('witch'), async fx(g) { g.obtainPotion(); await offerRandom(g, {}, 'From Fenwick\'s stores'); return 'fenwick'; } },
          { label: '[Ask what is under his mask] Upgrade a random card.', show: isHero('wren'), fx(g) { g.upgradeRandom(1); return 'face'; } },
          leave(),
        ],
      },
      notes: {
        text: P(
          'The casebook is bound in oilcloth and written in a cramped, frightened hand. *Patient 41: ceased mid-sentence while asking for water. Warm. No breath. Eyes follow movement. Patient 42: ceased while digging; spade still upright. Patient 43: child, ceased laughing. Still smiling.*',
          'The entries go on for pages, getting shorter.',
          'The last, dated this morning, reads only: *I think I am the one who is ill, for I keep wanting to apologise to them, and do not know for what.*',
          'The doctor watches you read. He does not ask for it back.',
        ),
        choices: [
          { label: '[Submit to a bleeding] Lose 6 HP. Remove a card from your deck.', req: (g) => (hasHp(6)(g) === true ? (removable(g).length > 0 || 'Nothing to remove.') : hasHp(6)(g)), async fx(g) { g.hurt(6); if (g.run.over) return; await g.removeCardChoice(1, 'Choose a card to bleed out'); return 'bleed'; } },
          { label: '[Buy his theriac] Lose 35 Gold. Obtain 2 Tinctures.', req: (g) => (hasGold(35)(g) === true ? hasRoom(g) : hasGold(35)(g)), fx(g) { g.loseGold(35); g.obtainPotion(); g.obtainPotion(); return 'theriac'; } },
          leave(),
        ],
      },
      bleed: {
        text: P(
          'He sits you on a stool and opens your arm with a lancet so sharp you barely feel it. The blood runs into a pewter bowl, and he watches it with professional interest.',
          '"Hm. Bad humours. A great deal of bad humour. Something lodged." He reaches in with two fingers, not into the cut but somewhere *near* it, and draws out a thing like a wet black thread, wriggling, and drops it in the bowl.',
          'You feel immediately lighter. Something you were carrying is simply not there any more.',
          '"Superstition, of course," says the doctor, binding your arm. "I don\'t hold with it. But it\'s the only thing that works, and I\'ve stopped asking why."',
        ),
        choices: [leave()],
      },
      theriac: {
        text: P(
          'He sells you two brown bottles sealed with wax and stamped with a beak. "Theriac. Sixty-four ingredients, including viper, poppy, and powdered mummy of excellent provenance. Cures everything except the Blight, which it does not make worse."',
          'You hold one up to the grey light. Something moves in the sediment.',
          '"Shake well," says the doctor. "And truly, do *not* drink it all at once. Old Hawley did, last spring. He\'s still up on the church roof. We can\'t get him down. He seems happy."',
        ),
        choices: [leave()],
      },
      fenwick: {
        text: P(
          '"Doctor Fenwick," you say. "You testified at my trial."',
          'The beak turns toward you, slowly. "Isolde Marrow. I testified that your tinctures *worked*, madam. That was rather the problem."',
          'You look at his leeches, his lancets, his dosages scrawled on a slate. You pick up the chalk. "Wormwood, not rue. Half this. A quarter of *that*, unless you want them to see God. And for pity\'s sake stop bleeding them. They\'ve nothing to spare."',
          'He reads it twice. Then, without a word, he opens his chest of stores and stands aside. You glance at the patients as you work. Their skin is warm. Their chests do not rise. You set the thought aside, somewhere cold, for later.',
        ),
        choices: [leave()],
      },
      face: {
        text: P(
          '"What\'s under it?" you ask.',
          'He hesitates. Nobody has asked him in a long time. Then, slowly, he unbuckles the beak and lifts it away.',
          'It\'s a face. An ordinary one: sixty or so, unshaven, tired grey eyes, a red groove across the bridge of the nose from forty years of leather. It looks frightened, then embarrassed to be looking frightened.',
          'You study it a long while: the frown lines, the crow\'s feet, the place where he has bitten his lip. "That\'s a good one," you tell him seriously. "You should wear it more." He laughs, surprised into it, and for a moment the face is better still. You keep that one. You keep all the good ones.',
        ),
        choices: [leave()],
      },
    },
  },

  // ---------------------------------------------------------------- 8
  {
    id: 'a1_stopped_clock', title: 'A Quarter Past the King', acts: [1], art: 'scene_village',
    pages: {
      start: {
        text: (g) => P(
          'Every clock in Pennick says a quarter past three.',
          'The church clock says it. The clock over the inn door says it. In the window of the clockmaker\'s shop forty clocks, brass and oak and enamel and one shaped like a sleeping cat, all say it together, their hands folded at the same small, stubborn angle.',
          'The clockmaker sits on his step with a cold pipe. He is very old, in the way everyone in the Marches is very old, and he has the air of a man who has thought hard about something and lost.',
          g.run.hero === 'cantor'
            ? '"It\'s not the clocks," he says to the square, though you have not asked. He does not look at you; he might be talking to himself. "I\'ve had them all apart. They just won\'t go past it. Quarter past three. That\'s when the bells stopped."'
            : '"It\'s not the clocks," he tells you, before you can ask. "I\'ve had them all apart. Springs are good. Gears are good. They just won\'t go past it. Quarter past three. That\'s when the bells stopped." He sucks on the pipe. "Morning after Ashfall, it was. Still is, I reckon."',
          byHero(g, { wren: 'You listen to the clocks for a while. They\'re not stopped, you decide. They\'re holding their breath.' }),
        ),
        choices: [
          { label: '[Climb the tower and wind the church clock] Lose 6 HP. Upgrade a card.', req: hasHp(6), async fx(g) { g.hurt(6); if (g.run.over) return; await g.upgradeCardChoice(1); return 'wind'; } },
          { label: '[Buy a stopped watch] Lose 45 Gold. Obtain an uncommon relic.', req: hasGold(45), fx(g) { g.loseGold(45); g.obtainRelic('uncommon'); return 'watch'; } },
          { label: '[Ask him about that night]', fx(g) { g.unlockLore('lore_ashfall'); g.unlockLore('lore_letter_clockmaker'); return 'ask'; } },
          leave(),
        ],
      },
      ask: {
        text: P(
          'He knocks out his pipe on his boot.',
          '"Third bell after midnight. I was up with my chest. Heard the cathedral bells from forty mile off, as you can, on a still night, ringing the hour. And then stopping. Middle of a peal. And every clock in this shop, every one, at the same moment, went *tock*, and didn\'t go *tick*."',
          'He looks at you sidelong. "You asked me that yesterday. And the day before. Same words. I wasn\'t going to say, but it\'s getting so I can\'t stand it." He taps the pipe. "It\'s always the morning after, isn\'t it? That\'s what nobody\'ll say. It\'s always the morning after, and we\'re all just waiting for the minute."',
        ),
        choices: [
          { label: '[Climb the tower and wind the church clock] Lose 6 HP. Upgrade a card.', req: hasHp(6), async fx(g) { g.hurt(6); if (g.run.over) return; await g.upgradeCardChoice(1); return 'wind'; } },
          { label: '[Buy a stopped watch] Lose 45 Gold. Obtain an uncommon relic.', req: hasGold(45), fx(g) { g.loseGold(45); g.obtainRelic('uncommon'); return 'watch'; } },
          leave(),
        ],
      },
      wind: {
        text: P(
          'The tower stair is rotten and the crank is rusted solid, and by the time you have forced it round once your palms are torn and something in your back has given. You put your whole weight on it. The great spring groans.',
          'The minute hand trembles. It moves, one notch, a hair past the quarter, and the whole of Pennick seems to draw a breath. In the shop window forty clocks tick once, together.',
          'Then, slowly, as if pushed by a patient hand, the minute hand slides back.',
          'You come down shaking. The clockmaker grips your arm. "You saw it," he says. "It *moved*." He looks almost frightened. Something in you moved too. You can feel it: a gear caught and turned, and not quite turned back.',
        ),
        choices: [leave()],
      },
      watch: {
        text: P(
          'He sells you a pocket watch from the window: silver case, enamel face, hands at a quarter past three.',
          '"Keeps perfect time," he says. "Well. Keeps *a* time. Same one as everything else." He closes your fingers over it. "Funny thing. Wind it and it\'ll tick for you. Won\'t go anywhere, but it ticks. Seems to like the company."',
          'Outside, in the grey, you open it. The second hand sweeps round, steady and bright, and never quite reaches the next minute.',
        ),
        choices: [leave()],
      },
    },
  },

  // ---------------------------------------------------------------- 9
  {
    id: 'a1_dead_courier', title: 'The Courier', acts: [1], art: 'scene_road',
    pages: {
      start: {
        text: (g) => P(
          'A horse stands in the ditch, cropping grey grass. Beside it lies a boy in the Regent\'s livery with an arrow through his throat and a satchel clutched to his chest.',
          'As you come near, he sits up. "Sorry," he says thickly, round the arrow. "Sorry, I\'m in a hurry, urgent dispatch for the Marches garrison." He gets halfway to his feet and peers at you. "Didn\'t I pass you yesterday? On this road? You were standing just there." He frowns. "Was it yesterday?"',
          byHero(g, {
            knight: '"Captain Vane!" He flushes. "Sir. I\'m to tell every garrison you\'re to be taken on sight. Regent\'s orders. Sorry, sir."',
            cantor: 'His eyes, for a moment, are very clear. "You stopped," he says. "Everyone else just steps over me."',
          }),
          'He climbs onto the horse. He rides perhaps forty yards, and an arrow comes out of the fog from nowhere and takes him in the throat, and he falls into the ditch. The horse goes back to cropping grass. After a while, the boy sits up.',
        ),
        choices: [
          { label: '[Read the dispatch while he\'s down]', fx(g) { g.unlockLore('lore_letter_regent_order'); return 'read'; } },
          { label: '[Rob the satchel] Gain 70 Gold. Add Shame to your deck.', fx(g) { g.gainGold(70); curse(g, 'shame'); return 'rob'; } },
          { label: '[Find the archer in the fog] Fight. Obtain a relic.', fx(g) { return fight(g, FOES.archer, { resume: 'free', reward: { relic: rewardRelic(g, null, 'common') } }); } },
          leave('[Leave him to his errand]'),
        ],
      },
      read: {
        text: P(
          'You ease the dispatch from his satchel while he lies in the ditch. The seal is the King\'s, the crowned hand, but the letter beneath is in a thin, elegant script nothing like the old King\'s spiky scrawl. It is an order to every garrison in the Marches. The fourth clause makes the back of your neck go cold.',
          'When you slip it back, the boy is watching you, the arrow bobbing in his throat.',
          '"Don\'t tell anyone I let you read it," he says. "I\'ll be in such trouble." He gets up. He gets on the horse. He rides forty yards. You don\'t watch the rest.',
        ),
        choices: [
          { label: '[Find the archer in the fog] Fight. Obtain a relic.', fx(g) { return fight(g, FOES.archer, { resume: 'free', reward: { relic: rewardRelic(g, null, 'common') } }); } },
          leave(),
        ],
      },
      rob: {
        text: P(
          'The satchel is heavy with more than paper: the quarter\'s pay for the Marches garrison in good silver, sealed in a leather bag.',
          'He sits up while you are still counting it. He looks at the bag in your hands a long moment. He doesn\'t fight you. He doesn\'t shout. He only says, very quietly, "They\'ll say I lost it," and climbs onto his horse and rides off toward the place where the arrow is waiting.',
          'You have seventy crowns. You find you do not like to look at them.',
        ),
        choices: [leave()],
      },
      free: {
        text: P(
          'The archer was a deserter, half starved, who had crouched in the same hollow since Ashfall night loosing the same arrow at the same rider, over and over, without ever knowing why. He fell without a word. His bow was strung with grey hair.',
          'The boy rides past the place where he always falls. He reins in. He looks back at you, and down at his own unbroken throat, and his face does something complicated. Then he grins, and kicks the horse, and is gone into the fog at a gallop.',
          'He has left something on the road for you: a letter, not the dispatch. His own, addressed in a careful schoolboy hand to his mother.',
        ),
        choices: [
          { label: '[Read the letter]', fx(g) { g.unlockLore('lore_letter_courier'); }, end: true },
          leave('[Leave it sealed]'),
        ],
      },
    },
  },

  // ---------------------------------------------------------------- 10
  {
    id: 'a1_rat_catcher', title: 'Penny a Rat', acts: [1], art: 'scene_village',
    pages: {
      start: {
        text: (g) => P(
          'A man sits on an upturned barrel outside the Drowned Dog, sharpening a knife on his boot. On a pole across his shoulders hang thirty rats by their tails, and every one of them is moving.',
          '"Can\'t kill \'em," he says, without looking up. "Not since Ashfall. Knock \'em on the head, they get up. Drown \'em, they swim. So I catch \'em and carry \'em, and the town pays me a penny a rat to keep \'em off the floor." He jerks his chin north. "They all come from Sallow End. The *Mother\'s* there. Big as a cart, she is, and growing."',
          '"I\'ll sell you what I know. Or I\'ll sell you poison: real poison, kills anything that *can* die. Or you can take a turn with the pole and see how you like it."',
          byHero(g, { wren: 'You ask what the rats are called. He stares at you. "Called?" You begin, quietly, to name them.' }),
        ),
        choices: [
          { label: '[Pay for what he knows] Lose 15 Gold.', req: hasGold(15), fx(g) { g.loseGold(15); g.unlockLore('lore_mother_of_rats'); return 'know'; } },
          { label: '[Buy his poison] Lose 30 Gold. Obtain a Tincture.', req: (g) => (hasGold(30)(g) === true ? hasRoom(g) : hasGold(30)(g)), fx(g) { g.loseGold(30); g.obtainPotion(); return 'poison'; } },
          { label: '[Take a turn with the pole] Fight.', fx(g) { return fight(g, FOES.rats, { resume: 'helped', reward: { gold: 20 } }); } },
          { label: '[Buy a single rat] Lose 5 Gold. Choose a card.', show: isHero('witch'), req: hasGold(5), async fx(g) { g.loseGold(5); await offerRandom(g, {}, 'What the rat taught you'); return 'rat'; } },
          leave(),
        ],
      },
      know: {
        text: P(
          '"Sallow End," he says, pocketing your coin. "Plague village, north edge of the fen. Midwife there name of Agathe. Finest midwife in the Marches. Never lost a mother nor a babe in sixty year."',
          '"When the Blight came she wouldn\'t leave her sleepers. Sat with \'em. Fed \'em. Kept the rats off. And then, I dunno. Rats and her came to an arrangement. Now she\'s mostly rats and they\'re mostly her, and she sits in the middle of that village singing to folk who\'ll never wake, and anything that comes near, she *feeds* to \'em."',
          'He looks up at his pole. "Lovely voice, mind. You can hear her from here, some nights."',
        ),
        choices: [leave()],
      },
      poison: {
        text: P(
          'He sells you a squat clay bottle with a skull scratched on the side. The cork is sealed with wax, and the wax is sealed with more wax.',
          '"Arsenic, nightshade, and a little something of my grandmother\'s. Kills anything that *can* die, which these days is a shorter list than it was." He taps the bottle. "Don\'t drink it. Don\'t sniff it. Don\'t, for the love of God, let it near your bread."',
          'He watches you tuck it away. "And if you meet the Mother, don\'t waste it on her. She\'s past it."',
        ),
        choices: [leave()],
      },
      helped: {
        text: P(
          'You took the pole, and the rats chewed through the cord in a heartbeat, and they did not scatter. They turned, all together, and came for you.',
          'Now the rat-catcher picks his way through the twitching bodies with his hat in his hand. "Never seen \'em do that," he says. "Never seen \'em go for a body *together*. Like they\'d been told." He looks north toward Sallow End and shivers. Then he starts gathering them up again by the tails.',
          '"Penny a rat," he mutters. "That\'s a good morning\'s work." He gives you a share. It is a very fair share, from a man with so little, and you haven\'t the heart to refuse it.',
        ),
        choices: [leave()],
      },
      rat: {
        text: P(
          '"One rat," you say, holding out five pennies. "That one. The fat one with the white ear."',
          'He looks at you, at the rat, and back at you. "What for?"',
          '"Dissection."',
          'He considers this. "Is that a kind of supper?"',
          'You take the rat to a hedge and open it very neatly with your knife. It goes on twitching, lungs working, heart beating, entirely unbothered by being in several pieces. You make careful notes. Some of what you learn is about rats. Some of it, you suspect, is about everything else.',
        ),
        choices: [leave()],
      },
    },
  },

  // ---------------------------------------------------------------- 11
  {
    id: 'a1_bounty_board', title: 'Wanted', acts: [1], art: 'scene_village',
    pages: {
      start: {
        text: (g) => P(
          'The notice board outside the Sheriff\'s lockup in Gallowmere is shingled with paper: tithes, curfews, a lost goat. And at the centre, nailed up fresh, a poster with your face on it.',
          byHero(g, {
            wren: 'Or rather, your mask: the one you wore last, drawn with loving care, every carved line of it. Beneath the mask the artist has left the paper blank.',
            cantor: 'It is a good likeness, but faint, sketched in such pale charcoal it seems about to fade off the paper, as if the artist could not quite see you.',
            def: 'It is a good likeness. Better than good. Whoever drew it caught the exact set of your jaw when you are tired.',
          }),
          'Beneath it, in the Sheriff\'s square hand: *WANTED, for crimes against the King\'s Peace.* The list is long, specific and largely unfamiliar. Some of these things you have certainly not done. Some of them you are fairly sure you haven\'t done *yet*.',
          g.run.hero === 'cantor' ? '' : 'Across the square, two men in long coats have stopped pretending to drink their ale.',
        ),
        choices: [
          { label: '[Read the charges]', fx(g) { g.unlockLore('lore_letter_wanted'); return 'charges'; } },
          { label: '[Claim the bounty on yourself] Gain 60 Gold, then fight.', show: (g) => g.run.hero !== 'cantor', fx(g) { g.gainGold(60); return fight(g, FOES.hunters, { resume: 'claimed' }); } },
          { label: '[Present yourself at the lockup] Remove a card from your deck.', show: isHero('knight'), req: (g) => removable(g).length > 0 || 'Nothing to leave behind.', async fx(g) { await g.removeCardChoice(1, 'Leave something behind'); return 'lockup'; } },
          leave('[Pull up your hood and walk on]'),
        ],
      },
      charges: {
        text: (g) => {
          const d = g.meta.deaths || 0;
          const bragg = Object.keys(g.meta.bossesDefeated || {}).some((k) => /bragg|hound/i.test(k));
          return P(
            'You read the charges.',
            `*Trespass. Affray. Unlicensed possession of a destiny. Dying in a public road without licence (${d ? d + (d === 1 ? ' count' : ' counts') : 'one count, pending'}). Returning from the same (likewise).${bragg ? ' The slaying of the Hound-Lord Bragg, a peer of the realm.' : ''} Conspiracy to sit upon the throne of Morrow.*`,
            'At the very bottom, smaller, as though the Sheriff hesitated: *Being expected.*',
            '*REWARD: 60 CROWNS. BRING THE HEAD. BRING IT QUICKLY. IT DOES NOT STAY.*',
          );
        },
        choices: [
          { label: '[Claim the bounty on yourself] Gain 60 Gold, then fight.', show: (g) => g.run.hero !== 'cantor', fx(g) { g.gainGold(60); return fight(g, FOES.hunters, { resume: 'claimed' }); } },
          { label: '[Present yourself at the lockup] Remove a card from your deck.', show: isHero('knight'), req: (g) => removable(g).length > 0 || 'Nothing to leave behind.', async fx(g) { await g.removeCardChoice(1, 'Leave something behind'); return 'lockup'; } },
          leave('[Tear it down and walk on]'),
        ],
      },
      claimed: {
        text: P(
          'The clerk at the lockup window counted sixty crowns into your hand without once taking his eyes off the poster: comparing you to it, and you to it, and finally deciding that nobody could possibly be so stupid. The bounty hunters were less easily fooled.',
          'Now they lie groaning in the ash of Gallowmere square, and the clerk has pulled his shutter down.',
          'As you go, you pass the board. Someone you did not see has already nailed up a fresh copy of your poster. The ink is wet. There is a new charge at the bottom, in the Sheriff\'s square hand: *Fraud.*',
        ),
        choices: [leave()],
      },
      lockup: {
        text: P(
          '"I\'ll answer for it," you tell the clerk. "Whatever it says. I\'ll answer."',
          'He looks at you a long moment, then shrugs and unlocks the cell. A bench, a bucket, and a noose hanging from a hook, neatly coiled, waiting. You sit on the bench. You wait too. No one comes. The Sheriff has more pressing work.',
          'After an hour the clerk puts his head round the door. "You can go, you know," he says, not unkindly. "Nobody\'s charged you with anything. Not here."',
          'You sit a while longer anyway. It seems important to finish. When at last you get up and walk out, you leave something on that bench: something heavy you had carried a long way. You don\'t go back for it.',
        ),
        choices: [leave()],
      },
    },
  },

  // ---------------------------------------------------------------- 12
  {
    id: 'a1_wedding', title: 'The Wedding at Hollin\'s Ford', acts: [1], art: 'scene_chapel',
    pages: {
      start: {
        text: (g) => P(
          'The chapel at Hollin\'s Ford is hung with dead flowers and every pew is full. At the altar a bride of ninety-one in her mother\'s lace holds hands with a groom of ninety-four, and both of them are glowing.',
          g.run.hero === 'cantor'
            ? 'No one makes room for you, so you stand at the back where the draught is, and hear the bride explain to her neighbour, for what is clearly the hundredth time: "Seventy years engaged. His father wouldn\'t die and wouldn\'t give up the farm, and you can\'t marry on nothing. And then on Ashfall night, bless the old devil, he went."'
            : '"Seventy years we\'ve been engaged," the bride tells you, catching your sleeve. "His father wouldn\'t die, see, and wouldn\'t give up the farm, and you can\'t marry on nothing. And then on Ashfall night..." She beams. "Bless the old devil. He went."',
          'The chapel door bangs open. On the threshold, in his burial shroud, muddy to the knees, stands the groom\'s father.',
          '"*I object,*" he says.',
          g.run.hero === 'cantor' ? '"Oh, *not again*," says the groom. And the dead man\'s eyes go straight past him, down the aisle, and fix on you. "You. Priest. You\'ll back me up."' : '"Oh, *not again*," says the groom.',
        ),
        choices: [
          { label: '[Throw the old man out] Fight. Obtain a relic.', fx(g) { return fight(g, FOES.corpse, { resume: 'blessed', reward: { relic: rewardRelic(g, null, 'common') } }); } },
          { label: (g) => (g.run.hero === 'cantor' ? '[Speak to the dead man] Gain 40 Gold.' : '[Reason with him] Gain 40 Gold.'), fx(g) { g.gainGold(40); return 'reason'; } },
          { label: '[Raise a cup and enjoy the show] Heal 12 HP.', fx(g) { g.healOut(12); return 'toast'; } },
        ],
      },
      blessed: {
        text: P(
          'The groom\'s father went out of the chapel door backward, shroud flapping, and landed in the churchyard ash like a dropped sack of kindling. He sat up. He thought about coming back in. He looked at you, and thought better of it. "I\'ll be at the *reception*," he shouted, and stumped off toward the farm.',
          'The vows are short. The bride cries; the groom cries; the vicar, who is a hundred and fifty and has waited seventy years to perform this particular service, cries hardest of all. Afterwards the bride presses a keepsake into your hands, the luckiest thing she owns.',
          '"Seventy years," she says. "You\'ve no idea what it\'s like to wait seventy years for something." You think of the Crown, waiting. You think you might.',
        ),
        choices: [leave()],
      },
      reason: {
        text: (g) => (g.run.hero === 'cantor'
          ? P(
            'No one else seems to hear you speak. The congregation goes on muttering and the vicar goes on flapping. But the old man in the doorway turns his whole body to face you, and listens.',
            '"Your son is ninety-four," you tell him gently. "Let him go."',
            '"He\'s my *boy*," says the dead man. And then, after a long time: "I didn\'t want to miss it. That\'s all. Seventy years I kept them waiting, and I didn\'t want to miss it."',
            '"Then sit," you say, "and watch."',
            'He sits in the back pew with his hands folded, quite still. "Look at that," says the groom, wondering. "He\'s stopped. Must have been the hymn." Later, the old man slips his burial purse into your hand. Nobody sees him do it. Nobody sees you take it.',
          )
          : P(
            '"Why object?" you ask him. "Your son is ninety-four."',
            '"She\'s marrying him for the *farm*," says the old man. "Always was. Seventy years she\'s been eyeing my acres."',
            'The bride stands. Lace and all, she is magnificent. "I\'m marrying him because I\'ve loved him since I was twenty-one, you old goat. The farm\'s a *bonus*. And it\'s a terrible farm. The north field floods."',
            'A long silence. "It does flood," the father admits at last. He wrings his shroud-cap. "Oh, go on, then." He lies down in the aisle, folds his arms, and stays quite still through the vows, and the groom, overcome, pays you out of the dowry purse for your trouble.',
          )),
        choices: [leave()],
      },
      toast: {
        text: P(
          'You find a seat at the back, raise a cup of something cloudy along with everyone else, and let the argument wash over you.',
          'It goes on for some time. It involves the farm, the north field, a pig called Absalom, and a grievance from the Long King\'s fortieth year. It ends with the father being carried out by six grandsons, protesting, and the vows being said very fast.',
          'The wedding breakfast is enormous. Seventy years of saving went into it. You eat until you can\'t, and for an hour in the grey, in the noise, in the warmth of other people\'s joy, you forget what you are for.',
        ),
        choices: [leave()],
      },
    },
  },

  // ---------------------------------------------------------------- 13
  {
    id: 'a1_ash_procession', title: 'The Procession of Ash', acts: [1], art: 'scene_road',
    pages: {
      start: {
        text: (g) => P(
          'They come up the road in a column of grey, thirty strong, barefoot in the cinders. Each is daubed head to foot in ash, so that only their eyes and mouths show, pink and wet. At their head a man carries a pole, and on the pole is an iron circle, rusted and crude: a crown made by a blacksmith who had only heard of crowns.',
          'They are singing the Hymn of the Held Hour, badly, with great conviction.',
          'The leader stops before you. He dips his thumb in a bowl of ash and holds it up. "The King is not dead," he says. "The King is *resting*. The Hour is held. Take the ash, pilgrim, and be held with us. Or stand aside, and be swept."',
          byHero(g, {
            knight: 'His eyes widen. "You! The Shield! You were at his door. Tell them. Tell them he only *sleeps*."',
            wren: 'As you watch, the iron crown on its pole begins, very slowly, to turn. There is no wind. It turns until its empty socket faces you, and stops. No one else notices. You notice.',
          }),
        ),
        choices: [
          { label: '[Take the ash] Choose a rare card. Add Crown\'s Whisper to your deck.', async fx(g) { curse(g, 'crowns_whisper'); await offerRandom(g, { rarity: 'rare', forced: true }, 'What the ash gives'); return 'ash'; } },
          { label: '[Refuse them] Fight. Obtain a relic.', fx(g) { return fight(g, FOES.cultists, { resume: 'won', reward: { relic: rewardRelic(g, 'crown_splinter', 'common') } }); } },
          { label: '[Hear the sermon]', fx(g) { g.unlockLore('lore_hunger'); return 'sermon'; } },
          { label: '[Tell them the King is dead] Gain 30 Gold.', show: isHero('knight'), fx(g) { g.gainGold(30); return 'truth'; } },
          leave('[Stand aside]'),
        ],
      },
      sermon: {
        text: P(
          'The leader climbs onto a milestone, his voice cracked and carrying.',
          '"There is a Hunger beneath the throne! It ate the hill-kings and their children, until the Founder bound it in iron and made himself its *vessel*! Every king since has carried it, that we need not! And now the King rests, and the Crown lies empty, and the Hunger..." His voice drops. "*Stirs.*"',
          'The congregation moans.',
          '"We are the held! We take the ash and are *held*, and when the Hunger rises we will not be eaten, for we are already still!"',
          'It is, you think, the most coherent account of the Crown you have heard from anyone. That is not a comfort.',
        ),
        choices: [
          { label: '[Take the ash] Choose a rare card. Add Crown\'s Whisper to your deck.', async fx(g) { curse(g, 'crowns_whisper'); await offerRandom(g, { rarity: 'rare', forced: true }, 'What the ash gives'); return 'ash'; } },
          { label: '[Refuse them] Fight. Obtain a relic.', fx(g) { return fight(g, FOES.cultists, { resume: 'won', reward: { relic: rewardRelic(g, 'crown_splinter', 'common') } }); } },
          { label: '[Stand aside]', next: 'aside' },
        ],
      },
      ash: {
        text: P(
          'You kneel in the road. The leader draws his thumb across your brow, cheek to cheek, and the ash is cold: not like cinders, but like snow that has forgotten how to melt. "Held," he says. "Now you are held."',
          'For a moment the world goes very quiet. You feel it: a great, patient attention turning toward you from the direction of Ashgrave, the way a sleeper turns toward a sound. It is not unkind. It is interested. It knows your name.',
          'Then the procession moves on, singing, and you are kneeling alone in the road, and your hands know something they did not know before. When you wipe your face, the ash does not come off.',
        ),
        choices: [leave()],
      },
      won: {
        text: P(
          'The last of them went down in the cinders and the iron crown toppled into the ditch with a clang. The survivors scattered into the fen, wailing.',
          'Among the bundles they left is a little reliquary of blackened silver, no bigger than a fist. Inside, on grey velvet, lies a sliver of dark iron the length of a finger. A label in a pious hand reads: *A Splinter of the True Crown, Struck Off at the Founding.*',
          'It is almost certainly a nail from somebody\'s barn door. It is also colder than iron ought to be, and when you close the box you could swear you hear, very faintly, from inside it: *again.*',
        ),
        choices: [leave()],
      },
      truth: {
        text: P(
          '"He\'s dead," you tell them. "I was there. I stood at his door. I heard him..." Your voice catches. "He\'s dead. No one is resting. No one is holding you."',
          'The singing falters. The leader stares, his ash-mask cracking at the corners of his mouth. "Liar," he says. But the word comes out small.',
          'The procession breaks. Some weep. Some curse you. Some just stand in the road, lost. And a few, three or four, quietly wipe the ash from their faces with their sleeves and turn back the way they came, toward home.',
          'One of them stops and empties her offering-bowl into your hands. "For telling it plain," she says. "Nobody does, any more."',
        ),
        choices: [leave()],
      },
      aside: {
        text: P(
          'You step off the road and let them pass: thirty of them, barefoot, singing. The crown goes by on its pole, rust flaking from it like old skin.',
          'At the very end walks a girl of perhaps sixty in a child\'s ash-smeared smock, carrying a doll. She looks back at you as she passes. Her eyes are very clear.',
          '"It isn\'t the King," she whispers. "In there. It never was."',
          'Then the procession closes around her and carries her on, toward Ashgrave, singing.',
        ),
        choices: [leave()],
      },
    },
  },

  // ---------------------------------------------------------------- 14
  {
    id: 'a1_open_grave', title: 'A Grave With Your Name', acts: [1], art: 'scene_crypt',
    pages: {
      start: {
        text: (g) => {
          if (g.run.hero === 'cantor') {
            return P(
              'At the edge of a drowned churchyard, among stones worn smooth as soap, there is a grave with your name on it.',
              'It is not freshly dug. It was filled in, and some time ago: the mound has settled, the turf has knit, and a few pale flowers have come up through the grass, the only flowers you have seen since Ashfall. A spade stands upright beside it, as if someone came to dig and found the work already done.',
              'The marker reads CAEL, and below it, in a small careful hand: *Didn\'t need doing, this one. Sorry, Brother. H.*',
              'You read it twice. It must be some other Cael. It is not an uncommon name.',
            );
          }
          const name = { knight: 'ALDOUS VANE', witch: 'ISOLDE MARROW', wren: 'WREN, and beside it, where a surname should be, a small carved bird' }[g.run.hero] || 'your name';
          return P(
            'At the edge of a drowned churchyard, among stones worn smooth as soap, there is a fresh grave.',
            'It is neatly dug: six feet, square corners, the spoil heaped tidily to one side. A spade stands upright in the heap. The marker at the head is new wood, and someone has carved a name into it with great care.',
            `It reads ${name}. Below, in the same careful hand: *Not yet. But soon, likely. Thought I\'d get ahead. H.*`,
            'Ash falls into the hole, very softly. It looks, you think, like a comfortable grave. Dry. Well drained. Out of the wind.',
          );
        },
        choices: [
          { label: '[Lie down in it, just for a moment] Heal to full. Lose 4 Max HP.', show: (g) => g.run.hero !== 'cantor', fx(g) { g.loseMaxHp(4); g.healOut(g.player.maxHp); return 'lie'; } },
          { label: '[Sit on the settled earth] Heal 15 HP.', show: isHero('cantor'), fx(g) { g.healOut(15); return 'sit'; } },
          { label: '[Take the spade] Obtain a relic.', fx(g) { relic(g, 'hobs_spade', 'common'); return 'spade'; } },
          { label: '[Bury something in it] Remove a card from your deck.', req: (g) => removable(g).length > 0 || 'You have nothing to bury.', async fx(g) { await g.removeCardChoice(1, 'Choose a card to bury'); return 'bury'; } },
          leave('[Walk on]'),
        ],
      },
      lie: {
        text: P(
          'You climb down into it. You don\'t quite know why. The walls are cool and close and smell of clean earth, and when you lie on your back the sky is a grey slot far above, and the ash comes down into it slow as thistledown.',
          'It is the most comfortable you have been since Ashfall.',
          'You close your eyes. Far away, somebody is digging, a steady patient rhythm, and an old man is humming a tune you almost know.',
          'When you open your eyes, hours have passed, or minutes. Your wounds have closed. You climb out whole and rested and somehow *less*, as if you left a little of yourself down there, keeping the grave warm for later.',
        ),
        choices: [leave()],
      },
      sit: {
        text: P(
          'You sit on the settled earth of your own grave (no: of a grave that bears your name; that is not the same thing) and fold your hands, and wait for the feeling to pass.',
          'It doesn\'t pass. It settles, like the earth. It is not fear. It is closer to recognition: the feeling of coming back into a room you left in a hurry, and finding everything just where you put it.',
          'The grass is soft. The stone at your back is warm. When you rise, you are rested. You do not look back at the marker. You do not need to. You remember what it says.',
        ),
        choices: [leave()],
      },
      spade: {
        text: P(
          'The spade comes out of the earth easily, as if it wanted to. The haft is ash wood, worn smooth and dark by a lifetime of hands, more than a lifetime. The blade is old iron, keen as a razor, and stamped near the socket is a little mark: a crown, so worn you have to tilt it to the light to see it.',
          'It sits in your grip as if it were made for you. Or you for it.',
          'He\'ll want that back, you think. And then, less comfortably: He\'ll know where to find me.',
        ),
        choices: [leave()],
      },
      bury: {
        text: (g) => P(
          'You drop something into the grave. You are not sure, afterward, quite what. Something you had been carrying. Something you did not need.',
          'Then you take up the spade and fill the hole properly, the way it is meant to be done: tamp, layer, tamp. It is slow work, and good. When it is finished you square off the mound and lean on the spade a while, breathing.',
          g.run.hero === 'cantor'
            ? 'The marker has not changed. You did not expect it to.'
            : 'The name on the marker has changed. You are not sure when. It says: *Not this time. H.*',
        ),
        choices: [leave()],
      },
    },
  },
]);
