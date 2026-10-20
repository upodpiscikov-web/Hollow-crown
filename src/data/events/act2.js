// Act 2 events — the Weeping Wood and the Drowned Abbey at Lowmere.
// Also exports small helpers shared with act3.js (same author).
import { defineEvents, defineLore, RELICS, CARDS, ENEMIES, ENCOUNTERS } from '../../engine/registry.js';
import { rnd, pick } from '../../engine/rng.js';

// ------------------------------------------------------------------ helpers
// Paragraph join (drops empty parts).
export const P = (...xs) => xs.filter(Boolean).join('\n\n');
// Hero-specific line: H(g, { knight, witch, wren, cantor, any }).
export const H = (g, o) => (o[g.run.hero] ?? o.any ?? '');
export const isHero = (h) => (g) => g.run.hero === h;
export const notHero = (...hs) => (g) => !hs.includes(g.run.hero);
export const hpReq = (n) => (g) => g.player.hp > n || 'You are too weak to risk it.';
export const goldReq = (n) => (g) => g.run.gold >= n || `You need ${n} gold.`;
export const roll = (g, p) => rnd(g.run.rng.events) < p;

// Named special relics fall back to a random relic if undefined or already owned,
// and the label says so honestly.
export const relicOk = (g, id) => !!RELICS[id] && !g.hasRelic(id);
export const relicName = (g, id, tier) => (relicOk(g, id) ? RELICS[id].name : tier ? `a random ${tier} relic` : 'a random relic');
export const giveRelic = (g, id, tier) => g.obtainRelic(relicOk(g, id) ? id : tier);
export const rewardRelic = (g, id) => (relicOk(g, id) ? id : 'random');

// Curses fall back to Regret if a named curse is not defined.
export const curseId = (id) => (CARDS[id] && CARDS[id].type === 'curse' ? id : 'regret');
export const curseName = (id) => (CARDS[curseId(id)] ? CARDS[curseId(id)].name : 'Regret');
export const addCurse = (g, id) => g.addToDeck(curseId(id));
export const isCurse = (c) => !!CARDS[c.id] && CARDS[c.id].type === 'curse' && !CARDS[c.id].unremovable;
export const hasCurse = (g) => g.run.deck.some(isCurse);
export async function removeCurse(g) {
  const curses = g.run.deck.filter(isCurse);
  if (!curses.length) return [];
  let picked = curses.slice(0, 1);
  if (typeof g.deckChoose === 'function') picked = await g.deckChoose({ count: 1, min: 1, title: 'Choose a curse to remove', filter: isCurse });
  for (const c of picked) g.removeFromDeck(c);
  return picked;
}

// Tinctures: be honest when the belt is full.
export const beltFull = (g) => !g.run.potions.includes(null);
export const tinctureText = (g, n = 1) => (beltFull(g) ? (n > 1 ? `Obtain ${n} random Tinctures (your belt is full).` : 'Obtain a random Tincture (your belt is full).') : n > 1 ? `Obtain up to ${n} random Tinctures.` : 'Obtain a random Tincture.');
export const giveTinctures = (g, n = 1) => { for (let i = 0; i < n; i++) g.obtainPotion(); };

// Card offers drawn from the events stream.
export async function offer(g, opts, title) {
  const ids = g.randomCards({ count: 3, rng: g.run.rng.events, ...opts });
  if (ids.length) await g.offerCards(ids, { title });
}

// Enemy groups for event fights: the first option whose ids all exist; otherwise a
// random 'hard' encounter of the act, so a missing id can never crash a run.
export function foes(g, act, ...options) {
  for (const ids of options) if (ids.length && ids.every((id) => ENEMIES[id])) return ids;
  const r = g.run.rng.events;
  const encs = Object.values(ENCOUNTERS).filter((e) => e.act === act && e.pool === 'hard');
  if (encs.length) {
    const e = pick(r, encs);
    return typeof e.enemies === 'function' ? e.enemies(g, r) : e.enemies;
  }
  const any = Object.values(ENEMIES).filter((e) => e.act === act && e.kind === 'normal');
  if (any.length) return [pick(r, any).id, pick(r, any).id];
  return options[0];
}

const lore = (id) => (g) => g.unlockLore(id);

// ------------------------------------------------------------------ events
defineEvents([
  // ================================================================ THE WEEPING WOOD
  {
    id: 'a2_weeping_grove', title: 'The Weeping Grove', acts: [2], art: 'scene_forest',
    pages: {
      start: {
        text: (g) => P(
          `The trees here are black-barked and bent, as if listening for something underground. Every trunk weeps. Sap runs from knots like eyes and sets in amber beads along the bark, and each bead, when you lean close, hums: a small wet sound, like someone crying in the next room.`,
          `A woodcutter's board is nailed to the nearest trunk: DO NOT TAKE THE TEARS. Scratched beneath it, in another hand: *they come back.*`,
          H(g, {
            knight: `Aldous touches a bead and hears a man sobbing very quietly, the way you do when you don't want the house to hear. He takes his hand away. "I know that one," he says, and does not say whose it is.`,
            witch: `Isolde scrapes a bead onto her knife and sniffs it. "Sap doesn't run in the cold. Something's drawing it." She frowns. "And it's salt. Trees don't make salt. People do."`,
            wren: `Wren puts an ear to the bark the way a child listens to a shell. "They're keeping them for someone," Wren says. "Do you think anyone ever comes back for theirs?"`,
            cantor: `Cael lays his palm on the bark and murmurs the Office for the Grieving, out of old habit. The nearest bead falters in its humming, as if to listen.`,
          })),
        choices: [
          { label: () => `[Gather the amber] Gain 80 gold. Become Cursed — ${curseName('grief')}.`,
            fx(g) { g.gainGold(80); addCurse(g, 'grief'); g.unlockLore('lore_a2_weeping_wood'); return 'gather'; } },
          { label: '[Weep with them] Lose 6 HP. Remove a card from your deck.', req: hpReq(6),
            async fx(g) { g.hurt(6); await g.removeCardChoice(1); g.unlockLore('lore_a2_weeping_wood'); return 'weep'; } },
          { label: '[Leave the tears be]', end: true },
        ],
      },
      gather: {
        text: P(
          `The beads come away warm and go on humming in your purse. It is good amber. Any jeweller in any town would weigh it gladly and not ask where it came from; the rich, you have heard, are fond of other people's sorrow.`,
          `By the time you reach the edge of the grove the humming has moved. It is no longer in your purse. It is somewhere behind your ribs, and the crying is yours, and you cannot remember when you started.`,
        ),
        choices: [{ label: '[Leave]', end: true }],
      },
      weep: {
        text: (g) => P(
          `You sit among the roots and let it come. It is easier than you would think; the grove makes it easy. Whatever you grieve, and there is plenty, runs out of you and into the dark ground, and on a branch above you a new bead of amber swells and begins to hum.`,
          `You stand up lighter. Not better. Lighter.`,
          H(g, {
            knight: `Aldous wipes his face with the back of a gauntlet. "Don't tell anyone," he says to the trees.`,
            witch: `"That," Isolde says hoarsely, "was deeply unscientific." She does not look at the new bead as she passes it, but she touches it, once.`,
            wren: `Wren touches the mask where tears would run, if there were a face beneath it to run down. Dry, as always. But the new bead hums anyway, and it is Wren's.`,
            cantor: `"Amen," Cael says, from long habit. Very faintly, all through the grove, the trees say it back.`,
          })),
        choices: [{ label: '[Leave]', end: true }],
      },
    },
  },

  {
    id: 'a2_name_buyer', title: 'The Buyer of Names', acts: [2], art: 'scene_forest',
    pages: {
      start: {
        text: (g) => P(
          `A stump in a clearing has been laid out like a counting-house desk: brass scales, a ledger bound in birch-bark, a pot of ink that smells of crushed beetles. Behind it sits something in a coat of moth wings, with long careful fingers and no particular face.`,
          `"Names," it says pleasantly. "Bought, not borrowed. A true one fetches a fine price. You'll hardly miss it; people so rarely use their own."`,
          H(g, {
            knight: `"Aldous Vane." The quill hovers. "Two names, and only one of them yours. *Vane* was handed you like a cloak to cover a stain. *Aldous* your father chose." It smiles, if that is what that is. "That one I would pay well for."`,
            witch: `"Isolde Marrow." The quill writes, and stops. "*Marrow* you borrowed from a man who left. *Isolde* was chosen by a woman who wanted you very much." "It's from a very bad poem," Isolde says. Her voice does not do what she wants it to.`,
            wren: `"Wren," Wren offers. The buyer peers at the mask a long time. "That isn't a name, little one. That's a bird somebody saw from a window." Its fingers twitch toward you, then fold away, very respectfully. "Whatever's under it, I wouldn't dare. But I'll buy the bird."`,
            cantor: `The buyer looks at Cael, and the pleasantness goes out of it. "Not yours, Brother. Yours is already written down. Cut in stone, by the look of it. I don't deal in names that are *finished*." "I don't take your meaning." "No," it agrees. "You wouldn't. A psalm, though. I'd take a psalm."`,
          })),
        choices: nameChoices(),
      },
      ask: {
        text: P(
          `"Do with them?" It seems delighted to be asked. "Hoard them, mostly. A name is a door. Know a thing's true name and you can knock on it from anywhere: call it, bind it, ask it very nicely to come home."`,
          `It strokes the ledger. "The Antlered King keeps a room of them, shelved like jam. And under the hill the Lady knows every name there is, though she has been very quiet lately." It considers. "Four hundred years quiet."`,
          `It turns the ledger back toward you. The blank line waits.`,
        ),
        choices: nameChoices(),
      },
      sold: {
        text: P(
          `You say it aloud. The quill takes it down in a hand much neater than yours, and the scales dip, very slightly, as if a moth had landed on them.`,
          `It pays as promised: a knack, folded small and pressed into your palm, already becoming something your hands know how to do.`,
          `Later, walking, you try to remember what you were called when you were small. You can see the mouth that said it. The sound is in a ledger in the Weeping Wood now, and you will never again be quite certain that you are who you think you are.`,
        ),
        choices: [{ label: '[Leave]', end: true }],
      },
      sold_wren: {
        text: P(
          `The buyer writes *Wren* in the ledger, and the word sits there on its own, looking small. "There," it says kindly. "Now you're nobody at all. Lucky thing."`,
          `It pays in a knack, folded small and pressed into your gloved palm.`,
          `Afterwards you feel thinner, as if a coat you hadn't known you were wearing has been lifted off your shoulders and you are colder without it. "Wren," Wren says aloud on the path, testing it. It sounds like the word for a bird. "I liked being a bird," Wren adds, to nobody, and walks a little faster.`,
        ),
        choices: [{ label: '[Leave]', end: true }],
      },
      psalm: {
        text: P(
          `You sing it the psalm for the dying, because it is the one you know best. The buyer listens with its long fingers steepled and its no-face tilted, and when you have finished it writes the words down, every one, and the scales dip.`,
          `The knack it pays you with is folded very small. Afterwards the psalm has gone from you: the tune, the words, the place in the Office where it belongs. You have sung it over a thousand beds. You reach for it now and find a smooth blank, like a stone where a step should be.`,
          `"Thank you, Brother," the buyer says. "For the road."`,
        ),
        choices: [{ label: '[Leave]', end: true }],
      },
    },
  },

  {
    id: 'a2_pyre', title: 'Kindling', acts: [2], art: 'scene_camp',
    pages: {
      start: {
        text: (g) => P(
          `Smoke through the trees, and a hymn sung badly by men unused to singing. In a clearing, six witch-hunters in grey tabards are stacking faggots round a stake. Tied to it is a woman of fifty with a herb-pouch still on her belt and a gag in her mouth. A placard hangs from her neck: ROT-CRAFT.`,
          `The sergeant reads from a writ, following the words with his finger. The others pass a flask. Nobody has lit the fire. They are waiting, you gather, for the hymn to end, and the hymn has a great many verses.`,
          H(g, {
            knight: `One of them squints at Aldous. "That's Vane. The Shield." A murmur runs round the stake. "Grall said you'd gone over." "Over to what?" Aldous asks. Nobody seems sure.`,
            witch: `The writ has a woodcut at the top: a wild-haired woman with a hooked nose. ISOLDE MARROW, KINSWOMAN AND ROT-WITCH. "They've got my nose wrong," Isolde murmurs. Her hands are shaking.`,
            wren: `Wren watches the woman's eyes above the gag. "She's looking at me as if I'm the frightening thing," Wren says, puzzled. "Isn't that funny? With all of them right there."`,
            cantor: `You step into the clearing. Not one hunter turns his head. A dog by the fire flattens its ears and whines at you, and somebody kicks it quiet.`,
          })),
        choices: [
          { label: (g) => `[Cut her down] Fight the witch-hunters. Reward: ${relicName(g, 'witchfinders_brand')}.`,
            async fx(g) { g.unlockLore('lore_a2_grall_writ'); await g.eventCombat(foes(g, 2, ['witch_hunter', 'witch_hunter'], ['witchhunter', 'witchhunter']), { resume: 'freed', reward: { relic: rewardRelic(g, 'witchfinders_brand') } }); } },
          { label: '[Buy her life] Lose 80 gold. Heal 10 HP.', show: notHero('cantor'), req: goldReq(80),
            fx(g) { g.loseGold(80); g.healOut(10); g.unlockLore('lore_a2_grall_writ'); return 'bought'; } },
          { label: '[Untie her while they look through you] No one will stop you. No reward.', show: isHero('cantor'),
            fx(g) { g.unlockLore('lore_a2_grall_writ'); return 'ghost'; } },
          { label: () => `[Walk on] Become Cursed — ${curseName('shame')}.`,
            fx(g) { addCurse(g, 'shame'); return 'walk'; } },
        ],
      },
      freed: {
        text: (g) => g.run.hero === 'cantor'
          ? P(
            `The last hunter runs, tabard flapping, and leaves his hymn-book face-down in the mud. You cut the woman loose. Her wrists are rope-burned to the meat.`,
            `She stares at the rope falling away, at the bodies, at the empty air where you stand with the knife. "Who's there?" she whispers. You tell her your name, gently, twice. She does not hear it. She thanks the trees, all of them, in a rush, and runs.`,
            `The sergeant's branding iron lies in the ashes. You take it, so no one else will. Grief, you tell yourself. Grief makes people deaf.`)
          : P(
            `The last hunter runs, tabard flapping, and leaves his hymn-book face-down in the mud. You cut the woman loose. Her wrists are rope-burned to the meat.`,
            `"Morwen," she says, when she can. "Hedge-wife. I set bones and lance boils, and once I told the reeve his son was the image of the miller." A cracked laugh. "That's the rot-craft, if you were wondering."`,
            H(g, {
              knight: `"You were the King's Shield," she says. "Who are you shielding now?" Aldous considers it. "Hedge-wives, apparently."`,
              witch: `She looks at Isolde a long moment. "You're her. Off the bill." "Yes." "Thought you'd be taller." "Everyone does." Morwen spits in her palm and holds it out, and after a moment Isolde shakes it.`,
              wren: `She will not take Wren's hand. She does say thank you, to the mask, very politely, the way you would thank a dog that has decided not to bite.`,
            })),
        choices: [{ label: '[Leave]', end: true }],
      },
      bought: {
        text: P(
          `The sergeant counts your coin twice, moving his lips, and once more for luck. "Writ says *a* witch," he decides. "Doesn't say which." The purse vanishes into his tabard and two men cut the woman loose.`,
          `She binds your scrapes with something green from her pouch before she goes, quick and rough and expert, not meeting your eye. It stings like sin and works like a miracle.`,
          `As you leave you hear the sergeant tell his men to keep the faggots dry. "There's always another," he says, not unkindly.`,
        ),
        choices: [{ label: '[Leave]', end: true }],
      },
      ghost: {
        text: P(
          `You walk into the clearing and up to the stake, and no one stops you. No one so much as looks. You stand in the kindling and pick at the knots with your old, careful fingers while the sergeant reads about *the abominable arts of decay* six inches from your ear.`,
          `The ropes fall. The woman stares straight through you, white to the lips, and runs. Behind her the hunters shout about saints and devils and a knife that nobody was holding.`,
          `You stand alone among the faggots. "Rude," you murmur, without heat. "Grief makes people rude." You find you believe it a little less than you did yesterday.`,
        ),
        choices: [{ label: '[Leave]', end: true }],
      },
      walk: {
        text: (g) => P(
          `You keep to the trees. The hymn ends behind you. There is a pause, the particular silence of men waiting to see who will strike the flint, and then a sound like a sheet being shaken out, which is fire catching.`,
          `She does not scream; they gagged her. That is almost worse. The smell follows you for a mile, and then for a day, and then it is simply part of you.`,
          H(g, {
            knight: `Aldous walks very straight. "I've done this before," he says. "Stood outside. I'm good at it."`,
            witch: `Isolde says nothing for a long time. Then: "If they'd seen me, they'd have had two." It sounds like something she is practising.`,
            wren: `"Was that wrong?" Wren asks, later. "It felt wrong. I can't always tell."`,
            cantor: `Cael says the prayer for the dying under his breath, all the way through, and then once more, as if the first time did not count.`,
          })),
        choices: [{ label: '[Leave]', end: true }],
      },
    },
  },

  {
    id: 'a2_long_table', title: 'The Long Table', acts: [2], art: 'scene_forest',
    pages: {
      start: {
        text: (g) => P(
          `A table runs down the middle of the ride for further than you can see: white cloth, silver, candles that do not drip. There is a roast swan with its neck arranged into a question. There are pears in wine, and loaves still steaming, though no one has been near an oven in this wood for a hundred years.`,
          `Guests sit along both sides, thin and very well dressed in fashions your grandmother would have called old. Their plates are heaped. Their forks are raised. Not one of them is chewing.`,
          `A small voice from nowhere says, "Sit, sit. You must be starving."`,
          H(g, {
            knight: `Aldous has heard soldiers' tales of the Fair Folk's table: eat, and plain bread is ash to you ever after. Soldiers' tales are mostly lies. Mostly.`,
            witch: `Isolde lifts a guest's wrist and counts. "Thirty beats a minute. He isn't dying. He isn't anything."`,
            wren: (g.flag('wren_3')
              ? `The voice says "*Heartwood*," and every head at the table turns. The great chair at the far end, carved with antlers, scrapes back on its own. Wren does not move toward it. Wren does not move away.`
              : `The voice says, to Wren, "Oh — oh, *sit here*," and the great chair at the head of the table scrapes back on its own. Its back is carved with antlers. Wren takes a step away from it, and then, troublingly, a step toward.`),
            cantor: `There is a place laid for you, too, between two guests. The plate has been turned face-down, as is done at a wake for the absent. "An old courtesy," Cael says, touched. "For the dead."`,
          })),
        choices: [
          { label: () => `[Eat your fill] Heal to full HP. Become Cursed — ${curseName('hunger')}.`,
            fx(g) { g.healOut(g.player.maxHp); addCurse(g, 'hunger'); g.unlockLore('lore_a2_fair_table'); return 'eat'; } },
          { label: '[Pocket the silver] Even odds: gain 120 gold, or lose 8 HP.', req: hpReq(8),
            fx(g) { g.unlockLore('lore_a2_fair_table'); if (roll(g, 0.5)) { g.gainGold(120); return 'silver'; } g.hurt(8); return 'pinched'; } },
          { label: '[Pull a guest free] Lose 5 Max HP. Obtain a random relic.',
            fx(g) { g.loseMaxHp(5); g.obtainRelic(); g.unlockLore('lore_a2_fair_table'); return 'pulled'; } },
          { label: '[Leave hungry]', end: true },
        ],
      },
      eat: {
        text: P(
          `You sit. The food is the best you have ever eaten. That is not a figure of speech; your mouth knows at once that nothing will ever taste like this again. Cuts close. Bruises fade. Warmth goes all the way down to your feet.`,
          `When you rise, the voice sighs with pleasure. "Come back," it says. "They always come back."`,
          `Within the hour you are hungry. By evening you are ravenous, and bread tastes of ash, and meat of wet paper, and you understand the faces at the table now. Not greed. Patience.`,
        ),
        choices: [{ label: '[Leave]', end: true }],
      },
      silver: {
        text: P(
          `The forks are heavy and real, crested with the arms of some lord nobody has heard of in two centuries. You sweep a dozen into your coat, then the salt-cellar, then a candlestick for good measure.`,
          `The voice says nothing at all. The guests do not stir. You walk out of the ride with a coat that clinks at every step, and in the morning it is still silver, which in this wood is very nearly a miracle.`,
          `You do not look back. You have a feeling that if you did, you would find all the guests looking back at you.`,
        ),
        choices: [{ label: '[Leave]', end: true }],
      },
      pinched: {
        text: P(
          `You get three spoons into your coat before every candle on the table goes out at once.`,
          `In the dark, something with a great many small sharp hands pinches you, hard, everywhere, all at once, for a long time. It does not hurry. It seems to be enjoying itself.`,
          `When the light comes back the table is gone, and so are the spoons. Your pockets are full of beech leaves and your skin is mottled with tiny bruises in the shape of fingertips. The voice says, quite close to your ear: "*Rude.*"`,
        ),
        choices: [{ label: '[Leave]', end: true }],
      },
      pulled: {
        text: P(
          `You take a guest under the arms, a young man in a doublet two hundred years out of fashion, and haul. He comes out of his chair like a root out of wet ground, and screams, and keeps screaming, and then quite suddenly weeps.`,
          `"What year?" he asks. You tell him. He laughs, and presses the ring from his finger into your hand, and walks off into the trees, greying as he goes, stooping, slowing, until you lose him among the trunks.`,
          `His chair stays empty. Something must fill it. You feel it take its portion of you, politely, the way a host takes your coat.`,
        ),
        choices: [{ label: '[Leave]', end: true }],
      },
    },
  },

  {
    id: 'a2_white_hart', title: 'The White Hart', acts: [2], art: 'scene_forest',
    pages: {
      start: {
        text: (g) => P(
          `The briars here grow in coils as thick as a man's arm, and caught in them is a hart, white as a peeled stick. Its antlers are enormous, too many-branched, more like a winter tree than a crown, and the thorns have it fast by them. Its flanks heave. Where the thorns have gone in, it bleeds sap instead of blood.`,
          `It looks at you with one dark, wet, intelligent eye. The wood has gone very quiet. Not peaceful. *Attending.*`,
          H(g, {
            knight: `"The Antlered King's beast," Aldous says. "The old huntsmen wouldn't touch them. They said the wood keeps accounts."`,
            witch: `Isolde watches the sap run. "It isn't an animal," she says softly. "It's the forest, wearing one."`,
            wren: `The hart sees Wren and goes perfectly still. Then, slowly, despite the thorns, it lowers its great head as far as it can, like a courtier. "Please don't do that," Wren says, in a small voice.`,
            cantor: `The hart's eye follows Cael as he comes, which is more than most eyes do lately. He finds that he is grateful for it.`,
          })),
        choices: [
          { label: (g) => `[Free it] Lose 9 HP. Obtain ${relicName(g, 'antler_shard')}.`, req: hpReq(9),
            fx(g) { g.hurt(9); giveRelic(g, 'antler_shard'); g.unlockLore('lore_a2_antlered_king'); return 'freed'; } },
          { label: '[Kill it and eat] Gain 7 Max HP. Then fight what comes for it.',
            async fx(g) { g.gainMaxHp(7); g.unlockLore('lore_a2_antlered_king'); await g.eventCombat(foes(g, 2, ['thornling', 'thornling'], ['briar_wight', 'briar_wight']), { resume: 'eaten' }); } },
          { label: '[Leave it to the wood]', end: true },
        ],
      },
      freed: {
        text: (g) => P(
          `The briars fight you for it. They are cleverer than briars ought to be; they close behind your hands, they find the gaps in your sleeves. By the time the last tine comes free you are bleeding in a dozen places.`,
          `The hart stands. It is taller than you thought. For a long moment it simply looks at you, and the wood looks with it.`,
          `Then it lowers its head and, with great care, snaps a tine from its own antler against a stone, and leaves it at your feet. When you look up it is gone, and you never heard it go.`,
          H(g, { wren: `The tine is warm in Wren's hand. It fits there exactly, as if it had been cut to size.` })),
        choices: [{ label: '[Leave]', end: true }],
      },
      eaten: {
        text: P(
          `You cut what you can from the hart and eat it raw beside the briars, because there is no fire in this wood you would trust. It tastes of green wood and frost. It goes into you like iron into a forge.`,
          `Then the things came out of the trees — bark and bone and too many joints — and now they lie in the bracken, as still as they get.`,
          `Somewhere very far off, under the hill, something lets out a breath. Every leaf in the Weeping Wood turns at once to show its pale underside, and stays that way until you are gone.`,
        ),
        choices: [{ label: '[Leave]', end: true }],
      },
    },
  },

  {
    id: 'a2_pricker', title: 'The Pricker\'s Toll', acts: [2], art: 'scene_road',
    pages: {
      start: {
        text: (g) => P(
          `Where the forest road crosses the brook, witch-hunters have built a toll: a striped pole, a brazier, a long table, and a man with a velvet roll of needles laid out like a surgeon's.`,
          `"Witch-pricker, by warrant of the Witchfinder General," he tells the queue of carters. "A witch bears a mark that does not feel and does not bleed. Honest folk bleed. Sleeve up, friend. Bleed, and pass."`,
          `The man ahead of you bleeds, gasps, and passes. The woman ahead of him didn't, apparently. Her cart is still here. She isn't.`,
          H(g, {
            knight: `Two of the guards straighten when they see Aldous, out of old habit, and then remember they are not supposed to, and slouch again, looking cross.`,
            witch: `Isolde watches the needles. "The bone-handled one retracts," she says quietly. "Push, no blood, *witch*. Grandmother's trick." She smiles without any warmth. "Mine bleeds black anyway. Shall we see what he makes of that?"`,
            wren: `"What happens to the ones who don't bleed?" Wren asks the carter behind. He looks at the mask, doesn't answer, and backs his cart up a yard.`,
            cantor: `When your turn comes, the pricker looks past you and beckons the carter behind. You stand at the table a while. Nobody asks you to roll up your sleeve.`,
          })),
        choices: [
          { label: (g) => `[Roll up your sleeve] Lose 6 HP. ${tinctureText(g)}`, show: notHero('cantor'), req: hpReq(6),
            fx(g) { g.hurt(6); giveTinctures(g, 1); return 'sleeve'; } },
          { label: '[Walk under the pole] No one stops you.', show: isHero('cantor'),
            fx(g) { g.unlockLore('lore_a2_pricking'); return 'unseen'; } },
          { label: '[Overturn the table] Fight the witch-hunters. Reward: 40 extra gold.',
            async fx(g) { g.unlockLore('lore_a2_pricking'); await g.eventCombat(foes(g, 2, ['witch_hunter', 'witch_pricker'], ['witch_hunter', 'witch_hunter']), { resume: 'overturned', reward: { gold: 40 } }); } },
          { label: '[Turn back]', end: true },
        ],
      },
      sleeve: {
        text: (g) => P(
          g.run.hero === 'witch'
            ? `The needle goes in, and Isolde's blood runs into the tin dish black as ink. The pricker stares at it. Isolde stares at him. "Liver complaint," she says. He decides, after a long moment, to believe her. Nobody wants to be the man who found the witch the day before payday.`
            : `The needle goes in deep, deeper than it needs to; the pricker likes his work. Blood runs down your wrist into his tin dish. "Honest blood," he says, faintly disappointed, and waves you on.`,
          `Passing the dead woman's cart you see her things have been picked over, but the hunters left the little brown bottles. They couldn't read the labels. You can.`,
          `You take one. It seems the least you can do, and it is.`,
        ),
        choices: [{ label: '[Leave]', end: true }],
      },
      unseen: {
        text: P(
          `You walk under the striped pole. The pricker is pricking a carter. The guards are arguing over dice. A boy minding the brazier looks up, right at you, for a heartbeat, and then down again, frowning, as if he has forgotten what he was doing.`,
          `On the far side of the brook you stop and look back at the long table, the needles, the tin dish. Honest folk bleed, the pricker said.`,
          `You find you are rubbing the inside of your wrist, and cannot think why.`,
        ),
        choices: [{ label: '[Leave]', end: true }],
      },
      overturned: {
        text: (g) => P(
          `When it is done the carters are gone, carts and all; nobody stays to thank anybody in the Weeping Wood. The toll's strongbox held the day's takings. In the brazier, half-burned, lies the pricker's ledger: a column of names, and beside each a single word. *Bled. Bled. Bled. Did not.*`,
          H(g, {
            knight: `Aldous closes the ledger and drops it back into the coals. "I signed warrants like those," he says. "I never read them. That was the point."`,
            witch: `Isolde snaps the bone-handled needle in two and drops the halves in the brook. "There," she says. "Now nobody's a witch."`,
            wren: `Wren picks up a needle and pricks a gloved fingertip, curious. A bead of something comes up. Wren looks at it a long while and does not say what colour it is.`,
            cantor: `Cael tears out the page of names marked *Did not* and folds it into his breviary. Someone ought to pray for them by name. It may as well be him.`,
          })),
        choices: [{ label: '[Leave]', end: true }],
      },
    },
  },

  {
    id: 'a2_changeling_cradle', title: 'The Cradle', acts: [2], art: 'scene_village',
    pages: {
      start: {
        text: (g) => P(
          `A woodcutter's cottage with the door open. Inside, a woman sits beside a cradle with a hatchet across her knees. She has been crying so long that she has stopped, and is simply sitting.`,
          `"They took my girl," she says, to the room, to anyone. "Three nights back. Left *that*."`,
          `In the cradle lies a bundle of birch twigs and moss bound with red thread into the rough shape of a baby, with two black beetles for eyes. When you lean over it, it turns its head to follow you and makes a small, contented, creaking sound.`,
          `"Go under the hill and fetch her. Or burn it. Or leave. I can't be the one to choose any more."`,
          H(g, {
            knight: `Aldous looks at the hatchet, and at her white knuckles, and very gently takes it from her lap.`,
            witch: `Isolde lifts the moss and sniffs. "Living," she says, surprised. "Barely. But it's growing."`,
            wren: `Wren stands over the cradle a long time. "Somebody left me on some steps," Wren says. "Did anyone go looking for whatever I was swapped for?"`,
            cantor: `She never once looks at Cael. But the twig-child does: its beetle eyes find him and stay, and it coos.`,
          })),
        choices: [
          { label: (g) => `[Go under the hill] Fight the Fair Folk. Reward: ${relicName(g, 'mothers_seed')}.`,
            async fx(g) { g.unlockLore('lore_a2_changelings'); await g.eventCombat(foes(g, 2, ['hollow_fae', 'hollow_fae'], ['fae_courtier', 'fae_courtier']), { resume: 'returned', reward: { relic: rewardRelic(g, 'mothers_seed') } }); } },
          { label: (g) => (g.run.hero === 'wren' ? '[Tell her it can be loved] Heal 10 HP.' : '[Tell her to raise it] Heal 10 HP.'),
            fx(g) { g.healOut(10); g.unlockLore('lore_a2_changelings'); return 'raise'; } },
          { label: () => `[Burn it] Gain 50 gold. Become Cursed — ${curseName('regret')}.`,
            fx(g) { g.gainGold(50); addCurse(g, 'regret'); return 'burn'; } },
          { label: '[Leave]', end: true },
        ],
      },
      returned: {
        text: (g) => P(
          `Under the hill is not far, and not long, and not anything you will be able to describe afterwards. You come back up through the roots with a girl's hand in yours.`,
          `Only she is not a girl. She is a woman of nineteen or so, in a dress of leaves that were green three nights ago, and she kneels by the cradle and says "Mam?" to the stranger with grey in her hair. The two of them hold each other and weep, and neither is quite sure who she is holding.`,
          `She gives you what she was clutching, glad to be rid of it: a pale seed, warm, faintly ticking, like a heart.`,
          H(g, { wren: `Nineteen, Wren thinks, and does not know why the number sits so heavily.` })),
        choices: [{ label: '[Leave]', end: true }],
      },
      raise: {
        text: (g) => P(
          `"It's growing," you tell her. "Feed it. Talk to it. In a year it will be a child. Not yours. But a child, and it will think you are its mother, and it will not be wrong."`,
          g.run.hero === 'cantor'
            ? `She does not answer, but after a long while she gets up and puts the pot on. She sets out two bowls without knowing why, eats from one, and leaves the other steaming at the place where you sit. You eat. The twig-child watches the bowl empty with great interest.`
            : `She looks at the cradle a long time. Then she gets up and puts the pot on, and makes you eat, because her hands want something to do.`,
          `When you leave she has the twig-child in the crook of her arm and is singing to it, badly, and it is creaking back.`,
          H(g, { wren: `At the door Wren turns. "It will want a face, eventually," Wren tells her. "Let it pick its own."` })),
        choices: [{ label: '[Leave]', end: true }],
      },
      burn: {
        text: P(
          `She gives you her purse, all of it, and goes outside so she will not hear. You carry the cradle to the hearth.`,
          `It does not burn like twigs. It burns like a kettle coming to the boil: a long thin whistle that climbs and climbs while the moss curls and the beetle eyes pop, and the red thread holds out longest of all.`,
          `Outside, the woman says her daughter's name over and over, as if the fire might trade back. It doesn't. You knew it wouldn't. So did she.`,
        ),
        choices: [{ label: '[Leave]', end: true }],
      },
    },
  },

  {
    id: 'a2_thornbound_knight', title: 'The Thornbound Knight', acts: [2], art: 'scene_ruins',
    pages: {
      start: {
        text: (g) => P(
          `At first you take him for a statue gone green: a knight on one knee in a dell, sword planted point-down before him. Then the visor creaks toward you. Briars have grown through every joint of his armour, in at the elbow, out at the throat. There are rosehips in his gorget.`,
          `"Stand, traveller. Ser Ambrose Hale, of the Long King's household." His voice is dust. "I carry His Majesty's letter to the Lady of this wood, and I swore not to move from this place until she answered or the King recalled me. Has he sent word? I have been here since Martinmas, I think."`,
          `The briars round him are as thick as your wrist, and very old.`,
          H(g, {
            knight: `Aldous knows the device on that shield: a hawthorn on blue. "Ser Ambrose taught me sword drill," he says quietly, "in my ninth summer. He rode out on an errand for the King and never came back." He swallows. "That was thirty years ago."`,
            witch: `Isolde parts the briars at his wrist. Under the vambrace there is skin, grey and living. "The thorns go into him," she murmurs, "and he goes into them. Very slowly. Both ways."`,
            wren: `"Do you get bored?" Wren asks. The knight considers this with great seriousness. "I don't believe I have been here long enough," he says.`,
            cantor: `The visor turns to Cael without hesitation. "Brother," the knight says, with real gladness. "Have you come to hear my confession? I've had a great deal of time to prepare it."`,
          })),
        choices: [
          { label: (g) => `${g.run.hero === 'cantor' ? '[Hear his confession, and tell him]' : '[Tell him the King is dead]'} Obtain ${relicName(g, 'severed_oath')}.`,
            fx(g) { giveRelic(g, 'severed_oath'); g.unlockLore('lore_a2_ambrose_letter'); return 'truth'; } },
          { label: (g) => (g.run.hero === 'knight'
            ? `[Tell him to keep his vigil] Upgrade 3 random cards. Become Cursed — ${curseName('oathbreaker')}.`
            : '[Tell him to keep his vigil] Upgrade 2 random cards.'),
          fx(g) { if (g.run.hero === 'knight') { g.upgradeRandom(3); addCurse(g, 'oathbreaker'); } else g.upgradeRandom(2); return 'lie'; } },
          { label: '[Leave him to his watch]', end: true },
        ],
      },
      truth: {
        text: (g) => P(
          g.run.hero === 'cantor'
            ? `You hear his confession first: thirty years of small sins, mostly impatience. Then you tell him. "Dead," he repeats. The briars creak. "Then I am released."`
            : `"Dead," he repeats. The briars creak. "Then — who releases me?" You have no answer. He does not wait for one.`,
          `He stands, and the thorns tear out of him all at once, and he does not bleed, because there is nothing left in him to bleed. He takes one step toward Ashgrave. Two. On the third his armour is empty and falling, and a little dust drifts from the gorget with the rosehips.`,
          `Round the hilt of his sword is his oath-cord, cut clean through, and in his saddlebag a letter under the King's seal. The cord weighs more than it ought to.`,
          H(g, {
            knight: `Aldous kneels in the dust a while. "He waited thirty years for a word that was never coming," he says. "And I thought I was loyal."`,
            witch: `Isolde turns the empty gauntlet over. "Thirty years of not dying," she says, "and it took three steps to catch up with him."`,
            wren: `"Was he happy, at the end?" Wren asks. Nobody answers. Wren decides that he was.`,
            cantor: `Cael speaks the absolution over the empty armour. It is the first in a long time where he feels the words land.`,
          })),
        choices: [{ label: '[Leave]', end: true }],
      },
      lie: {
        text: (g) => P(
          `"The King lives," you tell him, "and thanks you, and bids you keep your watch."`,
          `The visor bows. "Then I am content." He has you kneel, and lays the flat of his old blade on each shoulder in turn, and murmurs the household blessing. For a moment your hands remember things they were never taught: the angle of a parry, the weight of a vow.`,
          `When you leave he is still kneeling, and the briars are already closing over the place where you knelt beside him.`,
          H(g, {
            knight: g.flag('knight_2')
              ? `Aldous does not look back. *Do not let them crown another,* he thinks, in his father's voice, and walks faster.`
              : `Aldous does not look back. He knows what it is to stand at a post because no one has told you to leave it. He lied to his old master's face, and it sits in him like a swallowed nail.`,
          })),
        choices: [{ label: '[Leave]', end: true }],
      },
    },
  },

  // ================================================================ THE DROWNED ABBEY
  {
    id: 'a2_drowned_vespers', title: 'Vespers Under Water', acts: [2], art: 'scene_abbey',
    pages: {
      start: {
        text: (g) => P(
          `The nave of Lowmere Abbey is flooded to the height of a tall man. The water is perfectly clear and perfectly still, and through it, by the light of candles that somehow burn on the drowned altar, you can see the monks.`,
          `They kneel in their stalls in two facing rows, as they have knelt for twenty years. Their habits stir like weed. Their mouths move, and from each mouth a thread of silver bubbles climbs and breaks, and the breaking, if you stand very still, is plainsong. *Make haste, make haste to help us.*`,
          `On the altar, under the water, the candlesticks are gold.`,
          H(g, {
            knight: `Aldous takes off his helm, as one does in chapel. It feels foolish, and right.`,
            witch: `"Twenty years," Isolde says, "without air." She says it the way other people pray: furious, and asking.`,
            wren: `Wren taps the surface with one finger. Every drowned face turns up toward the mask at once, then, politely, back down to its psalter.`,
            cantor: `Cael knows this office. He knew some of these brothers; he made a retreat here, long ago. His lips are moving with theirs before he decides to let them.`,
          })),
        choices: [
          { label: '[Kneel with them] Lose 8 HP. Upgrade 2 random cards.', req: hpReq(8),
            fx(g) { g.hurt(8); g.upgradeRandom(2); g.unlockLore('lore_a2_lowmere_office'); return 'joined'; } },
          { label: '[Dive for the candlesticks] Gain 90 gold. Then fight the drowned brothers.',
            async fx(g) { g.gainGold(90); g.unlockLore('lore_a2_lowmere_office'); await g.eventCombat(foes(g, 2, ['drowned_monk', 'drowned_monk'], ['drowned_brother', 'drowned_brother']), { resume: 'robbed' }); } },
          { label: '[Sing them the Office for the Dead] Bleed 6. Obtain a random relic.', show: isHero('cantor'), req: hpReq(6),
            fx(g) { g.hurt(6); g.obtainRelic(); g.unlockLore('lore_a2_lowmere_office'); return 'rite'; } },
          { label: '[Leave them to their prayers]', end: true },
        ],
      },
      joined: {
        text: P(
          `You fill your lungs and wade down the drowned steps, and kneel in an empty stall. The cold is enormous. The brother beside you turns his white face and, without a flicker of surprise, tilts his psalter so you can share.`,
          `You do not know the words. Your mouth knows them anyway. You pray until your chest is a fist and the candles swim, and something in you that was muddy settles, the way silt settles in still water, and leaves you clear.`,
          `You come up gasping into the grey air. Below you, the brother turns the page.`,
        ),
        choices: [{ label: '[Leave]', end: true }],
      },
      robbed: {
        text: P(
          `The last of them sinks back down, slow as a leaf, and settles in his stall, and folds his hands. In a little while the bubbles begin again, more ragged than before. *Make haste. Make haste.*`,
          `The candlesticks are heavy and cold in your pack. They smell of the mere, and they will go on smelling of the mere for as long as you carry them, and for some while after you have sold them.`,
          `On your way out you catch yourself walking softly, the way you would in any church, and you are not sure who you are being quiet for.`,
        ),
        choices: [{ label: '[Leave]', end: true }],
      },
      rite: {
        text: P(
          `You do not wade in. You stand at the water's edge as a priest stands at the edge of a grave, and you sing the Office for the Dead: all of it, every verse, the office no one in Morrow has needed in a hundred years.`,
          `Below, one by one, the brothers stop praying. They lift their faces and look, for the first time in twenty years, surprised. Then the silver threads stop rising, and they lean against one another in their stalls like tired men after a long day, and are still.`,
          `The candles go out. In the dark the abbot's ring floats up into your hand. Your voice is raw. Odd: you do not remember taking a single breath.`,
        ),
        choices: [{ label: '[Leave]', end: true }],
      },
    },
  },

  {
    id: 'a2_silt_reliquary', title: 'The Reliquary in the Silt', acts: [2], art: 'scene_crypt',
    init(g, d) { d.step = 0; d.last = null; },
    pages: {
      start: {
        text: (g, d) => P(
          d.step === 0
            ? `The abbey crypt has become a pond of black silt, ankle-deep, knee-deep, deeper toward the walls. The reliquaries went down with everything else. You can see the corner of a silver casket, a gilt finger-bone in a crystal tube, the gleam of a chased lid just under the surface.`
            : SILT_FINDS[d.last],
          d.step === 0
            ? `You can see, too, that the silt is not still. A bubble rises. Something that might be a hand turns slowly over, like a sleeper, and sinks again.`
            : `The silt has settled again. Something under it shifts, as if making itself comfortable.`,
          d.step === 0 ? `You could reach in. Most of what is down there has been waiting a very long time, and is in no hurry.` : `There is more down there. There is always more down there.`,
        ),
        choices: [
          { label: (g, d) => `[Reach in] ${SILT[d.step].risk}% chance a drowned hand finds you first (lose 8 HP, search ends). Prize: ${siltPrize(g, d.step)}.`,
            show: (g, d) => d.step < SILT.length, req: hpReq(8),
            fx(g, d) {
              g.unlockLore('lore_a2_relic_inventory');
              if (roll(g, SILT[d.step].risk / 100)) { g.hurt(8); return 'grabbed'; }
              const s = SILT[d.step];
              if (s.prize === 'gold') g.gainGold(45);
              else if (s.prize === 'tincture') g.obtainPotion();
              else if (s.prize === 'relic') g.obtainRelic();
              else g.obtainRelic('rare');
              d.last = s.prize;
              d.step++;
              return d.step >= SILT.length ? 'emptied' : 'start';
            } },
          { label: (g, d) => (d.step === 0 ? '[Leave the dead their treasures]' : '[Stop while you still have both hands]'), end: true },
        ],
      },
      grabbed: {
        text: P(
          `A hand closes on your wrist. It is soft with twenty years of water and very, very strong, and it pulls: not hard, not angrily, the way a child pulls at a sleeve. *Come and see.*`,
          `You brace your feet and haul. Your skin tears where the fingers were. The silt slaps shut over the hand, the bubbles stop, and the whole crypt goes still in a way that feels very much like sulking.`,
          `You do not reach in again. Some invitations you only refuse once.`,
        ),
        choices: [{ label: '[Leave]', end: true }],
      },
      emptied: {
        text: P(
          `Your arm goes in to the shoulder. Your fingers close on something carved and warm, and you draw it up through the black silt slowly, like a midwife.`,
          `When it is out, the crypt changes. The bubbles stop. The silt goes flat and dull as slate. Whatever was keeping these things has decided, it seems, that you have earned them, or else that it is tired of you.`,
          `As you climb the stair you hear, from far below, a long soft sigh, like a sleeper turning over to face the wall.`,
        ),
        choices: [{ label: '[Leave]', end: true }],
      },
    },
  },

  {
    id: 'a2_fogged_glass', title: 'The Fogged Glass', acts: [2], art: 'scene_abbey',
    pages: {
      start: {
        text: P(
          `The abbess's parlour stands above the waterline, just: a dry room with a wet floor. On the dressing table is a silver mirror far too fine for any abbess, a queen's glass, with a crowned M worked into the frame.`,
          `The glass is fogged. Not on the outside. *Inside*, as if someone were standing very close on the other side of it, breathing.`,
          `As you watch, a fingertip draws through the fog from within. Slowly, in a lady's careful hand, it writes:`,
          `*WHO IS THERE*`,
        ),
        choices: [
          { label: '[Answer her]', next: 'answer' },
          { label: () => `[Pry the silver from the frame] Gain 100 gold. Become Cursed — ${curseName('grief')}.`,
            fx(g) { g.gainGold(100); addCurse(g, 'grief'); g.unlockLore('lore_a2_maren_letter'); return 'pried'; } },
          { label: '[Back away]', end: true },
        ],
      },
      answer: {
        text: (g) => H(g, {
          knight: P(
            `"Aldous Vane," you say, and then, because it is a queen's glass, "Your Majesty."`,
            `The fog thins, as if from a breath held. The finger writes: *THE BOY WHO MINDS DOORS*`,
            `Aldous goes grey. "I was a guardsman on your stair," he says. "The year you — the last year. You gave me an orange once, at Midwinter. I didn't think you'd remember."`,
            `The fog writes, more slowly: *I REMEMBER WHO STOOD OUTSIDE*. Then a locket is lying on the dressing table where nothing lay before, wet, and very cold.`),
          witch: P(
            `"Isolde Marrow. Elowen's daughter."`,
            `The fog shivers. *ELOWEN*, the finger writes, and underlines it twice, hard, as if it meant something urgent. Isolde leans in. "What? What about her?"`,
            `The fog smears as though wiped by a sleeve, and writes again, smaller: *ASK THE KEEPERS*. Then: *I AM SORRY*. Then a locket is lying on the dressing table where nothing lay before, wet, and very cold.`,
            `"That's not an answer," Isolde says to the glass. Her voice cracks on *answer*.`),
          wren: P(
            `Wren says nothing at all. Wren simply steps in front of the glass.`,
            `For a long moment nothing happens. Then the fog draws back from the middle of the mirror all at once, like a curtain, and there in the clear glass is a face: a child's face, round and solemn, grey-eyed, looking out from the place where the mask should be reflected.`,
            `Then the fog rushes back. The finger writes, very gently: *HUSH*.`,
            `When Wren can move again, there is a locket on the dressing table, wet and cold. "Was that—" Wren says, and cannot finish.`),
          cantor: P(
            `"Brother Cael, Majesty. Confessor to the King."`,
            `The fog writes back at once, as if it had been waiting: *YOU HEARD HIM*. Then, much slower, the letters trembling: *DID HE SAY MY NAME*`,
            `You cannot tell her what was confessed. You have never broken the seal and you will not start for a ghost in a glass. "He was not alone in his thoughts, Majesty," you say at last. "Not at the end."`,
            `The fog clears a little, as if she wept. There is a locket on the dressing table that was not there before, wet, and very cold.`),
        }),
        choices: [
          { label: (g) => `[Take the locket] Lose 4 Max HP. Obtain ${relicName(g, 'maren_locket')}.`,
            fx(g) { g.loseMaxHp(4); giveRelic(g, 'maren_locket'); return 'taken'; } },
          { label: '[Leave it for her]', end: true },
        ],
      },
      taken: {
        text: (g) => P(
          `The locket is so cold it burns. You close your hand on it anyway, and some of the cold goes into you and settles there, in the bones of your fingers, like a winter that has decided to stay.`,
          `It will not open. Inside, faintly, something ticks.`,
          `When you look up, the fog in the glass has cleared entirely. The mirror shows the parlour, the wet floor, the dressing table, and you. Only you. And yet you have the strongest sense that somebody, a moment ago, turned away from the glass and walked off down a long corridor, satisfied.`,
          H(g, { wren: `Wren looks into the clear mirror and sees only the mask. Wren looks for a long time anyway.` })),
        choices: [{ label: '[Leave]', end: true }],
      },
      pried: {
        text: P(
          `The glass cracks the moment your knife goes under the frame: one long split, corner to corner. Behind it the fog boils, and then, very softly, through the silver, you hear a woman weeping.`,
          `You work faster. The frame comes away in four good heavy pieces. Folded into the backing is a letter in a fine court hand, which you pocket without reading.`,
          `The weeping does not stop when you leave the parlour. It does not stop when you leave the abbey. It sounds, by evening, a great deal like your own.`,
        ),
        choices: [{ label: '[Leave]', end: true }],
      },
    },
  },

  {
    id: 'a2_lamp_tower', title: 'The Lamp in the Tower', acts: [2], art: 'scene_abbey',
    pages: {
      start: {
        text: (g) => P(
          `The bell-tower is the only part of Lowmere still standing clear of the mere, and someone lives at the top of it. A lamp burns in the louvres. A rope ladder hangs down.`,
          `Sister Agathe was already old when the water came. She is older now, far older than anyone ought to be, in the way of Morrow, where the old went on and on. She keeps the lamp because the abbess told her to, and the abbess has been at the bottom of the mere these twenty years, so no one has told her to stop.`,
          g.run.hero === 'cantor'
            ? `When she sees you she sets down the kettle. "Oh," she says. "Oh, you've come for me at last. I did wonder who they'd send." "I'm a priest, Sister." "Yes, dear," she says comfortably. "That's what I said."`
            : `"Visitors!" she cries, delighted, and puts a kettle on the brazier, and bids you sit on the rim of the bell-hole, where the great bell hung before it fell into the mere, and tell her everything.`,
        ),
        choices: [
          { label: (g) => (g.run.hero === 'cantor' ? '[Hear her confession] Remove a card from your deck.' : '[Confess to her] Remove a card from your deck.'),
            async fx(g) { await g.removeCardChoice(1); g.unlockLore('lore_a2_agathe_daybook'); return 'confess'; } },
          { label: '[Take tea and sleep] Heal 20 HP.',
            fx(g) { g.healOut(20); g.unlockLore('lore_a2_agathe_daybook'); return 'tea'; } },
          { label: (g) => `${g.run.hero === 'cantor' ? '[Give her the last rites]' : '[Tell her she may let the lamp go out]'} Obtain ${relicName(g, 'grave_lantern')}.`,
            fx(g) { giveRelic(g, 'grave_lantern'); g.unlockLore('lore_a2_agathe_daybook'); return 'release'; } },
        ],
      },
      confess: {
        text: (g) => (g.run.hero === 'cantor'
          ? P(
            `She confesses seventy years of small sins, worn smooth as beads: a stolen apple, a sharp word to the cellarer, a long hatred of the second verse of the Vespers psalm. You absolve her. She weeps a little, and laughs, and then insists on hearing yours.`,
            `You have not confessed in a long time. You find you cannot remember when. You tell her what you can, and she listens with her head on one side, and says "Well, that's not so bad," which is kind of her.`,
            `Something you have carried a long way is simply not in your pack any more.`)
          : P(
            `You tell her things you have told no one. She listens with her hands folded and her head on one side, nodding, like a woman listening to the weather.`,
            `When you have finished she says, "Well, that's not so bad," which is a lie, and kisses your forehead, which is not.`,
            `Afterwards something you have carried a long way is simply not in your pack any more. You don't miss it. You will try, later, to remember what it was, and fail, and be glad.`)),
        choices: [{ label: '[Leave]', end: true }],
      },
      tea: {
        text: P(
          `Her tea is mostly nettle and her bread is mostly ash, and you have never been so grateful for either. She tucks a blanket round you as if you were one of her novices — "you'll have been one once, everyone was" — and you sleep, deeply, on the rim of the bell-hole, with the mere sighing far below.`,
          `You wake to the lamp, and her humming, and the smell of more nettles. She has darned your cloak while you slept, very badly, with enormous love.`,
        ),
        choices: [{ label: '[Leave]', end: true }],
      },
      release: {
        text: (g) => (g.run.hero === 'cantor'
          ? P(
            `"You came," she says. "I knew someone would. I kept the lamp so you'd find the way."`,
            `You do not correct her. You anoint her with oil from the lamp and say the old words, and she lies back on her pallet and says "Oh, that's better," and then nothing else, ever.`,
            `The lamp does not go out. You carry it down the ladder, still burning. Somehow you knew it wouldn't.`,
            `It is a long while, walking, before you begin to wonder why she was so very sure you had come *for* her.`)
          : P(
            `"The abbess is dead, Sister," you say. "She has been dead a long time. You can stop."`,
            `She is quiet. Then she laughs a little. "Do you know, I think I knew. I just didn't like to presume." She turns the wick down slowly, the way you close a sleeping child's door. "Will you sit with me? Only a little while."`,
            `You sit. The lamp goes out. The tower is dark, and then, after a time, it is dark in a different way.`,
            `In the morning you carry the lamp down the ladder. It is cold. And it is still, somehow, alight.`)),
        choices: [{ label: '[Leave]', end: true }],
      },
    },
  },

  {
    id: 'a2_bell_below', title: 'The Bell Below', acts: [2], art: 'scene_water',
    pages: {
      start: {
        text: (g) => P(
          `At midnight the mere rings. It is the great bell of Lowmere, which fell from its tower when the water came, and it tolls from the bottom of the mere: a slow bronze voice you feel in your teeth before you hear it.`,
          `On the third stroke the drowned walk out of the water. Brothers, mostly, and lay-folk from the villages, coming up the shingle in a long patient line with the mere pouring from their sleeves, filing toward the ruined abbey the way you go to church when the bell calls and you are too tired to wonder why.`,
          H(g, {
            knight: `Aldous keeps his hand on his sword-hilt and does not draw. You don't draw on a congregation.`,
            witch: `"Twenty years drowned," Isolde says, "and they're *walking*." She sounds less frightened than envious, and then ashamed of that.`,
            wren: `One of them, a woman walking apart from the rest with weed in her hair like a crown, slows as she passes, and half turns toward Wren. Then the bell tolls again and she walks on into the deep water and is gone.`,
            cantor: `Several of the drowned nod to Cael as they pass, as one nods to a brother in the cloister. One says, quite clearly, "Evening, Brother," and water runs out of his mouth.`,
          })),
        choices: [
          { label: (g) => `[Walk with them] Lose 5 Max HP. Obtain ${relicName(g, 'drowned_rosary')}.`,
            fx(g) { g.loseMaxHp(5); giveRelic(g, 'drowned_rosary'); g.unlockLore('lore_a2_bell_rhyme'); return 'walk'; } },
          { label: '[Search the shingle behind them] Gain 60 gold. 1 in 4 chance one of them turns back: a fight.',
            async fx(g) {
              g.gainGold(60); g.unlockLore('lore_a2_bell_rhyme');
              if (roll(g, 0.25)) { await g.eventCombat(foes(g, 2, ['drowned_monk', 'drowned_monk'], ['drowned_brother', 'drowned_brother']), { resume: 'turned' }); return; }
              return 'searched';
            } },
          { label: '[Stop your ears and go]', end: true },
        ],
      },
      walk: {
        text: P(
          `You fall into step. Nobody objects. The woman beside you smells of weed and cold stone and hums the psalm under her breath, and her hand, when it brushes yours, is as soft as a peeled grape.`,
          `In the ruined nave they stand in their places in the shallows, and the bell stops, and in the silence a hundred drowned voices say the Common Prayer, quite ordinary, quite flat, the way people say it every Sunday without thinking. You say it with them.`,
          `When you look up they are gone. You stand alone, waist-deep, with a string of black beads in your fist, so cold that some of the cold, you know, is never going to leave.`,
        ),
        choices: [{ label: '[Leave]', end: true }],
      },
      searched: {
        text: P(
          `They have left things behind on the shingle, the way people shed what they no longer need on the walk to church: rings slipped from swollen fingers, a purse rotted through, coins for a ferryman nobody had the chance to pay.`,
          `You gather them quickly while the bell tolls. None of the drowned looks back. They are going to church; they will not need them.`,
          `It is only on the walk away, with the bell still ringing behind you, that you notice the coins are warm.`,
        ),
        choices: [{ label: '[Leave]', end: true }],
      },
      turned: {
        text: P(
          `It lies on the shingle now, finally still, its fingers still curled round one of its own rings. The others never broke step. The bell never paused.`,
          `You pocket what you came for. Out on the black water, where the bell is, a ring of ripples spreads and spreads, and does not stop at the shore, and goes on, you suspect, under the land.`,
          `Next time, you think, you will let the dead keep their coins. You think that every time.`,
        ),
        choices: [{ label: '[Leave]', end: true }],
      },
    },
  },

  {
    id: 'a2_coffin_ferry', title: 'The Coffin Ferry', acts: [2], art: 'scene_water',
    pages: {
      start: {
        text: (g) => P(
          `The causeway to the abbey went under with the rest. Where it used to begin, a ferryman waits, leaning on a pole. His boat is a coffin, a good one, elm with brass handles, its lid propped up behind him as a backrest.`,
          `He is very obviously dead. The water has not been kind to him, but he has kept his hat on through all of it, and he touches the brim. "Crossing? Fare's a coin. Used to be you'd bring it under your tongue, but nobody's been dying proper lately, so I take it in the hand. Times change." He considers. "Well. They don't. You know what I mean."`,
          H(g, {
            knight: `"Is it safe?" Aldous asks. The ferryman looks at the coffin, and at Aldous, and out across the grey water, and says nothing for long enough to be an answer.`,
            witch: `Isolde looks at his hands, gone soft and white as soap. "Grave-wax," she says, almost admiringly. "You look well on it." "Thank you, miss. Nobody says."`,
            wren: `"Can I lie down in it?" Wren asks. The ferryman sucks his teeth. "You can," he says. "Most don't ask."`,
            cantor: `The ferryman peers at Cael. "No coin under your tongue, Brother. Shame. I'd have taken you the whole way for that." "Only across, I think." "If you say so, Brother."`,
          })),
        choices: [
          { label: '[Pay the fare] Lose 25 gold. Upgrade a card.', req: goldReq(25),
            async fx(g) { g.loseGold(25); await g.upgradeCardChoice(1); return 'scriptorium'; } },
          { label: '[Lie down in the coffin] Transform 2 cards.',
            async fx(g) { await g.transformCardChoice(2); return 'coffin'; } },
          { label: '[Stay on this shore]', end: true },
        ],
      },
      scriptorium: {
        text: P(
          `He poles you across in silence, the coffin riding low, and leaves you at the scriptorium stair. The copying desks stand in rows above the waterline, inkwells long dry, books open to whatever page the brothers were working on when the mere rose.`,
          `On one desk lies an illuminated page: a knight, a beast, a saint, a margin full of snails. Somebody's unfinished work, twenty years old, the gold leaf still bright. You study it until something in the craft of it, the patience, the sureness of the line, becomes a little bit yours.`,
        ),
        choices: [{ label: '[Leave]', end: true }],
      },
      coffin: {
        text: (g) => P(
          g.run.hero === 'cantor'
            ? `He shuts the lid on you, not unkindly. "Comfortable, Brother?" "Oddly," you say, and mean it. It fits as if it were made for you.`
            : `He shuts the lid on you, not unkindly. "Mind your elbows."`,
          `It is dark and close and smells of elm and mere. The coffin rocks. You hear the water slide by, and then voices, muffled, as though through earth: someone reading the words they read over graves, someone weeping, someone saying your name the way you have never heard it said, as if you were already a story.`,
          `When the lid opens you are on the far shore and the ferryman is lifting his hat, and you are not who you were when you lay down. Not entirely. Some of what you knew stayed in the box.`,
        ),
        choices: [{ label: '[Leave]', end: true }],
      },
    },
  },
]);

// The Buyer of Names: shared choice list for its start and ask pages.
function nameChoices() {
  return [
    { label: (g) => `[Sell "${g.run.hero === 'knight' ? 'Aldous' : 'Isolde'}"] Choose 1 of 3 rare cards. Become Cursed — ${curseName('doubt')}.`,
      show: notHero('wren', 'cantor'),
      async fx(g) { addCurse(g, 'doubt'); await offer(g, { rarity: 'rare' }, 'A knack, for a name'); return 'sold'; } },
    { label: '[Sell "Wren"] Choose 1 of 3 rare cards. Lose 5 Max HP.', show: isHero('wren'),
      async fx(g) { g.loseMaxHp(5); await offer(g, { rarity: 'rare' }, 'A knack, for a name'); return 'sold_wren'; } },
    { label: '[Sing it a psalm instead] Lose 6 HP. Choose 1 of 3 uncommon cards.', show: isHero('cantor'), req: hpReq(6),
      async fx(g) { g.hurt(6); await offer(g, { rarity: 'uncommon' }, 'A knack, for a psalm'); return 'psalm'; } },
    { label: '[Ask what it does with names]', show: (g, d) => !d.asked,
      fx(g, d) { d.asked = true; g.unlockLore('lore_a2_true_names'); return 'ask'; } },
    { label: '[Keep your name]', end: true },
  ];
}

// The Reliquary in the Silt: escalating push-your-luck ladder.
const SILT = [
  { risk: 20, prize: 'gold' },
  { risk: 35, prize: 'tincture' },
  { risk: 50, prize: 'relic' },
  { risk: 65, prize: 'rare' },
];
function siltPrize(g, step) {
  const p = SILT[step] && SILT[step].prize;
  if (p === 'gold') return '45 gold';
  if (p === 'tincture') return beltFull(g) ? 'a Tincture (your belt is full)' : 'a random Tincture';
  if (p === 'relic') return 'a random relic';
  return 'a random rare relic';
}
const SILT_FINDS = {
  gold: `Coins: a pilgrim's offering-bowl, still full, the silver gone black with silt. Something brushes your wrist as you draw back. Weed, probably.`,
  tincture: `A stoppered phial of holy water, or what passed for it here. It is mere-water now. It is still holy. It is just holy about something else.`,
  relic: `A casket the size of a hymnal, sealed with lead. Inside, wrapped in rotted silk, something that was precious to somebody once, and has not stopped being precious. Under the silt, someone sighs.`,
  rare: `—`,
};

// ------------------------------------------------------------------ lore
defineLore([
  {
    id: 'lore_a2_weeping_wood', cat: 'world', title: 'The Weeping Wood',
    text: P(
      `*From* The Forester's Almanack, *Morrow edition, much reprinted.*`,
      `The Weeping Wood lies west of the Marches and is to be avoided by all who can avoid it. Its trees are of no known kind. They weep a resin like amber, said to hold the griefs of travellers who wept beneath them, which sells well in the cities for that reason, the rich being fond of other people's sorrow.`,
      `Do not gather the tears. Those who do report that the sorrow comes with them, and is not always their own. Do not speak your name aloud beneath the trees. Do not accept food. Do not follow lights.`,
      `If you must cross, cross by day, and cross quickly. And if you hear someone weeping behind you, do not, under any circumstances, offer them comfort.`,
    ),
  },
  {
    id: 'lore_a2_true_names', cat: 'world', title: 'On Names',
    text: P(
      `A name is a door. The Fair Folk say it so often it has become a proverb, and like all proverbs it is repeated by people who have never thought what it means.`,
      `It means this: a thing that is truly named can be called. Called home, called to heel, called up out of the ground. The fae trade in names as men trade in coin, and the old fae lords hide their own where no one will ever look: inside an egg, inside a stone, inside a song nobody sings any more.`,
      `The oldest name in Morrow belongs to the Lady Under the Hill. Once, it is said, anyone could speak it, and she would come. It is said that someone made very sure no one could.`,
      `*— from a hedge-witch's commonplace book, seized at Crossbeam*`,
    ),
  },
  {
    id: 'lore_a2_grall_writ', cat: 'letters', title: 'The Witchfinder\'s Writ',
    text: P(
      `BY AUTHORITY of the Lord Regent, in the name of the Hour that Holds:`,
      `Know that the arts of DECAY — rot-craft, blight-calling, the souring of milk and wounds and grain — are an abomination against the Crown, which preserves. Whosoever practises them invites into Morrow that which the Crown in its mercy has held back.`,
      `The bearer, MATTIAS GRALL, Witchfinder General, is empowered to discover, examine and purify such persons by the customary means, without appeal. Particular attention is commended to one ISOLDE MARROW, kinswoman, banished. She is to be taken ALIVE. Double the bounty if whole and unburned.`,
      `*Sealed with a crane, wings spread. In the margin, in a sergeant's hand:* why alive? *Beneath, in another:* dont ask.`,
    ),
  },
  {
    id: 'lore_a2_fair_table', cat: 'world', title: 'The Courtesies of the Fair Table',
    text: P(
      `*Taken down from a woman who sat at it for eleven years, until her brother pulled her loose.*`,
      `If they ask you to sit, the asking is a gift. The sitting is a debt.`,
      `Their food is the best you will ever eat. That is not a kindness. That is a hook.`,
      `A plate laid face-down is for the dead. Do not turn it over. Do not let them see you notice whose place it is.`,
      `Never thank them. Thanks is a confession that you owe.`,
      `The great chair at the head of the table is for the one they are waiting for. They have been waiting a long time. Pray it is not you.`,
      `She said she still dreams of the pears. She said that was the worst of it: not the eleven years, but that she would go back.`,
    ),
  },
  {
    id: 'lore_a2_antlered_king', cat: 'bestiary', title: 'The Antlered King and His Harts',
    text: P(
      `Lord of the Weeping Wood, eldest of the fae courts still standing in Morrow. Huntsmen describe a figure of bark and bone, crowned with antlers so vast that rooks nest in them, though no two huntsmen ever agreed upon his face.`,
      `His white harts walk the wood as his eyes. They are not beasts, or not only; wounded, they bleed sap. To free one is to be remembered kindly. To kill one is to be remembered.`,
      `He serves, it is said, a lady older than he is, whom he has not seen in four hundred years. He keeps her chair. He keeps her table laid. He has sworn that when she comes home he will bow, and that until then he will bow to nothing.`,
      `He has not bowed in a very long time.`,
    ),
  },
  {
    id: 'lore_a2_pricking', cat: 'world', title: 'A Discourse on the Discovery of Witches',
    text: P(
      `*By Mattias Grall, Witchfinder General. Third printing.*`,
      `The witch bears upon her body a Mark, being the place where the Adversary took his payment. It does not feel. It does not bleed. It is found by pricking.`,
      `The pricker shall be a man of steady hand and godly habit. He shall use a needle of three inches, blessed, and work from the crown downward. Honest flesh, being pricked, bleeds and cries out. The Mark does neither.`,
      `Let the pricker be paid by the witch discovered, that he be diligent.`,
      `*Pencilled beside the last line, in another hand:* and that is why they never fail to find one.`,
    ),
  },
  {
    id: 'lore_a2_ambrose_letter', cat: 'letters', title: 'A Letter Never Delivered',
    text: P(
      `*Found in the saddlebag of Ser Ambrose Hale. The seal is the Long King's own. Thirty years of rain have taken most of the ink.*`,
      `*...to the Lady of the Wood, or whoever keeps her door...*`,
      `*...sixty winters, and the iron does not loosen...*`,
      `*...I am told that what was taken from you might be...*`,
      `*...not for myself. Or if that cannot be, then for myself...*`,
      `*...I am so tired...*`,
      `*...my knight will wait for your answer. He is a good man. He will wait as long as...*`,
      `The last line is clear, as if added later in a shakier hand: *Forgive me. I will not send another.*`,
    ),
  },
  {
    id: 'lore_a2_lowmere_office', cat: 'world', title: 'The Office of Lowmere',
    text: P(
      `*The psalm the drowned brothers of Lowmere sing at Vespers, as nearly as it can be made out from the bubbles.*`,
      `*Make haste, make haste to help us.*\n*The water is come in at the door of the soul.*\n*There is no floor beneath us and no roof above,*\n*and the candles burn on, and we do not.*`,
      `*We were told that we would see Thy face.*\n*We have waited with our eyes open.*\n*Make haste.*\n*Make haste.*`,
      `The office has no ending. When the last verse is sung, the brothers begin again.`,
    ),
  },
  {
    id: 'lore_a2_relic_inventory', cat: 'world', title: 'Inventory of Relics, Lowmere',
    text: P(
      `*Taken at Michaelmas by Br. Anselm, sacristan, being the last such inventory before the water.*`,
      `One (1) finger of the Blessed Gudrith, in crystal. The third such finger in our keeping. Let no brother remark upon it.`,
      `The comb of Saint Aelfwen-of-the-Fens, with hair.`,
      `A phial of the Mere's first water, said to have been blessed by the Founder's own chaplain. Cloudy.`,
      `One reliquary, silver, sealed, the gift of Her Majesty the Queen. Contents not to be inquired after. Very heavy. Cold to the touch, even in August.`,
      `A thorn from the Wood, which Brother Oswy swears moved.`,
      `One (1) further finger of the Blessed Gudrith, found beneath the sacristy floor. Let no brother remark upon it.`,
    ),
  },
  {
    id: 'lore_a2_maren_letter', cat: 'letters', title: 'Maren to the Abbess',
    text: P(
      `*Found folded into the frame of a silver mirror in the abbess's parlour at Lowmere.*`,
      `Mother Abbess —`,
      `I will come at Candlemas, by water, alone. Tell no one, least of all the King's men. He has stopped asking where I go, and I would not have him start.`,
      `I am bringing something I cannot keep at court. You will want to know what it is. I would rather you did not. Keep the lamp lit for me.`,
      `You asked me once, years ago, what I would give to have a child. I find the question was put the wrong way about.`,
      `Pray for me, if you still do that. I find I cannot. — M.`,
    ),
  },
  {
    id: 'lore_a2_agathe_daybook', cat: 'letters', title: 'Sister Agathe\'s Day-Book',
    text: P(
      `*Kept in the bell-tower at Lowmere. Twenty years of entries; a selection.*`,
      `Lamp lit. Water still high. Abbess did not come.`,
      `Lamp lit. Heard the brothers at Vespers. They are flat in the second verse. Have not liked to say.`,
      `Lamp lit. A heron.`,
      `Lamp lit. Dreamed of bread.`,
      `Lamp lit. The Queen walked out of the water again tonight and stood at the foot of the tower and looked up. I waved. She did not wave back. She never does. She is looking for something, I think, that is not here any more.`,
      `Lamp lit. Abbess did not come. Perhaps tomorrow.`,
      `Lamp lit.`,
    ),
  },
  {
    id: 'lore_a2_bell_rhyme', cat: 'world', title: 'The Lowmere Bell',
    text: P(
      `*A skipping-rhyme from the villages round the mere. The children stop before the last line, and run.*`,
      `*Lowmere bell, Lowmere bell,*\n*who's that ringing down the well?*\n*Not the abbot, not the nun,*\n*not the fisher's drownded son.*`,
      `*Lowmere bell, Lowmere bell,*\n*who's that ringing, can you tell?*\n*Lady in her nightgown white,*\n*ringing for her own all night.*`,
      `*Ring it once and up they come,*\n*ring it twice and they'll go home,*\n*ring it thrice—*`,
    ),
  },
  {
    id: 'lore_a2_changelings', cat: 'bestiary', title: 'Changelings',
    text: P(
      `When the Fair Folk take a child they leave something in its place: a log, a bundle of twigs, an old fae too tired to go on, dressed in glamour to pass for a baby. Most fail within the week. Some take.`,
      `The ones that take grow up quiet, and strange, and ask the kind of questions that make adults leave the room. They do not quite have faces of their own. They borrow the faces of whoever loves them, and if no one loves them, they make do.`,
      `Wise-women say: to be rid of a changeling, put it in the fire, and it will fly up the chimney. Wiser women say: to be rid of a changeling, love it, and soon you will not be able to remember which child it was you lost.`,
    ),
  },
]);
