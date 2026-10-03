import fs from 'node:fs';
import path from 'node:path';
import { ROOT, DIST, read, site, home, portfolio, faq, sitemap, pageIndex } from './context.mjs';
import { canonicalOf, fill, sizeImages } from './helpers.mjs';
import { videoName, videoUrl } from './media.mjs';
import { telephone, pageExtras } from './schema.mjs';
import { layout, write, linkPendingPages } from './layout.mjs';
import { blocks, industryPath, audiencePath, casePath } from './blocks.mjs';
import { posts } from './posts.mjs';

// ---------------------------------------------------------------------------
// Pages from src/pages, plus sitemap.xml and llms.txt
// ---------------------------------------------------------------------------
// ---- static pages ----
// A page file: the <!-- meta {...} --> line, then the body with {{blocks}} filled in
function readPage(file) {
  const raw = read(path.join('src/pages', file));
  const metaMatch = raw.match(/^<!--\s*meta\s*(\{[\s\S]*?\})\s*-->\n?/);
  if (!metaMatch) throw new Error('Missing <!-- meta {...} --> line in ' + file);
  return { meta: JSON.parse(metaMatch[1]), body: linkPendingPages(fill(raw.slice(metaMatch[0].length), { site, ...blocks })) };
}
// Blocks reused on another page can carry links to homepage sections (the process "Zoom in" goes to #sitrep).
// When the section isn't on this page, the link goes to it on the homepage instead.
const homeIds = new Set([...readPage('index.html').body.matchAll(/\sid="([\w-]+)"/g)].map((m) => m[1]));
const pointAnchorsHome = (body) =>
  body.replace(/href="#([\w-]+)"/g, (m, id) => (body.includes(`id="${id}"`) || !homeIds.has(id) ? m : `href="/#${id}"`));

export function writeStaticPages() {
  for (const file of fs.readdirSync(path.join(ROOT, 'src/pages')).sort()) {
    if (!file.endsWith('.html')) continue;
    const page = readPage(file);
    const meta = page.meta;
    const body = pointAnchorsHome(page.body);
    const name = file.replace(/\.html$/, '');

    if (name === '404') {
      fs.writeFileSync(path.join(DIST, '404.html'), sizeImages(layout({ urlPath: '/404', body, noindex: true, ...meta })));
      continue;
    }
    const urlPath = name === 'index' ? '/' : '/' + name;
    const trail = urlPath === '/' ? undefined : [['Home', '/'], [meta.navTitle || meta.title, urlPath]];
    write(urlPath, layout({ urlPath, body, trail, ...pageExtras[name], ...meta }), { index: !meta.noindex });
    if (!meta.noindex) pageIndex.push({ path: urlPath, title: meta.navTitle || meta.title, description: meta.description });
  }
}

// ---- sitemap.xml ----
export function writeSitemap() {
  fs.writeFileSync(
    path.join(DIST, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemap.map((u) => `  <url><loc>${canonicalOf(u.path)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`).join('\n')}
</urlset>
`
  );
}

// ---- llms.txt: a plain-text briefing for AI assistants and answer engines ----
export function writeLlmsTxt() {
  fs.writeFileSync(
    path.join(DIST, 'llms.txt'),
    `# ${site.name}

> ${site.summary}

- Based in: ${site.city} (works across Arizona, the U.S. and abroad)
- Phone: ${telephone}
- Email: ${site.email}
- Book a 30-minute consult: ${site.url}/contact
- Brand reel ("${site.reel.title}"): ${videoUrl(site.reel)}
- Founders: ${site.team.map((m) => `${m.name} (${m.jobTitle})`).join('; ')}

## Services

${site.services.map((s) => `- ${s}`).join('\n')}

## Industries

${home.industries.map((x) => `- [${x.name}](${canonicalOf(industryPath(x))}): ${x.text} Clients include ${x.clients.join(', ')}.`).join('\n')}

## Who we serve

${home.audiences.map((x) => `- [${x.name}](${canonicalOf(audiencePath(x))}): ${x.text}`).join('\n')}

## Case studies

${home.cases.map((x) => `- [${x.client}: ${x.title}](${canonicalOf(casePath(x))}): ${x.story || x.text}`).join('\n')}

## Pages

${pageIndex.map((p) => `- [${p.title}](${canonicalOf(p.path)}): ${p.description}`).join('\n')}

## Frequently asked questions

${faq.map((f) => `### ${f.q}\n\n${f.a}`).join('\n\n')}

## Selected work

${portfolio.categories.map((c) => `### ${c.name}\n\n${c.videos.map((v) => `- ${videoName(v)}: ${videoUrl(v)}`).join('\n')}`).join('\n\n')}

## Blog

${posts.map((p) => `- [${p.title}](${site.url}/post/${p.slug}) (${p.date}): ${p.excerpt}`).join('\n')}
`
  );
}
