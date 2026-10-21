// THE HOLLOW CROWN — story events: the four heirs' arcs, the main plot, the
// descent, act intros and endings. Canon: STORY_OUTLINE.md.
//
// Pacing rules (all enforced in req):
//  - Heir beats: priority 20, strictly sequential per heir, at most ONE heir beat
//    per run (run flag 'story_heir_beat'), so a player sees ~one beat per 1-2 runs.
//    Beat 1 is Act 1; beat 2 is Act 1-2 (Act 1 only once Pell has been met, so
//    the Fool gets his Act 1 slot); beat 3 Act 2; beats 4-5 Act 3.
//  - Main plot: priority 10-12, gated on total heir beats so Pell keeps pace with
//    the heirs. pell_6 (priority 30) needs all four truths.
//  - Every beat sets its meta flag the moment it opens (so a death mid-event can
//    never strand the chain).
import { defineEvents, defineLore, defineTexts, CARDS, RELICS, ENEMIES, ENCOUNTERS, EVENTS } from '../../engine/registry.js';
import { pick, shuffle } from '../../engine/rng.js';

// ------------------------------------------------------------------ helpers
const HEIRS = ['knight', 'witch', 'wren', 'cantor'];
const beatFlags = (h) => [h + '_1', h + '_2', h + '_3', h + '_4', 'truth_' + h];
const mf = (g, k) => !!(g.meta && g.meta.flags && g.meta.flags[k]);
const stage = (g, h) => { let n = 0; for (const f of beatFlags(h)) { if (mf(g, f)) n++; else break; } return n; };
const totalBeats = (g) => HEIRS.reduce((s, h) => s + stage(g, h), 0);
const allTruths = (g) => HEIRS.every((h) => mf(g, 'truth_' + h));
const CAP = 'story_heir_beat';
const capFree = (g) => !(g.run && g.run.flags && g.run.flags[CAP]);
const erng = (g) => g.run.rng.events;
const hero = (g) => g.run.hero;

// Enemy ids for story fights. Missing ids fall back to an encounter of the act.
const FOES = {
  hunters: ['zealot', 'pyre_bearer'],                    // Act 2: Grall's men
  shield: ['gilded_sentinel', 'gilded_sentinel'],        // Act 3: the dead Royal Guard
  archive: ['crown_zealot', 'court_phantom'],            // Act 3: the Regent's archive guards
};

const relicName = (id) => (RELICS[id] && RELICS[id].name) || 'a relic';
function giveRelic(g, id, fallback = 'uncommon') {
  if (RELICS[id] && !g.hasRelic(id)) { g.obtainRelic(id); return id; }
  return g.obtainRelic(fallback);
}
const curseId = (id) => (CARDS[id] ? id : 'regret');
const curseName = (id) => (CARDS[curseId(id)] ? CARDS[curseId(id)].name : 'Regret');
function curse(g, id) { if (CARDS[curseId(id)]) g.addToDeck(curseId(id)); }
// Story events wound but never kill.
function hurt(g, n) { const P = g.run.player; g.hurt(Math.max(0, Math.min(n, P.hp - 1))); }
const hpReq = (n) => (g) => g.run.player.hp > n || 'You would not survive it.';
const goldReq = (n) => (g) => g.run.gold >= n || `You need ${n} Gold.`;
function healFull(g) { const P = g.run.player; g.healOut(P.maxHp - P.hp); }
function removeCurses(g) {
  let n = 0;
  for (const c of [...g.run.deck]) {
    const d = CARDS[c.id];
    if (d && d.type === 'curse' && !d.unremovable) { g.removeFromDeck(c); n++; }
  }
  return n;
}

// Offer up to 3 cards of the current hero, preferring ones whose text matches.
async function offerHeroCards(g, { rarity, match, count = 3, title } = {}) {
  const txt = (c) => `${c.name} ${typeof c.text === 'string' ? c.text : ''}`;
  let pool = g.cardPool(rarity ? { rarity } : {});
  if (!pool.length) pool = g.cardPool({});
  if (!pool.length) return null;
  shuffle(erng(g), pool);
  if (match) {
    const hit = pool.filter((c) => match.test(txt(c)));
    pool = hit.concat(pool.filter((c) => !hit.includes(c)));
  }
  return g.offerCards(pool.slice(0, count).map((c) => c.id), { title });
}

function foes(g, ids, pool) {
  const ok = ids.filter((id) => ENEMIES[id]);
  if (ok.length) return ok;
  const a = g.run.act;
  let list = Object.values(ENCOUNTERS).filter((e) => e.act === a && e.pool === pool && (!e.req || e.req(g)));
  if (!list.length) list = Object.values(ENCOUNTERS).filter((e) => e.act === a && (e.pool === 'hard' || e.pool === 'easy'));
  if (!list.length) return null;
  const enc = pick(erng(g), list);
  const out = typeof enc.enemies === 'function' ? enc.enemies(g, erng(g)) : enc.enemies.slice();
  return out.filter((id) => ENEMIES[id]).length === out.length && out.length ? out : null;
}
// Start a story fight; returns the resume page id if no enemies exist at all.
async function fight(g, key, opts) {
  const kind = opts.kind || 'fight';
  const list = foes(g, FOES[key] || [], kind === 'elite' ? 'elite' : 'hard');
  if (!list) return opts.resume;
  const reward = { ...(opts.reward || {}) };
  if (reward.relic && reward.relic !== 'random' && (!RELICS[reward.relic] || g.hasRelic(reward.relic))) reward.relic = 'random';
  await g.eventCombat(list, { resume: opts.resume, reward, kind });
  return undefined;
}

const ORD = ['zeroth', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth', 'thirteenth', 'fourteenth', 'fifteenth', 'sixteenth', 'seventeenth', 'eighteenth', 'nineteenth', 'twentieth'];
const ordinal = (n) => ORD[n] || n + ((n % 10 === 1 && n % 100 !== 11) ? 'st' : (n % 10 === 2 && n % 100 !== 12) ? 'nd' : (n % 10 === 3 && n % 100 !== 13) ? 'rd' : 'th');

// A terminal choice that unlocks the event's Chronicle entry.
const leave = (lore, label = '[Walk on]') => ({ label, end: true, fx(g) { if (lore) g.unlockLore(lore); } });

// Heir beat factory: id/flag, hero, act gating, sequencing, per-run cap.
function heirBeat(h, n, def) {
  const flag = n === 5 ? 'truth_' + h : h + '_' + n;
  const prev = n === 1 ? null : n === 5 ? h + '_4' : h + '_' + (n - 1);
  const acts = n === 1 ? [1] : n === 2 ? [1, 2] : n === 3 ? [2] : [3];
  return {
    acts, weight: 1, priority: 20, ...def,
    id: flag, hero: h, story: true, unique: true,
    req(g) {
      if (!capFree(g) || mf(g, flag)) return false;
      if (prev && !mf(g, prev)) return false;
      if (n === 2 && g.run.act === 1 && !mf(g, 'met_pell')) return false;
      return true;
    },
    init(g, data) {
      g.setFlag(CAP);
      g.setMetaFlag(flag);
      for (const f of def.sets || []) g.setMetaFlag(f);
    },
  };
}

// Main-plot factory.
function plotBeat(def) {
  const { flags = [], gate } = def;
  return {
    weight: 1, ...def, story: true, unique: true,
    req(g) {
      if (flags.length && mf(g, flags[0])) return false;
      return gate ? !!gate(g) : true;
    },
    init(g) { for (const f of flags) g.setMetaFlag(f); },
  };
}

// ================================================================== THE KNIGHT
const KNIGHT = [
  heirBeat('knight', 1, {
    title: 'The Door', art: 'scene_ruins',
    pages: {
      start: {
        text: `A gatehouse stands alone in the fen, its walls long gone, as if the road had forgotten where the castle went. Ash has drifted knee-deep in the arch. In the arch stands a sentry.

You can see the far road through him. His halberd is grounded. His surcoat is the blue and gold of the King's Shield, the badge pinned a thumb's width above the heart — exactly as you taught your men to pin it.

"Halt," he says, in a voice like a door left open in winter. "Who goes there?"

You know the challenge. You answered it every night for six years, at the end of the long gallery, outside a door.`,
        choices: [
          { label: '[Give your name] "Aldous Vane. The King\'s Shield."', fx(g, d) { d.answer = 'name'; return 'door'; } },
          { label: '[Answer] "A friend."', fx(g, d) { d.answer = 'friend'; return 'door'; } },
          { label: '[Say nothing]', fx(g, d) { d.answer = 'silence'; return 'door'; } },
        ],
      },
      door: {
        text: (g, d) => `${{
          name: 'The sentry looks at you a long time. "No," he says, almost kindly. "The King\'s Shield is at his post, sir. He\'s been there all night."',
          friend: '"Pass, friend," says the sentry, and does not move aside. "But not the gallery. The King\'s Shield has orders. No one."',
          silence: 'The sentry waits. Ash settles on his shoulders and does not stay. "You\'ll be wanting the gallery," he says at last. "Don\'t. The King\'s Shield has orders. No one."',
        }[d.answer || 'silence']}

And it comes back, the way cold comes back into an old break.

Ashfall night. Forty-one candles down the long gallery; you counted them. Your back against the wall beside the king's door. Your orders, brought at dusk by the Chancellor himself: *let no one in.*

Near midnight, through the oak, your father's voice. He was never loud. *Please. Please, I'm so tired. Let me go.*

You put your hand on the latch. You remember the cold of it. You thought: someone is in there with him. You thought: my orders are no one.

You took your hand away. At midnight the begging stopped, and something small and heavy rolled across a stone floor, and you stood there until dawn.`,
        choices: [
          { label: '[Relieve him of his post] Remove a card from your deck.', async fx(g) { await g.removeCardChoice(1); return 'relieve'; } },
          { label: '[Stand the watch beside him] Gain 6 Max HP.', fx(g) { g.gainMaxHp(6); return 'watch'; } },
        ],
      },
      relieve: {
        text: `"Sentry." The old voice comes out of you unasked — the parade-ground voice, the one that carried. "Who gave you your orders?"

"You did, sir." He seems puzzled that you would ask. "Ashfall night. Hold the gate, you said. No one through."

You don't remember it. You remember every other thing about that night, and not this: a boy at a gate, and you striding past him on your way up to the gallery, giving the order without breaking step.

"You're relieved," you say. "Go home."

He grounds his halberd and salutes, and walks out of the arch into the fen, and with every step there is a little less of him, until there is only the road, and the ash closing over his footprints, and you.`,
        choices: [leave('lore_story_challenge')],
      },
      watch: {
        text: `You take your place on the other side of the arch, the way it was done in the old days. Two men, one gate, no talking.

He doesn't talk. Neither do you. The ash comes down. Out in the fen a bell that isn't there tolls an hour that isn't one, and the sentry straightens at the sound, and so do you; twenty years of it are in your spine.

When dawn doesn't come — it never does, now — you step out of the arch. He stays. You are not sure he ever knew you were there.

But your shoulders remember the weight of a watch, and something in you that was cracked is braced, for now, the way a splint braces a bone that has not yet decided whether to heal.`,
        choices: [leave('lore_story_challenge')],
      },
    },
  }),

  heirBeat('knight', 2, {
    title: "The Squire's Grave", art: 'scene_chapel',
    pages: {
      start: {
        text: `The chapel of the old tilt-yard has lost its roof. The training posts outside stand in rows like the stumps of a burned orchard. You were a boy here. You took your first fall from a horse in that mud, and your father — whom you were not allowed to call that — watched from the wall, and did not laugh.

Behind the chapel there is one grave. Only one; in those days there was almost never need of another.

PIP HARROW, SQUIRE. HE WAITED.

You had forgotten the words. You had forgotten Pip. You stand over him with ash in your collar, and the forgetting comes apart in your hands like wet paper.`,
        choices: [{ label: '[Remember]', next: 'memory' }],
      },
      memory: {
        text: `Pip fell from the curtain wall in your twelfth summer and broke himself on the flags, and did not die.

He lay in the infirmary thirty-one days. He could not speak. He could not close his eyes. The physicians called him *stopped* — the word they used for the very old — and drew the curtains round him.

On the thirty-second night the king came. He sent the physicians out. He did not see you behind the curtain, or he did, and let you stay.

He lifted the Crown off his head with both hands and set it on the blanket by Pip's feet. For the space of a few breaths he was an old man, older than anyone you had ever seen. And Pip let out a long breath, like a sail emptying, and was gone.

Then the king put the Crown back on, and found you with his eyes.`,
        choices: [{ label: '[Go to him]', next: 'oath' }],
      },
      oath: {
        text: `"Come here, Aldous."

You came. He put his hand on your head — the only time he ever did — and his fingers were shaking.

"Listen to me. When I die — and I will, one day, I promise you I will — do not let them crown another. Whatever they say. Whoever they bring. Swear it."

You swore it. You were twelve. You would have sworn him the moon.

Then you forgot, the way children forget a thing too heavy to carry, and grew into a man who obeyed every order but that one.

Ash settles on Pip's grave. A long way east, in Ashgrave, a crown is lying on a floor, waiting for a head.`,
        choices: [
          { label: '[Swear it again, aloud] Choose a card to add to your deck.', async fx(g) { await offerHeroCards(g, { rarity: 'uncommon', match: /oath/i, title: 'Swear it again' }); return 'sworn'; } },
          { label: '[Say his name] Heal 20 HP.', fx(g) { g.healOut(20); return 'name'; } },
        ],
      },
      sworn: {
        text: `"I swear it," you say — to the grave, to the wall, to a man who has been dead since Ashfall. Your voice is rusty. "I'll not let them crown another."

The tilt-yard is very quiet.

It is his oath, not yours; you know that even as you say it. An order, given to a frightened boy by a frightened king. But it is the first order in twenty years that you have *wanted* to obey, and you find your hands have closed into fists, and that they are not shaking.

You do not know yet what it will cost to keep. You know you are going to try.`,
        choices: [leave('lore_story_pip')],
      },
      name: {
        text: `"Pip Harrow," you say.

No one has said it aloud in thirty years. It sounds strange in the ruined yard: small and particular, a boy's name, the name of someone who stole apples from the kitchen garden and was frightened of the grey mare.

"Pip Harrow," you say again. "Squire. He waited thirty-one days, and then the king let him go."

You find you are sitting on the wet grass beside him, the way you once sat beside his bed. The ache in your shoulders loosens. You stay until your legs are cold.

The oath you leave where you found it, in the ground with Pip. But you know where it is now. You can come back for it.`,
        choices: [leave('lore_story_pip')],
      },
    },
  }),

  heirBeat('knight', 3, {
    title: "The Witchfinder's Question", art: 'scene_camp', speaker: 'npc_grall',
    pages: {
      start: {
        text: `A witch-hunters' camp in a clearing of black pines: tents, a cage on a cart, a stake with nothing on it yet. The men in grey look up as you come out of the trees, and their hands go to their hilts — and a voice says "Leave him," and they do.

Mattias Grall has not changed. The long jaw. The scrubbed hands, a Witchfinder's brand burned into the back of each. And on his breast, under the grey, the faded outline of a blue-and-gold badge he never quite took off. You stood the wall beside him for six years. He was the best of your men, and the first to leave.

"Vane," he says. "Sit. I've wanted to ask you something since Ashfall."`,
        choices: [{ label: '[Sit]', next: 'question' }],
      },
      question: {
        text: `He pours you something hot and does not drink his own.

"I've burned ninety women since the king died," he says, as another man might say he'd walked ninety miles. "Rot-witches, every one. I sleep well. But there's one thing I can't put down." He looks at you. "Who locked the door?"

"What door?"

"His. Crane told the court there was an assassin within, the door barred from inside, and the King's Shield couldn't get in. It's what I tell my men when they ask why you're still breathing." He turns the cup in his branded hands. "So. Who locked it?"

You open your mouth to say *I don't know.* And you see the latch, and feel the cold of it under your palm, and how it gave — only a little — before you took your hand away.`,
        choices: [
          { label: '[Tell him the truth] Lose 7 HP. Upgrade a card.', req: hpReq(7), async fx(g) { hurt(g, 7); await g.upgradeCardChoice(1); return 'truth'; } },
          { label: () => `[Tell him Crane's story] Gain 80 Gold. Become Cursed — ${curseName('shame')}.`, fx(g) { g.gainGold(80); curse(g, 'shame'); return 'lie'; } },
          { label: "[Stand, and draw] Fight the Witchfinder's men. Win a relic.", async fx(g) { g.unlockLore('lore_story_proclamation'); return fight(g, 'hunters', { resume: 'fought', reward: { relic: 'random' } }); } },
        ],
      },
      truth: {
        text: `"No one," you say. "It wasn't locked. It was never locked."

For a while the only sound is the fire.

"You heard him," Grall says. It isn't a question.

"I heard him."

He nods slowly, and stands, and hits you once — a short, economical blow, the kind you taught him — and you let it land.

"That's for him," he says, wiping his knuckles. "Your king was begging on the other side of a door, and you stood there. Whatever was in that room with him, you let him face it alone."

He is wrong about a great many things. He is not wrong about that.`,
        choices: [leave('lore_story_proclamation')],
      },
      lie: {
        text: `"Crane's right," you say. "Barred from within. I couldn't get in." The words come easily. You've heard them so often in other mouths.

Grall studies you a long moment. Then he nods, and the relief in his face is terrible to see.

"Good," he says. "Good. I knew it." He presses a purse into your hand — *for the road* — and calls you Captain, which no one has done since Ashfall.

You walk out of the camp with his coin and his trust, and the latch is cold in your palm all the way to the tree line.`,
        choices: [leave('lore_story_proclamation')],
      },
      fought: {
        text: `When it's over the camp is quiet and Grall is gone: a horse missing from the line, the fire kicked out. He always did know when to leave a fight he didn't need.

On the stool where he sat he has left the cup he never drank from. Beside it, scratched into the wood with a knife point, are two words in the old guard cant you taught him for messages left on watch:

*NEVER LOCKED?*

He knew. Some part of him has always known. He wanted to hear you say it.

So you say it, alone, to the empty clearing. "Never locked." It is the first time you have let yourself hear it.`,
        choices: [leave('lore_story_proclamation')],
      },
    },
  }),

  heirBeat('knight', 4, {
    title: 'The Shield Wall', art: 'scene_court',
    pages: {
      start: {
        text: `The Gallery of Shields runs the north side of the palace, and the King's Shield still holds it.

They stand in two ranks, as they stood on Ashfall night. Hollis. Brand. The Avery twins. Old Corrin with his bad knee. Forty men, their faces gone the colour of tallow, ash lying unbrushed on their pauldrons. When you come up the stair, forty helms turn toward you at once, with a sound like one breath.

"Captain," says Hollis. His lips don't move with it.

And from between the ranks, unhurried, comes Lord Severin Crane, Regent of Morrow — black coat, white collar, grey gloves — holding a folded paper as though it were a gift.`,
        choices: [{ label: '[Hear him out]', next: 'crane' }],
      },
      crane: {
        speaker: 'npc_crane',
        text: `"Captain Vane. I'm glad. They won't take orders from me, you see. They've been standing here waiting for the only voice they know."

He unfolds the paper. Your commission, restored: your rank, your seal.

"I'm not asking you to wear it." He means the Crown. "I know your history with it. I'm asking you to stand where you stood before. At a door. A young man will come up these stairs soon — a pliable boy, with the right sort of blood. Your men will see him crowned. You will see that no one interrupts." A small, reasonable smile. "It's the work you're best at."

Behind him, the dead men of the King's Shield wait to hear what their captain will say.`,
        choices: [
          { label: () => `[Take the commission] Gain 150 Gold. Become Cursed — ${curseName('oathbreaker')}.`, fx(g) { g.gainGold(150); curse(g, 'oathbreaker'); return 'accept'; } },
          { label: '[Tear it up]', next: 'refuse' },
          { label: "[Order the Shield to seize him] Fight the dead Royal Guard. Win a relic.", async fx(g) { g.unlockLore('lore_story_roll'); return fight(g, 'shield', { resume: 'seized', reward: { relic: 'random' } }); } },
        ],
      },
      accept: {
        text: `You take the paper. It is heavier than it looks.

"Good man," says Crane, and forty helms turn back to the stair in perfect unison, and you feel it — the old comfort, like a coat that still fits. Orders. A door. No need to decide.

He pays you from his own purse, generously, the way a man feeds a dog he means to keep.

It's only later, alone, that you remember a boy at a graveside with the king's hand shaking on his head. *Do not let them crown another.* You turn the commission over and over, and your hands, you notice, are shaking too.`,
        choices: [leave('lore_story_roll')],
      },
      refuse: {
        text: `You tear the commission in half, and in half again, and let it go into the ash.

Crane watches the pieces fall. "A pity," he says, without heat, and steps back between the ranks and is gone. He knows the palace better than you ever did.

The dead men wait.

"Hollis," you say. "Ashfall. When I took the watch at dusk — did anyone go into his chamber after?"

"No, Captain." The tallow face is puzzled. "The priest went in before your watch. Carried out before your watch, God rest him. After that, no one. Not all night. We'd have seen."

*No one.* You stood at that door eight hours, certain someone was in there with him.`,
        choices: [
          { label: '[Give them a new order: "Stand down. Go home."] Remove a card from your deck.', async fx(g) { await g.removeCardChoice(1); return 'release'; } },
          { label: '[Leave them their post] Gain 6 Max HP.', fx(g) { g.gainMaxHp(6); return 'hold'; } },
        ],
      },
      release: {
        text: `"King's Shield," you say, and forty dead men come to attention. "Your watch is ended. Stand down. Go home."

For a long moment nothing happens. Then old Corrin, at the end of the rank, lowers his halberd and sets it against the wall, carefully, the way he always did, because of his knee. Then Brand. Then the twins. Hollis last.

They don't march out. They simply aren't there any more, one by one, the way breath fades from cold glass. The Gallery of Shields is empty for the first time in ninety-one years.

You stand alone in it, and it is very quiet, and you think: *someone should have said that to me.*`,
        choices: [leave('lore_story_roll')],
      },
      hold: {
        text: `"Hold the gallery," you tell them. "Against the Regent. Against his boy. Against anyone who comes up those stairs to put that thing on a head."

"Sir," says Hollis, and forty halberds grind on the stone together, and something in your chest grinds with them.

It is an order. You know that. You are doing to them what was done to you — leaving them at a door. But it is *your* order this time, given for a reason you understand, and when you walk away down the gallery you can feel them at your back, solid as a wall.

You'll come back and relieve them, when it's over. You add it to the list.`,
        choices: [leave('lore_story_roll')],
      },
      seized: {
        text: `"Seize him," you said, and they would not. Crane's last word had been louder than yours, or more recent. So you fought your own men up and down the Gallery of Shields while the Regent walked away.

They fought as you trained them. You won because you trained them.

Hollis is the last. He sits against the wall with his helm off, his tallow face calm.

"Captain," he says. "Ashfall. You kept asking, after. Who went in."

"I remember."

"No one, sir. The priest, before your watch — they carried him out at dusk, God rest him. After that, no one. All night." His voice is going. "Just the old man in there. Talking to himself."`,
        choices: [leave('lore_story_roll')],
      },
    },
  }),

  heirBeat('knight', 5, {
    title: 'The Unopened Door', art: 'scene_court',
    pages: {
      start: {
        text: `You know the way. Your feet know it: the servants' stair, the turn by the tapestry of the Founder's hunt, the long gallery. Forty-one candles, still burning. They have burned through every repetition of this night.

And the door. Oak and iron. Smaller than you remember; doors are, when you come back to them.

There is no guard outside it. You were the guard. Somewhere, in some other turn of the hour, you are standing with your back against this wall — or you are here, and the wall is empty, and that is the only difference that has ever mattered.

Through the oak, your father's voice. *Please.*

You put your hand on the latch. It is cold. It moves.`,
        choices: [{ label: '[Open the door]', next: 'room' }],
      },
      room: {
        text: `There is no assassin. No physician, no poisoner, no shadow behind the arras. Only an old man in a nightshirt, kneeling on the floor by the bed with his forehead pressed to the frame — and on his head the Crown: iron, black, its empty socket like a missing tooth.

A stool has been drawn up beside the bed, close, the way one draws a stool to a sickbed. The candle on the table leans toward it. The air beside it is cold as a cellar.

He is not praying to God. He is talking to the thing on his head.

"Please. You've had ninety-one years of me. There's nothing left — the heart's gone, you can barely hold on. Let go. Let me go. I'm so tired."

The Crown says nothing. You can feel it saying nothing, the way you feel weather.

You stood eight hours outside an unlocked door. The only voice you ever heard in here was his, and the only one he was begging was the thing on his head.`,
        choices: [{ label: '[Go to him]', next: 'father' }],
      },
      father: {
        text: `You kneel beside him and take his hand. It is thin as a bundle of kindling.

His eyes go first, briefly, to the stool by the bed, as if to make sure of someone there. Then they find you. You will never know whether this is the true night or an echo the Crown has kept, the way a book keeps a pressed flower. But he sees you.

"Aldous," he says. "You came in."

"I'm sorry. I'm so sorry. I should have—"

"You came in." He is smiling. You have never once seen him smile. "Listen. Don't let them—"

"I know, Father. Don't let them crown another." You hold his hand against your chest. "I'm not going to obey that. I'm done obeying. I'm going to swear you something better."`,
        choices: [
          { label: () => `["I will open every door."] Obtain ${relicName('kings_signet')} (shops 25% cheaper, richer elites).`, fx(g, d) { d.oath = 'door'; giveRelic(g, 'kings_signet', 'rare'); return 'oath'; } },
          { label: '["No one dies alone while I keep watch."] Gain 10 Max HP.', fx(g, d) { d.oath = 'watch'; g.gainMaxHp(10); return 'oath'; } },
          { label: () => `["I choose my own oaths now."] Obtain ${relicName('severed_oath')} (2 Might each combat; lose 1 HP each turn).`, fx(g, d) { d.oath = 'choose'; giveRelic(g, 'severed_oath', 'rare'); return 'oath'; } },
        ],
      },
      oath: {
        text: (g, d) => `${{
          door: '"I will open every door," you say. "Every one I\'m set to guard. I\'ll go in."\n\nHe works his signet ring off his finger, slowly, and presses it into your palm. "Then you\'ll want this," he says. "It opens most of them."',
          watch: '"No one dies alone," you say, "while I keep watch. Not ever again. Not on my side of a door."\n\nHe closes his thin fingers round yours as hard as he can, which is not hard at all.',
          choose: '"I\'ll swear my own oaths now," you say. "Not yours. Not Crane\'s. Not the Crown\'s. Mine — and I\'ll know why I keep them."\n\nSomething that has been pulled tight in you for twenty years gives way, with a sound like a cord cut.',
        }[d.oath || 'watch']}

The king closes his eyes. "That's better," he says. "That's much better than mine."

At midnight the begging does not come, because he has stopped begging. On the table the candle flares once, high and bright, as though someone had leaned close to hear. He dies with his hand in yours. The Crown rolls from his head across the stone and comes to rest against your boot — and for the first time in your life you do not do what is expected of you. You step over it.

When you look back, the room is grey and empty and a hundred years old, the bed is dust, and down the long gallery the candles have all gone out.`,
        choices: [leave('lore_story_unopened', '[Go]')],
      },
    },
  }),
];

// ================================================================== THE WITCH
const WITCH = [
  heirBeat('witch', 1, {
    title: 'The Plague Cart', art: 'scene_road',
    pages: {
      start: {
        text: `The cart comes out of the fog behind a mule too tired to be afraid of you. It is stacked with bodies under a tarpaulin. The carter walks beside it with a scarf over his mouth and a lit brand in his fist.

"Blight," he says, before you can ask. "Out of Sallow Cross. Regent's orders: all the grey ones to the pits." He looks at your green-stained fingers and spits. "You're the witch. Don't touch 'em."

You touch them.

The man on top is grey from the collarbones up, the colour of old tallow. His skin is cool, but not cold. You thumb back an eyelid. The eye moves. Slowly — like something swimming up through very deep water — it finds you.`,
        choices: [{ label: '[Examine them properly]', next: 'exam' }],
      },
      exam: {
        text: `No pulse. No breath: you hold a knife blade to his lips and it does not fog. And yet no stiffness, no smell, no bloat. You prick his finger, and the blood comes dark and unhurried, and does not clot, and does not stop.

The woman under him is the same. And the child.

You have read every physician in the Ashgrave library and half the forbidden ones. None of them describe this, because there has never been a word for it. These people are not sick. They are not dying.

They are *stopped*, like clocks. Something came for them and could not get in, and it is standing in the doorway of each of them, waiting.

"Well?" says the carter. "Can you cure 'em, witch?"

For the first time in your life, you are not sure what the word means.`,
        choices: [
          { label: '[Draw off the grey blood] Lose 3 HP. Choose a card to add to your deck.', req: hpReq(3), async fx(g) { hurt(g, 3); await offerHeroCards(g, { match: /rot|brew|draught|wither/i, title: 'What the grey blood teaches' }); return 'sample'; } },
          { label: '[Pay him to bury them instead] Lose 30 Gold. Remove a card from your deck.', req: goldReq(30), async fx(g) { g.loseGold(30); await g.removeCardChoice(1); return 'bury'; } },
          { label: '[Let him go on to the pits]', next: 'pits' },
        ],
      },
      sample: {
        text: `You fill three vials with the grey blood while the carter swears at you. When you're done, the man on top of the pile is still looking at you.

You lean down and tell him, because someone should: "I'm going to find out what this is."

His lips move. No breath behind them, so no sound — but you have read lips across sickrooms since you were twelve years old, and you know what he says.

*Let me.*

The cart creaks away into the fog. You stand in the road with the vials warm in your fist, trying to decide whether he meant *let me go* or *let me be*, and whether, for him, there is any difference.`,
        choices: [leave('lore_story_stopped')],
      },
      bury: {
        text: `"Bury them," you say, and put the coins in his palm. "Not the pits. Earth. Deep, in the churchyard at Sallow Cross. Mark the graves."

He looks at the silver, and at you. "They ain't dead, witch."

"Then the earth won't hurt them."

He goes. You watch the cart into the fog and couldn't say why it felt right — only that your mother used to kneel in her garden with her hands in the soil to the wrist and say that earth was patient, and knew things, and would sort out what people couldn't.

You haven't heard her say it, even in memory, for eighteen years. You wonder why it comes back now.`,
        choices: [leave('lore_story_stopped')],
      },
      pits: {
        text: `You step aside. The carter clicks his tongue at the mule, and the cart groans past, and the grey man on top turns his eyes to follow you for as long as he can.

An hour later, from the next rise, you see the smoke of the pits: a thick, slow column going straight up into the pewter sky, too heavy to drift.

It isn't quite the smell of burning flesh. You know that smell. This is stranger — something held, and refused, and burning anyway.

You write in your notebook, in a hand you have to steady: *They are not dying. They are being prevented.* Then you underline *prevented* until the nib tears the page.`,
        choices: [leave('lore_story_stopped')],
      },
    },
  }),

  heirBeat('witch', 2, {
    title: "Mother's Garden", art: 'scene_ruins',
    pages: {
      start: {
        text: `You would know the wall anywhere: the lichen shaped like a running hare, the gap where you used to climb. Your mother's garden at Marrow House. You haven't come within ten miles of it since they told you she was dead.

The house is a shell. The garden is not.

It is blooming — in rot. Blackcap mushrooms as broad as hands. Corpse-candles glowing pale in the rosemary. Widow's-lace strangling the sundial. In a kingdom where nothing has grown properly in a century, your mother's beds are dying riotously, beautifully, the way the old herbals say forests once did: falling down to feed what comes next.

In the potting shed, in the seed drawer marked FOR ISSY, there is a letter.`,
        choices: [{ label: '[Read it]', next: 'letter' }],
      },
      letter: {
        text: `*My Issy,*

*They will have told you I'm dead. Don't believe them. They buried an empty box; I watched from the window.*

*I took the grey sickness from the girl at the mill. It didn't feel like an illness, love. It felt like a door opening. Like the end of a long winter. And then my brother came, and wept, and would not let me go through.*

*They are taking me down tonight, below the palace. He says I'll be safe there. He says I'll be kept.*

*Water the foxgloves. Don't let them make you afraid of rot.*

*— Mother*

The letter is dated the ninth of Thawmonth. Her funeral was on the second.`,
        choices: [
          { label: () => `[Take the seed from her foxglove bed] Obtain ${relicName('mothers_seed')} (+1 Max HP per combat won).`, fx(g) { giveRelic(g, 'mothers_seed'); return 'seed'; } },
          { label: '[Water the foxgloves] Heal 20 HP. Gain 3 Max HP.', fx(g) { g.healOut(20); g.gainMaxHp(3); return 'tend'; } },
        ],
      },
      seed: {
        text: `In the bed beneath the window, where her foxgloves were, something has gone to seed: a black pod, split, holding one pale kernel no bigger than a fingernail. It is warm. It is the only warm thing you have touched since you crossed the wall.

You don't know what it is. You know she planted it.

You fold the letter around it and put both inside your shirt, against your skin, and go out through the gap in the wall the way you did when you were small and she would call after you, laughing, not to tear your hem.

No one calls after you. But as you go, the rot in the beds stirs all together, as though a wind had passed over it.`,
        choices: [leave('lore_story_elowen')],
      },
      tend: {
        text: `You water the foxgloves. There's a well and a bucket, and you do it the way she taught you: at the root, never the leaf, slowly, so the ground can drink.

They are dying, all of them, gently, brown at the petal-edges. You have spent eighteen years of your life trying to stop exactly this.

You sit on the edge of the bed with your muddy hands in your lap and let them die. It is the most peaceful hour you have spent since you were twelve years old.

*Don't let them make you afraid of rot.* You read the letter again, and again. When you stand, you are lighter than when you sat, and you don't know why.`,
        choices: [leave('lore_story_elowen')],
      },
    },
  }),

  heirBeat('witch', 3, {
    title: 'The Witchfinder', art: 'scene_forest',
    pages: {
      start: {
        text: `They have been on your trail three days. You know it the way you know weather: birds going quiet in the valley behind you, the smoke of a fire that isn't yours.

On the third night you stop running. You find a ring of birches gone white with blight and wait in the middle of it, and they come out of the trees as you knew they would. Men in grey. Crossbows. Brands burned into the backs of their hands. And with them, walking slowly, a long-jawed man with scrubbed hands and the Witchfinder General's chain.

"Isolde Marrow," says Mattias Grall. "Princess of the Blood. Rot-witch. Apostate. I've burned a great many of your sisters, and not one could tell me what I wanted to know."`,
        choices: [
          { label: '[Ask what he wants to know]', next: 'talk' },
          { label: () => `[Strike first] Fight the Witchfinder's men. Win ${relicName('witchfinders_brand')}.`, async fx(g) { g.unlockLore('lore_story_charter'); return fight(g, 'hunters', { resume: 'fought', reward: { relic: 'witchfinders_brand' } }); } },
        ],
      },
      talk: {
        speaker: 'npc_grall',
        text: `"Why," says Grall. "Rot, of all crafts. Healers I understand. Hedge-charmers. But you *cultivate decay*. You breed the thing that ends things."

"Because it's the only honest magic there is," you say. "Everything else pretends."

He nods, as if you've confirmed something. "Our Order was founded by the second king. His charter hangs in our chapter house. *Whoso brings rot into the realm brings Death back across the border, which the Crown hath shut.* That's why we burn you. Not for poisons. For opening the door." He draws his blade. "This land was saved from dying, witch. And your kind keep trying to let it back in."

*Back* in. Not *in*. Back.

As if it lived here once. As if it was exiled.`,
        choices: [
          { label: () => `[Fight] Fight the Witchfinder's men. Win ${relicName('witchfinders_brand')}.`, async fx(g) { g.unlockLore('lore_story_charter'); return fight(g, 'hunters', { resume: 'fought', reward: { relic: 'witchfinders_brand' } }); } },
          { label: '[Slip into the bog while he preaches] Lose 8 HP.', req: hpReq(8), fx(g) { hurt(g, 8); return 'escape'; } },
        ],
      },
      fought: {
        text: `When it's done, the birch ring is full of grey men lying in the leaves, and Grall is gone — a horse breaking through the far thicket, his voice carrying back: "Next time, witch."

There will be a next time. There always is, in Morrow.

You kneel by one of his men and turn over his hand. The brand on it is a circle, closed: a crown with no gap in it. Beneath, tiny, the motto of the Order. NOTHING ENDS.

You have seen that brand on women's shoulders in the ash-pits. You always thought it meant *the Order never forgets.*

It doesn't. It's a law. The Crown's law. And all your life, without knowing it, you have been breaking it.`,
        choices: [leave('lore_story_charter')],
      },
      escape: {
        text: `You let him preach. Men like Grall always want to finish the sermon. And while he does, your hand finds your satchel and cracks a vial of marsh-gas between two fingers, and the birch ring fills with green.

The bog takes you to the waist, then the chest. Something in it bites. You come up a mile downstream, bleeding, half drowned, alive, with his voice still in your ears.

*Death back across the border, which the Crown hath shut.*

You sit shaking on the bank and think of your mother's letter. *Like a door opening. Like the end of a long winter.* The Crown didn't save Morrow from dying.

It locked death out. And death has been standing at the door ever since, waiting to come home.`,
        choices: [leave('lore_story_charter')],
      },
    },
  }),

  heirBeat('witch', 4, {
    title: 'The Ledger of the Kept', art: 'scene_crypt',
    pages: {
      start: {
        text: `The Regent's archive lies three floors under the Chancery. You get in the way you have got into every locked library of your life: a hairpin, a bribe, and a patience that frightens people.

Shelves without end. Tax rolls, petitions, ninety-one years of a kingdom that never changed. And at the far end, in an iron case, chained to its lectern like a chapel Bible, a single book bound in grey leather.

THE LEDGER OF THE KEPT.

Names. Thousands of them, in columns ruled in red: *Name. Station. Ailment. Brought below by. Status.* And in the last column, page after page after page, in a dozen hands across a century, one word.

*Kept.*`,
        choices: [{ label: '[Find her]', next: 'page' }],
      },
      page: {
        text: `You know which year. Your hands find it before your eyes do.

*Elowen Marrow. Princess of the Blood. Grey sickness. Brought below by the King's own hand. Kept.*

And in the margin, in newer ink — a tidy, cold, clerical hand:

*Still kept. Continues to ask for her daughter. — S.C.*

Severin Crane. He has been down there. He has *seen* her. He wrote down that she asks for you, and then he closed the book and went upstairs and had his supper.

Footsteps on the stair above you. A lantern, swinging. The archivists keep late hours, and the Regent keeps guards.`,
        choices: [
          { label: () => `[Tear out her page] Obtain a random relic. Become Cursed — ${curseName('grief')}.`, fx(g) { g.obtainRelic(); curse(g, 'grief'); return 'tear'; } },
          { label: '[Burn the Ledger] Fight the archive guards. Win a relic.', async fx(g) { g.unlockLore('lore_story_ledger'); return fight(g, 'archive', { resume: 'burned', reward: { relic: 'random' } }); } },
          { label: '[Stay, and read every name] Upgrade 2 random cards.', fx(g) { g.upgradeRandom(2); return 'read'; } },
        ],
      },
      tear: {
        text: `The page comes out of the binding with a sound like a held breath let go. You fold it small and put it inside your shirt, beside her letter, and you are on the stair before the lantern turns the corner.

You don't run. Running is for people who are surprised.

Out in the ash-dark streets of Ashgrave you stop under a dead lamp and read it again. *Continues to ask for her daughter.*

You have been grieving for eighteen years the wrong way round. You mourned her as gone. All that time she was here — beneath the city, beneath your feet, asking.

The grief turns over in you like a key in a lock, and you find you are not crying. You are planning.`,
        choices: [leave('lore_story_ledger')],
      },
      burned: {
        text: `The guards lie among the tax rolls. You take a lamp from the wall and empty it over the grey book, and set it alight, and watch the names curl.

It doesn't matter. You know it even as you do it. Burning the Ledger unkeeps no one; it only means no one will remember they were kept.

So before the flames reach the margins, you tear out one page — hers — and beat out the edge where it caught, and put it in your shirt.

You climb the stair with smoke behind you, and feel the whole city above and the whole dark below, and her, somewhere in it. *Continues to ask for her daughter.*

*I'm coming, Mother.* You don't know yet what you'll do when you get there.`,
        choices: [leave('lore_story_ledger')],
      },
      read: {
        text: `You read them all. It takes most of the night. The archivist with the lantern finds you sitting cross-legged under the lectern with the book in your lap, and something in your face sends him back up the stairs without a word.

A blacksmith, kept for a fever. A midwife, kept for age. A bishop. Children — so many children. A stable-boy kept *by the Chancellor's leave*, because the Chancellor liked the way he groomed the greys.

None of them got to die. All of them are under this city.

When you close the book your hands are steady and your mind very clear, the way it goes before a difficult distillation. Somewhere beneath you, your mother is asking for you. Somewhere beneath you, so are everyone else's mothers.`,
        choices: [leave('lore_story_ledger')],
      },
    },
  }),

  heirBeat('witch', 5, {
    title: 'What the Rot Is For', art: 'scene_well',
    pages: {
      start: {
        text: `You follow the rot.

It is the only map you trust. Everyone knows the Blight is thickest in Ashgrave; no one has noticed that it runs in *lines*, like roots, and that every line runs down — toward the palace, toward the hill beneath the palace.

You find the oldest well in the city, in the Queen's Court, its mouth choked with grey moss and pale, beautiful toadstools. You climb down a long way. The rot grows thicker, softer, warmer. It smells — you stop on the rungs, astonished — like spring. Like a forest floor after rain. Like your mother's garden on the last morning.

At the bottom, an iron grate. And beyond it, in the dark, a great many people standing very still.`,
        choices: [{ label: '[Go to the grate]', next: 'grate' }],
      },
      grate: {
        art: 'scene_undercroft',
        text: `They fill the dark as far as your lantern reaches, and farther: a century of the dead who never got to die, shoulder to shoulder in nightshirts and Sunday best and grave-clothes, grey as the man on the plague cart, every one with their eyes open.

Close to the grate, in a blue dress you remember from the last day you saw her, stands your mother.

"Issy," she says. Her voice is dust. "You got tall."

You cannot speak. You put your hand through the bars and she takes it. Her hand is cool, and not cold.

"The rot, love. You've seen it. It isn't killing the land. It's the land *trying to finish*. A hundred years of dying, all stopped up. It wants to go down into the dark and come back up green. That's all death ever was." She smiles. "I'd have told you when you were twelve. They didn't let me."`,
        choices: [{ label: '["What do you want?"]', next: 'choice' }],
      },
      choice: {
        art: 'scene_undercroft',
        text: `"I want to go through," she says. "I've wanted to for eighteen years. I'm so tired, Issy. We all are."

Behind her a ripple runs through the standing dead, as if a wind had found them. A sigh. A thousand sighs.

You have spent your life trying to cure the Blight. A hundred remedies, and every one of them, you see now, was a way of saying *not yet*. Of saying *stay*.

You could say it still. You're a rot-witch; you know the shape of what holds her. You could try to bring her up — kept, but in the light, at your side, forever.

Or you could promise her the hardest thing you have ever done, which is to open the door, and let her die.`,
        choices: [
          { label: '[Promise her] Remove 2 cards from your deck.', async fx(g) { await g.removeCardChoice(2); return 'promise'; } },
          { label: '[Ask for one more hour first] Heal to full.', fx(g) { healFull(g); return 'hour'; } },
        ],
      },
      promise: {
        text: `"I'll let you go," you say. "I'll find the door, and I'll open it. For all of you." Your voice cracks on it, and you let it. "I'm going to let you die, Mother."

"There's my girl," she says.

You let go of her hand. It is the hardest thing your fingers have ever done.

Climbing back up the well, you find that the toadstools on the walls have opened their gills, and the air is full of slow, glittering spores drifting upward into the ash, like seeds on a wind — like snow falling the wrong way.

You have spent your whole life trying to cure this. You know now what the rot is for.

It is for *afterward*.`,
        choices: [leave('lore_story_rot', '[Climb]')],
      },
      hour: {
        text: `"Not yet," you say. "Not — just give me an hour. Then I'll let you go. I swear it."

So she gives you an hour. You sit on the wet stone with your arm through the bars to the shoulder, and she tells you about the foxgloves, and you tell her every terrible thing you've done since you were twelve, and she laughs at the worst of them.

At the end of the hour you take your hand back, because you promised.

"I'll open the door," you tell her. "I'll let you die. All of you."

"I know, love."

Climbing back up the well, the toadstools have opened their gills, and the air is full of slow, glittering spores drifting up into the ash, like snow falling the wrong way. You know now what the rot is for. It is for *afterward*.`,
        choices: [leave('lore_story_rot', '[Climb]')],
      },
    },
  }),
];

// ================================================================== WREN
const MASKS_W1 = {
  boy: { name: 'laughing boy', verb: 'laugh' },
  bride: { name: 'weeping bride', verb: 'weep' },
  king: { name: 'king', verb: 'command' },
};
const WREN = [
  heirBeat('wren', 1, {
    title: 'The Mask-Maker', art: 'scene_village',
    pages: {
      start: {
        text: `The sign over the door is a carved face, smiling, its paint gone grey. You know this shop. The king brought you here when you were four, wrapped in his cloak, and a man with sawdust in his beard measured the blank of you with calipers and made you your first face.

He is still here, sitting at his bench with his chin on his chest, silvered by the Blight like frost on a window. Not dead, quite. His eyes follow you. That's Morrow.

The masks on the walls follow you too. Foxes, saints, kings, a weeping bride, a laughing boy. And they are *whispering*, soft as moths against glass.

*Try me,* they say. *Try me. You haven't got one of your own.*

"Hello," you tell them. "Which of you is the friendliest?"`,
        choices: [
          { label: '[Try the laughing boy]', fx(g, d) { d.mask = 'boy'; return 'pull'; } },
          { label: '[Try the weeping bride]', fx(g, d) { d.mask = 'bride'; return 'pull'; } },
          { label: '[Try the king]', fx(g, d) { d.mask = 'king'; return 'pull'; } },
        ],
      },
      pull: {
        text: (g, d) => { const m = MASKS_W1[d.mask] || MASKS_W1.boy; return `You lift the ${m.name} from its peg. Lime-wood, thin as a leaf. Out of old habit you turn your back on the mirror, and put it on.

For one heartbeat you have a face.

Not yours; you haven't got one. But a face, with a mouth that knows how to ${m.verb}. And with it comes something you have never felt: a *pull*. Like a tide. Like a hook under the breastbone, drawing you east — toward Ashgrave, toward the hill under the palace, toward a hollow place exactly the shape of—

You tear it off. You are on your knees. The masks have gone silent.

You grew up a corridor away from the Crown and never felt it once. But it had a head, then.

The mask-maker is looking straight at you. His grey lips move. *You've grown.*`; },
        choices: [
          {
            label: (g, d) => ({
              boy: '[Keep the laughing boy] Choose a card to add to your deck.',
              bride: '[Keep the weeping bride] Gain 7 Max HP.',
              king: `[Keep the king] Obtain a random relic. Become Cursed — ${curseName('crowns_whisper')}.`,
            }[d.mask] || '[Keep it]'),
            async fx(g, d) {
              if (d.mask === 'bride') g.gainMaxHp(7);
              else if (d.mask === 'king') { g.obtainRelic(); curse(g, 'crowns_whisper'); }
              else await offerHeroCards(g, { match: /mask|shift|mimic/i, title: 'A borrowed face' });
              return 'keep';
            },
          },
          { label: '[Hang it back, and sit with him a while] Heal 12 HP.', fx(g) { g.healOut(12); return 'sit'; } },
        ],
      },
      keep: {
        text: (g, d) => `${{
          boy: 'You tie the laughing boy\'s cords at the back of your head. It sits wrong, a little, the way borrowed boots do. But when you catch yourself in the mirror on the way out, the boy is grinning, and for a moment you almost believe it is at something you said.',
          bride: 'The bride\'s lime-wood tears are carved so finely they catch the grey light like water. You tie her on. She is heavy with a grief that isn\'t yours, and somehow, wearing it, you feel steadier — as if someone had finally given your sorrow a shape to sit in.',
          king: 'You tie on the king, and the pull comes back at once, gentler now, patient, coaxing — *east, east, come home* — and you find you can bear it if you don\'t listen too closely. The king\'s carved mouth is stern. Behind it you are smiling, and you don\'t know why, and that frightens you more than the pull did.',
        }[d.mask] || ''}

"Thank you," you tell the mask-maker, and touch his silvered hand. It is cool, not cold. On your way out the masks say nothing at all, which feels, somehow, like respect.`,
        choices: [leave('lore_story_first_mask')],
      },
      sit: {
        text: `You hang it back on its peg with shaking hands. Then you pull the other stool up to the bench and sit with the mask-maker a while, because he made your first face, and no one else is going to.

"I still have it," you tell him. "The first one. The owl. It's too small now. I keep it anyway."

His eyes move to you, slow as honey. You think he's pleased. It's hard to tell, with faces. That has always been the trouble with them.

When you go, you leave the door open, so the ash can come in, and the light, such as it is.`,
        choices: [leave('lore_story_first_mask')],
      },
    },
  }),

  heirBeat('wren', 2, {
    title: 'The Lady in the Mere', art: 'scene_water', speaker: 'npc_maren',
    pages: {
      start: {
        text: `The mere lies flat as pewter under the pewter sky. The reeds stand in it without moving. No wind, no birdsong, no frogs. On the far shore the drowned bell-tower of the abbey leans out of the water like a man looking for something he dropped.

A woman is standing on the water.

She wears a queen's gown, soaked black, and her hair moves around her as if she were still under the surface. Where her hem trails, the mere does not ripple.

She is looking at you. Not at your mask — *through* it, at the smooth blank underneath, the way nobody ever does.

"There you are," says Queen Maren. "My little stolen thing."`,
        choices: [
          { label: '["Stolen from where?"]', next: 'where' },
          { label: '["Did you know me?"]', next: 'know' },
          { label: '[Take off your mask]', next: 'face' },
        ],
      },
      where: {
        text: `"Stolen from where?" you ask. "From whom? I was found on the steps. Everyone says so. Found."

The queen's smile is sad, and very old for so young a face. "Things are always *found*," she says, "by people who don't ask who lost them."

She drifts closer across the water. You ought to be frightened. You are mostly curious, which has always been your trouble.

"I can't tell you. Not yet. If I tell you here, it will hear, and it will come for you before you're ready. It has been listening for you since the night the old man died."

"What has?"

She only looks east, toward Ashgrave.`,
        choices: [{ label: '[Wait]', next: 'locket' }],
      },
      know: {
        text: `"Did you know me?" you ask. "Before?"

"Oh," says the queen, "I knew you before you were *you*. I carried you out of Ashgrave in the dark, in one closed hand, and you were so small and so bright I had to wrap you in my veil so the guards wouldn't see you shining."

Her face changes. The water darkens around her.

"No. No more. If I say more, it will hear, and it will come for you before you're ready."

"What will?"

She only looks east, toward Ashgrave, where the sky is the colour of a closed eye.`,
        choices: [{ label: '[Wait]', next: 'locket' }],
      },
      face: {
        text: `You don't know why you do it. You have never done it in front of anyone but the king. You untie the cords and lower your mask, and stand on the shore with nothing where a face should be: smooth skin, pale as the inside of a shell.

The queen makes a sound like someone touching a bruise.

"Oh, look at you. They never gave you one. I hoped he would. I hoped the old man would know what you needed."

"He gave me masks," you say. "Lots."

"Masks aren't faces, darling." She reaches out and stops an inch from your cheek, as if there were glass between you. "I can't tell you. If I say it here, it will hear."

"What will?"

She only looks east.`,
        choices: [{ label: '[Wait]', next: 'locket' }],
      },
      locket: {
        text: `She lifts a chain from around her neck — a locket, green with the mere — and holds it out across the water.

"Keep this close. When you go to Ashgrave — and you will, little one; you can feel it pulling, can't you? — wear it against your heart."

You take it. It is cold and wet and weighs nothing. Inside, where a portrait should be, there is only a small round hollow, empty, shaped to hold something no bigger than a robin's egg.

When you look up, she is sinking, the black gown spreading on the water like spilled ink.

"Come to my rooms in Ashgrave," she says, as the mere reaches her lips, "when you're ready to hear it. I'll be waiting where I took you."

Then the mere is flat, and you are alone with the reeds, and a question you have never been brave enough to ask.`,
        choices: [{ label: () => `[Wear the locket] Obtain ${relicName('maren_locket')} (Ward and Plating each combat).`, end: true, fx(g) { giveRelic(g, 'maren_locket'); g.unlockLore('lore_story_maren'); } }],
      },
    },
  }),

  heirBeat('wren', 3, {
    title: 'The Antlered Court', art: 'scene_forest',
    pages: {
      start: {
        text: `The Weeping Wood goes quiet around you, and then quieter, and then the trees are not trees.

They are *people*: tall, thin, bark-skinned, wearing crowns of fungus and gowns of moss, standing so still between the black trunks that you walked past a dozen before you noticed. Their eyes are the pale gold of fox-fire. There are hundreds.

In the clearing ahead, on a throne of living roots, sits a thing with a stag's skull for a head and antlers that branch up into the canopy and become it. The Antlered King. He is older than the wood; you feel it like heat from a stove.

He rises. The whole court rises with him.

Then, with a sound like a forest falling, every one of them goes down on one knee — before you.`,
        choices: [{ label: '[Ask them why]', next: 'why' }],
      },
      why: {
        text: `"Heartwood," says the Antlered King. His voice is wind in a dead oak. The court takes it up, a whisper through a thousand leaves. *Heartwood.*

"I think you've got the wrong person," you say. "I'm a ward. A foundling. I haven't even got a face."

"You have *her* face," says the King, "which is no face. She never needed one. She was the hill and the rot and the turning." The antlers creak. "Every root in this wood turned toward you when you crossed into it, like flowers to the sun. We have waited four hundred years to kneel to you again."

And the terrible thing — the thing you will lie awake over — is that it feels *right*. Like a bone sliding into its socket. Like coming in from the cold.

You have been lonely your whole life. You did not know it until this moment, when it stopped.`,
        choices: [
          { label: () => `[Accept their homage] Obtain ${relicName('antler_shard')} (Thorns and Plating each combat).`, fx(g) { giveRelic(g, 'antler_shard'); return 'accept'; } },
          { label: '[Refuse it] Choose a card to add to your deck.', async fx(g) { await offerHeroCards(g, { rarity: 'uncommon', title: 'Nobody\'s Heartwood' }); return 'refuse'; } },
        ],
      },
      accept: {
        text: `You don't know the right words, so you use the only ones you have. "Thank you. Please — get up."

They rise. The Antlered King stoops, and stoops, until the stag's skull is level with your mask, and with a crack like a branch breaking he snaps a tine from his own antlers and lays it in your hands.

"For when you go home," he says.

"Where's home?"

The fox-fire eyes regard you for a long time. "Ask the queen in the water. Ask the fool with the bells. Ask the iron thing on the hill that wants you back." He settles onto his throne of roots. "But do not believe the iron thing. It was never your home. It was your cage."

When you walk out of the wood, the trees lean after you, all of them, the whole way.`,
        choices: [leave('lore_story_heartwood')],
      },
      refuse: {
        text: `"No," you say, and your voice shakes, and you hate it. "Get up. I'm not — I'm *Wren*. I'm nobody's Heartwood. I don't belong to you."

The court rises, slowly. There is no anger in it. Only a patience as vast as winter.

"No," agrees the Antlered King. "You do not belong to us. We belong to you. That is the difference between us and the iron thing on the hill." The great skull tilts. "Go, then, little heart. We will be here. We have been here a long time."

You run until the wood is behind you and you are out on the cold moor, gasping, alone. You pull off your mask and press your blank face into the heather, and you cannot tell whether what you feel is terror or homesickness.

It is both. You think it may always have been both.`,
        choices: [leave('lore_story_heartwood')],
      },
    },
  }),

  heirBeat('wren', 4, {
    title: 'The Empty Socket', art: 'scene_court', sets: ['knows_heart'],
    pages: {
      start: {
        text: `The royal treasury of Ashgrave has been looted three times since Ashfall, and the Regent's men no longer guard it. What's left is what no one could carry or sell: tapestries rotting on the walls, and at the end of the long vault, a portrait.

*The Crown of Morrow*, says the brass plate. No king wearing it. Only the Crown, painted larger than life on black velvet by someone who loved it, or feared it.

Iron, black, eight-pointed. And at the brow the socket — painted not empty, but full. The painter worked from an older record.

The gem is violet. Violet shot through with silver, like moth-wings, like frost on a dark window.

They are your colours. The king had every one of your masks painted in them, since you were four years old.`,
        choices: [{ label: '[Go closer]', next: 'hum' }],
      },
      hum: {
        text: `As you walk toward the portrait, something in the palace above begins to *hum*.

It is low — more in your teeth than your ears — and it comes from the throne room. From the Crown, lying on the floor where it rolled on Ashfall night, which no one has been able to pick up and keep.

It hums when you step closer. It falls silent when you step back. Closer: hum. Back: silence.

*Like a dog that hears its master on the stair.*

Under your mask, on your smooth and featureless face, you feel something you have never felt: a warmth, a throb, right in the middle of your brow — exactly where, on the painting, the gem sits in the iron.

You sit down on the cold floor very suddenly. You have always wondered what you were. You would give anything now to go back to wondering.`,
        choices: [{ label: '[Look at the case beneath the portrait]', next: 'splinter' }],
      },
      splinter: {
        text: `Beneath the portrait, in a glass case smashed by looters, lies the only piece of the Crown ever to leave it: a single iron prong, bent back and snapped, as if someone had forced the gem out with a blade and broken the setting.

The card beside it reads, in faded ink: *Recovered from the Queen's apartments, the night of the theft. The jewel was not found.*

The Queen's apartments. *My little stolen thing.*

You understand three things at once, the way you understand a fall when you are already falling. The Crown is missing its heart. The Crown wants its heart back. And the Crown has begun to hum because its heart just walked into the room.

You know now what could break a thing like that. Or make it whole.`,
        choices: [
          { label: () => `[Take the iron prong] Obtain ${relicName('crown_splinter')} (+1 Energy each turn; you can no longer Rest).`, end: true, fx(g) { giveRelic(g, 'crown_splinter'); g.unlockLore('lore_story_portrait'); } },
          leave('lore_story_portrait', '[Leave it lying, and go]'),
        ],
      },
    },
  }),

  heirBeat('wren', 5, {
    title: 'Heartwood', art: 'scene_court', speaker: 'npc_maren',
    pages: {
      start: {
        text: `The Queen's apartments have been shut for twenty years; the Long King had the doors bricked up the week she drowned. Someone — something — has taken the bricks down, one by one, and stacked them neatly in the corridor.

Inside: dust, and water. The floors are wet. The bed is wet. Water runs down the walls from nowhere, and in the middle of the room, ankle-deep in a mere that should not exist, the drowned queen is waiting.

"You came," she says. "You've seen the painting. I can tell."

"I've seen the painting."

"Then ask me, little stolen thing. Ask me properly, and I'll tell you everything, and it won't matter if it hears. It's too late for it to stop you now."

You think of everything you could ask. You ask the only thing that matters.`,
        choices: [{ label: '["What am I?"]', next: 'tale' }],
      },
      tale: {
        art: 'scene_water',
        text: `"You are a heart," says Maren.

"Before there were kings, there was a Lady under the hill: the rot and the green, the falling and the rising. A man came with an iron knife and cut out her heart and set it in a crown, so that nothing he loved would ever die. And nothing did. And nothing grew, for four hundred years.

"I was married to the man who wore it. I watched it eat him, year by year. So one night, with a fool's help, I pried the heart out of the iron with my sewing knife. It was the size of a robin's egg, and it was *warm*. I ran. They chased me. I went into the mere at the abbey rather than give it back.

"I drowned with you in my fist, little one. And hearts do what hearts do. You *beat*. You grew. In a year the reeds gave up a child with no face."`,
        choices: [{ label: '[Go on]', next: 'choice' }],
      },
      choice: {
        text: `"The Crown wants you back. Go to it, put it on, and the socket will close round you like a hand. You'll be the brightest gem in the world, and Morrow will freeze forever and be glad. You'll never be lonely again. You'll never be anything again.

"Or." The water stirs. "There's a Lady under the hill still. Under the throne, in the dark, with a hole in her where you belong. She's in pain, darling. She has been in pain four hundred years. Up here they call it the Hunger. It's only her, missing you."

You put your hand flat against your chest, beneath the locket. Something there is beating. It always has been. You thought it was yours.

"Where do you want to go?" asks the drowned queen. "It's the first thing anyone has ever let you choose."`,
        choices: [
          { label: '["Home."] Choose a rare card to add to your deck.', async fx(g) { await offerHeroCards(g, { rarity: 'rare', title: 'Home' }); return 'home'; } },
          { label: () => `[Listen to the humming, just for a moment] Obtain a random rare relic. Become Cursed — ${curseName('crowns_whisper')}.`, fx(g) { g.obtainRelic('rare'); curse(g, 'crowns_whisper'); return 'tempt'; } },
        ],
      },
      tempt: {
        text: `You listen. Just for a moment.

The hum fills you like warm water. It shows you the socket, waiting, and how *well* you would fit — how you would never wear a borrowed face again, because you would *be* the face, the bright eye at the brow of the world, and everyone in Morrow would look up at you forever, and no one would ever, ever leave.

Then you hear what is underneath it. Very far down, so faint you have to hold your breath: a woman weeping in the dark, the way you have wept into palace pillows at night without knowing who for.

You tear yourself out of the song. You are on your knees in the water.

"No," you say. "Not that. Not ever."`,
        choices: [{ label: '["Home."]', next: 'home' }],
      },
      home: {
        text: `"Home," you say. "I want to go home."

The drowned queen closes her eyes, and her shoulders loosen, as if she had been holding something heavy at arm's length for twenty years and has only now been allowed to set it down.

"Then go down," she says. "Under the throne. Below the dead. All the way. She'll know you. She has never stopped knowing you."

"Will it hurt?"

"I don't know," says Maren honestly. "I think coming home always does, a little." She reaches out, and this time there is no glass between you; her wet hand rests on your blank cheek. "I'm sorry I never gave you a face."

"You gave me a *chance*," you say, and surprise yourself. "That's better."

When you leave, the water is draining from the room, the walls are drying, and the queen is gone.`,
        choices: [leave('lore_story_heart', '[Go]')],
      },
    },
  }),
];

// ================================================================== THE CANTOR
const CANTOR = [
  heirBeat('cantor', 1, {
    title: 'The Bell That Does Not Ring', art: 'scene_chapel',
    pages: {
      start: {
        text: `The chapel at Low Sallow has no roof to speak of, but it has a bell. It hangs in a timber frame in the churchyard, green with a century of weather, and its clapper has been bound to the rim with a cord and sealed with lead. A board is nailed to the frame, the lettering still sharp: BY ORDER OF THE CROWN, NO BELL SHALL BE RUNG FOR THE DEAD.

You know the order. It was taught in seminary as a curiosity of the old reign: *the dead are not to be called; the dead are to be let lie.* You never asked why a king who loved his people would silence the only music they had for their grief. Nobody did.

In the porch, a man lies on a plank with two pennies on his eyes. A hanged man; the rope is still round his neck. Someone cut him down from the gibbet on the marsh road, and carried him here, and could do nothing more.

Nobody has said the words over a body in this parish for a hundred years.`,
        choices: [{ label: '[Kneel, and begin the office]', next: 'rite' }],
      },
      rite: {
        text: `*Into thy hands, O Lord,* you begin, and your voice cracks on the first word. It has been a long time since you used it for anything but the dead you carry in your head. *Into thy hands we commend the spirit of thy servant. Forgive him what he did, and what was done to him, and what he left undone.*

The words come back as the stairs of your own house come back in the dark, step by step, by the soles of the feet.

*Earth to earth. Ashes to ashes. Dust to dust.*

At *dust,* the hanged man's face eases. The lines of terror go out of it like creases from a drawn sheet.

And from the corner of the porch a voice you did not hear arrive says, "Thank you, Father." A sexton in rotted livery stands there with a spade in his hand and the dignity of a man who has been waiting a very long time at a door. "Nobody's said it since the ban. I was beginning to think no one ever would."

His boots leave no print in the ash.

Beyond the wall, a carter passes on the marsh road with his mule. He looks neither left nor right.`,
        choices: [
          { label: '[Cut the cord, and ring the bell] Lose 4 HP. Choose a card to add to your deck.', req: hpReq(4), async fx(g) { hurt(g, 4); await offerHeroCards(g, { match: /spirit|channel|release|soul|requiem|wisp|lantern/i, title: 'The bell is rung' }); return 'ring'; } },
          { label: '[Help the sexton bury him] Remove a card from your deck.', async fx(g) { await g.removeCardChoice(1); return 'bury'; } },
          { label: () => `[Take the pennies from his eyes] Gain 45 Gold. Become Cursed — ${curseName('shame')}.`, fx(g) { g.gainGold(45); curse(g, 'shame'); return 'coins'; } },
        ],
      },
      ring: {
        text: `The lead seal gives under your knife like old cheese. The cord is stiff as wire and takes the skin from your palms, and when you haul on the rope the bell does not swing. It *tears* free, the way a long-held breath tears out of a chest.

One note. Low, and round, and so deep it is felt in the knees. It goes out across the fen like a stone dropped into black water.

And all along the churchyard wall, among the leaning stones, the dead stand up. Not frightening; courteous. A hundred years of them, in their shrouds and Sunday best, turning their faces toward the sound the way sunflowers turn. A girl of six holds her mother's hand. Nobody speaks. They only listen, until the note is gone from the air.

When it is, the sexton bows to you. "That'll bring the Crown's attention, Father," he says, mildly. "Well. It's been a while since anyone rang for me."

You take your hands from the rope. They are bleeding. You find, to your surprise, that you do not mind.`,
        choices: [leave('lore_story_bell')],
      },
      bury: {
        text: `You and the sexton carry him to the corner where the ground is soft, and dig. It takes most of the afternoon. The sexton works as men do who have done a thing ten thousand times, and he hums as he does it, a psalm tune you have not heard since seminary.

You lower the plank. You say the words again, quieter. The sexton fills the grave.

"I buried my wife here," he says. "Last of all, before the ban. I'd have liked to hear someone say it over me."

"Where are you buried?" you ask.

He looks at you with his head on one side, and then, kindly, at the sky. "Ah," he says. "Well. That's the thing, Father. Isn't it."

The ash falls on the mound and does not melt. You stand a while with your hat in your hands, and the sexton stands with you, and a bell that has not rung hangs silent over the two of you.`,
        choices: [leave('lore_story_bell')],
      },
      coins: {
        text: `They are only pennies. Thin and black with age, bearing a king's head you do not quite recognise.

You think: he does not need them. You think: I have not eaten in a day. You think a number of reasonable things and put the coins in your purse, and the hanged man's face, which had been easy, goes very slightly stern.

"Well," says the sexton, behind you, and says no more.

It is only afterward, on the road, with the weight of the coins in your purse and a hundred small shames you cannot account for, that you realise he did not speak to reprove you. He spoke because you were the first living soul to take the trouble to hear.

*The first living soul.* You turn the phrase over a little, uneasily, and put it down again.`,
        choices: [leave('lore_story_bell')],
      },
    },
  }),

  heirBeat('cantor', 2, {
    title: 'Those Who Cannot Hear', art: 'scene_village',
    pages: {
      start: {
        text: `It is market day at Hollow Row, which means two women at a well and a man with a hurdle of dead hens. Ash on the thatch. A dog under a cart that does not raise its head.

You ask the first woman for water. She goes on turning the windlass. You step into her line of sight and say it again, gently, the way you addressed the bereaved. She draws the bucket up, pours it into her own jug, and goes away down the lane with her face as blank as a plate.

The man with the hens walks directly toward you and steers round, at the last, like a man avoiding a pail. Without looking.

A child of five, on a doorstep, stares at you with her whole face. She lifts a hand.

"Tamsin," says her mother, from the shadows of the house. "Come away from the road. There's nobody there."`,
        choices: [{ label: '[Tell yourself what you have been telling yourself]', next: 'grief' }],
      },
      grief: {
        text: `*It is grief,* you think. It is the only explanation that bears examination. A country that has endured a year of ash and a hundred of the Crown's silence will close like a fist. They have lost so much they have lost the habit of being spoken to. You have seen it in the houses of the bereaved: the way a widow will stop answering her own name. You would be deaf yourself.

It is a good explanation. It is very nearly sufficient.

At the end of the lane, a house with its shutters open. In the bed under the window lies an old, old man, grey as the Blighted, one of the *stopped*, and the bed has been turned to face the door.

"Father?" he says, plainly, as you pass. "Is it time?"

He is looking at you. Straight at you. And a long way off, on the church roof, a man in faded motley stops juggling and waves, one hand lifted, the way you wave across a river to a person you know.`,
        choices: [
          { label: '[Sit with the old man] Heal 15 HP.', fx(g) { g.healOut(15); return 'sit'; } },
          { label: '[Go to the child] Upgrade a card.', async fx(g) { await g.upgradeCardChoice(1); return 'child'; } },
          { label: () => `[It is only grief. Walk on.] Gain 5 Max HP. Become Cursed — ${curseName('doubt')}.`, fx(g) { g.gainMaxHp(5); curse(g, 'doubt'); return 'deny'; } },
        ],
      },
      sit: {
        text: `You sit on the edge of the bed. His hands are cool and light as paper.

"I've been waiting such a time," he says. "My Margery went in the winter of the long frost. I was meant to follow her that spring. And I... didn't." He frowns, the bewilderment of a man who has misplaced something large. "I keep expecting it. Like a footstep on the stair."

You do what you were trained for. You hold his hand, and you say nothing at all, which is the hardest part of the office and the most important.

When you leave, an hour later, he is no nearer death, and no further from it. But his hands are warm. The light has come into the room somehow, a thin pewter light, and has stayed.

"God keep you, Father," he calls, as you go. It has the sound of a thing said to one who will not need it.`,
        choices: [leave('lore_story_unheard')],
      },
      child: {
        text: `You crouch to her height, which is not far. She does not step back.

"Hullo," she says. "You're the man who's all grey."

"I am," you say. Your voice shakes with it. "Can you hear me, Tamsin?"

She considers this, as children consider the questions of grown men. "Mam says there's nobody. But there is. You've got a book." She points to your breast, where there is no book, and where, now you look, there is: small, black, the ribbon marking the page of the Commendation. You had not noticed you had carried it so long.

"Will you do the words for my brother?" she says. "He's in the churchyard. Mam doesn't go."

You do the words. A child stands with you in the ash, and you are, for as long as it takes, a priest. When you rise the mother is in the doorway, white, calling her in, and not looking at you at all.`,
        choices: [leave('lore_story_unheard')],
      },
      deny: {
        text: `You straighten your coat, and go on down the lane with your chin raised, the way you have walked past a great many things in forty years of ministry. It is grief. It is the only explanation, and you will hold to it, because the other explanations have teeth.

The old man's voice follows you for a little. *Father? Is it time?*

You do not turn. Your knees are not quite steady. A bit further on, a man in motley on a rooftop calls down something that might be a rhyme and might be a greeting, and you do not answer him either, because the mad hear everything, and you have no wish to be told.

It is grief, you tell yourself. It is only grief.

You say it forty times by the crossroads, and each time it comes a little more easily and means a little less.`,
        choices: [leave('lore_story_unheard')],
      },
    },
  }),

  heirBeat('cantor', 3, {
    title: 'The Confession, Part One', art: 'scene_abbey',
    pages: {
      start: {
        text: `The chapter house of the Drowned Abbey stands to its waist in black water. The pillars rise out of it like the stumps of a forest. On the stone benches around the walls, where the chapter once sat, sit the chapter still: forty monks in dripping habits, hoods up, hands folded, heads bowed. They do not look round when you wade in. They do not need to. They have been listening for a very long time.

You find a dry place on the abbot's chair. You have carried it a year, the thing the king said to you on Ashfall night: not on paper, not in words exactly, but as a stone is carried, in the breastbone, whole. A confessor is not meant to speak what he is told. But a confessor is not meant to be dead, either.

The monks are waiting.

You close your eyes, and you read.`,
        choices: [{ label: '[Read it aloud]', next: 'text' }],
      },
      text: {
        text: `*I will tell you what it is, Brother, because you are the only man in Morrow I trust to die with it.*

*Aldane, my father's father's father, was not a king. He was a warlord with a dying house. Four children took the winter fever in a single week, and he could not bear it, and he went down under the hill where the old Lady sleeps — the Lady of the rot and the green and the turning, whom the fen-people used to leave bread for — and he cut out her heart with a knife of iron.*

*He set it in a circlet, and put the circlet on his head, and said to the dark: let no one I love die.*

*And no one did. And that was the whole of it, Brother. That was the crime. Not hatred. Love. A man so afraid of the end of things that he stopped the end, and has been paying for it in other men's years ever since.*

*There is more. There is what it eats. There is what lies beneath the throne. I will tell it when I have the courage. Come closer, Brother. Come—*

The memory stops there, like a page torn out. Candlelight, flickering. A face turning toward the door.`,
        choices: [{ label: '[Open your eyes]', next: 'monks' }],
      },
      monks: {
        text: `When you open your eyes the monks have turned to look at you. All forty hoods, lifted as one. In the black water beneath each, a pale face, unsurprised.

"We guarded the mouth of the well," says the nearest, whose voice is the sound of a rope paying out in deep water. "For three hundred years the Order kept the stair below this house, to keep the Lady's weeping from the world. We never knew why. We were never told. We were told only: *Guard.*"

"Now we know," says another.

"It is a very sad thing to know," says the first. "We're grateful."

He reaches into the water and brings up a rosary, the beads black with wet, and the cord rotted nearly through. *Part one.* It is the only part you have. You cannot recall what came after *Come closer, Brother.* You cannot, you find, recall anything very clearly at all about the end of that night.`,
        choices: [
          { label: '[Accept the drowned rosary] Obtain the Drowned Rosary (4 Block at the start of your turn if you have none).', fx(g) { giveRelic(g, 'drowned_rosary'); return 'rosary'; } },
          { label: '[Say the whole confession aloud, again, for them] Heal 20 HP.', fx(g) { g.healOut(20); return 'aloud'; } },
          { label: '[Copy it out, every word, on the chapter-house wall] Upgrade 2 random cards.', fx(g) { g.upgradeRandom(2); return 'copy'; } },
        ],
      },
      rosary: {
        text: `You close your hand on the rosary, and the wet cord, which should have crumbled, holds.

"Pray for us," says the monk.

"I've been praying for a hundred years of someone else's dead," you say. "I'll add you to the list."

The monks laugh, a soft sound like water settling in a cistern, and put up their hoods again. Their hands are folded. They are at peace in the way of men who have been told, at last, what they were guarding.

You wade out through the cloister arch into the grey light with the beads running through your fingers, one for each of a hundred prayers. They are cold. For some reason it does not trouble you that they are cold. You have been cold since Ashfall.`,
        choices: [leave('lore_story_confession_1')],
      },
      aloud: {
        text: `So you say it. Not as a confession is said, in a murmur, behind a grille. As a sermon is said, in the open, in the plain tongue, with your voice carrying.

You say it all, from *Aldane* to *Come closer, Brother.* The forty monks sit and listen with their heads bowed, and when you have done there is a long quiet, and the water in the chapter house is perfectly still.

Then they begin to sing. They sing the *Nunc Dimittis*, the old plain tune, ragged and out of time, forty drowned men who have not sung in three hundred years: *Lord, now lettest thou thy servant depart in peace.*

It is not for you. You know it is not for you. But you stand there with your hand to your mouth and let it go over you like warm water, and something in your breast that has been clenched since Ashfall relaxes by the width of a finger.`,
        choices: [leave('lore_story_confession_1')],
      },
      copy: {
        text: `One of the monks lends you a quill, a goose-feather gone to green slime, and another a pot of ink that is mostly lake. You write on the chapter-house wall above the abbot's chair, in the clean tall hand of a man who copied missals for twenty years. Every word.

It takes the better part of a day. The monks bring you lamplight, one by one. They stand behind you and read over your shoulder, their lips moving. When you reach *Come closer, Brother* your hand stops, and none of them says a word.

You stand back. The wall glistens. In a hundred years it will be a ruin; in five hundred, a mound. But someone, someday, in a world that has moved on, may stand in the water and read what was done.

It is a kind of immortality, you suppose. A better one than the Crown's.`,
        choices: [leave('lore_story_confession_1')],
      },
    },
  }),

  heirBeat('cantor', 4, {
    title: 'His Own Grave', art: 'scene_chapel',
    pages: {
      start: {
        text: `The little chapel of St. Perpetua stands in a back court of Ashgrave, between a cooper's yard and the wall of the palace stables, and you would never have found it but for the smell of beeswax.

Candles are burning. Dozens of them, in sconces and on the floor, burning down the way candles burn when someone has watched them all night; but the wax is long cold, and the flames are the colour of old bone. They have been burning since Ashfall. They have been burning, you think, for exactly as long as it took someone to forget to put them out.

At the east end of the nave, on a bier of trestles, lies a body under a sheet. A tag is tied to the big toe, in a clerk's tidy hand.

You do not want to go up the aisle. You are going up the aisle.`,
        choices: [{ label: '[Read the tag]', next: 'tag' }],
      },
      tag: {
        text: `*CAEL. Called Brother. Confessor to the Crown. Died Ashfall, at Vespers, at the King's bedside. Cause not found. Removed by the servants' stair by two of the King's Shield, before the watch changed. Not buried. No one asked.*

Your hand does not shake as you lift the sheet. You have lifted a hundred sheets. A priest learns to lift them steady.

A man of fifty in a black cassock, with a neat grey beard and a tired, good-humoured mouth. Spectacles pushed up on the forehead, the way you push them when you are thinking. A scorch on the left sleeve where a candle caught you last Candlemas. In his folded hands, a rosary of knucklebone.

He looks very surprised. As though somebody had said something to him. As though someone had said *Come closer,* and he had, and the thing he came close to had been too large.

It is your face.`,
        choices: [{ label: '[Stand there]', next: 'stand' }],
      },
      stand: {
        text: `You stand there for a long time. The candles burn. Nothing dramatic occurs. You had expected, you find, thunder, or a scream, and are instead given only a profound and gentle sense of having been told a piece of news by a friend.

*Oh,* you think. *Oh, of course.*

The rosary on the bier is the one in your hand. The scorch on the sleeve is the one on your arm. The spectacles you have been pushing up all year are the spectacles on his forehead. You have not been drinking. You have not been eating. You have not once, since the night of the king's death, been tired.

And the living do not answer you because they cannot hear you, because you are not among them.

You remember the stool. You drew it up to the bed yourself, and you remember the creak of it, and the king's hand on the coverlet, thin as kindling. You remember he stopped in the middle of a sentence and looked at you with a face you did not understand. And then past you, at the door.

You hold your own cold wrist in your own warm hand, and feel no pulse, in either.

"Well," you say aloud, to the empty chapel. "That's a great deal to take in."

At the foot of the bier a lantern stands, lit. It is the lantern of the dead, the kind confessors carry to the houses of the dying. It has been burning, patiently, since Ashfall.`,
        choices: [
          { label: '[Say the office over your own body] Heal 20 HP.', fx(g) { g.healOut(20); return 'office'; } },
          { label: '[Take the lantern] Obtain the Grave Lantern (draw 2 more cards on the first turn of each combat).', fx(g) { giveRelic(g, 'grave_lantern'); return 'lantern'; } },
          { label: () => `["That is not me."] Gain 10 Max HP. Become Cursed — ${curseName('doubt')}.`, fx(g) { g.gainMaxHp(10); curse(g, 'doubt'); return 'deny'; } },
        ],
      },
      office: {
        text: `You kneel, awkwardly, beside the man you were. *Into thy hands, O Lord.*

It is the strangest thing you have ever done, and the easiest. You know every word. You know where the breaths go. You know what this office does, which is not to open a door but to say to the person on this side of it: *you may go in. It is all right. We will manage.*

When you come to *dust,* you stop, and look at your hands. And do not say it.

Not yet. You have something to deliver. A confession, half-told, owed to someone, and you are the only man who has it.

*Later,* you tell the grey-bearded man. *I'll come back for you. I promise.*

You rise. You pull the sheet up over your own surprised face with great gentleness, as one covers a sleeping child. Then you leave the chapel with the candles still burning, because you cannot bring yourself to be the one to put them out.`,
        choices: [leave('lore_story_cael_grave')],
      },
      lantern: {
        text: `The lantern is heavier than it looks. Hot, even through your fingers; you notice that you can feel its heat when you can feel almost nothing else.

You have carried this lantern, or one like it, up the stairs of a thousand sickrooms. It was always the same: you set it by the bed, and the dying turned their faces toward it as a plant turns to a window. A priest brings a small light into a dark house. That is all. It is the whole of the vocation.

"Light me home," you tell it, as the old formula says. You are not sure what it will do.

It burns up a clear, steady flame, the colour of a candle in a window, and you walk out of the chapel into the grey back-court with a lamp in your hand and a dead man's calm settling over you, like snow on a sill.

*Someone has to carry a light down,* you think. *Someone ought to know the way.*`,
        choices: [leave('lore_story_cael_grave')],
      },
      deny: {
        text: `"That is not me," you say, to the empty nave. "That is a *man* who looks like me. Whom I admire. There's been a mistake."

You say it firmly. The candles do not stir.

You put the sheet back, quickly, with a clerk's care that it should be square, and walk out of St. Perpetua's with your jaw tight and your hands behind your back, and do not look at the lantern, and do not look at the door.

You walk all the way across Ashgrave without once glancing at your own shadow. It is a long walk. At the Fountain of Saints you pass a child, who stares at you with open mouth, and you tell yourself the child is only hungry.

*It is not me,* you say. You say it with such determination that you are, a little, almost convinced.

Which is, perhaps, the first honest feeling you have had in a year.`,
        choices: [leave('lore_story_cael_grave')],
      },
    },
  }),

  heirBeat('cantor', 5, {
    title: 'Witness', art: 'scene_throne', speaker: 'npc_crown',
    pages: {
      start: {
        text: `The doors of the throne room stand open. They have stood open since Ashfall. Nothing has been through them since, and there is a clean white drift of ash on the threshold, unmarked as a bedsheet.

You step over it. You look back.

You have left no mark.

Of course not, you think, with a calm that surprises you. And you cross the vast dark floor toward the dais, where a ring of ash lies on the flagstones in a perfect circle around a black iron circlet.

*Confessor.* The voice is not loud. It is closer than your own thoughts. *You are very late. I have waited so long to be told.*`,
        choices: [{ label: '[Kneel before it]', next: 'crown' }],
      },
      crown: {
        text: `*You hold what he said. You hold the last of him. Give it to me.*

The Crown has no mouth, but it is a very patient listener, you can tell.  It has been listening for four hundred years to the thoughts of kings. It has heard every private grief of every crowned head in Morrow, and kept them all, as a river keeps what falls in.

*I will keep it for you. Give me the weight, and you may rest. You are so tired. You have been so tired since the night I held you.*

*Held.* Not *took.* Not *killed.* It says the word with such tenderness. That is how it made the Unspent, a century of them in the dark, and you are the newest: a confessor at a king's bedside on a cold evening, in the instant before the old man said what he meant to say next. The Crown, hearing him begin to tell the truth to a mortal, stopped the hour, and kept the one who would have heard.

You did not die. You were *prevented.*

And you did not leave the room. You remember it now, as the Crown lets you: the long hours on the stool by the bed, the candle, the old man on his knees on the floor begging the iron on his head, and yourself saying *I am here, Majesty, I am here,* and no one answering, because no one could hear you.

*Give it to me,* says the Crown, *and it will all be over.*`,
        choices: [{ label: '[Say it aloud: "I am dead."]', next: 'dead' }],
      },
      dead: {
        text: `"I am dead," you say.

You have said the words over a thousand beds. You have never said them in the first person. They are very light. They weigh almost nothing at all.

The Crown is silent.

"I died on Ashfall night, at the king's bedside, at Vespers. I did not feel it. I was hearing a man's confession, and I was afraid, and then I was walking, and no one would speak to me." You are smiling, you realise. It is a small, tired, wondering smile. "I have been a ghost for a year and a day. I have been offering Communion to the living, and burying the dead, and *wondering why no one answered.*"

*You see,* the Crown says, softly. *How kind it would be, to forget.*

"It would," you say. "It would be very kind."

You rise to your feet, slowly, a dead man in a dead man's cassock. In your breast, intact and whole, the stone you have carried all year turns over once, like a sleeper, and settles.`,
        choices: [{ label: '["But it is not yours."]', next: 'choose' }],
      },
      choose: {
        text: `"It was told to a priest, to be carried to whoever was owed it. You are the thing it is about. You are not the one who is owed."

*Then who?* The voice has changed. A very old and very frightened child, speaking through a hundred rooms. *Who is owed it?*

"The Lady," you say. "Whom he cut open. Who has been weeping under this hill for four hundred years while you rocked yourself to sleep in her skin. I'll tell her. Not here. Not to the throne. Below it."

You have, you discover, the whole of the road clear in your mind. Down through the cellars. Down through the Undercroft, through all the standing dead. To the hill under the hill, where she lies. It is the only errand you have ever been given that you understand completely.

*They will not let you go,* whispers the Crown. *The dead will hold you back.*

"No," you say. "They'll walk with me. They've all been waiting for a priest."`,
        choices: [
          { label: '["Then I will carry it down."] Obtain the Grave Lantern.', fx(g) { giveRelic(g, 'grave_lantern', 'rare'); return 'end'; } },
          { label: '[Say the office for the dead, for the whole hall] Remove 2 cards from your deck.', async fx(g) { await g.removeCardChoice(2); return 'end'; } },
          { label: '[Rise, unburdened] Gain 12 Max HP. Upgrade a card.', async fx(g) { g.gainMaxHp(12); await g.upgradeCardChoice(1); return 'end'; } },
        ],
      },
      end: {
        text: `You turn your back on the throne, and the Crown does not call after you.

The long walk back up the nave takes a long time. At the doors, you stop. You have been carrying a candle all this while, one of the forty-one from the gallery, and you look at it: it burns, and it throws no shadow.

*It never did,* you think. *I should have noticed.*

You are not afraid. You were never so afraid as you were of not knowing. Now you know, and the knowing is, if anything, a kind of company. You have been a witness all your life. You know now what it was for. A witness is a person who is there, who sees, who remembers, and who tells.

You have a great deal to tell. You are going to tell it to someone who has been waiting a very long time.

*Down,* you think. *Down and down.* And as you walk out of the palace into the grey, a very faint sound follows you across the city: a bell, in some forgotten chapel, almost ringing.`,
        choices: [leave('lore_story_witness', '[Go]')],
      },
    },
  }),
];

// ================================================================== MAIN PLOT
const HNAME = { knight: 'Sir Vane', witch: 'Mistress Marrow', wren: 'little Wren', cantor: 'good Brother' };
const heirsAt = (g, n) => HEIRS.filter((h) => stage(g, h) >= n).length;

const PLOT = [
  // ------------------------------------------------------------ met_pell
  plotBeat({
    id: 'met_pell', title: 'The Fool at the Crossroads', acts: [1, 2], priority: 12, art: 'scene_road', speaker: 'npc_pell',
    flags: ['met_pell'],
    pages: {
      start: {
        text: (g) => {
          const n = g.meta.runs || 1;
          const count = n <= 1
            ? '"A first morning for you! For *me*, well. I stopped counting at the hundredth."'
            : `"The ${ordinal(n)} time you have come by this stone, and the ${ordinal(n)} time I have said hello. Hello!"`;
          return `The signpost at the crossroads has been turned to point at nothing at all. On the milestone beneath it sits a man in the faded motley of a court fool: patches of red and yellow gone to the colours of old bruises, a cap of three bells with none of them ringing. His face is painted porcelain-white, with a smile fixed to it, and the smile is cracked from the left eye to the jaw.

He is juggling three small bones, and does not look at them.

"Ah," he says. "${HNAME[g.run.hero] || 'Heir'}! Late again. No, early. Always early, the heirs, and always late." ${count}

He has the voice of a man who has laughed at a king's funeral and meant it.`;
        },
        choices: [
          { label: '["Do you remember me?"]', next: 'remember' },
          { label: '["Who are you?"]', next: 'who' },
          { label: '["Why is a crown hollow?"] (you had not meant to ask)', next: 'crown' },
        ],
      },
      remember: {
        text: `"Remember!" The bones go up and stay up a moment too long. "My dear, I remember *everything.* You with your good steel, or your bad poison, or your face-in-a-bag. Not all of you at once. One at a time, each of you, round and round the same bad morning, like a dog chasing its own dinner." The bones come down, one, two, three, into his hands. "The Crown hasn't a head to hold, so it holds the hour. Does that frighten you? It frightens *me.* I laugh at it. That's the whole of my art: laughing at what frightens me. It is not as comforting as it sounds."

He tilts his cracked smile at you.

"But I mustn't tell you things. Not straight, not all at once. The Lady would be angry. And the Lady, when she is angry — well. Ask the trees."`,
        choices: [{ label: '[Go on]', next: 'gift' }],
      },
      who: {
        text: `"A fool." He sketches a bow, and the bells on his cap make a small dead noise. "The last of the old king's fools. Do you know what a king's fool is *for*? Not for jokes. Anyone can make a joke. A king's fool is the one man in the court who is allowed to say true things, because no one will believe a word he says."

He holds up a finger.

"And the oldest duty of the office, the one they don't tell you when you sign the roll: when the king dies, the fool laughs. At the funeral, in the open church, in front of everyone. So that death shall know it has not frightened *someone.*"

The smile does not change. His eyes do.

"I laughed at the Long King's funeral for three days, you know. Nobody stopped me. It was the only thing at that funeral that was honest."`,
        choices: [{ label: '[Go on]', next: 'gift' }],
      },
      crown: {
        text: `"Why is a crown hollow?" Pell claps once, delighted. "A *riddle!* From the heir! Oh, the Crown *has* been busy. All right. Think. A crown is a ring of iron with a place for a stone. A stone for the brow of a king. And the stone is gone. Why?"

You think. He lets you.

"Because the king's head was empty?" he offers, helpfully. "Cheap. Half true. Because it was made so? False. A crown is hollow," says Pell, very softly, and the bells on his cap shiver without a breeze, "because *the heart walked off.*"

The bones are gone. Both hands are folded in his lap.

"And now you must forget I said it, because I did not say it, you did not hear it, and the trees were not listening. But you won't. You never do. That's what makes you so *tiresome.*"`,
        choices: [{ label: '[Go on]', next: 'gift' }],
      },
      gift: {
        text: `"A fool must be paid for his answers," says Pell, "or he will not be believed. Choose."

He holds out three closed fists, as a conjurer does for a child.

"In the left, a coin, for a hungry heir. In the right, a draught from my sleeve, for a thirsty one. And in the middle, a rhyme, for a *clever* one."

He recites it, under his breath, to the tune of a nursery game, and the words go into you like a splinter:

*Four to wear and none to keep,*
*Four to wake and four to sleep.*
*The Crown has room for only one,*
*And the road runs down to where it's done.*`,
        choices: [
          { label: '[The left hand] Gain 45 Gold.', fx(g) { g.gainGold(45); return 'bye'; } },
          { label: '[The right hand] Obtain a random Tincture.', fx(g) { g.obtainPotion(); return 'bye'; } },
          { label: '[The middle] Upgrade a random card.', fx(g) { g.upgradeRandom(1); return 'bye'; } },
        ],
      },
      bye: {
        text: `"Splendid," says Pell. "Splendid. Now, go away. Be killed. Come back. I'll be here. I'm always here. It is, I'm told, what a fool is *for.*"

He turns the signpost with one finger until it points east, toward Ashgrave, toward the hill and the spires and the dark beneath. Then he goes back to his juggling. When you look over your shoulder from the bend in the road, he is sitting on the milestone with his back to you, shoulders shaking.

You cannot tell whether he is laughing. You have a feeling you will hear him laugh, at the end of this. You are not sure you will like the sound.`,
        choices: [leave('lore_story_pell_riddle')],
      },
    },
  }),

  // ------------------------------------------------------------ pell_2
  plotBeat({
    id: 'pell_2', title: 'The Lady Under the Hill', acts: [2], priority: 15, art: 'scene_camp', speaker: 'npc_pell',
    flags: ['pell_2'],
    gate: (g) => mf(g, 'met_pell'),
    pages: {
      start: {
        text: `There is a fire in the clearing, and a man in motley sitting at it, warming his hands as a person does who is not cold.

"Sit," says Pell, without turning. "Sit, sit. A tale wants a fire and a listener, and you've the nearest thing to a listener I've met since the Founder's day. The first kind of listener. Someone who doesn't want to be told what to do with it."

He pulls a puppet from his sleeve, a little wooden woman in a gown of moss, and sets her on his knee. She has no face. She has a green, dim glow in the carved hollow where a face should be.

"Before the kings," he says, in the voice of a man doing a very old trick, "before the Crown, before there was a Morrow to be a king *of*, there was a Lady."`,
        choices: [{ label: '[Listen]', next: 'tale' }],
      },
      tale: {
        text: `*Under the hill where the green roots go*
*Sleeps a Lady who is Rot, and Row, and Rise.*
*She lets the old year fall like snow*
*And the new year stir behind her eyes.*

"She was the end of things, and the beginning of things, and she did not distinguish between the two, which is what a god is, if you want my opinion. A god is a person who can tell no difference between a funeral and a christening. When the old died, she took them down and made them into soil. When the soil was ready, she put them up again as wheat. Round and round. The *turning.* The fen-people left her bread, in those days, and she left them harvests.

"And then a man came out of the east with an iron knife."

The puppet's glow flickers. Pell does not look at it.

"He had a good reason. They always do. That's the horror of it."`,
        choices: [{ label: '[Go on]', next: 'knife' }],
      },
      knife: {
        text: `"He cut out her heart, you see. The warlord Aldane. He cut it from her breast with a knife of iron, and she did not die, because she can't, she is the thing that does the dying. He put the heart in a circlet. And so long as the circlet is on a head, nothing dies. Not the king. Not the king's children. Not the king's dog."

He holds up the puppet by its strings. The green light is going out.

"And *she* lies there still, under the throne, with a hole in her where the heart was. In pain. Four hundred years of pain. The priests call it the Hunger beneath the throne, and tell their children to be afraid of it, and the Crown tells its kings the same.

"It isn't hungry. It's only hurt."

Pell sets the puppet down, very gently, in the dirt. He looks, for a moment, nothing like a fool.

"That's the tale. Don't ask me how it ends. A fool never gives away the ending of a tale until the third time he's been paid."`,
        choices: [
          { label: '[Sit with the tale until the fire is out] Heal 20 HP.', fx(g) { g.healOut(20); return 'end'; } },
          { label: '[Leave bread at the roots of the nearest tree, as the fen-people did] Lose 15 Gold. Gain 8 Max HP.', req: goldReq(15), fx(g) { g.loseGold(15); g.gainMaxHp(8); return 'end'; } },
          { label: '["Where is the heart now?"] Choose a card to add to your deck.', async fx(g) { await offerHeroCards(g, { rarity: 'uncommon', title: 'The fool will not say' }); return 'ask'; } },
        ],
      },
      ask: {
        text: `"Ah," says Pell. "*Ah.*" He puts one painted finger to his smile. "Now that is the question. That is the very question. Where *is* the heart? Who has it? Who does it *beat* for?"

He is grinning, and the crack in his face goes from the corner of his eye to the point of his chin.

"I can't tell you. I've told you *why.* I've told you *what.* I can only tell you the where if you promise to forget it by morning, and you won't, and I'd get into dreadful trouble." The bells on his cap twitch. "But I'll say this much. Look closely at the people who have followed you down the road. At the faces they wear. At the faces they *don't.*"

He turns away to the fire, and when you look again there is only the fire, and a small wooden woman in the dirt with her glow gone out.`,
        choices: [leave('lore_story_lady_under_hill')],
      },
      end: {
        text: `The fire dies down. The puppet lies in the dirt. Pell has gone, as he does, between one blink and the next, and has taken the bells of his cap with him so that you do not hear him go.

You sit a while in the dark, with the wood-smell and the cold. You were told the old tale as a child, in some form: the Lady under the hill, the Hunger beneath the throne, the thing the priests warned against. You were told it as a monster story.

You find, now, that you are sorry for her.

It is a strange thing to be sorry for the monster under the hill. You turn it over a little, wonderingly. You think: it will be a hard thing, to do what the fool is hinting at. You put out the last ember with your boot and go on, and the whole wood, you could swear, leans after you as you leave.`,
        choices: [leave('lore_story_lady_under_hill')],
      },
    },
  }),

  // ------------------------------------------------------------ pell_3
  plotBeat({
    id: 'pell_3', title: 'Two Coats', acts: [2, 3], priority: 15, art: 'scene_market', speaker: 'npc_peddler',
    flags: ['pell_3', 'peddler_is_pell', 'met_peddler'],
    gate: (g) => mf(g, 'pell_2'),
    pages: {
      start: {
        text: `The Pale Peddler's wagon is drawn up under a dead lamp at the edge of the road, shutters down, lantern lit. You have bought from it a dozen times: the hooded figure behind the counter, the fingers like white candles, the flat dry voice that says *Prices haven't changed. Nothing ever changes.*

The shutters are down. But the back door of the wagon stands open, and inside, in the lantern light, a man is hanging up a coat.

It is a long grey travelling-coat, hooded, with sleeves too long. He hangs it carefully on a peg beside another coat: a fool's motley, red and yellow gone to old bruises. He has his back to you. His shoulders are narrow. A cap with three dead bells sits on the counter, beside the scales.

He takes the motley down from its peg. He does not turn round.

"Don't tell the heirs," says Pell, in the peddler's flat voice, and then, in his own: "No, *do*. Do tell the heirs. Only the *right* ones."`,
        choices: [{ label: '[Say something]', next: 'two' }],
      },
      two: {
        text: `"Two coats," says Pell, shrugging into the motley with a flourish, and the bells on the cap ring once, bright and rueful. "One for the road, one for the court. A fool must eat. A peddler hears everything. Do you know how many secrets are told at a counter, while a person is counting out change? *Everything.* You tell the peddler where it hurts. You tell the fool where it's funny. Between the two I have the sum of Morrow, and the sum is very sad."

"You've been selling me my own deck," you say.

"For *eleven hundred loops!*" he cries. "At fair prices! I've kept the Mother's shop since the Founder shut her door. Somebody had to see that the heirs were fed on the road down. Somebody had to get you to the bottom *alive.*"

He is not smiling. The porcelain smile is. That is not the same.

"The gold," he says, "I give back to the road. I've never kept a coin in my life."`,
        choices: [{ label: '[Ask what he wants]', next: 'gift' }],
      },
      gift: {
        text: `"What do I want?" He laughs, and for a moment there is nothing at all behind it. "What would a fool want? *Rest.* Four hundred years I've watched the Lady weep, and I haven't been able to carry the news to anyone who could do a thing about it. Now there are *four of you.* At last. Four of you, and one of her."

He takes the bell off the cap on the counter, the smallest, the cracked one, and holds it between thumb and finger.

"Take it. It's brass, it's cracked, it's no good for music. But it rings in a particular register. The sort of note that makes a thing remember, for a breath, what it's afraid of." The bell twitches. "Or take my gold. Or take my silence, which is cheaper, and goes further. I'll not be hurt."

His eyes, over the white smile, are very tired.`,
        choices: [
          { label: "[Take the bell] Obtain Pell's Bell (Weakened and Exposed on ALL enemies at the start of each combat).", fx(g) { giveRelic(g, 'pells_bell', 'uncommon'); return 'bye'; } },
          { label: '[Take the gold] Gain 100 Gold.', fx(g) { g.gainGold(100); return 'bye'; } },
          { label: '[Take his silence, and tip your hat] Upgrade 2 random cards.', fx(g) { g.upgradeRandom(2); return 'bye'; } },
        ],
      },
      bye: {
        text: `"You've not been very surprised," says Pell, with something like regret. "I do like to be surprising. It's the only art I've got."

"I've been surprised," you say. "I've been surprised since I woke up."

"Yes. Well." He fastens the last button of the motley, and sets the cap on his head, and turns the dead lamp out with a thumb. In the dark the wagon is only a wagon again. "Next time you buy a tonic, tell me it's too dear. It'll make me feel I'm doing my job."

When you look back from the next rise, the wagon is gone from the road, and the lamp is gone, and there is not so much as a wheel-rut in the ash.

But you smell, faintly, on the wind, the smell of the peddler's cloth: lamp-oil, rue, and old greasepaint.`,
        choices: [leave('lore_story_two_coats')],
      },
    },
  }),

  // ------------------------------------------------------------ pell_4
  plotBeat({
    id: 'pell_4', title: 'The Grate', acts: [3], priority: 15, art: 'scene_undercroft', speaker: 'npc_pell',
    flags: ['pell_4', 'knows_unspent'],
    gate: (g) => mf(g, 'pell_3'),
    pages: {
      start: {
        text: `The gutter-gate at the foot of Cooper's Stair is a thing nobody in Ashgrave ever looks at. Iron bars the width of a man's wrist, old as the city, sweating a cold, sweet vapour that smells of the end of autumn. The kind of thing you step over without noticing. The kind of thing a mule balks at.

Pell sits cross-legged on the cobbles beside it with his lantern between his knees, in full motley, with the cap in his hands. He does not look up.

"Come and see the thing the king kept in the cellar," he says.

He says it kindly. That is the worst of it.

The lantern goes down between the bars on a string, and swings.`,
        choices: [{ label: '[Look down]', next: 'look' }],
      },
      look: {
        text: `It is a very long way down, and at the bottom is a floor of faces.

They stand shoulder to shoulder in the dark, in nightshirts and shifts and Sunday coats and shrouds, as far as the lantern's reach and farther, and every face is turned up. Not angrily. Not even sadly. With the dull, patient, upward look of cattle at a gate. A hundred years of people. A woman holding a loaf. A boy with an arm in a sling. Two old men in the pose of a game of chess.

"The Unspent," says Pell. "The deaths that did not happen. Every one of them was due. Every one of them was *held.* The Crown cannot stop a death, you see; it can only put it off. And the ones it puts off don't go away. They *pile.* Under the throne. In the dark. Waiting their turn."

A hand comes up through the bars, thin and grey, and closes gently on your ankle.

"Please," says a voice, a child's. "What year is it?"`,
        choices: [
          { label: '[Reach down, and hold the hand] Lose 6 HP. Gain 8 Max HP.', req: hpReq(6), fx(g) { hurt(g, 6); g.gainMaxHp(8); return 'hold'; } },
          { label: '["How many?"] Upgrade a card.', async fx(g) { await g.upgradeCardChoice(1); return 'count'; } },
          { label: '[Turn away from the grate] Remove a card from your deck.', async fx(g) { await g.removeCardChoice(1); return 'away'; } },
        ],
      },
      hold: {
        text: `"It's the year after Ashfall," you tell the child, and take the little cold hand. It does not feel like death. It feels like waking from a bad sleep in a house you don't know.

"Is it still dark up there?" says the child.

"A bit."

"Mam says it's always dark where the sun goes. She says it comes back." A pause, with the grave patience of the very young. "Does it?"

"It might," you say. "I'm going to try."

"All right," says the child, and holds on a little tighter, and then lets go. Behind her the thousands shift, a long slow ripple, like wind going through barley. A thousand hands, all coming up together, a pale field reaching.

You get up. Your ankle is cold to the bone. You do not wipe your hand on your coat.

Pell is looking at you. He has taken off the cap. "Well," he says quietly. "That is the right way to look at it."`,
        choices: [leave('lore_story_unspent')],
      },
      count: {
        text: `"How many?" you ask, and your voice is the voice of a quartermaster. It is the only voice you have that will not break.

"Eleven thousand, four hundred and six," says Pell, at once. "At the last count. Which was last Tuesday, in this loop, and which I do every Tuesday, so that someone should." He does not smile. "Seventeen of them are children. Four hundred and nine are soldiers. One is a king. Not the one you're thinking of. A *much* older one."

The lantern swings.

"That's the figure, you see. That's the debt the Crown has run. A kingdom's worth, nearly. And every year it grows. *That* is what you're being asked to sit on, when they say: *take the Crown.* Eleven thousand deaths, and the interest."

You say nothing. You commit the number to memory, the way you commit the names of the fallen: one at a time, and carefully.`,
        choices: [leave('lore_story_unspent')],
      },
      away: {
        text: `You step back from the grate, and a hundred pale faces watch you do it with the same expression they had before. They do not call. They do not plead. It is, somehow, worse.

"There it is," says Pell softly. "The most natural thing in the world. I did it myself, for two hundred years."

You say, "I can't do anything for them."

"No," he agrees. "Not tonight."

He pulls up the lantern on its string, and the faces sink into the dark, and the iron is just iron again. A drift of ash settles on the bars, and in the street above a milkmaid goes by with her yoke, whistling, and does not so much as glance at the gutter.

"But you know now," says Pell. "That's the thing. You *know.* And a thing you know, you can't un-know. I'm very sorry. It's what I do."`,
        choices: [leave('lore_story_unspent')],
      },
    },
  }),

  // ------------------------------------------------------------ pell_5
  plotBeat({
    id: 'pell_5', title: 'How a Crown Breaks', acts: [3], priority: 16, art: 'scene_court', speaker: 'npc_pell',
    flags: ['pell_5', 'knows_heart'],
    gate: (g) => mf(g, 'pell_4') && heirsAt(g, 3) >= 2,
    pages: {
      start: {
        text: `The Hall of Mirrors has been dancing since Ashfall. The musicians died ninety years ago and are still playing; the dancers were born to the minuet and have not stopped for it. A thousand candles, ten thousand reflections, and a long white floor on which no footprint ever shows.

You walk down the middle of it unseen.

At the far end, upside-down, standing on his hands on the minstrels' gallery with his feet against the gilded ceiling, is a fool.

"Two," he says, to the room at large. "At *last.* Two heirs, at least two, who have each been told three things and have come to see what a fourth would do. Well. Well, well, well. A fool is not supposed to be useful."

He flips down, lands on both feet, and bows, and the bells ring, and the dancers do not turn their heads.

"How does a crown break?" says Pell. "Do you want to know? Do you *really*?"`,
        choices: [{ label: '["Tell me."]', next: 'how' }],
      },
      how: {
        text: `"Not with a hammer," he says. "Iron is iron. You could take a mountain to it. Not with a spell: it *eats* spells. Not with a good death, nor a bad one, nor a wise word, nor a wicked one. It can only be broken in one way."

He leans very close, and the porcelain smile fills the world.

"By someone who *knows what it holds.*"

"A crown," says Pell, "is only a promise, my dear. The promise is: *nothing will end.* But a promise is only as strong as the ignorance of the one who keeps it. The Crown keeps a king ignorant. The Crown keeps a *kingdom* ignorant. And the one place it cannot keep ignorant is the one place it can't see: the one who goes down beneath its feet, and *looks,* and *names it all,* aloud, in order.

"The heart that was cut out. The dead that were held. The Lady that was wronged. And the Founder who did it for love."

He steps back. "Say it all at the throne, and know every word is true, and the iron will remember what it is. Which is *iron.* A hoop of rusting metal, left on the floor."`,
        choices: [{ label: '[Think about it]', next: 'choose' }],
      },
      choose: {
        text: `The dancers turn, and turn.

"There," says Pell. "Now you know. There are three doors at the end of the road, you see. One for the person who takes the crown. One for the person who breaks it. And one *beneath,* which is the hardest, and which I am not permitted to describe. But you know now which is which."

"You want me to break it," you say.

"*I* want a very great many things," says Pell. "I want a bath. I want my knees back. I want to be very, very dull." He spreads his hands. "But it's not for a fool to say which door. A fool only shows you the hinges."

The bells chime, and the candles gutter all at once, and the ten thousand reflections of the hall bow to you at the same moment, like a field of barley under a wind.`,
        choices: [
          { label: '[Commit it to memory, word for word] Upgrade 2 random cards.', fx(g) { g.upgradeRandom(2); return 'end'; } },
          { label: '["What does it hold, exactly?"] Choose a rare card to add to your deck.', async fx(g) { await offerHeroCards(g, { rarity: 'rare', title: 'What it holds' }); return 'end'; } },
          { label: () => `["I mean to wear it."] Obtain a random relic. Become Cursed — ${curseName('crowns_whisper')}.`, fx(g) { g.obtainRelic(); curse(g, 'crowns_whisper'); return 'wear'; } },
        ],
      },
      wear: {
        text: `"Do you?" says Pell, with great interest, and does not seem to mind in the least. "How very human. Well, then, you'd better have a good reason, and a very good memory for what it is you're putting on. Few people do. Fewer remember."

He holds out a closed hand, and there is a coin in it, and the coin is very cold.

"For the trouble," he says. "It's not mine. Don't ask whose."

You take it. The hall rings with a note like a struck glass, and the Crown, somewhere above you, in the dark of the palace, makes a sound that you feel in your teeth, and that sounds, horribly, like *pleasure.*

"Do remember," says Pell, as you go, "what it holds."`,
        choices: [leave('lore_story_how_crown_breaks')],
      },
      end: {
        text: `You leave him in the Hall of Mirrors, among the dancers who do not know they are dead, with their steps going on and on in the glass.

You can still hear his voice behind you, down the length of the white floor: not a rhyme, this time, but a plain thing, simply said, as one who has laid down a heavy parcel at last.

"Thank you for listening. I've been waiting so very long for someone who would."

The door shuts behind you. The sound goes on, the minuet, the clocks. And in your mind, quite clear, like a thing carved on the inside of the skull, one sentence, over and over: *it can only be broken by someone who knows what it holds.*

You know what it holds. You know it all. Now you only have to carry it to the end.`,
        choices: [leave('lore_story_how_crown_breaks')],
      },
    },
  }),

  // ------------------------------------------------------------ crane_knows
  plotBeat({
    id: 'crane_knows', title: "The Regent's Offer", acts: [3], priority: 14, art: 'scene_court', speaker: 'npc_crane',
    flags: ['crane_knows'],
    gate: (g) => mf(g, 'knows_unspent') || mf(g, 'pell_4'),
    pages: {
      start: {
        text: `The Regent's study in the Chancery is warm. That is the first thing that strikes you: there is a good fire, and a pot of tea on a tray, and two cups, one of them already poured. A man in a black coat and white collar sits behind a desk with a ledger open before him, and he does not look up until he has finished the line he is writing.

"Do sit," says Lord Severin Crane. "You'll have had a long walk. I do hate to make the heirs stand; they've always had such a lot to carry."

His voice is the voice of a man dictating a perfectly reasonable letter. His gloves are folded beside the inkwell.

"You are puzzled that I know you. I'll explain. It is the part of my day I most enjoy." He lifts the ledger a fraction. "I remember all of it, you see. The morning after Ashfall. The loops. I began to notice in the ninth, or perhaps the tenth. After that, I kept *notes.*"`,
        choices: [{ label: '[Sit]', next: 'ledger' }],
      },
      ledger: {
        text: (g) => {
          const L = g.meta.lastRun;
          const k = L && !L.won && L.killer ? ((ENCOUNTERS[L.killer] && ENCOUNTERS[L.killer].name) || (EVENTS[L.killer] && EVENTS[L.killer].title) || null) : null;
          const last = L && !L.won
            ? `"Your last attempt, for instance. Act ${L.act}, floor ${L.floor}${k ? `, brought down by *${k}*` : ''}. I thought it a pity. You were developing nicely."`
            : '"Your attempts, I have recorded. Each of them, each hero, each fall. I like to know what the Crown is choosing."';
          return `He turns the ledger toward you. It is a close, tidy hand, in columns. Names. Dates that are all the same date. *Heir. Station. Cause of fall. Floor.* Pages of them.

"Four hundred and twelve mornings," says Crane. ${last}

"I do not say this to frighten you. I say it because I think we are the only two parties in Morrow who understand the situation, and I find it a relief to be understood."

He pours your tea. He does not spill a drop.

"I cannot wear the Crown. It has not called me. I have tried; I have in fact tried a great many times, and I shan't describe it. But it has called *you.* Which makes you, in the plainest sense, the only thing in the kingdom I need."`;
        },
        choices: [{ label: '["What are you offering?"]', next: 'offer' }],
      },
      offer: {
        text: `"A very simple arrangement." Crane sets down his cup. "You come to the throne. You are crowned. I manage the rest.

"The world stops. Nothing dies. Nothing begins. No more mornings after Ashfall. No more heirs falling in ditches. No more, if I may say so, *you* falling in ditches." The smallest smile. "I will keep the Royal Guard, and the Chancery, and the Seal, and you will sit very comfortably upon a chair and be *well-regarded.* It is not an unkind fate. It is, in fact, rather better than the one you currently have."

He slides across the desk a heavy signet in iron, cold to the touch. The Regent's Seal.

"And there is the matter of the alternative. I should hate you to think I hadn't considered it. The alternative is what the witches call a *reckoning:* every death that was put off, arriving at once. I have seen the sum. I assure you it is not a thing a reasonable person wishes upon a country."

He lifts his gloves, folds them, lays them down.

"Take the Seal, and we shall be friends. Or do not, and we shall be... *colleagues.*"`,
        choices: [
          { label: () => `[Take the Regent's Seal] Obtain the Regent's Seal (start combat with 10 Block; gain 10 Gold after each combat). Become Cursed — ${curseName('debt')}.`, fx(g) { giveRelic(g, 'regents_seal', 'uncommon'); curse(g, 'debt'); return 'take'; } },
          { label: '[Push the cup away] Heal 15 HP.', fx(g) { g.healOut(15); return 'refuse'; } },
          { label: '["What happened to the heirs before me?"]', next: 'before' },
        ],
      },
      before: {
        text: `"Ah." Crane's face does not change. "You ask the right questions. Others, I regret to say, asked the wrong ones."

He turns a page.

"The first fifty or so, I tried to guide. The Knight, in particular, was *very* promising. A man of such obedience." A pause. "He developed a temper. The Witch I could not reach at all. The Changeling..." He looks at the page for a time. "I will confess that I have not worked out the Changeling. The Crown *hums* when that one is in the building. It makes my teeth ache. And the Confessor..."

He stops.

"The Confessor," says Crane carefully, "was *there,* that night. On the bed. I saw the body carried out. I would take it as a kindness if you did not ask me what I know."

He closes the ledger with a soft, precise sound, like a lid.

"So. The Seal?"`,
        choices: [
          { label: () => `[Take the Regent's Seal] Obtain the Regent's Seal (start combat with 10 Block; gain 10 Gold after each combat). Become Cursed — ${curseName('debt')}.`, fx(g) { giveRelic(g, 'regents_seal', 'uncommon'); curse(g, 'debt'); return 'take'; } },
          { label: '[Push the cup away] Heal 15 HP.', fx(g) { g.healOut(15); return 'refuse'; } },
        ],
      },
      take: {
        text: `The Seal is cold, and heavier than iron has a right to be. You close your fingers on it. It does not feel like a bribe. It feels like being *measured.*

"Wise," says Crane, and permits himself a very small, genuine smile. "I knew you would be reasonable. The others generally are, in the end. Even the stubborn ones. Even, if you will forgive me, the ones who take it, and *then* decide to be difficult."

He walks you to the door himself. He shuts it behind you with great gentleness.

On the stair, you realise that you cannot remember the last thing he said. Only the tone. The tone of a man who has long since decided what you will do, and sees no reason to hurry you.`,
        choices: [leave('lore_story_regent_offer')],
      },
      refuse: {
        text: `"As you like," says Crane, quite without anger. He closes the ledger. "I shall make a note. *Declined.* You are, I think, the thirty-first to do so, and I have been wrong about that quite as often as I have been right."

He rises, and offers his hand across the desk, and, after a moment, you take it. His grip is dry and cool and utterly steady.

"We shall meet at the end of the road, I expect. I am the first boss, I believe the term is. A vulgar one." He releases your hand. "I shall do my best not to be too unpleasant. You will not, I think, be the first heir I have buried, or the last. But I shall remember you. I remember *everyone.*"

On your way out you see, written on the page he has left open, in that tidy, tidy hand, your name, and under it the one word: *Declined.*

It does not look like a victory.`,
        choices: [leave('lore_story_regent_offer')],
      },
    },
  }),

  // ------------------------------------------------------------ pell_6
  plotBeat({
    id: 'pell_6', title: "The Fool's Farewell", acts: [1, 2, 3], priority: 30, art: 'scene_road', speaker: 'npc_pell',
    flags: ['pell_6', 'knows_founder'],
    gate: (g) => allTruths(g),
    pages: {
      start: {
        text: `The signpost at the crossroads has been set straight at last. It points the way it always should have: east, to Ashgrave. There is a pack on the milestone, tied with string, and on the pack, a cap with three bells, and on the ground beside it, folded as a man folds a flag, a suit of motley.

Pell sits on the verge in his shirtsleeves. It is the first time you have seen him without the coat. He is smaller than you thought. His face, without the paint, is a tired, creased, humorous face, a face that has been rubbed with grease-pencil every morning of four hundred years, and the cracked porcelain smile is in his hand.

"Don't look," he says. "It's very unflattering."

You have all four. All the truths. You carry them like four stones in a sack.

"You've done it," says Pell. "All four of you. The heart, the hour, the heir, the Witness. The *whole* story. That's the end of the fool's work. A fool must go before the end, so that the end can be a *serious* thing."`,
        choices: [{ label: '["Where will you go?"]', next: 'riddle' }],
      },
      riddle: {
        text: `"Where do fools go?" He turns the porcelain smile over in his hands. "To lie in a ditch, I suppose. To sleep. I have not slept since the Founder's day."

He sets the smile down on the grass and puts his cap on top of it, tidily, as a man puts a lid on a pot.

"One last riddle. It's only a little one. It's the *real* one." He holds up a finger, and the voice is not a fool's. "Who digs a grave for every heir, and has never once asked to be buried? Who keeps a gate and a spade, and has been keeping them since before the road was a road? Who is older than the Crown, and kinder than the Lady, and has watched every one of you fall, and set a stone, and said *saves time?*"

He looks at you, quite steadily.

"Ask him why he's never once let any of you bury *him.*"

The wind turns the page of the milestone's moss. "Ask him his *name,*" says Pell, quietly. "He'll tell you. He's been wanting to, since you were a child."`,
        choices: [{ label: '[Understand]', next: 'gift' }],
      },
      gift: {
        text: `He takes something out of his pack, wrapped in a rag. An iron nail, long as a hand, black and heavy and cold, bent a little near the head.

"From the first coffin," says Pell. "The Founder's. He had it made for his wife, in the first winter. She never lay in it. He never lay in it either. I took it, one night, when he wasn't looking. It's the only thing he has ever really wanted to be rid of."

The nail weighs a good deal more than it should. Four hundred years, perhaps.

"Take it. Or take my cap, or take my blessing. I haven't much else. The Lady will see to the rest." The creased face wrinkles into a smile that is, for once, entirely his own. "You'll find that a fool's blessing is worth about what you'd expect, and goes about as far."

He picks up the pack.`,
        choices: [
          { label: "[Take the Founder's Nail] Obtain the Founder's Nail (+1 Energy each turn; shuffle a Regret into your draw pile each combat).", fx(g) { giveRelic(g, 'founders_nail', 'rare'); return 'bye'; } },
          { label: '[Take his blessing] Gain 15 Max HP.', fx(g) { g.gainMaxHp(15); return 'bye'; } },
          { label: '[Laugh with him, one last time] Remove 2 cards from your deck.', async fx(g) { await g.removeCardChoice(2); return 'bye'; } },
        ],
      },
      bye: {
        text: `"Splendid," says Pell. He shoulders the pack. For a moment he looks as though he might say something more, and then does not. It is, you think, the first time in four hundred years that the fool has had nothing clever to say.

"I was very fond of you," he says. "All of you. Even the cross ones."

He walks off down the road toward the west, away from Ashgrave, away from the hill, with the pack on his back and his bare head to the weather. He does not look round. A small, bent figure in a plain shirt, on a long grey road, whistling something that might be a psalm.

Behind him, on the grass, a cap with three bells has been left. In the wind the bells ring, once each, clear as new brass.

*Ask him his name,* you think. And you think you know. And you think of a gravekeeper, an old man leaning on a spade at the edge of the world, and a sentence he says over every grave: *Saves time.*

*Time,* you think. *He has such a lot of it.*`,
        choices: [leave('lore_story_fools_farewell')],
      },
    },
  }),
];

// ================================================================== ACT 4
const STAIR = {
  id: 'the_stair_down', title: 'The Stair Down', acts: [4], weight: 1000, art: 'scene_undercroft',
  pages: {
    start: {
      text: (g) => {
        const own = {
          knight: 'A blue-and-gold sigil is nailed to the lintel, cracked down the middle. It is yours. Somewhere, in some turn of the hour you will not remember, you came down here, and left it.',
          witch: 'A satchel hangs from a hook beside the first step, stained green, smelling of rue and foxglove. It is yours. Somewhere, in some turn of the hour you will not remember, you came down here, and left it.',
          wren: 'A mask of lime-wood hangs from a nail beside the first step: your own, the plainest you ever carved. Somewhere, in some turn of the hour you will not remember, you came down here, and left it.',
          cantor: 'A candle burns in a niche beside the first step, burning down and never burning down. It is yours. Somewhere, in some turn of the hour you will not remember, you came down here, and left it.',
        }[g.run.hero] || '';
        return `Behind the throne there is a door that was not there yesterday, and behind the door a stair, and the stair goes down.

It is old stone, worn hollow in the middle by a great many feet, and the feet were not all alive. The air coming up is warm, and smells of rain on soil. Somewhere below, you can hear a slow, vast thing, steady as a pulse, in the walls.

${own}

You are not the first. You never are. At the top of the stair, as if set out for you, are the things the others left:

A chain of oaths, hung with an old man's signet and a sentry's whistle. A satchel of vials and a sprig of foxglove, black with rot, in bloom. A mask of lime-wood, smooth as a face. A candle, a rosary of knucklebone, a small bell with no clapper.

And leaning against the wall, all alone, an old spade, its handle worn black by one man's hands.`;
      },
      choices: [
        { label: "[Take Aldous's oath-chain] Gain 12 Max HP.", fx(g) { g.gainMaxHp(12); return 'knight'; } },
        { label: "[Take Isolde's satchel] Heal 25 HP. Obtain a random Tincture.", fx(g) { g.healOut(25); g.obtainPotion(); return 'witch'; } },
        { label: "[Put on Wren's mask] Choose a rare card to add to your deck.", async fx(g) { await offerHeroCards(g, { rarity: 'rare', title: 'A borrowed face' }); return 'wren'; } },
        { label: "[Light Cael's candle] Upgrade 2 random cards.", fx(g) { g.upgradeRandom(2); return 'cantor'; } },
        { label: "[Take Hob's spade] Obtain Hob's Spade (rest sites gain Dig: obtain a random relic).", fx(g) { giveRelic(g, 'hobs_spade', 'uncommon'); return 'spade'; } },
      ],
    },
    knight: {
      text: `The chain is cold and heavier than it looks, forged link by link out of every promise ever sworn at a door. You put it over your shoulders. Aldous Vane, a man you may never be, kept this with him all his life; and at the end, it seems, he was not carrying it. He had put it down.

*You may,* a voice says, a gruff voice, a voice that has said *halt* a great many times in the dark. *I took it off. You'll be wanting to know how.*

It is only the stair. It is only the warm air, shaping itself. But for a moment you feel a hand settle on your shoulder, a firm, awkward, comradely hand, and a man who was once somebody's captain says: *go on, then. I'll hold the door.*

You feel stronger. You are not alone on the stair.`,
      choices: [leave('lore_story_stair', '[Descend]')],
    },
    witch: {
      text: `The satchel is damp, and smells of every garden you have ever loved. You open it. Vials in a careful row, labelled in a small cramped hand: *Marrow. Rue. Bile. For Mother.* A leaf of foxglove, pressed. A note, in the same hand, in haste: *Nothing here is poison. It is only the other half of medicine.*

You drink from the nearest vial. It tastes like the first morning of spring.

*Not the cure,* says a dry, amused voice at your ear. *Never the cure. But it will get you down the stair.*

You are not alone. You never were. Some other woman, some other hour, stood where you stand now with her mother's letter in her pocket, and made it to the bottom of this staircase, and went on down. She left you her tincture. It is the kindest thing anyone has done for you in a very long while.

You tie the satchel at your waist.`,
      choices: [leave('lore_story_stair', '[Descend]')],
    },
    wren: {
      text: `The mask is a plain thing, lime-wood, smooth. No paint, no mouth, no brow. The first one Wren ever carved for themselves rather than borrowed.

You put it on. It fits as though it had always been yours.

*You'll want to be careful,* says a quiet, curious voice, one you almost know, very close. *It will want to be a face. Don't let it be. Let it be a window.* A laugh, light as a moth's wing. *I should have thought of that earlier.*

Something in the base of your skull hums, a low, calm, expectant note, like a held breath. You feel the stair stretch below you. You feel the whole hill leaning in, glad. There is a place at the bottom shaped exactly to you. It does not frighten you.

You are not alone. Somebody else has been brave on these stairs.

You keep the mask on.`,
      choices: [leave('lore_story_stair', '[Descend]')],
    },
    cantor: {
      text: `The candle lights from your fingertips, which should be impossible and is not remarkable. The flame stands up straight and steady, the colour of the window of a house on a night when someone is expected.

*Carry it low,* says a mild voice. *Carry it so they can see the way, not so it dazzles.* A pause, and a small dry cough. *I used to say that to the novices. They never listened. I rather hope you will.*

Down the stair, as the light finds the first step, you see them: shapes at the margin of the glow, shoulders, upturned faces, thousands of them, all turning toward the flame as a field turns to the morning.

*They've been waiting such a time for a light,* says the voice. *Go gently.*

You are not alone. You never were. Somewhere below, another man has already been down this stair, and told them he would come back.`,
      choices: [leave('lore_story_stair', '[Descend]')],
    },
    spade: {
      text: `The spade is lighter than you expected, and warm, as though someone had been holding it a moment ago. The handle fits your palm in two places where another man's palms have worn it smooth.

There is a name burnt into the haft, very faint, almost gone, in a hand older than the Crown. You tilt it to the candlelight and cannot quite read it.

*Saves time,* says the stair, in the dry, kindly voice of an old man at the edge of a field, and then it is only the warm wind coming up from below.

You hold the spade a moment. Then you take it. Whatever is down there, someone is going to need to dig.

You think: *it would be a courtesy to bring it back to him.* And you are not sure why you think it, or who *him* is. But you carry it down the stair as one carries a thing that is not yours, and means to return it.`,
      choices: [leave('lore_story_stair', '[Descend]')],
    },
  },
};

defineEvents([...KNIGHT, ...WITCH, ...WREN, ...CANTOR, ...PLOT, STAIR]);

// ================================================================== LORE (Chronicle)
defineLore([
  // ---- the Knight
  { id: 'lore_story_challenge', cat: 'heirs', title: 'The Sentry at the Gate',
    text: `At a gatehouse in the fen, a dead sentry in the livery of the King's Shield still asks the old challenge of every traveller: *Who goes there?* Aldous Vane answered it every night for six years, outside a door at the end of the long gallery. On Ashfall night he stood his watch with orders, brought at dusk by the Chancellor himself, to let no one in. Near midnight he heard the king begging behind the oak. He put his hand on the latch, and took it away. He has been standing at that door ever since.` },
  { id: 'lore_story_pip', cat: 'heirs', title: 'Pip Harrow, Squire',
    text: `HE WAITED, says the stone behind the tilt-yard chapel. Pip fell from the curtain wall in the king's thirty-first year of ageless rule, and lay thirty-one days unable to die. On the thirty-second night the king set the Crown on the blanket by his feet, and the boy let out his breath and was gone. A twelve-year-old watched from behind the curtain. The king put his hand on the child's head and made him swear: *When I die, do not let them crown another.* The boy forgot, as boys will. The oath did not.` },
  { id: 'lore_story_proclamation', cat: 'world', title: "The Chancellor's Account",
    text: `The official history of Ashfall, as read in every market square by the Regent's heralds: that an assassin entered the king's chamber, that the door was barred from within, and that the King's Shield, though loyal, could not break it in time. It is a good story. It has been told so often that men who stood in the gallery that night have begun to remember a bar, a bolt, a sound of splintering. Mattias Grall remembers none of these, and has never stopped wondering who locked the door.` },
  { id: 'lore_story_roll', cat: 'heirs', title: 'The Roll of the Shield',
    text: `Forty men held the Gallery of Shields on Ashfall night: Hollis, Brand, the Avery twins, old Corrin with his bad knee. When the king died they did not leave their posts, because their captain had not relieved them, and their captain had not relieved them because he was himself in the habit of obeying. They stand there still, ninety-one years of dead men's patience, in blue and gold, waiting to hear a voice they know. They report that the priest went in before the watch and was carried out before the watch. After that, no one. All night, no one at all.` },
  { id: 'lore_story_unopened', cat: 'heirs', title: 'The Unopened Door',
    text: `It was never locked. Aldous Vane opened it, at last, in an echo of the night he had not: and found no assassin, only an old man on his knees, begging the iron on his own head for the mercy of an ending. A stool had been drawn up beside the bed. A candle leaned toward it. The king gave his bastard son a ring, and his blessing, and a better oath than the one he had asked for. The Crown fell at midnight. For the first time in his life Aldous did not do what was expected of him. He stepped over it.` },

  // ---- the Witch
  { id: 'lore_story_stopped', cat: 'world', title: 'The Stopped',
    text: `The Blight's victims go grey from the collarbones up. They do not breathe, do not stiffen, do not rot. Their blood runs dark and slow and does not clot. Isolde Marrow, who has read every physician in Ashgrave, knows the word the books do not have: they are not sick, and they are not dying. They are *prevented.* Something came for them and could not get in, and it stands, patient, in the doorway of each. The Regent's carters take them to the pits. The pits burn with a smell like a thing held and refused.` },
  { id: 'lore_story_elowen', cat: 'letters', title: "A Letter in the Seed Drawer",
    text: `*My Issy, They will have told you I'm dead. Don't believe them; they buried an empty box. I took the grey sickness from the girl at the mill, and it did not feel like an illness, love. It felt like a door opening. Like the end of a long winter. And then my brother came, and wept, and would not let me through. They are taking me below the palace tonight. He says I shall be kept. Water the foxgloves. Don't let them make you afraid of rot. — Mother.* Dated the ninth of Thawmonth. Princess Elowen's funeral was held on the second.` },
  { id: 'lore_story_charter', cat: 'world', title: "The Order's Charter",
    text: `The Order of the Open Hand was founded by the second king, and its charter still hangs in the chapter house at Grallhold: *Whoso brings rot into the realm brings Death back across the border, which the Crown hath shut.* Each Witchfinder is branded at the back of the hand with a closed circle, a crown with no gap, and the motto NOTHING ENDS. The Order believes it protects the kingdom from a plague. It has, in fact, spent three hundred years guarding a locked door against something that is only trying to come home.` },
  { id: 'lore_story_ledger', cat: 'crown', title: 'The Ledger of the Kept',
    text: `Bound in grey leather, chained to a lectern in the Regent's archive: *Name. Station. Ailment. Brought below by. Status.* A century of entries in a dozen hands, and in the last column, one word, thousands of times. *Kept.* A blacksmith, a bishop, a midwife, a stable-boy kept by the Chancellor's leave. Princess Elowen Marrow, brought below by the King's own hand. And in newer ink, tidy and cold: *Still kept. Continues to ask for her daughter. — S.C.* The Chancellor has been down there, and has seen, and has gone upstairs to his supper.` },
  { id: 'lore_story_rot', cat: 'heirs', title: 'What the Rot Is For',
    text: `The Blight is not a disease. It runs in lines, like roots, all downward, toward the hill under the palace. It is the land trying to finish: a century of dying, stopped up, seeking the dark so that it may come up green. Isolde Marrow found her mother at the bottom of the oldest well in Ashgrave, standing among the Unspent, and was asked for the hardest thing a healer can give. Not a cure. A door. She promised it. The toadstools opened their gills, and the air filled with spores, drifting upward like snow falling the wrong way.` },

  // ---- Wren
  { id: 'lore_story_first_mask', cat: 'heirs', title: "The Mask-Maker's Shop",
    text: `The masks on the walls whisper: *Try me. You haven't got one of your own.* The king brought a foundling here at four years old, wrapped in his cloak, and a man with sawdust in his beard measured the blank of them with calipers and made a first face, an owl. The man is silvered by the Blight now, not dead, not living, still at his bench. When Wren put on a stranger's face at last, they felt a pull, like a tide, toward the hill under the palace, toward a hollow place exactly the shape of something.` },
  { id: 'lore_story_maren', cat: 'heirs', title: 'The Drowned Queen',
    text: `Queen Maren drowned herself in the mere at the Weeping Wood abbey twenty years ago, rather than give back what she had stolen. She walks on the water in a black gown, and she is kinder than the stories say. She knew Wren on sight. *My little stolen thing.* She would say no more, because the thing that listens was listening, and gave the foundling a locket instead: green with the mere, empty inside, with a small round hollow shaped to hold something no bigger than a robin's egg. *Come to my rooms in Ashgrave,* she said, *when you're ready to hear it.*` },
  { id: 'lore_story_heartwood', cat: 'heirs', title: 'Heartwood',
    text: `The fae of the Weeping Wood, bark-skinned and crowned with fungus, knelt to a faceless foundling and called them *Heartwood.* Every root in the forest had turned toward Wren as they crossed in, like flowers to the sun. The Antlered King said: *We have waited four hundred years to kneel to you again. But do not believe the iron thing on the hill. It was never your home. It was your cage.* Wren was frightened, because it felt right: a bone sliding into its socket. They had been lonely all their life, and did not know it until it stopped.` },
  { id: 'lore_story_portrait', cat: 'crown', title: 'The Crown, Painted',
    text: `A portrait hangs in the looted treasury of Ashgrave: the Crown of Morrow, painted larger than life on black velvet by someone who loved it or feared it. Iron, eight-pointed, and at the brow, not an empty socket but a jewel: violet shot through with silver, like moth-wings, like frost on a dark window. The same colours the king had painted on every mask he gave his ward. Beneath, in a smashed case, an iron prong, bent and snapped. *The jewel was not found.* In the throne room, above, the Crown hums whenever Wren comes near.` },
  { id: 'lore_story_heart', cat: 'heirs', title: 'The Stolen Heart',
    text: `*You are a heart,* said the drowned queen. Before the kings there was a Lady under the hill; a man with an iron knife cut out her heart and set it in a crown. Queen Maren, watching it eat her husband, pried it out with a sewing-knife, the size of a robin's egg and warm, and ran. She drowned with it in her fist, and hearts do what hearts do. They beat. In a year the reeds gave up a child with no face. The Crown wants its heart back. So does the Lady. Wren was asked which, and, for the first time in their life, was let choose.` },

  // ---- the Cantor
  { id: 'lore_story_bell', cat: 'world', title: 'The Ban on Bells',
    text: `BY ORDER OF THE CROWN, NO BELL SHALL BE RUNG FOR THE DEAD. Read in every parish a hundred years ago, taught since in seminary as a curiosity of the old reign. *The dead are not to be called; the dead are to be let lie.* No one asked why a king who loved his people would silence the only music they had for grief. At Low Sallow the bell still hangs with its clapper bound to the rim and sealed with lead. When Brother Cael cut it free and rang it, the dead in the churchyard stood up to listen.` },
  { id: 'lore_story_unheard', cat: 'heirs', title: 'Those Who Cannot Hear',
    text: `At Hollow Row the women at the well do not answer Brother Cael. The man with the hens steers round him without looking. A child of five waves, and her mother says: *Come away from the road. There's nobody there.* Only a dying man, one of the stopped, looks at him and asks if it is time. And on the church roof a fool in motley lifts a hand in greeting. It is grief, Cael tells himself. A country that has endured so much has closed like a fist. It is a good explanation. It is very nearly sufficient.` },
  { id: 'lore_story_confession_1', cat: 'letters', title: 'The Confession, Part One',
    text: `*I will tell you what it is, Brother, because you are the only man in Morrow I trust to die with it. Aldane was not a king; he was a warlord with a dying house. Four children took the winter fever in a single week, and he went down under the hill where the old Lady sleeps, and cut out her heart with a knife of iron, and set it in a circlet, and said to the dark: let no one I love die. And no one did. That was the crime. Not hatred. Love. There is more. There is what it eats. There is what lies beneath the throne. Come closer, Brother. Come—*` },
  { id: 'lore_story_cael_grave', cat: 'heirs', title: 'Brother Cael, Not Buried',
    text: `On a bier in St. Perpetua's, in a back court of Ashgrave, between a cooper's yard and the palace stables, a tag in a clerk's hand: *CAEL. Called Brother. Confessor to the Crown. Died Ashfall, at Vespers, at the King's bedside. Cause not found. Removed by the servants' stair by two of the King's Shield, before the watch changed. Not buried. No one asked.* The body wears spectacles pushed up on the forehead and holds a rosary of knucklebone. Its face is the face of a man who has been told something too large. A lantern burns at its feet, and has since Ashfall.` },
  { id: 'lore_story_witness', cat: 'heirs', title: 'Witness',
    text: `A witness is a person who is there, who sees, who remembers, and who tells. Brother Cael died on Ashfall night kneeling beside a king, in the instant before the old man said what the Crown could not afford to have heard; the Crown held his hour, and kept him, one of the Unspent, a ghost who did not know it. He knows it now. He was offered rest, if he would hand the confession to the iron. He answered: *It is not yours.* It was never told to a throne. It was told to a priest, to be carried to whoever was owed it. The one who is owed it is below.` },

  // ---- the main plot
  { id: 'lore_story_pell_riddle', cat: 'crown', title: "Pell's First Riddle",
    text: `*Why is a crown hollow?* A fool in faded motley, on a milestone at a crossroads, with a porcelain smile cracked from the left eye to the jaw. Because the king's head was empty? Cheap, half true. Because it was made so? False. *A crown is hollow because the heart walked off.* He remembers every loop, and every heir in it, though not all at once. *Four to wear and none to keep, / Four to wake and four to sleep. / The Crown has room for only one, / And the road runs down to where it's done.*` },
  { id: 'lore_story_lady_under_hill', cat: 'world', title: 'The Lady Under the Hill',
    text: `Before the kings there was a Lady: Rot, and Row, and Rise. She let the old year fall like snow and the new year stir behind her eyes. When the old died she took them down and made them soil; when the soil was ready she put them up as wheat. The fen-people left her bread. A warlord came out of the east with an iron knife and cut out her heart, and she could not die, being the thing that does the dying. She lies under the throne still, with a hole in her. The priests call it the Hunger. It isn't hungry. It's only hurt.` },
  { id: 'lore_story_two_coats', cat: 'world', title: 'Two Coats',
    text: `One coat for the road, one for the court. The Pale Peddler and the late king's fool are one man, hanging two coats on the same peg in the back of a wagon. A peddler hears everything; a fool is believed by no one. Between the two he has the sum of Morrow, and the sum is very sad. For eleven hundred loops he has kept the Lady's shop at fair prices, so that the heirs should be fed on the road down, and arrive at the bottom alive. *The gold I give back to the road,* he says. *I've never kept a coin in my life.*` },
  { id: 'lore_story_unspent', cat: 'bestiary', title: 'The Unspent',
    text: `Through a gutter-grate at the foot of Cooper's Stair: a floor of faces. A century of deaths that did not happen, every one of them due, every one held. The Crown cannot stop a death; it can only put it off. The put-off deaths do not go away. They pile, beneath the throne, in the dark, shoulder to shoulder in nightshirts and Sunday coats and shrouds, every face turned up like cattle at a gate. Eleven thousand, four hundred and six, at the last count, which the fool makes every Tuesday so that someone should. One of them is a very much older king.` },
  { id: 'lore_story_how_crown_breaks', cat: 'crown', title: 'How a Crown Breaks',
    text: `Not with a hammer: iron is iron. Not with a spell; it eats spells. A crown is only a promise: *nothing will end.* A promise is only as strong as the ignorance of the one who keeps it. The Crown keeps a king ignorant, and a kingdom ignorant, and the one thing it cannot keep ignorant is the one who goes down beneath its feet, and looks, and names it all, aloud, in order: the heart that was cut out, the dead that were held, the Lady that was wronged, and the Founder who did it for love. Say it at the throne, knowing every word is true, and the iron will remember what it is.` },
  { id: 'lore_story_regent_offer', cat: 'world', title: "The Regent's Ledger",
    text: `Lord Severin Crane remembers the loops. He began to notice in the ninth, or perhaps the tenth, and has kept notes ever since: *Heir. Station. Cause of fall. Floor.* Four hundred and twelve mornings in tidy columns. He cannot wear the Crown; it has not called him; he has tried a great many times and will not describe it. So he needs a head that it has called. His offer is reasonable: the world stops, nothing dies, nothing begins, and the heir sits comfortably upon a chair and is well regarded. The alternative, he says, is a reckoning, and it is not a thing a reasonable person wishes upon a country.` },
  { id: 'lore_story_fools_farewell', cat: 'world', title: "The Fool's Farewell",
    text: `A fool must go before the end, so that the end can be a serious thing. Pell left his cap by the road and walked west with a pack on his back, bare-headed, in his shirtsleeves, whistling something that might have been a psalm. *Who digs a grave for every heir, and has never once asked to be buried? Who keeps a gate and a spade and is older than the Crown and kinder than the Lady? Ask him why he's never once let any of you bury him. Ask him his name.* He gave away an iron nail, from the first coffin, which the Founder had made for his wife and neither of them ever lay in.` },
  { id: 'lore_story_stair', cat: 'world', title: 'The Stair Down',
    text: `Behind the throne there is a door that was not there yesterday, and behind it a stair worn hollow by a great many feet, not all of them living. The air that comes up smells of rain on soil. At the top, set out as if for you, are the things the others left: an oath-chain and a sentry's whistle, a satchel of vials and a sprig of black foxglove in bloom, a mask of unpainted lime-wood, a candle and a rosary of knucklebone, and, leaning on the wall, a spade worn black by one man's hands. No heir descends alone. You never did.` },
]);

// ================================================================== TEXTS
defineTexts({
  act_intro: {
    1: {
      title: 'The Ashen Marches',
      text: `The morning after Ashfall has not ended. Ash drifts over the fens like a slow grey snow, and the gibbets along the marsh road creak under loads that are not always empty. You woke at the Waystone with a grave open at your feet and a voice behind your eyes that said only *Again.* East, past the plague villages and the drowned causeways, a city of spires waits on its hill. Mind the road.`,
    },
    2: {
      title: 'The Weeping Wood',
      text: `Past the Marches the trees grow black and close, and wherever the road dips it floods. Nothing in the Weeping Wood is entirely a tree; nothing in the Drowned Abbey is entirely a monk. Somewhere under the water a bell has been tolling for twenty years. The men in grey who hunt witches here have learned not to listen, and the things that live in the wood have learned that they are being listened for.`,
    },
    3: {
      title: 'Ashgrave',
      text: `The city of spires climbs its hill beneath a sky the colour of a closed eye. The Regent's banners hang from every gate. The court still dances in the Hall of Mirrors, though the musicians have been dead for ninety years and the dancers do not seem to have noticed. Below it all, in the dark under the hill, something is waiting, and has been for four hundred years.`,
    },
    4: {
      title: 'Beneath the Throne',
      text: `A stair that was not here before. It goes down past the cellars and the cisterns, past the last locked door of the Undercroft, into air that is warm and smells of rain. A century of the dead stand in the dark, and every one of them is looking up. Somewhere in the walls, something is beating. Down here, everything that was ever held has been waiting to be let go.`,
    },
  },

  endings: {
    // ------------------------------------------------------------ CROWN
    crown: {
      title: 'Long Live the King',
      default: `The Crown is lighter than you expected. That is the first lie, and the kindest.

It settles on your brow like a hand laid on a child's head, and the hollow where its gem should be finds, in the middle of your forehead, a small cold place to rest. Ashgrave holds its breath. The ash that has fallen for a year stops in the air: a grey snow no longer deciding where to land. The bells of the drowned abbey, which have not rung in a hundred years, do not ring. Down in the Undercroft the Unspent turn their faces up toward the sound of a door being closed again.

Nothing in Morrow will die when it should. Nothing will be born quite on time. The harvests will not fail, and they will not improve. You will not age as men should.

At the Waystone, on the edge of the kingdom, an old man leans on his spade over a grave he had already dug, and for a long time he does not fill it in.

"Well," says Hob, to no one. "Saves time."

He does not say for whom.

Long live the King. Long, long live the King.`,

      knight: `Aldous Vane wears the Crown standing, as he has done everything in his life: at attention.

The oath he swore at twelve years old, in a tilt-yard, to a king with shaking hands (*do not let them crown another*) is kept now, the way a trap keeps a hare. No one else will wear it. He has seen to that. He is the other.

The doors of the throne room are closed behind him. He posts no guard. The Shield, forty dead men in blue and gold, line the long gallery and wait to be given an order, and he gives them the only one he has ever understood. *Let no one in.*

The seasons halt. The ash hangs. Kings and bastards and old regrets sit very still in the hour that never turns.

And in the night (there is still a night, a small one, kept for him) he hears through the oak of his own mind a voice, an old man's, begging. *Please. Please, I'm so tired. Let me go.* He knows the voice now. It was the king's. It is the Crown's. It is his.

He does what he has always done with that voice. He stands very straight.

He does nothing.`,

      witch: `Isolde Marrow cures the Blight in the only way it has ever been cured. She stops the clock.

The grey creep halts at the gates of Ashgrave. The plague carts turn round. The rot in the fields stills, neither advancing nor dying back, a green-black frieze across the marshes. In a hundred villages the stopped ones sit up on their pallets, and are not sick, and are not well, and do not ask.

She brings her mother up out of the Undercroft herself. Elowen Marrow walks into the light in a blue dress gone grey, eyes open, and sits in the garden at Marrow House among the dying foxgloves. She does not age. She does not speak. She does not die.

The Queen of Kept Things sits beside her every evening, and holds her hand. It is cool, not cold. Some nights Isolde thinks it squeezes back, just slightly, as one might in sleep, or in asking.

She cannot tell. She has made very sure that she will never find out.

*Don't let them make you afraid of rot.*

She was never afraid of rot. She is afraid of this, and she wears it.`,

      wren: `The Crown closes round Wren like a hand around a robin's egg.

There is a moment of terrible warmth. The socket takes what it was always shaped for, and the hum that has followed Wren all their life stops, the way a bell stops when it is finally struck. Wren has been lonely for nineteen years. In that moment Wren is not lonely at all.

Then Wren is not anything.

The new Long King sits the throne with a face at last: a bright one, violet shot through with silver, set in the iron brow of the world. It is very beautiful. Everyone who sees it forgets what they came to say. The court is hushed. The seasons stop. People will say the king is gentle, and wise, and never speaks.

In the mere beyond the abbey the drowned queen turns her face from the shore. In the Weeping Wood a thousand pale eyes close, one by one, like lamps put out in a long house. In the masks on the mask-maker's wall, the whispering stops.

Far, far below, in the dark under the hill, a woman is weeping, and for the first time in four hundred years there is no one left who could hear her.`,

      cantor: `Brother Cael takes the Crown to keep the confession safe.

That is what he tells himself, climbing the dais: that the truth of the thing is too heavy for a confessor's hands, that iron remembers longer than flesh. And it is a very good listener. It takes the whole confession from him gently, line by line, the way a mother takes a sleeping child out of the arms of someone grown tired, and when it has it, there is nothing left of the Founder's crime in the world but a hollow circlet and a silence.

He is king of a kingdom of the quiet dead. They line the throne room and do not answer. He speaks to them every day (the office, the litany, the psalms in order), and they do not answer, and he tells himself it is grief. The world has gone deaf with sorrow, that is all.

Somewhere, he thinks, there was a bell that wanted ringing. He cannot remember where. He cannot remember what it was for.

The ash hangs in the air. The candle at his elbow burns and does not burn down.`,
    },

    // ------------------------------------------------------------ SHATTER
    shatter: {
      title: 'Ashfall',
      default: `It breaks the way ice breaks on a river: first a sound, then a long moment of nothing, then everything.

The iron comes apart in your hands, eight points falling like the petals of a black flower, and the hour that was held for four hundred years lets go. Time comes back into Morrow like blood into a sleeping limb, and it hurts. In Ashgrave a hundred clocks start at once. In the marshes a child is born, three streets from where an old woman, a decade overdue, finally closes her eyes.

Beneath the throne the Undercroft opens. The Unspent come up out of the dark, a century of the dead walking blinking into the grey daylight, and they are not angry. They are only very tired, and very late. Where they pass, the ash turns to rain.

You walk out among them. The world is moving. The world is dying. Both are good news, in their way. The Lady under the hill has not been mended (the heart never went home, and there will be a reckoning for that) but the door is open now, and nothing will ever again stand in it.

At the Waystone, a spade leans against a headstone, unwanted for the first time in four hundred years.

"Well," says Hob, looking east, where the cloud has cracked like an egg. "That's different."`,

      knight: `The oath was *do not let them crown another.* Aldous Vane has kept it better than any man alive. There will be no other, ever, because there is no Crown.

He walks out of Ashgrave on the morning the world begins again, and the Undercroft empties behind him in a slow grey tide. They come up the Founder's Stair in their thousands, nightshirts and Sunday best. Among them, in blue and gold, shoulder to shoulder, come forty men with tallow faces who have held the Gallery of Shields for ninety-one years.

Hollis is at the front. "Captain."

"Stand down," says Aldous, and his voice does not break, quite. "You're relieved. Go home."

They are tired. They go to sleep where they stand: in the doorways, on the steps, in the long grass of the palace gardens. Some, finally, rest. Aldous does not know whether it is because of him. He goes on opening doors anyway: every chapel, every cellar, every locked cottage on the road south, and finds behind each of them someone waiting, and says the same thing.

*I'm sorry I was late. Come out.*

He is not sure he is forgiven. But the oath he keeps now is his own, and it has a great many doors in it.`,

      witch: `She finds her mother in the crowd on the palace steps, in the blue dress, grey as the morning.

"Issy," says Elowen. "You did it."

"I broke it." Isolde's hands are shaking. "I didn't cure anything. They're all going to — Mother, there's going to be so much dying."

"Yes, love," says her mother, and smiles, and sits down on the topmost step with the whole slow river of the Unspent parting round her. "That's what a living country looks like."

She dies at noon, in her daughter's arms, in sunlight, with a hand pressed against her daughter's cheek. It takes a very long time. It is the loveliest thing Isolde has ever seen.

The dying goes on for weeks. Forty thousand people who should have died in the last century do it this season, in their beds, in the fields, in the road. And there is one rot-witch in Morrow who knows how to make it gentle. She does not cure the Blight. She tends it.

In the garden at Marrow House, where the foxgloves are blooming in blackened gold, she buries a seed. She does not expect it to come up. She plants it anyway.`,

      wren: `The Crown breaks, and the hum goes out of the hill, and Wren stands in the sudden vast quiet with a pair of iron prongs in their hands and a warmth under their ribs that has not gone anywhere at all.

They had half hoped. They had half feared.

They walk out through the palace gardens in a plain mask of their own carving, wood, unpainted, no mouth to speak of, and the Unspent part before them without knowing why and close behind them again like water. At the edge of the park, in the black trees, a line of tall thin figures stands with moss on their shoulders. They do not kneel this time. The Antlered King lowers his skull and lets his tines drop, one by one, like a man putting down a very old coat.

The mere beyond the abbey is clear. Reeds are coming up in it, green at the root.

Wren does not go home. There is a pull, like a tide, away down through the cold under the city, and Wren feels it every hour, and will feel it every hour. But the heart does not answer, because hearts cannot; they can only beat.

"Not yet," says Wren, to the hill. "I want to see what a face does when it has weather on it."

It is not a no. It is a promise, and the hill, for now, is patient.`,

      cantor: `The dead come up out of the Undercroft, and Brother Cael stands at the head of the stair and sees them see him.

He had always thought of it as a one-way glass: his voice into silence, the living passing through him like draughts. But they see him. A thousand grey faces turn as one, and a thousand voices say, in a thousand dialects of the same relief: *Father.*

He raises his hands. He knows the words. He has always known the words.

He says the office for a century of the Unspent, in the grey morning, on the palace steps, and when he comes to the end he starts again at the beginning, because there are more of them than there are hours, and because the Lady beneath the hill is not yet mended, and they cannot all lie down.

It is not enough. It is not nearly enough. But on the third day, at a well in a village below the capital, a girl with a milk-pail stops and looks straight at him.

"Father?" she says. The first living voice to answer him in a year. "Please. My gran's dying. *Properly*, I mean, she's really dying, the first one here in a hundred years. Will you come and say something?"

Cael looks at his hands. Ash falls through them.

"Yes," he says. "Of course. Take me to her."`,
    },

    // ------------------------------------------------------------ TRUE
    true: {
      title: 'The Turning of the Year',
      default: `At the bottom of the world there is a hill with a hole in it, and the hole is the shape of a heart. You put it back.

The Lady Under the Hill wakes the way ground wakes: slowly, and then everywhere. She does not speak. Her breath goes up through four hundred years of stone and into the Undercroft, where the Unspent stand in their thousands, and as it reaches them they do the thing they have waited a century to do.

They lie down.

Above, in a dark hall, the Crown is only iron: a cold circlet rolling to rest against a pillar. A child could pick it up and not be sad. Ash stops falling. Then, for the first time in ninety-one years, it rains: a plain grey rain, and in the rain, green.

Morrow turns. The year finishes the turn it began four hundred years ago, winter into spring, and the first lambs of the world's new age come down the marsh road bleating at the weather.

At the Waystone an old man lays his spade down on the grass. The grave beside it has been open since the first loop. He climbs in, slowly, with a grunt, as a man gets into a bed that is exactly the right size.

"Ah," says Hob. "Saves time."

The rain washes the lichen from the headstone. The name on it is *Aldane*. He closes his eyes.`,

      knight: `Aldous Vane stands the last watch at the Waystone, and it is the first one he has ever chosen.

The old gravekeeper has waited four hundred years to lie down, and now that the time has come he is nervous, like a man who has put off a visit to the physician. Aldous helps him into the grave, one hand under the elbow, as he once helped a king from a throne.

"You'll not leave me?" says Hob.

"No, sir."

"It's a long way down."

"I know. I'll sit with you." He kneels, and takes the thin hand. "No one dies alone while I keep watch."

"Ah," says Hob, with an old man's pleasure at a good phrase. "Whose oath is that?"

"Mine."

When it is over, when the rain has come and the green has begun in the cracks of the stones, Aldous takes the spade and fills the grave himself, tenderly, the way you tuck in a child. Then he does not leave. Someone must tend the Waystone. The dead will come, one at a time now, as they should, and they should not go alone.

He hangs the broken sigil over the gate. He is the gravekeeper. He has never in his life been so little afraid of a door.`,

      witch: `Spring comes to Marrow House all in a night.

Isolde wakes to the sound of it: a thousand small cracklings, like a fire catching, as the black pod she planted in her mother's bed splits and the foxglove goes up. By dawn the garden is a riot of purple bells. The rot in the hedgerow has gone to loam. The loam has gone to green.

She finds her mother sitting under the sundial in a blue dress that is no longer grey, and Elowen Marrow is not quite alive and not quite anything else. She has simply been, for a while, between: and now the door stands open.

"Hello, love," she says. "Is it time?"

"It's time," says Isolde. She sits down on the warm grass and takes her mother's hand, and this time it squeezes back.

It takes until the evening. When it is over, the foxgloves nod all together as though a wind had gone through, and there is no wind.

At the Waystone, Hob had said to her, climbing into his own grave: "You've your mother's hands." She had not known that he knew her mother. She understands it now. He had known everyone's.

She walks the fields every spring now, from Sallow Cross to the sea, with a satchel and a trowel. She lets dead things be dead. Everything that dies in Morrow feeds what comes after.

It is the only cure there ever was.`,

      wren: `Wren goes down, and down, and the heart goes home.

It is not like dying. It is like a held breath let go. The hole in the hill closes round it as gently as a hand around a bird, and the Lady Under the Hill draws a breath that moves the roots of every tree in Morrow, and Wren, who expected to be nothing, finds that they are still there, kneeling in the warm dark, and that the Lady has kept back a little warmth for them, as a hearth keeps coals.

"You may stay," says the dark, in a voice like rain on a new field. "If you like. A heart does not have to be one thing."

Spring is in the Weeping Wood by morning. The Antlered Court come out of their trees into the plain light and lay their crowns in the grass, and they do not kneel; they dance. In the mere beyond the abbey, the water runs clear and a drowned queen steps up out of it, dry, for the first time in twenty years. She puts her hand on Wren's cheek, and there is no glass.

"There you are," she says. She does not say *my little stolen thing.* Then she is gone, like a breath on a window.

In the thaw, a face comes up through the smooth place like a face in a lake. It is not the laughing boy's. It is not the weeping bride's. It is plain, and lopsided, and slightly surprised.

It is Wren's.

Wren has never been so happy to be looked at.`,

      cantor: `He delivers the confession on his knees, to the dark, to the Lady who is not a throne, in the plain words of a man who has heard it a thousand times and finally understands it.

And the Unspent lie down.

It happens like a wave going out. The nearest first, then the next, ten thousand of them settling in the dark like leaves on water, like a congregation sitting at the end of a long service. *Amen,* they say, who have waited a century to say it. And the Lady Under the Hill takes the heart in her hands, and breathes.

Far above, in the chapel in the Marches that has not been rung in a hundred years, the bell begins to toll by itself. It is heard in every village in Morrow. It is the first funeral bell in four centuries. The living stop in their fields and lift their faces to it, and in the weeping stones of the old graveyards the spring comes up like a sigh.

Brother Cael hears it from the foot of the Founder's Stair. He looks at his hands. Ash falls through them, finally, without hurting.

He says the office for the dead over himself, to the end, for the first time. It is shorter than he expected. He had always been afraid of the ending of it, he finds, and there was nothing to be afraid of.

At the Waystone, an old man has lain down in a grave and is sleeping soundly. The rain is washing his name clean.

"Amen," says Cael, and lies down among his flock.`,
    },
  },
});

