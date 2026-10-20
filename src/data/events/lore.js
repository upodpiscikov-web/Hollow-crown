// The Chronicle: lore entries unlocked by events (g.unlockLore) and hub lines (lore:).
// Crown myths are deliberately unreliable: they are what Morrow believes, not what is true.
import { defineLore } from '../../engine/registry.js';

const P = (...paras) => paras.join('\n\n');

defineLore([
  // ------------------------------------------------------------------ WORLD
  {
    id: 'lore_morrow', cat: 'world', title: 'Morrow',
    text: P(
      'A kingdom of fen, forest and stubborn hills, bounded on three sides by marsh and on the fourth by the sea, which Morrow has never trusted.',
      'Its people are known abroad for three things: good wool, bad weather, and old age. Under the Long King a Morrowman could expect to see a hundred and ten winters, and many saw more than they wished. Travellers remarked that nothing in Morrow ever seemed to change: the same faces at the same inns, the same bread, the same rain.',
      'The Morrowfolk called this peace. Foreigners called it something else, and stopped visiting.',
    ),
  },
  {
    id: 'lore_ashgrave', cat: 'world', title: 'Ashgrave',
    text: P(
      'The capital: a crown of spires on a hill, ringed by three walls and too many bells. The palace stands at the summit. Beneath it lies the city\'s oldest quarter, the Undercroft, which every map leaves blank and every child in Ashgrave can find.',
      'Before Aldane the hill was called Highmoor. It took the name Ashgrave from the pyres on which the Founder burned the seven hill-kings and their households. The citizens do not like to be reminded of this.',
      'Since Ashfall the gates have been sealed by order of the Regent, and the bells ring every hour but one.',
    ),
  },
  {
    id: 'lore_long_king', cat: 'world', title: 'Aldric IV, the Long King',
    text: P(
      'Crowned at nineteen, dead at a hundred and ten, and in all the years between he looked no older than fifty. He outlived three physicians-royal, two wives, every enemy and most of his friends.',
      'Under his reign no harvest failed and none improved; no plague took hold; no war was fought, for no one would make war on a king who could not be waited out.',
      'In his ninetieth year he stopped attending court. In his ninety-first, the servants say, he stopped sleeping, and was heard at night arguing with someone in an empty room.',
    ),
  },
  {
    id: 'lore_ashfall', cat: 'world', title: 'The Night of Ashfall',
    text: P(
      'At the third bell after midnight, King Aldric IV died in his bedchamber. The Crown rolled from his head and across the floor, and stopped, the guards swore, standing upright on its rim.',
      'At that same hour the stars went out over Ashgrave, the sky turned the colour of old pewter, and ash began to fall: not smoke-ash, but fine and grey and cold, like the snow of some other country.',
      'It has not stopped. The ash never settles, quite. It is always freshly fallen. Some in the Marches will tell you, if you buy the drink, that it has been the morning after Ashfall for a very long time.',
    ),
  },
  {
    id: 'lore_blight', cat: 'world', title: 'The Blight (Physicians\' Circular)',
    text: P(
      '*By order of the College of Physicians.* The contagion called the Blight presents as greyness of the skin, cessation of appetite, and stillness. Sufferers do not decline. They do not die. They simply cease, mid-word or mid-stride, and remain so.',
      'The College advises that the afflicted be kept warm and spoken to kindly, as they may yet recover. (None has.)',
      'The first cases were recorded some twenty years before Ashfall, in the year the Queen drowned. Since Ashfall the Blight spreads outward from the capital at the pace of a walking man. Rot-craft, folk remedies and prayer are forbidden. Persons practising them are to be reported to the Witchfinder.',
    ),
  },
  {
    id: 'lore_waystone', cat: 'world', title: 'The Waystone',
    text: P(
      'A standing stone at the edge of Morrow, older than the kingdom, older than the road that bends to go around it. Its carvings have weathered to a kind of whisper.',
      'Around it lies a graveyard that appears on no parish register, kept by a gravekeeper who appears on no census. The graves are well tended and freshly dug. Several bear names. Several bear the same names.',
      'Travellers who rest against the stone report dreams of a long road, a short life, and someone saying, very patiently: *Again.*',
    ),
  },
  {
    id: 'lore_ashen_marches', cat: 'world', title: 'The Ashen Marches',
    text: P(
      'Grey fen and greyer villages, a gibbet at every crossroads, and peat that burns with a blue flame and smells of old pennies. The Marches were always poor and always loyal, which in Morrow amounts to the same thing.',
      'Since Ashfall the ash lies thickest here, drifting into the reeds like a second winter. The roads are watched by deserters and the fens by stranger things.',
      'The villagers go about their business with the dogged air of people who have done today before, and cannot think why it feels so familiar.',
    ),
  },
  {
    id: 'lore_long_years', cat: 'world', title: 'The Long Years',
    text: P(
      'Under the Long King no one in Morrow died when they ought to. Grandmothers lived to see their grandchildren go grey. Farms passed to no one, because no one passed. Young men of seventy waited, hat in hand, to inherit.',
      'The Crown Court of Inheritance was dissolved in the King\'s fortieth year for want of business, and its judges, unemployed, lived another seventy. Physicians grew rich on ailments that never finished. Gravediggers took up other trades.',
      'It was, the court poets agreed, a golden age. The poets, being in no danger of dying, rather ran out of things to say.',
    ),
  },
  {
    id: 'lore_weeping_wood', cat: 'world', title: 'The Weeping Wood',
    text: P(
      'A black forest north of the Marches where the trees weep a red sap in every season. The fae lived there before Morrow had a name, and live there still, though the Archcanonry insists they were driven out four hundred years ago.',
      'Woodcutters who go in come out with their axes rusted and their hair gone white, and sometimes with a stranger\'s child by the hand.',
      'On the far side, where the wood drowns in a mere, the bells of the Drowned Abbey still ring beneath the water. No one living rings them.',
    ),
  },
  {
    id: 'lore_undercroft', cat: 'world', title: 'The Undercroft',
    text: P(
      'Beneath the palace of Ashgrave lies the oldest part of the city: vaults, ossuaries, and older things below them. Kings are crowned in the throne room above, and their sins, the priests say, are buried below. Entry has been forbidden since the reign of Aldane.',
      'Rat-catchers who work the lower sewers will tell you, for a drink, that on quiet nights you can hear something under the grates. Not rats. Rats do not whisper.',
      'Rats do not ask, all together, in a hundred thousand voices, whether it is time yet.',
    ),
  },

  // ------------------------------------------------------------------ CROWN (unreliable)
  {
    id: 'lore_crown_hollow', cat: 'crown', title: 'Why Is the Crown Hollow?',
    text: P(
      '*Iron for the ring of it, / Gold for the shine, / Why is the crown hollow? / To leave room for the wine.* (Sung in the taverns of Ashgrave.)',
      '*Iron for the ring of it, / Bone for the band, / Why is the crown hollow? / A thief had a hand.* (Sung in the Marches.)',
      '*Iron for the ring of it, / Root for the stone, / Why is the crown hollow? / The heart walked home.* (Sung only on the edge of the Weeping Wood, and only by children nobody can quite remember having.)',
    ),
  },
  {
    id: 'lore_coronation', cat: 'crown', title: 'The Rite of Crowning',
    text: P(
      '*The Archcanon shall raise the Crown and say: Behold the Hollow, which holds the Hour. Behold the iron that does not rust and the circle that does not end. He who wears it shall bear the Hunger beneath the throne, that his people be spared it. He shall be its vessel and its warden. He shall not die while it is fed.*',
      '*The congregation shall answer: Long live the King.*',
      '*The Archcanon shall then set the Crown upon the heir\'s head. The heir shall not cry out.*',
      'In the margin of the oldest copy, in a later hand: *Every one of them cried out.*',
    ),
  },
  {
    id: 'lore_hunger', cat: 'crown', title: 'The Hunger Beneath the Throne',
    text: P(
      '"Beloved, there is a Hunger beneath the throne. It was there before the throne. It ate the hill-kings and their children, until Aldane the Founder bound it in iron and made of himself its vessel. Every king since has carried it, that you need not.',
      '"When you see your king grow thin, give thanks. When you see him grow old, pray. For if ever the Crown should lack a head, the Hunger will rise from beneath the hill and eat the world."',
      'From a sermon of Archcanon Ulrich for the King\'s fiftieth jubilee. The Archcanon is a hundred and forty-one, and preaches it still.',
    ),
  },
  {
    id: 'lore_lady_under_hill', cat: 'crown', title: 'The Lady Under the Hill',
    text: P(
      'Before kings, the old wives say, the land had a mother. She was pale as frost and patient as roots, and she kept the turning of the year: she gave the dead their rest and the spring its green. Where she slept, under the hill, the soil was sweet.',
      'A warlord came with iron and dug her up and cut her open, looking for gold. He found her heart instead, which was better than gold. He kept it. The year stopped turning.',
      'Repeating this tale is punishable by the loss of the tongue. The old wives of the Marches repeat it anyway. They have been old for a very long time, and are not afraid of much.',
    ),
  },
  {
    id: 'lore_founder', cat: 'crown', title: 'Aldane the Founder',
    text: P(
      '*From the Royal Chronicle.* Aldane, called the Spade, first King of Morrow, came out of the eastern fens with nine hundred spears and a gravedigger\'s patience. He buried the seven hill-kings in a single winter and raised the Hollow Crown on Highmoor.',
      'He reigned sixty years in perfect health and was never seen to sleep. In the sixty-first year of his reign he set the Crown on his son\'s head, walked out of the city alone carrying only a spade, and was not seen again.',
      'The Chronicle records that he ascended to sit at the right hand of Heaven. His tomb in the Cathedral of Ashgrave is magnificent, and empty.',
    ),
  },
  {
    id: 'lore_four_called', cat: 'crown', title: 'Blood, and Kin, and Ward, and Witness',
    text: P(
      'The words the Crown spoke on the night of Ashfall, heard by four people in four different places at the same moment.',
      'Scholars of the Archcanonry insist the phrase is ancient: that it appears in the Founder\'s own law of succession, naming who may claim the throne should the line falter. One of the king\'s blood. One of his kin. One raised beneath his roof. One who heard his last words.',
      'The scholars cannot agree why the Crown should need four. The cynics among them suggest it is the same reason a fisherman uses more than one hook.',
    ),
  },
  {
    id: 'lore_empty_socket', cat: 'crown', title: 'The Empty Socket',
    text: P(
      'When the Crown rolled from the dead king\'s head on Ashfall night, the guards saw that its great stone was gone. The court has talked of little else since.',
      '"Stolen by a foreign spy. Obviously." (Lady Wenna Thorne.) "Pawned to settle the Siege-Debt, replaced with paste, and the paste fell out." (Treasurer Hollis.) "There never was a stone. The socket signifies royal humility." (Archcanon Ulrich.) "It was red. No, green. It changed when you weren\'t looking at it." (A chambermaid.)',
      '"Twenty years ago it went walking by the water, in a blue gown." (Pell, the King\'s fool, who was asked to leave.)',
    ),
  },
  {
    id: 'lore_held_hour', cat: 'crown', title: 'On the Holding of the Hour',
    text: P(
      'The Crown does not grant long life. Let us be precise. It *holds the hour*: it fixes a moment as a pin fixes a moth, and permits nothing within its reach to proceed past it.',
      'The wearer does not age because he is not permitted to become older. Grain does not fail because it is not permitted to finish. Death does not come, because death is a kind of change, and change is not permitted.',
      'Where, then, do the deaths go? The author confesses he does not know, and has asked to be transferred to a less alarming field of study. (Magister Corvin Ash, *De Hora Tenenda*. Suppressed.)',
    ),
  },
  {
    id: 'lore_crown_voice', cat: 'crown', title: 'The Voice of the Crown',
    text: P(
      'It has spoken seven words that anyone is sure of: *Blood, and Kin, and Ward, and Witness.* And one more, which it says far more often.',
      'Those who have heard it describe a voice like a key turning in a lock a long way down. It does not threaten. It does not plead. It waits, as iron waits, as hills wait, for whatever it wants to come to it.',
      'What it wants, so far as anyone can tell, is a head.',
    ),
  },
  {
    id: 'lore_faceless_shrines', cat: 'crown', title: 'The Faceless Shrines',
    text: P(
      'Along the old roads of Morrow stand little stone shrines to a seated woman with no face. The Archcanonry teaches that they were idols of a fen-hag, and that Aldane\'s priests chiselled the faces away.',
      'Look closely. There are no chisel marks. The stone is smooth, as if the faces were never carved at all, or were lifted out whole.',
      'Country folk leave milk and bread, and do not say for whom. Pressed, they say only: "For when she comes back for it."',
    ),
  },

  // ------------------------------------------------------------------ HEIRS (public record)
  {
    id: 'lore_heir_knight', cat: 'heirs', title: 'Aldous Vane, Late of the King\'s Shield',
    text: P(
      '*From the Rolls of the Household Guard.* VANE, Aldous. Born of the body of Margery Vane, laundress; father not recorded (all present knew). Page at eight; knighted at twenty; Captain of the King\'s Shield at thirty-one. Commended four times for valour, and once for refusing a bribe so large the clerk wrote it out in words.',
      'On the night of Ashfall he held the King\'s door with orders to admit no one. He admitted no one.',
      'Stripped of rank, spurs and pension by order of the Regent, for failure of duty. No charge was brought. None was needed.',
    ),
  },
  {
    id: 'lore_heir_witch', cat: 'heirs', title: 'Isolde Marrow, Banished',
    text: P(
      '*Proclamation of the Crown, read at the Market Cross.* Let it be known that ISOLDE MARROW, daughter of the late Princess Elowen and niece to His Majesty, has been found practising the forbidden craft of rot: the deliberate cultivation of decay in flesh, plant and blood.',
      'In consideration of her birth she is spared the fire. She is banished from Ashgrave for life, and any who shelter her or purchase her tinctures shall be fined.',
      'Scrawled beneath, in another hand: *Her tinctures WORK, you idiots. Ask the Chancellor\'s gout.*',
    ),
  },
  {
    id: 'lore_heir_wren', cat: 'heirs', title: 'The King\'s Ward',
    text: P(
      '*FACELESS CHILD FOUND ON PALACE STEPS!* In the small hours a baby was discovered on the North Steps, wrapped in moss and wet linen and smelling strongly of rain.',
      'The infant has NO FACE, only smooth skin where a face should be, yet it cries, feeds and laughs as other children do. His Majesty has taken the foundling as his ward, to the astonishment of the court. Physicians are baffled. Priests are divided.',
      'The child is to be called WREN, for the bird that is small and sings loud. Our artist was not permitted to draw it. (*The Ashgrave Crier*, nineteen years before Ashfall.)',
    ),
  },
  {
    id: 'lore_heir_cantor', cat: 'heirs', title: 'Brother Cael of the Grave Order',
    text: P(
      '*From the Register of the Order of St. Hollin, Keepers of the Last Rites.* CAEL, Brother. Took vows at sixteen. Noted for a fine voice, a poor head for Latin, and an unusual gift for sitting with the dying, of whom, under the Long King, there were very few.',
      'Appointed confessor to His Majesty in the King\'s seventy-eighth year, the previous confessor having asked, after forty years, to hear someone else\'s sins for a change.',
      'Present at the King\'s bedside on the night of Ashfall. *No further entries.*',
    ),
  },

  // ------------------------------------------------------------------ BESTIARY
  {
    id: 'lore_bragg', cat: 'bestiary', title: 'Bragg the Hound-Lord',
    text: P(
      'Captain of the Marcher levy, which is to say the man the King paid to keep the roads open, and who found the roads were more profitable shut. On Ashfall night the levy lost its pay, its king and its sense of shame in the same hour. Bragg kept the hounds.',
      'He is lord now of every cutthroat between the fens and the Wood, and keeps them as he keeps his dogs: fed, scarred and not very bright. It is said he feeds the hounds first. Those who have seen the arrangement say this is the humane order.',
      'His men call him Captain still. He answers to it. He has no other name he likes better.',
    ),
  },
  {
    id: 'lore_hanged_sheriff', cat: 'bestiary', title: 'The Hanged Sheriff',
    text: P(
      'Sheriff Thomas Gallow hanged three hundred men at the Marcher crossroads, every one by the King\'s law, and kept the tally in the lining of his hat. He had a reputation for fairness. It rested on his hanging the rich on the same rope as the poor, when he could catch them.',
      'On Ashfall night, when the King died, the Sheriff\'s heart stopped. Nobody told the Sheriff. He has carried on regardless, with the rope still round his neck, because the law was never repealed.',
      'He hangs someone every dawn. He is not cruel about it. He simply cannot imagine what else a sheriff is for.',
    ),
  },
  {
    id: 'lore_mother_of_rats', cat: 'bestiary', title: 'Mother of Rats',
    text: P(
      'Under Saltmarsh lie the plague-pits, dug in a hurry in the first years of the Blight and never properly filled. For ten years the village has buried its stopped there. For ten years something has been eating them.',
      'It has grown very large. It has had a great many children, and they are all hers: the rats, the carrion-birds, the thin pale things that come up the pit-stairs on quiet nights. She tends them. She is, by every account, a devoted mother.',
      'The people of Saltmarsh leave bread at the pit-lip. They say it is for the dead. It is not for the dead.',
    ),
  },
  {
    id: 'lore_grall', cat: 'bestiary', title: 'Mattias Grall, Witchfinder General',
    text: P(
      'Once a sergeant of the King\'s Shield, who served beside its captain for eleven years and was said to be the better swordsman and the worse man. He left the Shield after a fever that should have killed him did not. He says God spared him for a purpose.',
      'The Regent agreed, and gave him a warrant, a company of grey-cloaked men, and a list.',
      'Grall has burned more witches since Ashfall than in the forty years before it. He prays before each burning, sincerely, for the soul of the accused and for his own.',
    ),
  },
  {
    id: 'lore_antlered_king', cat: 'bestiary', title: 'The Antlered King',
    text: P(
      'Lord of the Weeping Wood and first servant of the Lady Under the Hill. He has worn a fair face for four hundred years: a young man\'s, grave and handsome, beneath a crown of living antlers.',
      'It was never his face. The woodcutters\' tales are certain of this, and cannot say whose it was. They say that when the face slips, there is only a long dark patience beneath it, very like the patience of a root.',
      'He has never knelt to a king of Morrow. It is said there is one thing he would kneel to, and that he has waited four hundred years to see it walk into his wood.',
    ),
  },
  {
    id: 'lore_drowned_abbess', cat: 'bestiary', title: 'The Drowned Abbess',
    text: P(
      'Twenty years ago a woman came to the abbey in a blue gown, veiled to the chin. She asked the sisters to hide something for her. They agreed. She lifted the veil to thank them, and the sisters have not spoken of what they saw.',
      'Then she walked into the mere. What came back out, some years later, was not her, though it wears the gown. It walks the flooded nave carrying an empty cradle. It sings the lullabies of the Marches slightly wrong, in the voice of a woman who learned them late.',
      'Those who hear it feel, briefly and terribly, that they were stolen from somewhere, and ought to go home.',
    ),
  },
  {
    id: 'lore_crane', cat: 'bestiary', title: 'Lord Severin Crane, the Regent',
    text: P(
      'Chancellor of Morrow for thirty years, Regent since the morning after Ashfall. A thin, courteous man who has never been seen to raise his voice or lose a wager.',
      'It was Crane who sealed the gates of Ashgrave, Crane who broke the King\'s Shield, Crane who signed the Witchfinder\'s warrant. He governs with exquisite competence.',
      'Those who meet him come away with the uneasy sense that he knew what they would say before they said it, as if he had heard the conversation already. Perhaps more than once.',
    ),
  },
  {
    id: 'lore_choir', cat: 'bestiary', title: 'The Choir Immaculate',
    text: P(
      'Forty court singers, the finest in Morrow. They sang at the Long King\'s coronation and at his fiftieth jubilee and at his ninetieth, and never aged, and never missed a note.',
      'On Ashfall night they were singing the Hymn of the Held Hour in the palace chapel, and they did not stop. Their throats are long raw and their eyes long white. They have grown together, in some way the chapel wardens will not describe, into a single throat.',
      'The Regent finds the singing restful.',
    ),
  },
  {
    id: 'lore_crowned_rival', cat: 'bestiary', title: 'The Crowned Rival',
    text: P(
      'There are four heirs, and one Crown. On some mornings (not this one, the Crown assures you; not yet) one of the others reached the throne first, and took it, and wore it.',
      'And the Crown, which wastes nothing, kept that morning too, and set its king to guard the door. *Aldous, the Iron King*, who obeyed one order too many. *Isolde, the Blight Queen*, whose kingdom has not rotted since, and has not grown. *Wren, the Thousand-Faced*, who has every face but one. *Cael, the Requiem King*, a dead man crowned, who keeps the kingdom\'s dead the way a miser keeps coin.',
      'They will tell you it stops hurting after the first hundred years. They will be lying, and they will not know it.',
    ),
  },
  {
    id: 'lore_unspent', cat: 'bestiary', title: 'The Unspent',
    text: P(
      'Every death the Crown forbade did not vanish. It waited. The old, the sick, the hanged, the drowned, the soldiers who should have fallen and the children who should have been stillborn: all of it pressed down into the dark beneath the throne like seed into a jar. A century of it, at the least. Some say four.',
      'They are not ghosts. Ghosts have finished. The Unspent are still, all of them, in the act of dying, and have been for as long as anyone can say.',
      'They are so tired. They would very much like to be done.',
    ),
  },
  {
    id: 'lore_hollow_king', cat: 'bestiary', title: 'The Hollow King',
    text: P(
      'The Long King died on Ashfall night. The Crown did not let that stop him.',
      'What sits the throne beneath the throne wears Aldric\'s body as a man wears an old coat: out of habit, for the warmth. It speaks with his voice when it remembers to.',
      'When it forgets, it speaks with its own, which is the sound of a key turning in a lock a long way down.',
    ),
  },

  // ------------------------------------------------------------------ LETTERS & DOCUMENTS
  {
    id: 'lore_letter_regent_order', cat: 'letters', title: 'The Regent\'s First Order',
    text: P(
      '*By the Regent, in the name of the Crown, which is vacant but not empty.*',
      'One. The gates of Ashgrave are closed until a lawful heir is crowned. Two. The death of His Majesty is not to be proclaimed beyond the walls. Three. Persons claiming to have heard the Crown speak are to be detained courteously, fed well, and brought to me. Four. Any person found in possession of the Crown\'s missing stone is to be brought to me alive. *Alive, Captain.* Five. This order is to be carried to every garrison in the Marches by the fastest rider available.',
      '*S. Crane, Regent. Sealed with the King\'s signet, which I have borrowed.*',
    ),
  },
  {
    id: 'lore_letter_courier', cat: 'letters', title: 'A Letter Never Sent',
    text: P(
      '*Mam. I\'m to ride for the Marches tonight with the Regent\'s seal, fastest horse in the stable, so I\'ll pass by home on the way and wave. Don\'t come out, the ash is bad. Something\'s happened up at the palace and nobody will say. The bells stopped at the third hour and haven\'t started.*',
      '*Tell Kit he can have my bow if I\'m not back by harvest. I will be back by harvest. Kiss the dog. Your Tam.*',
      'Found in a courier\'s satchel. The ink is still wet. It is always still wet.',
    ),
  },
  {
    id: 'lore_letter_hanging_writ', cat: 'letters', title: 'Writ of Hanging, Sorrow Cross',
    text: P(
      '*By Thos. Gallow, Sheriff of the Marches.* Let the following be hanged by the neck at Sorrow Cross for the taking of the King\'s deer: Wat Fletch, Jeb Fletch, Jeb Fletch the younger, Ansel Coombe, Piers the Tinker, and the boy Dickon Fletch, aged seventy-three.',
      'Sentence to be carried out at dawn, and repeated as necessary.',
      'The Sheriff has underlined *as necessary* three times. The third line has torn the paper.',
    ),
  },
  {
    id: 'lore_letter_wanted', cat: 'letters', title: 'Wanted: Gallowmere Notice Board',
    text: P(
      '*WANTED, by order of the Sheriff of the Marches, for crimes against the King\'s Peace: a person answering to the description of the bearer of this notice.*',
      '*Charged with: trespass; affray; unlicensed possession of a destiny; dying in a public road without licence (multiple counts); returning from the same (multiple counts); conspiracy to sit upon the throne of Morrow. And, in a smaller hand, as though the Sheriff hesitated: being expected.*',
      '*REWARD: 60 crowns. Bring the head. Bring it quickly. It does not stay.*',
    ),
  },
  {
    id: 'lore_letter_clockmaker', cat: 'letters', title: 'Notice in a Clockmaker\'s Window',
    text: P(
      '*CLOSED FOR REPAIRS.* Every clock in this shop shows a quarter past the third hour. This is not a fault. I have taken every clock in the shop apart and put it back together, and they all agree, and I have decided to agree with them.',
      'Customers wishing to know the time are advised that it is a quarter past the third hour. It has been for some while. It will be tomorrow.',
      '*E. Penhallow, Clockmaker, Pennick.*',
    ),
  },
  {
    id: 'lore_letter_tally', cat: 'letters', title: 'The Tallyman\'s Stick',
    text: P(
      'A length of blackthorn, notched along every face. The notches are grouped in fives, and the fives in hundreds, and they run round the stick in a spiral so tight that the last ones are no wider than a hair.',
      'Some of the notches carry a tiny scratched sign: a hound, a rope, a rat, a crown. The oldest end of the stick has worn as smooth as bone from handling.',
      'Near the newest end, freshly cut, is a run of notches marked with a sign you recognise. It is yours.',
    ),
  },
  {
    id: 'lore_letter_confession', cat: 'letters', title: 'Overheard at a Confessional',
    text: P(
      '*Forgive me, Father. I\'m a physician. Fifty years I\'ve cured no one and lost no one. I bled them, I purged them, I took their coin, and they neither mended nor died, and I grew rich on a sickness that could not finish.*',
      '*And now they\'ve started dying again. Twelve this week. I don\'t know what to do for them. I\'ve forgotten.*',
      '*God help me, I never knew.*',
    ),
  },
  {
    id: 'lore_letter_peddler', cat: 'letters', title: 'The Peddler\'s Price List',
    text: P(
      'Neatly lettered on the inside of a cart\'s lid: *Card, common: fair. Card, rare: dear. Relic: dearer. Removal of an unwanted thing from your deck, your life or your memory: inquire within.*',
      '*Prices fixed in perpetuity. Prices have always been fixed in perpetuity. NO CREDIT. NO REFUNDS. NO RETURNS (except yours).*',
      'Below, in faded chalk, someone has drawn a small smiling face with a crack running across one cheek.',
    ),
  },
  {
    id: 'lore_letter_hob_ledger', cat: 'letters', title: 'The Gravekeeper\'s Ledger',
    text: P(
      'In a gravekeeper\'s hand, very neat: *Vane, A. Knight. Face down in the fen. Good boots. / Vane, A. Knight. The bridge. / Marrow, I. Witch. Bit me again. / Vane, A. Knight. The hounds. I told him about the hounds. / Wren, no surname. Asked to be buried facing the stone. Did so.*',
      'The entries go on, page after page, in the same patient hand, each with its little note.',
      'The ledger runs to many volumes. The earliest are written in a script no one in Morrow has used for four hundred years.',
    ),
  },
  {
    id: 'lore_letter_elowen', cat: 'letters', title: 'Court Circular: Princess Elowen',
    text: P(
      'It is with great sorrow that His Majesty announces the death of his beloved niece, the Princess Elowen, of the Blight, at Marrow House. By her own wish she will be interred privately.',
      'The Princess was a noted herbalist and a devoted mother. Her daughter Isolde, aged twelve, is placed in the care of the Crown. Mourning will be observed for one day.',
      'No body was shown. No grave was dug. Those who asked were told the Blight made it inadvisable.',
    ),
  },
  {
    id: 'lore_letter_maren', cat: 'letters', title: 'Court Circular: Queen Maren',
    text: P(
      'The Queen is dead. Her Majesty Maren, second wife of the King, was lost on the night of the Midsummer Vigil while walking by the Abbey mere. Her body has not been recovered.',
      'Divers report that the water is deeper than it was. His Majesty has ordered the mere dragged.',
      'It was dragged for a month. The nets came up full of moss and wet linen, and once, the divers swore, a lullaby.',
    ),
  },
  {
    id: 'lore_letter_pell', cat: 'letters', title: 'Household Accounts: The Fool',
    text: P(
      '*Ashgrave Palace, Household Accounts.* To PELL, Fool: one suit of motley (to replace the last, which no one remembers issuing); one set of bells; one porcelain smile (to replace the last, cracked). Wages: one penny per annum, as agreed. Date of appointment: not recorded.',
      'The Steward notes that a fool named Pell appears in the accounts of every king of Morrow, at the same wage, wearing the same smile.',
      'The Steward has asked not to be assigned the accounts again.',
    ),
  },
  {
    id: 'lore_letter_aldane', cat: 'letters', title: 'What the Gravekeeper Said',
    text: P(
      '"My name was Aldane. My father dug graves in the eastern fens, and I learned the trade before I learned the sword. Then I learned the sword, and found it was the same trade, faster.',
      '"There was a hill, and under the hill a lady sleeping, and I dug her up because I thought she was gold. She was better. I cut out her heart and set it in iron, and it held the hour for me. It held me. It holds me yet.',
      '"I took it off after sixty years and gave it to my boy, and walked away with my spade. It never let me go. So I dig. Every heir of every morning. It seemed the least I could do: to see you all put to bed properly."',
    ),
  },
]);
