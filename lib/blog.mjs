import fs from 'node:fs';
import path from 'node:path';
import { DIST, read, site, pageIndex } from './context.mjs';
import { esc, slugify, fmtDate, absUrl, canonicalOf, fill, imageSize, remoteSize } from './helpers.mjs';
import { ORG_ID, BLOG_ID, personId, withTz } from './schema.mjs';
import { layout, write } from './layout.mjs';
import { posts, relatedTo, postCard } from './posts.mjs';
import { blocks } from './blocks.mjs';

// ---------------------------------------------------------------------------
// Blog pages: one page per post, the Intel index, category pages and the RSS feed
// ---------------------------------------------------------------------------
// ---- blog posts ----
const postTpl = read('src/templates/post.html');
// Phones download the 720px card image; wider screens get the full-size cover.
function coverSrcset(p) {
  const sizeOf = (u) => (u.startsWith('http') ? remoteSize(u) : imageSize(path.join(DIST, u)));
  const full = sizeOf(p.coverDisplay);
  const card = sizeOf(p.card);
  if (!full || !card || p.card === p.coverDisplay) return '';
  return ` srcset="${p.card} ${card[0]}w, ${p.coverDisplay} ${full[0]}w" sizes="(max-width: 912px) calc(100vw - 32px), 880px"`;
}
export function writePostPages() {
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
        author: author ? { '@id': personId(author.name) } : p.author === 'Thrill Wave' ? { '@id': 'https://thrillwave.com/#organization' } : { '@type': 'Person', name: p.author },
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
}

// ---- blog index + category pages ----
export const blogTpl = read('src/templates/blog.html');
export const blogIntro = "Intel is our blog. It's where we share the stories behind the stories: lessons from set, notes from our research and what we're learning along the way. We write about production, storytelling and what it actually takes to make something worth watching. Pull up a chair.";
// Google/Bing descriptions for the blog category pages (120 to 155 characters)
export const categoryDescriptions = {
  'Craft': 'Notes on the craft of filmmaking from Thrill Wave in Phoenix: lenses, cameras, light, interviews and the discipline behind every frame.',
  'Gear and Tech': 'Cinema cameras, anamorphic glass, sensors and the science behind the image, from the film nerds at Thrill Wave in Phoenix, Arizona.',
  'Storytelling': 'Writing, producing, directing and editing: the art and discipline of telling true stories on film, from Thrill Wave in Phoenix.',
  'Industries': 'How film works in medicine, law, energy, finance, aerospace, sports and live events, from Thrill Wave, a Phoenix video production company.',
  'Arizona': 'Filming in Arizona: Phoenix, Scottsdale, Flagstaff and beyond, plus the local film community, from Thrill Wave, a Phoenix production company.',
  'Planning a Video': 'Planning a film: what it costs, how to measure it, how to hire a crew and which kind of video fits. Straight answers from Thrill Wave in Phoenix.',
};
export const categoryNames = [...new Set(posts.flatMap((p) => p.categories))].sort();
export const catNav = (active) =>
  `<li><a href="/blog"${active ? '' : ' aria-current="page"'}>All posts</a></li>` +
  categoryNames.map((c) => `<li><a href="/blog/categories/${slugify(c)}"${active === c ? ' aria-current="page"' : ''}>${esc(c)}</a></li>`).join('');
// Newsletter sign-up under the Intel intro. Not connected yet: site.js shows a short note and sends nothing.
export const newsletterSignup = `<div class="newsletter-signup">
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

export function writeBlogPages() {
  write('/blog', layout({
    urlPath: '/blog',
    title: 'Intel: Our Blog',
    // Kept short (about 55 characters) so it fits on one line as a Google sitelink.
    description: 'Notes on video production, storytelling and the craft.',
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
      description: categoryDescriptions[c] || `Thrill Wave blog posts about ${c.toLowerCase()}: ${list.length} article${list.length === 1 ? '' : 's'} from our Phoenix video production team.`,
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
}

// ---- RSS feed (/blog-feed.xml, the URL Wix used) ----
const xml = (s) => esc(s).replace(/'/g, '&apos;');
const cdata = (s) => `<![CDATA[${s.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;
const absolutize = (html) => html.replace(/(src|href)="\//g, `$1="${site.url}/`);
export function writeFeed() {
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
    <description>${xml(p.description)}</description>${i < 20 ? `\n    <content:encoded>${cdata(`<p><img src="${absUrl(p.coverDisplay)}" alt="${esc(p.coverAlt)}"></p>` + absolutize(p.html))}</content:encoded>` : ''}
  </item>`).join('\n')}
</channel>
</rss>
`
  );
}
