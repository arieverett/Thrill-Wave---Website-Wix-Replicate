// Static site builder for thrillwave.com
// ---------------------------------------------------------------------------
// Plain HTML/CSS/JS output, no framework. Two dependencies: marked (blog markdown)
// and esbuild (minifies CSS/JS). `npm run build` writes the finished site to dist/,
// which Cloudflare Pages serves as-is. `npm run dev` builds with --dev (readable,
// unminified CSS/JS) and reloads the browser on every save.
//
//   src/partials/   shared <head>, header and footer (edit once, applies everywhere)
//   src/pages/      one .html file per page; its first line holds the page's meta
//   src/templates/  blog post and blog list layouts, plus page-starter.html (copy it to start a new page)
//   content/        site settings, portfolio, FAQ (JSON) and blog posts (markdown)
//   public/         copied into dist/ untouched (css, js, images, fonts, _headers, _redirects)
//
// Besides the pages it generates:
//   - JSON-LD structured data on every page (Organization + ProfessionalService with its
//     services, WebSite, WebPage, BreadcrumbList; Blog, BlogPosting and VideoObject where they apply)
//   - sitemap.xml, the blog RSS feed at /blog-feed.xml (the same URL Wix used) and llms.txt
//   - minified, content-hashed CSS/JS filenames, so browsers can cache them for a year
//   - width/height on every local <img>, so nothing shifts while images load
//
// Every Wix URL is kept (/portfolio, /post/<slug>, /blog/categories/<cat>...) so
// search rankings carry over. Cloudflare Pages serves foo.html at /foo.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';
import { transform } from 'esbuild';

const DEV = process.argv.includes('--dev');

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(ROOT, 'dist');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const readJSON = (p) => JSON.parse(read(p));

const site = readJSON('content/site.json');
const portfolio = readJSON('content/portfolio.json');
const faq = readJSON('content/faq.json');
const home = readJSON('content/home.json'); // homepage lists: services, who we serve, industries, process, client logos
const socialIcons = readJSON('content/social-icons.json');
// Social profiles: all of them go into the structured data (sameAs); icons show for the ones not marked "show": false
const shownSocial = site.social.filter((s) => s.show !== false);
const partials = Object.fromEntries(['head', 'header', 'footer'].map((n) => [n, read(`src/partials/${n}.html`)]));

const warnings = [];
const sitemap = []; // { path, lastmod }
const pageIndex = []; // { path, title, description } for llms.txt

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const esc = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const decode = (s = '') =>
  s.replace(/&#39;|&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const slugify = (s) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const fmtDate = (d) =>
  new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const absUrl = (u) => (u.startsWith('/') ? site.url + u : u);
const canonicalOf = (urlPath) => site.url + (urlPath === '/' ? '' : urlPath);
const clip = (text, max) => (text.length <= max ? text : text.slice(0, max - 3).replace(/[\s,;:.-]+\S*$/, '') + '...');
const exists = (publicPath) => fs.existsSync(path.join(ROOT, 'public', publicPath));

// Fill {{key}} and {{site.key}} tokens. Unknown tokens are left in place.
function fill(tpl, vars) {
  return tpl.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, key) => {
    const val = key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), vars);
    return val === undefined ? m : val;
  });
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name === '.DS_Store') continue;
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    entry.isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d);
  }
}

// Read pixel dimensions from PNG, JPEG and WebP headers (no image library needed).
const sizeCache = new Map();
function imageSize(file) {
  if (sizeCache.has(file)) return sizeCache.get(file);
  let size = null;
  try {
    const b = fs.readFileSync(file);
    if (b.toString('ascii', 1, 4) === 'PNG') size = [b.readUInt32BE(16), b.readUInt32BE(20)];
    else if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
      const chunk = b.toString('ascii', 12, 16);
      if (chunk === 'VP8X') size = [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
      else if (chunk === 'VP8L') { const n = b.readUInt32LE(21); size = [1 + (n & 0x3fff), 1 + ((n >> 14) & 0x3fff)]; }
      else if (chunk === 'VP8 ') size = [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
    } else if (b[0] === 0xff && b[1] === 0xd8) {
      for (let i = 2; i < b.length - 8; ) {
        if (b[i] !== 0xff || b[i + 1] === 0xff) { i++; continue; }
        const m = b[i + 1];
        if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) { size = [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)]; break; }
        i += 2 + b.readUInt16BE(i + 2);
      }
    }
  } catch { /* missing file: leave unsized */ }
  sizeCache.set(file, size);
  return size;
}

// Add width/height to every local <img> that doesn't have them (prevents layout shift).
const sizeImages = (html) =>
  html.replace(/<img\b[^>]*>/g, (tag) => {
    if (/loading="lazy"/.test(tag) && !/decoding=/.test(tag)) tag = tag.replace(/<img\b/, '<img decoding="async"');
    if (/\swidth=/.test(tag)) return tag;
    const src = tag.match(/\ssrc="(\/[^"]+)"/)?.[1];
    const size = src && imageSize(path.join(DIST, decodeURI(src)));
    if (!size) return tag;
    return tag.replace(/<img\b/, `<img width="${size[0]}" height="${size[1]}"`);
  });

// Minify with esbuild (skipped in dev so the browser shows readable code).
const minify = async (code, loader) =>
  DEV ? code : (await transform(code, { loader, minify: true, target: ['chrome100', 'edge100', 'firefox100', 'safari15'] })).code;

// Rename dist/css/site.css -> dist/css/site.<hash>.css (same for JS) and return the new URL.
async function fingerprint(rel, loader) {
  const src = path.join(DIST, rel);
  const body = await minify(fs.readFileSync(src, 'utf8'), loader);
  const hash = crypto.createHash('sha256').update(body).digest('hex').slice(0, 10);
  const out = rel.replace(/(\.\w+)$/, `.${hash}$1`);
  fs.writeFileSync(path.join(DIST, out), body);
  fs.rmSync(src);
  return '/' + out;
}

function write(urlPath, html, { index = true, lastmod } = {}) {
  // "/" -> index.html, "/portfolio" -> portfolio.html, "/post/x" -> post/x.html
  const file = urlPath === '/' ? 'index.html' : urlPath.replace(/^\//, '') + '.html';
  const out = path.join(DIST, file);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, sizeImages(html));
  if (index) sitemap.push({ path: urlPath, lastmod });
}

// ---------------------------------------------------------------------------
// Structured data (schema.org JSON-LD)
// ---------------------------------------------------------------------------
const ORG_ID = `${site.url}/#organization`;
const WEBSITE_ID = `${site.url}/#website`;
const BLOG_ID = `${site.url}/blog#blog`;
const personId = (name) => `${site.url}/#${slugify(name)}`;
const telephone = '+1-' + site.phone;
// Google wants dates in structured data with a time and timezone. Content files use plain
// YYYY-MM-DD, so add noon Phoenix time (Arizona is UTC-7 all year, no daylight saving).
const withTz = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T12:00:00-07:00` : d);

const orgNode = {
  '@type': ['Organization', 'ProfessionalService'],
  '@id': ORG_ID,
  name: site.name,
  url: site.url,
  logo: { '@type': 'ImageObject', url: absUrl(site.logo), width: 800, height: 458 },
  image: absUrl(site.ogImage),
  description: site.summary,
  slogan: site.tagline,
  email: site.email,
  telephone,
  address: { '@type': 'PostalAddress', addressLocality: site.region.locality, addressRegion: site.region.region, addressCountry: site.region.country },
  // Kept in step with the Google Business Profile (service area + hours).
  areaServed: [
    ...['Phoenix', 'Scottsdale', 'Tempe', 'Mesa', 'Chandler', 'Gilbert', 'Glendale', 'Peoria', 'Tucson', 'Flagstaff']
      .map((name) => ({ '@type': 'City', name, containedInPlace: { '@type': 'State', name: 'Arizona' } })),
    { '@type': 'AdministrativeArea', name: 'Maricopa County, Arizona' },
    { '@type': 'State', name: 'Arizona' },
    { '@type': 'Country', name: 'United States' },
  ],
  openingHoursSpecification: [
    { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: '09:00', closes: '17:00' },
  ],
  founder: site.team.map((m) => ({ '@type': 'Person', '@id': personId(m.name), name: m.name, jobTitle: m.jobTitle, image: absUrl(m.image), worksFor: { '@id': ORG_ID } })),
  knowsAbout: site.services,
  // The services list from the homepage (content/home.json), so search and answer engines know what we offer
  hasOfferCatalog: {
    '@type': 'OfferCatalog',
    name: 'Video production services',
    itemListElement: home.services.map((x) => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name: x.name, description: x.text, provider: { '@id': ORG_ID }, areaServed: { '@type': 'State', name: 'Arizona' } } })),
  },
  sameAs: site.social.map((s) => s.href),
  contactPoint: { '@type': 'ContactPoint', contactType: 'sales', telephone, email: site.email, areaServed: 'US', availableLanguage: 'English' },
};

const websiteNode = {
  '@type': 'WebSite',
  '@id': WEBSITE_ID,
  url: site.url,
  name: site.name,
  description: site.defaultDescription,
  publisher: { '@id': ORG_ID },
  inLanguage: 'en-US',
};

const breadcrumbNode = (canonical, trail) => ({
  '@type': 'BreadcrumbList',
  '@id': `${canonical}#breadcrumb`,
  itemListElement: trail.map(([name, p], i) => ({ '@type': 'ListItem', position: i + 1, name, item: canonicalOf(p) })),
});

const jsonLd = (nodes) =>
  `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': nodes }).replace(/</g, '\\u003c')}</script>`;

// ---------------------------------------------------------------------------
// Reusable HTML blocks
// ---------------------------------------------------------------------------
const ytThumb = (id, quality = 'hqdefault') => `https://i.ytimg.com/vi/${id}/${quality}.jpg`;
// Film stills for photo tiles: "ID" is the video's own thumbnail, "ID:2" is YouTube's auto-grabbed frame 1, 2 or 3 (1280px).
const still = (ref) => { const [id, n] = ref.split(':'); return ytThumb(id, n ? `maxres${n}` : 'maxresdefault'); };

// "Relentless Beats: Gold Rush 2024 Aftermovie", for aria labels, the lightbox and llms.txt
const videoName = (v) => (v.client ? `${v.client}: ${v.title}` : v.title);
// Public page for a video, on YouTube or Vimeo
const videoUrl = (v) => (v.vimeo ? `https://vimeo.com/${v.vimeo}` : `https://www.youtube.com/watch?v=${v.youtube}`);

// Link attributes that open a video in the lightbox player (public/js/site.js).
// Without JavaScript the link simply goes to the video on YouTube or Vimeo.
const videoAttrs = (v) =>
  `href="${videoUrl(v)}" ` + (v.vimeo ? `data-vimeo="${v.vimeo}"` : `data-youtube="${v.youtube}"`) +
  ` data-title="${esc(videoName(v))}"`;

// A video thumbnail with its title laid over the picture: bold client, then the video name.
// `zoom: true` crops in past letterbox bars baked into a thumbnail; `outline: true` adds a blue
// edge to dark thumbnails that would otherwise blend into a black section.
// YouTube thumbnails come from YouTube (`frame: 1|2|3` picks YouTube's auto still from ~25/50/75% of
// the video instead of the uploaded cover); Vimeo videos need a `thumbnail` URL.
function videoLink(v, { feature = false, hires = false } = {}) {
  const name = esc(videoName(v));
  if (v.vimeo && !v.thumbnail) {
    return `<div class="video video--embed"><iframe src="https://player.vimeo.com/video/${v.vimeo}?dnt=1" title="${name}" loading="lazy" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>`;
  }
  const img = v.vimeo
    ? `<img src="${esc(v.thumbnail)}" alt="" width="1280" height="720" loading="lazy" decoding="async">`
    : hires
    ? `<img src="${ytThumb(v.youtube, v.frame ? `maxres${v.frame}` : 'maxresdefault')}" alt="" width="1280" height="720" loading="lazy" decoding="async">`
    : `<img src="${ytThumb(v.youtube, v.frame ? `hq${v.frame}` : 'hqdefault')}" data-hires="${ytThumb(v.youtube, v.frame ? `maxres${v.frame}` : 'maxresdefault')}" alt="" width="480" height="360" loading="lazy" decoding="async">`;
  // autoplay: true plays the video muted, in place, once the tile is on screen (site.js), and pauses it when scrolled away
  return `<a class="video${feature ? ' video--feature' : ''}${v.zoom ? ' video--zoom' : ''}${v.outline ? ' video--outline' : ''}${v.autoplay ? ' video--autoplay' : ''}" ${videoAttrs(v)}${v.autoplay ? ' data-autoplay' : ''} aria-label="Play video: ${name}">
    ${img}
    <span class="video__play" aria-hidden="true"></span>
    <span class="video__label" aria-hidden="true">${v.client ? `<strong>${esc(v.client)}</strong> ` : ''}${esc(v.title)}</span>
  </a>`;
}

// Edge-to-edge thumbnail grid (home "Our work", SITREP, portfolio)
// portrait: the homepage's 3-across grid of 4:5 tiles (like a social profile grid); it loads YouTube's 1280px
// still straight away, because the 480px one has black bars that would show in a tall crop.
const workGrid = (videos, { single = false, portrait = false, pair = false } = {}) =>
  `<div class="work-grid${single ? ' work-grid--single' : ''}${portrait ? ' work-grid--portrait' : ''}${pair ? ' work-grid--pair' : ''}">
${videos.map((v) => `  <div class="work-tile">${videoLink(v, { hires: portrait })}</div>`).join('\n')}
</div>`;

const vimeoEmbed = (id, title) =>
  `<div class="embed-16x9"><iframe src="https://player.vimeo.com/video/${id}?dnt=1" title="${esc(title)}" loading="lazy" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>`;

const postCard = (p, level = 3) => `<article class="post-card">
  <a href="/post/${p.slug}">
    <div class="post-card__media"><img src="${p.card}" alt="" loading="lazy" decoding="async"></div>
    <div class="post-card__body">
      <p class="post-card__meta"><time datetime="${p.date}">${fmtDate(p.date)}</time> <span aria-hidden="true">&middot;</span> ${p.minutes} min read</p>
      <h${level}>${esc(p.title)}</h${level}>
      <p>${esc(p.excerpt)}</p>
    </div>
  </a>
</article>`;

// ---------------------------------------------------------------------------
// Page layout
// ---------------------------------------------------------------------------
// Links to pages (or page sections) that aren't built yet:
//   <a href="/services" data-until-built="#what-we-do">      until src/pages/services.html exists
//   <a href="/about#values" data-until-built="/about">       until about.html has a section with id="values"
// Until then the link points at the fallback (so there's never a broken link); once the page or section
// is added, the same link goes to it. The attribute itself is dropped from the output. Menu items in
// content/site.json do the same with "until".
const builtHref = (href, until) => {
  const m = until && href.match(/^\/([\w-]+)(?:#([\w-]+))?$/);
  if (!m) return href;
  const file = path.join(ROOT, 'src/pages', m[1] + '.html');
  const ready = fs.existsSync(file) && (!m[2] || fs.readFileSync(file, 'utf8').includes(`id="${m[2]}"`));
  return ready ? href : until;
};
const linkPendingPages = (html) =>
  html.replace(/href="(\/[\w-]+(?:#[\w-]+)?)" data-until-built="([^"]+)"/g, (m, href, fallback) => `href="${builtHref(href, fallback)}"`);

const assets = {}; // filled in once public/ is copied and fingerprinted

// "page" on the exact page; "true" inside its section (a blog post highlights Blog).
const navState = (href, urlPath) => {
  if (href === urlPath) return ' aria-current="page"';
  if (href === '/blog' && /^\/(post|blog)\//.test(urlPath)) return ' aria-current="true"';
  return '';
};

// Main menu (content/site.json > nav). An item with "children" is a group: its name is a button that opens the
// dropdown (hover works too on laptops; on phones it expands inside the menu drawer, site.js). A group's name
// isn't a link; it's shown in white when the page you're on is inside it.
const chevron = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
function navMenu(urlPath) {
  for (const n of [...site.nav, ...site.nav.flatMap((x) => x.children || [])]) {
    if (n.href?.includes('#')) throw new Error(`Menu link "${n.label}" (${n.href}) points to a spot on a page; menu links must open pages at the top`);
  }
  return site.nav.map((n) => {
    if (!n.children) {
      const href = builtHref(n.href, n.until);
      return `<li><a href="${href}"${navState(href, urlPath)}>${esc(n.label)}</a></li>`;
    }
    const kids = n.children.map((c) => ({ ...c, href: builtHref(c.href, c.until) }));
    // Pages under a menu page (/industries/beauty under /industries) count as inside it
    const inside = (c) => c.href === urlPath || urlPath.startsWith(c.href + '/');
    const here = kids.some(inside);
    const id = `nav-${slugify(n.label)}`;
    // The group's name only opens its dropdown; the pages are the links inside it
    return `<li class="has-sub${here ? ' is-here' : ''}">`
      + `<button class="site-nav__toggle site-nav__group" type="button" aria-expanded="false" aria-controls="${id}">${esc(n.label)}${chevron}</button>`
      + `<ul class="site-nav__sub" id="${id}">${kids.map((c) => `<li><a href="${c.href}"${c.href === urlPath ? ' aria-current="page"' : inside(c) ? ' aria-current="true"' : ''}>${esc(c.label)}</a></li>`).join('')}</ul></li>`;
  }).join('');
}

function layout({
  urlPath, title, fullTitle, description, ogImage, ogImageAlt, ogType = 'website', body, bodyClass = '',
  noindex = false, pageType = 'WebPage', pageProps = {}, trail, nodes = [], articleMeta = '',
}) {
  const canonical = canonicalOf(urlPath);
  const desc = description || site.defaultDescription;
  const pageTitle = fullTitle || `${title} | ${site.name}`;
  if (!noindex && desc.length > 160) warnings.push(`${urlPath}: meta description is ${desc.length} chars (aim for 160 or less)`);

  const image = absUrl(ogImage || site.ogImage);
  const imageFile = path.join(DIST, (ogImage || site.ogImage).replace(/^\//, ''));
  const imageSizeTag = imageSize(imageFile);

  const graph = [orgNode, websiteNode];
  if (!noindex) {
    graph.push({
      '@type': pageType,
      '@id': `${canonical}#webpage`,
      url: canonical,
      name: pageTitle,
      description: desc,
      isPartOf: { '@id': WEBSITE_ID },
      primaryImageOfPage: { '@type': 'ImageObject', url: image },
      inLanguage: 'en-US',
      ...(trail ? { breadcrumb: { '@id': `${canonical}#breadcrumb` } } : {}),
      ...pageProps,
    });
    if (trail) graph.push(breadcrumbNode(canonical, trail));
    graph.push(...nodes);
  }

  const vars = {
    site,
    fullTitle: esc(pageTitle),
    description: esc(desc),
    canonical,
    robots: noindex ? '<meta name="robots" content="noindex">' : '<meta name="robots" content="index, follow, max-image-preview:large">',
    ogType,
    ogImage: image,
    ogImageMeta: [
      imageSizeTag ? `<meta property="og:image:width" content="${imageSizeTag[0]}">\n<meta property="og:image:height" content="${imageSizeTag[1]}">` : '',
      `<meta property="og:image:alt" content="${esc(ogImageAlt || site.ogImageAlt || site.name + ' logo')}">`,
    ].filter(Boolean).join('\n'),
    articleMeta,
    preconnect: ['i.ytimg.com', 'i.vimeocdn.com'].filter((host) => body.includes(host)).map((host) => `<link rel="preconnect" href="https://${host}">`).join('\n'),
    css: assets.css,
    js: assets.js,
    jsonld: jsonLd(graph),
    nav: navMenu(urlPath),
    social: shownSocial
      .map((s) => `<li><a href="${s.href}" target="_blank" rel="noopener" aria-label="${s.label}"><svg viewBox="0 0 24 24" aria-hidden="true">${socialIcons[s.label] || ''}</svg></a></li>`)
      .join(''),
    year: new Date().getFullYear(),
  };

  // Notes left in HTML comments (page sources, partials, blog posts) are for us, not for visitors
  return `<!doctype html>
<html lang="en">
<head>
${fill(partials.head, vars).trim()}
</head>
<body${bodyClass ? ` class="${bodyClass}"` : ''}>
${fill(partials.header, vars).trim()}
<main id="main">
${body.trim()}
</main>
${fill(partials.footer, vars).trim()}
</body>
</html>
`.replace(/<!--[\s\S]*?-->\n?/g, '');
}

// ---------------------------------------------------------------------------
// Blog posts (content/posts/*.md)
// ---------------------------------------------------------------------------
// "crew-on-set-with-clapperboard.webp" -> "Crew on set with clapperboard"
const altFromFile = (src) => {
  const words = path.basename(src).replace(/\.\w+$/, '').replace(/-card$/, '').replace(/-/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};

marked.use({
  renderer: {
    image({ href, text }) {
      const webp = href.replace(/\.(jpe?g|png)$/i, '.webp');
      const src = href.startsWith('/') && webp !== href && exists(webp) ? webp : href;
      return `<img src="${src}" alt="${esc(text || altFromFile(href))}" loading="lazy">`;
    },
    link({ href, title, tokens }) {
      const label = this.parser.parseInline(tokens);
      const external = /^https?:\/\//.test(href) && !href.startsWith(site.url);
      return `<a href="${esc(href)}"${title ? ` title="${esc(title)}"` : ''}${external ? ' target="_blank" rel="noopener"' : ''}>${label}</a>`;
    },
  },
});

function parsePost(file) {
  const raw = read(path.join('content/posts', file));
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error('Missing front matter in ' + file);
  const meta = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (!kv || /^\s*#/.test(line)) continue;
    let [, k, v] = kv;
    v = v.trim();
    meta[k] = v.startsWith('[') ? v.slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean) : v.replace(/^"(.*)"$/, '$1');
  }
  const slug = file.replace(/\.md$/, '');
  const md = m[2].replace(/\{\{youtube:([\w-]+)\}\}/g, (_, id) => workGrid([{ youtube: id, client: 'Thrill Wave', title: 'Reel' }], { single: true }));
  const html = marked.parse(md);
  const plain = (s) => decode(s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
  const text = plain(html);
  const words = text.split(' ').length;
  // Excerpts come from the body copy only, so they don't start with "Introduction"
  const summary = plain(html.replace(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/g, ' '));
  const cover = meta.cover_image;
  const webp = cover.replace(/\.jpe?g$/, '.webp');
  const card = cover.replace(/\.jpe?g$/, '-card.webp');
  return {
    ...meta,
    categories: meta.categories || [],
    slug,
    html,
    words,
    minutes: Math.max(1, Math.round(words / 230)),
    excerpt: clip(summary, 140),
    description: clip(summary, 158),
    coverDisplay: exists(webp) ? webp : cover,
    card: exists(card) ? card : cover,
    coverAlt: altFromFile(cover),
  };
}

const posts = fs
  .readdirSync(path.join(ROOT, 'content/posts'))
  .filter((f) => f.endsWith('.md'))
  .map(parsePost)
  .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.title.localeCompare(b.title)));

// Related posts: most shared categories first, then the closest in date.
function relatedTo(post, n = 3) {
  return posts
    .filter((q) => q !== post)
    .map((q) => ({
      q,
      score: q.categories.filter((c) => post.categories.includes(c)).length * 1e12 - Math.abs(new Date(q.date) - new Date(post.date)),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map((r) => r.q);
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------
fs.rmSync(DIST, { recursive: true, force: true });
copyDir(path.join(ROOT, 'public'), DIST);
assets.css = await fingerprint('css/site.css', 'css');
assets.js = await fingerprint('js/site.js', 'js');

// ---- blocks available to src/pages as {{name}} ----
// ---- line icons (24px grid, drawn with currentColor) ----
const ICONS = {
  compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3"/>',
  camera: '<rect x="2.5" y="7" width="13" height="10" rx="2"/><path d="M15.5 10.5l6-3v9l-6-3z"/>',
  sliders: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  aperture: '<circle cx="12" cy="12" r="9"/><path d="M12 3l3 7M21 12l-7 2M16 20l-4-6M5 18l5-6M4 8l7 2M12 3L9 10"/>',
  sparkle: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M18.5 16l.6 1.9 1.9.6-1.9.6-.6 1.9-.6-1.9-1.9-.6 1.9-.6z"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  heart: '<path d="M12 20s-7-4.4-9-8.6C1.6 8.4 3.5 5 6.8 5c2 0 3.4 1.1 5.2 3 1.8-1.9 3.2-3 5.2-3 3.3 0 5.2 3.4 3.8 6.4C19 15.6 12 20 12 20z"/>',
  building: '<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M10 21v-3h4v3"/>',
  clapper: '<rect x="3" y="10" width="18" height="11" rx="1.5"/><path d="M3 10l1.3-5.2 16.2 2.9L20 10M8.4 5.6L9.8 10M13.6 6.5L15 10"/>',
  bulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.9V16h5v-.2c0-.8.4-1.5 1-1.9A6 6 0 0 0 12 3z"/>',
  chat: '<path d="M4 5h16v11H9.5L4 20z"/><path d="M8 9.5h8M8 12.5h5"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.7 2.7L16 9.8"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  photo: '<rect x="3" y="6.5" width="18" height="13" rx="2"/><path d="M8.5 6.5L10 4h4l1.5 2.5"/><circle cx="12" cy="13" r="3.5"/>',
  wave: '<path d="M3 12h2M7 8v8M11 5v14M15 9v6M19 7v10M21 12h0"/>',
  broadcast: '<circle cx="12" cy="12" r="1.6"/><path d="M8.5 15.5a5 5 0 0 1 0-7M15.5 8.5a5 5 0 0 1 0 7M5.6 18.4a9 9 0 0 1 0-12.8M18.4 5.6a9 9 0 0 1 0 12.8"/>',
  radar: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 12l6.4-6.4"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>',
  // Industries (homepage)
  pulse: '<path d="M3 12h4l2.5-6 5 12 2.5-6h4"/>',
  landmark: '<path d="M3 9l9-5 9 5z"/><path d="M5.5 9v9M10 9v9M14 9v9M18.5 9v9M3 20.5h18"/>',
  trophy: '<path d="M7 4h10v4.5a5 5 0 0 1-10 0z"/><path d="M7 6H4.5a2.8 2.8 0 0 0 3.1 3.9M17 6h2.5a2.8 2.8 0 0 1-3.1 3.9M12 13.5V17"/><rect x="8.5" y="17" width="7" height="3.5" rx=".8"/>',
  music: '<path d="M9 18V5.5l11-2V16"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  chart: '<path d="M4 20h16"/><path d="M5 16l4.5-5 3.5 3 6-7.5"/><path d="M15 6.5h4v4"/>',
  chip: '<rect x="7" y="7" width="10" height="10" rx="1.5"/><path d="M10 7V4M14 7V4M10 20v-3M14 20v-3M7 10H4M7 14H4M20 10h-3M20 14h-3"/>',
  hardhat: '<path d="M5 16a7 7 0 0 1 14 0"/><path d="M10 9.5V6h4v3.5"/><rect x="3" y="16" width="18" height="3.5" rx="1"/>',
  bag: '<path d="M5 8h14l-1.2 12H6.2z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>',
  house: '<path d="M4 11l8-7 8 7"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-5h4v5"/>',
  glass: '<path d="M8 3h8l-.4 5.2a3.6 3.6 0 0 1-7.2 0z"/><path d="M12 11.8V20M8.5 20h7"/>',
};
const icon = (name) =>
  `<svg class="icon" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
const pad2 = (n) => String(n).padStart(2, '0');
// One section per customer type or industry, laid out like the case studies (Our customers, Industries)
const POINT_LABELS = ['Who it\'s for', 'How they use us', 'What for'];
// `pathOf` gives each entry's own page; `more` is the button text that links to it
function detailSections(list, pathOf, more) {
  return list.map((x, i) => {
    const dark = i % 2 === 0;
    const ref = typeof x.example === 'string' ? findVideo(x.example) : x.example;
    const film = ref && videoLink({ ...ref, zoom: x.zoom && x.zoom !== 'vertical' }, { feature: true, hires: true });
    return `<section class="section${dark ? ' section--dark' : ''} case-study" id="${slugify(x.name)}">
  <div class="container">
    <p class="kicker">${esc(x.name)}</p>
    <h2 class="section__title">${esc(x.title || x.name)}</h2>
    <div class="case-study__grid">
      <div class="case-study__film">${film || ''}</div>
      <div class="case-study__text"><p>${esc(x.more || x.text)}</p></div>
    </div>
    <ol class="detail-points">${(x.points || []).map((pt, k) => `<li><span class="detail-points__num">${pad2(k + 1)}</span><h3>${POINT_LABELS[k]}</h3><p>${esc(pt)}</p></li>`).join('')}</ol>
    ${pathOf ? `<div class="section__actions btn-row"><a class="btn btn--plain btn--pill ${dark ? 'btn--clear' : 'btn--clear-dark'}" href="${pathOf(x)}">${esc(more(x))}</a></div>` : ''}
  </div>
</section>`;
  }).join('\n\n');
}
// A portfolio video by its YouTube ID (for example films named in content/home.json)
const findVideo = (id) => [...portfolio.featured, ...portfolio.categories.flatMap((c) => c.videos)].find((v) => v.youtube === id);

// ---- the breakout pages' addresses (built further down, see "Breakout pages") ----
// /industries/medical-and-biotech, /who-we-serve/agencies, /case-studies/dear-mom. A customer type can share
// another page instead (`page` in content/home.json: Nonprofits uses the Nonprofits industry page).
const industryPath = (x) => `/industries/${slugify(x.name)}`;
const audiencePath = (x) => x.page || `/who-we-serve/${slugify(x.name)}`;
const casePath = (x) => `/case-studies/${slugify(x.title)}`;
const industryNamed = (name) => {
  const x = home.industries.find((i) => i.name === name);
  if (!x) throw new Error(`content/home.json names an industry that doesn't exist: "${name}"`);
  return x;
};
// A film in a `work` list: a YouTube ID from content/portfolio.json, or a full video ({ youtube | vimeo, client, title... })
const workVideo = (ref) => {
  const v = typeof ref === 'string' ? findVideo(ref) : ref;
  if (!v) throw new Error(`content/home.json lists a video that isn't in content/portfolio.json: ${ref}`);
  return v;
};
// Vertical looping clip beside the text in a two-column band (01 Who we are, the closing Start a project block)
const sideVideo = site.sideVideo?.vimeo
  ? `<div class="split-media__clip" aria-hidden="true"><div class="split-media__video"><div class="bg-video bg-video--vertical" data-vimeo-bg="${site.sideVideo.vimeo}" data-title="${esc(site.sideVideo.title)}"><img class="bg-video__poster" src="${site.sideVideo.poster}" width="1280" height="2276" alt="" loading="lazy" decoding="async"></div></div></div>`
  : '';

// Industry tiles (homepage, Industries, customer pages): darkened film still, name and a few client names;
// the heading link covers the whole tile and opens the industry's page
const industryCards = (list) => `<ul class="industry-cards">
${list.map((x) => `  <li>
    <div class="industry-cards__media${x.zoom ? (x.zoom === 'vertical' ? ' is-zoom is-vertical' : ' is-zoom') : ''}"><img src="${still(x.still)}" alt="" width="1280" height="720" loading="lazy" decoding="async"></div>
    <svg class="industry-cards__go" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8"/></svg>
    <h3><a href="${industryPath(x)}">${esc(x.name)}</a></h3>
    <p class="industry-cards__clients">${x.clients.map(esc).join('&nbsp;&middot; ')}</p>
  </li>`).join('\n')}
</ul>`;
// Sourced stat boxes for a case study (value, label, source)
const statsList = (stats, dark) => (stats?.length
  ? `<ul class="stats stats--3${dark ? '' : ' stats--light'}">${stats.map((st) => `<li><strong>${esc(st.value)}</strong><span>${esc(st.label)}</span>${st.source ? `<small>Source: ${esc(st.source)}</small>` : ''}</li>`).join('')}</ul>`
  : '');

const blocks = {
  portfolio_featured: workGrid(portfolio.featured, { portrait: true }),
  portfolio_intro: esc(portfolio.intro),
  // Contact page: round social icons (same list as the footer, from content/site.json)
  social_icons: `<ul class="social">${shownSocial.map((x) => `<li><a href="${x.href}" target="_blank" rel="noopener" aria-label="${esc(x.label)}"><svg viewBox="0 0 24 24" aria-hidden="true">${socialIcons[x.label] || ''}</svg></a></li>`).join('')}</ul>`,
  // Portfolio: one line pointing to the social accounts in content/site.json
  follow_line: (() => {
    const icons = shownSocial.map((x) => `<a class="inline-social" href="${x.href}" rel="noopener" target="_blank" aria-label="${esc(x.label)}"><svg viewBox="0 0 24 24" aria-hidden="true">${socialIcons[x.label] || ''}</svg></a>`).join('');
    return `For behind the scenes, new releases and the work between the big ones, keep up with us on: <span class="inline-social-row">${icons}</span>`;
  })(),
  portfolio_nav: `<nav class="chip-nav" aria-labelledby="chip-nav-label">
  <div class="container">
    <p class="chip-nav__label" id="chip-nav-label">Select category:</p>
    <ul>${portfolio.categories.map((c) => `<li><a href="#${c.slug}">${esc(c.short || c.name)}</a></li>`).join('')}</ul>
  </div>
</nav>`,
  portfolio_categories: portfolio.categories
    .map((c) => `<section class="portfolio-cat" id="${c.slug}" aria-labelledby="${c.slug}-title">
  <div class="container"><h2 class="portfolio-cat__title" id="${c.slug}-title">${esc(c.name)}</h2></div>
  ${workGrid(c.videos)}
</section>`)
    .join('\n'),
  // Home reel ("What we do" + the hero's "Watch our reel" button), set in content/site.json
  // The reel starts playing (muted, with controls) when it scrolls into view; see public/js/site.js.
  reel_embed: `<div class="reel reel--inline"${site.reel.vimeo ? ` data-vimeo-inline="${site.reel.vimeo}"` : ''}>${videoLink({ client: 'Thrill Wave', ...site.reel }, { feature: true })}</div>`,
  // ---- homepage lists, from content/home.json ----
  services_list: `<ol class="service-list">
${home.services.map((x, i) => `  <li><span class="service-list__num">${pad2(i + 1)}</span><span class="service-list__icon">${icon(x.icon)}</span><h3>${esc(x.name)}</h3><p>${esc(x.text)}</p></li>`).join('\n')}
</ol>`,
  // ---- fuller versions of the homepage lists, for the Services, Our customers and Process pages ----
  // Services page: same rows as the homepage list, with a longer line and what each service includes
  services_full: `<ol class="service-list service-list--full">
${home.services.map((x, i) => `  <li><span class="service-list__num">${pad2(i + 1)}</span><span class="service-list__icon">${icon(x.icon)}</span><h3>${esc(x.name)}</h3><p>${esc(x.more || x.text)}${x.includes ? `<span class="service-list__includes">${esc(x.includes)}</span>` : ''}</p></li>`).join('\n')}
</ol>`,
  // Our customers and Industries pages: one section per entry (content/home.json > audiences / industries),
  // with an example film beside the intro and three numbered points: who it's for, how they use us, what for
  // Each section ends with a button to that entry's own page
  customer_sections: detailSections(home.audiences, audiencePath, (x) => `More for ${x.name.toLowerCase()}`),
  industry_sections: detailSections(home.industries, industryPath, (x) => `See ${x.name} work`),
  // Process page: each step in a numbered row with what happens in it
  process_detail: `<ol class="promise-list process-detail">
${home.process.map((x, i) => `  <li><span class="promise-list__num">${pad2(i + 1)}</span><h4>${esc(x.name)}</h4><p>${esc(x.more || x.text)}</p></li>`).join('\n')}
</ol>`,
  // Case studies page: one section per case (content/home.json > cases): the film, the story, three sourced numbers
  case_study_sections: home.cases.map((x, i) => {
    const dark = i % 2 === 0;
    const film = x.video && videoLink({ client: x.client, title: x.title, ...x.video }, { feature: true, hires: true });
    return `<section class="section${dark ? ' section--dark' : ''} case-study" id="${slugify(x.title)}">
  <div class="container">
    <p class="kicker">${esc(x.client)}</p>
    <h2 class="section__title">${esc(x.title)}</h2>
    <div class="case-study__grid">
      <div class="case-study__film">${film || ''}</div>
      <div class="case-study__text"><p class="case-study__goal">Goal: ${esc(x.goal)}</p><p>${esc(x.story || x.text)}</p></div>
    </div>
    ${statsList(x.stats, dark)}
    <div class="section__actions btn-row"><a class="btn btn--plain btn--pill ${dark ? 'btn--clear' : 'btn--clear-dark'}" href="${casePath(x)}">Read the case study</a></div>
  </div>
</section>`;
  }).join('\n\n'),
  // FAQ page: every question in content/faq.json (also used for the FAQ structured data and llms.txt)
  faq_list: `<div class="faq">
${faq.map((f) => `  <div class="faq__item"><h2>${esc(f.q)}</h2><p>${esc(f.a)}</p></div>`).join('\n')}
</div>`,
  // A card that sends people to the FAQ page (Services and Process), like Sandwich's
  faq_card: `<a class="faq-card" href="/faq"><span class="faq-card__q">&ldquo;${esc(faq[0].q)}&rdquo;</span><span class="faq-card__more">See all FAQs <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6"/></svg></span></a>`,
  // Who we serve: six cards, a film still on top and the name and one sentence below, like the team cards
  // Each card links to that customer type's page
  audience_grid: `<ul class="audience-cards is-linked">
${home.audiences.map((x) => `  <li>
    <div class="audience-cards__photo${x.zoom ? ' is-zoom' : ''}${x.focus ? ` focus-${x.focus}` : ''}"><img src="${still(x.still)}" alt="" width="1280" height="720" loading="lazy" decoding="async"></div>
    <div class="audience-cards__body"><h3><a href="${audiencePath(x)}">${esc(x.name)}</a></h3><p>${esc(x.text)}</p></div>
  </li>`).join('\n')}
</ul>`,
  // Industries: square tiles on a darkened film still, short name and a few client names.
  // The heading link covers the whole tile and goes to the industry's own page.
  industry_grid: industryCards(home.industries),
  // SITREP steps (homepage and SITREP page): three tiles, each with a little black screen running the terminal site's animation in red
  sitrep_steps: `<ol class="sitrep-steps">
  <li><div class="sitrep-steps__screen" aria-hidden="true"><span class="sitrep-steps__num">01</span><span class="sitrep-glyphs sitrep-glyphs--ingest"><svg viewBox="0 0 24 24"><path d="M3 6h18l-9 14z"/></svg><svg viewBox="0 0 24 24"><path d="M3 6h18l-9 14z"/></svg><svg viewBox="0 0 24 24"><path d="M3 6h18l-9 14z"/></svg></span></div><h4>Ingest</h4><p>We pull in everything about your audience, market and message.</p></li>
  <li><div class="sitrep-steps__screen" aria-hidden="true"><span class="sitrep-steps__num">02</span><span class="sitrep-glyphs sitrep-glyphs--synth"><svg viewBox="0 0 24 24"><path d="M12 2.5 21.5 12 12 21.5 2.5 12z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/></svg><svg viewBox="0 0 24 24"><path d="M12 2.5 21.5 12 12 21.5 2.5 12z"/></svg><svg viewBox="0 0 24 24"><path d="M12 2.5 21.5 12 12 21.5 2.5 12z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/></svg></span></div><h4>Synthesize</h4><p>We find the trust gaps and the story your competitors missed.</p></li>
  <li><div class="sitrep-steps__screen" aria-hidden="true"><span class="sitrep-steps__num">03</span><span class="sitrep-glyphs sitrep-glyphs--exec"><svg viewBox="0 0 24 24"><path d="M13.5 2 4 13.5h6.5L9.5 22 20 9.5h-6.5z"/></svg><svg viewBox="0 0 24 24"><path d="M13.5 2 4 13.5h6.5L9.5 22 20 9.5h-6.5z"/></svg><svg viewBox="0 0 24 24"><path d="M13.5 2 4 13.5h6.5L9.5 22 20 9.5h-6.5z"/></svg></span></div><h4>Execute</h4><p>We film it with real people and plan where it will run.</p></li>
</ol>`,
  // Case studies: numbered list; the open one shows its photo, goal, one sentence and a link (site.js switches them)
  case_studies: `<ol class="cases">
${home.cases.map((x, i) => `  <li${i === 0 ? ' class="is-open"' : ''}>
    <button class="cases__tab" type="button" aria-expanded="${i === 0}" aria-controls="case-${i + 1}"><span class="cases__num">${pad2(i + 1)}</span><span><span class="cases__client">${esc(x.client)}</span><span class="cases__title">${esc(x.title)}</span></span><svg class="cases__chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button>
    <div class="cases__panel${x.zoom ? ' is-zoom' : ''}" id="case-${i + 1}"><img src="${x.image || still(x.still)}" alt="${esc(`Still from ${x.client}: ${x.title}, a Thrill Wave film`)}" width="1280" height="720" loading="lazy" decoding="async"><div class="cases__caption"><p class="cases__goal">${esc(x.goal)}</p><p>${esc(x.text)}</p><a class="cases__link" href="${x.link}">See the work <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6"/></svg></a></div></div>
  </li>`).join('\n')}
</ol>`,
  process_steps: `<ol class="process">
${home.process.map((x, i) => `  <li${x.link ? ' class="process__key"' : ''}><span class="process__node">${icon(x.icon)}</span><span class="process__num">${pad2(i + 1)}</span><h3>${esc(x.name)}</h3><p>${esc(x.text)}</p>${x.link ? `<a class="process__zoom" href="${x.link}">Zoom in <span aria-hidden="true">&darr;</span></a>` : ''}</li>`).join('\n')}
</ol>`,
  client_marquee: (() => {
    const items = (hidden) => home.clients.map((c) => `<li><img src="${c.logo}" alt="${hidden ? '' : esc(c.name)}" loading="lazy" decoding="async"></li>`).join('');
    return `<div class="marquee"><ul class="marquee__track">${items(false)}</ul><ul class="marquee__track" aria-hidden="true">${items(true)}</ul></div>`;
  })(),
  // Intel: newest post as a tall 9:16 card, the next two as small squares under it (titles only)
  intel_posts: `<div class="intel__posts">
${posts.slice(0, 3).map((p, i) => `  <a class="intel-card${i === 0 ? ' intel-card--tall' : ''}" href="/post/${p.slug}">
    <div class="intel-card__media"><img src="${i === 0 ? p.coverDisplay : p.card}" alt="" loading="lazy" decoding="async"></div>
    <div class="intel-card__body"><p class="intel-card__meta"><time datetime="${p.date}">${fmtDate(p.date)}</time> &middot; ${p.minutes} min</p><h3>${esc(p.title)}</h3></div>
  </a>`).join('\n')}
</div>`,
  reel_link: videoAttrs({ client: 'Thrill Wave', ...site.reel }),
  // Muted, looping header video on Home and SITREP (content/site.json > headerVideo). The poster is
  // the video's Vimeo thumbnail; it shows first, and public/js/site.js fades the Vimeo player in over it
  // after the page loads (skipped for reduced-motion and data-saver visitors). Needs a paid Vimeo plan.
  header_video: site.headerVideo?.vimeo
    ? `<div class="bg-video" data-vimeo-bg="${site.headerVideo.vimeo}" data-title="${esc(site.headerVideo.title)}"><img class="bg-video__poster" src="${site.headerVideo.poster}" width="1920" height="1080" alt="" fetchpriority="high"></div>`
    : '',
  // Vertical looping clip beside the text in 01 Who we are and the closing block (content/site.json > sideVideo).
  // It starts once it scrolls near the screen (site.js); until then the poster shows.
  side_video: sideVideo,
  // SITREP page: the dashboard loop under the hero (content/site.json > sitrepLoop), muted and looping like the header video
  sitrep_loop: site.sitrepLoop?.vimeo
    ? `<div class="loop-panel"><div class="bg-video" data-vimeo-bg="${site.sitrepLoop.vimeo}" data-title="${esc(site.sitrepLoop.title)}"><img class="bg-video__poster" src="${site.sitrepLoop.poster}" width="1280" height="720" alt="" loading="lazy" decoding="async"></div></div>`
    : '',
  itca_embed: site.itcaVimeoId
    ? vimeoEmbed(site.itcaVimeoId, 'ITCA campaign')
    : workGrid([{ client: 'ITCA WIC', title: 'Dear Mom', youtube: 'QlP7wPaFcVU', zoom: true, autoplay: true }], { single: true }),
  // SITREP page: Tony's TEC case-study breakdown (Vimeo) and two more ITCA pieces under "Dear Mom"
  tec_case_study: workGrid([{ client: 'ITCA TEC', title: 'Case Study Using SITREP', autoplay: true, vimeo: '1175739079', thumbnail: 'https://i.vimeocdn.com/video/2206610840-ab9c7452ada6128dda809c82750fb931c920b1da79ebba045b626a540217cd86-d_1280x720' }], { single: true }),
  sitrep_demo: workGrid([{ client: 'Thrill Wave', title: 'SITREP Demo', outline: true, autoplay: true, vimeo: '1195773700', thumbnail: 'https://i.vimeocdn.com/video/2206611238-36b31d4267e033d1faea571b53afef1fc733e3ba65f040361b1ce4271ea9746e-d_1280x720' }], { single: true }),
  itca_more: workGrid([
    { client: 'ITCA Native Vote', title: 'Your Voice, Your Power: Full Episode', youtube: 'Gh67yEMyOCs', frame: 3, zoom: true },
    { client: 'ITCA WIC', title: 'Welcome to WIC', youtube: 'zLy49zenWIM' },
  ], { pair: true }),
  team: `<ul class="team">
${site.team.map((m) => `  <li>
    <img src="${m.image}" alt="${esc(`${m.name} of Thrill Wave`)}" loading="lazy" decoding="async">
    <div class="team__body"><h3>${esc(m.name)}</h3><p>${esc(m.role)}</p></div>
  </li>`).join('\n')}
</ul>`,
  // About page: founder cards with photo, handle-style tag and bio (content/site.json > team)
  team_roster: `<ul class="roster">
${site.team.map((m) => `  <li>
    <div class="roster__photo"><img src="${m.image}" alt="${esc(`${m.name} of Thrill Wave`)}" loading="lazy" decoding="async"></div>
    <div class="roster__body">
      <h3>${esc(m.name)}</h3>
      <p class="roster__role">${esc(m.position || m.role)}</p>
      <p>${esc(m.bio || '')}</p>
    </div>
  </li>`).join('\n')}
</ul>`,
  // Standard page ending (every page but Contact): black band, one button to the contact form
  start_project: `<section class="cta cta--dark cta--ender has-side-video">
  <div class="container split-media">
    <div class="split-media__text">
      <p class="kicker">Start a project</p>
      <h2 class="section__title">We'd love to hear your story.</h2>
      <p>Tell us what you're working on. Wherever you're starting from, we'll help you find the best way to tell it.</p>
      <a class="btn btn--plain btn--pill btn--red" href="/contact#start">Start a project</a>
    </div>
    ${sideVideo}
  </div>
</section>`,
  calendly_embed: site.calendlyUrl
    ? `<div class="booking">
  <div class="booking__details">
    <img src="${site.logoSmall}" alt="" width="84" height="48">
    <p class="booking__host">Chris Kuzman</p>
    <h3 class="booking__title">30 Minute Video Consult</h3>
    <ul class="booking__meta">
      <li><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>30 min</li>
      <li><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3z"/></svg>Web conferencing details provided upon confirmation.</li>
    </ul>
    <p>This is a 30-minute call to see how Thrill Wave can help you with your next project!</p>
  </div>
  <iframe class="booking__calendar" src="${site.calendlyUrl}?embed_type=Inline&amp;hide_landing_page_details=1&amp;hide_event_type_details=1&amp;hide_gdpr_banner=1&amp;embed_domain=${new URL(site.url).hostname}" title="Pick a time for a 30-minute video consult" loading="lazy"></iframe>
</div>`
    : `<p class="center"><a class="btn" href="mailto:${site.email}?subject=30%20minute%20video%20consult">Book a 30-minute consult</a></p>`,
  // Contact map: the Phoenix metro, outlined by Google's Maricopa County boundary (Google has no "metro area" outline)
  map_embed: `<iframe class="map" src="https://maps.google.com/maps?q=${encodeURIComponent(site.mapQuery)}&amp;z=8&amp;output=embed" title="Map: the Phoenix metro area, where Thrill Wave is based" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>`,
};

// ---- videos in the structured data (VideoObject) ----
// Real upload dates and lengths from YouTube, kept in content/video-meta.json. Never shown on the page;
// search and answer engines use them to list the films (and can show them as video results).
const videoMeta = readJSON('content/video-meta.json');
const uniqueVideos = [...new Map([...portfolio.featured, ...portfolio.categories.flatMap((c) => c.videos)].map((v) => [v.youtube || v.vimeo, v])).values()];
const isoDuration = (sec) => `PT${sec >= 60 ? `${Math.floor(sec / 60)}M` : ''}${sec % 60}S`;
const videoNode = (v) => {
  const meta = v.youtube && videoMeta[v.youtube];
  if (!meta) return null;
  return {
    '@type': 'VideoObject',
    '@id': `${site.url}/#video-${v.youtube}`,
    name: videoName(v),
    description: `${videoName(v)}, a film by ${site.name}, a video production company in Phoenix, Arizona.`,
    thumbnailUrl: ytThumb(v.youtube),
    uploadDate: withTz(meta.uploadDate),
    duration: isoDuration(meta.seconds),
    embedUrl: `https://www.youtube.com/embed/${v.youtube}`,
    publisher: { '@id': ORG_ID },
    inLanguage: 'en-US',
  };
};
for (const v of uniqueVideos) if (v.youtube && !videoMeta[v.youtube]) warnings.push(`video ${videoName(v)} (${v.youtube}) has no upload date in content/video-meta.json`);

// ---- extra structured data for specific pages ----
const pageExtras = {
  index: {
    pageProps: { about: { '@id': ORG_ID } },
    nodes: [...portfolio.featured.map(videoNode).filter(Boolean), ...(site.reel.uploadDate ? [{
      '@type': 'VideoObject',
      name: `${site.name}: ${site.reel.title}`,
      description: `${site.name} brand reel. ${site.defaultDescription}`,
      thumbnailUrl: site.reel.thumbnail || ytThumb(site.reel.youtube, 'maxresdefault'),
      uploadDate: withTz(site.reel.uploadDate),
      duration: site.reel.duration,
      embedUrl: site.reel.vimeo ? `https://player.vimeo.com/video/${site.reel.vimeo}` : `https://www.youtube.com/embed/${site.reel.youtube}`,
      publisher: { '@id': ORG_ID },
    }] : [])],
  },
  portfolio: { pageType: 'CollectionPage', nodes: uniqueVideos.map(videoNode).filter(Boolean) },
  contact: { pageType: 'ContactPage' },
  faq: {
    pageType: 'FAQPage',
    pageProps: { mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
  },
  about: { pageType: 'AboutPage', pageProps: { about: { '@id': ORG_ID } } },
};

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

// ---------------------------------------------------------------------------
// Breakout pages: one per industry, customer type and case study, all from content/home.json
// ---------------------------------------------------------------------------
// /industries/<name>, /who-we-serve/<name> and /case-studies/<title>. Each is built from the same pieces as the
// other pages: a film-still hero, numbered sections and the closing Start a project block. Add an entry to
// content/home.json and its page appears (with sitemap, breadcrumbs, structured data and llms.txt).
const btn = (href, text, kind) => `<a class="btn btn--plain btn--pill btn--${kind}" href="${href}">${text}</a>`;

function breakoutHero({ img, zoom, crumbs, beats, lede, buttons }) {
  return `<section class="hero hero--still${zoom ? ' hero--zoom' : ''}">
  <div class="bg-video"><img class="bg-video__poster" src="${img}" width="1280" height="720" alt="" fetchpriority="high"></div>
  <div class="hero__shade" aria-hidden="true"></div>
  <div class="container hero__content">
    <p class="hero__eyebrow hero__crumbs"><a href="${crumbs[1]}">${esc(crumbs[0])}</a> <span aria-hidden="true">/</span> ${esc(crumbs[2])}</p>
    <h1 class="hero__stack">${beats.map((b) => `<span>${esc(b)}</span>`).join(' ')}</h1>
    <p class="hero__lede">${esc(lede)}</p>
    <div class="btn-row">${buttons}</div>
  </div>
</section>`;
}

// One numbered section. `inner` sits inside the content column; `wide` (a video grid) runs edge to edge after it.
function section({ tone = '', id, kicker, title, intro = '', inner = '', wide = '', actions = '' }) {
  const head = `<p class="kicker">${esc(kicker)}</p>
    <h2 class="section__title">${esc(title)}</h2>
    ${intro ? `<p>${esc(intro)}</p>` : ''}
    ${inner}`;
  const acts = actions ? `<div class="section__actions btn-row">${actions}</div>` : '';
  return `<section class="section${tone ? ` section--${tone}` : ''}" id="${id}">
  <div class="container">
    ${head}${wide ? '' : `\n    ${acts}`}
  </div>${wide ? `\n  ${wide}${acts ? `\n  <div class="container">${acts}</div>` : ''}` : ''}
</section>`;
}

const pointsList = (points) =>
  `<ol class="detail-points">${points.map((pt, k) => `<li><span class="detail-points__num">${pad2(k + 1)}</span><h3>${POINT_LABELS[k]}</h3><p>${esc(pt)}</p></li>`).join('')}</ol>`;
const hardCards = (list) =>
  `<ol class="step-cards">${list.map((h, k) => `<li><span class="step-cards__num">${pad2(k + 1)}</span><h3>${esc(h.h)}</h3><p>${esc(h.p)}</p></li>`).join('')}</ol>`;
const faqItems = (list) =>
  `<div class="faq faq--short">${list.map((f) => `<div class="faq__item"><h3>${esc(f.q)}</h3><p>${esc(f.a)}</p></div>`).join('')}</div>`;
const chipLinks = (links) =>
  `<ul class="chip-links">${links.map(([href, label]) => `<li><a href="${href}">${esc(label)}</a></li>`).join('')}</ul>`;
// Case study cards: still, goal, client and title (the link covers the card), one sentence
const caseCards = (list) => `<ul class="audience-cards is-linked case-cards">
${list.map((c) => `  <li>
    <div class="audience-cards__photo${c.zoom ? ' is-zoom' : ''}"><img src="${c.image || still(c.still)}" alt="" width="1280" height="720" loading="lazy" decoding="async"></div>
    <div class="audience-cards__body"><p class="case-cards__goal">${esc(c.goal)}</p><h3><a href="${casePath(c)}">${esc(c.client)}: ${esc(c.title)}</a></h3><p>${esc(c.text)}</p></div>
  </li>`).join('\n')}
</ul>`;
const videoNodes = (videos) => videos.map((v) => v.youtube && videoNode(v)).filter(Boolean);
// The "Our work" section: up to four films, two across
const workSection = (videos, { tone = 'dark', title = "Films we've made.", intro = '', actions = '' } = {}) =>
  section({ tone, id: 'work', kicker: 'Our work', title, intro, wide: workGrid(videos, { single: videos.length === 1 }), actions });
const serviceNode = (canonical, name, x) => ({
  '@type': 'Service',
  '@id': `${canonical}#service`,
  name,
  serviceType: 'Video production',
  description: x.intro || x.more || x.text,
  provider: { '@id': ORG_ID },
  areaServed: [{ '@type': 'City', name: 'Phoenix' }, { '@type': 'State', name: 'Arizona' }, { '@type': 'Country', name: 'United States' }],
  url: canonical,
});
// Meta description: "Beauty & Salon Video Production in Phoenix, AZ. <one sentence>", shortened to fit Google (160)
const breakoutDescription = (...tries) => {
  const d = tries.find((t) => esc(t).length <= 158) || tries[tries.length - 1];
  if (esc(d).length > 160) warnings.push(`breakout page description is ${esc(d).length} chars: "${d}"`);
  return d;
};

function breakoutPage({ urlPath, title, description, trail, still: img, body, nodes, ogImage }) {
  write(urlPath, layout({ urlPath, title, description, trail, body, nodes, bodyClass: 'page-sections', ogImage }));
  pageIndex.push({ path: urlPath, title, description });
}

// ---- industries ----
for (const x of home.industries) {
  const urlPath = industryPath(x);
  const canonical = canonicalOf(urlPath);
  const videos = (x.work || []).map(workVideo);
  const cases = home.cases.filter((c) => c.industry === x.name);
  const others = home.industries.filter((o) => o !== x);
  const seo = x.seoTitle || `${x.name} Video Production`;
  const body = [
    breakoutHero({
      img: still(x.still),
      zoom: x.zoom,
      crumbs: ['Industries', '/industries', x.name],
      beats: [`${x.headline || `${x.name} video`}.`, x.title],
      lede: x.text,
      buttons: btn('#work', 'See the work', 'red') + btn('/industries', 'All industries', 'clear'),
    }),
    section({
      id: 'what-we-bring',
      kicker: 'What we bring',
      title: 'Why they call us.',
      intro: x.intro,
      inner: `${pointsList(x.points)}\n    <p class="clients-line"><span>Clients include</span> ${x.clients.map(esc).join(' &middot; ')}</p>`,
    }),
    videos.length ? workSection(videos, { actions: btn(x.link, 'See all our work', 'clear') }) : '',
    cases.length ? section({ id: 'case-studies', kicker: 'Case studies', title: 'The results.', inner: caseCards(cases), actions: btn('/case-studies', 'All case studies', 'clear-dark') }) : '',
    section({ tone: 'dark', id: 'the-hard-part', kicker: 'The hard part', title: 'What makes it tricky.', inner: hardCards(x.hard) }),
    section({ tone: 'dark', id: 'questions', kicker: 'Questions', title: 'Good questions.', inner: faqItems(x.faq) }),
    section({ tone: 'soft', id: 'more-industries', kicker: 'More industries', title: 'Other places we work.', inner: chipLinks(others.map((o) => [industryPath(o), o.name])), actions: btn('/industries', 'All industries', 'clear-dark') }),
    blocks.start_project,
  ].filter(Boolean).join('\n\n');
  breakoutPage({
    urlPath,
    title: seo,
    description: breakoutDescription(`${seo} in Phoenix, AZ. ${x.text}`, `${seo}. ${x.text}`, x.text),
    trail: [['Home', '/'], ['Industries', '/industries'], [x.name, urlPath]],
    body,
    nodes: [serviceNode(canonical, seo, x), ...videoNodes(videos)],
  });
}

// ---- customer types (Our customers) ----
for (const x of home.audiences.filter((a) => !a.page)) {
  const urlPath = audiencePath(x);
  const canonical = canonicalOf(urlPath);
  const videos = (x.work || []).map(workVideo);
  const cases = home.cases.filter((c) => c.customer === x.name);
  const seo = x.seoTitle || `Video Production for ${x.name}`;
  const body = [
    breakoutHero({
      img: still(x.still),
      zoom: x.zoom,
      crumbs: ['Our customers', '/who-we-serve', x.name],
      beats: [`${x.headline || `Video for ${x.name.toLowerCase()}`}.`, x.title],
      lede: x.text,
      buttons: btn('#work', 'See the work', 'red') + btn('/who-we-serve', 'All customers', 'clear'),
    }),
    section({ id: 'how-we-work', kicker: 'How we work with you', title: 'What you get.', intro: x.more, inner: pointsList(x.points) }),
    videos.length ? workSection(videos, { intro: x.workIntro, actions: btn('/portfolio', 'See all our work', 'clear') }) : '',
    cases.length ? section({ id: 'case-studies', kicker: 'Case studies', title: 'The results.', inner: caseCards(cases), actions: btn('/case-studies', 'All case studies', 'clear-dark') }) : '',
    section({ tone: 'dark', id: 'the-hard-part', kicker: 'What we hear', title: 'The problems we solve.', inner: hardCards(x.hard) }),
    section({ tone: 'dark', id: 'questions', kicker: 'Questions', title: 'Good questions.', inner: faqItems(x.faq) }),
    x.related?.length ? section({ id: 'industries', kicker: 'Industries', title: "Where we've done it.", inner: industryCards(x.related.map(industryNamed)), actions: btn('/industries', 'All industries', 'clear-dark') }) : '',
    blocks.start_project,
  ].filter(Boolean).join('\n\n');
  breakoutPage({
    urlPath,
    title: seo,
    description: breakoutDescription(`${seo} in Phoenix, AZ. ${x.text}`, `${seo}. ${x.text}`, x.text),
    trail: [['Home', '/'], ['Our customers', '/who-we-serve'], [x.name, urlPath]],
    body,
    nodes: [{ ...serviceNode(canonical, seo, x), audience: { '@type': 'Audience', audienceType: x.name } }, ...videoNodes(videos)],
  });
}

// ---- case studies ----
for (const [i, x] of home.cases.entries()) {
  const urlPath = casePath(x);
  const film = x.video && { client: x.client, title: x.title, ...x.video };
  const industry = x.industry && industryNamed(x.industry);
  const customer = x.customer && home.audiences.find((a) => a.name === x.customer);
  const moreFilms = (x.work || []).map(workVideo).filter((v) => !film || (v.youtube || v.vimeo) !== (film.youtube || film.vimeo));
  // Other case studies: same industry first, then the next ones in order
  const others = [...home.cases.slice(i + 1), ...home.cases.slice(0, i)].sort((a, b) => (b.industry === x.industry) - (a.industry === x.industry)).slice(0, 3);
  const facts = [
    ['Client', esc(x.client)],
    ['Goal', esc(x.goal)],
    industry && ['Industry', `<a href="${industryPath(industry)}">${esc(industry.name)}</a>`],
    x.services && ['Services', x.services.map((s) => `<a href="/services">${esc(s)}</a>`).join(', ')],
    ...(x.facts || []).map((f) => [f.label, esc(f.value)]),
  ].filter(Boolean);
  const body = [
    breakoutHero({
      img: x.image || still(x.still),
      zoom: x.zoom,
      crumbs: ['Case studies', '/case-studies', x.client],
      beats: [x.client, x.title],
      lede: x.lede || x.text,
      buttons: (film ? `<a class="btn btn--plain btn--pill btn--red" ${videoAttrs(film)}>Watch the film</a>` : '') + btn('/case-studies', 'All case studies', 'clear'),
    }),
    section({
      tone: 'dark',
      id: 'the-project',
      kicker: 'About the project',
      title: 'The story.',
      inner: `<dl class="facts">${facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}</dl>
    <div class="case-study case-study__grid">
      <div class="case-study__film">${film ? videoLink(film, { feature: true, hires: true }) : ''}</div>
      <div class="case-study__text"><p>${esc(x.story || x.text)}</p></div>
    </div>`,
    }),
    x.sitrep ? section({
      id: 'the-sitrep',
      kicker: 'The SITREP',
      title: 'Research first.',
      intro: 'Before we filmed anything, the research changed the plan.',
      inner: `<ol class="detail-points">${x.sitrep.map((pt, k) => `<li><span class="detail-points__num">${pad2(k + 1)}</span><h3>${['The situation', 'What we found', 'What we made'][k]}</h3><p>${esc(pt)}</p></li>`).join('')}</ol>`,
      actions: btn('/sitrep', 'How SITREP works', 'clear-dark'),
    }) : '',
    x.stats?.length ? section({ tone: 'dark', id: 'the-numbers', kicker: 'The numbers', title: 'By the numbers.', intro: 'Public numbers around the project, each with its source.', inner: statsList(x.stats, true) }) : '',
    moreFilms.length ? workSection(moreFilms, { tone: '', title: 'More from the project.' }) : '',
    x.quote ? `<section class="section section--dark" id="quote">
  <div class="container">
    <p class="kicker">In their words</p>
    <blockquote class="quote-band"><p>&ldquo;${esc(x.quote.text)}&rdquo;</p><footer>${esc(x.quote.name)}${x.quote.role ? `, ${esc(x.quote.role)}` : ''}</footer></blockquote>
  </div>
</section>` : '',
    section({
      tone: 'soft',
      id: 'more-case-studies',
      kicker: 'More case studies',
      title: 'Keep reading.',
      inner: caseCards(others),
      actions: [industry && btn(industryPath(industry), `More ${industry.name} work`, 'clear-dark'), customer && btn(audiencePath(customer), `More for ${customer.name.toLowerCase()}`, 'clear-dark'), btn('/case-studies', 'All case studies', 'clear-dark')].filter(Boolean).join(''),
    }),
    blocks.start_project,
  ].filter(Boolean).join('\n\n');
  // `seoTitle` overrides the page title when client + title is too long for Google
  const title = x.seoTitle || `${x.client}: ${x.title}`;
  breakoutPage({
    urlPath,
    title,
    description: breakoutDescription(`Case study: ${x.lede || x.text}`, x.lede || x.text),
    trail: [['Home', '/'], ['Case studies', '/case-studies'], [title, urlPath]],
    body,
    ogImage: undefined,
    nodes: videoNodes([film, ...moreFilms].filter(Boolean)),
  });
}

// ---- blog posts ----
const postTpl = read('src/templates/post.html');
// Phones download the 720px card image; wider screens get the full-size cover.
function coverSrcset(p) {
  const full = imageSize(path.join(DIST, p.coverDisplay));
  const card = imageSize(path.join(DIST, p.card));
  if (!full || !card || p.card === p.coverDisplay) return '';
  return ` srcset="${p.card} ${card[0]}w, ${p.coverDisplay} ${full[0]}w" sizes="(max-width: 912px) calc(100vw - 32px), 880px"`;
}
for (const p of posts) {
  const urlPath = `/post/${p.slug}`;
  const canonical = canonicalOf(urlPath);
  const body = fill(postTpl, {
    ender: blocks.start_project,
    title: esc(p.title),
    date: p.date,
    dateLabel: fmtDate(p.date),
    author: esc(p.author),
    minutes: p.minutes,
    cover: p.coverDisplay,
    coverSrcset: coverSrcset(p),
    coverAlt: esc(p.coverAlt),
    content: p.html,
    categories: p.categories.map((c) => `<a href="/blog/categories/${slugify(c)}">${esc(c)}</a>`).join(''),
    related: relatedTo(p).map((q) => postCard(q)).join('\n'),
  });
  const author = site.team.find((m) => m.name === p.author);
  write(urlPath, layout({
    urlPath,
    title: p.title,
    fullTitle: p.title.length > 52 ? p.title : undefined,
    description: p.description,
    ogImage: p.cover_image,
    ogImageAlt: p.coverAlt,
    ogType: 'article',
    body,
    bodyClass: 'page-post',
    trail: [['Home', '/'], ['Intel', '/blog'], [p.title, urlPath]],
    articleMeta: [
      `<meta property="article:published_time" content="${withTz(p.date)}">`,
      `<meta property="article:author" content="${esc(p.author)}">`,
      ...p.categories.map((c) => `<meta property="article:tag" content="${esc(c)}">`),
    ].join('\n'),
    nodes: [{
      '@type': 'BlogPosting',
      '@id': `${canonical}#article`,
      headline: p.title,
      description: p.description,
      datePublished: withTz(p.date),
      dateModified: withTz(p.updated || p.date),
      author: author ? { '@id': personId(author.name) } : { '@type': 'Person', name: p.author },
      publisher: { '@id': ORG_ID },
      image: absUrl(p.cover_image),
      mainEntityOfPage: { '@id': `${canonical}#webpage` },
      isPartOf: { '@id': BLOG_ID },
      articleSection: p.categories[0],
      keywords: p.categories.join(', '),
      wordCount: p.words,
      inLanguage: 'en-US',
    }],
  }), { lastmod: p.updated || p.date });
}

// ---- blog index + category pages ----
const blogTpl = read('src/templates/blog.html');
const blogIntro = "Intel is our blog. It's where we share the stories behind the stories: lessons from set, notes from the research desk and what we're learning along the way. We write about production, storytelling, the creative process and what it actually takes to make something worth watching. Pull up a chair.";
const categoryNames = [...new Set(posts.flatMap((p) => p.categories))].sort();
const catNav = (active) =>
  `<li><a href="/blog"${active ? '' : ' aria-current="page"'}>All posts</a></li>` +
  categoryNames.map((c) => `<li><a href="/blog/categories/${slugify(c)}"${active === c ? ' aria-current="page"' : ''}>${esc(c)}</a></li>`).join('');
// Newsletter sign-up under the Intel intro. Not connected yet: site.js shows a short note and sends nothing.
const newsletterSignup = `<div class="newsletter-signup">
      <p class="newsletter-signup__label">Get new Intel in your inbox.</p>
      <form class="newsletter" id="newsletter" method="post" action="/api/newsletter" data-newsletter>
        <label class="visually-hidden" for="nl-name">Name</label>
        <input id="nl-name" name="name" type="text" placeholder="Name" autocomplete="name" required>
        <label class="visually-hidden" for="nl-email">Email</label>
        <input id="nl-email" name="email" type="email" placeholder="Email" autocomplete="email" required>
        <button class="btn btn--plain btn--pill btn--red" type="submit">Sign up</button>
        <p class="newsletter__status" role="status" aria-live="polite"></p>
      </form>
    </div>`;

write('/blog', layout({
  urlPath: '/blog',
  title: 'Intel: Our Blog',
  // Kept short (about 55 characters) so it fits on one line as a Google sitelink.
  description: 'Notes on video production, storytelling and marketing.',
  pageType: 'CollectionPage',
  trail: [['Home', '/'], ['Intel', '/blog']],
  nodes: [{
    '@type': 'Blog',
    '@id': BLOG_ID,
    url: `${site.url}/blog`,
    name: `${site.name} Intel`,
    description: blogIntro,
    publisher: { '@id': ORG_ID },
    inLanguage: 'en-US',
    blogPost: posts.slice(0, 10).map((p) => ({ '@type': 'BlogPosting', '@id': `${site.url}/post/${p.slug}#article`, headline: p.title, url: `${site.url}/post/${p.slug}`, datePublished: withTz(p.date) })),
  }],
  bodyClass: 'page-black',
  body: fill(blogTpl, { ender: blocks.start_project, heading: 'Intel', intro: blogIntro, newsletter: newsletterSignup, categories: catNav(null), posts: posts.map((p) => postCard(p, 2)).join('\n') }),
}), { lastmod: posts[0]?.date });
pageIndex.push({ path: '/blog', title: 'Intel (blog)', description: blogIntro });

for (const c of categoryNames) {
  const list = posts.filter((p) => p.categories.includes(c));
  const urlPath = `/blog/categories/${slugify(c)}`;
  write(urlPath, layout({
    urlPath,
    title: `${c} Articles`,
    description: `Thrill Wave blog posts about ${c.toLowerCase()}: ${list.length} article${list.length === 1 ? '' : 's'} from our Phoenix video production team.`,
    pageType: 'CollectionPage',
    bodyClass: 'page-black',
    trail: [['Home', '/'], ['Intel', '/blog'], [c, urlPath]],
    body: fill(blogTpl, {
      ender: blocks.start_project,
      heading: esc(c),
      intro: `${list.length} post${list.length === 1 ? '' : 's'}`,
      newsletter: '',
      categories: catNav(c),
      posts: list.map((p) => postCard(p, 2)).join('\n'),
    }),
  }), { lastmod: list[0]?.date });
}

// ---- sitemap.xml ----
fs.writeFileSync(
  path.join(DIST, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemap.map((u) => `  <url><loc>${canonicalOf(u.path)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`).join('\n')}
</urlset>
`
);

// ---- RSS feed (/blog-feed.xml, the URL Wix used) ----
const xml = (s) => esc(s).replace(/'/g, '&apos;');
const cdata = (s) => `<![CDATA[${s.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;
const absolutize = (html) => html.replace(/(src|href)="\//g, `$1="${site.url}/`);
fs.writeFileSync(
  path.join(DIST, 'blog-feed.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel>
  <title>${xml(site.name)} Blog</title>
  <link>${site.url}/blog</link>
  <atom:link href="${site.url}/blog-feed.xml" rel="self" type="application/rss+xml"/>
  <description>${xml(blogIntro)}</description>
  <language>en-us</language>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${posts.map((p, i) => `  <item>
    <title>${xml(p.title)}</title>
    <link>${site.url}/post/${p.slug}</link>
    <guid isPermaLink="true">${site.url}/post/${p.slug}</guid>
    <pubDate>${new Date(p.date + 'T12:00:00Z').toUTCString()}</pubDate>
    <dc:creator>${xml(p.author)}</dc:creator>
${p.categories.map((c) => `    <category>${xml(c)}</category>`).join('\n')}
    <description>${xml(p.description)}</description>${i < 20 ? `\n    <content:encoded>${cdata(`<p><img src="${site.url}${p.coverDisplay}" alt="${esc(p.coverAlt)}"></p>` + absolutize(p.html))}</content:encoded>` : ''}
  </item>`).join('\n')}
</channel>
</rss>
`
);

// ---- llms.txt: a plain-text briefing for AI assistants and answer engines ----
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

// ---------------------------------------------------------------------------
for (const w of warnings) console.warn('  warning: ' + w);
console.log(
  `Built ${sitemap.length} pages (${posts.length} posts, ${categoryNames.length} categories, ${uniqueVideos.length} videos) into dist/  [${assets.css}, ${assets.js}]${DEV ? ' (dev, unminified)' : ''}`
);
