// Central content registries. Data files call the define* helpers at import time.

export const CARDS = {};
export const RELICS = {};
export const POTIONS = {};
export const STATUSES = {};
export const ENEMIES = {};
export const ENCOUNTERS = {};
export const EVENTS = {};
export const HEROES = {};
export const HUB_LINES = [];
export const LORE = {};

function put(reg, list, kind) {
  for (const def of list) {
    if (!def.id) throw new Error(`${kind} without id: ${JSON.stringify(def).slice(0, 80)}`);
    if (reg[def.id]) throw new Error(`duplicate ${kind} id: ${def.id}`);
    reg[def.id] = def;
  }
}

export const defineCards = (list) => put(CARDS, list, 'card');
export const defineRelics = (list) => put(RELICS, list, 'relic');
export const definePotions = (list) => put(POTIONS, list, 'potion');
export const defineStatuses = (list) => put(STATUSES, list, 'status');
export const defineEnemies = (list) => put(ENEMIES, list, 'enemy');
export const defineEncounters = (list) => put(ENCOUNTERS, list, 'encounter');
export const defineEvents = (list) => put(EVENTS, list, 'event');
export const defineHeroes = (list) => put(HEROES, list, 'hero');
export const defineLore = (list) => put(LORE, list, 'lore');
export const defineHubLines = (list) => {
  for (const l of list) HUB_LINES.push(l);
};

// Free-form story text: act intros, endings, death lines, shop greetings...
// Keys documented in CONTENT_API.md. Later definitions extend earlier ones.
export const TEXTS = {};
export const defineTexts = (obj) => {
  for (const k in obj) {
    if (Array.isArray(TEXTS[k]) && Array.isArray(obj[k])) TEXTS[k] = TEXTS[k].concat(obj[k]);
    else if (TEXTS[k] && typeof TEXTS[k] === 'object' && typeof obj[k] === 'object' && !Array.isArray(obj[k])) Object.assign(TEXTS[k], obj[k]);
    else TEXTS[k] = obj[k];
  }
};
