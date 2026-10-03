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
//
// Where the code lives (lib/):
//   lib/context.mjs   shared state: content/*.json, ROOT/DIST, the --dev flag, warnings, sitemap and llms.txt lists
//   lib/helpers.mjs   small tools: esc, fill, slugify, clip, image sizes, remote images, minify, CSS/JS fingerprints
//   lib/schema.mjs    structured data (JSON-LD): organization, website, breadcrumbs, videos, per-page extras
//   lib/media.mjs     video helpers: film stills, videoLink() tiles, video grids, portfolio lookups
//   lib/layout.mjs    the page shell: main menu, "until built" links, layout() and write()
//   lib/posts.mjs     blog posts: reading content/posts/*.md, related posts, post cards
//   lib/blocks.mjs    the {{blocks}} pages can use, the ICONS, and the breakout page addresses
//   lib/pages.mjs     pages from src/pages, sitemap.xml and llms.txt
//   lib/breakout.mjs  breakout pages: one per industry, customer type and case study
//   lib/blog.mjs      blog post pages, the Intel index (blog description), category pages (categoryDescriptions), RSS feed

import fs from 'node:fs';
import path from 'node:path';
import { DEV, ROOT, DIST, warnings, sitemap, assets } from './lib/context.mjs';
import { copyDir, fingerprint } from './lib/helpers.mjs';
import { checkVideoMeta, uniqueVideos } from './lib/schema.mjs';
import { posts } from './lib/posts.mjs';
import { writeStaticPages, writeSitemap, writeLlmsTxt } from './lib/pages.mjs';
import { writeIndustryPages, writeCustomerPages, writeCaseStudyPages } from './lib/breakout.mjs';
import { writePostPages, writeBlogPages, writeFeed, categoryNames } from './lib/blog.mjs';

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------
// 1. Start fresh: copy public/ into dist/ and fingerprint the CSS and JS
fs.rmSync(DIST, { recursive: true, force: true });
copyDir(path.join(ROOT, 'public'), DIST);
assets.css = await fingerprint('css/site.css', 'css');
assets.js = await fingerprint('js/site.js', 'js');

// 2. Every portfolio video needs its upload date for the structured data
checkVideoMeta();

// 3. Pages from src/pages (Home, About, Services...)
writeStaticPages();

// 4. Breakout pages from content/home.json
writeIndustryPages();
writeCustomerPages();
writeCaseStudyPages();

// 5. Blog: each post, then the Intel index and category pages
writePostPages();
writeBlogPages();

// 6. Files for search and answer engines
writeSitemap();
writeFeed();
writeLlmsTxt();

// ---------------------------------------------------------------------------
for (const w of warnings) console.warn('  warning: ' + w);
console.log(
  `Built ${sitemap.length} pages (${posts.length} posts, ${categoryNames.length} categories, ${uniqueVideos.length} videos) into dist/  [${assets.css}, ${assets.js}]${DEV ? ' (dev, unminified)' : ''}`
);
