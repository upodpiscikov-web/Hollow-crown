// Generates PWA icons (PNG) from a pixel-art crown drawn with the game's Painter.
//   node tools/icons.mjs <outDir>
import fs from 'node:fs';
import path from 'node:path';
import { defineSprites, renderSprite, PAL, shadeColor } from '../src/gfx/sprite.js';
import { encodePNG, scaleOnto } from './png.mjs';

defineSprites({
  app_icon_crown: {
    w: 34, h: 26,
    draw(p) {
      // Spikes with gold finials
      const tips = [[3, 8], [10, 4], [17, 0], [24, 4], [31, 8]];
      for (const [x, y] of tips) p.tri(x - 4, 16, x + 4, 16, x, y + 2, PAL.iron, { shade: 0.35 });
      for (const [x, y] of tips) p.circle(x, y + 1.5, 1.6, PAL.gold, { shade: 0.3 });
      // Band
      p.rect(0, 15, 34, 9, PAL.iron, { shade: 0.4 });
      p.rect(0, 15, 34, 2, PAL.steel);
      p.rect(0, 22, 34, 2, PAL.dusk);
      for (const x of [4, 10, 24, 30]) p.px(x, 19, PAL.fog);
      // The hollow socket: gold rim around an empty void with a faint ember glow
      p.ellipse(17, 19.5, 5.5, 5, PAL.gold, { shade: 0.3 });
      p.ellipse(17, 19.5, 3.6, 3.2, PAL.void);
      p.px(17, 21, PAL.ember);
      p.px(16, 21, PAL.blood);
      p.px(18, 20, PAL.gore);
    },
  },
});

export function renderIcon(size, maskable) {
  const img = new Uint8ClampedArray(size * size * 4);
  const c0 = [11, 10, 13], c1 = [52, 30, 40];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (x - size / 2) / (size / 2), dy = (y - size * 0.46) / (size / 2);
    const t = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) * 0.95);
    const i = (y * size + x) * 4;
    for (let k = 0; k < 3; k++) img[i + k] = c0[k] + (c1[k] - c0[k]) * t * t;
    img[i + 3] = 255;
  }
  // Falling ash
  let s = 12345;
  const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const ashN = Math.round(size / 6);
  const px = Math.max(1, Math.round(size / 64));
  for (let n = 0; n < ashN; n++) {
    const ax = Math.floor(r() * size), ay = Math.floor(r() * size);
    for (let yy = 0; yy < px; yy++) for (let xx = 0; xx < px; xx++) {
      const i = ((ay + yy) * size + ax + xx) * 4;
      if (i < img.length) { img[i] = 120; img[i + 1] = 114; img[i + 2] = 118; }
    }
  }
  const spr = renderSprite('app_icon_crown');
  const frac = maskable ? 0.6 : 0.8;
  const scale = Math.max(1, Math.floor((size * frac) / spr.w));
  const ox = Math.round((size - spr.w * scale) / 2), oy = Math.round((size - spr.h * scale) / 2 + size * 0.03);
  scaleOnto(img, size, spr.data, spr.w, spr.h, ox, oy, scale);
  return encodePNG(size, size, img);
}

if (process.argv[1] && process.argv[1].endsWith('icons.mjs')) {
  const out = process.argv[2] || 'tools/out';
  fs.mkdirSync(out, { recursive: true });
  for (const [name, size, mask] of [['icon-192.png', 192, false], ['icon-512.png', 512, false], ['icon-maskable-512.png', 512, true], ['apple-touch-icon.png', 180, false], ['favicon-32.png', 32, false]]) {
    fs.writeFileSync(path.join(out, name), renderIcon(size, mask));
  }
  console.log('icons written to', out);
}
