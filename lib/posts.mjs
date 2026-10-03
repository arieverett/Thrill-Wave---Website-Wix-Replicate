import fs from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';
import { ROOT, read, site } from './context.mjs';
import { esc, decode, fmtDate, clip, exists, remoteCard } from './helpers.mjs';
import { workGrid } from './media.mjs';

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

export function parsePost(file) {
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
    description: meta.description || clip(summary, 158),
    coverDisplay: cover.startsWith('http') ? cover : exists(webp) ? webp : cover,
    card: cover.startsWith('http') ? remoteCard(cover) : exists(card) ? card : cover,
    coverAlt: meta.cover_alt || altFromFile(cover),
  };
}

export const posts = fs
  .readdirSync(path.join(ROOT, 'content/posts'))
  .filter((f) => f.endsWith('.md'))
  .map(parsePost)
  .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.title.localeCompare(b.title)));

// Related posts: most shared categories first, then the closest in date.
export function relatedTo(post, n = 3) {
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

// A post card for the blog list, category pages and related posts
export const postCard = (p, level = 3) => `<article class="post-card">
  <a href="/post/${p.slug}">
    <div class="post-card__media"><img src="${p.card}" alt="" loading="lazy" decoding="async"></div>
    <div class="post-card__body">
      <p class="post-card__meta"><time datetime="${p.date}">${fmtDate(p.date)}</time> <span aria-hidden="true">&middot;</span> ${p.minutes} min read</p>
      <h${level}>${esc(p.title)}</h${level}>
      <p>${esc(p.excerpt)}</p>
    </div>
  </a>
</article>`;
