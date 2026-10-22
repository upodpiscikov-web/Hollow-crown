// Speed / Auto / Auto-End helpers for combat. UI state only; all rules stay in the engine.
//   Speed    cycles 1x / 2x / 3x (settings.speed), scaling every pause and animation.
//   Auto     plays g.suggestPlay() moves one at a time with normal animations, ends the turn when
//            nothing sensible is left, and keeps going until combat ends, a card asks the player to
//            choose, the player taps Auto again, or 30 steps have passed.
//   Auto-End (settings.autoEnd) ends the turn once nothing is left worth waiting for.
import { UI, timeMul } from './core.js';
import { sfx } from './sound.js';

export const AUTO = { running: false, steps: 0, listeners: new Set() };
const emit = () => { for (const fn of AUTO.listeners) { try { fn(); } catch (e) { /* ignore */ } } };
const wait = (ms) => new Promise((r) => setTimeout(r, Math.max(30, ms * timeMul())));

export function stopAuto(why) {
  if (!AUTO.running) return;
  AUTO.running = false;
  UI.auto = false;
  emit();
  if (why && UI.toast) UI.toast(why);
}

export function toggleAuto(g) {
  if (AUTO.running) { stopAuto(); sfx('click'); return; }
  const cb = g.cb;
  if (!cb || cb.phase === 'over') return;
  AUTO.running = true; AUTO.steps = 0; UI.auto = true;
  emit();
  loop(g);
}

async function loop(g) {
  const cb0 = g.cb;
  try {
    while (AUTO.running) {
      const cb = g.cb;
      if (!cb || cb !== cb0 || cb.phase === 'over' || !g.run || g.run.screen !== 'combat') break;
      if (cb.phase !== 'player' || cb.busy) { await wait(160); continue; }
      if (document.querySelector('.modal')) { await wait(200); continue; }
      if (AUTO.steps >= 30) { stopAuto('Auto paused after 30 moves.'); break; }
      const s = g.suggestPlay();
      AUTO.steps++;
      if (!s) {
        await wait(280);
        if (!AUTO.running) break;
        if (g.cb === cb && cb.phase === 'player' && !cb.busy) { sfx('endTurn'); await g.endTurn(); }
        continue;
      }
      let ok = false;
      if (s.kind === 'card') ok = await g.playCard(s.card.uid, s.target);
      else ok = await g.useAction(s.id, s.target);
      if (!ok) { stopAuto(); break; }
      await wait(260);
    }
  } catch (e) { console.warn('auto stopped', e); }
  if (AUTO.running) { AUTO.running = false; UI.auto = false; emit(); }
}

export function cycleSpeed(g) {
  const st = g.meta.settings;
  const cur = Math.max(st.speed || 1, st.fast ? 2 : 1);
  st.speed = cur >= 3 ? 1 : cur + 1;
  st.fast = false;
  g.saveMeta();
  if (UI.applyTimeVar) UI.applyTimeVar();
  sfx('click');
  emit();
  return st.speed;
}

export function toggleAutoEnd(g) {
  const st = g.meta.settings;
  st.autoEnd = !st.autoEnd;
  g.saveMeta();
  sfx('click');
  emit();
  return st.autoEnd;
}
