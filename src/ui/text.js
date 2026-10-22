// Text formatting: card text with live numbers, glossary terms, event prose.
import { CARDS, STATUSES } from '../engine/registry.js';
import { MASKS, SPIRITS } from '../engine/combat.js';
import { esc, safe } from './core.js';

export const GLOSSARY = {
  Block: 'Prevents damage. Removed at the start of your next turn.',
  Might: 'Attacks deal 1 more damage per stack.',
  Guard: 'Gain 1 more Block from cards per stack.',
  Exposed: 'Takes 50% more damage from attacks. Decreases each round.',
  Weakened: 'Deals 25% less attack damage. Decreases each round.',
  Frail: 'Gains 25% less Block from cards. Decreases each round.',
  Rot: 'At the start of its turn, loses HP equal to its Rot, then Rot decreases by 1.',
  Ward: 'Negates the next debuff applied.',
  Thorns: 'When attacked, deals that much damage back to the attacker.',
  Plating: 'At the end of its turn, gains that much Block.',
  Mending: 'At the end of its turn, heals that much HP, then Mending decreases by 1.',
  Rite: 'At the end of its turn, gains that much Might.',
  Bulwark: 'Block is not removed at the start of your turn.',
  Soul: 'Your Spirits’ passive and Release effects are stronger.',
  Vigor: 'Your next Attack deals that much more damage.',
  Wither: 'Permanently remove Might from an enemy.',
  Oath: 'A sworn goal tracked beside you. Fulfil it this combat to claim its reward.',
  Brew: 'Add random Draughts to your hand.',
  Draught: 'A 0-cost brew card that Exhausts when played.',
  Shift: 'Changing your Mask. Many cards trigger whenever you Shift.',
  'Wolf Mask': MASKS.wolf.desc,
  'Moth Mask': MASKS.moth.desc,
  'Owl Mask': MASKS.owl.desc,
  Channel: 'Place a Spirit in a slot. If every slot is full, the oldest Spirit is Released first.',
  Release: 'Remove your oldest Spirit and trigger its Release effect.',
  Spirit: 'Channeled helpers that act at the end of each turn and can be Released.',
  Wisp: safe(() => SPIRITS.wisp.desc(0), ''),
  Warden: safe(() => SPIRITS.warden.desc(0), ''),
  Lantern: safe(() => SPIRITS.lantern.desc(0), ''),
  Banshee: safe(() => SPIRITS.banshee.desc(0), ''),
  Bleed: 'Lose HP. Ignores Block.',
  Knife: 'A 0-cost Attack card that Exhausts.',
  Exhaust: 'Removed from play until the end of combat.',
  Retain: 'Not discarded at the end of your turn.',
  Ethereal: 'If this is still in your hand at the end of your turn, it is Exhausted.',
  Innate: 'Always drawn in your opening hand.',
  Unplayable: 'This card cannot be played.',
  Daze: 'An Unplayable, Ethereal status card that clogs your hand.',
  Wound: 'An Unplayable status card.',
};

// Surface forms → glossary term.
const ALIASES = {
  Knives: 'Knife', Draughts: 'Draught', Brews: 'Brew', Brewed: 'Brew', Shifts: 'Shift', Shifted: 'Shift', Shifting: 'Shift',
  Channels: 'Channel', Channeled: 'Channel', Channelled: 'Channel', Released: 'Release', Releases: 'Release',
  Exhausted: 'Exhaust', Exhausts: 'Exhaust', Retained: 'Retain', Retains: 'Retain', Oaths: 'Oath', Spirits: 'Spirit',
  Wisps: 'Wisp', Wardens: 'Warden', Lanterns: 'Lantern', Banshees: 'Banshee', Withers: 'Wither', Withered: 'Wither',
  Bleeds: 'Bleed', Weak: 'Weakened', Wolf: 'Wolf Mask', Moth: 'Moth Mask', Owl: 'Owl Mask',
  'Wolf Masks': 'Wolf Mask',
};

const FORMS = [...Object.keys(GLOSSARY), ...Object.keys(ALIASES)].sort((a, b) => b.length - a.length);
const TERM_RE = new RegExp('(?<![\\w-])(' + FORMS.map((f) => f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?![\\w-])', 'g');

export const termOf = (form) => (GLOSSARY[form] != null ? form : ALIASES[form] || null);

// Bold glossary terms in already-escaped HTML text (avoids touching tags).
export function boldTerms(html, found) {
  return html.split(/(<[^>]+>)/).map((part) => {
    if (part.startsWith('<')) return part;
    return part.replace(TERM_RE, (m) => {
      const t = termOf(m);
      if (found && t) found.add(t);
      return `<b class="kw">${m}</b>`;
    });
  }).join('');
}

const KW_LABEL = { innate: 'Innate', retain: 'Retain', ethereal: 'Ethereal', exhaust: 'Exhaust', unplayable: 'Unplayable' };

// Returns { html, terms:Set } for a card's rules text.
// opts: { live: bool (combat numbers), target: enemy | null, upgraded: bool (force show upgraded) }
export function cardText(g, card, opts = {}) {
  const def = CARDS[card.id];
  const terms = new Set();
  if (!def) return { html: '<i>Unknown card.</i>', terms };
  let t = card.up && def.upText ? def.upText : def.text;
  if (typeof t === 'function') t = safe(() => t(g, card), '');
  t = String(t ?? '');
  let v = {};
  try { v = g.cardVals(card); } catch (e) { v = { ...(def.v || {}) }; }
  const inCombat = opts.live && g.cb && g.run && g.run.combat;
  let html = esc(t).replace(/\{(\w+)\}/g, (m, k) => {
    if (!(k in v)) return k === 'x' ? 'X' : '?';
    const base = v[k];
    let val = base;
    if (inCombat && typeof base === 'number') {
      if (k === 'dmg' || k === 'dmg2') val = safe(() => g.calcAttack(g.player, opts.target || null, base, { card }), base);
      else if (k === 'blk' || k === 'blk2') val = safe(() => g.calcBlock(base), base);
    }
    const cls = val > base ? 'num up' : val < base ? 'num down' : 'num';
    const changed = opts.upgradedFrom && opts.upgradedFrom[k] != null && opts.upgradedFrom[k] !== base ? ' upg' : '';
    return `<span class="${cls}${changed}">${val}</span>`;
  });
  html = html.replace(/\n/g, '<br>');
  html = boldTerms(html, terms);
  const kws = safe(() => g.keywordsOf(card), (def.kw || []));
  if (kws.length) {
    html += `<span class="kwline">${kws.map((k) => `<b class="kw">${KW_LABEL[k] || k}.</b>`).join(' ')}</span>`;
    for (const k of kws) if (KW_LABEL[k]) terms.add(KW_LABEL[k]);
  }
  return { html, terms };
}

// Glossary entries for a set of terms (for keyword tooltip boxes).
export function glossaryFor(terms) {
  return [...terms].filter((t) => GLOSSARY[t]).map((t) => ({ term: t, text: GLOSSARY[t] }));
}

// Typographic quotes/apostrophes (applied to raw text before escaping).
export function smart(s) {
  return String(s ?? '')
    .replace(/(^|[\s(\[\u2014\u2013*_-])"/g, '$1\u201C').replace(/"/g, '\u201D')
    .replace(/(^|[\s(\[\u2014\u2013*_-])'/g, '$1\u2018').replace(/'/g, '\u2019');
}

// "Quote text"  Attribution  ->  { quote, attr }. Outer quotes are stripped so the UI draws them once.
export function splitQuote(text) {
  const t = String(text ?? '').trim();
  const m = /^[\u201C"\u201E](.+)[\u201D"]\s*([\s\S]*)$/s.exec(t);
  if (!m) return { quote: t.replace(/^[\u201C"]|[\u201D"]$/g, ''), attr: '' };
  return { quote: m[1].trim(), attr: m[2].replace(/^[\u2014\u2013-]+\s*/, '').trim() };
}

// Event / lore prose: paragraphs on blank lines, *italics*, **bold**, "quotes" kept.
export function prose(text) {
  const s = smart(String(text ?? '').trim());
  if (!s) return '';
  return s.split(/\n\s*\n/).map((p) => {
    let x = esc(p.trim()).replace(/\n/g, '<br>');
    x = x.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>').replace(/_(.+?)_/g, '<i>$1</i>');
    return `<p>${x}</p>`;
  }).join('');
}

// Inline-format a single line (choice labels, relic descriptions).
export function inline(text, terms) {
  let x = esc(smart(String(text ?? ''))).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>');
  if (terms) x = boldTerms(x);
  return x;
}

// Choice label "[Verb] outcome" → {verb, rest}
export function splitChoice(label) {
  const m = /^\s*\[([^\]]+)\]\s*(.*)$/s.exec(String(label ?? ''));
  return m ? { verb: smart(m[1]), rest: m[2] } : { verb: '', rest: String(label ?? '') };
}

export function statusName(id) { return (STATUSES[id] && STATUSES[id].name) || id; }

export function statusDesc(g, id, n, owner) {
  const d = STATUSES[id];
  if (!d) return '';
  if (typeof d.desc === 'function') return safe(() => d.desc(n, g, owner), '');
  return d.desc || '';
}

// ---------------------------------------------------------------------------------------------
// Simple view: a card's effect as a few big chips (⚔ 6, 🛡 5, status icon + number, keywords).
// Parsed from the card's rules template so numbers stay live (Might, Weakened, Frail...).
// Returns [{ k:'dmg'|'blk'|'sts'|'draw'|'heal'|'hp'|'energy'|'spirit'|'misc'|'kw', n, icon, glyph, label, tag, cls }].
const STATUS_BY_NAME = {};
function statusByName(name) {
  const key = name.toLowerCase();
  if (STATUS_BY_NAME[key] !== undefined) return STATUS_BY_NAME[key];
  let hit = null;
  for (const id in STATUSES) if (STATUSES[id].name && STATUSES[id].name.toLowerCase() === key) { hit = STATUSES[id]; break; }
  if (!hit && key === 'weak') hit = STATUSES.weak;
  return (STATUS_BY_NAME[key] = hit || null);
}
const KW_CHIP = { exhaust: ['✕', 'Exhaust'], retain: ['↻', 'Retain'], ethereal: ['≈', 'Ethereal'], innate: '★Innate'.split(/(?=I)/), unplayable: ['⊘', 'Unplayable'] };

export function cardChips(g, card, opts = {}) {
  const def = CARDS[card.id];
  if (!def) return [];
  let t = card.up && def.upText ? def.upText : def.text;
  if (typeof t === 'function') t = safe(() => t(g, card), '');
  t = String(t ?? '');
  let v = {};
  try { v = g.cardVals(card); } catch (e) { v = { ...(def.v || {}) }; }
  const inCombat = opts.live && g.cb && g.run && g.run.combat;
  // Resolve a number token: "{dmg}" or "6".
  const num = (tok, kind) => {
    if (tok == null) return null;
    let key = null, val;
    const m = /^\{(\w+)\}$/.exec(tok);
    if (m) { key = m[1]; if (!(key in v)) return null; val = v[key]; } else val = +tok;
    const base = val;
    if (inCombat && typeof val === 'number') {
      if (kind === 'dmg') val = safe(() => g.calcAttack(g.player, opts.target || null, base, { card }), base);
      else if (kind === 'blk') val = safe(() => g.calcBlock(base), base);
    }
    return { val, cls: typeof val === 'number' ? (val > base ? 'up' : val < base ? 'down' : '') : '' };
  };
  const chips = [];
  const N = '(\\{\\w+\\}|\\d+)';
  const text = t.replace(/\n/g, ' ');
  const sentences = text.split(/(?<=[.!?])\s+/);
  for (const raw of sentences) {
    const s = raw.trim();
    if (!s) continue;
    let m;
    if ((m = new RegExp(`Deal ${N} damage(?: to ALL enemies)?(?: (twice)| ${N} times)?`, 'i').exec(s))) {
      const r = num(m[1], 'dmg');
      if (r) chips.push({ k: 'dmg', n: r.val, cls: r.cls, tag: /ALL enemies/i.test(s) ? 'ALL' : /random enem/i.test(s) ? 'RND' : '', times: m[2] ? 2 : m[3] ? (num(m[3]) || {}).val : 1 });
      continue;
    }
    if ((m = new RegExp(`Gain ${N} Block`, 'i').exec(s))) {
      const r = num(m[1], 'blk');
      if (r) chips.push({ k: 'blk', n: r.val, cls: r.cls });
      continue;
    }
    if ((m = new RegExp(`Draw ${N} cards?`, 'i').exec(s))) { const r = num(m[1]); if (r) { chips.push({ k: 'draw', n: r.val }); continue; } }
    if ((m = new RegExp(`Heal ${N}`, 'i').exec(s))) { const r = num(m[1]); if (r) { chips.push({ k: 'heal', n: r.val }); continue; } }
    if ((m = new RegExp(`Gain ${N} Energy`, 'i').exec(s))) { const r = num(m[1]); if (r) { chips.push({ k: 'energy', n: r.val }); continue; } }
    if ((m = new RegExp(`Lose ${N} HP`, 'i').exec(s))) { const r = num(m[1]); if (r) chips.push({ k: 'hp', n: r.val }); }
    // Status applications / gains: "Apply 3 Rot (to ALL enemies)", "Gain 2 Might", "Wither 2".
    const re = new RegExp(`(?:Apply|Give|Gain|Wither|Gain a|Gain an)\\s+${N}?\\s*([A-Z][a-z]+(?: [A-Z][a-z]+)?)`, 'g');
    let any = false;
    while ((m = re.exec(s))) {
      const word = m[2];
      if (/^(Block|Energy|HP|Soul|Gold)$/.test(word) && word !== 'Soul') continue;
      const d = statusByName(word) || (word === 'Wither' ? STATUSES.might : null);
      if (!d) continue;
      const r = m[1] ? num(m[1]) : { val: 1, cls: '' };
      if (!r) continue;
      const neg = d.kind === 'debuff' || /Wither/.test(m[0]) || (/Apply|Give/.test(m[0]) && /enem/i.test(s));
      chips.push({ k: 'sts', n: /Wither/.test(m[0]) ? -r.val : r.val, icon: 'st_' + (d.icon || d.id), label: d.name, neg, tag: /ALL enemies/i.test(s) ? 'ALL' : '' });
      any = true;
    }
    if (any) continue;
    if ((m = /Channel (?:an? |(\d+|\{\w+\}) )?(Wisp|Warden|Lantern|Banshee)/i.exec(s))) { const r = m[1] ? num(m[1]) : { val: 1 }; chips.push({ k: 'spirit', n: r ? r.val : 1, icon: 'sp_' + m[2].toLowerCase(), label: m[2] }); continue; }
    if (/Deal damage equal to/i.test(s)) { chips.push({ k: 'dmg', n: 'X', cls: '', tag: /ALL enemies/i.test(s) ? 'ALL' : '', times: 1 }); continue; }
    if (/Double your Block/i.test(s)) { chips.push({ k: 'blk', n: '\u00D72', cls: '' }); continue; }
    if (/Double your Might/i.test(s) && STATUSES.might) { chips.push({ k: 'sts', n: '\u00D72', icon: 'st_' + STATUSES.might.icon, label: 'Might' }); continue; }
    if (/Release/i.test(s)) { chips.push({ k: 'misc', glyph: '✨', label: 'Release' }); continue; }
    if (/Brew/i.test(s)) { chips.push({ k: 'misc', glyph: '⚗', label: 'Brew' }); continue; }
    if (/Shift|Mask/i.test(s)) { chips.push({ k: 'misc', glyph: '☺', label: 'Mask' }); continue; }
    if (/Oath/i.test(s)) { chips.push({ k: 'misc', glyph: '✦', label: 'Oath' }); continue; }
    if (/Knife|Knives/i.test(s)) { chips.push({ k: 'misc', glyph: '†', label: 'Knife' }); continue; }
    if (/Discard/i.test(s)) { chips.push({ k: 'misc', glyph: '⇩', label: 'Discard' }); continue; }
  }
  // Keywords
  const kws = safe(() => g.keywordsOf(card), def.kw || []);
  for (const k of kws) if (KW_CHIP[k]) chips.push({ k: 'kw', glyph: KW_CHIP[k][0], label: KW_CHIP[k][1] });
  // Nothing recognised: show a short snippet so the card is never blank.
  if (!chips.some((c) => c.k !== 'kw')) {
    const first = text.split(/(?<=[.!?])\s+/)[0].replace(/\{(\w+)\}/g, (mm, key) => (key in v ? v[key] : '?')).replace(/\s+/g, ' ').trim();
    chips.unshift({ k: 'text', label: first.length > 38 ? first.slice(0, 36).trim() + '…' : first });
  }
  return chips.slice(0, 5);
}
