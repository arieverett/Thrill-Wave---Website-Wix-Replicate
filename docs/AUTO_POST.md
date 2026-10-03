# Twice-monthly blog post (scheduled task playbook)

A scheduled task runs this on the 1st and 15th of each month. It writes one new Intel post, checks it and publishes it to thrillwave.com. Partners can change anything here in plain English ("make the posts shorter", "pause the posts") and Claude updates this file or the scheduled task.

## 1. Get set up

- Clone the repo (`arieverett/thrill-wave-website-wix-replicate`), `npm ci`, and read `CLAUDE.md`.
- Read `dist/llms.txt` after `npm run build`, plus `content/home.json`, `content/portfolio.json` and `content/faq.json`: this is the source of truth for who Thrill Wave is, its services, industries, real clients and films.
- List every existing post (`content/posts/*.md`, titles and categories) so the new one doesn't repeat a topic.

## 2. Pick the topic

Pick one topic a real buyer would search for or ask an AI assistant, that Thrill Wave can answer from experience, and that no existing post covers. Rotate through the four categories (Craft, Industries, Arizona, Planning a Video) so the newest posts don't all share one. Good sources of topics:

- Questions buyers ask before hiring: what a brand film includes, how long a shoot day is, what to prep for an interview shoot, how to brief a production company when you don't know what you want, what happens in post.
- An industry from `content/home.json` (`industries`) and how video works there, tied to a real film or case study from the site.
- The SITREP process: why research comes before the camera.
- Arizona: shooting in the heat, golden hour in the desert, locations around Phoenix, Scottsdale, Tempe, Tucson, Flagstaff, Sedona (only facts you are sure of).
- Craft: lenses, light, sound, color, editing, documentary interviewing, aftermovies.

## 3. Write it

- 600 to 1,000 words. Title under 65 characters, plain and specific (the question people actually ask is often the best title).
- Voice: short, confident, plain words, first person plural. Warm, a little humor, a "heart of gold" tone. Reads like a person who has done this a hundred times. Brevity like sandwich.co, just a little more.
- Thrill Wave is a video production company (never "agency", "marketing agency" or "ad agency"). Prefer films, video, stories and work over "content" and "campaign".
- Never mention AI or how the post was made.
- Facts: never invent clients, projects, quotes, numbers, results, prices or awards. Real clients and films only as described in `content/home.json` and `content/portfolio.json`. Pricing only as on the FAQ page. No third-party statistics unless verified with a web search and linked to the original source.
- Link to 2 or 3 relevant pages on the site (a service, industry, case study, `/sitrep`, `/portfolio` or another post) and end with one short line linking to `/contact`.
- One `##` heading every few paragraphs; a short list is fine where it helps. No em dashes or spaced dashes. No `<br>`.
- It's fine to embed one real Thrill Wave film with `{{youtube:ID}}` on its own line, using an ID from `content/portfolio.json` that fits the topic.

Front matter:

```
---
title: "..."
date: <today, YYYY-MM-DD>
author: Thrill Wave
cover_image: /images/blog/<slug>/<descriptive-name>.jpg
categories: [<one or two of: Craft, Industries, Arizona, Planning a Video>]
---
```

The file name is the slug: lowercase, words joined by hyphens, under 60 characters, `content/posts/<slug>.md`.

## 4. Cover image

Use a real Thrill Wave photo. Pick the best-fitting cover from an existing post folder in `public/images/blog/` (prefer one not used by the last few posts), or from `public/images/blog/library/` if partners have added stills there. With Python (Pillow) save three versions in `public/images/blog/<slug>/`: `<name>.jpg` (1200px wide), `<name>.webp` (1200px) and `<name>-card.webp` (720px). Never use stock or downloaded images.

## 5. Check and publish

- `npm run check` must report 0 errors. Fix any warning about the new post (for example a long description).
- Read the built page in `dist/post/<slug>.html` once more for facts, voice and broken links.
- Commit to `main` with a plain message ("New post: <title>") and push. Cloudflare publishes it in a minute or two.
- If anything is uncertain (a fact you couldn't verify, no fitting image), leave it out rather than guess. If the post can't meet these rules, don't publish: push it to a branch named `draft/<slug>` instead and say why.

## 6. Report

Send the partners a short message: the post title, its link (`https://thrillwave.com/post/<slug>`), one line on why this topic, and anything they might want to check.
