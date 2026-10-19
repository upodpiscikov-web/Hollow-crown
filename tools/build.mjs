// Production build → dist/
//   node tools/build.mjs
//
// - Bundles + minifies all JS (esbuild, IIFE) and all CSS into ONE payload.
// - Ships the payload gzip-compressed as app.bin; a tiny inline loader
//   decompresses it with DecompressionStream (keeps the deploy and every
//   update small) and falls back to app.js where unsupported.
// - Generates manifest, icons and an offline-first service worker.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import * as esbuild from 'esbuild';
import { renderIcon } from './icons.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'dist');
fs.mkdirSync(path.join(ROOT, 'tools', 'out'), { recursive: true });
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'fonts'), { recursive: true });

const html = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8');

// ---------------------------------------------------------------- CSS
const cssLinks = [...html.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]*>/g)].map((m) => m[0].match(/href=["']([^"']+)["']/)[1]);
let css = '';
for (const href of cssLinks) {
  const file = path.join(SRC, href);
  let text = fs.readFileSync(file, 'utf8');
  const dir = path.dirname(href);
  // Rebase relative url(...) to the site root.
  text = text.replace(/url\((['"]?)(?!data:|https?:|\/)([^)'"]+)\1\)/g, (_, q, u) => `url(${path.posix.join(dir, u)})`);
  css += text + '\n';
}
const cssMin = (await esbuild.transform(css, { loader: 'css', minify: true })).code;

// ---------------------------------------------------------------- JS
const entry = html.match(/<script[^>]+type=["']module["'][^>]+src=["']([^"']+)["']/)[1];
const js = await esbuild.build({
  entryPoints: [path.join(SRC, entry)],
  bundle: true, minify: true, format: 'iife', target: ['es2020', 'safari15'],
  write: false, legalComments: 'none', define: { 'import.meta.env.PROD': 'true' },
});
const jsCode = js.outputFiles[0].text;
const payload = `(()=>{const s=document.createElement('style');s.textContent=${JSON.stringify(cssMin)};document.head.appendChild(s)})();\n${jsCode}`;
const gz = zlib.gzipSync(payload, { level: 9 });
fs.writeFileSync(path.join(OUT, 'app.js'), payload);
fs.writeFileSync(path.join(OUT, 'app.bin'), gz);
const hash = crypto.createHash('sha1').update(payload).digest('hex').slice(0, 10);

// ---------------------------------------------------------------- assets
for (const f of fs.readdirSync(path.join(SRC, 'fonts'))) if (f.endsWith('.woff2')) fs.copyFileSync(path.join(SRC, 'fonts', f), path.join(OUT, 'fonts', f));
const icons = [['icon-192.png', 192, false], ['icon-512.png', 512, false], ['icon-maskable-512.png', 512, true], ['apple-touch-icon.png', 180, false], ['favicon-32.png', 32, false]];
for (const [name, size, mask] of icons) fs.writeFileSync(path.join(OUT, name), renderIcon(size, mask));

const manifest = {
  name: 'The Hollow Crown', short_name: 'Hollow Crown',
  description: 'A dark-fantasy deckbuilding roguelike. The king is dead. The Crown wants a head.',
  start_url: './', scope: './', display: 'fullscreen', orientation: 'landscape',
  background_color: '#0b0a0d', theme_color: '#0b0a0d', categories: ['games'],
  icons: [
    { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
};
fs.writeFileSync(path.join(OUT, 'manifest.webmanifest'), JSON.stringify(manifest, null, 1));

// ---------------------------------------------------------------- index.html
const fontFiles = fs.readdirSync(path.join(OUT, 'fonts')).map((f) => 'fonts/' + f);
const preload = fontFiles.map((f) => `<link rel="preload" href="${f}" as="font" type="font/woff2" crossorigin>`).join('');
const loader = `<script>
(function(){
  var V='${hash}';
  function fail(e){var b=document.getElementById('boot');if(b)b.textContent='The Crown could not be summoned. Please reload. ('+(e&&e.message||e)+')';}
  function run(code){var s=document.createElement('script');s.textContent=code;document.head.appendChild(s);}
  function plain(){return fetch('app.js?v='+V).then(function(r){return r.text();});}
  var p = ('DecompressionStream' in window)
    ? fetch('app.bin?v='+V).then(function(r){if(!r.ok)throw new Error(r.status);return new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).text();}).catch(plain)
    : plain();
  p.then(run).catch(fail);
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', function(){ navigator.serviceWorker.register('sw.js').catch(function(){}); });
  }
})();
</script>`;
let out = html
  .replace(/<link[^>]+rel=["']stylesheet["'][^>]*>\s*/g, '')
  .replace(/<script[^>]+type=["']module["'][^>]*><\/script>\s*/g, '')
  .replace(/<link[^>]+rel=["']manifest["'][^>]*>\s*/g, '');
const head = `<link rel="manifest" href="manifest.webmanifest"><link rel="icon" href="favicon-32.png" type="image/png"><link rel="apple-touch-icon" href="apple-touch-icon.png">${preload}<style>html,body{margin:0;background:#0b0a0d;height:100%}#boot{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;color:#7a767a;font:16px Georgia,serif;letter-spacing:.2em;text-transform:uppercase;pointer-events:none}</style>`;
out = out.replace('</head>', head + '</head>');
out = out.replace(/<body([^>]*)>/, `<body$1><div id="boot">The Crown remembers…</div>`);
out = out.replace('</body>', loader + '</body>');
fs.writeFileSync(path.join(OUT, 'index.html'), out);

// ---------------------------------------------------------------- service worker
const precache = ['./', 'index.html', 'app.bin?v=' + hash, 'manifest.webmanifest', ...fontFiles, ...icons.map((i) => i[0])];
const sw = `// The Hollow Crown — offline-first service worker (build ${hash})
const CACHE = 'hc-${hash}';
const PRECACHE = ${JSON.stringify(precache)};
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    // Network first for the page (to pick up new builds), cache when offline.
    e.respondWith(fetch(req).then((r) => { const c = r.clone(); caches.open(CACHE).then((x) => x.put('index.html', c)); return r; }).catch(() => caches.match('index.html')));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => {
    if (r.ok) { const c = r.clone(); caches.open(CACHE).then((x) => x.put(req, c)); }
    return r;
  })));
});
`;
fs.writeFileSync(path.join(OUT, 'sw.js'), sw);

const noCache = [{ key: 'Cache-Control', value: 'no-cache' }];
const forever = [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }];
fs.writeFileSync(path.join(OUT, 'vercel.json'), JSON.stringify({
  cleanUrls: false,
  headers: [
    { source: '/', headers: noCache },
    { source: '/index.html', headers: noCache },
    { source: '/sw.js', headers: noCache },
    { source: '/manifest.webmanifest', headers: noCache },
    { source: '/fonts/(.*)', headers: forever },
  ],
}, null, 1));

// ---------------------------------------------------------------- report
const files = [];
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else {
      const buf = fs.readFileSync(p);
      files.push({ file: path.relative(OUT, p), size: buf.length, sha: crypto.createHash('sha1').update(buf).digest('hex') });
    }
  }
})(OUT);
fs.writeFileSync(path.join(ROOT, 'tools', 'out', 'files.json'), JSON.stringify(files, null, 1));
const kb = (n) => (n / 1024).toFixed(1) + ' KB';
console.log(`build ${hash}: payload ${kb(payload.length)} → app.bin ${kb(gz.length)} (gzip), css ${kb(cssMin.length)}`);
for (const f of files) console.log(`  ${f.file.padEnd(28)} ${kb(f.size)}`);
