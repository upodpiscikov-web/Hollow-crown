// Branching act map. Floors run left->right (landscape), lanes top->bottom.
import { int, rnd, weighted, pick, shuffle } from './rng.js';
import { paceOf } from './pace.js';

export const FLOORS = 15; // default; per-act values come from pace.js
export const LANES = 7;

export function key(f, l) { return f + '_' + l; }

export function generateMap(r, act, asc = 0) {
  if (act === 4) return finalMap();
  const pace = paceOf(act);
  const F = pace.floors;
  const nodes = {};
  const edges = new Set(); // "f_l>l2"
  const get = (f, l) => nodes[key(f, l)] || (nodes[key(f, l)] = { f, l, type: null, next: [], prev: [] });
  const starts = [];
  for (let p = 0; p < pace.paths; p++) {
    let l = int(r, 0, LANES - 1);
    if (p === 1) while (l === starts[0]) l = int(r, 0, LANES - 1);
    starts.push(l);
    get(0, l);
    for (let f = 0; f < F - 1; f++) {
      const opts = [l - 1, l, l + 1].filter((x) => x >= 0 && x < LANES);
      shuffle(r, opts);
      let nl = opts[0];
      for (const cand of opts) {
        // Don't cross an existing edge.
        const crosses = cand < l ? edges.has(f + '_' + (l - 1) + '>' + l) : cand > l ? edges.has(f + '_' + (l + 1) + '>' + l) : false;
        if (!crosses) { nl = cand; break; }
      }
      const a = get(f, l), b = get(f + 1, nl);
      if (!a.next.includes(nl)) a.next.push(nl);
      if (!b.prev.includes(l)) b.prev.push(l);
      edges.add(f + '_' + l + '>' + nl);
      l = nl;
    }
  }
  // Assign room types.
  const order = Object.values(nodes).sort((a, b) => a.f - b.f || a.l - b.l);
  const eliteW = asc >= 1 ? 26 : 16;
  for (const n of order) {
    if (n.f === 0) { n.type = 'fight'; continue; }
    if (n.f === Math.round(F * 0.55)) { n.type = 'treasure'; continue; }
    if (n.f === F - 1) { n.type = 'rest'; continue; }
    const parents = n.prev.map((pl) => nodes[key(n.f - 1, pl)]);
    const siblings = parents.flatMap((p) => p.next.filter((x) => x !== n.l).map((x) => nodes[key(n.f, x)])).filter((s) => s && s.type);
    const banned = new Set();
    for (const p of parents) if (['elite', 'rest', 'shop'].includes(p.type)) banned.add(p.type);
    for (const s of siblings) banned.add(s.type === 'fight' ? '__' : s.type);
    if (n.f < Math.round(F / 3)) { banned.add('elite'); banned.add('rest'); }
    if (n.f === F - 2) banned.add('rest');
    if (n.f < 2) banned.add('shop');
    const w = { fight: 46, event: 24, elite: eliteW, rest: 12, shop: 6 };
    const types = Object.keys(w).filter((t) => !banned.has(t));
    n.type = types.length ? weighted(r, types, (t) => w[t]) : 'fight';
  }
  // Guarantee at least one shop and one early event exist.
  if (!order.some((n) => n.type === 'shop')) {
    const c = order.filter((n) => n.type === 'fight' && n.f >= 3 && n.f <= 11);
    if (c.length) pick(r, c).type = 'shop';
  }
  const boss = { f: F, l: 3, type: 'boss', next: [], prev: [] };
  for (const n of order) if (n.f === F - 1) { n.next = [3]; boss.prev.push(n.l); }
  nodes[key(F, 3)] = boss;
  return { act, nodes, floors: F + 1 };
}

// Act 4: a short, fixed descent beneath the throne.
function finalMap() {
  const nodes = {};
  const seq = ['event', 'rest', 'shop', 'elite', 'rest', 'boss'];
  seq.forEach((type, f) => {
    nodes[key(f, 3)] = { f, l: 3, type, next: f < seq.length - 1 ? [3] : [], prev: f > 0 ? [3] : [] };
  });
  return { act: 4, nodes, floors: seq.length, fixed: true };
}
