// Static site builder for thrillwave.com
// ---------------------------------------------------------------------------
// Plain HTML/CSS/JS output, no framework. Two dependencies: marked (blog markdown)
// and esbuild (minifies CSS/JS). `npm run build` writes the finished site to dist/,
// which Cloudflare Pages serves as-is. `npm run dev` builds with --dev (readable,
// unminified CSS/JS) and reloads the browser on every save.
//
//   src/partials/   shared <head>, header and footer (edit once, applies everywhere)
//   src/pages/      one .html file per page; its first line holds the page's meta
//   src/templates/  blog post and blog list layouts
//   content/        site settings, portfolio, FAQ, packages (JSON) and blog posts (markdown)
//   public/         copied into dist/ untouched (css, js, images, fonts, _headers, _redirects)
//
// Besides the pages it generates:
//   - JSON-LD structured data on every page (Organization, WebSite, WebPage,
//     BreadcrumbList, BlogPosting, Service/Offer)
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
const medical = readJSON('content/medical.json');
const socialIcons = readJSON('content/social-icons.json');
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
  areaServed: [
    { '@type': 'City', name: 'Phoenix' },
    { '@type': 'State', name: 'Arizona' },
    { '@type': 'Country', name: 'United States' },
  ],
  founder: site.team.map((m) => ({ '@type': 'Person', '@id': personId(m.name), name: m.name, jobTitle: m.jobTitle, image: absUrl(m.image), worksFor: { '@id': ORG_ID } })),
  knowsAbout: site.services,
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

// "Relentless Beats: Gold Rush 2024 Aftermovie", for aria labels, the lightbox and llms.txt
const videoName = (v) => (v.client ? `${v.client}: ${v.title}` : v.title);

// A video thumbnail with its title laid over the picture: bold client, then the video name.
// Clicking opens the player in a lightbox (public/js/site.js); without JavaScript it is a
// plain link to the video on YouTube.
function videoLink(v, { feature = false } = {}) {
  const name = esc(videoName(v));
  if (v.vimeo) {
    return `<div class="video video--embed"><iframe src="https://player.vimeo.com/video/${v.vimeo}?dnt=1" title="${name}" loading="lazy" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>`;
  }
  return `<a class="video${feature ? ' video--feature' : ''}" href="https://www.youtube.com/watch?v=${v.youtube}" data-youtube="${v.youtube}" data-title="${name}" aria-label="Play video: ${name}">
    <img src="${ytThumb(v.youtube)}" data-hires="${ytThumb(v.youtube, 'maxresdefault')}" alt="" width="480" height="360" loading="lazy" decoding="async">
    <span class="video__play" aria-hidden="true"></span>
    <span class="video__label" aria-hidden="true">${v.client ? `<strong>${esc(v.client)}</strong> ` : ''}${esc(v.title)}</span>
  </a>`;
}

// Edge-to-edge thumbnail grid (home "Our work", SITREP, portfolio)
const workGrid = (videos, { single = false } = {}) =>
  `<div class="work-grid${single ? ' work-grid--single' : ''}">
${videos.map((v) => `  <div class="work-tile">${videoLink(v)}</div>`).join('\n')}
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
const assets = {}; // filled in once public/ is copied and fingerprinted

// "page" on the exact page; "true" inside its section (a blog post highlights Blog).
const navState = (href, urlPath) => {
  if (href === urlPath) return ' aria-current="page"';
  if (href === '/blog' && /^\/(post|blog)\//.test(urlPath)) return ' aria-current="true"';
  return '';
};

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
      `<meta property="og:image:alt" content="${esc(ogImageAlt || site.name + ' logo')}">`,
    ].filter(Boolean).join('\n'),
    articleMeta,
    preconnect: body.includes('i.ytimg.com') ? '<link rel="preconnect" href="https://i.ytimg.com">' : '',
    css: assets.css,
    js: assets.js,
    jsonld: jsonLd(graph),
    nav: site.nav
      .map((n) => `<li><a href="${n.href}"${navState(n.href, urlPath)}>${n.label}</a></li>`)
      .join(''),
    social: site.social
      .map((s) => `<li><a href="${s.href}" target="_blank" rel="noopener" aria-label="${s.label}"><svg viewBox="0 0 24 24" aria-hidden="true">${socialIcons[s.label] || ''}</svg></a></li>`)
      .join(''),
    year: new Date().getFullYear(),
  };

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
`;
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
const blocks = {
  portfolio_featured: workGrid(portfolio.featured),
  portfolio_intro: esc(portfolio.intro),
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
  reel_embed: site.reelVimeoId
    ? vimeoEmbed(site.reelVimeoId, 'Thrill Wave reel')
    : `<div class="reel">${videoLink({ client: 'Thrill Wave', title: 'Reel', youtube: site.reelYoutubeId }, { feature: true })}</div>`,
  itca_embed: site.itcaVimeoId
    ? vimeoEmbed(site.itcaVimeoId, 'ITCA campaign')
    : workGrid([{ client: 'ITCA WIC', title: 'Dear Mom', youtube: 'QlP7wPaFcVU' }], { single: true }),
  team: `<ul class="team">
${site.team.map((m) => `  <li>
    <img src="${m.image}" alt="${esc(m.name)}" loading="lazy" decoding="async">
    <div class="team__body"><h3>${esc(m.name)}</h3><p>${esc(m.role)}</p></div>
  </li>`).join('\n')}
</ul>`,
  medical_packages: `<div class="pricing">
${medical.packages.map((pk) => `  <article class="plan${pk.badge ? ' plan--featured' : ''}">
    ${pk.badge ? `<p class="plan__badge">${esc(pk.badge)}</p>\n    ` : ''}<h3>${esc(pk.name)}</h3>
    <p class="plan__price">$${pk.price.toLocaleString('en-US')}</p>
    <p class="plan__desc">${esc(pk.description)}</p>
    <ul>${pk.features.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
    <a class="btn" href="/contact">Get started</a>
  </article>`).join('\n')}
</div>
<p class="muted center">${esc(medical.note)}</p>`,
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
  map_embed: `<iframe class="map" src="https://maps.google.com/maps?q=${encodeURIComponent(site.mapQuery)}&amp;z=9&amp;output=embed" title="Map: ${esc(site.city)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>`,
};

// ---- extra structured data for specific pages ----
const pageExtras = {
  index: { pageProps: { about: { '@id': ORG_ID } } },
  portfolio: { pageType: 'CollectionPage' },
  contact: { pageType: 'ContactPage' },
  medical: {
    nodes: [{
      '@type': 'Service',
      '@id': `${site.url}/medical#service`,
      name: medical.service,
      serviceType: 'Video production and photography',
      provider: { '@id': ORG_ID },
      areaServed: { '@type': 'State', name: 'Arizona' },
      audience: { '@type': 'Audience', audienceType: 'Medical and dental practices' },
      offers: medical.packages.map((pk) => ({
        '@type': 'Offer',
        name: `${pk.name} package`,
        description: pk.description,
        price: pk.price,
        priceCurrency: 'USD',
        url: `${site.url}/medical#packages`,
      })),
    }],
  },
};

// ---- static pages ----
for (const file of fs.readdirSync(path.join(ROOT, 'src/pages')).sort()) {
  if (!file.endsWith('.html')) continue;
  const raw = read(path.join('src/pages', file));
  const metaMatch = raw.match(/^<!--\s*meta\s*(\{[\s\S]*?\})\s*-->\n?/);
  if (!metaMatch) throw new Error('Missing <!-- meta {...} --> line in ' + file);
  const meta = JSON.parse(metaMatch[1]);
  const body = fill(raw.slice(metaMatch[0].length), { site, ...blocks });
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
    trail: [['Home', '/'], ['Blog', '/blog'], [p.title, urlPath]],
    articleMeta: [
      `<meta property="article:published_time" content="${p.date}">`,
      `<meta property="article:author" content="${esc(p.author)}">`,
      ...p.categories.map((c) => `<meta property="article:tag" content="${esc(c)}">`),
    ].join('\n'),
    nodes: [{
      '@type': 'BlogPosting',
      '@id': `${canonical}#article`,
      headline: p.title,
      description: p.description,
      datePublished: p.date,
      dateModified: p.updated || p.date,
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
const blogIntro = 'We write about what we know. Production, storytelling, the creative process, and what it actually takes to make something worth watching. Pull up a chair.';
const categoryNames = [...new Set(posts.flatMap((p) => p.categories))].sort();
const catNav = (active) =>
  `<a href="/blog"${active ? '' : ' aria-current="page"'}>All Posts</a>` +
  categoryNames.map((c) => `<a href="/blog/categories/${slugify(c)}"${active === c ? ' aria-current="page"' : ''}>${esc(c)}</a>`).join('');

write('/blog', layout({
  urlPath: '/blog',
  title: 'Blog',
  description: 'Notes from a Phoenix video production team: production, storytelling, the creative process and what it takes to make something worth watching.',
  pageType: 'CollectionPage',
  trail: [['Home', '/'], ['Blog', '/blog']],
  nodes: [{
    '@type': 'Blog',
    '@id': BLOG_ID,
    url: `${site.url}/blog`,
    name: `${site.name} Blog`,
    description: blogIntro,
    publisher: { '@id': ORG_ID },
    inLanguage: 'en-US',
    blogPost: posts.slice(0, 10).map((p) => ({ '@type': 'BlogPosting', '@id': `${site.url}/post/${p.slug}#article`, headline: p.title, url: `${site.url}/post/${p.slug}`, datePublished: p.date })),
  }],
  body: fill(blogTpl, { heading: 'Blog', intro: blogIntro, categories: catNav(null), posts: posts.map((p) => postCard(p, 2)).join('\n') }),
}), { lastmod: posts[0]?.date });
pageIndex.push({ path: '/blog', title: 'Blog', description: blogIntro });

for (const c of categoryNames) {
  const list = posts.filter((p) => p.categories.includes(c));
  const urlPath = `/blog/categories/${slugify(c)}`;
  write(urlPath, layout({
    urlPath,
    title: `${c} | Blog`,
    description: `Thrill Wave blog posts about ${c.toLowerCase()}: ${list.length} article${list.length === 1 ? '' : 's'} from our Phoenix video production team.`,
    pageType: 'CollectionPage',
    trail: [['Home', '/'], ['Blog', '/blog'], [c, urlPath]],
    body: fill(blogTpl, {
      heading: esc(c),
      intro: `${list.length} post${list.length === 1 ? '' : 's'}`,
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
const uniqueVideos = [...new Map([...portfolio.featured, ...portfolio.categories.flatMap((c) => c.videos)].map((v) => [v.youtube || v.vimeo, v])).values()];
fs.writeFileSync(
  path.join(DIST, 'llms.txt'),
  `# ${site.name}

> ${site.summary}

- Based in: ${site.city} (works across Arizona, the U.S. and abroad)
- Phone: ${telephone}
- Email: ${site.email}
- Book a 30-minute consult: ${site.url}/contact
- Founders: ${site.team.map((m) => `${m.name} (${m.jobTitle})`).join('; ')}

## Services

${site.services.map((s) => `- ${s}`).join('\n')}

## Pages

${pageIndex.map((p) => `- [${p.title}](${canonicalOf(p.path)}): ${p.description}`).join('\n')}

## Medical practice packages

${medical.packages.map((pk) => `- ${pk.name}: $${pk.price.toLocaleString('en-US')}. ${pk.description}. Includes ${pk.features.join(', ')}.`).join('\n')}
- ${medical.note}.

## Frequently asked questions

${faq.map((f) => `### ${f.q}\n\n${f.a}`).join('\n\n')}

## Selected work

${portfolio.categories.map((c) => `### ${c.name}\n\n${c.videos.map((v) => `- ${videoName(v)}: https://www.youtube.com/watch?v=${v.youtube}`).join('\n')}`).join('\n\n')}

## Blog

${posts.map((p) => `- [${p.title}](${site.url}/post/${p.slug}) (${p.date}): ${p.excerpt}`).join('\n')}
`
);

// ---------------------------------------------------------------------------
for (const w of warnings) console.warn('  warning: ' + w);
console.log(
  `Built ${sitemap.length} pages (${posts.length} posts, ${categoryNames.length} categories, ${uniqueVideos.length} videos) into dist/  [${assets.css}, ${assets.js}]${DEV ? ' (dev, unminified)' : ''}`
);
