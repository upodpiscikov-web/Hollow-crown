// Render sprites to a PNG contact sheet so you can LOOK at your pixel art.
//
//   node tools/sprite-sheet.mjs <module.js ...> [--only id1,id2] [--scale 4] [--out file.png]
//
// Imports the given modules (which call defineSprites), then renders every
// sprite they define (or --only ids) in a grid on a dark background.
// Prints the grid order so you can match cells to ids.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { SPRITES, renderSprite } from '../src/gfx/sprite.js';
import { encodePNG, scaleOnto } from './png.mjs';

const args = process.argv.slice(2);
let scale = 4, out = null, only = null, bg = [34, 29, 40];
const mods = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--scale') scale = +args[++i];
  else if (args[i] === '--out') out = args[++i];
  else if (args[i] === '--only') only = args[++i].split(',');
  else if (args[i] === '--light') bg = [200, 190, 170];
  else mods.push(args[i]);
}
const before = new Set(Object.keys(SPRITES));
for (const m of mods) await import(pathToFileURL(path.resolve(m)).href);
let ids = only || Object.keys(SPRITES).filter((k) => !before.has(k));
if (!ids.length) ids = Object.keys(SPRITES);

const renders = ids.map((id) => ({ id, ...renderSprite(id) }));
const cell = Math.max(...renders.map((r) => Math.max(r.w, r.h))) * scale + 12;
const cols = Math.min(6, renders.length);
const rows = Math.ceil(renders.length / cols);
const W = cols * cell, H = rows * cell;
const img = new Uint8ClampedArray(W * H * 4);
for (let i = 0; i < W * H; i++) {
  const x = i % W, y = (i / W) | 0;
  const checker = (((x / cell) | 0) + ((y / cell) | 0)) % 2 ? 6 : 0;
  img.set([bg[0] + checker, bg[1] + checker, bg[2] + checker, 255], i * 4);
}
renders.forEach((r, i) => {
  const cx = (i % cols) * cell, cy = ((i / cols) | 0) * cell;
  scaleOnto(img, W, r.data, r.w, r.h, cx + ((cell - r.w * scale) >> 1), cy + ((cell - r.h * scale) >> 1), scale);
});
out = out || path.resolve('tools/out/sheet.png');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, encodePNG(W, H, img));
console.log(`wrote ${out} (${W}x${H}), ${cols} per row:`);
renders.forEach((r, i) => console.log(`  [${(i / cols) | 0},${i % cols}] ${r.id} ${r.w - 2}x${r.h - 2}`));
