// Site check: `npm run check`
// ---------------------------------------------------------------------------
// Builds the site, then audits every page in dist/ for the things that quietly
// break SEO or accessibility. Exits with an error if anything is broken, so it
// can also run in CI before a deploy. No dependencies.
//
//   errors:   broken internal links/images, missing alt text, missing <h1> or
//             more than one, missing title/description/canonical, invalid JSON-LD,
//             duplicate ids, _redirects pointing at pages that don't exist,
//             paragraph text capped narrower than its column (max-width in ch or
//             text-wrap pretty/balance on anything but headlines)
//   warnings: titles over 65 chars, descriptions outside 50-160 chars

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const errors = [];
const warnings = [];

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
const files = walk(DIST);
const pages = files.filter((f) => f.endsWith('.html'));
const urlOf = (file) => '/' + path.relative(DIST, file).replace(/\\/g, '/').replace(/(index)?\.html$/, '');

// Does a site-relative URL resolve to a file, the way Cloudflare Pages would serve it?
const resolves = (p) => {
  const f = path.join(DIST, decodeURI(p));
  return [f, f + '.html', path.join(f, 'index.html')].some((c) => fs.existsSync(c) && fs.statSync(c).isFile());
};

const idsByPage = new Map();
const linkHashes = {}; // target page -> [[from page, #anchor]]
const attr = (tag, name) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];

for (const file of pages) {
  const url = urlOf(file);
  const html = fs.readFileSync(file, 'utf8');
  const is404 = file.endsWith('404.html');
  const err = (msg) => errors.push(`${url}: ${msg}`);
  const warn = (msg) => warnings.push(`${url}: ${msg}`);

  const title = html.match(/<title>([^<]*)<\/title>/)?.[1];
  if (!title) err('missing <title>');
  else if (title.length > 65) warn(`title is ${title.length} chars (Google shows about 60)`);

  const desc = html.match(/<meta name="description" content="([^"]*)"/)?.[1];
  if (!desc) err('missing meta description');
  else if (!is404 && (desc.length < 50 || desc.length > 160)) warn(`description is ${desc.length} chars (aim for 50-160)`);

  if (!is404 && !/<link rel="canonical" href="https:\/\/[^"]+">/.test(html)) err('missing absolute canonical URL');

  const h1s = (html.match(/<h1[\s>]/g) || []).length;
  if (h1s !== 1) err(`has ${h1s} <h1> elements (expected 1)`);

  for (const tag of html.match(/<img\b[^>]*>/g) || []) {
    if (!/\salt="/.test(tag)) err(`image without alt text: ${tag.slice(0, 90)}`);
    if (!/\swidth="/.test(tag)) warn(`image without width/height (may shift layout): ${attr(tag, 'src')}`);
  }

  for (const block of html.match(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g) || []) {
    try { JSON.parse(block.replace(/^<script[^>]*>|<\/script>$/g, '')); } catch (e) { err('invalid JSON-LD: ' + e.message); }
  }
  if (!is404 && !html.includes('application/ld+json')) warn('no structured data');

  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupes.length) err(`duplicate ids: ${[...new Set(dupes)].join(', ')}`);
  idsByPage.set(url, new Set(ids));

  for (const m of html.matchAll(/\s(href|src|srcset)="([^"]+)"/g)) {
    const values = m[1] === 'srcset' ? m[2].split(',').map((s) => s.trim().split(/\s+/)[0]) : [m[2]];
    for (const v of values) {
      if (!v.startsWith('/') || v.startsWith('//')) continue;
      const [p, hash] = v.split('#');
      const clean = p.split('?')[0] || url;
      if (!resolves(clean)) err(`broken link: ${v}`);
      else if (hash && m[1] === 'href') (linkHashes[clean] ||= []).push([url, hash]);
    }
  }
  for (const m of html.matchAll(/\shref="#([^"]+)"/g)) (linkHashes[url] ||= []).push([url, m[1]]);
}

// In-page anchors (#faq, #packages...) must exist on the target page
for (const [target, refs] of Object.entries(linkHashes)) {
  const key = target.replace(/\.html$/, '').replace(/\/$/, '') || '/';
  const ids = idsByPage.get(key) || idsByPage.get(target);
  if (!ids) continue;
  for (const [from, hash] of refs) if (!ids.has(hash)) errors.push(`${from}: link to missing anchor ${target}#${hash}`);
}

// Text width rule: paragraph text runs the full width of its column. The only
// character caps allowed are on big headlines (h1). Checked in the source CSS
// so a new page or section can't quietly bring back narrow paragraphs.
{
  const css = fs.readFileSync(path.join(ROOT, 'public/css/site.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = m[1].trim().replace(/\s+/g, ' ');
    const body = m[2];
    const capped = /max-width:\s*[\d.]+ch/.test(body);
    const tidyWrap = /text-wrap:\s*(pretty|balance)/.test(body);
    if (!capped && !tidyWrap) continue;
    // allowed: selectors whose target is a headline (h1/h2/h3), e.g. ".hero--home h1", ".cta h2"
    const onlyHeadlines = selector.split(',').every((part) => /(^|[\s>+~])h[123]([.:#\[][^\s]*)?$/.test(part.trim()));
    if (!onlyHeadlines) {
      errors.push(`site.css: "${selector}" ${capped ? 'caps text width in ch' : 'uses text-wrap pretty/balance'}; paragraphs must run the full column width (only headlines may be capped)`);
    }
  }
}

// _redirects targets must exist, and no redirect may hide a page we publish (Cloudflare applies
// redirects before serving files, so an old "/process /sitrep" would make a new /process page unreachable)
const redirects = fs.existsSync(path.join(DIST, '_redirects')) ? fs.readFileSync(path.join(DIST, '_redirects'), 'utf8') : '';
for (const line of redirects.split('\n')) {
  const [from, to] = line.trim().split(/\s+/);
  if (from && !from.startsWith('#') && !from.includes('*') && from !== '/' && resolves(from)) errors.push(`_redirects: ${from} redirects away from a page that exists (${from}); remove the redirect`);
  if (!from || from.startsWith('#') || !to?.startsWith('/')) continue;
  const p = to.split('#')[0];
  if (!resolves(p === '/' ? '/index' : p)) errors.push(`_redirects: ${from} points to missing page ${to}`);
}

// Group repeated warnings (e.g. 40 long blog titles) into one line
const groups = new Map();
for (const w of warnings) {
  const kind = w.replace(/^\/post\/[^:]+/, '/post/*').replace(/\d+ chars/, 'N chars');
  groups.set(kind, [...(groups.get(kind) || []), w]);
}
for (const [kind, list] of groups) console.log(`  \x1b[33mwarning\x1b[0m ${list.length > 3 ? `${kind} (${list.length} pages)` : list.join('\n  \x1b[33mwarning\x1b[0m ')}`);
for (const e of errors) console.log(`  \x1b[31merror\x1b[0m   ${e}`);
console.log(`\nChecked ${pages.length} pages: ${errors.length} error${errors.length === 1 ? '' : 's'}, ${warnings.length} warning${warnings.length === 1 ? '' : 's'}.`);
process.exit(errors.length ? 1 : 0);
