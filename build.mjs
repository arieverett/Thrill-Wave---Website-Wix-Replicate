// Static site builder for thrillwave.com
// ---------------------------------------------------------------
// Plain HTML/CSS/JS output. No framework. Run `npm run build` and
// everything lands in dist/, which Cloudflare Pages serves as-is.
//
//   src/partials/   shared <head>, header and footer (edit once, applies everywhere)
//   src/pages/      one .html file per page; first line holds the page's meta
//   src/templates/  blog post / blog list layouts
//   content/        blog posts (markdown), portfolio videos, site settings (JSON)
//   public/         copied into dist/ untouched (css, js, _redirects, robots.txt...)
//
// URLs match the old Wix site exactly (e.g. /portfolio, /post/<slug>) so
// Google rankings carry over. Cloudflare Pages serves foo.html at /foo.

import fs from "node:fs";
import path from "node:path";
import { marked } from "marked";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(ROOT, "dist");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const readJSON = (p) => JSON.parse(read(p));

const site = readJSON("content/site.json");
const portfolio = readJSON("content/portfolio.json");
const partials = {
  head: read("src/partials/head.html"),
  header: read("src/partials/header.html"),
  footer: read("src/partials/footer.html"),
};

// ---------- helpers ----------
const esc = (s = "") =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
const fmtDate = (d) =>
  new Date(d + "T12:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

function write(urlPath, html) {
  // "/" -> index.html, "/portfolio" -> portfolio.html, "/post/x" -> post/x.html
  const file =
    urlPath === "/" ? "index.html" : urlPath.replace(/^\//, "") + ".html";
  const out = path.join(DIST, file);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html);
  sitemap.push(urlPath);
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    entry.isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d);
  }
}

// Fill {{key}} and {{site.key}} tokens
function fill(tpl, vars) {
  return tpl.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, key) => {
    const val = key
      .split(".")
      .reduce((o, k) => (o == null ? undefined : o[k]), vars);
    return val === undefined ? m : val;
  });
}

// ---------- reusable HTML blocks ----------
function videoCard(v) {
  const title = esc(v.title);
  if (v.youtube) {
    return `<figure class="video-card">
  <div class="video" data-youtube="${v.youtube}" data-title="${title}">
    <img src="https://i.ytimg.com/vi/${v.youtube}/hqdefault.jpg" alt="${title}" loading="lazy" width="480" height="360">
    <button class="play" aria-label="Play: ${title}"></button>
  </div>
  <figcaption>${title}</figcaption>
</figure>`;
  }
  if (v.vimeo) {
    return `<figure class="video-card">
  <div class="video video--vimeo"><iframe src="https://player.vimeo.com/video/${v.vimeo}?dnt=1" title="${title}" loading="lazy" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>
  <figcaption>${title}</figcaption>
</figure>`;
  }
  return "";
}

const videoGrid = (videos) =>
  `<div class="video-grid">\n${videos.map(videoCard).join("\n")}\n</div>`;

function postCard(p) {
  return `<article class="post-card">
  <a href="/post/${p.slug}">
    <img src="${p.cover_image}" alt="" loading="lazy">
    <div class="post-card__body">
      <time datetime="${p.date}">${fmtDate(p.date)}</time>
      <h3>${esc(p.title)}</h3>
      <p>${esc(p.excerpt)}</p>
    </div>
  </a>
</article>`;
}

// ---------- page layout ----------
const sitemap = [];

function layout({
  urlPath,
  title,
  fullTitle,
  description,
  ogImage,
  ogType = "website",
  body,
  bodyClass = "",
  noindex = false,
  jsonld = "",
}) {
  const canonical = site.url + (urlPath === "/" ? "" : urlPath);
  const navHtml = site.nav
    .map(
      (n) =>
        `<li><a href="${n.href}"${n.href === urlPath ? ' aria-current="page"' : ""}>${n.label}</a></li>`,
    )
    .join("");
  const socialHtml = site.social
    .map(
      (s) =>
        `<li><a href="${s.href}" target="_blank" rel="noopener">${s.label}</a></li>`,
    )
    .join("");
  const vars = {
    site,
    title: esc(title),
    fullTitle: esc(fullTitle || `${title} | ${site.name}`),
    description: esc(description || site.defaultDescription),
    canonical,
    ogImage: ((img) => (img.startsWith("/") ? site.url + img : img))(
      ogImage || site.ogImage,
    ),
    ogType,
    robots: noindex ? '<meta name="robots" content="noindex">' : "",
    jsonld,
    nav: navHtml,
    social: socialHtml,
    year: new Date().getFullYear(),
  };
  return `<!doctype html>
<html lang="en">
<head>
${fill(partials.head, vars)}
</head>
<body class="${bodyClass}">
${fill(partials.header, vars)}
<main id="main">
${body}
</main>
${fill(partials.footer, vars)}
<script src="/js/site.js" defer></script>
</body>
</html>
`;
}

// ---------- blog posts ----------
function parsePost(file) {
  const raw = read(path.join("content/posts", file));
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error("Missing front matter in " + file);
  const meta = {};
  for (const line of m[1].split("\n")) {
    if (/^\s*#/.test(line) || !line.trim()) continue;
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (!kv) continue;
    let [, k, v] = kv;
    v = v.trim();
    if (v.startsWith("["))
      v = v
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    else v = v.replace(/^"(.*)"$/, "$1");
    meta[k] = v;
  }
  const slug = file.replace(/\.md$/, "");
  const md = m[2].replace(/\{\{youtube:([\w-]+)\}\}/g, (_, id) =>
    videoCard({ youtube: id, title: "Thrill Wave reel" }),
  );
  const html = marked.parse(md);
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const excerpt =
    text.length > 140
      ? text.slice(0, 137).replace(/\s+\S*$/, "") + "..."
      : text;
  return {
    ...meta,
    slug,
    html,
    excerpt,
    description: text.slice(0, 155).replace(/\s+\S*$/, ""),
  };
}

const posts = fs
  .readdirSync(path.join(ROOT, "content/posts"))
  .filter((f) => f.endsWith(".md"))
  .map(parsePost)
  .sort((a, b) =>
    a.date < b.date ? 1 : a.date > b.date ? -1 : a.title.localeCompare(b.title),
  );

// ---------- build ----------
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });
copyDir(path.join(ROOT, "public"), DIST);

// Static pages
const blocks = {
  portfolio_featured: videoGrid(portfolio.featured),
  portfolio_intro: esc(portfolio.intro),
  portfolio_tabs: portfolio.categories
    .map(
      (c, i) =>
        `<button class="tab" role="tab" aria-selected="${i === 0}" aria-controls="cat-${c.slug}" id="tab-${c.slug}">${esc(c.name)}</button>`,
    )
    .join(""),
  portfolio_categories: portfolio.categories
    .map(
      (
        c,
        i,
      ) => `<section class="portfolio-cat" id="cat-${c.slug}" role="tabpanel" aria-labelledby="tab-${c.slug}"${i === 0 ? "" : " hidden"}>
  <h2 class="visually-hidden">${esc(c.name)}</h2>
  ${videoGrid(c.videos)}
</section>`,
    )
    .join("\n"),
  recent_posts: posts.slice(0, 3).map(postCard).join("\n"),
};

for (const file of fs.readdirSync(path.join(ROOT, "src/pages"))) {
  if (!file.endsWith(".html")) continue;
  const raw = read(path.join("src/pages", file));
  const metaMatch = raw.match(/^<!--\s*meta\s*(\{[\s\S]*?\})\s*-->\n?/);
  if (!metaMatch)
    throw new Error("Missing <!-- meta {...} --> line in " + file);
  const meta = JSON.parse(metaMatch[1]);
  const body = fill(raw.slice(metaMatch[0].length), { site, ...blocks });
  const name = file.replace(/\.html$/, "");
  if (name === "404") {
    fs.writeFileSync(
      path.join(DIST, "404.html"),
      layout({ urlPath: "/404", body, noindex: true, ...meta }),
    );
    continue;
  }
  const urlPath = name === "index" ? "/" : "/" + name;
  write(urlPath, layout({ urlPath, body, ...meta }));
}

// Blog posts
const postTpl = read("src/templates/post.html");
for (const p of posts) {
  const idx = posts.indexOf(p);
  const related = posts
    .filter((q) => q !== p)
    .slice(Math.max(0, idx - 1), Math.max(0, idx - 1) + 3);
  const jsonld = `<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: p.title,
    datePublished: p.date,
    author: { "@type": "Person", name: p.author },
    image: p.cover_image,
    publisher: {
      "@type": "Organization",
      name: site.name,
      logo: { "@type": "ImageObject", url: site.logo },
    },
    mainEntityOfPage: `${site.url}/post/${p.slug}`,
  })}</script>`;
  const body = fill(postTpl, {
    site,
    title: esc(p.title),
    date: p.date,
    dateLabel: fmtDate(p.date),
    author: esc(p.author),
    cover: p.cover_image,
    content: p.html,
    categories: (p.categories || [])
      .map((c) => `<a href="/blog/categories/${slugify(c)}">${esc(c)}</a>`)
      .join(""),
    related: related.map(postCard).join("\n"),
  });
  write(
    `/post/${p.slug}`,
    layout({
      urlPath: `/post/${p.slug}`,
      title: `${p.title}`,
      description: p.description,
      ogImage: p.cover_image,
      ogType: "article",
      body,
      bodyClass: "page-post",
      jsonld,
    }),
  );
}

// Blog index + category pages
const blogTpl = read("src/templates/blog.html");
const categoryNames = [
  ...new Set(posts.flatMap((p) => p.categories || [])),
].sort();
const catNav = (active) =>
  `<a href="/blog"${active ? "" : ' aria-current="page"'}>All Posts</a>` +
  categoryNames
    .map(
      (c) =>
        `<a href="/blog/categories/${slugify(c)}"${active === c ? ' aria-current="page"' : ""}>${esc(c)}</a>`,
    )
    .join("");

write(
  "/blog",
  layout({
    urlPath: "/blog",
    title: "Blog",
    description:
      "We write about what we know. Production, storytelling, the creative process, and what it actually takes to make something worth watching.",
    body: fill(blogTpl, {
      heading: "Blog",
      intro:
        "We write about what we know. Production, storytelling, the creative process, and what it actually takes to make something worth watching. Pull up a chair.",
      categories: catNav(null),
      posts: posts.map(postCard).join("\n"),
    }),
  }),
);

for (const c of categoryNames) {
  const list = posts.filter((p) => (p.categories || []).includes(c));
  write(
    `/blog/categories/${slugify(c)}`,
    layout({
      urlPath: `/blog/categories/${slugify(c)}`,
      title: `${c} | Blog`,
      description: `Thrill Wave blog posts about ${c.toLowerCase()}.`,
      body: fill(blogTpl, {
        heading: esc(c),
        intro: `${list.length} post${list.length === 1 ? "" : "s"}`,
        categories: catNav(c),
        posts: list.map(postCard).join("\n"),
      }),
    }),
  );
}

// sitemap.xml
const today = new Date().toISOString().slice(0, 10);
const postDates = Object.fromEntries(
  posts.map((p) => [`/post/${p.slug}`, p.date]),
);
fs.writeFileSync(
  path.join(DIST, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemap
  .map(
    (u) =>
      `  <url><loc>${site.url}${u === "/" ? "" : u}</loc><lastmod>${postDates[u] || today}</lastmod></url>`,
  )
  .join("\n")}
</urlset>
`,
);

console.log(
  `Built ${sitemap.length} pages (${posts.length} posts, ${categoryNames.length} categories) into dist/`,
);
