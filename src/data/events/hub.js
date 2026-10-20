// The Waystone: Hob's hub dialogue, plus the free-form Texts (death lines, the Pale
// Peddler, campfire thoughts, title and hero-select quotes).
//
// Lines are shown after each run: the highest-`pri` eligible unseen `once` line, else a
// random eligible repeatable line. Heirs answer in voice. Hob is Aldane the Founder; he
// confesses only after `knows_founder` (sets `hob_is_aldane`). Before that he hints, and
// never says the name.
import { defineHubLines, defineTexts, EVENTS, ENCOUNTERS } from '../../engine/registry.js';

const HEROES = ['knight', 'witch', 'wren', 'cantor'];

// ------------------------------------------------------------------ predicates
const F = (m, k) => !!(m.flags && m.flags[k]);
const HM = (m, h) => (m.heroes && m.heroes[h]) || {};
const died = (l) => !!l && !l.won;
const as = (l, h) => !!l && l.hero === h;
const trueDone = (m) => !!(m.endings && m.endings.true);
const pre = (m) => !trueDone(m); // Hob still above ground
const allTruths = (m) => HEROES.every((h) => F(m, 'truth_' + h));
const maxAsc = (m) => Math.max(0, ...HEROES.map((h) => HM(m, h).ascMax || 0));
const poolOf = (l) => (l && ENCOUNTERS[l.killer] ? ENCOUNTERS[l.killer].pool : null);
const diedInEvent = (l) => died(l) && !!EVENTS[l.killer];
const wonWith = (l, ending, h) => !!l && l.won && l.ending === ending && (!h || l.hero === h);

// ------------------------------------------------------------------ barks (generic heir replies)
const BARK = {
  knight: [
    '...Again, then.',
    'I should have held the line.',
    'It was a fair fight. That is the worst of it.',
    'I am not hurt. Only tired.',
    'Give me a moment, Hob. Then the spade.',
    'Do not tell me it was not my fault. I will not believe you.',
  ],
  witch: [
    "Don't say it. I know what I did wrong.",
    'I had a plan. It was a good plan. It had one flaw: the thing eating me.',
    "Put the kettle on. I'll write down what went wrong while I still hate it.",
    'Honestly. Was it my pride?',
    "Stop being kind. It's making me suspicious.",
    'I want a different poison next time.',
  ],
  wren: [
    'Hello again, floor.',
    'Does it get less embarrassing?',
    'I wore the wrong face for that, I think.',
    'That one hurt in an interesting way.',
    'What did it look like, from the outside?',
    'Is it rude to be bored of dying?',
  ],
  cantor: [
    'Lord, receive me. Again.',
    'I should be more troubled by this than I am.',
    'The Rite is long and the dying is short. It seems unbalanced.',
    'Forgive me. I keep forgetting to be afraid.',
    'I felt the hymn go out of me, like breath.',
    'Peace be with you. And with me, apparently, often.',
  ],
};

// One once-line per heir, gated on that heir just having returned.
function perHero(id, o) {
  return HEROES.map((h, hi) => {
    const mid = o.say && o.say[h] ? [[h, o.say[h]]] : o.bark === false ? [] : [[h, BARK[h][(id.length + hi) % BARK[h].length]]];
    const line = {
      id: `${id}_${h}`, pri: o.pri ?? 60, once: o.once !== false,
      req: (m, l) => as(l, h) && (o.when ? o.when(m, l, h) : true),
      lines: [...(o.pre || []), ...mid, ...(o.post || [])],
    };
    if (o.sets) line.sets = o.sets;
    if (o.lore) line.lore = o.lore;
    return line;
  });
}
const killers = (id, when, o) => perHero(id, { pri: 62, ...o, when: (m, l) => died(l) && when(m, l) });
const ids = (...list) => (m, l) => list.includes(l.killer);

// A story beat for one heir: shows when that heir next returns after the flag is set.
const beat = (h, flag, pri, lines, o = {}) => ({
  id: `hob_${flag}`, pri, once: true,
  req: (m, l) => F(m, flag) && as(l, h),
  lines, ...(o.sets ? { sets: o.sets } : {}), ...(o.lore ? { lore: o.lore } : {}),
});

// Repeatable idle line (Hob above ground).
const idle = (id, lines, req) => ({ id, pri: 10, once: false, req: (m, l) => pre(m) && (!req || req(m, l)), lines });

defineHubLines([
  // ================================================================== FIRST MEETING
  {
    id: 'hob_first_meeting', pri: 100, once: true,
    req: (m, l) => !l || (m.runs === 0 && !m.deaths),
    lines: [
      ['narrator', 'A standing stone on the edge of everything. Ash drifts through a graveyard of very tidy graves. An old man is digging, and does not stop.'],
      ['crown', 'Blood, and Kin, and Ward, and Witness. One of you will wear me.'],
      ['hob', "Mind the edge. That one's fresh. Ah, you're up. Good. Some mornings they take a while."],
      ['knight', 'Where is this? Who spoke?'],
      ['hob', "The Waystone. I'm Hob. I keep the ground. And that was the Crown, and you'll want to ignore it. It talks, but it hasn't said anything new in a long time."],
      ['hob', "Tea's on. Nobody wants tea, but it gives the hands something to do."],
    ],
    sets: ['met_hob'], lore: 'lore_waystone',
  },
  {
    id: 'hob_first_death', pri: 96, once: true,
    req: (m, l) => died(l) && m.deaths === 1 && l.hero === 'knight',
    lines: [
      ['crown', 'Again.'],
      ['hob', "There. Sit. Don't try to stand, the first one always wants to stand."],
      ['knight', 'I was... I died.'],
      ['hob', "Aye. Rather thoroughly. I've dug you a fresh one. Saves time."],
      ['knight', 'Time for what?'],
      ['hob', 'For the next time. Drink your tea.'],
    ],
    sets: ['hob_tea'], lore: 'lore_ashfall',
  },
  {
    id: 'hob_first_death_other', pri: 95, once: true,
    req: (m, l) => died(l) && m.deaths === 1 && l.hero !== 'knight',
    lines: [
      ['crown', 'Again.'],
      ['hob', "There. Sit. First time's the worst, and the second is only slightly better. I've dug you a fresh one by the yew. Saves time."],
      ['hob', 'Drink your tea. Nobody wants it. It gives the hands something to do.'],
    ],
    sets: ['hob_tea'], lore: 'lore_ashfall',
  },
  {
    id: 'hob_second_death', pri: 92, once: true,
    req: (m, l) => died(l) && m.deaths === 2,
    lines: [
      ['hob', "Second grave's next to the first. Company."],
      ['hob', "The ground's good here. Light soil, well drained. You'd be surprised how few people ask."],
    ],
    lore: 'lore_morrow',
  },
  {
    id: 'hob_third_death', pri: 92, once: true,
    req: (m, l) => died(l) && m.deaths === 3,
    lines: [
      ['hob', "Three. They say it comes in threes. I've never found that to be so. It comes in as many as it comes in."],
      ['crown', 'Again.'],
      ['hob', "He's only got the one word, you know. I've tried teaching it others."],
    ],
    lore: 'lore_crown_voice',
  },

  // ================================================================== DEATH MILESTONES
  ...perHero('hob_deaths_5', {
    pri: 90, when: (m, l) => died(l) && m.deaths === 5, lore: 'lore_letter_hob_ledger',
    pre: [['hob', "Five. I've started keeping a ledger. Not for the money. Somebody ought to write you down."]],
    say: {
      knight: 'Under what heading?',
      witch: 'Do you cross-reference? Because I will check.',
      wren: 'What do you write under *Wren*? I have never seen it spelled.',
      cantor: "That is a good work, Hob. The Order calls it a *necrology*. They would be envious.",
    },
    post: [['hob', 'Neat hand, I\'m told. It had better be. I\'ve had the practice.']],
  }),
  ...perHero('hob_deaths_10', {
    pri: 90, when: (m, l) => died(l) && m.deaths === 10,
    pre: [['hob', "Ten. Starting a second row. They all face the stone, you'll notice. Seemed polite."]],
    say: {
      knight: 'Polite to whom?',
      witch: 'You realise you are building a very small, very tidy city.',
      wren: 'May I have the one at the end? It has a nice view of the road.',
      cantor: 'A congregation. Of me. I would have liked to preach to it.',
    },
  }),
  ...perHero('hob_deaths_25', {
    pri: 90, when: (m, l) => died(l) && m.deaths === 25,
    pre: [['hob', "Twenty-five. We're running short of yew. I've had to plant more."]],
    say: {
      knight: 'You are planting trees for my funerals.',
      witch: 'Hob. I am beginning to take this personally.',
      wren: 'Do the trees mind?',
      cantor: 'They will shade the graves. That is a kindness.',
    },
    post: [['hob', "Don't fret. I like planting. It's the opposite of the other work, and I find a man wants both."]],
  }),
  ...perHero('hob_deaths_50', {
    pri: 90, when: (m, l) => died(l) && m.deaths === 50,
    pre: [['hob', "Fifty. You've worn a path from the stone to the road. I may put down gravel."]],
    say: {
      knight: 'Put down flagstones. If I am going to be a ghost at least I will be a tidy one.',
      witch: 'I am not wearing a path. I am conducting a *study*.',
      wren: 'I like the path. It knows where I am going.',
      cantor: 'A pilgrim road. I always wanted to walk one.',
    },
  }),
  ...perHero('hob_deaths_100', {
    pri: 90, when: (m, l) => died(l) && m.deaths === 100,
    pre: [['hob', "A hundred. I want you to know I've not once minded."], ['hob', 'Not once. Not the digging, not the tea, not the waiting. Somebody has to keep the door.']],
    say: {
      knight: 'Hob. Thank you.',
      witch: 'You old fool. You absolute old fool. Pour the tea.',
      wren: 'I know. I always knew. It was in the way you put the lantern.',
      cantor: 'And I do not think I have ever thanked you. Let me say the blessing.',
    },
  }),

  // ================================================================== HEIRS ARRIVE
  {
    id: 'hob_witch_unlocked', pri: 88, once: true,
    req: (m) => HM(m, 'witch').unlocked && !HM(m, 'witch').runs,
    lines: [
      ['narrator', 'Someone is sitting on the Waystone with their boots on a grave. Green on the fingertips. A very unamused expression.'],
      ['witch', "Don't get up. I'm told the dead are touchy about being stared at."],
      ['hob', "Miss Isolde. Tea? I've dug you one in the corner. Good drainage."],
      ['witch', 'You dug me a grave before I arrived.'],
      ['hob', 'Saves time.'],
      ['witch', 'That is the most unsettling sentence I have ever heard, and I have heard the Archcanon sing.'],
    ],
    lore: 'lore_heir_witch',
  },
  {
    id: 'hob_wren_unlocked', pri: 88, once: true,
    req: (m) => HM(m, 'wren').unlocked && !HM(m, 'wren').runs,
    lines: [
      ['narrator', 'A small figure is sitting cross-legged on the Waystone, wearing a carved mask of a bird. It has eaten every apple Hob left on the sill.'],
      ['wren', 'Hello. Is this the place where people go to be dead? I have been practising.'],
      ['hob', "Wren. Aye. There's a grave for you by the wall. Facing the stone. I thought you'd like it."],
      ['wren', 'How did you know I would like it?'],
      ['hob', "You always do. ...I mean, everyone does. Everyone likes facing the stone."],
      ['wren', 'You are a very strange man. I hope we are friends.'],
    ],
    lore: 'lore_heir_wren',
  },
  {
    id: 'hob_cantor_unlocked', pri: 88, once: true,
    req: (m) => HM(m, 'cantor').unlocked && !HM(m, 'cantor').runs,
    lines: [
      ['narrator', 'A monk in a grey habit stands among the graves with his hands folded, reading the names as if he were saying them aloud. Hob has set out two cups.'],
      ['cantor', "Peace be with you, keeper. I confess I do not remember arriving. I was at a bedside, and then..."],
      ['hob', 'Brother Cael. Aye. Sit. There is tea.'],
      ['cantor', 'You are most kind. Though I find I am not thirsty.'],
      ['hob', "No. Well. It's there if you change your mind."],
    ],
    lore: 'lore_heir_cantor',
  },
  {
    id: 'hob_witch_first', pri: 86, once: true,
    req: (m, l) => died(l) && as(l, 'witch') && HM(m, 'witch').runs === 1,
    lines: [
      ['hob', "First one's the worst, Isolde. You get up, and the whole world's still where you left it, only you're not the same."],
      ['witch', 'I know what killed me. I want to know why it was still there when I woke up.'],
      ['hob', 'Everything is, lass. Everything is. Tea?'],
      ['witch', 'Is it poisoned?'],
      ['hob', "Only a little. For flavour."],
    ],
  },
  {
    id: 'hob_wren_first', pri: 86, once: true,
    req: (m, l) => died(l) && as(l, 'wren') && HM(m, 'wren').runs === 1,
    lines: [
      ['wren', 'I died! It was very interesting. Everyone looked so cross.'],
      ['hob', "It's meant to be sad, little one."],
      ['wren', 'Oh. Should I be sad? I can try.'],
      ['hob', "Don't. Sit by the fire. Have an apple."],
      ['wren', 'Do I look different? I feel different. I feel like someone has been in the house.'],
    ],
    lore: 'lore_empty_socket',
  },
  {
    id: 'hob_cantor_first', pri: 86, once: true,
    req: (m, l) => died(l) && as(l, 'cantor') && HM(m, 'cantor').runs === 1,
    lines: [
      ['narrator', 'Hob sets out two cups, as he does for everyone. The Brother does not pick his up.'],
      ['cantor', 'I have sat with a great many dying, keeper. I thought I knew what the end was. I confess I did not.'],
      ['hob', "Few do. It's the gentle ones who find it queerest."],
      ['cantor', 'And yet I was not afraid. Is that a grace, do you suppose, or a failing?'],
      ['hob', "Hard to say, Brother. Drink your tea."],
    ],
  },

  // ================================================================== ACT MILESTONES
  {
    id: 'hob_reach_act2', pri: 82, once: true,
    req: (m, l) => !!l && l.act >= 2,
    lines: [
      ['hob', "You were in the Wood. I can smell it on you. Moss, and old sap, and that peculiar cold."],
      ['hob', "They're not unkind, in there. They're just very, very old, and they've never learned to say no to a bargain."],
      ['hob', 'Mind what you eat. Mind what you promise. Mind your name.'],
    ],
    lore: 'lore_weeping_wood',
  },
  {
    id: 'hob_reach_act3', pri: 83, once: true,
    req: (m, l) => !!l && l.act >= 3,
    lines: [
      ['hob', "Ashgrave. You've been in the city."],
      ['hob', "I used to know that hill when it had a different name. Nothing on it but gorse and a sleeping thing. You'd not know it now."],
      ['crown', 'You come closer each time. I notice.'],
      ['hob', "Pay it no mind. It's flirting."],
    ],
    lore: 'lore_ashgrave',
  },
  {
    id: 'hob_reach_act4', pri: 84, once: true,
    req: (m, l) => !!l && l.act >= 4,
    lines: [
      ['hob', 'You went down. Under. I can tell from the soles of your boots.'],
      ['hob', "It's not a place for the living. It's not really a place for the dead, either. It's where the in-between ones went to wait."],
      ['hob', "Did they say anything? No. No, I don't suppose they'd have words. They've been very quiet for a very long time."],
    ],
  },
  {
    id: 'hob_first_boss', pri: 70, once: true,
    req: (m) => Object.keys(m.bossesDefeated || {}).length >= 1,
    lines: [
      ['hob', "You've felled one of the big ones. I felt it through the ground. A sort of settling, like a house after a storm."],
      ['hob', "Don't let it go to your head. There's always another. There's always a bigger one, and a smaller one that's worse."],
    ],
  },

  // ================================================================== WINS & ENDINGS
  ...HEROES.map((h) => ({
    id: `hob_end_crown_${h}`, pri: 99, once: true, req: (m, l) => wonWith(l, 'crown', h),
    lines: [
      ['hob', 'Well. You sat in it. I felt it from here: the whole world going still, like a held breath.'],
      [h, {
        knight: 'I thought it would feel like a verdict. It felt like a door. A closed one.',
        witch: 'It was so quiet. Nothing rotted, nothing grew. I have never been so bored of perfection.',
        wren: 'It gave me every face I asked for. I forgot which one I came in with.',
        cantor: 'I sat, and the dead went quiet, and I thought: so this is silence, when nobody is listening.',
      }[h]],
      ['hob', "And yet here you are, with tea. The Crown's cheating, you see. It keeps all the mornings, even the ones where it won."],
    ],
  })),
  ...HEROES.map((h) => ({
    id: `hob_end_shatter_${h}`, pri: 99, once: true, req: (m, l) => wonWith(l, 'shatter', h),
    lines: [
      ['hob', 'I heard it go. Like a bell with the clapper cut. Then the ash stopped, for one breath. Then every clock in Morrow started again.'],
      [h, {
        knight: 'I broke it. Everything that was held is coming due, Hob. The old. The dead. All of them.',
        witch: 'I know what comes up from the Undercroft now. I hope I was right to let it.',
        wren: 'Something under it cried out when it broke. Not the Crown. Something older. I heard it.',
        cantor: 'They are rising, the ones who waited. I tried to say the words for each. There were too many.',
      }[h]],
      ['hob', "Aye. It'll be a long, strange, dying sort of spring. Sit down. Somebody ought to be sitting down."],
    ],
  })),
  ...HEROES.map((h) => ({
    id: `hob_end_true_${h}`, pri: 101, once: true, req: (m, l) => wonWith(l, 'true', h),
    lines: [
      ['narrator', 'Spring. Real spring: wet, green, ridiculous. The Waystone has moss on it. The oldest grave in the yard stands open, and someone has lain down in it.'],
      ['hob', "Don't mind me. I'm only resting my eyes. Four hundred years, give or take, I've been meaning to."],
      [h, {
        knight: 'Rest, old man. I will keep the door.',
        witch: 'It smells of her. The earth. Like her garden, the summer before.',
        wren: 'I went home. It was exactly as I dreamed, only the ceiling was the sky.',
        cantor: 'Requiescat in pace, Hob. I would say it properly, but I think you would rather I did not make a fuss.',
      }[h]],
      ['hob', "Mind the snowdrops. I planted them early. Saves time."],
    ],
    sets: ['hob_rests'],
  })),
  {
    id: 'hob_weight_1', pri: 78, once: true,
    req: (m, l) => !!l && (l.asc >= 1 || maxAsc(m) >= 1),
    lines: [
      ['hob', "You're walking heavier, aren't you. I can see it in the way you set your feet. That's the Crown leaning on you. Each time you earn it, it leans a little harder."],
      ['hob', "Crown Weight, they'll call it, if anyone's calling it anything. A kindness, really. Means it's taking you seriously."],
    ],
  },
  {
    id: 'hob_weight_5', pri: 78, once: true,
    req: (m, l) => !!l && (l.asc >= 5 || maxAsc(m) >= 5),
    lines: [
      ['hob', "Five. That's a good half a hill of iron on those shoulders. I've seen a man crushed under less."],
      ['hob', "I've also seen a man carry more, for a good long while. It's mostly about not letting go of the right thing."],
    ],
  },
  {
    id: 'hob_weight_10', pri: 78, once: true,
    req: (m, l) => !!l && (l.asc >= 10 || maxAsc(m) >= 10),
    lines: [
      ['hob', "Ten. That's the most it's ever put on anyone, so far as I know. I've buried people who carried half."],
      ['hob', 'You must be either very stubborn or very frightened. I find the two are close kin.'],
    ],
  },

  // ================================================================== THE KNIGHT'S ARC
  beat('knight', 'knight_1', 69, [
    ['hob', "You met a sentry. At a gate. I could tell from your face. Folk always come back from that gate looking like they've been asked something."],
    ['knight', "He asked me who goes there. I could not answer him."],
    ['hob', 'Well. What did you say?'],
    ['knight', '"No one."'],
    ['hob', "That's an answer. It's not a good one. But it's an answer, and you'd be surprised how many never give even that."],
  ]),
  beat('knight', 'knight_2', 68, [
    ['knight', 'I remember something. When I was a boy, my father made me swear. "When I die, do not let them crown another."'],
    ['hob', '...Say that again.'],
    ['knight', '"Do not let them crown another." I had forgotten it entirely.'],
    ['hob', "Oaths are like spades, lad. They dig where you point them. The question's only ever whose idea the hole was."],
  ]),
  beat('knight', 'knight_3', 67, [
    ['hob', "Heard about Grall. Burned a great many good herb gardens, that man."],
    ['knight', 'He asked me who locked the door.'],
    ['hob', 'And?'],
    ['knight', 'No one did. It was never locked, Hob. I stood outside a door that would have opened if I had put my hand to it.'],
    ['hob', "...Ah. That's a heavy thing to carry through a gate. Put it down here a while. The stone won't mind."],
  ]),
  beat('knight', 'knight_4', 66, [
    ['hob', 'The men on the wall. They knew you?'],
    ['knight', "Every one. Harlan. Dobbs. The boy who could not grow a beard. They keep the post still. It is all the dead have."],
    ['knight', 'Crane offered me them back. A captaincy, if I would put a puppet on the throne.'],
    ['hob', 'Did he. And what did you tell him?'],
    ['knight', 'Nothing yet.'],
    ['hob', "Hm. Cheap, for a captain. Dear, for a man."],
  ]),
  beat('knight', 'truth_knight', 65, [
    ['narrator', 'Hob has put his spade aside. It is the first time you have seen him without it.'],
    ['hob', "There's a face I haven't seen on a man in a long while. You look like someone who put something down."],
    ['knight', 'I opened the door. He was alone, Hob. He was alone, and begging, and I stood there for nothing.'],
    ['hob', 'Aye. And what did you swear?'],
    ['knight', 'That is mine.'],
    ['hob', 'Quite right. Nobody\'s business but the oath\'s.'],
  ]),

  // ================================================================== THE WITCH'S ARC
  beat('witch', 'witch_1', 69, [
    ['witch', "It isn't a disease, Hob. The Blight. They are not dying. They're *stopped*, like a clock."],
    ['hob', "Aye. I've had a few of those through. Never took."],
    ['witch', 'Never took?'],
    ['hob', "The earth won't have them. Not till they've finished."],
    ['witch', 'Finished what?'],
    ['hob', 'Dying, lass. Dying.'],
  ]),
  beat('witch', 'witch_2', 68, [
    ['witch', 'My mother wrote to me. A letter in her own hand, from her own garden. Dated after her funeral.'],
    ['hob', 'Did she.'],
    ['witch', "Don't. Don't be gentle with me."],
    ['hob', "I'm never gentle. It's the spade, it makes me look it."],
    ['witch', 'Is she alive, Hob?'],
    ['hob', "I have never dug her a grave, lass. Make of that what you will."],
  ], { lore: 'lore_letter_elowen' }),
  beat('witch', 'witch_3', 67, [
    ['witch', 'They burned us because rot is death. And death is the one thing the Crown cannot abide.'],
    ['hob', "Funny. I'm a gravedigger. The Crown and I have never been friends."],
    ['witch', 'You are not afraid of what I am.'],
    ['hob', "Lass, I've been waiting a long time for someone to bring me a decent amount of rot."],
  ]),
  beat('witch', 'witch_4', 66, [
    ['witch', "There was a ledger. Crane's. A list of the *kept*. My mother's name was in it."],
    ['hob', "They would. Clerks. It's always clerks."],
    ['witch', 'Is she dead?'],
    ['hob', 'No.'],
    ['witch', 'Is she alive?'],
    ['hob', 'No.'],
    ['witch', 'That is not an answer.'],
    ['hob', "It's the only honest one I've got."],
  ]),
  beat('witch', 'truth_witch', 65, [
    ['hob', "You've made up your mind. I can see it. It's the way a woman sets down a cup."],
    ['witch', "She'd want to be let go. Wouldn't she."],
    ['hob', "They mostly do, once someone asks."],
    ['witch', 'And if I am wrong?'],
    ['hob', "Then you'll have been wrong in a good direction. I'll dig her something nice. Dry. Facing the morning."],
  ]),

  // ================================================================== WREN'S ARC
  beat('wren', 'wren_1', 69, [
    ['hob', "You've come back with a splinter in you. I can see it, just behind the mask."],
    ['wren', 'I put on a face that was not mine and something *pulled*. Like a tide. I could not tell which way it was going.'],
    ['hob', "Towards the hill, I'd say. It's always towards the hill."],
    ['wren', 'What is on the hill?'],
    ['hob', "Weighty things. Don't wear strangers' faces, little one. They get sentimental."],
  ]),
  beat('wren', 'wren_2', 68, [
    ['wren', 'There was a lady in the water. She knew me. She said: "My little stolen thing."'],
    ['hob', 'The Queen. Aye. Still there, is she?'],
    ['wren', 'Was I stolen, Hob?'],
    ['hob', "Everyone's stolen from somewhere, Wren. It's the middle part I'd ask about. Who kept you after."],
    ['wren', 'And what do I ask her?'],
    ['hob', "What she took. Not what she stole. There's a difference, in some mouths."],
  ], { lore: 'lore_letter_maren' }),
  beat('wren', 'wren_3', 67, [
    ['wren', 'The fae bowed. They called me Heartwood. It felt right. That is what frightens me.'],
    ['hob', "Heartwood. Hm. Good word. Old."],
    ['wren', 'Why would something feel so right and be so wrong?'],
    ['hob', "The ones that feel right are the ones to be careful of, little one. They're usually just the ones that fit."],
  ]),
  beat('wren', 'wren_4', 66, [
    ['wren', 'The Crown hums when I stand near it. Always the same note.'],
    ['hob', "Does it. I can hear it from here, some nights, when you're asleep. Same note."],
    ['wren', 'You never said.'],
    ['hob', "You never asked. Nobody asks the gravedigger. They think he'll tell them they're dead."],
  ]),
  beat('wren', 'truth_wren', 65, [
    ['hob', "You're going home. It's in your walk."],
    ['wren', 'Where she is. Under the hill.'],
    ['hob', "Aye. Take a coat. It's colder than it looks."],
    ['wren', 'Will you come?'],
    ['hob', "...In my own time, little one. I've a few more graves to see to first."],
  ]),

  // ================================================================== THE CANTOR'S ARC
  beat('cantor', 'cantor_1', 69, [
    ['hob', 'I heard it from here. The bell.'],
    ['cantor', 'It had not been rung in a hundred years. I confess it was gratifying.'],
    ['hob', "Gratifying. Aye. Nobody says that about bells. It's the right word, mind."],
  ]),
  beat('cantor', 'cantor_2', 68, [
    ['cantor', 'No one answers me, Hob. The living. Only the dead, and the three others who walk here.'],
    ['hob', 'Fancy that. Grief does that to a man.'],
    ['cantor', 'Yes. It must be grief.'],
    ['narrator', 'Hob sets the cup by his hand. It does not steam.'],
    ['hob', "Must be. Drink your tea, Brother."],
  ]),
  beat('cantor', 'cantor_3', 67, [
    ['cantor', 'I carry the confession. The Founder, Aldane, tore the heart from a goddess to forge the Crown.'],
    ['hob', 'So they say.'],
    ['cantor', 'You do not seem surprised.'],
    ['hob', "I never knew a man who dug graves without learning something he'd rather not."],
    ['cantor', 'Do you know his name?'],
    ['hob', "Whose? ...Aldane. Everybody knows that, Brother. It's in all the books."],
  ]),
  beat('cantor', 'cantor_4', 66, [
    ['cantor', 'I saw myself laid out in a chapel in Ashgrave. I died, Hob. On Ashfall night, at his bedside.'],
    ['hob', 'Aye.'],
    ['cantor', 'You knew.'],
    ['hob', "I knew you weren't a man who needed my spade. That's not the same as knowing."],
    ['cantor', 'Why did you not say?'],
    ['hob', "Would you have heard it? Some things have to be walked into. I've kept a grave for you the whole while, Brother. Never once had to fill it."],
  ]),
  beat('cantor', 'truth_cantor', 65, [
    ['hob', "Well. You look different. Lighter. A bit see-through."],
    ['cantor', 'Am I?'],
    ['hob', 'In the right light.'],
    ['cantor', 'The confession is to be delivered below the throne. Not to it.'],
    ['hob', "Aye. It is. ...When you get there, Brother. Tell them it's taking longer than I thought. They'll know who."],
  ]),

  // ================================================================== MAIN PLOT
  {
    id: 'hob_met_pell', pri: 64, once: true, req: (m) => F(m, 'met_pell'),
    lines: [
      ['hob', "Met Pell, did you. The late king's fool. Still is, in his fashion. I never could tell if the jokes were for the king or against him."],
      ['pell', '(from behind the stone) Why is a crown hollow?'],
      ['hob', 'Go away, Pell.'],
      ['pell', 'Because the heart walked off!'],
      ['hob', "We've had that one."],
      ['pell', "And you laughed, Hob. Ages back. You laughed, and then you didn't."],
    ],
    lore: 'lore_crown_hollow',
  },
  {
    id: 'hob_pell_2', pri: 63, once: true, req: (m) => F(m, 'pell_2'),
    lines: [
      ['hob', 'Pell told you about the Lady, did he. He tells it too jolly. It is not a jolly story.'],
      ['hob', 'They said she was asleep, under the hill. Nobody checked, I expect.'],
    ],
    lore: 'lore_lady_under_hill',
  },
  {
    id: 'hob_pell_3', pri: 63, once: true, req: (m) => F(m, 'peddler_is_pell'),
    lines: [
      ['hob', "Oh, you've worked out the coats."],
      ['pell', "I've three more at home."],
      ['hob', 'He means it. He has a wardrobe the size of a barn.'],
      ['peddler', 'Prices are fixed. They have always been fixed.'],
      ['pell', '(in a different voice) I do the voices for free.'],
    ],
    lore: 'lore_letter_pell',
  },
  {
    id: 'hob_knows_unspent', pri: 63, once: true, req: (m) => F(m, 'knows_unspent'),
    lines: [
      ['hob', "You've looked through the grate. Then you know how many are down there."],
      ['hob', "I used to count them. Can't any more. It's not a number. It's a weather."],
      ['hob', "They're not ghosts, you know. Ghosts have finished. These are still going. They're so very tired."],
    ],
    lore: 'lore_unspent',
  },
  {
    id: 'hob_knows_heart', pri: 63, once: true, req: (m) => F(m, 'knows_heart'),
    lines: [
      ['hob', 'Pell has told you how it breaks, then.'],
      ['hob', "He's right, mind. Only way. Only way I know, and I've looked at it from most angles."],
      ['crown', 'You have learned what I am. Learning is not the same as acting.'],
      ['hob', "It's afraid. Don't tell it I said."],
    ],
  },
  {
    id: 'hob_crane_knows', pri: 63, once: true, req: (m) => F(m, 'crane_knows'),
    lines: [
      ['hob', 'Crane remembers. All the mornings. Does he.'],
      ['hob', "Then he's lonelier than I'd thought. Nobody should remember alone. It's very bad for the character."],
      ['hob', "He's wrong about what he's doing. He is not stupid. Those are different things, and the second makes the first so much worse."],
    ],
    lore: 'lore_crane',
  },
  {
    id: 'hob_all_truths', pri: 80, once: true, req: (m) => allTruths(m),
    lines: [
      ['crown', 'Four who know. Four who might. Interesting.'],
      ['hob', "It's rattled. I've not heard it rattled in a long time. It's a very small sound. Like a spoon in a cup."],
      ['hob', "You've done it, then. All four of you. Well. I think I'd best have a word with Pell."],
    ],
  },

  // ================================================================== THE REVEAL
  {
    id: 'hob_aldane_1', pri: 100, once: true,
    req: (m) => F(m, 'knows_founder') && !F(m, 'hob_is_aldane'),
    lines: [
      ['narrator', 'The graves are all freshly dug. Every one. Hob is leaning on his spade, not digging, which is new.'],
      ['hob', "Pell's been talking."],
      ['hob', "No, don't. He isn't wrong. He's hardly ever wrong. Terrible habit in a fool."],
      ['hob', "Sit down. I'll put the kettle on. The real tea. I've been saving it a few hundred years."],
    ],
    sets: ['hob_aldane_1'],
  },
  ...HEROES.map((h) => ({
    id: `hob_aldane_2_${h}`, pri: 100, once: true,
    req: (m, l) => F(m, 'hob_aldane_1') && !F(m, 'hob_is_aldane') && as(l, h),
    lines: [
      ['hob', 'My name was Aldane. My father dug graves in the eastern fens, and I learned the trade before I learned the sword.'],
      ['hob', "Then I learned the sword, and found it was the same trade, only faster. There was a lady under a hill. I dug her up, thinking she was gold. She was better. I cut out her heart and set it in iron."],
      ['hob', "I wore it sixty years. Then I gave it to my boy and walked off with my spade, thinking that was the end of it. It wasn't. It never lets go. It wouldn't let me die."],
      ['hob', "So I dig. Every heir of every morning. It seemed the least I could do: to see you all put to bed properly."],
      [h, {
        knight: 'Four hundred years. And you buried every one of us. You never once said.',
        witch: "You absolute old fool. You've been burying my mother's grandchildren's grandchildren and handing me tea.",
        wren: 'You are the one who tore her heart out. And you kept the stone where I would see it. Why?',
        cantor: 'Aldane. The Founder. The one who ascended to the right hand of Heaven. I have read your tomb, you know. It is empty.',
      }[h]],
      ['hob', "Aye. I know. I've been meaning to fill it. In my own time."],
    ],
    sets: ['hob_is_aldane'], lore: 'lore_letter_aldane',
  })),
  {
    id: 'hob_founder_chronicle', pri: 68, once: true,
    req: (m) => F(m, 'hob_is_aldane'),
    lines: [
      ['hob', "I read the Chronicle, you know. The one the court wrote about me. 'Ascended to sit at the right hand of Heaven.'"],
      ['hob', "I laughed till I had to sit down. Sixty years in a chair, and then forty on a road, and another three hundred digging. I never got further than the end of the lane."],
    ],
    lore: 'lore_founder',
  },
  ...perHero('hob_aldane_after', {
    pri: 60, when: (m) => F(m, 'hob_is_aldane'), bark: false,
    pre: [['narrator', 'Hob is mending the spade handle. It is, you notice, the same spade as always, and the handle is new.']],
    say: {
      knight: 'You gave me tea the first morning. A king made me tea.',
      witch: 'I would still like to hit you. I would like that very much. I would like to hit you gently, afterward, with a blanket.',
      wren: 'Do you want a mask? You could be someone else for a day. It is good practice.',
      cantor: 'Shall I hear your confession? I am told I have a good ear. It is all I seem to have left.',
    },
    post: [['hob', "Not yet, Brother. Not yet, any of you. But thank you. Nobody's offered in a very long time."]],
  }),

  // ================================================================== DEATHS TO ACT 1
  ...killers('hob_die_bragg', ids('a1_boss_bragg'), {
    pri: 66, lore: 'lore_bragg',
    pre: [['hob', 'Bragg. I heard the horn clear from here. Lovely tone, for a thug.']],
    say: {
      knight: 'I stood my ground. It was not enough.',
      witch: "I could have cured the hounds. If anyone had stood still long enough to be cured.",
      wren: 'The dogs liked me. It was the men I could not convince.',
      cantor: 'I said the office for the dogs as well. They, at least, seemed to listen.',
    },
    post: [['hob', "He feeds the hounds first. Remember that, if you go again. It's the one useful thing about him."]],
  }),
  ...killers('hob_die_sheriff', ids('a1_boss_sheriff'), {
    pri: 66, lore: 'lore_hanged_sheriff',
    pre: [['hob', "Gallow. He's hanged you with the same rope he's used since Ashfall. Good rope. Never wears out."]],
    say: {
      knight: 'He asked for my name for the writ. I gave it. Is that not absurd?',
      witch: 'I tried to diagnose him. He tried to hang me. Rude.',
      wren: 'He kept asking if I had a neck to be hanged by. I said I would check.',
      cantor: 'I offered him absolution. He said he was too busy.',
    },
    post: [['hob', "He's not cruel. That's what makes it so hard to argue with. He just can't think what else a sheriff's for."]],
  }),
  ...killers('hob_die_rats', ids('a1_boss_rats'), {
    pri: 66, lore: 'lore_mother_of_rats',
    pre: [['hob', "The Mother of Rats. You'll want to wash. I've boiled water."]],
    say: {
      knight: 'She sang. I could not raise my sword over the song.',
      witch: 'I wanted to ask her what she knew. It is possible she knew everything.',
      wren: 'She called me little one. I liked it. Is that terrible?',
      cantor: 'She keeps every one of them warm. I have never seen such devotion.',
    },
    post: [['hob', 'She does love them, you know. All of them. It is the loving that did the damage.']],
  }),
  ...killers('hob_die_rendrick', ids('a1_rendrick'), {
    pre: [['hob', 'Sir Rendrick. Eighty years on a rope, and he still salutes the fallen. Manners cost nothing.']],
    post: [['hob', "He isn't a bad man. Just a man who was punished for the wrong thing, for a very long time."]],
  }),
  ...killers('hob_die_bogmother', ids('a1_bog_mother'), {
    pre: [['hob', "The Bog Mother. Soft all the way down, that one. It's the soft ones you can't climb out of."]],
  }),
  ...killers('hob_die_ashchoir', ids('a1_choir'), {
    pre: [['hob', "The Ashen Choir. I hear them from here at night. They're flat. They've been flat since the King died."]],
    post: [['hob', 'Somebody should tell them the hymn ended. Somebody brave, with earplugs.']],
  }),
  ...killers('hob_die_act1', (m, l) => l.act === 1 && ['easy', 'hard'].includes(poolOf(l)), {
    pri: 58,
    pre: [['hob', "Something small, then. Don't be ashamed. It's always something small. The big ones you see coming."]],
  }),

  // ================================================================== DEATHS TO ACT 2
  ...killers('hob_die_grall', ids('a2_boss_grall'), {
    pri: 66, lore: 'lore_grall',
    pre: [['hob', "Grall. He's burned half the herb gardens in Morrow. I take it personally."]],
    say: {
      knight: 'He asked who locked the door. I could not answer him.',
      witch: 'He said fire is a kindness. He believes it. That is the worst part.',
      wren: 'He called me a thing. Nobody has called me a thing in a good while.',
      cantor: 'I tried to pray for him. He prayed louder.',
    },
    post: [['hob', "He means well. That's the dangerous kind. The ones who mean badly at least have the decency to be inconsistent."]],
  }),
  ...killers('hob_die_antlered', ids('a2_boss_antlered_king'), {
    pri: 66, lore: 'lore_antlered_king',
    pre: [['hob', "The Antlered King. Fair face, hasn't he. Never his."]],
    say: {
      knight: 'He knelt to nobody. He looked as though he were waiting.',
      witch: 'The wood is *alive*, Hob. Everything in it is breathing, together.',
      wren: 'His courtiers stopped, when I came in. They looked at me like I was late.',
      cantor: 'There was a sorrow in him older than any I have heard confessed.',
    },
    post: [['hob', "He's waiting for something. Old things always are. He's been at it a good while. Longer than me."]],
  }),
  ...killers('hob_die_abbess', ids('a2_boss_abbess'), {
    pri: 66, lore: 'lore_drowned_abbess',
    pre: [['hob', 'The Abbess. Poor lady. She walked past this very stone once, twenty years ago, in a blue gown, carrying something close.']],
    say: {
      knight: 'She looked at me as though I were someone she had meant to apologise to.',
      witch: 'She sang. I have never been so tempted to lie down in cold water.',
      wren: 'She knew me. She said I was hers. It is very hard to hit someone who says that.',
      cantor: 'I knelt. I think she was grateful. I do not think it saved me.',
    },
    post: [['hob', "I've wondered since what it was. A gravekeeper sees a great many people, carrying a great many things."]],
  }),
  ...killers('hob_die_thornwarden', ids('a2_thornwarden'), {
    pre: [['hob', 'The Thornwarden. Armour grown into the man, ring by ring. Never gets to take it off. I know a bit about that.']],
  }),
  ...killers('hob_die_inquisitor', ids('a2_inquisitor'), {
    pre: [['hob', "Grall's man. Never lost his temper. Never found anyone innocent. Some people are born to be a verdict."]],
  }),
  ...killers('hob_die_merehag', ids('a2_mere_hag'), {
    pre: [['hob', "The Mere-Hag. The nuns stopped the candles, so she came up the steps. You can't cheat the water of its rent."]],
  }),
  ...killers('hob_die_act2', (m, l) => l.act === 2 && ['easy', 'hard'].includes(poolOf(l)), {
    pri: 58,
    pre: [['hob', "The Wood took you. It does that. Takes, mostly. Seldom gives anything back before it's ready."]],
  }),

  // ================================================================== DEATHS TO ACT 3
  ...killers('hob_die_crane', ids('a3_crane'), {
    pri: 66, lore: 'lore_crane',
    pre: [['hob', "Crane. Thin man, polite, never raises his voice. You've noticed it's always the polite ones."]],
    say: {
      knight: 'He offered me a captaincy while he took my head. He was courteous about both.',
      witch: 'He read me like a ledger. I could feel him tallying.',
      wren: 'He did not look at my mask. He looked at where I would be.',
      cantor: 'He said he had heard my confession before. I have never confessed to him.',
    },
    post: [['hob', "He's balancing a ledger. I've seen the type. I just never thought one would survive being a clerk."]],
  }),
  ...killers('hob_die_choir', ids('a3_choir'), {
    pri: 66, lore: 'lore_choir',
    pre: [['hob', "The Choir Immaculate. Forty throats, one voice. There's a good deal of breath in a choir that size."]],
    say: {
      knight: 'I could not hear myself think. I could not hear myself die.',
      witch: 'They were hitting a note my teeth objected to.',
      wren: 'I tried to sing along. I think I was flat.',
      cantor: 'They were beautiful. That is the unforgivable thing. They were beautiful, and they could not stop.',
    },
  }),
  ...killers('hob_die_rival', ids('a3_rival'), {
    pri: 66, lore: 'lore_crowned_rival',
    pre: [['hob', 'You met the Crowned one. I... knew them. One of ours, from another morning.']],
    say: {
      knight: 'He had my face and none of my doubt. I did not like how well it suited him.',
      witch: 'She had every answer I wanted. That was how I knew she was wrong.',
      wren: 'They had every face but one. I have never felt so seen.',
      cantor: 'He gave me a grave to rest in. I almost took it.',
    },
    post: [['hob', "They look so sure, in the Crown. It's the surest thing there is: being the one who didn't get out."]],
  }),
  ...killers('hob_die_executioner', ids('a3_executioner'), {
    pre: [['hob', "The King's Executioner. Sixty years of justice and not one of his heads ever stopped talking. I've met a few. They go on and on."]],
  }),
  ...killers('hob_die_heralds', ids('a3_heralds'), {
    pre: [['hob', 'The Heralds. Same dawn, same dusk, ninety-one years. Imagine being the only one who knew the hour, and nobody listening.']],
  }),
  ...killers('hob_die_saint', ids('a3_gilded_saint'), {
    pre: [['hob', "The Gilded Saint. There's a woman in there, you know. Somebody ought to let her out."]],
  }),
  ...killers('hob_die_act3', (m, l) => l.act === 3 && ['easy', 'hard'].includes(poolOf(l)), {
    pri: 58,
    pre: [['hob', 'The city. Aye. Never liked Ashgrave. Too many bells and too few doors.']],
  }),

  // ================================================================== DEATHS BENEATH / EVENTS
  ...killers('hob_die_unspent', ids('a4_unspent'), {
    pri: 66, lore: 'lore_unspent',
    pre: [['hob', "The Unspent. I know every one of them by the weight. You're not to hurt them, you understand. Only to help."]],
  }),
  ...killers('hob_die_hollowking', ids('a4_hollow_king', 'a4_hollow_crown'), {
    pri: 66, lore: 'lore_hollow_king',
    pre: [['hob', "The Hollow King. Aldric. He'd have been a good man, left alone. Most are."], ['hob', "Ninety-one years he wore it. That's a long time to do anything you don't want to."]],
  }),
  ...perHero('hob_die_event', {
    pri: 57, bark: true,
    when: (m, l) => diedInEvent(l),
    pre: [['hob', "Killed by the *road*? Well. It's the little ones that get you."]],
    post: [['hob', "The road doesn't care who you are. I've always found that restful."]],
  }),

  // ================================================================== PELL & THE CROWN
  {
    id: 'hob_pell_visit', pri: 54, once: true, req: (m) => F(m, 'met_pell'),
    lines: [
      ['narrator', 'A fool in motley is sitting on the Waystone, swinging his heels. One of his bells has fallen off. It is ringing anyway.'],
      ['pell', "Hob! Hob, Hob, Hob. Tell the lad the one about the king who couldn't sleep."],
      ['hob', 'I will not.'],
      ['pell', "Then tell me the one about the gravedigger who couldn't die."],
      ['hob', '...Go home, Pell.'],
      ['pell', 'Which one?'],
    ],
  },
  {
    id: 'hob_crown_all', pri: 40, once: true, req: (m, l) => !!l && l.act >= 3 && m.deaths >= 12,
    lines: [
      ['crown', 'I have counted each of you. I would not like you to think I had not.'],
      ['hob', "It counts them like a miser counts coin. Don't encourage it."],
    ],
  },
  {
    id: 'hob_pell_idle_bells', pri: 8, once: false, req: (m) => pre(m) && F(m, 'met_pell'),
    lines: [
      ['narrator', 'Someone has tied six little bells to the Waystone. None of them ring. Hob unties them, grumbling, and drops them in his pocket. By the time you turn round, they are back.'],
    ],
  },
  {
    id: 'hob_pell_idle_riddle', pri: 8, once: false, req: (m) => pre(m) && F(m, 'met_pell'),
    lines: [
      ['pell', "What's full when it's empty, and empty when it's full?"],
      ['hob', 'A grave.'],
      ['pell', 'Or a crown. I never could tell.'],
    ],
  },
  {
    id: 'hob_pell_idle_coat', pri: 8, once: false, req: (m) => pre(m) && F(m, 'peddler_is_pell'),
    lines: [
      ['pell', "Don't look at me. I'm on holiday."],
      ['hob', "You're never on holiday."],
      ['pell', "I'm on holiday from being on holiday."],
    ],
  },
  {
    id: 'hob_crown_idle', pri: 8, once: false, req: (m, l) => pre(m) && !!l,
    lines: [
      ['crown', 'Again.'],
      ['hob', "It's only got the one word, that thing. I've tried teaching it others."],
    ],
  },

  // ================================================================== AFTER A WIN
  ...HEROES.map((h) => ({
    id: `hob_after_win_${h}`, pri: 12, once: false,
    req: (m, l) => pre(m) && !!l && l.won && l.hero === h,
    lines: [
      ['hob', 'You came back. Folk do, from the chair. Funny how it never takes.'],
      [h, {
        knight: 'I keep looking for the door.',
        witch: "I keep waiting for something to rot. It's unnerving.",
        wren: 'I am still wearing a face I do not remember choosing.',
        cantor: 'It is very quiet in here. Is it always this quiet?',
      }[h]],
      ['hob', 'Aye. Sit. There is tea.'],
    ],
  })),

  // ================================================================== AFTER A DEATH: PER HEIR (repeatable)
  ...[
    ['knight', 'The knight kneels by his grave, adjusting a stone that does not need adjusting.', 'You always tidy them. Nobody asked you to.', 'Somebody must. It was a poor funeral otherwise.'],
    ['witch', 'The witch is chewing a stalk of rue and glaring at the sky as if it owed her money.', "Cheer up, lass. You're only dead a little.", "I am dead *rather a lot*, Hob. It is beginning to feel like negligence."],
    ['wren', 'Wren has arranged the apples in a pattern on the stone. It means something. It always does.', "That one's for the jackdaw.", 'Which jackdaw?'],
    ['cantor', 'The Brother is reading the names on the stones, softly, like a man counting his flock.', "You're a quiet one, Brother.", 'It is a quiet place. I do not wish to disturb the residents.'],
  ].map(([h, scene, a, b]) => ({
    id: `hob_idle_death_${h}`, pri: 11, once: false,
    req: (m, l) => pre(m) && died(l) && l.hero === h,
    lines: [['narrator', scene], ['hob', a], [h, b]],
  })),

  // ================================================================== AFTER HOB RESTS (post true ending)
  ...[
    [['narrator', 'The Waystone has moss on it. The oldest grave in the yard is closed, and snowdrops grow in a neat line along its edge. Nobody planted them. Everybody knows who did.']],
    [['narrator', 'A spade stands upright at the head of the oldest grave. You do not touch it. The handle is warm.'], ['hob', '(from below, drowsily) ...mind the third step...']],
    [['narrator', 'The graves are no longer freshly dug. They have settled into the earth, and the grass has grown over them. It is a very ordinary graveyard now.']],
    [['hob', '(from the earth, a long way down) Is that the tea? Leave it. I\'ll get to it. In my own time.']],
    [['narrator', 'The ash has stopped. In its place there is rain, soft and ordinary and cold. You stand in it a while, and nobody hurries you.']],
  ].map((lines, i) => ({
    id: `hob_idle_rested_${i + 1}`, pri: 11, once: false, req: (m) => trueDone(m), lines,
  })),

  // ================================================================== IDLE (repeatable, Hob above ground)
  idle('hob_idle_tea', [['hob', "Tea? It's the same tea. It's always the same tea. I've found that's rather the point of tea."]]),
  idle('hob_idle_digging', [
    ['narrator', 'Hob is digging. He nods in time with the spade, a long slow rhythm, like a man humming without the tune.'],
    ['hob', "Don't mind me. Getting ahead of the day."],
  ]),
  idle('hob_idle_ash', [['hob', "Ash again. Nice, that. Good for the roses, if I had roses."]]),
  idle('hob_idle_yew', [['hob', "Fresh one for you by the yew. Good drainage. I've always said, if you're going to die, do it somewhere dry."]]),
  idle('hob_idle_stone', [['hob', "Don't lean on the Waystone. She's old, and she gets ideas."]]),
  idle('hob_idle_lantern', [
    ['narrator', 'A lantern hangs over each new grave, burning low and white.'],
    ['hob', 'So they can find their way out, if they must.'],
  ]),
  idle('hob_idle_ledger', [['hob', "I keep a ledger. Not for the money. Somebody ought to write you down."]], (m) => m.deaths >= 5),
  idle('hob_idle_tune', [['hob', "You know the tune? No? Shame. It's a lovely one. Nobody's hummed it in a very long time."]]),
  idle('hob_idle_graves', [['hob', "Funny thing about my graves. They're never occupied for long."]]),
  idle('hob_idle_crow', [['hob', "That crow's been watching us. Don't mind him. He's only waiting for the next one. They always know."]]),
  idle('hob_idle_eat', [['hob', 'Eat before you go. Dying on an empty stomach is a dreadful thing.']]),
  idle('hob_idle_hats', [['hob', "Whatever you do, don't trust a man who's too cheerful. Or a woman. Or a hat. Hats, especially."]]),
  idle('hob_idle_mornings', [['hob', 'Mornings keep coming. I used to think that was a good thing.']]),
  idle('hob_idle_names', [['hob', "I cut your name on the marker, in case you were wondering. Spelling's all right. I've had practice."]]),
  idle('hob_idle_crown_hum', [['hob', "The Crown's awake. I feel it through the soles of my boots. It does that when you're getting close to something."]], (m) => m.runs >= 3),
  idle('hob_idle_encourage', [['hob', "You're doing better than you think. That's not flattery. I've the data."]], (m) => m.deaths >= 3),
  idle('hob_idle_road', [['hob', "The road goes east, and then it goes wrong. Keep to the left, where the ground's dry."]]),
  idle('hob_idle_death_shy', [['hob', "People say death comes for everyone. In Morrow it's been rather shy."]]),
  idle('hob_idle_spade', [['hob', "This spade's older than the road. Handle's been replaced thirty times, blade twice. Still the same spade. Don't ask me how."]], (m) => m.runs >= 4),
  idle('hob_idle_sit', [['hob', "Sit. Breathe. It'll come back. Everything comes back. That's the trouble."]], (m, l) => died(l)),
  idle('hob_idle_practice', [['hob', "You're getting quicker at it. Practice shows."]], (m, l) => died(l) && m.deaths >= 10),
  idle('hob_idle_fire', [
    ['narrator', 'A small fire burns in the lee of the stone. Hob has set out three cups. He does not seem to find this strange.'],
    ['hob', "Habit. There used to be more of us."],
  ], (m) => m.runs >= 2),
  idle('hob_idle_blight', [
    ['hob', "The Blight's moved a mile since yesterday. Not far. A walking man's pace, I'd say, with a limp."],
    ['hob', "It's not coming for us. It's only coming home."],
  ], (m) => m.runs >= 2),
  idle('hob_idle_kettle', [['hob', "Kettle's on. It's always on. I think it's the only thing in Morrow that's keeping proper time."]]),
  idle('hob_idle_peddler', [['hob', "If you meet a fellow with a cart on the road, be civil. He remembers who's rude."]], (m) => m.runs >= 3),
]);

// =================================================================================
// TEXTS
// =================================================================================
defineTexts({
  // The Crown, on the death screen. Cold, patient, very old.
  death_lines: [
    'Again.',
    'Not yet.',
    'You were close. Closeness is not a measure.',
    'I have held this hour for four hundred years. I can hold it for one more of you.',
    'Rise.',
    'The hour holds. It is you who slip.',
    'Do not mistake my patience for mercy.',
    'Another morning. Another heir. The ash is the same.',
    'I remember every one of you. It is not a comfort. It is only true.',
    'You taste of iron and ash. Go back.',
    'Death is a thing I do not permit. You have been permitted a rehearsal.',
    'Blood, and Kin, and Ward, and Witness. One of you will wear me. Not yet. Not you. Again.',
    'You think you are learning. I am merely allowing it.',
    'The stone is waiting. The old man is waiting. I am waiting. We are all very good at it.',
    'It does not hurt me to watch. It does not hurt me at all.',
    'Closer. A little closer each time. I feel your footsteps through the hill.',
    'Your dying is very small. I am very large. This is the arrangement.',
    'The hour has not changed. Only you have.',
    'Sleep, if you must. I will not.',
    'Why do you keep getting up? I ask out of something like curiosity.',
    'Every road ends at the throne. Yours has merely taken the long way.',
    'Do not be afraid. Fear is for things that end.',
    'Again, little heir. Again, little thief.',
    'Heavy, is it not? The hour. You carry only a morning of it.',
    'I have broken kings with less patience than I show you.',
  ],

  // The Pale Peddler. Remembers the loops; Pell slips through the coat.
  shop_greet: [
    "Back again? Prices haven't changed. Nothing ever changes.",
    "Ah, the customer. Or the customer's ghost. Both pay in the same coin.",
    'Welcome, welcome. Mind the ash on the rug. I swept it yesterday. And the day before. And... well.',
    'You look dreadful. Dreadful sells. Have a look.',
    "Same stock as last time, same stock as the time before. I've moved things about so you'll think it's new. It works on everyone.",
    'Do not touch the cat. The cat is not for sale. The cat is not, strictly speaking, a cat.',
    "Another face, another purse. You'll find I'm very fair. Fairly... fair. (cough) Take a look.",
    'Oh good, a customer. I was starting to talk to the goods.',
    'Gold for goods, goods for gold, and neither one will keep you warm. ...Ahem. Welcome. Ignore me. Occupational hazard.',
    "You again. I do wish you'd stop dying in my direction. It's very bad for business.",
  ],
  shop_buy: [
    'A fine choice. I say that to everyone, but this time I almost mean it.',
    'Sold. No refunds. No returns. (Except yours.)',
    "It'll serve you well. Or it won't. Either way you'll remember me.",
    "Pleasure. I'll put the coin with the others. There's a great many others.",
    'Oh, that one. Nobody ever buys that one, and then somebody does, and then it is gone and I miss it.',
    'You have an eye. Or you have a hole in your deck, which looks the same from here.',
    'Careful with that. It bites. Not literally. Literally, in some cases.',
    "Thank you, thank you. Kind of you. Kind is rare. I've a soft spot for it.",
    'The price is the price. The price has always been the price.',
    "Take it. You'll need it. I mean, you'll use it. I mean... never mind what I mean.",
  ],
  shop_leave: [
    "Mind the road. It isn't a nice one. It never was.",
    'Come back soon. You will. They always do.',
    "Don't die before you spend it. That's the whole point of gold.",
    "If you see a fool in motley, tell him I'm not in. Tell him anything. He won't believe it.",
    'Off you go. The world is that way, and so is the other thing.',
    "Go well. Or go badly, and I'll see you again, and we'll have this conversation. It's a nice conversation.",
    "The prices won't change. The road will. Pity.",
    'Next time bring more. Or less. Whatever it is you have too little of.',
    "Farewell, then. I'll keep the lamp on. I always keep the lamp on.",
    "Safe travels. I say that to all my customers. I've yet to be right.",
  ],

  // Campfire thoughts at rest sites.
  rest_lines: {
    knight: [
      'You oil the blade though it is not dirty. The work keeps your hands honest.',
      'Somewhere a door is closing. It is only the wind. It is always only the wind.',
      'Harlan used to say a soldier\'s worst enemy was a quiet night. He was right, as usual. You wish you could tell him.',
      'You count the oaths you have kept and the ones you have not. The second pile is shorter. It is also heavier.',
      'The fire pops. You reach for your sword before you remember it is only a fire. You will reach again in an hour.',
      'Someone once told you the point of a shield was to be there. You were there. You are always there. It was not the same thing.',
    ],
    witch: [
      'You grind a pinch of nightshade, rue and something you will not name. It smells like your mother\'s kitchen. You grind it again.',
      'You hold your hand over the flame and watch the fine green web under the skin. Still no fever. Still no cure. Still you.',
      'The Blight goes on without you, patiently. You wish, more than anything, that you could dislike it properly.',
      'You make notes by the fire. *Stopped, not dead.* You underline it, and then, because no one can see, you underline it again.',
      'A moth circles the fire. You catch it, look at it, let it go. It lives. Everything here would, if you let it.',
      'You talk to your mother\'s empty chair, the way you do. It has never once talked back. You keep leaving the chair out.',
    ],
    wren: [
      'You try on a face by the firelight, then another. A woman with a scar. A boy with a gap in his teeth. None of them stay. All of them were kind.',
      'You ask the fire what it is afraid of. It crackles. You decide that means rain.',
      'There is a bird in the tree. You think it is a wren. You tell it so. It does not agree.',
      'The mask in your lap is warm, as if someone else had been wearing it. Perhaps you are. Perhaps that is the trouble.',
      'You practise a laugh. It comes out wrong, then right, then wrong. You laugh at that, and it is yours.',
      'Somewhere under your smooth skin, something is humming. A lullaby. Only the tune, not the words. You hum back.',
    ],
    cantor: [
      'You say the evening office aloud, to the fire, to the dark. Your voice is steady. Nobody answers. You answer yourself, as the Order taught you.',
      'The candle in your pocket is down to a stub. You light it. It burns without shortening, and you decide not to notice.',
      'You warm your hands, and they do not get warmer. You rub them together. It is the gesture that comforts, you tell yourself, not the heat.',
      'A hymn comes to you from nowhere, one you have not sung since the novitiate. You sing it low, so as not to wake what is sleeping.',
      'You pray for the people you have met. You pray for the ones you have not. You pray, briefly, for yourself, and feel faintly foolish.',
      'Doubt, you have found, is also a kind of prayer. It asks, and does not insist. You sit with yours a while, like an old friend.',
    ],
  },

  title_quotes: [
    '"Blood, and Kin, and Ward, and Witness. One of you will wear me."  The Hollow Crown',
    '"It is always the morning after."  Overheard in the Ashen Marches',
    '"Iron for the ring of it, root for the stone. Why is the crown hollow? The heart walked home."  A children\'s rhyme, the Weeping Wood',
    '"I dig them early. Saves time."  Hob, keeper of the Waystone',
    '"Nobody dies in Morrow. It is the most dreadful thing about it."  Granny Hesketh, deceased',
    '"The Crown does not grant long life. It forbids ending. These are different things."  Magister Corvin Ash, De Hora Tenenda (suppressed)',
    '"Why is a crown hollow? Because the heart walked off."  Pell, the King\'s Fool',
    '"Again."  The Crown',
  ],

  hero_select: {
    knight: '"I was told to let no one in. I never asked what I was keeping out."',
    witch: '"Everything rots. That is not the tragedy. The tragedy is that nobody will let it."',
    wren: '"I am told I am missing something. I keep asking where I put it."',
    cantor: '"I heard a king\'s last confession. I carry it still. I am told it grows no lighter."',
  },
});
