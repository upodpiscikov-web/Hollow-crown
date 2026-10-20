// Act map: horizontally scrolling, floors left→right, lanes top→bottom.
import { ENCOUNTERS, ENEMIES, TEXTS } from '../engine/registry.js';
import { h, clear, tap, UI, ROMAN, safe, anim } from './core.js';
import { S } from './scale.js';
import { spr, icon, hasSprite, sprInfo } from './gfx.js';
import { topbar } from './topbar.js';
import { infoTip, modal, tip } from './overlay.js';
import { sfx, music } from './sound.js';

const TYPE_NAME = { fight: 'Fight', elite: 'Elite', event: 'Unknown', rest: 'Rest Site', shop: 'Peddler', treasure: 'Treasure', boss: 'Boss' };
const TYPE_DESC = {
  fight: 'Enemies bar the road.', elite: 'A powerful foe guards a relic.', event: 'Something waits in the fog.',
  rest: 'A campfire. Rest or sharpen your purpose.', shop: 'The Pale Peddler sells his wares.', treasure: 'A chest, unguarded. Probably.',
  boss: 'The master of this land.',
};
const GLYPH = { fight: '⚔', elite: '☠', event: '?', rest: '♨', shop: '$', treasure: '▣', boss: '♛' };
export const ACT_NAMES = { 1: 'The Ashen Marches', 2: 'The Weeping Wood', 3: 'Ashgrave', 4: 'Beneath the Throne' };

function hash(a, b) { let x = (a * 374761393 + b * 668265263) ^ 0x5bd1e995; x = Math.imul(x ^ (x >>> 13), 1274126177); return ((x ^ (x >>> 16)) >>> 0) / 4294967296; }

export function actTitle(act) {
  const t = safe(() => TEXTS.act_intro[act].title, null);
  return t || ACT_NAMES[act] || `Act ${act}`;
}

function bossInfo(g) {
  const enc = g.run.boss && ENCOUNTERS[g.run.boss];
  if (!enc) return { name: 'Unknown', sprite: null };
  let first = null;
  if (Array.isArray(enc.enemies)) first = enc.enemies[enc.enemies.length > 1 ? Math.floor(enc.enemies.length / 2) : 0];
  const ed = first && ENEMIES[first];
  return { name: enc.name || (ed && ed.name) || 'Boss', sprite: ed ? ed.sprite : null, desc: ed && ed.desc };
}

// Build the map DOM. opts: { interactive, height }
export function buildMap(g, opts = {}) {
  const run = g.run;
  const map = run.map;
  const nodes = Object.values(map.nodes);
  const fixed = !!map.fixed;
  const maxF = Math.max(...nodes.map((n) => n.f));
  const lanes = 7;
  const H = opts.height || (S.H - 40 - 28);
  const laneH = fixed ? 0 : Math.min(50, (H - 8) / lanes);
  const colW = fixed ? 120 : 64;
  const padL = 70;
  const bossW = 170;
  const width = padL + maxF * colW + bossW;
  const top = fixed ? H / 2 : (H - laneH * lanes) / 2 + laneH / 2;
  const pos = {};
  for (const n of nodes) {
    const k = n.f + '_' + n.l;
    if (n.type === 'boss') { pos[k] = { x: padL + n.f * colW + 50, y: fixed ? H / 2 : top + 3 * laneH }; continue; }
    const jx = fixed ? 0 : (hash(n.f, n.l) - 0.5) * 14;
    const jy = fixed ? 0 : (hash(n.l + 11, n.f + 3) - 0.5) * 4;
    pos[k] = { x: padL + n.f * colW + jx, y: (fixed ? H / 2 : top + n.l * laneH) + jy };
  }
  const reach = new Set(opts.interactive ? g.reachable() : []);
  const path = run.path || [];
  const visited = new Set(path);
  const pathEdges = new Set();
  for (let i = 1; i < path.length; i++) pathEdges.add(path[i - 1] + '>' + path[i]);

  const inner = h('div.map-inner', { style: { width: width + 'px', height: H + 'px' } });
  // Floor numbers
  if (!fixed) for (let f = 0; f < maxF; f += 1) {
    if (f % 2) continue;
    inner.appendChild(h('div.map-floor', { style: { left: padL + f * colW + 'px' } }, String(f + 1)));
  }
  // Edges (SVG)
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'map-svg');
  svg.setAttribute('width', width); svg.setAttribute('height', H);
  svg.setAttribute('viewBox', `0 0 ${width} ${H}`);
  const lines = [];
  for (const n of nodes) {
    const a = n.f + '_' + n.l;
    for (const l2 of n.next) {
      const b = (n.f + 1) + '_' + l2;
      if (!map.nodes[b]) continue;
      const pa = pos[a], pb = pos[b];
      const done = pathEdges.has(a + '>' + b);
      const avail = run.pos === a && reach.has(b);
      const ln = document.createElementNS(NS, 'path');
      const mx = (pa.x + pb.x) / 2, my = (pa.y + pb.y) / 2 + (hash(n.f, l2) - 0.5) * 8;
      ln.setAttribute('d', `M${pa.x} ${pa.y} Q${mx} ${my} ${pb.x} ${pb.y}`);
      ln.setAttribute('class', 'edge' + (done ? ' done' : '') + (avail ? ' avail' : ''));
      lines.push([done || avail ? 1 : 0, ln]);
    }
  }
  lines.sort((x, y) => x[0] - y[0]).forEach(([, ln]) => svg.appendChild(ln));
  inner.appendChild(svg);
  // Nodes
  let curEl = null, firstReach = null;
  for (const n of nodes) {
    const k = n.f + '_' + n.l;
    const p = pos[k];
    if (n.type === 'boss') {
      const bi = bossInfo(g);
      const bossEl = h('button.map-boss' + (reach.has(k) ? '.reach' : ''), { style: { left: p.x + 'px', top: p.y + 'px' } },
        h('div.mb-art', bi.sprite && hasSprite(bi.sprite) ? spr(bi.sprite, Math.min(1.1, 96 / Math.max(1, sprInfo(bi.sprite).h)), 'mb-sprite') : icon('map_boss', 4, '', GLYPH.boss)),
        h('div.mb-name', bi.name));
      if (reach.has(k)) { tap(bossEl, () => enter(g, k)); if (!firstReach) firstReach = bossEl; }
      else infoTip(bossEl, () => ({ title: bi.name, text: 'The master of this land awaits at the end of the road.', sub: bi.desc ? `<i>${bi.desc}</i>` : '' }));
      inner.appendChild(bossEl);
      continue;
    }
    const isCur = run.pos === k;
    const cls = ['map-node', 't-' + n.type];
    if (visited.has(k)) cls.push('visited');
    if (isCur) cls.push('cur');
    if (reach.has(k)) cls.push('reach');
    const el = h('button.' + cls.join('.'), { style: { left: p.x + 'px', top: p.y + 'px' }, 'aria-label': TYPE_NAME[n.type] },
      icon('map_' + n.type, 2, 'mn-ic', GLYPH[n.type] || '?'));
    el.dataset.k = k;
    if (reach.has(k)) { tap(el, () => enter(g, k), { sound: false }); if (!firstReach) firstReach = el; }
    else infoTip(el, () => ({ title: TYPE_NAME[n.type] || n.type, text: TYPE_DESC[n.type] || '' }));
    if (isCur) curEl = el;
    inner.appendChild(el);
  }
  inner._focus = firstReach || curEl;
  inner._focusX = (firstReach || curEl) ? parseFloat((firstReach || curEl).style.left) : 0;
  return inner;
}

let entering = false;
async function enter(g, k) {
  if (entering || !g.run || g.run.screen !== 'map') return;
  entering = true;
  sfx('mapStep');
  const el = document.querySelector(`.map-node[data-k="${k}"], .map-boss.reach`);
  if (el) await anim(el, [{ transform: 'translate(-50%,-50%) scale(1)' }, { transform: 'translate(-50%,-50%) scale(1.35)' }, { transform: 'translate(-50%,-50%) scale(1.1)' }], 220);
  try { await g.enterNode(k); } catch (e) { console.error('enterNode failed', e); }
  finally { entering = false; }
  UI.render();
}

function legend() {
  const items = ['fight', 'elite', 'event', 'rest', 'shop', 'treasure'];
  return h('div.map-legend', items.map((t) => h('div.lg-item', icon('map_' + t, 1, '', GLYPH[t]), h('span', TYPE_NAME[t]))));
}

export const mapScreen = {
  name: 'map',
  mount(root, g) {
    this.g = g; this.root = root;
    const act = g.run.act;
    music('act' + Math.min(4, act));
    this.build(true);
  },
  build(first) {
    const g = this.g, root = this.root;
    const prevScroll = this.scroller ? this.scroller.scrollLeft : null;
    clear(root);
    const act = g.run.act;
    const scr = h('div.screen.map-screen');
    scr.appendChild(h('div.bleed.map-bg'));
    scr.appendChild(topbar(g, { mapPeek: false }));
    const area = h('div.map-area');
    const scroller = h('div.map-scroll');
    const inner = buildMap(g, { interactive: true });
    scroller.appendChild(inner);
    area.appendChild(scroller);
    area.appendChild(h('div.map-title', h('span.mt-act', act === 4 ? 'Act IV' : `Act ${ROMAN[act] || act}`), h('span.mt-name', actTitle(act))));
    area.appendChild(h('div.map-fade.l'));
    area.appendChild(h('div.map-fade.r'));
    scr.appendChild(area);
    scr.appendChild(legend());
    if (!g.reachable().length) scr.appendChild(h('div.map-stuck', 'No road leads on.'));
    root.appendChild(scr);
    this.scroller = scroller;
    requestAnimationFrame(() => {
      const target = Math.max(0, inner._focusX - scroller.clientWidth * 0.38);
      if (first || prevScroll == null) {
        scroller.scrollLeft = Math.max(0, target - 160);
        if (scroller.scrollTo) scroller.scrollTo({ left: target, behavior: UI.reduced ? 'auto' : 'smooth' });
        else scroller.scrollLeft = target;
      } else scroller.scrollLeft = prevScroll;
    });
  },
  update() { this.build(false); },
  resize() { this.build(false); },
  unmount() { this.scroller = null; },
};

export function openMapPeek(g) {
  if (!g.run || !g.run.map) return;
  const hgt = Math.min(320, S.H - 80);
  const scroller = h('div.map-scroll.peek');
  const inner = buildMap(g, { interactive: false, height: hgt });
  scroller.appendChild(inner);
  const m = modal({ title: `Act ${ROMAN[g.run.act] || g.run.act} — ${actTitle(g.run.act)}`, cls: 'm-map', body: [h('div.map-bg-peek', scroller)] });
  requestAnimationFrame(() => { scroller.scrollLeft = Math.max(0, inner._focusX - scroller.clientWidth * 0.4); });
  return m;
}
