import fs from 'node:fs';
import path from 'node:path';
import { ROOT, DIST, site, partials, socialIcons, shownSocial, warnings, sitemap, assets } from './context.mjs';
import { esc, slugify, absUrl, canonicalOf, fill, imageSize, remoteSize, sizeImages } from './helpers.mjs';
import { orgNode, websiteNode, WEBSITE_ID, breadcrumbNode, jsonLd } from './schema.mjs';

// ---------------------------------------------------------------------------
// Page layout
// ---------------------------------------------------------------------------
// Links to pages (or page sections) that aren't built yet:
//   <a href="/services" data-until-built="#what-we-do">      until src/pages/services.html exists
//   <a href="/about#values" data-until-built="/about">       until about.html has a section with id="values"
// Until then the link points at the fallback (so there's never a broken link); once the page or section
// is added, the same link goes to it. The attribute itself is dropped from the output. Menu items in
// content/site.json do the same with "until".
export const builtHref = (href, until) => {
  const m = until && href.match(/^\/([\w-]+)(?:#([\w-]+))?$/);
  if (!m) return href;
  const file = path.join(ROOT, 'src/pages', m[1] + '.html');
  const ready = fs.existsSync(file) && (!m[2] || fs.readFileSync(file, 'utf8').includes(`id="${m[2]}"`));
  return ready ? href : until;
};
export const linkPendingPages = (html) =>
  html.replace(/href="(\/[\w-]+(?:#[\w-]+)?)" data-until-built="([^"]+)"/g, (m, href, fallback) => `href="${builtHref(href, fallback)}"`);

// (`assets`, the hashed CSS/JS URLs, lives in lib/context.mjs)

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
export function navMenu(urlPath) {
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

export function layout({
  urlPath, title, fullTitle, description, ogImage, ogImageAlt, ogType = 'website', body, bodyClass = '',
  noindex = false, pageType = 'WebPage', pageProps = {}, trail, nodes = [], articleMeta = '',
}) {
  const canonical = canonicalOf(urlPath);
  const desc = description || site.defaultDescription;
  const pageTitle = fullTitle || `${title} | ${site.name}`;
  if (!noindex && desc.length > 160) warnings.push(`${urlPath}: meta description is ${desc.length} chars (aim for 160 or less)`);

  const image = absUrl(ogImage || site.ogImage);
  const imageFile = path.join(DIST, (ogImage || site.ogImage).replace(/^\//, ''));
  const imageSizeTag = (ogImage || '').startsWith('http') ? remoteSize(ogImage) : imageSize(imageFile);

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
    // Warm up connections the page will need; Vimeo's player and its files for pages with a background video or reel
    preconnect: [
      ...['i.ytimg.com', 'i.vimeocdn.com'].filter((host) => body.includes(host)),
      ...(/data-vimeo-(bg|inline)/.test(body) ? ['player.vimeo.com', 'f.vimeocdn.com'] : []),
    ].map((host) => `<link rel="preconnect" href="https://${host}">`).join('\n'),
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

export function write(urlPath, html, { index = true, lastmod } = {}) {
  // "/" -> index.html, "/portfolio" -> portfolio.html, "/post/x" -> post/x.html
  const file = urlPath === '/' ? 'index.html' : urlPath.replace(/^\//, '') + '.html';
  const out = path.join(DIST, file);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, sizeImages(html));
  if (index) sitemap.push({ path: urlPath, lastmod });
}
