// Single-file build for hosts that serve one HTML page (e.g. a Claude artifact).
//   node tools/build-artifact.mjs [outFile]
// Inlines bundled JS, all CSS and the fonts (data: URIs). No network, no service
// worker. Output is page CONTENT (no <html>/<head>/<body>), as the artifact host wraps it.
import fs from 'node:fs';
import path from 'node:path';
import * as esbuild from 'esbuild';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = path.join(ROOT, 'src');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'dist-artifact', 'hollow-crown.html'));
fs.mkdirSync(path.dirname(OUT), { recursive: true });

const html = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8');

// CSS, with url(...) rewritten to data URIs (fonts).
const cssLinks = [...html.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]*>/g)].map((m) => m[0].match(/href=["']([^"']+)["']/)[1]);
let css = '';
for (const href of cssLinks) {
  let text = fs.readFileSync(path.join(SRC, href), 'utf8');
  const dir = path.dirname(href);
  text = text.replace(/url\((['"]?)(?!data:|https?:|\/)([^)'"]+)\1\)/g, (_, q, u) => {
    const file = path.join(SRC, dir, u);
    const ext = path.extname(file).slice(1);
    const mime = { woff2: 'font/woff2', woff: 'font/woff', png: 'image/png' }[ext] || 'application/octet-stream';
    return `url(data:${mime};base64,${fs.readFileSync(file).toString('base64')})`;
  });
  css += text + '\n';
}
const cssMin = (await esbuild.transform(css, { loader: 'css', minify: true })).code;

// JS
const entry = html.match(/<script[^>]+type=["']module["'][^>]+src=["']([^"']+)["']/)[1];
const built = await esbuild.build({
  entryPoints: [path.join(SRC, entry)], bundle: true, minify: true, format: 'iife',
  target: ['es2020', 'safari15'], write: false, legalComments: 'none',
});
const js = built.outputFiles[0].text.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');

// Body markup without scripts.
const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/)[1].replace(/<script[\s\S]*?<\/script>\s*/g, '').trim();

const page = `<title>The Hollow Crown</title>
<style>:root{color-scheme:dark;background:#0b0a0d}html,body{height:100%;margin:0;background:#0b0a0d}</style>
<style>${cssMin}</style>
${body}
<script>${js}</script>
`;
fs.writeFileSync(OUT, page);
console.log(`wrote ${OUT}: ${(page.length / 1024).toFixed(0)} KB (js ${(js.length / 1024).toFixed(0)} KB, css+fonts ${(cssMin.length / 1024).toFixed(0)} KB)`);
