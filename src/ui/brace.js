// Timed Brace window. The engine awaits g.ui.brace({ enemy, dmg, times, ms }) before a heavy
// attack; resolve true if the player tapped in time (that hit then deals 60% damage).
// A big centred BRACE! button with a shrinking ring sits over the field. A tap anywhere counts
// (thumb friendly). A miss resolves false silently. Never throws, never leaves a layer behind.
import { h, UI, anim } from './core.js';
import { S, stageRect } from './scale.js';
import { icon } from './gfx.js';
import { sfx } from './sound.js';
import { particles } from './fx.js';

let active = null;

export function braceOpen() { return !!active; }

export function braceWindow(g, { enemy, dmg, times, ms }) {
  const stage = document.getElementById('stage');
  if (!stage || !document.querySelector('.screen.combat') || active) return Promise.resolve(false);
  ms = Math.max(500, Math.min(3000, ms || 1400));
  return new Promise((resolve) => {
    const total = dmg * (times || 1);
    const cut = Math.round(dmg * 0.6);
    const ring = h('div.brace-ring');
    const bar = h('div.brace-bar', h('i'));
    const btn = h('div.brace-btn', icon('ui_brace', 3, 'brace-ic', '◈'), h('div.brace-word', 'BRACE!'), h('div.brace-sub', `−${Math.round(dmg * 0.4)}${times > 1 ? ' each' : ''}`));
    const dmgChip = h('div.brace-dmg', icon('in_atk', 1.5, '', '⚔'), h('span', `${dmg}${times > 1 ? '×' + times : ''}`));
    const wrap = h('div.brace-wrap', ring, btn, bar, dmgChip);
    const layer = h('div.brace-layer', wrap);
    stage.appendChild(layer);
    // Hint the attacker: a red wind-up pulse on its sprite.
    const rec = document.querySelector(`.entity.enemy[data-uid="${enemy && enemy.uid}"] .ent-body`);
    let windup = null;
    if (rec && rec.animate && !UI.reduced) windup = rec.animate([{ transform: 'translateX(0) scale(1)', filter: 'none' }, { transform: 'translateX(10px) scale(1.05)', filter: 'brightness(1.4) sepia(1) hue-rotate(-30deg) saturate(3)' }, { transform: 'translateX(0) scale(1)', filter: 'none' }], { duration: Math.min(ms, 700), iterations: Math.ceil(ms / 700) });
    let ringAnim = null, barAnim = null;
    if (ring.animate) {
      if (!UI.reduced) ringAnim = ring.animate([{ transform: 'translate(-50%,-50%) scale(2.6)', opacity: 0.25 }, { transform: 'translate(-50%,-50%) scale(1.02)', opacity: 1 }], { duration: ms, easing: 'linear', fill: 'forwards' });
      barAnim = bar.firstChild.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], { duration: ms, easing: 'linear', fill: 'forwards' });
    }
    if (UI.reduced) ring.style.transform = 'translate(-50%,-50%) scale(1.02)';
    anim(wrap, [{ opacity: 0, transform: 'translate(-50%,-50%) scale(.8)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1)' }], { duration: 140, exact: true });
    sfx('bell');

    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      layer.removeEventListener('pointerdown', onTap, true);
      active = null;
      try { windup && windup.cancel(); } catch (e) { /* noop */ }
      if (ok) {
        sfx('ward');
        btn.classList.add('ok');
        btn.querySelector('.brace-word').textContent = 'BRACED!';
        btn.querySelector('.brace-sub').textContent = '−40%';
        const r = stageRect(btn);
        particles(S.left + r.cx * S.u, S.top + r.cy * S.u, 'block', { n: 22, sp: 190 });
        anim(wrap, [{ transform: 'translate(-50%,-50%) scale(1)', opacity: 1 }, { transform: 'translate(-50%,-50%) scale(1.25)', opacity: 1, offset: 0.35 }, { transform: 'translate(-50%,-50%) scale(1.1)', opacity: 0 }], { duration: 420, exact: true }).then(() => layer.remove());
      } else {
        anim(wrap, [{ opacity: 1 }, { opacity: 0 }], { duration: 160, exact: true }).then(() => layer.remove());
      }
      resolve(ok);
    };
    const onTap = (e) => { e.preventDefault(); e.stopPropagation(); finish(true); };
    layer.addEventListener('pointerdown', onTap, true);
    const timer = setTimeout(() => finish(false), ms);
    active = { finish };
  });
}

// If the combat screen goes away mid-window, close it quietly.
export function braceCancel() { if (active) active.finish(false); }
