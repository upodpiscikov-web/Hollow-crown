// The Hollow Crown — game client bootstrap: creates the Game, wires the UI
// adapter (wait/choose), routes emits to FX/toasts, and drives screen rendering.
import './data/index.js';
import './gfx/sprites/index.js';
import { Game } from './engine/game.js';
import { RELICS, POTIONS, CARDS, LORE } from './engine/registry.js';
import { UI, h, clear, anim } from './ui/core.js';
import { initScale, onResize } from './ui/scale.js';
import { initParticles, screenFlash } from './ui/fx.js';
import { toast, chooseCards, closeTopModal, hideTip } from './ui/overlay.js';
import { relicIcon, potionIcon, icon } from './ui/gfx.js';
import { combatScreen } from './ui/combat.js';
import { mapScreen } from './ui/map.js';
import { roomScreens } from './ui/rooms.js';
import { metaScreens } from './ui/meta.js';
import { TB, updateTopbarStats } from './ui/topbar.js';
import { openSettings } from './ui/settings.js';
import { openMapPeek } from './ui/map.js';
import { initDev } from './ui/dev.js';
import { sfx, music, unlockAudio, setVolume, suspend, resume } from './ui/sound.js';

const g = new Game();
UI.g = g;
UI.dev = /[?&]dev=1/.test(location.search);
UI.reduced = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
if (UI.reduced) document.body.classList.add('reduced');
if (window.matchMedia) {
  try { matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => { UI.reduced = e.matches; document.body.classList.toggle('reduced', e.matches); }); } catch (e) { /* old Safari */ }
}

g.ui = {
  wait(ms) {
    const fast = g.meta && g.meta.settings && g.meta.settings.fast;
    return new Promise((r) => setTimeout(r, Math.max(0, (ms || 0) * (fast ? 0.5 : 1))));
  },
  choose(opts) { hideTip(); return chooseCards(g, opts); },
};

// Recover a run that was saved mid-action.
if (g.run && g.run.combat) {
  g.run.combat.busy = false;
  if (g.run.combat.phase === 'over' && !g.run.combat.finished) setTimeout(() => g.afterAction(), 0);
}

TB.openSettings = () => openSettings(g);
TB.openMapPeek = () => openMapPeek(g);

// ------------------------------------------------------------------ screens & routing
const SCREENS = { combat: combatScreen, map: mapScreen, ...roomScreens, ...metaScreens };
let mounted = null; // { name, scr, host }
let rq = 0, holdTimer = 0;

function currentName() {
  if (g.run && UI.inRun) return g.run.screen || 'map';
  return UI.view || 'title';
}

export function requestRender() {
  if (rq) return;
  rq = requestAnimationFrame(() => { rq = 0; render(); });
}
UI.render = requestRender;
UI.renderNow = () => render();

function render() {
  const now = performance.now();
  if (now < UI.hold) {
    clearTimeout(holdTimer);
    holdTimer = setTimeout(requestRender, UI.hold - now + 10);
    return;
  }
  const name = currentName();
  const scr = SCREENS[name] || SCREENS.missing;
  const root = document.getElementById('screen');
  try {
    if (!mounted || mounted.name !== name || mounted.scr !== scr) {
      const old = mounted;
      if (old) {
        try { old.scr.unmount && old.scr.unmount(); } catch (e) { console.warn(e); }
        old.host.classList.add('leaving');
        old.host.style.pointerEvents = 'none';
        anim(old.host, [{ opacity: 1 }, { opacity: 0 }], 200).then(() => old.host.remove());
      }
      const host = h('div.screen-host');
      root.appendChild(host);
      mounted = { name, scr, host };
      hideTip();
      scr.mount(host, g);
      if (old) anim(host, [{ opacity: 0 }, { opacity: 1 }], 260);
    } else if (scr.update) scr.update(g);
  } catch (e) {
    console.error('render failed', name, e);
    showCrash(name, e);
  }
}

function showCrash(name, e) {
  const root = document.getElementById('screen');
  clear(root);
  mounted = null;
  root.appendChild(h('div.screen.crash',
    h('div.crash-box',
      h('h2', 'The hour slips…'),
      h('p', `Something went wrong drawing the "${name}" screen.`),
      h('pre', String(e && (e.message || e))),
      h('div.row',
        g.run && UI.inRun ? h('button.btn', { onTap: () => { if (g.run) { g.run.screen = 'map'; g.run.combat = null; } requestRender(); } }, 'Return to the map') : null,
        h('button.btn', { onTap: () => { UI.inRun = false; UI.view = 'title'; requestRender(); } }, 'Return to title')))));
}

SCREENS.missing = {
  mount(root, gg) {
    root.appendChild(h('div.screen.crash', h('div.crash-box', h('h2', 'Lost in the fog'), h('p', `Unknown screen: ${currentName()}`),
      h('button.btn', { onTap: () => { if (gg.run && UI.inRun) gg.run.screen = 'map'; else UI.view = 'title'; requestRender(); } }, 'Continue'))));
  },
};

export function go(view, arg) { UI.view = view; UI.viewArg = arg; requestRender(); }
UI.go = go;

// ------------------------------------------------------------------ emits
g.onEmit = (type, d) => {
  try {
    if (mounted && mounted.name === 'combat' && combatScreen.root) combatScreen.onEmit(type, d);
    else if (mounted && mounted.scr.onEmit) mounted.scr.onEmit(type, d);
    switch (type) {
      case 'refresh': requestRender(); break;
      case 'gold':
        if (d.n > 0) { toast(`+${d.n} Gold`, 'gold', icon('ui_gold', 1.25, '', '●')); sfx('gold'); }
        else if (d.n < 0) toast(`${d.n} Gold`, 'warn');
        updateTopbarStats(g);
        break;
      case 'relicObtained': { const r = RELICS[d.id]; toast(`Obtained <b>${r ? r.name : d.id}</b>`, 'relic', relicIcon(r, 1.25)); sfx('relic'); break; }
      case 'potionObtained': { const p = POTIONS[d.id]; toast(`Obtained <b>${p ? p.name : d.id}</b>`, 'potion', potionIcon(p, 1.25)); sfx('potion'); break; }
      case 'cardObtained': { const c = d.card && CARDS[d.card.id]; toast(`<b>${c ? c.name + (d.card.up ? '+' : '') : 'A card'}</b> added to your deck`, 'card'); break; }
      case 'lore': { const l = LORE[d.id]; toast(`New lore in the Chronicle: <b>${l ? l.title : 'a fragment'}</b>`, 'lore long'); sfx('page'); break; }
      case 'toast': if (d.text) toast(String(d.text), 'long'); break;
      case 'hurt': if (!g.cb) { toast(`-${d.n} HP`, 'warn'); screenFlash('#8a1c1c', 350); sfx('hurt'); updateTopbarStats(g); } break;
      case 'heal': if (!g.cb) { toast(`+${d.n} HP`, 'heal'); sfx('heal'); updateTopbarStats(g); } break;
      case 'maxhp': if (!g.cb) toast(`${d.n > 0 ? '+' : ''}${d.n} Max HP`, d.n > 0 ? 'heal' : 'warn'); updateTopbarStats(g); break;
      case 'enterNode': sfx('mapStep'); break;
      case 'runOver': UI.hubShown = false; break;
      default: break;
    }
  } catch (e) { console.warn('emit handler', type, e); }
};

// ------------------------------------------------------------------ platform glue
function applySettings() {
  const s = g.meta.settings;
  setVolume('music', s.music);
  setVolume('sfx', s.sfx);
}
UI.applySettings = applySettings;

document.addEventListener('pointerdown', () => unlockAudio(), { capture: true });
document.addEventListener('touchstart', () => {}, { passive: true }); // enables :active on iOS
document.addEventListener('visibilitychange', () => { if (document.hidden) { suspend(); g.save(); } else resume(); });
window.addEventListener('pagehide', () => { try { g.save(); } catch (e) { /* ignore */ } });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { hideTip(); closeTopModal(); } });
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });

initScale();
initParticles();
applySettings();
onResize(() => { if (mounted && mounted.scr.resize) mounted.scr.resize(g); });
if (UI.dev) initDev(g);

const boot = document.getElementById('boot');
if (boot) anim(boot, [{ opacity: 1 }, { opacity: 0 }], 500).then(() => boot.remove());
UI.view = 'title';
UI.inRun = false;
render();
window.__hc = { g, UI, render: requestRender };
