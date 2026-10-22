// Act 3 events — Ashgrave under the Regent. Shared helpers live in act2.js (same author).
import { defineEvents, defineLore } from '../../engine/registry.js';
import {
  P, H, isHero, notHero, hpReq, goldReq, roll, relicName, relicFull, giveRelic, rewardRelic,
  curseName, addCurse, hasCurse, removeCurse, giveTinctures, offer, foes, deckReq, upReq,
} from './act2.js';

// Run flags set in Act 2 (read here, never written): a2_sold_name, a2_hart_freed, a2_hart_killed,
// a2_witch_freed, a2_walked_on, a2_took_locket. Story flags read: knows_unspent, crane_knows, met_pell.
// Run flags set here: a3_denounced, a3_took_seal.

defineEvents([
  // ---------------------------------------------------------------- curfew
  {
    id: 'a3_curfew', title: 'The Hour Not Rung', acts: [3], art: 'scene_city',
    pages: {
      start: {
        text: (g) => P(
          `Ashgrave's bells ring every hour but one. The hour they skip is the hour the Regent's curfew falls, and you are, unfortunately, in the street for it.`,
          `You feel it before you hear it: a held breath, the length of the city. Shutters bang down in sequence like a firing line. A man runs past with a loaf under each arm and a look of professional dread. A woman drags her washing off the line, still wet, still pegged. Somewhere a child is shushed mid-word.`,
          `Then the street is empty and the silence has weight. Far off, hobnails on cobbles: the watch, who are paid by the arrest. A door opens a hand's breadth. A floury arm. "In, in, in, you great fool."`,
          H(g, {
            knight: `Aldous finds his feet know the curfew-step: soft heel, hand clear of the hilt. He did not enforce this curfew. On the first night he stood at a corner and watched it being enforced, which he has since decided was different.`,
            witch: `Isolde pulls her hood forward. A bounty bill two streets back had her nose wrong. It would be hopeful to count on the same mistake twice.`,
            wren: `Wren listens to the silence with something like delight. "The whole city is playing hide-and-seek," Wren whispers, "and nobody told them what happens when you're found."`,
            cantor: `The watch pass the end of the street. Not one lantern swings your way. A dog in a doorway watches you cross the open cobbles, and whines.`,
          }),
          g.flag('knows_unspent') ? `Where the cobbles dip over the old drain there is a faint dry rustle, like a great crowd turning to look.` : ''),
        choices: [
          { label: `[Take shelter with the baker's widow] Heal 14 HP. One chance in three a neighbour informs on you: a fight.`,
            fx(g) { g.healOut(14); return roll(g, 1 / 3) ? 'informed' : 'sheltered'; } },
          { label: `[Walk the empty streets] Even odds: find 100 gold dropped in the rush, or meet the watch: a fight.`, show: notHero('cantor'),
            fx(g) { if (roll(g, 0.5)) { g.gainGold(100); return 'dropped'; } return 'patrol'; } },
          { label: `[Walk the silent hour] No lantern turns your way. Gain 80 gold.`, show: isHero('cantor'),
            fx(g) { g.gainGold(80); return 'silent'; } },
          { label: `[Keep to the shadows and wait it out]`, end: true },
        ],
      },
      sheltered: {
        text: P(
          `The widow bars the door, shoves a stool under your knees and a bowl into your hands. Barley and onion, nothing else, and you eat it like a wolf. She talks the whole time in a low, fast voice: about her husband, who is not dead, merely *unaccounted for since the last roll-call*, and about her son, who is in the Regent's service, which she says in the voice you would use for *in the lock-up*.`,
          `You sleep on the flour-sacks. When the bells begin again the shutters go up all at once, up and down the street, like a flock of birds taking off. You feel better than you have in a week. She will not take payment. "Pay a neighbour," she says. "Someone will need it."`,
        ),
        choices: [{ label: '[Leave]', end: true }],
      },
      informed: {
        text: P(
          `You wake to an orderly knock. Not hammering: a patient three-beat knock, the knock of someone who has never in his life been refused. "Open in the Regent's name."`,
          `The widow stares at the ceiling. "Mistress Tolle," she says. "Next door. She gets four pennies a head." She is not angry. She sounds like someone describing the weather. She is already crossing to unbolt the front, because the alternative is worse for her, and you do not blame her.`,
          `There is a back door, and a wall behind it, and the watch will be a minute counting the knocks.`,
        ),
        choices: [
          { label: '[Hold the front door] Fight the watch.',
            async fx(g) { await g.eventCombat(foes(g, 3, ['crown_zealot', 'regents_inquisitor']), { resume: 'after' }); } },
          { label: '[Out the back and over the wall] Lose 6 HP.', req: hpReq(6),
            fx(g) { g.hurt(6); return 'wall'; } },
        ],
      },
      wall: {
        text: P(
          `The wall is slick with ash and ten feet high on the far side. You come down badly, and lie a moment in a yard full of somebody's hens, listening to the front door open, the orderly voices, the widow's voice saying *no one, no one, only me*.`,
          `You are three streets away before the bell tolls. You do not look back. It occurs to you that she will be questioned all night, and that she will say nothing, and that she was never going to ask you for a penny.`,
        ),
        choices: [{ label: '[Leave]', end: true }],
      },
      dropped: {
        text: P(
          `The cobbles are littered with the day's panic: a hat, a child's shoe, a basket of eggs somehow unbroken, a goose (alive, furious, nobody's) and, in a drain-mouth, a roll of coin someone dropped in the rush for a door. You pocket the coin. You carry the goose a street, then think better of it, and it leaves with dignity.`,
          `When the bell comes the street fills up again as though nothing happened, and nothing did. You pass the baker's widow, buttoning her door. She gives you a long look, as one gives a man who has been out in the weather by choice.`,
        ),
        choices: [{ label: '[Leave]', end: true }],
      },
      patrol: {
        text: P(
          `A lantern swings round the corner and finds you in the middle of the street like a mouse on a tablecloth. "Business?" says the nearest. He asks it in the voice of a man who has asked it nine hundred times and expects the same answer, and a coin.`,
          `You have no coin that will satisfy him. Behind him, three more have stopped to enjoy it.`,
        ),
        choices: [{ label: '[Fight]', async fx(g) { await g.eventCombat(foes(g, 3, ['crown_zealot', 'regents_inquisitor']), { resume: 'after' }); } }],
      },
      silent: {
        text: P(
          `You walk the whole length of the Street of Hours at the hour not rung, and no one sees you. The watch pass within a yard. A boy at a window looks right through you at the moon.`,
          `Every shop on the street has been shut in a hurry. A till here, a purse there, a drawer a frightened man did not have time to lock. You take what the dark owes you, and leave a little behind: a coin on a sill for a child who may one day be asked what he saw.`,
          `*Grief makes people rude,* you tell yourself again. *And inattentive.*`,
        ),
        choices: [{ label: '[Leave]', end: true }],
      },
      after: {
        text: P(
          `The bells ring. The hour is rung, late, as an apology nobody believes in, and shutters go up in sequence down the whole street.`,
          `People come out into the ash blinking like those who have survived a flood, and stand about on their own doorsteps, not quite able to start walking. In Ashgrave you have noticed it is never the curfew that frightens people. It is the moment it lifts, when they have to decide whether to step outside.`,
        ),
        choices: [{ label: '[Leave]', end: true }],
      },
    },
  },

  // ---------------------------------------------------------------- the lion's mouth
  {
    id: 'a3_lions_mouth', title: `The Lion's Mouth`, acts: [3], art: 'scene_chapel',
    pages: {
      start: {
        text: (g) => P(
          `On the wall of St Ulfric's, at the height of a man's elbow, a marble lion's head gapes. Its mouth is a slot as wide as a hand. A brass plate under it reads SPEAK, THAT THE CROWN MAY HEAR. The marble round the lips is polished by a century of fingers.`,
          `Citizens come in ones and twos, glancing both ways, and feed it folded paper. A woman feeds it three and walks off with her chin up. A boy of nine feeds it one and is sick in the gutter. At the foot of the wall a clerk in a grey coat sits at a trestle with a sack, a stamp and a flask. He is paid by the note. He is early, and bored.`,
          H(g, {
            knight: `Aldous counted these in the Shield: eleven hundred in his last winter. He read none. That was the arrangement.`,
            witch: `A printed list of PERSONS SOUGHT is pasted beside the lion. Isolde is third. Her bounty is higher than the two above her. "Flattering," she says, and puts her hood up.`,
            wren: `The lion has no tongue. Wren is delighted. "It's like me. It has to wait for people to fill it in."`,
            cantor: `Someone has scratched a line of the Requiem on the plate: *Lord, receive what is spoken in the dark.* The clerk's flask is propped against it.`,
          })),
        choices: [
          { label: `[Pull the notes out of the lion] Lose 5 HP (the teeth are iron). Remove a card from your deck.`,
            req: (g) => (hpReq(5)(g) === true ? deckReq(1)(g) : hpReq(5)(g)),
            async fx(g) { g.hurt(5); await g.removeCardChoice(1, 'Choose a card to burn with the notes'); g.unlockLore('lore_a3_lions_mouth'); return 'pulled'; } },
          { label: () => `[Feed the lion a name] Gain 100 gold. Become Cursed — ${curseName('shame')}.`,
            fx(g) { g.gainGold(100); addCurse(g, 'shame'); g.setFlag('a3_denounced'); g.unlockLore('lore_a3_lions_mouth'); return 'fed'; } },
          { label: `[Feed the lion the Regent's name] Lose 10 gold. Heal 8 HP.`, req: goldReq(10),
            fx(g) { g.loseGold(10); g.healOut(8); g.unlockLore('lore_a3_lions_mouth'); return 'regent'; } },
          { label: `[Walk on]`, end: true },
        ],
      },
      pulled: {
        text: P(
          `You ask the clerk for a light, and while he fumbles the flask and the tinderbox you slide your arm into the lion to the shoulder. The mouth is warm: not like a living thing, like a hand that has been held a long time. Iron teeth close on your sleeve and bite through it to the wrist. You haul out a double handful of paper.`,
          `You read as you walk. *My brother's wife sings at her washing. My landlord says the King is dead. A man at the Hart and Hound said, if it's been ninety years, who was it that was young?* You feed the whole armful to the first brazier you pass. Eleven hundred lives, give or take, go up in one sheet of flame. Nobody thanks you. Nobody knows. It is very satisfying.`,
        ),
        choices: [{ label: '[Leave]', end: true }],
      },
      fed: {
        text: P(
          `You write the first name that comes: the pie-seller on the corner, Hobb Sellick, who gave you short change and a look, *for singing the old Coronation song in the street.* It isn't true. The pen is quite smooth. The mouth takes the paper like a dog taking a biscuit.`,
          `The clerk counts coin into your palm out of his sack. "Efficient," he says, stamping a little crown on a receipt you did not ask for. "We're very grateful for public spirit."`,
          `By dusk there will be a knock on Sellick's door. You know exactly what hour. The coins are heavy, and you find you cannot decide which of your hands is the dirty one.`,
        ),
        choices: [{ label: '[Leave]', end: true }],
      },
      regent: {
        text: P(
          `You borrow his pen and write, in a fair round hand: *Lord Severin Crane, Regent, for treason against the Crown, in that he governs it.* The clerk reads it upside down. Something flickers across his tired face. "That's four this week," he says. "Ten for the fee." He stamps it and drops it in a separate sack labelled REGENT, so full it has a belly, with a drawstring that has been replaced several times.`,
          `"He reads them himself," the clerk adds. "Sundays. Says it keeps him humble." He laughs, a short dry frightened sound, quickly stopped. You laugh with him the way you laugh at funerals, and it goes through you like warm wine.`,
        ),
        choices: [{ label: '[Leave]', end: true }],
      },
    },
  },

  // ---------------------------------------------------------------- the empty cushion
  {
    id: 'a3_empty_cushion', title: 'The Empty Cushion', acts: [3], art: 'scene_city',
    pages: {
      start: {
        text: (g) => P(
          `They come down the Street of Hours in two grey columns, barefoot in the cinders, with ash on their foreheads in the shape of a circle that does not quite close. Between the columns four men carry a litter, and on the litter, on a cushion of black velvet, there is nothing.`,
          `The nothing has been polished. You can tell by how they carry it: like a bowl of soup, like a baby. People in the street go to their knees as it passes. The ones who don't are quietly crossed off by a boy with a slate. *Hail the Held Hour,* the procession sings, *hail the Hollow, hail the Hand that is Coming.* The Hand has been coming for ninety-one years, and the Regent allows the cult because it keeps people occupied while it comes.`,
          H(g, {
            knight: `A man at the front stares at Aldous and mouths *the Shield.* Aldous looks at the cushion. The dent in it is the exact shape of the Crown.`,
            witch: `"Cults," Isolde mutters, "are medicine for people who can't stand the cure."`,
            wren: `The cushion has a small round dent in it, the size of a fist. As Wren passes, all four bearers falter together, and the nothing on the velvet seems, for a moment, to lean.`,
            cantor: `They sing the Hymn in the wrong mode. It sets Cael's teeth on edge. He has the strongest urge to correct the second verse, and the stronger sense that no one would hear him.`,
          })),
        choices: [
          { label: `[Kneel with the crowd] Lose 20 gold (the plate). Heal 12 HP.`, req: goldReq(20),
            fx(g) { g.loseGold(20); g.healOut(12); g.unlockLore('lore_a3_held_hour'); return 'kneel'; } },
          { label: () => `[Carry the litter a street] Choose 1 of 3 rare cards. Become Cursed — ${curseName('crowns_whisper')}.`,
            async fx(g) { addCurse(g, 'crowns_whisper'); g.unlockLore('lore_a3_held_hour'); await offer(g, { rarity: 'rare' }, 'What the cult remembers'); return 'carry'; } },
          { label: `[Shout "He's dead!"] Fight the procession. Reward: 60 extra gold.`,
            async fx(g) { g.unlockLore('lore_a3_held_hour'); g.unlockLore('lore_a3_crown_zealots'); await g.eventCombat(foes(g, 3, ['crown_zealot', 'crown_zealot', 'crown_zealot']), { resume: 'heckled', reward: { gold: 60 } }); } },
          { label: `[Step into a doorway and let them pass]`, end: true },
        ],
      },
      kneel: {
        text: (g) => P(
          `You kneel on the cinders with the rest. The ash is cold and fine as flour. The sisters come down the line with a wooden plate, dented by a great many coins, and you put in what you can. "Held," says a sister, and marks your forehead with her thumb. "Held, held."`,
          `It is absurdly restful. For the length of the litter's passing there is nothing to decide. The Hour is held, you are held with it, and the weight slides out of your shoulders and into the ground, where, you cannot help thinking, a great many weights have gone before.`,
          H(g, { wren: `Wren has no forehead to mark, so the sister marks the mask. It does not come off all day.` }),
          `When you stand, the thumb-mark is not quite a circle. It is a circle with a place left open.`),
        choices: [{ label: '[Leave]', end: true }],
      },
      carry: {
        text: P(
          `You step out of the crowd and take the corner of the litter from a bearer who is staggering, and nobody objects; the man simply sags with relief and vanishes. The pole settles into your shoulder.`,
          `It is not heavy. That is the first thing. The cushion weighs nothing, as it should, and still your knees want to bend. A low note comes up through the wood into your collarbone, like a hive, like a bell struck a long way off underwater. *Ah,* it says, with unmistakable pleasure. *There you are.*`,
          `You carry it three streets to the cathedral steps and set it down, and the hum stays in your teeth for an hour. A sister, weeping, presses on you what the cult keeps for its saints: a way of doing a thing, taught in secret. Behind your eyes something has noted your face, and means to remember it.`,
        ),
        choices: [{ label: '[Leave]', end: true }],
      },
      heckled: {
        text: P(
          `The last of them goes down at the foot of the litter, and the litter goes down with him, and the cushion rolls nowhere, because there is nothing on it to roll. It lies in the ash like discarded theatre. The crowd dropped to its knees at the first blow and has stayed there. It is the safest place.`,
          `A boy with a slate wipes something off it and writes something else. You have the particular feeling of being watched from every window on the street. Probably you are.`,
          `Behind one shutter a woman says very quietly, to the dark, *thank you,* and the shutter stays closed.`,
        ),
        choices: [{ label: '[Leave]', end: true }],
      },
    },
  },

  // ---------------------------------------------------------------- the court that bows
  {
    id: 'a3_empty_court', title: 'The Court That Bows', acts: [3], art: 'scene_court',
    pages: {
      start: { text: courtIntro, choices: courtChoices(true) },
      gossip: {
        text: P(
          `The court cannot lift its head, but it can talk, and when you ask they all do at once, in a hush like silk tearing.`,
          `*He comes at night.* *Every night.* *He sits in the third chair from the throne and asks us what happened yesterday.* *We tell him. We always tell him the same.* *And he thanks us.* *And asks again.*`,
          `"Who?" you say. A hundred pale voices: *The Chancellor. The Regent. Lord Crane. He is the only one who sits.* "And then?" The woman in ostrich feathers answers, in a thread of a voice. *He looks at the throne a long time. And he says: not yet.*`,
        ),
        choices: courtChoices(false),
      },
      rise: {
        text: (g) => P(
          `"Rise," you say.`,
          `Nothing happens for a long time. Then the woman in ostrich feathers makes a small sound like a kettle, and her spine creaks upright vertebra by vertebra, and she says in a dry high voice, "Oh, *thank God,*" and then, aghast, "Thank — Your Majesty." "I'm not," you say. "No," she agrees, "but you said the word."`,
          `One by one they straighten and look at each other with the shy horror of people who have missed a century of their own lives. The bishop begins a blessing, forgets it, weeps. Each, passing, touches your sleeve, a dry light goodbye, and goes out through the tall doors into the ash, thinning with every step. Something of what they were stays behind in you, warm as a coat.`,
          H(g, { cantor: `Cael sees the last of them to the door and says the Commendation, and this time every one of them answers.` })),
        choices: [{ label: '[Leave]', end: true }],
      },
      chain_ok: {
        text: P(
          `The chain comes off the chamberlain's neck as easily as a scarf off a statue. He does not stir. Nobody has touched it in ninety years, and the gold is heavy, old gold, softer than it should be, and there is a great deal of it. You wind it round your arm and walk down the long tiles with the court bowing on either side like wheat in a wind.`,
          `At the doors you look back. The chamberlain's staff is still raised. His face has not changed. But his eyes have followed you, all the way, and there is nothing in them that looks like anger. Only something terribly like envy.`,
        ),
        choices: [{ label: '[Leave]', end: true }],
      },
      chain_bad: {
        text: P(
          `The chain comes away in your hand and every candle in the Chamber leans toward you at once.`,
          `"*Announcing,*" says the chamberlain, in a voice that has changed, and for the first time in ninety years his staff comes down on the tile. The bowing stops. Nine hundred heads come up together, pale as plates, and every one of them is looking at the chain in your hand.`,
        ),
        choices: [{ label: '[Draw steel]', async fx(g) { g.unlockLore('lore_a3_court_phantoms'); await g.eventCombat(foes(g, 3, ['court_phantom', 'court_phantom', 'court_phantom']), { resume: 'after_court' }); } }],
      },
      after_court: {
        text: P(
          `When the last of them goes out like a snuffed candle the Chamber is very quiet. The chamberlain, who took no part, is still at the edge of the tile with his staff, watching you with deep reproach.`,
          `"There will be a report," he says. Nothing else. After a long while he strikes the floor, once, softly, for no one, and says to the throne, "Announcing... no one." Then he sits down on the bottom step and puts his head in his hands.`,
        ),
        choices: [{ label: '[Leave]', end: true }],
      },
    },
  },

  // ---------------------------------------------------------------- the registry
  {
    id: 'a3_registry', title: 'The Register of Deaths', acts: [3], art: 'scene_crypt',
    pages: {
      start: {
        text: (g) => P(
          `The Registry of Births, Marriages and Deaths fills the whole east cloister of the Chancery, and is the quietest place in Ashgrave, which is saying something. Shelves of ledgers climb into the dark. An old clerk in sleeve-guards sits at a lectern with a pen that has not been dipped in some while.`,
          `"Births," he says proudly, pointing left at a wall of ledgers thick as bricks. "Marriages," a shorter wall. "Deaths." He lifts the lid on a single thin volume, green with age. The last entry is in the Long King's twentieth year. A cat, he explains, belonging to the Queen's cousin. It was permitted, as a favour. "Since then, nothing. It's restful. I haven't had to rule a margin in decades."`,
          H(g, {
            knight: `Aldous asks, for no reason he'll admit to, for the King's entry. The clerk finds it: *Aldric Aurelian Morrow, born at Michaelmas. Died:* and a blank. "Not entered, sir." "He's dead," Aldous says. The clerk looks hopeful. "Is he? Then someone ought to say."`,
            witch: `"A registry of deaths with no deaths in it," Isolde says. "If this were a patient, I'd say it had stopped breathing."`,
            wren: `Wren runs a finger down a Births page and stops. "Everyone's got a mother," Wren says, wondering. "It's written right here, in a column." The clerk glances at the mask and discreetly turns the page.`,
            cantor: `Cael leafs the thin green volume with great care. "I buried eleven hundred people in this city," he says. "Not one of them is in here." The clerk does not look up. The pen stays dry.`,
          })),
        choices: [
          { label: `[Enter a death in the ledger] Lose 6 HP. Remove 2 cards from your deck.`,
            req: (g) => (hpReq(6)(g) === true ? deckReq(3)(g) : hpReq(6)(g)),
            fx(g) { g.unlockLore('lore_a3_register'); return 'enter'; } },
          { label: `[Ask for your file] Lose 20 gold (the clerk's fee).`, req: goldReq(20),
            fx(g) { g.loseGold(20); g.unlockLore('lore_a3_register'); return 'file'; } },
          { label: `[Ask where the uncounted go]`, show: (g) => !!g.flag('knows_unspent'),
            fx(g) { g.unlockLore('lore_a3_register'); return 'uncounted'; } },
          { label: `[Leave the ledgers be]`, end: true },
        ],
      },
      enter: {
        text: (g) => P(
          `"Anyone," the clerk breathes, and holds out the pen. His hand shakes. "Anyone at all."`,
          H(g, {
            knight: `Aldous writes it in his own square hand. *Aldric Aurelian Morrow, called the Long. Died: Ashfall. Cause:* he stops. The pen waits. He writes: *Unattended.* Then, because it is the truth, *By me.*`,
            witch: `Isolde writes the name of the first child she ever lost to the marsh fever, and then, below it, in smaller and smaller letters, every one of the others. The page fills. The pen does not run dry.`,
            wren: `Wren cannot think of a name. "I don't know who to be sad for," Wren says. The clerk suggests, gently, *anyone you've known who isn't here now.* Wren thinks for a long while, and writes a number of names, and all of them are masks.`,
            cantor: `Cael writes the last ten he buried, name, age, date, place, as he said them over the grave. It comes without thought, a liturgy. At the end, without being asked, he writes *Let them rest.*`,
            any: `You write the name of someone you could not save, and the date, and the place.`,
          }),
          `The pen is cold and heavy as though it were made of the thing it writes. When you lift it the ink does not dry. It shines. Somewhere in the stacks something releases a breath it has held since before the clerk was young, and the old man is weeping, quietly, with joy, over the ledger. "Permitted," he says. "Permitted."`,
        ),
        choices: [{ label: `[Let it go] Lose 6 HP. Remove 2 cards from your deck.`,
          req: (g) => (hpReq(6)(g) === true ? deckReq(3)(g) : hpReq(6)(g)),
          async fx(g) { g.hurt(6); await g.removeCardChoice(2, 'Choose 2 cards to let go'); } },
        { label: '[Put the pen down]', end: true }],
      },
      file: {
        text: (g) => P(
          `The clerk is back in a minute with a slim folder tied in black ribbon. "Third Bureau," he whispers, disapproving. "They file here. His lordship likes to have things in one place."`,
          H(g, {
            knight: `*VANE, A. Stands. Waits. Obeys the last order given him and several that weren't. Predicted response to threat: stands.* Below, in a different hand: *Do not offer him a door.*`,
            witch: `*MARROW, I. Brilliant, vindictive, unmarried. Exposed to the Blight in childhood without effect (!). Predicted response to kindness: suspicion. To insult: composition. Will insist she is not sentimental.* In the margin: *She is.*`,
            wren: `*WREN. No surname. Face on record: (blank). Height: variable. Origin: the castle steps.* A line has been struck through, and over it, in a hand that presses very hard: *On no account is anyone to take hold of this one.*`,
            cantor: `*CAEL, Brother. Confessor to the late King. Last seen: the King's bedchamber, Ashfall night. Subsequent sightings: numerous, all unreliable. Chapter attendance rolls: —* The word that follows has been rubbed out so thoroughly that the paper has worn thin.`,
          }),
          `You have not been told anything you did not, somewhere, already know. That is what makes it hard to shake off.`),
        choices: [
          { label: `[Take the lesson to heart] Transform a card of your choice.`, req: deckReq(1),
            async fx(g) { await g.transformCardChoice(1); } },
          { label: `[Hand it back unread]`, end: true },
        ],
      },
      uncounted: {
        text: P(
          `The clerk lowers his voice until it is only the movement of his sleeve-guards. "There's a Register Below," he says. "I have never seen it. The stair is behind the third pillar and the key has been the Chancellor's since the old King's time. But I hear it, miss, in the long evenings. Scratching. As of a great many pens, not one of them with ink."`,
          `He folds his hands on the lectern. "I should like to think they're finishing the entries. I should like very much to think so."`,
        ),
        choices: [{ label: '[Leave]', end: true }],
      },
    },
  },

  // ---------------------------------------------------------------- the ward of the stopped
  {
    id: 'a3_stopped_ward', title: 'The Ward of the Stopped', acts: [3], art: 'scene_chapel',
    pages: {
      start: {
        text: (g) => P(
          `The Guildhall of the Drapers has been given over to the Blight. Two hundred cots in rows under painted rafters, and on every cot a person lying on their back with their eyes open. Nobody coughs. Nobody tosses. Along the aisles walk the plague doctors, tall as herons, beaks stuffed with rue, taking pulses with gloved fingers and writing the same figure in the same ledger: *no change.*`,
          `A ward-sister with a face like a shut door catches your sleeve. "You're not the new physician." "No." "Pity." She doesn't let go. "Can you hold a cup? We're short. They don't drink. We tip it in, they swallow, that's all they do. They've been swallowing for two months."`,
          H(g, {
            knight: `Aldous takes off his gauntlets without being asked, sits by a bed and takes a stranger's hand. He is not sure why. He thinks of a king. He thinks of a door.`,
            witch: `Isolde has gone very still beside the nearest cot, two fingers to a throat, a thumb lifting an eyelid. "No fever. No sweat. No swelling. No *rot,* Sister, in a plague ward." Her voice climbs. "Nothing here is decaying. Nothing here is being *allowed to.*"`,
            wren: `A woman on the nearest cot turns her eyes, only her eyes, and follows Wren down the aisle. "It's the mask," the sister says. "They follow new faces." But Wren saw the woman's eyes, and they were not following a mask.`,
            cantor: `Cael walks the aisles with one hand raised, murmuring the Commendation. A few cots on, an old man's lips move with his. Only the lips. "Saints," says the sister, tipping a cup. "He's never moved before."`,
          })),
        choices: [
          { label: `[Tip the cups through the night] Lose 8 HP. Obtain 2 random Tinctures.`, req: hpReq(8),
            fx(g) { g.hurt(8); giveTinctures(g, 2); g.unlockLore('lore_a3_stopped_ward'); return 'tipped'; } },
          { label: `[Take the doctors' purge] Lose 35 gold. Remove a curse from your deck.`,
            show: (g) => hasCurse(g), req: goldReq(35),
            async fx(g) { g.loseGold(35); await removeCurse(g); g.unlockLore('lore_a3_stopped_ward'); return 'purged'; } },
          { label: `[Examine the stopped through the night] Lose 4 HP. Upgrade 2 random cards.`, show: isHero('witch'), req: hpReq(4),
            fx(g) { g.hurt(4); g.upgradeRandom(2); g.unlockLore('lore_a3_stopped_ward'); return 'examined'; } },
          { label: `[Rob the dispensary] Gain 60 gold and 2 Tinctures, then fight the doctors.`,
            async fx(g) { g.gainGold(60); giveTinctures(g, 2); g.unlockLore('lore_a3_stopped_ward'); g.unlockLore('lore_a3_plague_doctors'); await g.eventCombat(foes(g, 3, ['plague_doctor', 'gilded_sentinel']), { resume: 'robbed' }); } },
          { label: `[Back out quietly]`, end: true },
        ],
      },
      tipped: {
        text: P(
          `You hold the cups. It is slow work: the tilted head, the trickle, the pause, the swallow, the next. They swallow with their eyes open, looking at nothing, or at the same patch of rafter. Nobody thanks you. At the third hour you realise you are humming something to the old woman in bed forty. At the fifth you realise she has been humming it back, a thread of sound with no breath behind it.`,
          `At dawn the sister is asleep standing up. She wakes, looks at what you have done, and says "Hm." Then she opens the dispensary with a key from her apron, takes two brown bottles off a shelf the doctors forgot, and puts them in your hands. "Not for them," she says. "They don't need it. For the ones who keep the cups."`,
        ),
        choices: [{ label: '[Leave]', end: true }],
      },
      purged: {
        text: P(
          `The head doctor takes your coin without a word and sets you in a chair beneath a framed engraving of the Humours. The purge is a thing of lancets, leeches and a cup of something black. It takes an hour. You will not describe it, later, to anyone.`,
          `When it is done you feel as though you have been wrung out and hung up to dry in a clean, cold wind. The thing that was sitting in your deck has gone, and left only a faint ache where it sat. "Always the same," says the doctor, wiping his lancet. "People think it's the blood. It's never the blood."`,
        ),
        choices: [{ label: '[Leave]', end: true }],
      },
      examined: {
        text: P(
          `You go cot to cot with Isolde's patience and a borrowed lamp, and by the fourth hour you have the beginning of an answer, and by the sixth you wish you had not. The hearts beat. The lungs fill. The blood runs clean and slow as oil. They are not ill. They are not dying. They are, with exquisite precision, *waiting,* the way a man waits in a corridor outside a room he has been told to stay out of.`,
          `You put it in your notebook in two words, because that is all there is room for. The words are *a queue.* You underline them, and your hand does not shake, and then it does.`,
        ),
        choices: [{ label: '[Leave]', end: true }],
      },
      robbed: {
        text: P(
          `The last of the doctors folds over his own beak like a bird going down in a field. The ward does not stir. Two hundred sets of open eyes have not so much as blinked at the noise; the swallowing goes on, patient, steady, from cot to cot.`,
          `The sister stands in the doorway with her arms folded. She has not lifted a finger to help either side. "I'll tell them it was the Blight," she says at last. "They'll believe that. They believe it of everything." And, as you pass: "Take the good bottles. The ones with the red wax. Don't leave anything for them to count."`,
        ),
        choices: [{ label: '[Leave]', end: true }],
      },
    },
  },

  // ---------------------------------------------------------------- gilders' row
  {
    id: 'a3_gilders_row', title: 'We Preserve', acts: [3], art: 'scene_market',
    pages: {
      start: {
        text: (g) => P(
          `The sign says WE PRESERVE in gold leaf, and under it, smaller, in the same gold: *Everything. Anything. Anyone.* Along Gilders' Row Ashgrave has been keeping itself from spoiling. A gilded loaf in a gilded window. A gilded cat on a gilded step, mid-lick. A man gilded from shoes to hat, asleep in a sedan chair, one fist curled round a gilded purse, with a tiny crack at his ankle where the gold has begun to flake and something dry shows underneath.`,
          `The gilder herself is gold to the elbows, with a face like a clever walnut. "Rot," she says warmly, "is for the poor. Come in, dear. What can I keep for you?"`,
          H(g, {
            knight: `She looks at Aldous's armour, nicked and tarnished, and sucks her teeth. "Oh, that's a *waste.*" He finds he agrees, and is annoyed with himself.`,
            witch: `Isolde rubs a gilded loaf with her thumb. Under the leaf: green. "You can't stop it," she says. "You can only hide it, and badly." "Then you'll know how well it's hidden, dear," says the gilder, "which is the point."`,
            wren: `"A mask in *silver,*" the gilder breathes, tracing the air an inch from Wren's face. "I could do you in gold. You'd never lose it, and nobody could tell it from the real thing." "I know," says Wren. "That's the trouble."`,
            cantor: `The gilder looks Cael over with professional appreciation. "You've kept beautifully," she says. "Whoever did your preserving, dear, I should like their name."`,
          })),
        choices: [
          { label: `[Be gilded, hand and brow] Lose 7 Max HP. Upgrade 2 cards of your choice.`, req: upReq(2),
            async fx(g) { g.loseMaxHp(7); await g.upgradeCardChoice(2); g.unlockLore('lore_a3_gilders'); return 'gilded'; } },
          { label: `[Sell her a memory] Remove a card from your deck. Gain 60 gold.`, req: deckReq(1),
            async fx(g) { await g.removeCardChoice(1, 'Choose a memory to sell'); g.gainGold(60); g.unlockLore('lore_a3_gilders'); return 'sold'; } },
          { label: () => `[Scrape the sleeper's purse] Gain 130 gold. Become Cursed — ${curseName('rot_touched')}.`,
            fx(g) { g.gainGold(130); addCurse(g, 'rot_touched'); g.unlockLore('lore_a3_gilders'); return 'scraped'; } },
          { label: `[Admire the cat and move on]`, end: true },
        ],
      },
      gilded: {
        text: P(
          `It does not hurt. That is the horror of it. She works with a camel-hair brush and a book of leaf as thin as breath, humming, and the gold goes on cool and goes on weightless, and under it your skin goes quiet: no more itch, no more sweat, no more small private aches. Your pulse sounds a long way off.`,
          `"There," she says at last, blowing the loose leaf from your knuckles. "Proof against time. Not against *steel,* mind." She holds up a hand-mirror. A very handsome stranger looks out of it, a little stiff about the mouth. You find you are holding yourself differently. You find you are sharper, and also, by some small measure you cannot name, less.`,
        ),
        choices: [{ label: '[Leave]', end: true }],
      },
      sold: {
        text: P(
          `She has you describe it, whatever it is, into a little green bottle, and then she corks it and shakes it and holds it to the light, where it shines like a boiled sweet. "Oh, that's a good one," she says. "That'll keep for centuries. Clients love a vintage."`,
          `The coin is real. You are not entirely sure you can remember what you sold. You can remember that it was good. You can remember that it mattered, in the way you remember the shape of a missing tooth with your tongue.`,
        ),
        choices: [{ label: '[Leave]', end: true }],
      },
      scraped: {
        text: P(
          `The gold peels off the sleeper's purse in sheets, soft as lead, and underneath is a hand like a bundle of dry twigs, and under that nothing at all. You fill your pockets with leaf. The sleeper does not wake. You tell yourself he does not mind.`,
          `The gilder watches from her doorway with her arms folded and says nothing, and that is the worst of it. When you hold the leaf to the light there are tiny green freckles in it, a spreading bloom no gilder's leaf will ever quite keep out. "Don't worry, dear," she calls, sweetly, as you go. "It only shows on the *inside.*"`,
        ),
        choices: [{ label: '[Leave]', end: true }],
      },
    },
  },

  // ---------------------------------------------------------------- night work
  {
    id: 'a3_night_soil', title: 'Night Work', acts: [3], art: 'scene_undercroft',
    pages: {
      start: {
        text: (g) => P(
          `Past the Tannery Gate, in the hour before the hour not rung, six men in oilcloth are prising up a grate with a crowbar and a great deal of swearing. A cart waits. A lantern hangs from a pole. It smells like you would think, and also, faintly underneath, like a church that has been shut for centuries.`,
          `The foreman is a square, grey man named Marl, who has cleaned Ashgrave's drains for seventy-four years and has the forearms to show for it. He gives you the look night-soil men give everyone: is this a customer, or a story. "Sixty feet of drain," he says. "We go down that. No further. Past the second grate the rats stop, and it's —" he spits — "not rats."`,
          g.flag('knows_unspent')
            ? `He looks at you a long moment. "You've heard it," he says. It isn't a question. "Well. That's two of us who'll sleep badly."`
            : `"Rumours, plenty of them," he adds. "Don't go listening at grates. That's how the rumours start."`,
          H(g, {
            knight: `Marl's eyes go to Aldous's sword and then his face. "You're old Shield. You'll want to see this. Everyone from the Shield wants to see it, in the end."`,
            witch: `Isolde sniffs the draught and goes pale in an interesting way. "That isn't sewage. That's rot. Old rot, a very great deal of it, very patient."`,
            wren: `As the grate lifts, a warm wet draught comes up, and Wren, for no reason, takes off a glove and holds a bare hand over the hole, palm down, as at a fire. "It's warm," Wren says. Marl takes a step back.`,
            cantor: `Below the grate, very faintly, a hundred thousand voices are saying the responses to the Office for the Dead. They are a line behind. They are asking to be let finish.`,
          })),
        choices: [
          { label: `[Lie down and listen at the grate] Lose 6 HP. Transform a card.`, req: (g) => (hpReq(6)(g) === true ? deckReq(1)(g) : hpReq(6)(g)),
            fx(g) { g.hurt(6); g.unlockLore('lore_a3_night_soil'); return 'listen'; } },
          { label: `[Buy Marl's map of the lower drains] Lose 50 gold. Fight what lives in the walls. Reward: a random relic.`, req: goldReq(50),
            async fx(g) { g.loseGold(50); g.unlockLore('lore_a3_night_soil'); await g.eventCombat(foes(g, 3, ['lamplighter', 'chimney_wraith', 'chimney_wraith']), { resume: 'mapped', reward: { relic: 'random' } }); } },
          { label: `[Answer the grate: "Soon."] Gain 6 Max HP.`, show: (g) => !!g.flag('knows_unspent'),
            fx(g) { g.gainMaxHp(6); g.unlockLore('lore_a3_night_soil'); return 'soon'; } },
          { label: `[Leave them to their work]`, end: true },
        ],
      },
      listen: {
        text: P(
          `You lie on the wet cobbles with your cheek against the iron and hold your breath. At first only water. Then, under the water, a sound like wind in a very large building. Then the wind resolves into voices, and the voices into one question, repeated by a crowd too large to count, in every register from a child's to a very old man's.`,
          `*Is it time?*`,
          `*Is it time yet?*`,
          `You hear it in the bones of your jaw. When you stand up, Marl is holding your arm, and the others have drawn away with the cart. Something small in you has been turned over and set back down, and not quite where it was. "Don't tell them," says Marl. "Whatever you do. Don't tell them it isn't."`,
        ),
        choices: [{ label: '[Change what must be changed]', req: deckReq(1), async fx(g) { await g.transformCardChoice(1); } }],
      },
      mapped: {
        text: P(
          `Marl's map is drawn on the back of a laundry bill in a hand like a spider's. It leads down a stair that was never meant for traffic, through a wall that has been mended in four different centuries, to a cellar once belonging to a gentleman of the court who was *kept,* fifty years ago, for a reason nobody gave.`,
          `The things in the walls came out of the soot. They are quiet now. In the cellar, under a rotted tarpaulin, you find the gentleman's strongbox, and in it, wrapped in a lady's glove, the only thing in Ashgrave nobody has bothered to confiscate. Marl is waiting at the top of the stair with his cart. "Told you," he says, not unkindly. "Sixty feet."`,
        ),
        choices: [{ label: '[Leave]', end: true }],
      },
      soon: {
        text: P(
          `You crouch at the mouth of the grate and put your lips to the iron. "Soon," you say.`,
          `The voices do not stop. They *change.* The question breaks off mid-word, as when a congregation is stopped by a hand lifted in the pulpit, and then there is a sound you will not forget: a hundred thousand people breathing out together, very slowly, in relief.`,
          `Marl has taken off his cap. The men with the cart have taken off theirs. Something comes up out of the dark and settles on you, gently, like a hand on a head: not a blessing exactly, only the thing that comes before one. You are warm all the way through. "Don't you break that," says Marl, in a rough voice. "Whatever it was. Don't you ever."`,
        ),
        choices: [{ label: '[Leave]', end: true }],
      },
    },
  },

  // ---------------------------------------------------------------- the gentleman who expected you
  {
    id: 'a3_expected', title: 'A Gentleman Who Was Expecting You', acts: [3], art: 'scene_market',
    pages: {
      start: {
        text: (g) => P(
          `A café table has been set in the middle of the Street of Pens: white cloth, two cups, a pot of tea that is still steaming, and a pleasant, forgettable man in a grey coat who rises as you approach and pulls out the other chair.`,
          `"There you are. Lemon? You take it without, I know, but one must offer." His hands are very clean. "You are about to say that you've no time for this and you don't know who I am. I do wish you'd skip it. I've heard it so often." He pours. "The Regent sends his compliments. He says you have been exactly as expected. He says that is not a criticism."`,
          expectedLine(g),
          H(g, {
            knight: `"Ser Aldous. You will put your hand on your sword and not draw. You never do at tables."`,
            witch: `"The tea isn't poisoned, Mistress Marrow. You'll check it anyway. Here is a spoon." He passes her a spoon. She checks it anyway.`,
            wren: `"And you," he says to Wren, after a longer pause than he gave anyone else, "we have no file for. That is the interesting thing. His lordship is rather taken with it."`,
            cantor: `He sets a cup before Cael without looking at him. Not a flicker. You realise he isn't sure Cael is there; he has been told to be polite to the possibility.`,
          })),
        choices: [
          { label: `[Bet him he can't guess your next words] Even odds: gain 100 gold, or lose 60 gold.`,
            fx(g) { return roll(g, 0.5) ? 'bet_won' : 'bet_lost'; } },
          { label: (g) => `[Accept the Regent's courtesy] Obtain ${relicFull(g, 'regents_seal')}. Become Cursed — ${curseName('doubt')} (you will be watched).`,
            fx(g) { giveRelic(g, 'regents_seal', 'uncommon'); addCurse(g, 'doubt'); g.setFlag('a3_took_seal'); g.unlockLore('lore_a3_third_bureau'); return 'courtesy'; } },
          { label: (g) => `[Upend the table] Fight the Bureau's watchers. Reward: ${relicFull(g, 'regents_seal')}.`,
            async fx(g) { g.unlockLore('lore_a3_third_bureau'); await g.eventCombat(foes(g, 3, ['crown_zealot', 'regents_inquisitor']), { resume: 'after_bureau', reward: { relic: rewardRelic(g, 'regents_seal') } }); } },
          { label: `[Decline the tea and walk away]`, end: true },
        ],
      },
      bet_won: {
        text: P(
          `"A wager," he says, delighted, and writes something on a card and slides it face down. You tell him, firmly, that the Archcanon is a hundred and forty-one and wears a wig made of his own hair, and then, since you are in it now, that your favourite colour is the sound of a door.`,
          `He turns the card over. *She will ask whether the tea is poisoned.* He looks at it for some time. He looks at you. The pleasant face does something you would not have thought it could do. It becomes, briefly, a face.`,
          `"Well," he says. "How very interesting." He counts out a hundred, in clean notes, without being asked, and does not meet your eye. "I'll put it in the report. They won't believe it."`,
        ),
        choices: [{ label: '[Leave]', end: true }],
      },
      bet_lost: {
        text: P(
          `"A wager," he says, delighted, and writes something on a card and slides it face down. You say the most absurd thing that comes into your head. It is a very good absurd thing. You are rather proud of it.`,
          `He turns the card over. It has your words on it, in order, with the pause where you paused. Under them he has written, neatly, *and she will be proud of it.*`,
          `"Sixty," he says apologetically, holding out his hand. "I did say. It isn't that you're predictable. It's that we've had *so* much practice." He pockets the coin and, to take the sting out, pours you more tea. It is excellent tea. You drink it.`,
        ),
        choices: [{ label: '[Leave]', end: true }],
      },
      courtesy: {
        text: P(
          `"A small thing," he says, and lays on the cloth a wax seal on a ribbon, crimson, with a crane in it, wings spread. "Present it at any door in Ashgrave. They will open. They will also note the hour and the name, but one can't have everything."`,
          `You pick it up. It is warm. As your fingers close, a faint sensation passes over the back of your neck, like the first breath of a draught in a room that has been shut for years, and you know without turning that in a window across the street a curtain has just been let fall.`,
          `"You'll find," he says, pleasantly, "that you're rather more *noticed* than you were. Do be sure to enjoy it." He is already pouring someone else's cup.`,
        ),
        choices: [{ label: '[Leave]', end: true }],
      },
      after_bureau: {
        text: P(
          `The table is on its side, the cups in pieces, the tea running between the cobbles toward the gutter. The pleasant man in grey is not among the fallen. You are sure he was here. You are, for a moment, not sure of anything.`,
          `On the cloth, somehow unspilled, sits one cup, still steaming. Under it is a card. It reads, in a neat, unhurried hand: *That went about as expected. With thanks.* Under that, smaller: *Do mind the seal. It likes to be held.*`,
        ),
        choices: [{ label: '[Leave]', end: true }],
      },
    },
  },

  // ---------------------------------------------------------------- the hall of seized goods
  {
    id: 'a3_seized_goods', title: 'The Hall of Seized Goods', acts: [3], art: 'scene_ruins',
    pages: {
      start: {
        text: (g) => P(
          `The Corn Exchange has been made a pawnbroker's by the Crown. Everything confiscated since Ashfall is tagged and shelved: cradles, cooking-pots, lutes, wedding-rings in jars, a rocking-horse, three thousand pairs of spectacles on a single pole. Each tag is in a clerk's hand. *Denounced: R. Hask, for grief. Denounced: Mistress Orme, for laughing at the wrong hour. Denounced: the Fishers' Guild, for knowing.*${g.flag('a3_denounced') ? ' Near the door, on a pie-tin: *Denounced: H. Sellick, for song.*' : ''}`,
          `A board on the wall: GOODS MAY BE RECLAIMED BY THEIR OWNERS ON PROOF. UNCLAIMED GOODS PASS TO THE CROWN AT THE NEXT AUCTION. The proof, you notice, costs sixty gold. The next auction is tomorrow, and every day.`,
          H(g, {
            knight: `On a trestle by the door, tagged *VANE, A., formerly of the Shield,* lies a sword. The old one, with the gilt hilt, taken from him the morning after Ashfall. He puts his hand on it. It feels like a stranger's hand.`,
            witch: `A shelf of jars marked MARROW HOUSE, SEIZED. Dried foxglove, black hellebore, a mortar with a thumb-print worn into the stone. Isolde says nothing. She crosses the floor and lays her palm on the mortar.`,
            wren: `Row on row of masks hang from nails, each tagged with a name that isn't theirs: *Denounced: the Mummers' Guild, for faces.* Wren's hand finds a wolf-mask and holds it. It is warm. It is the same warmth as every mask Wren has ever put on.`,
            cantor: `On a table, tagged *the King's Confessor, effects,* lie a battered breviary with a ribbon, a pair of spectacles, a candle-stub. Cael lifts the breviary. It falls open at a page he did not know he had marked.`,
          })),
        choices: [
          { label: `[Reclaim what was taken from you] Lose 60 gold (the proof). Choose 1 of 3 rare cards.`, req: goldReq(60),
            async fx(g) { g.loseGold(60); g.unlockLore('lore_a3_seized_goods'); await offer(g, { rarity: 'rare' }, 'What was taken from you'); return 'reclaimed'; } },
          { label: `[Bid at the auction] Lose 90 gold. Obtain a random relic.`, req: goldReq(90),
            fx(g) { g.loseGold(90); g.obtainRelic(); g.unlockLore('lore_a3_seized_goods'); return 'bought'; } },
          { label: `[Slip a lot under your cloak] Even odds: obtain a random relic, or the clerks' guard catches you: a fight.`,
            fx(g) { g.unlockLore('lore_a3_seized_goods'); if (roll(g, 0.5)) { g.obtainRelic(); return 'stole'; } return 'caught'; } },
          { label: `[Leave it all on its shelves]`, end: true },
        ],
      },
      reclaimed: {
        text: (g) => P(
          H(g, {
            knight: `The clerk checks his name against a list, asks for three proofs of identity, accepts none, and then, with a sigh, accepts the gilt sword, because it is *so* obviously his. Aldous does not buckle it on. He holds it in both hands. It remembers what it was for; he is less sure.`,
            witch: `The clerk demands proof of ownership. Isolde grinds a pinch of hellebore in the mortar, there and then, on his counter, and names the dose that would stop his heart. He finds the proof persuasive. She walks out with her mother's mortar under her arm, and does not trust her voice for a street.`,
            wren: `"Proof?" says the clerk. Wren puts on the wolf-mask and then the moth and then the owl, one after another, faster and faster, and the clerk's pen stops. "That'll do," he says, rather faintly. "That'll more than do. Take what you like."`,
            cantor: `The clerk does not look up. Cael signs the receipt anyway, in a hand he last saw on a death-register, and the clerk, who has been writing for a long time, stamps it without seeing anything, and hands the breviary over the counter into empty air, which, at the last moment, is not quite empty.`,
          }),
          `Among what you bring out is an odd thing the Bureau missed or did not understand: a thing of craft that is, somehow, *yours.* You hold it, and know what to do with it, as a woman recalls a language she thought she had forgotten.`),
        choices: [{ label: '[Leave]', end: true }],
      },
      bought: {
        text: P(
          `Lot 9 is a strongbox, contents unknown, and you are the only bidder, because nobody else can afford to be seen wanting anything. The auctioneer is an old man with a small gavel and a smaller voice. "Going once," he says. "Going twice." He glances at the door. "Sold," he whispers, and brings the gavel down on his own thumb.`,
          `You carry the box out into the ash. The latch gives. Inside, packed in wool: what a man thought worth keeping from the wreck of his life, and something a clerk who could read an inventory had decided was not worth the paper to list.`,
        ),
        choices: [{ label: '[Leave]', end: true }],
      },
      stole: {
        text: P(
          `Nobody counts the lots. That is the secret of the Hall: the clerks tag what comes in, and no one has ever, in ninety years, checked that anything is still on the shelves. You fold a thing under your cloak and walk out slowly through the spectacles. A guard salutes. You are very polite to him.`,
          `Three streets later you look at what you took, and realise the tag is still on it. *Denounced: [name], for nothing in particular.* You put the tag in your pocket. You will keep it. It seems the least you can do.`,
        ),
        choices: [{ label: '[Leave]', end: true }],
      },
      caught: {
        text: P(
          `A hand clamps on your shoulder, quite gently. "Auction's tomorrow," says the guard, in the voice of a man who has been waiting all week for someone to do this, and then he calls his friends.`,
        ),
        choices: [{ label: '[Fight]', async fx(g) { await g.eventCombat(foes(g, 3, ['regents_inquisitor', 'crown_zealot']), { resume: 'after_caught' }); } }],
      },
      after_caught: {
        text: P(
          `You leave the Hall by the front door with nothing under your cloak. Behind you the clerks creep out from under their desks, find the guards, and begin, very quietly, to fill in a form.`,
        ),
        choices: [{ label: '[Leave]', end: true }],
      },
    },
  },

  // ---------------------------------------------------------------- the founder's tomb
  {
    id: 'a3_founders_tomb', title: 'The Empty Tomb', acts: [3], art: 'scene_shrine',
    pages: {
      start: {
        text: (g) => P(
          `The Cathedral of Ashgrave is the largest building in Morrow and the emptiest. In the north transept, under a canopy of stone angels, lies the tomb of Aldane the Founder: black marble, a recumbent king with a crown on his chest, a sword at his side and, oddly, a spade. The face has been worn smooth by four hundred years of pilgrims' thumbs. The Chronicle says the tomb is empty.`,
          `A verger in a green apron sweeps round the plinth with a short brush and an air of settled contempt. "Don't lean," he says, to no one. "Somebody leans every day." There are fresh marigolds on the lid. Yesterday's were wilted. No one ever sees who brings them, he says. They arrive. Between two flagstones at the foot, a thread of fresh black soil. In a cathedral.`,
          H(g, {
            knight: `Aldous bows his head. Founders aren't his department, but kings are, and he is the bastard of the last of them. He tries to feel something fitting. Mostly he feels the stone angels looking at his sword.`,
            witch: `"Rot-craft was burned out of this city in his name," Isolde tells the marble man, conversationally. "I'd like it noted that I came, and that I was polite."`,
            wren: `Wren touches the smooth place where the face should be, and feels, oddly, at home. "Somebody loved him enough to wear him away," Wren says. "Or hated him. It comes to the same thumbprint."`,
            cantor: `Cael sings the Office over the tomb from habit. At the line *let perpetual light shine upon him,* a candle on the altar, which was not lit, is lit. The verger does not notice. He is sweeping a wall.`,
          })),
        choices: [
          { label: `[Sleep in the Founder's shadow] Heal 25 HP. Lose 50 gold (or all you carry).`,
            fx(g) { g.healOut(25); g.loseGold(50); g.unlockLore('lore_a3_founders_tomb'); return 'slept'; } },
          { label: `[Buy the verger's marigolds and leave them] Lose 25 gold. Remove a card from your deck.`, req: (g) => (goldReq(25)(g) === true ? deckReq(1)(g) : goldReq(25)(g)),
            async fx(g) { g.loseGold(25); await g.removeCardChoice(1, 'Choose a burden to lay at the tomb'); g.unlockLore('lore_a3_founders_tomb'); return 'marigolds'; } },
          { label: `[Dig between the flagstones] Lose 8 HP. Obtain a random relic.`, req: hpReq(8),
            fx(g) { g.hurt(8); g.obtainRelic(); g.unlockLore('lore_a3_founders_tomb'); return 'dug'; } },
          { label: `[Read the epitaph and go]`, fx(g) { g.unlockLore('lore_a3_founders_tomb'); return 'epitaph'; } },
        ],
      },
      slept: {
        text: P(
          `You lie down on the plinth with your back against the cold of a dead king's elbow, and sleep like the dead. No dreams. No time. Only a deep still dark that holds you the way a hand holds an egg, and from somewhere far off, a very regular sound, a sort of patient *scrape-and-thud*, which you decide, in your sleep, is the sound of a mind turning over.`,
          `When you wake you are better than you have been in a month. The verger is leaning on his brush, looking at you with something between pity and tact. Your purse is lighter. "Donation," he says. "Everyone donates. It's how the angels are kept." He does not drop his eyes, and neither, after a moment, do you.`,
        ),
        choices: [{ label: '[Leave]', end: true }],
      },
      marigolds: {
        text: P(
          `The verger sells you a bunch off a barrow behind the pillar, at a price that would shame a florist, and wraps them with unnecessary care. You set them on the lid beside the others. As you do you lay something down along with them; you know what, though you could not have said it aloud.`,
          `"Mm," says the verger, watching. He is quiet for a bit. "He gets a lot of those," he says finally. "Whatever it is you just put there. People bring them all the time." And, not looking at you: "I've often wondered who it is they think they're giving them to."`,
        ),
        choices: [{ label: '[Leave]', end: true }],
      },
      dug: {
        text: P(
          `Between the flagstones the soil is loose and, impossibly, warm. You work at it with your knife and then your hands. Under a finger's depth of it lies a bundle in oilcloth: someone's offering, left a century ago, or last week, or somewhere in the long smear of time between the two.`,
          `The verger lets you get it out before he hits you with the broom. He does it with real conviction and then looks faintly ashamed. "Everybody digs," he says. "I used to stop them. I've stopped stopping." He leans his brush against the tomb. "Mind the marigolds," he says. "He gets particular."`,
        ),
        choices: [{ label: '[Leave]', end: true }],
      },
      epitaph: {
        text: P(
          `HERE LIES ALDANE, FIRST KING OF MORROW, WHO RAISED THE CROWN AND CAME TO REST AT THE RIGHT HAND OF HEAVEN. The lettering is magnificent. The spelling is perfect.`,
          `At ankle height, very small, cut into the stone with something sharp by someone who did not want to be caught, is another line, in a cramped hand that is not from this century and not quite from any other: *Rest, you old fool.*`,
          `You stand there a while. The verger says nothing. In the north transept the angels go on looking down, and a faint scent of marigolds drifts across the stone like a small and stubborn hope.`,
        ),
        choices: [{ label: '[Leave]', end: true }],
      },
    },
  },

  // ---------------------------------------------------------------- the ministry of weather
  {
    id: 'a3_weather', title: 'The Ministry of Weather', acts: [3], art: 'scene_city',
    pages: {
      start: { text: weatherIntro, choices: weatherChoices(true) },
      ledger: {
        text: P(
          `You turn back the pages. Ash. Ash. Ash. Light wind, northerly. Ash. Further and further, until the paper goes brown and the ink goes brown, and then, near the beginning, you find a different hand: *Fair and warm, wind SW. Showers by evening. Spring.* Four pages on: *Spring (held).* Then, in the same hand, tiny: *Spring (held).* Then: *Spring (held, I am told).* After that, the entries are all in a different pen.`,
          `The last pages are the thinnest. They are the same page over and over: *Ash.* Pettifer watches you read and does not say anything at all, and in the gap you hear his heart go, like a small shut door being tried.`,
        ),
        choices: weatherChoices(false),
      },
      rain: {
        text: P(
          `You write it in the box in a round clear hand. *Rain.* Pettifer takes the book from you as if it might go off, looks at the word for a very long time, and then, with the delicacy of a man putting a baby to bed, closes the ledger.`,
          `By noon the sky has gone the colour of dishwater and a fine cold rain is falling on Ashgrave. It lasts an hour. In the Street of Pens people come out of their doors and stand with their faces up and their mouths open. A woman is laughing and weeping at once. A man holds out his hat and watches it fill. You stand in it too. It tastes of iron and old stone and, very faintly, of something green. It does you more good than any physician.`,
        ),
        choices: [{ label: '[Leave]', end: true }],
      },
      frost: {
        text: P(
          `You write *Frost,* and underline it, because it feels as though it needs it. By dusk the cobbles of the Chancery crack under every heel like sugar. The air has a clean edge on it, the first in a century. Fountains that have run ash-water for ninety years skin over with ice, and children who have never seen it run to prod it with their fingers.`,
          `You feel it in your hands as you go: a thing that was blunt is keen again, the world with its edges back. Pettifer follows you down the stair, entirely against the Regent's regulations, to see the frost for himself. He stands in the street and weeps a little. "I thought it would be bigger," he says. Then, rapidly: "No. No, it's perfect. It's exactly the right size."`,
        ),
        choices: [{ label: '[Sharpen what has been blunted]', req: upReq(1), async fx(g) { await g.upgradeCardChoice(1); } }],
      },
      spring: {
        text: P(
          `You write it slowly. Four letters, five. The nib catches on the paper and the whole tower seems to lean in to watch you do it. Pettifer has stopped breathing. "You can't," he whispers. "It's not in the forecast. It has never been in the forecast."`,
          `Under the ledger, under the tower, under the hill, something very large and very slow *turns over.* The pain of it goes through you like a bell-note; you feel it in your teeth, in your breastbone. Then a warm wind passes through the street, sweet as bread, and a green shoot pushes up between two cobbles in the Street of Pens and stands there, trembling, and the whole city stops to look at it. By dusk it is black. But it was there, and everyone saw it, and the Crown, somewhere, took note.`,
        ),
        choices: [{ label: '[Leave]', end: true }],
      },
    },
  },

  // ---------------------------------------------------------------- the relief
  {
    id: 'a3_relief', title: 'Until Relieved', acts: [3], art: 'scene_court',
    init(g, d) { d.asked = false; },
    pages: {
      start: { text: reliefIntro, choices: reliefChoices(true) },
      ask: {
        text: P(
          `"What are you guarding?" you ask.`,
          `The gilded face does not move. The voice comes from a long way inside it. "The stair." "What's at the top?" A long pause, as of a man consulting a very old drawer. "Orders," says the sentinel. "I was told to guard it until relieved. I have never gone up to look. It would have meant leaving my post."`,
          `The halberd does not waver. "Nobody has ever asked me that," he says. "In ninety-one years. Nobody." And then, quietly, with a terrible dignity: "I should be glad to know, myself."`,
        ),
        choices: reliefChoices(false),
      },
      relieve: {
        text: (g) => P(
          H(g, {
            knight: `"Who relieves the guard?" you say, and the answer comes out of Aldous's mouth in a voice he has not used since the Shield: "*I relieve.*" The words know exactly where to go. Fifteen years of drill land square, like boots on a parade ground.`,
            cantor: `"Who relieves the guard?" you ask, the way you ask a congregation for its response. A long silence. Then, hesitantly, from Cael's own lips, the answer: "*I relieve.* Go in peace, brother. Your watch is ended."`,
            any: `"Who relieves the guard?" you say, guessing, because it is the sort of thing one says. A long, long pause. Then, from you, uncertainly: "I... relieve?" The sentinel considers this. "Close enough," he decides. "Nobody's ever been precise about the second half."`,
          }),
          `You take his place and stand through the night with your back to the stair and your face to the street, and a thousand feet pass in the dark and none of them is looking at you. It is the longest night of your life. By dawn your legs have gone and your hands have gone and something in you has hardened the way a joint sets.`,
          `He has not left. He stands beside you, in the grey, ungilding. The gold sloughs off him in flakes. "I swore my oath on iron," he says. "Founder's issue. They hammered every guardsman a nail for it, to fix the words to the door." He takes a black nail from under his breastplate. "Hold it for me, will you? I shan't be needing it." Then he is gone, and the gilded halberd clatters across the step, and he is not there at all.`),
        choices: [{ label: '[Leave]', end: true }],
      },
      pried: {
        text: P(
          `It goes quickly. The sentinel is slow, but then so is the world, to him. You step over the halberd, past the gilded shoulder, and he turns his head after you with a sound like a gate in the wind.`,
          `The gold in your pockets is soft and surprisingly heavy. The sentinel lies at the foot of the steps, as still as ever, in a shape he has not been in for a century. He looks, you think, more comfortable. He looks, if anything, relieved.`,
        ),
        choices: [{ label: '[Leave]', end: true }],
      },
    },
  },

  // ---------------------------------------------------------------- the puppet-show
  {
    id: 'a3_puppets', title: 'The Tragedy of the Four Heirs', acts: [3], art: 'scene_market',
    pages: {
      start: {
        text: (g) => P(
          `In the Street of Pens a puppet-booth has been set up, red and white stripes, a tiny theatre, a hat full of coppers at its foot. The audience is forty strong, mostly children and the very old, and they are rapt. They know every line.`,
          `On the little stage a puppet king in a tin crown lies in a bed. Four puppet children come to the bedside in turn: one in a little steel helmet, one in a green hat, one with a blank white wooden face, one in a cassock. Each leans down. The King says, "Will you wear it?" and each says, "Yes!" and each in turn is hit on the head with a small wooden mallet by a puppet in motley, to roars of laughter. "*Again!*" shrieks the puppet Fool. "Again! Again!" The audience shrieks it with him. Two men in grey coats at the back are not laughing. They are writing.`,
          g.flag('met_pell') ? `The Fool puppet's smile is a crack across white porcelain. You have seen that smile before.` : '',
          H(g, {
            knight: `The puppet in the steel helmet is rather good. It has Aldous's stance. It has been given a very small sword and a very small door, and it stands in front of the door through every scene, upright, doing nothing, and the children boo it with great affection.`,
            witch: `The witch puppet is a caricature: green nose, a cauldron, a wooden wart. "I haven't got a wart," Isolde says. A child turns round. "It's the Fool's joke, miss. Everyone's got a wart." Isolde decides to let it go.`,
            wren: `The blank white puppet is the audience's favourite. It has no mouth, and speaks anyway: children and old men chorus its lines from memory. "Who are you?" says the King. "*Nobody!*" roars the audience, joyfully. Wren is silent a long moment. "They like me," Wren says. "Why is that worse?"`,
            cantor: `The cassock puppet is the only one not hit. He kneels at the bedside, the King whispers in his ear, and he sits in the corner for the rest of the play while the others are mallet-ed. "He knows too much," a small girl tells you gravely. "He's just supposed to *know.*"`,
          })),
        choices: [
          { label: (g) => `[Watch to the end] Lose 40 gold (the hat comes round, and stops at you). Obtain ${relicFull(g, 'pells_bell')}.`, req: goldReq(40),
            fx(g) { g.loseGold(40); giveRelic(g, 'pells_bell', 'uncommon'); g.unlockLore('lore_a3_four_heirs'); return 'watched'; } },
          { label: `[Pick the grey men's pockets] Even odds: gain 70 gold, or lose 8 HP when they catch your wrist.`, req: hpReq(8),
            fx(g) { g.unlockLore('lore_a3_four_heirs'); if (roll(g, 0.5)) { g.gainGold(70); return 'picked'; } g.hurt(8); return 'caught'; } },
          { label: `[Laugh with the crowd] Heal 10 HP.`,
            fx(g) { g.healOut(10); g.unlockLore('lore_a3_four_heirs'); return 'laughed'; } },
          { label: `[Move on]`, end: true },
        ],
      },
      watched: {
        text: P(
          `You stay to the last "Again!" and clap when the others clap. The play ends with the puppet King sitting up in bed, quite alive, and looking out over the audience, and saying, in a voice that seems to come from a long way behind the booth: "*Who's next?*" And the curtain falls to cheers.`,
          `The hat comes round and stops in front of you and does not move on. You put in forty. A hand in a motley glove, so quick you only half see it, tosses a little brass bell into your lap over the lid of the booth. It rings, once, in the wrong key. Nobody in the booth answers when you call. The curtain is still. You are fairly sure someone is laughing behind it, very quietly, and not unkindly.`,
        ),
        choices: [{ label: '[Leave]', end: true }],
      },
      picked: {
        text: P(
          `The audience is laughing too loudly to notice. You ease two fingers into each grey pocket in turn: notebooks, a pencil-stub, a flask, a purse of Bureau petty cash fat as a bun. You close the purse in your fist and slide away through the legs of the audience, and the puppet Fool, on the stage, turns a wooden face to the crowd and shrieks, *"Thieves!"*`,
          `Everyone laughs. It is, you realise, a line in the play. The grey men do not look round. They have just noticed that their pockets are lighter, and have decided, between two glances, that it would be less embarrassing to have a theory than a witness.`,
        ),
        choices: [{ label: '[Leave]', end: true }],
      },
      caught: {
        text: P(
          `A hand closes on your wrist like a trap. The nearer grey man does not look at you; he goes on watching the stage. "Not this one," he says mildly, to the air. "Wrong play." He twists. Something in your arm lets out a small, clear note of protest.`,
          `When he lets you go he is laughing at the puppet, a little, as one does. You are two streets away before you notice that your purse is exactly as it was, and that he had put something in your pocket in exchange: a card. It says, in a neat hand, *You'll want to be more careful.* It's very probably a threat. It reads, uncomfortably, like advice.`,
        ),
        choices: [{ label: '[Leave]', end: true }],
      },
      laughed: {
        text: P(
          `You laugh. You can't help it. The puppet Fool is hilarious, and the mallet comes down in perfect time, and the tin-crowned King sits up and says *Who's next?* and the whole street roars. You laugh until your ribs hurt and your eyes run. It goes through you like a long drink, warm and loosening. For a moment nothing is a debt.`,
          `Then you notice you are the only one still laughing, and the grey men at the back have turned their heads, and the puppet Fool is looking straight at you. "*Again!*" it says, very softly, and the child beside you echoes, in the same tone, in her small clear voice, without looking away from the stage: "Again." You stop laughing. It takes some time.`,
        ),
        choices: [{ label: '[Leave]', end: true }],
      },
    },
  },
]);

// ------------------------------------------------------------------ shared page pieces
function expectedLine(g) {
  const bits = [];
  if (g.flag('crane_knows')) bits.push(`"No pretence between us, now that his lordship has spoken to you," he adds comfortably.`);
  if (g.flag('a2_sold_name')) bits.push(g.run.hero === 'cantor' ? `"And you sold a psalm in the Wood," he notes. "Cheap, we thought. They always go cheap."` : `"And you sold your name in the Wood," he notes. "Cheap, we thought. They always go cheap."`);
  if (g.flag('a2_took_locket')) bits.push(`"Do mind the locket. Her Majesty was rather attached."`);
  else if (g.flag('a2_hart_freed')) bits.push(`"You freed the white hart. The Wood will be told. It keeps accounts." He smiles. "So do we."`);
  else if (g.flag('a2_hart_killed')) bits.push(`"And you ate the white hart. Bold. The Wood does not forget a meal."`);
  else if (g.flag('a2_witch_freed')) bits.push(`"Cutting a hedge-wife off a stake in the Wood: unwise. Also, I'm told, rather good of you."`);
  else if (g.flag('a2_walked_on')) bits.push(`"Walking on from a pyre in the Wood. Sensible. The General does so dislike interruptions."`);
  return bits.slice(0, 2).join(' ');
}

function courtIntro(g) {
  return P(
    `The Presence Chamber of Aldric IV is a hundred feet of black-and-white tile and nine hundred candles that never drip. At the far end, on three steps, stands the throne, and on the throne there is no one.`,
    `On the tiles, in rows, in the best fashions of seventy years ago, the Court is bowing. Lords and ladies, a bishop, a boy with a dog, a woman in ostrich feathers whose back must hurt more than anything has ever hurt. They bow to the empty throne. They have bowed since Ashfall. They have forgotten the word that lets them stop.`,
    `A chamberlain with a white staff sees you and strikes the floor. "Announcing," he says, "the heir." It is not clear which.`,
    H(g, {
      knight: `"Ser Aldous Vane," the chamberlain adds, with the slightest hesitation, "the King's Shield." "Former," says Aldous. "We are not informed of that," says the chamberlain.`,
      witch: `"The Lady Isolde Marrow, His Majesty's niece." A ripple of whispers goes through the bowing court. "They've been warned about me," Isolde murmurs. "Or they've been waiting."`,
      wren: `"The... ward," says the chamberlain, and stumbles, for the first time in ninety years, on a title. Several courtiers glance up, then quickly down. "It's all right," says Wren. "I haven't got one either."`,
      cantor: `The chamberlain does not strike his staff for Cael. He does something stranger: he lowers it, and bows, and the whole court bows deeper. Cael has never been bowed to in his life. "Stop," he says. They do not. He is oddly sure they heard.`,
    }));
}

function courtChoices(withGossip) {
  return [
    { label: `[Say "Rise."] Gain 6 Max HP.`, fx(g) { g.gainMaxHp(6); g.unlockLore('lore_a3_court_protocol'); return 'rise'; } },
    { label: `[Lift the chamberlain's gold chain] Even odds: gain 110 gold, or the court rises against you: a fight.`,
      fx(g) { g.unlockLore('lore_a3_court_protocol'); if (roll(g, 0.5)) { g.gainGold(110); return 'chain_ok'; } return 'chain_bad'; } },
    { label: (g) => `[Take the signet from the throne's arm] Fight the court. Reward: ${relicFull(g, 'kings_signet')}.`,
      async fx(g) { g.unlockLore('lore_a3_court_protocol'); g.unlockLore('lore_a3_court_phantoms'); await g.eventCombat(foes(g, 3, ['court_phantom', 'court_phantom', 'court_phantom']), { resume: 'after_court', reward: { relic: rewardRelic(g, 'kings_signet') } }); } },
    ...(withGossip ? [{ label: `[Hear what the court has heard]`, fx(g) { g.unlockLore('lore_a3_court_protocol'); return 'gossip'; } }] : []),
    { label: `[Back out, bowing]`, end: true },
  ];
}

function weatherIntro(g) {
  return P(
    `The Ministry of Weather has a very fine brass door and one employee. He sits in a glass-roofed tower at the top of the Chancery with a rain-gauge, a barometer, a wind-vane and a ledger as long as a grave, and at dawn every morning he writes the day's weather. He is a thin, anxious, ink-stained man named Pettifer and he has done it for fifty-one years.`,
    `"Ash," he says, showing you the page. "Wind light, northerly. Ash. Ash." He turns back. "Ash. It isn't that I haven't tried to be varied. The Regent's order is that weather be reported *accurately.*" He sniffs. "I am not permitted to report spring. It isn't in the forecast. It hasn't been in the forecast since before my time." He looks at the empty box marked FORECAST FOR TOMORROW, and then at you. "Would you care to do it? I've always wanted to know what it would feel like to have been wrong."`,
    H(g, {
      knight: `"The thing about an order," Aldous says slowly, "is that you aren't allowed to enjoy breaking it." "I'm told it's wonderful," says Pettifer.`,
      witch: `Isolde reads back through the ledger. "No seasons," she says. "No autumn?" "Not in the proper sense." "No *rot?*" "Heavens, no." "Good God," says Isolde. "You haven't got any *compost.*"`,
      wren: `Wren takes the pen at once, and then holds it over the page for a long time without writing. "What does rain smell like?" Pettifer tells them. "Oh," says Wren. "I think I've been missing that."`,
      cantor: `"Pettifer," Cael says gently, "when did you last go outside?" "Outside?" The man blinks. "It's weather. I observe it from within."`,
    }));
}

function weatherChoices(withRead) {
  return [
    { label: `[Write "Rain."] Heal 15 HP.`, fx(g) { g.healOut(15); g.unlockLore('lore_a3_weather'); return 'rain'; } },
    { label: `[Write "Frost."] Upgrade a card of your choice.`, req: upReq(1), fx(g) { g.unlockLore('lore_a3_weather'); return 'frost'; } },
    { label: `[Write "Spring."] Lose 8 HP. Gain 6 Max HP.`, req: hpReq(8),
      fx(g) { g.hurt(8); g.gainMaxHp(6); g.unlockLore('lore_a3_weather'); return 'spring'; } },
    ...(withRead ? [{ label: `[Read back through the ledger]`, fx(g) { g.unlockLore('lore_a3_weather'); return 'ledger'; } }] : []),
    { label: `[Leave the forecast blank]`, end: true },
  ];
}

function reliefIntro(g) {
  return P(
    `At the foot of the Palace Steps a Royal Guardsman stands at attention. His halberd is gilded, his breastplate is gilded, his face under the helm is gilded; at some point he stopped being a soldier and became a very good likeness of one. Ash has settled on his shoulders in a grey cape. He has not looked left or right in ninety-one years.`,
    `"Halt," he says, in a voice like a rusted hinge. "Who goes there?" You tell him. He does not seem to hear. "Who goes there?" he says again, patiently. And then, in a different voice, thin and tired and nearly human: "Are you my relief?"`,
    `There is a stair behind him, going up into the dark, and no one else on it.`,
    H(g, {
      knight: `Aldous has stood at a door. He knows exactly how this man's feet hurt.`,
      witch: `"He's been standing since Ashfall," Isolde says. "He has *no circulation.* I'm amazed he's still upright. It's almost impressive." She does not sound as though she thinks it is.`,
      wren: `"Are you waiting for someone in particular?" Wren asks. The sentinel's gilded head turns a degree. "No one in particular," he says. "That's what's wrong with it."`,
      cantor: `The sentinel's eyes, behind the gilded visor, move to Cael and stay there. "You," he says, in a voice of tremendous relief. "You can see me." "Yes," says Cael. "I'm afraid I can."`,
    }));
}

function reliefChoices(withAsk) {
  return [
    { label: (g) => `[Relieve him] Lose 7 HP (a night on your feet). Obtain ${relicFull(g, 'founders_nail')}.`, req: hpReq(7),
      fx(g) { g.hurt(7); giveRelic(g, 'founders_nail', 'uncommon'); g.unlockLore('lore_a3_sentinel_oath'); return 'relieve'; } },
    { label: `[Pry the gilding from his greaves] Gain 100 gold. He objects: a fight.`,
      async fx(g) { g.gainGold(100); g.unlockLore('lore_a3_sentinel_oath'); g.unlockLore('lore_a3_gilded_sentinels'); await g.eventCombat(foes(g, 3, ['gilded_sentinel', 'gilded_sentinel'], ['gilded_sentinel', 'plague_doctor']), { resume: 'pried' }); } },
    ...(withAsk ? [{ label: `[Ask what he is guarding]`, show: (g, d) => !d.asked, fx(g, d) { d.asked = true; g.unlockLore('lore_a3_sentinel_oath'); return 'ask'; } }] : []),
    { label: `[Salute and go]`, end: true },
  ];
}

// ------------------------------------------------------------------ lore
defineLore([
  {
    id: 'lore_a3_curfew', cat: 'letters', title: 'Ordinance of the Hour Not Rung',
    text: P(
      `*Posted in every ward of Ashgrave, the fourth day after Ashfall. Copies were still being nailed up a month later, since no one dared be the one to take them down.*`,
      `I. At the hour not rung, all doors shall be barred and all lamps put out. II. The hour is not rung, so that no citizen may plead he did not hear it. III. Persons found abroad shall be asked their business. Persons who answer shall be asked it again. Persons who do not answer shall be presumed to have business. IV. Informants shall be paid by the head, and may not be informed upon for the first fortnight, that no honest man be discouraged. V. Questions concerning this Ordinance shall be addressed to the Regent's Office, which is closed at the hour not rung.`,
    ),
  },
  {
    id: 'lore_a3_lions_mouth', cat: 'letters', title: 'Instructions to Clerks of the Mouth',
    text: P(
      `Empty the Mouth at the hour. Count the notes; the count is payable. Read none, save by authority. If a note names a neighbour, stamp it and pay it. If a note names a priest, stamp it and pay it double. If a note names the Regent, place it in the sack marked R and do not read it, however strongly you are tempted, and you will be.`,
      `The R sack is to be delivered on Sundays to the Regent's own hand. He has asked that it not be thinned.`,
      `*Pencilled on the back, by a clerk's hand:* he reads them with his tea. He says they are the only honest correspondence he receives.`,
    ),
  },
  {
    id: 'lore_a3_held_hour', cat: 'crown', title: 'Catechism of the Held Hour',
    text: P(
      `*As taught to novices of the Crown-cult in the cellars of St Ulfric's. Rubrics in italic.*`,
      `Q. Where is the King? A. He is resting. Q. Where is the Crown? A. It is waiting. Q. What does it wait for? A. For the Hand. Q. Whose hand? *The novice is not required to answer this.* Q. What if the Hand does not come? A. It will come. Q. What if it has already come, and we did not know it? *The catechist will move to the next question.*`,
      `*The cushion shall be empty. A cult that keeps a place for something is better at it than a cult that has the thing.*`,
    ),
  },
  {
    id: 'lore_a3_crown_zealots', cat: 'bestiary', title: 'Crown Zealots',
    text: P(
      `The circle of ash upon the brow is for the congregation. The *brand* is for the elect: a circlet seared into the flesh over the heart, open at the top where the gem would sit. Zealots go barefoot, fast on Sundays, and have made peace with what they do.`,
      `They are not hired. That is what makes them frightening. A mercenary will weigh the pay against the wound; a zealot has already weighed the world against the Hour, and found the world wanting.`,
      `They pray to the empty socket, and are quietly distressed to find that, lately, it has begun to answer.`,
    ),
  },
  {
    id: 'lore_a3_court_protocol', cat: 'world', title: 'Protocol of the Presence Chamber',
    text: P(
      `*Office of the Lord Chamberlain. Revised in the thirtieth year of Aldric. The only revision.*`,
      `Courtiers shall bow on the fall of the White Staff, and shall rise on the King's word. The King's word shall be *Rise.* NOTE: no provision has been made for the case in which the King's word is absent. This oversight is regretted.`,
      `*Appended, in a different and much shakier hand:* The Chamberlain wishes it recorded that he has tried to rise himself. He cannot find the way. He would be grateful if someone would say it, and he does not particularly mind who.`,
    ),
  },
  {
    id: 'lore_a3_court_phantoms', cat: 'bestiary', title: 'Court Phantoms',
    text: P(
      `Not ghosts, strictly. Ghosts have finished. These are courtiers in the middle of a courtesy, caught by the Crown with their weight on one foot and held there, like flies in a very slow amber.`,
      `They are polite to the last. They will take your coat. They will announce you. They will, in the course of the evening, with exquisite regret, cut your throat, and ask whether you would care for refreshment.`,
      `When struck, they apologise. This is not a defence. It is simply what they were doing.`,
    ),
  },
  {
    id: 'lore_a3_register', cat: 'world', title: 'The Register of Deaths',
    text: P(
      `*Last entries, the Register of Deaths, Ashgrave. The book is green with age.*`,
      `*Year 19. Edwin Cray, drover, of old age. Permitted by exception. Remarks: the Crown frowned.*`,
      `*Year 20. Pudding, a cat, belonging to Her Ladyship's cousin. Permitted. A kindness.*`,
      `*Year 20. —*`,
      `*The Registrar's note, in the margin of the next, blank, page:* Since then I have had to rule fresh margins only for the births. They are numerous. I do not know where they go. I have been told it is not my department.`,
    ),
  },
  {
    id: 'lore_a3_stopped_ward', cat: 'letters', title: 'The Ward-Sister\'s Notes',
    text: P(
      `*Kept in a school exercise-book, Drapers' Hall Ward, in pencil.*`,
      `Day 61. Beds 1-200. No change. Day 62. No change. Day 63. Bed 117 blinked. Reported. Told it was a reflex. Day 64. Bed 117 blinked again, at me. Day 65. Bed 117 is a retired cooper called Ansel. He is not sick. I have checked everything I know how to check, except the one thing, which is whether he is waiting.`,
      `The physicians say Blight, and write it down, and go home. It is not a disease. It is a queue. I do not know what the head of it looks like, but I know how long it is, because I walk its length each night with a cup.`,
    ),
  },
  {
    id: 'lore_a3_plague_doctors', cat: 'bestiary', title: 'The Beaked Physicians',
    text: P(
      `The beak is stuffed with rue and cloves, against the *bad air.* There is no bad air. There is only the stillness, which does not care what you stuff your nose with. Nobody has told the physicians. The physicians have been advised that if they were told they would stop wearing the beaks, and that nobody would be able to stand them.`,
      `They are not evil. They are exhausted men with a great many patients and no verb to apply to them except *wait.* Their lancets are very sharp and their bedside manner is the worst in Morrow, and what they do to the sick they do, they believe, for the good of the city.`,
      `One in twenty is a woman, and has to wear a false moustache under the mask.`,
    ),
  },
  {
    id: 'lore_a3_gilders', cat: 'world', title: 'Rule of the Guild of Gilders and Preservers',
    text: P(
      `IV. We do not hide rot. We persuade it to wait. VII. A client gilded in full is not a corpse, and any journeyman who says otherwise will be asked to leave. VIII. Under no circumstances address the client's family as *the bereaved.* They are *the patient.* XI. The gold is for the living. The sleeper has no use for it. The sleeper's heirs have, and it is in the nature of heirs to scrape.`,
      `XIV. Do not look under the leaf. XV. If a client begins to *show,* apply more leaf. XVI. If a client's family begins to show, apply more leaf. XVII. There is always more leaf.`,
    ),
  },
  {
    id: 'lore_a3_night_soil', cat: 'world', title: 'A Night-Soil Rhyme',
    text: P(
      `*Sung by the drain-cleaners of Ashgrave to keep time on the cart. Never at the third grate.*`,
      `*Down the first grate the water goes,*\n*down the second the water slows,*\n*down the third no water flows,*\n*and what's down there, nobody knows.*`,
      `*(But it knows us.)*`,
      `The foreman's rule, as given to apprentices: you will hear things. You will not name them. A thing named is a thing that has been told it can come up.`,
    ),
  },
  {
    id: 'lore_a3_third_bureau', cat: 'letters', title: 'How to Be Expected',
    text: P(
      `*Third Bureau, Regent's Office. Training memorandum, for newly sworn agents. Not to be left on a café table.*`,
      `1. The subject must never be surprised by you. Surprise creates memory, and memory creates grudge. 2. Begin each interview by describing what the subject is about to say. Do not be right. Be *nearly* right; the subject will correct you, and in correcting you will tell you what you wish to know. 3. Where the Regent has already had the conversation, you will say *as I recall.* 4. You will not ask what the Appendix refers to. 5. You will not ask why the Appendix is the longest part of this memorandum.`,
      `6. The tea should be good.`,
    ),
  },
  {
    id: 'lore_a3_seized_goods', cat: 'world', title: 'Inventory of Seized Goods, Corn Exchange',
    text: P(
      `*A sample, taken at random by an auditor who has since been excused from further audits.*`,
      `*Denounced: R. Hask, for grief. One cradle, rocking. Denounced: the Fishers' Guild, for knowing. Forty nets, tarred. Denounced: Mistress Orme, for laughing at the wrong hour. One tooth-mug. Denounced: a Person, for song. One lute, three strings. Denounced: Brother Ambrose, for sermons. One breviary, much thumbed.*`,
      `Total goods in hand: eleven thousand four hundred and six. Total goods claimed: nine. The Crown has, as a consequence, the largest collection of shoes in Morrow, and no one to give them to.`,
    ),
  },
  {
    id: 'lore_a3_founders_tomb', cat: 'crown', title: 'The Verger\'s Day-Book',
    text: P(
      `*North transept, Cathedral of Ashgrave. In pencil. Four hundred years of inconsistent hands, as the office passes.*`,
      `*Swept the tomb. Marigolds, fresh. Again. Who?*`,
      `*Swept the tomb. Marigolds, fresh. Not the same as yesterday's; those were wet. Who?*`,
      `*Soil at the plinth. Swept it. It was back by Vespers.*`,
      `*Epitaph unchanged. The thing at ankle height still reads* Rest, you old fool. *Have asked the Dean to have it scoured. Dean says: leave it. Dean says, in my opinion it is the only honest line on the tomb.*`,
    ),
  },
  {
    id: 'lore_a3_weather', cat: 'world', title: 'The Weather Ledger',
    text: P(
      `*The Ministry of Weather, daily entries. Selected by a clerk of the Chancery who could not stop reading.*`,
      `*Year 1. Fair and warm, wind SW. Showers by evening. Spring.*\n*Year 9. Spring (held).*\n*Year 10. Spring (held).*\n*Year 11. Autumn, as above.*\n*Year 30. As above.*\n*Year 52. As above, with some surprise.*`,
      `*The day of Ashfall. Ash.*\n*The day after. Ash.*\n*The day after that. Ash.*`,
      `The Ministry's mandate reads, in full: *To report the weather accurately.* Its second clause, in a different hand, has been scratched out. A reader holding the page to the light can still make out the words *and not to wish it otherwise.*`,
    ),
  },
  {
    id: 'lore_a3_sentinel_oath', cat: 'world', title: 'The Oath of the Royal Guard',
    text: P(
      `I will stand where I am put. I will stand until I am relieved. If none relieve me, I will stand. I will keep the stair, the door, the throne, the King. I will not ask what is at the top. I swear it on the iron that holds the Crown, that the oath may be nailed to the post and not come loose.`,
      `*Rubric:* The Guard shall be relieved at the changing of the watch by the oncoming Guard, who shall say *I relieve.* The off-going Guard shall answer *Relieved.* The words are to be spoken together. Neither is to be omitted.`,
      `*In the margin, in a later hand:* The oncoming watch was dismissed the morning after Ashfall, by order of the Regent. The off-going watch has not been informed.`,
    ),
  },
  {
    id: 'lore_a3_gilded_sentinels', cat: 'bestiary', title: 'The Gilded Sentinels',
    text: P(
      `The Royal Guard swore to stand until relieved. No one came. The gilders, hired by the Regent to *preserve the dignity of the post,* did the rest. A Sentinel is a soldier of ninety years' standing with a skin of gold, a halberd, and no further instructions.`,
      `They are slow. That is the good news. They are also patient, and strong in the particular way of men who have been rooted in one place so long that the place has begun to feel it. They do not attack. They *enforce.* The difference, to the person on the receiving end, is academic.`,
      `If you can find the words to relieve one, they say, it dismisses itself. Nobody has recorded the words.`,
    ),
  },
  {
    id: 'lore_a3_four_heirs', cat: 'world', title: 'The Tragedy of the Four Heirs',
    text: P(
      `*A puppet-play, performed in the Street of Pens and every other street in Ashgrave. Not written down; heard.*`,
      `KING *(in bed)*: Will you wear it?\nKNIGHT *(in a tin helmet)*: Yes!\n*(The Fool strikes the Knight with a mallet.)*\nFOOL: Again!\nKING: Will you wear it?\nWITCH: Yes!\n*(Mallet.)*\nFOOL: Again! Again!`,
      `Nobody remembers who wrote it. It appeared the winter after Ashfall, and every puppeteer in the city knew it by Candlemas. The Third Bureau has been unable to determine its author, or why it has not been banned. The Bureau's best theory, filed in a drawer, is that someone in the Regent's own office likes it.`,
    ),
  },
]);
