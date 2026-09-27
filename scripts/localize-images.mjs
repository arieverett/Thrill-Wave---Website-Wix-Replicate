// Downloads every image still hosted on Wix (static.wixstatic.com) into
// public/images/wix/ and rewrites src/ and content/ to use the local copies.
//
// Run this on your own machine BEFORE cancelling Wix. Wix image URLs will
// stop working once the site is deleted.
//
//   npm run localize-images
//
// Safe to re-run: files already downloaded are skipped.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT_DIR = path.join(ROOT, 'public/images/wix');
const SCAN = ['src', 'content'];
const URL_RE = /https:\/\/static\.wixstatic\.com\/media\/[A-Za-z0-9_~.-]+/g;

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : /\.(html|md|json)$/.test(e.name) ? [p] : [];
  });
}

const files = SCAN.flatMap((d) => walk(path.join(ROOT, d)));
const urls = new Set();
for (const f of files) for (const m of fs.readFileSync(f, 'utf8').matchAll(URL_RE)) urls.add(m[0]);

fs.mkdirSync(OUT_DIR, { recursive: true });
const map = {};
let ok = 0, failed = [];

for (const url of urls) {
  const name = url.split('/').pop().replace(/~/g, '_');
  const dest = path.join(OUT_DIR, name);
  map[url] = `/images/wix/${name}`;
  if (fs.existsSync(dest)) { ok++; continue; }
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
    ok++;
    console.log('saved', name);
  } catch (err) {
    failed.push(`${url} (${err.message})`);
    delete map[url];
  }
}

for (const f of files) {
  let s = fs.readFileSync(f, 'utf8');
  const before = s;
  for (const [remote, local] of Object.entries(map)) s = s.split(remote).join(local);
  if (s !== before) fs.writeFileSync(f, s);
}

console.log(`\n${ok}/${urls.size} images local.`);
if (failed.length) console.log('Failed (re-run, or download by hand):\n' + failed.join('\n'));
console.log('\nOG/share images use absolute URLs; check content/site.json "ogImage" and "logo" afterwards.');
