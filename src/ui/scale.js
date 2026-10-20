// Stage scaling. The whole UI is authored in "design pixels" (base 844x390).
// The stage is sized to the safe area divided by the scale factor u and then
// scaled with a single transform, so layouts are fluid between ~680 and ~920
// design px wide and always at least 390 tall.

export const S = { u: 1, W: 844, H: 390, left: 0, top: 0, padL: 0, padR: 0, padT: 0, padB: 0, portrait: false };
const listeners = new Set();
export function onResize(fn) { listeners.add(fn); return () => listeners.delete(fn); }

let probe = null;
function safeInsets() {
  if (!probe) {
    probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;' +
      'padding-left:env(safe-area-inset-left);padding-right:env(safe-area-inset-right);padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)';
    document.body.appendChild(probe);
  }
  const cs = getComputedStyle(probe);
  return { l: parseFloat(cs.paddingLeft) || 0, r: parseFloat(cs.paddingRight) || 0, t: parseFloat(cs.paddingTop) || 0, b: parseFloat(cs.paddingBottom) || 0 };
}

export function layout() {
  const vw = window.innerWidth, vh = window.innerHeight;
  const ins = safeInsets();
  const aw = Math.max(200, vw - ins.l - ins.r), ah = Math.max(150, vh - ins.t - ins.b);
  const u = Math.max(0.3, Math.min(ah / 390, aw / 680));
  S.u = u;
  S.W = Math.floor(aw / u);
  S.H = Math.floor(ah / u);
  S.left = ins.l; S.top = ins.t;
  S.padL = ins.l / u; S.padR = ins.r / u; S.padT = ins.t / u; S.padB = ins.b / u;
  S.portrait = vh > vw * 1.05;
  const st = document.getElementById('stage');
  if (st) {
    st.style.width = S.W + 'px';
    st.style.height = S.H + 'px';
    st.style.left = S.left + 'px';
    st.style.top = S.top + 'px';
    st.style.transform = `scale(${u})`;
    const r = document.documentElement.style;
    r.setProperty('--padL', S.padL + 'px');
    r.setProperty('--padR', S.padR + 'px');
    r.setProperty('--padT', S.padT + 'px');
    r.setProperty('--padB', S.padB + 'px');
    r.setProperty('--W', S.W + 'px');
    r.setProperty('--H', S.H + 'px');
  }
  document.body.classList.toggle('portrait', S.portrait);
  for (const fn of listeners) { try { fn(S); } catch (e) { console.warn(e); } }
}

// Convert a viewport point to stage design coordinates.
export function toStage(x, y) { return { x: (x - S.left) / S.u, y: (y - S.top) / S.u }; }
// Element rect in stage coordinates.
export function stageRect(el) {
  const r = el.getBoundingClientRect();
  return { x: (r.left - S.left) / S.u, y: (r.top - S.top) / S.u, w: r.width / S.u, h: r.height / S.u, cx: (r.left + r.width / 2 - S.left) / S.u, cy: (r.top + r.height / 2 - S.top) / S.u };
}

export function initScale() {
  let raf = 0;
  const go = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(layout); };
  window.addEventListener('resize', go);
  window.addEventListener('orientationchange', () => setTimeout(layout, 120));
  if (window.visualViewport) window.visualViewport.addEventListener('resize', go);
  layout();
}
