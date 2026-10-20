// Any-act events (Acts 1-3): recurring oddities of the road. Several remember
// earlier mornings via numeric meta flags (any_<id>_n).
import { defineEvents, CARDS } from '../../engine/registry.js';
import {
  P, isHero, byHero, roll, hasGold, hasHp, hasRoom, removable, curses, curse, relic,
  removeRandom, offerRandom, fight,
} from './act1.js';

const leave = (label = '[Leave]') => ({ label, end: true });
const ACTS = [1, 2, 3];

// Count visits across mornings (meta), and remember how many came before this one.
function visit(g, data, key) {
  data.met = g.metaFlag(key) || 0;
  g.setMetaFlag(key, data.met + 1);
}

// ------------------------------------------------------------------ gambler wagers
const odds = (data) => (data.watched ? 0.65 : 0.5);
function wagers() {
  return [
    { label: '[Bet 30 Gold] Win: gain 60 more. Lose: lose the 30.', req: hasGold(30), fx(g, d) {
      d.rounds = (d.rounds || 0) + 1;
      if (roll(g) < odds(d)) { g.gainGold(60); d.result = 'You win. He pays out without a flicker, coin by coin, as if it pleased him.'; }
      else { g.loseGold(30); d.result = 'You lose. He sweeps the coins into a drawer that sounds a great deal deeper than the table.'; }
      return 'result';
    } },
    { label: '[Bleed into the cup] Lose 7 HP. Win: obtain a relic.', req: hasHp(7), fx(g, d) {
      d.rounds = (d.rounds || 0) + 1;
      g.hurt(7);
      if (g.run.over) return;
      if (roll(g) < odds(d)) { g.obtainRelic(); d.result = 'You win. He reaches under the table and brings out something from a collection that has clearly been a long time growing.'; }
      else d.result = 'You lose. He tips your blood out onto the road, where the ash drinks it, and apologises for the waste.';
      return 'result';
    } },
    { label: '[Stake a card] Win: choose a rare card. Lose: a random card is taken.', req: (g) => removable(g).length > 0 || 'You have nothing to stake.', async fx(g, d) {
      d.rounds = (d.rounds || 0) + 1;
      if (roll(g) < odds(d)) { d.result = 'You win. He fans a hand of cards across the table: things you have never been taught, and will remember.'; await offerRandom(g, { rarity: 'rare' }, 'Your winnings'); }
      else { const c = removeRandom(g); d.result = `You lose. He plucks ${c ? 'your ' + (CARDS[c.id].name || 'card') : 'something'} from your mind like a card from a sleeve, and pockets it.`; }
      return 'result';
    } },
  ];
}

// ------------------------------------------------------------------ events
defineEvents([
  // ---------------------------------------------------------------- 1
  {
    id: 'any_faceless_shrine', title: 'The Faceless Shrine', acts: ACTS, art: 'scene_shrine',
    init(g, d) { visit(g, d, 'any_shrine_n'); },
    pages: {
      start: {
        text: (g, d) => P(
          d.met ? 'The shrine again. Or another just like it: they stand along every old road in Morrow, and you are beginning to suspect they are the same one, waiting for you.' : '',
          'A wayside shrine, old as the road: a stone hood, and beneath it the figure of a woman with her hands open in her lap. Where her face should be, the stone is smooth. Not broken. Not chiselled. Smooth, like the inside of a shell.',
          'Someone has been here before you. There is a saucer of milk at her feet, fresh, though there is no farm for miles; a heel of bread; a child\'s milk tooth.',
          'The air is different here. Warmer. It smells of turned earth, which is to say it smells of spring, which you have not smelled in a long time.',
          byHero(g, {
            wren: 'As you come close the warmth thickens. The milk trembles in its saucer. You are almost sure the smooth stone face has turned toward you, and that it knows you, and is glad.',
            witch: 'Superstition, you tell yourself, and find you have taken a coin from your purse anyway.',
            cantor: 'A heathen shrine. The Order would have it pulled down. You find you have bowed your head before you can stop yourself, and that it does not feel like a sin.',
          }),
        ),
        choices: [
          { label: '[Offer blood] Lose 6 HP. Gain 5 Max HP.', req: hasHp(6), fx(g) { g.hurt(6); if (g.run.over) return; g.gainMaxHp(5); return 'blood'; } },
          { label: '[Offer coin] Lose 25 Gold. Remove a random Curse from your deck.', req: (g) => (curses(g).length ? hasGold(25)(g) : 'You carry no curse.'), fx(g) { g.loseGold(25); removeRandom(g, curses(g)); return 'coin'; } },
          { label: '[Take the milk and bread] Heal 12 HP. Add Rot-Touched to your deck.', fx(g) { g.healOut(12); curse(g, 'rot_touched'); return 'take'; } },
          { label: '[Touch the smooth face] Heal 10 HP. Gain 3 Max HP.', show: isHero('wren'), fx(g) { g.gainMaxHp(3); g.healOut(10); return 'touch'; } },
          { label: '[Read the worn inscription]', fx(g) { g.unlockLore('lore_faceless_shrines'); return 'read'; } },
          leave(),
        ],
      },
      read: {
        text: P(
          'The inscription on the plinth has worn almost away. You trace it with your fingers. The script is older than Morrow\'s; the words, when you puzzle them out, are simple.',
          '*WHAT IS TAKEN COMES HOME.*',
          'Someone, much later, has scratched beneath it in the common hand: *please*. And beneath that, in another: *soon*.',
        ),
        choices: [
          { label: '[Offer blood] Lose 6 HP. Gain 5 Max HP.', req: hasHp(6), fx(g) { g.hurt(6); if (g.run.over) return; g.gainMaxHp(5); return 'blood'; } },
          { label: '[Offer coin] Lose 25 Gold. Remove a random Curse from your deck.', req: (g) => (curses(g).length ? hasGold(25)(g) : 'You carry no curse.'), fx(g) { g.loseGold(25); removeRandom(g, curses(g)); return 'coin'; } },
          leave(),
        ],
      },
      blood: {
        text: P(
          'You cut the ball of your thumb and let three drops fall into the saucer. They do not spread. They sink, slowly, like stones, and the milk closes over them.',
          'Something answers. Not a voice: a feeling, rising up through the soles of your feet, the way warmth rises from a hearthstone long after the fire is out. Your heart beats once, very hard, and then settles into a slower, deeper rhythm than before, like roots finding water.',
          'When you stand, you are taller in some way you cannot measure.',
        ),
        choices: [leave()],
      },
      coin: {
        text: P(
          'You set the coins at her feet. For a moment nothing happens. Then something that has been clinging to you, cold and close as a wet shirt, lets go.',
          'You feel it leave. You feel it go down into the earth beneath the shrine, quite willingly, the way a tired child goes to bed.',
          'The coins are gone when you look again. Whoever she is, she keeps her bargains. That is more than can be said for kings.',
        ),
        choices: [leave()],
      },
      take: {
        text: P(
          'You drink the milk and eat the bread. It is the sweetest thing you have tasted since Ashfall: sweet as the first meal after a fever.',
          'Only afterward, licking the crumbs from your fingers, do you notice the grey bloom spreading under your nails, soft as mould on a peach. It does not hurt. It is not unpleasant. It feels like something beginning.',
          'The smooth stone face regards you. You have the distinct sense that you have not been punished. You have been *included*.',
        ),
        choices: [leave()],
      },
      touch: {
        text: P(
          'You lift your hand and lay it against the smooth place where her face should be.',
          'The stone is warm as skin. Your palm fits the curve of it the way a key fits a lock, and for one long moment you feel something on the far side of the stone press back: gently, wonderingly, the way a mother touches a sleeping child to be sure it is real.',
          'You take your hand away. Your palm is tingling. Your chest is full of something you have no name for. You put your mask back straight and walk on quickly, and you do not cry, because you have nothing to cry with.',
        ),
        choices: [leave()],
      },
    },
  },

  // ---------------------------------------------------------------- 2
  {
    id: 'any_gambler', title: 'The Bone-Dice Gambler', acts: ACTS, art: 'scene_camp',
    init(g, d) { visit(g, d, 'any_gambler_n'); d.rounds = 0; },
    pages: {
      start: {
        text: (g, d) => P(
          'By the roadside, under a lean-to of old sailcloth, a man sits at a folding table with a cup of dice. He wears a gentleman\'s coat a century out of fashion and a gentleman\'s smile to match. The dice are bone. You decide not to ask whose.',
          d.met
            ? '"You again!" he says warmly. "You won last time. Or I did. One loses track." He rattles the cup.'
            : '"Ah," he says. "A player." He rattles the cup. "Simple game. Higher roll wins. I\'ve not lost since Ashfall, not once, which I\'ll admit has made opponents scarce."',
          '"I\'ll take coin. I\'ll take blood. I\'ll take, if you\'re feeling bold, a piece of what you know. And I pay, I promise you, very handsomely."',
          byHero(g, {
            knight: '"I don\'t gamble," you say. "Everyone gambles, Sir Knight," he says. "You bet your whole life on a closed door."',
            wren: '"What happens if *you* lose?" you ask. He considers. "I have no idea. Isn\'t that exciting?"',
            cantor: '"A priest at my table!" he cries, delighted. He, at least, has no trouble seeing you. "Bless the dice, Brother, or curse them. I\'m not fussy."',
          }),
        ),
        choices: [
          ...wagers(),
          { label: '[Watch his hands for a while]', fx(g, d) { d.watched = true; return 'watch'; } },
          leave('[Walk away]'),
        ],
      },
      watch: {
        text: P(
          'You watch him play himself for a while, left hand against right, while he chatters about the weather and the price of mourning crape.',
          'You see it on the fourth throw. The dice are knucklebones, and his left hand is missing two of them. When he wants a six, a finger on that hand twitches, and in the cup, something answers.',
          'He sees you see it, and grins without the least embarrassment. "Of course I cheat. Everyone cheats. The Crown has cheated for four hundred years." He slides the cup toward you. "Now you know the trick. Care to play fair?"',
        ),
        choices: [...wagers(), leave('[Walk away]')],
      },
      result: {
        text: (g, d) => P(
          d.result || 'The dice settle.',
          d.rounds >= 3 ? '"And that\'s my evening," he says, folding up the table with a snap. "Same time tomorrow? It\'s always the same time tomorrow."' : '"Another?" he asks, rattling the cup.',
        ),
        choices: [
          { label: '[Another round]', show: (g, d) => d.rounds < 3, next: 'table' },
          leave('[Walk away]'),
        ],
      },
      table: {
        text: P('He rattles the cup, and smiles, and waits. The ash falls on the sailcloth over his head and slides off without a sound.'),
        choices: [...wagers(), leave('[Walk away]')],
      },
    },
  },

  // ---------------------------------------------------------------- 3
  {
    id: 'any_mirror', title: 'The Mirror in the Field', acts: ACTS, art: 'scene_ruins',
    pages: {
      start: {
        text: (g) => P(
          'In the middle of nowhere stands a mirror.',
          'It is tall as a door, framed in black wood carved with ivy, and it stands upright in the open with nothing holding it: no wall, no stand, no house around it, though there may have been one once. Ash slides down its face and does not stick.',
          byHero(g, {
            knight: 'Your reflection stands at a door with its hand on the latch. It is not opening it. It is waiting for you to look away.',
            witch: 'The reflection is not quite you. Older; softer about the mouth; a sprig of rue behind one ear. It looks at you with such love that you have to look away. You know whose face that is. You have not seen it since you were twelve.',
            wren: 'There is a face in the mirror. A *face*: brows, mouth, a nose with a bump in it, looking back at you with your own startled tilt of the head. It is a very good face. It isn\'t yours. Is it?',
            cantor: 'The glass is clouded where you stand, as if breathed on from the inside. Everything else, the field, the sky, the falling ash, reflects perfectly. Old glass, you tell yourself. Flawed.',
            def: 'You see yourself in it. Then, for a moment, you see yourself in it doing something you are not doing.',
          }),
        ),
        choices: [
          { label: '[Reach into the glass] Lose 6 HP. Copy a card in your deck.', req: hasHp(6), async fx(g) {
            g.hurt(6);
            if (g.run.over) return;
            const seen = new Set();
            const list = [];
            for (const c of g.run.deck) {
              const d = CARDS[c.id];
              if (!d || d.type === 'curse' || d.type === 'status') continue;
              const k = c.id + ':' + (c.up || 0);
              if (!seen.has(k)) { seen.add(k); list.push({ id: c.id, up: c.up || 0 }); }
            }
            if (list.length) await g.offerCards(list, { title: 'Draw something out of the glass' });
            return 'reach';
          } },
          { label: '[Trade places with your reflection] Transform a card.', req: (g) => removable(g).length > 0 || 'Nothing to trade.', async fx(g) { await g.transformCardChoice(1); return 'trade'; } },
          { label: '[Smash it] Obtain a relic. Add Doubt to your deck.', fx(g) { g.obtainRelic(); curse(g, 'doubt'); return 'smash'; } },
          leave('[Turn your back on it]'),
        ],
      },
      reach: {
        text: P(
          'You push your hand against the glass and it gives, cold and thick as river water. Your reflection reaches back. Your fingers meet. Its grip is exactly as strong as yours.',
          'It takes something from you to bring anything out: you feel it go, a little warmth, a little blood, the cost of passage. But when you draw your hand back, you are holding something you already own. Two of it, now.',
          'Your reflection, still holding its own copy, gives you a small nod, as between colleagues.',
        ),
        choices: [leave()],
      },
      trade: {
        text: P(
          'You step forward. Your reflection steps forward. For one dizzy instant you are on the other side, looking out at yourself in a grey field, and the world is backward and very quiet.',
          'Then you are back. Mostly. Your reflection waves to you, a little smugly, with the wrong hand.',
          'Something you knew how to do, you have forgotten. Something you never learned, you know. You suspect the arrangement suits it better than it suits you, but you are not sure, and you will never be sure, and that is how mirrors win.',
        ),
        choices: [leave()],
      },
      smash: {
        text: P(
          'You pick up a stone and throw it.',
          'The mirror does not crack. It *bursts*, with a sound like a bell struck underwater, and the pieces hang in the air a moment, each one showing you a different face (younger, older, crowned, dead) before they fall in the ash and go dark.',
          'In the frame, where the glass was, something glints. You take it. You do not look at the shards on your way out. You can feel them looking at you.',
        ),
        choices: [leave()],
      },
    },
  },

  // ---------------------------------------------------------------- 4
  {
    id: 'any_confessional', title: 'The Confessional', acts: ACTS, art: 'scene_chapel',
    init(g, d) { visit(g, d, 'any_confessional_n'); },
    pages: {
      start: {
        text: (g, d) => P(
          'The chapel burned long ago. Its roof is sky and its pews are ash. But the confessional stands untouched in the nave, dark oak, its little curtain drawn, as if the fire had walked politely around it.',
          'As you pass, the grille slides open with a click.',
          d.met
            ? '"Back again, child?" says a voice from the other side. "Of course you are. Kneel. You\'ve picked up more since last time. Everyone does."'
            : '"Come," says a voice from the other side, unhurried, neither young nor old. "Kneel. Unburden yourself. Everyone has something to set down, and I am very good at carrying things."',
        ),
        choices: [
          { label: (g) => (g.run.hero === 'cantor' ? '[Take your old seat] Remove a card from your deck.' : '[Kneel and confess] Remove a card from your deck.'), req: (g) => removable(g).length > 0 || 'You have nothing to set down.', async fx(g) { await g.removeCardChoice(1, 'What will you set down?'); return 'confess'; } },
          { label: '[Listen at the grille]', fx(g) { g.unlockLore('lore_letter_confession'); return 'listen'; } },
          { label: '[Draw back the priest\'s curtain] Obtain a Tincture.', req: hasRoom, fx(g) { g.obtainPotion(); return 'curtain'; } },
          leave(),
        ],
      },
      listen: {
        text: P(
          'You press your ear to the grille. The voice is silent; but behind it, faint as an echo in a well, you hear someone else, some earlier penitent, years gone, whose words have soaked into the oak like smoke.',
          '*Forgive me, Father. I\'m a physician. Fifty years I\'ve cured no one and lost no one. And now they\'ve started dying again, and I don\'t know what to do for them. God help me, I never knew.*',
          'The voice on your side of the grille sighs. "They all say that, in the end," it says. "Now. Will you kneel?"',
        ),
        choices: [
          { label: (g) => (g.run.hero === 'cantor' ? '[Take your old seat] Remove a card from your deck.' : '[Kneel and confess] Remove a card from your deck.'), req: (g) => removable(g).length > 0 || 'You have nothing to set down.', async fx(g) { await g.removeCardChoice(1, 'What will you set down?'); return 'confess'; } },
          leave(),
        ],
      },
      confess: {
        text: (g) => P(
          byHero(g, {
            knight: '"I stood at a door," you say. "He was begging. I heard him begging. I had my orders, and I stood there, and I did nothing, and in the morning he was dead." The voice is quiet a long while. "And which did you fear more," it asks at last, "that he would die, or that you would have to choose?"',
            witch: g.metaFlag('witch_2')
              ? '"I hated my mother," you say, and it comes out of you like a splinter. "For dying. For leaving me to the court. I spent my life trying to cure what killed her so I\'d never have to admit it." "And now?" says the voice. "Now I think she may not be dead," you say, "and I don\'t know what I\'ll say to her."'
              : '"I hated my mother," you say, and it comes out of you like a splinter. "For dying. For leaving me to the court. I was twelve. I spent the rest of my life trying to cure what killed her, so I\'d never have to admit it." "And now?" says the voice. "Now I would give anything to tell her I\'m sorry."',
            wren: '"I don\'t know what I am," you say. "Everyone else knows. I wear faces so people stop looking at the place where mine should be. Sometimes I think if I took them all off there\'d be nothing there at all." "Would that be so terrible?" the voice asks gently. "Yes," you whisper. And then: "No. I don\'t know."',
            cantor: 'Out of thirty years\' habit you go to the wrong door, the priest\'s door, and sit. Only when the grille slides open do you realise someone is kneeling on the other side. "Brother Cael," says the voice. "Who hears the confessor\'s confession?" You open your mouth to say you have nothing to confess. What comes out is: "I think I have forgotten something very important. And I am afraid that it was me."',
            def: 'You tell it the thing you have told no one. It listens without interrupting, the way only the very old and the very patient can.',
          }),
          'The grille slides shut. When you rise, you are lighter. Something you were carrying has been taken from you, and you did not even feel the hand.',
        ),
        choices: [leave()],
      },
      curtain: {
        text: P(
          'You twitch back the priest\'s curtain.',
          'There is no one there. On the bench lies a heap of fine grey ash in the shape of a seated man, hands folded in its lap, a stole of mouldering purple about its shoulders. In the ash, glinting, is a stoppered vial of holy water, never used.',
          'You take it. As you turn, the voice says, from directly behind your left ear and without the least heat: "Rude."',
          'There is nobody behind you either. You leave quickly. You do not run, but it is a near thing.',
        ),
        choices: [leave()],
      },
    },
  },

  // ---------------------------------------------------------------- 5
  {
    id: 'any_peddler_road', title: 'The Peddler on the Road', acts: ACTS, art: 'scene_road', speaker: 'peddler',
    init(g, d) { visit(g, d, 'any_peddler_n'); g.setMetaFlag('met_peddler'); },
    pages: {
      start: {
        text: (g) => P(
          'A cart blocks the road: high-sided, black-lacquered, hung with a hundred little brass bells that do not ring. On the box sits a figure in a grey hooded coat. You know this coat. You have seen it across shop counters in a dozen towns, behind prices that never change.',
          '"Oh, it\'s you," says the Pale Peddler. "Of course it\'s you. Out on a road with no shop on it, and who should come along?" A gloved hand turns palm up. "Since we\'re both here: I\'ve a few things that don\'t sit on shelves. Odd stock. Unlisted. And if you\'ve no coin, well. There are other ways to pay. There always are."',
          g.metaFlag('peddler_is_pell') ? 'One of the bells gives a single tiny jingle. The Peddler coughs, loudly, and looks at the sky.' : '',
        ),
        choices: [
          { label: '[Buy the wrapped parcel] Lose 75 Gold. Obtain a random relic.', req: hasGold(75), fx(g) { g.loseGold(75); g.obtainRelic(); return 'parcel'; } },
          { label: '[Sell him a year] Lose 6 Max HP. Gain 90 Gold.', req: (g) => g.player.maxHp > 12 || 'You have too few years to spare.', fx(g) { g.loseMaxHp(6); g.gainGold(90); return 'year'; } },
          { label: '[Buy a cordial] Lose 30 Gold. Heal 20 HP.', req: hasGold(30), fx(g) { g.loseGold(30); g.healOut(20); return 'cordial'; } },
          { label: '[Ask about the bells]', fx(g) { g.unlockLore('lore_letter_peddler'); return 'bells'; } },
          leave('[Go on your way]'),
        ],
      },
      bells: {
        text: (g) => P(
          '"Bells?" says the Peddler. "What bells?"',
          'You point at the hundred little bells on the cart.',
          '"Oh, *those*. Decorative. They don\'t ring." A pause. "They rang once, for a king. I keep them for sentiment. Everybody needs one sentimental thing, or they turn into furniture." The hood tilts. Under it, for just an instant, you think you see the gleam of something white and smooth, like a porcelain cheek, with a crack running across it.',
          g.metaFlag('peddler_is_pell') ? '"Stop looking at me like that," says the Peddler. "One coat at a time, heir. One coat at a time."' : '"Now," says the Peddler briskly. "Are you buying, or just admiring the craftsmanship?"',
        ),
        choices: [
          { label: '[Buy the wrapped parcel] Lose 75 Gold. Obtain a random relic.', req: hasGold(75), fx(g) { g.loseGold(75); g.obtainRelic(); return 'parcel'; } },
          { label: '[Sell him a year] Lose 6 Max HP. Gain 90 Gold.', req: (g) => g.player.maxHp > 12 || 'You have too few years to spare.', fx(g) { g.loseMaxHp(6); g.gainGold(90); return 'year'; } },
          { label: '[Buy a cordial] Lose 30 Gold. Heal 20 HP.', req: hasGold(30), fx(g) { g.loseGold(30); g.healOut(20); return 'cordial'; } },
          leave('[Go on your way]'),
        ],
      },
      parcel: {
        text: P(
          'The parcel is wrapped in brown paper and tied with black string, and it is heavier than it looks, or lighter; it seems to change its mind as you hold it.',
          '"No peeking till I\'m out of sight," says the Peddler. "It spoils the magic. Also, the returns policy."',
          'You open it a mile down the road. It is exactly what you needed. You did not know you needed it until now. You suspect the Peddler did.',
        ),
        choices: [leave()],
      },
      year: {
        text: P(
          '"Splendid," says the Peddler, and produces a little silver scale. "Hold out your hand. No, the other one. The one with more future in it."',
          'It doesn\'t hurt. You feel a slight tug, like a thread pulled from a hem, and on the scale a small grey shape appears, about the weight of a sparrow. The Peddler wraps it in a handkerchief with great tenderness.',
          '"A good year," it says, counting out your gold. "You\'d have spent it badly, mind. Everybody does."',
        ),
        choices: [leave()],
      },
      cordial: {
        text: P(
          'The cordial comes in a tiny cut-glass cup and tastes of blackcurrant and woodsmoke and, faintly, of someone else\'s happy afternoon.',
          'Warmth goes through you like sunlight through a window. Bruises fade. Cuts knit. You feel, for a moment, about nine years old.',
          '"Family recipe," says the Peddler. "Whose family, I couldn\'t say. I won it off a fairy at cards."',
        ),
        choices: [leave()],
      },
    },
  },

  // ---------------------------------------------------------------- 6
  {
    id: 'any_wishing_well', title: 'The Well That Answers', acts: ACTS, art: 'scene_well',
    pages: {
      start: {
        text: P(
          'A well, in a village with no one in it. The doors stand open, the hearths are cold, the washing hangs grey and stiff on the lines. Only the well has been kept up. Its bucket is new. Its rope is new. Someone has carved into the lip, in many hands over many years, a single word: *ASK*.',
          'You lean over. Far, far down, something glimmers: water, or eyes.',
          'And from down there, faint as breath, comes a sound like a crowd murmuring in a great hall. It goes on and on. You cannot make out the words. You think, after a while, that it is the same words, said by a great many voices, over and over.',
        ),
        choices: [
          { label: '[Drop in a coin and wish] Lose 20 Gold. Receive a small blessing.', req: hasGold(20), fx(g, d) {
            g.loseGold(20);
            const x = roll(g);
            if (x < 0.35) { g.healOut(15); d.boon = 'A warmth comes up out of the well like breath on a cold morning, and your aches ease.'; }
            else if (x < 0.6 && g.run.potions.includes(null)) { g.obtainPotion(); d.boon = 'The bucket, when you haul it up, has a stoppered bottle bobbing in it.'; }
            else if (x < 0.85) { g.upgradeRandom(1); d.boon = 'A thought surfaces in you as if from deep water, clear and useful, and stays.'; }
            else { g.gainMaxHp(3); d.boon = 'Something below sighs, contented. Your heart steadies, and beats a little stronger than before.'; }
            return 'coin';
          } },
          { label: '[Haul up the bucket] Lose 7 HP. Obtain a common relic.', req: hasHp(7), fx(g) { g.hurt(7); if (g.run.over) return; g.obtainRelic('common'); return 'bucket'; } },
          { label: '[Listen to the voices]', fx(g) { g.unlockLore('lore_undercroft'); return 'listen'; } },
          leave(),
        ],
      },
      listen: {
        text: P(
          'You lean into the dark until the murmur fills your head. It is voices: thousands upon thousands, old and young, packed so close they have worn smooth against each other like stones in a river. They are all saying the same thing. It takes you a long time to make it out.',
          '*Is it time yet?*',
          '*Is it time yet?*',
          '*Is it time?*',
          'You pull back from the lip. Your hands are shaking. Far below, the murmur goes on, patient, unhurried, the voices of people who have been asking for a very long time and have learned not to expect an answer.',
        ),
        choices: [
          { label: '[Drop in a coin and wish] Lose 20 Gold. Receive a small blessing.', req: hasGold(20), fx(g, d) {
            g.loseGold(20);
            if (roll(g) < 0.5) { g.healOut(15); d.boon = 'Below, the voices fall silent a moment, as if surprised to be given anything. A warmth comes up out of the dark, and your aches ease.'; }
            else { g.upgradeRandom(1); d.boon = 'A thought surfaces in you as if from deep water, clear and useful, and stays.'; }
            return 'coin';
          } },
          leave(),
        ],
      },
      coin: {
        text: (g, d) => P(
          'The coin falls a long way. You never hear it land.',
          d.boon || 'Something below accepts it.',
          'As you walk away, the murmur behind you changes, just for a moment, into something almost like *thank you*.',
        ),
        choices: [leave()],
      },
      bucket: {
        text: P(
          'You let the bucket down hand over hand until the rope runs out. Something takes hold of it at the bottom. Not the water. Something with weight, and patience.',
          'You haul. It hauls back. For a long minute you are in a tug-of-war with the dark, your boots skidding on the wet stones and the rope burning through your palms, and then it simply *lets go*, and you go over backward with the bucket in your lap.',
          'In the bucket is a thing that has been at the bottom of the well a very long time, wiped clean, and placed there carefully, as if it were a gift. Or a trade.',
        ),
        choices: [leave()],
      },
    },
  },

  // ---------------------------------------------------------------- 7
  {
    id: 'any_old_knight', title: 'Sir Godwin of the Fens', acts: ACTS, art: 'scene_camp',
    pages: {
      start: {
        text: (g) => P(
          'A campfire, and beside it an old man in older armour, polishing a sword that has been polished so often it is more idea than blade.',
          g.run.hero === 'cantor'
            ? '"Sir Godwin of the Fens!" he announces to the fire, rising with a sound like a cart going downhill. "Knight of the Long King\'s Hundred. Questing." He seems to be talking to nobody. "Talking to myself again. Ninety years on the road does that to a man."'
            : '"Sir Godwin of the Fens," he announces, rising with a sound like a cart going downhill. "Knight of the Long King\'s Hundred. Questing." He is perhaps a hundred and thirty. His moustache alone is older than some kingdoms. "I have been questing for the Glass Stag since His Majesty\'s coronation. Ninety-one years. I\'m told I\'m getting warm."',
          byHero(g, {
            knight: 'He squints. "Little Vane! The laundress\'s boy! I taught you to hold a shield." His face falls. "Is it true, what they say? That you held the door?" You tell him it is true. He nods slowly. "Good lad," he says. "Orders are orders." It is the worst thing anyone has said to you in a year.',
            witch: '"My lady," he says, bowing so low something creaks. "Don\'t," you say.',
            wren: 'He peers at your mask. "Are you, by any chance, enchanted?" "Constantly," you tell him. He looks delighted.',
            def: '"Care to try a pass with an old man? Or sit and share my fire. I\'ve stories. Lord, have I got stories."',
          }),
        ),
        choices: [
          { label: '[Spar with him] Lose 8 HP. Upgrade 2 random cards.', req: hasHp(8), fx(g) { g.hurt(8); if (g.run.over) return; g.upgradeRandom(2); return 'spar'; } },
          { label: '[Share his fire] Heal 12 HP.', fx(g) { g.healOut(12); g.unlockLore('lore_long_king'); return 'fire'; } },
          { label: '[Take his sword while he dozes] Obtain an uncommon relic. Add Shame to your deck.', fx(g) { g.obtainRelic('uncommon'); curse(g, 'shame'); return 'steal'; } },
          { label: '[Kneel before him] Upgrade a card. Gain 4 Max HP.', show: isHero('knight'), async fx(g) { g.gainMaxHp(4); await g.upgradeCardChoice(1); return 'kneel'; } },
          leave(),
        ],
      },
      spar: {
        text: (g) => P(
          g.run.hero === 'cantor'
            ? 'He spars with you, or with the air a little to your left; his eyes are very bad, and it is hard to tell. He is still terrifyingly good.'
            : 'He is a hundred and thirty, half blind and wheezing. He is also the finest swordsman you have ever crossed blades with.',
          'He does not hurry. He does not need to. Every cut you make, he has seen a thousand times; every opening you leave, he finds, and taps, gently, with the flat, to show you it was there. By the end you are bruised from scalp to shin and you have learned more in an hour than in the last year.',
          '"Not bad," he says, wheezing happily. "Not bad at all. The Stag would be terrified."',
        ),
        choices: [leave()],
      },
      fire: {
        text: P(
          'You sit. He talks. Lord, does he talk.',
          'He tells you about the Long King\'s coronation, when the King was nineteen and laughed at everything; about the jousts, and the year the river froze, and the King\'s first queen, who was kind; about the long, slow, grey years after, when nothing changed and nobody died and the King stopped laughing.',
          '"He used to ask me," says Sir Godwin, staring into the fire, "whether I ever got tired. Questing. I said no, sire, never. I lied. I think he knew. I think he was tired too."',
          'The fire is warm. His voice is warm. You sleep better than you have in weeks.',
        ),
        choices: [leave()],
      },
      steal: {
        text: P(
          'Halfway through a story about a dragon that turned out to be a very large goose, Sir Godwin falls asleep sitting up, his chin on his breastplate, snoring like a saw.',
          'You lift the sword from his knees. It is lighter than it looks. Ninety years of polish have worn it down to something almost like moonlight.',
          'He does not wake. In the morning he will look for it, and not find it, and decide, you suspect, that the Glass Stag took it. He will be pleased. It will mean he is getting close. You tell yourself this several times on the road.',
        ),
        choices: [leave()],
      },
      kneel: {
        text: P(
          '"Sir Godwin," you say, and go down on one knee in the ash.',
          'He understands at once. He draws the worn-thin sword and lays it on your shoulder, light as a leaf.',
          '"Aldous Vane," he says, and his old voice steadies into something it has not been in decades. "Be brave. Be just. Be loyal." A pause. The sword lifts, and settles on your other shoulder. "And when your king is wrong, lad, be braver still, and tell him so. I never did. Don\'t be like me."',
          '"Rise," he says. You rise.',
        ),
        choices: [leave()],
      },
    },
  },

  // ---------------------------------------------------------------- 8
  {
    id: 'any_grave_robbers', title: 'The Night Shift', acts: ACTS, art: 'scene_crypt',
    pages: {
      start: {
        text: (g) => P(
          'Two men stand waist-deep in a grave by lantern light, and both of them are swearing.',
          '"Empty," says the fat one. "*Again.*"',
          '"Fourth tonight," says the thin one. He lifts the lantern, and you see that the churchyard around them is pocked with open graves, every lid thrown back, every coffin bare. "They\'re getting *up*, Dunstan. Getting up and walking off with their own grave-goods. It\'s not *decent*."',
          g.run.hero === 'cantor'
            ? 'You wish them good evening. Neither of them looks round. The lantern gutters, and the fat one shivers. "Did you feel that?" "Draught," says the thin one, without conviction.'
            : 'They see you. The fat one lifts his shovel; the thin one lifts a hand to stop him. "Evening," he says, with an ingratiating smile. "We\'re sextons. Night shift. Very respectable. Care to lend a hand? Fair shares. There\'s one over there we haven\'t tried: big stone, rich family. Bound to be something left."',
          byHero(g, { witch: 'You ask whether they would save you a femur, if they find one. They stare at you. "For study," you say. They stare harder.' }),
        ),
        choices: [
          { label: '[Help them dig the rich grave] Lose 5 HP. Gain 35 Gold. Obtain a Tincture.', show: (g) => g.run.hero !== 'cantor', req: hasHp(5), fx(g) { g.hurt(5); if (g.run.over) return; g.gainGold(35); g.obtainPotion(); return 'dig'; } },
          { label: '[Rob the robbers] Fight.', show: (g) => g.run.hero !== 'cantor', fx(g) { return fight(g, g.run.act === 1 ? ['grave_robber'] : null, { pool: 'easy', resume: 'robbed', reward: { gold: 40 } }); } },
          { label: '[Pick up their lantern] Gain 40 Gold. Obtain a Tincture.', show: isHero('cantor'), fx(g) { g.gainGold(40); g.obtainPotion(); return 'lantern'; } },
          leave('[Leave them to it]'),
        ],
      },
      dig: {
        text: P(
          'The rich family\'s grave is deep and the soil is clay, and you dig until your hands blister and your back screams. The thin one, Alfred, keeps up a running commentary on the decline of standards in the profession.',
          'When the spade finally rings on the lid, they all three hold their breath.',
          'It is not empty. The old lady inside is still there, lying with her hands folded, looking peeved. "*Well*," she says. "I was *resting*." She lets you take her rings, on condition that you put her lid back and *keep the noise down*. Dunstan apologises to her for eleven minutes.',
        ),
        choices: [leave()],
      },
      robbed: {
        text: P(
          'Dunstan and Alfred lie groaning among the open graves. Their sack has split, spilling candlesticks, a silver comb, a set of false teeth, and a startling quantity of coin.',
          '"This is *robbery*," says Alfred, aggrieved, from the bottom of a grave.',
          '"Yes," you agree, and help yourself.',
        ),
        choices: [leave()],
      },
      lantern: {
        text: P(
          'You stoop and lift their lantern from the grave\'s edge, meaning to hold it for them so they can see their work.',
          'From their side, the lantern rises into the air by itself.',
          'Dunstan screams. Alfred screams higher. They come out of that grave like corks from bottles and are over the churchyard wall and gone before the lantern has stopped swinging, leaving behind their shovels, their sack, and one boot.',
          'You stand in the empty churchyard holding the lantern. They must have mistaken you for something, you think. The light is very poor.',
        ),
        choices: [leave()],
      },
    },
  },

  // ---------------------------------------------------------------- 9
  {
    id: 'any_tallyman', title: 'The Tallyman', acts: ACTS, art: 'scene_ruins',
    pages: {
      start: {
        text: (g) => {
          const n = Math.max(1, g.meta.runs || 1);
          return P(
            'In the lee of a fallen wall, a hermit sits whittling. He is cutting notches into a blackthorn stick so long it trails behind him into the ash, and when he sees you, his knife stops.',
            '"There you are," he says. "I was wondering when." He runs his thumb along the stick and stops near the end, on a notch still pale and new. "That\'s you, that is. Last time. And that one. And that."',
            `"I count, see. Somebody has to. Every morning it starts over, and nobody remembers, and I *remember*, and I cut a notch. I make this morning number ${n}." He squints at you. "Sound right?"`,
          );
        },
        choices: [
          { label: '[Look at the stick]', fx(g) { g.unlockLore('lore_letter_tally'); g.unlockLore('lore_held_hour'); return 'stick'; } },
          { label: '[Borrow a morning] Heal to full. Add Debt to your deck.', fx(g) { g.healOut(g.player.maxHp); curse(g, 'debt'); return 'borrow'; } },
          { label: '[Lend him one of yours] Lose 5 Max HP. Choose a rare card.', req: (g) => g.player.maxHp > 10 || 'You have too little left to lend.', async fx(g) { g.loseMaxHp(5); await offerRandom(g, { rarity: 'rare' }, 'Something you learned on another morning'); return 'lend'; } },
          leave('[Leave him counting]'),
        ],
      },
      stick: {
        text: P(
          'He lets you hold it. The notches run round it in a spiral, grouped in fives and the fives in hundreds, so many and so fine near the end that they blur. Some carry tiny scratched signs: a hound, a rope, a rat, a crown.',
          '"That\'s how you went, those mornings," he says, tapping them. "Dogs. Rope. Rats. That one\'s a crown. You *took* it, that morning. Didn\'t help. Next morning, here I was, cutting another notch."',
          'The oldest end of the stick is worn smooth as bone. "Who started it?" you ask. He looks at you as if you are simple. "Started? Nobody started it. It\'s always been going. I only noticed."',
        ),
        choices: [
          { label: '[Borrow a morning] Heal to full. Add Debt to your deck.', fx(g) { g.healOut(g.player.maxHp); curse(g, 'debt'); return 'borrow'; } },
          { label: '[Lend him one of yours] Lose 5 Max HP. Choose a rare card.', req: (g) => g.player.maxHp > 10 || 'You have too little left to lend.', async fx(g) { g.loseMaxHp(5); await offerRandom(g, { rarity: 'rare' }, 'Something you learned on another morning'); return 'lend'; } },
          leave('[Leave him counting]'),
        ],
      },
      borrow: {
        text: P(
          '"Borrow one?" He sucks his teeth. "Can do. Can do. Mind, it has to come from somewhere."',
          'He sets his knife to the stick and cuts a notch *backward*, against the grain. It is a horrible thing to watch. The wood squeals. The air around you goes thin and bright, like the first minute of a morning, and every hurt in your body simply was never there.',
          '"That\'s yours now," he says, and writes something on the stick that you can\'t read. "I\'ll want it back. Not today. But I\'ll want it."',
        ),
        choices: [leave()],
      },
      lend: {
        text: P(
          '"One of yours?" His eyes go bright and greedy and sad all at once. "I\'d like that. I\'d like a new one. Mine are all the same."',
          'He presses the knife-point gently against your wrist, not cutting, and you feel something unspool: a morning you will never have, all its light and weather and small events, drawn out of you like thread from a spool and wound round his stick.',
          'In return he gives you back a little of one you *did* have, once, and lost: a skill you learned on some other morning, in some other loop, that died with you. Your hands remember it before you do.',
        ),
        choices: [leave()],
      },
    },
  },

  // ---------------------------------------------------------------- 10
  {
    id: 'any_cradle', title: 'The Cradle in the Road', acts: ACTS, art: 'scene_forest',
    pages: {
      start: {
        text: (g) => P(
          'In the middle of the road sits a cradle.',
          'It is beautifully made, wicker woven with briar and ivy and lined with moss, and it is rocking, gently, by itself. Something inside is humming a lullaby: the Marches one, about the hollow crown, but the tune is slightly wrong, as if learned from someone who learned it wrong.',
          'You look in. Lying there is a baby made of sticks and moss and river stones, with two dark beads for eyes. It stops humming and looks back at you, interested.',
          'The Marchfolk have a word for this: a *stock*. Something left in place of something taken. The question, always, is what was taken, and whether whoever took it wants to trade back.',
          byHero(g, { wren: 'Somebody left you on some steps, once, wrapped in moss. You wonder if they hummed. You wonder if they looked back.' }),
        ),
        choices: [
          { label: '[Leave something in the cradle] Remove a card from your deck, then choose a card.', req: (g) => removable(g).length > 0 || 'You have nothing to leave.', async fx(g) { await g.removeCardChoice(1, 'What will you leave in the cradle?'); await offerRandom(g, { hero: 'neutral' }, 'What the cradle gives back'); return 'swap'; } },
          { label: '[Sing it the right tune] Heal 8 HP.', fx(g) { g.healOut(8); g.unlockLore('lore_crown_hollow'); return 'sing'; } },
          { label: '[Take the cradle] Obtain an uncommon relic. Add Grief to your deck.', fx(g) { g.obtainRelic('uncommon'); curse(g, 'grief'); return 'take'; } },
          { label: '[Pick up the stock] Choose an upgraded card.', show: isHero('wren'), async fx(g) { await offerRandom(g, { up: true }, 'What the stock leaves you'); return 'hold'; } },
          leave('[Walk around it]'),
        ],
      },
      swap: {
        text: P(
          'You lay something of yours in the cradle beside the stock. The moss closes over it like water.',
          'The stock considers this for a long moment. Then it reaches up with a twig hand, takes hold of your finger, and puts something into your palm in exchange. It does not feel like a gift. It feels like a fair trade, made by someone who has been making trades like this for longer than there have been roads.',
          'When you look back from the bend, the cradle is gone. There is only moss on the road, in the shape of a cradle, and the ash already covering it.',
        ),
        choices: [leave()],
      },
      sing: {
        text: P(
          'You kneel by the cradle and sing it the way your nurse sang it: *Iron for the ring of it, bone for the band.*',
          'The stock goes quiet. Its bead eyes do not blink; they cannot. But it listens, and when you have finished, it hums the tune back to you, properly this time, and then, softly, a last verse you have never heard. Something about roots. Something about a heart walking home.',
          'The cradle stops rocking. The stock is asleep, or as near as sticks can come to it. You feel oddly rested, as if you had been the one sung to.',
        ),
        choices: [leave()],
      },
      take: {
        text: P(
          'You tip the stock gently into the ditch, where it lies looking up at the sky with polite surprise, and you take the cradle.',
          'It is light and strong and smells of rain. Woven into the briar at its head you find a little charm of bone and silver, the kind the fae give to children they mean to come back for.',
          'Behind you, in the ditch, the stock begins to hum again: the same wrong tune, slower now, and sadder. You hear it for a long time. You think you will hear it for longer than that.',
        ),
        choices: [leave()],
      },
      hold: {
        text: P(
          'You pick it up before you can think better of it. It weighs nothing. It is warm, the way a stone is warm after a day in the sun, and it smells of rain and green and something under both, deep and sweet.',
          'It reaches up with a twig hand and touches your mask, very gently, exactly where your mouth would be.',
          'You hold it for a long time. You think you might keep it. You know you can\'t. When at last you lay it back in the moss, it presses something into your hand, small and certain, and goes back to humming, and you walk on with your arms aching for the shape of it.',
        ),
        choices: [leave()],
      },
    },
  },
]);
