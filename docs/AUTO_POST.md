# Twice-monthly blog post (scheduled task playbook)

A scheduled task runs this on the 1st and 15th of each month. It writes one new Intel post, checks it and publishes it to thrillwave.com. Partners can change anything here in plain English ("make the posts shorter", "more posts about editing", "pause the posts") and Claude updates this file or the scheduled task.

## What these posts are

Education and expertise first, search second, selling never. Each post teaches a curious reader something real about the art, craft, science or tech of filmmaking and communication, the way film nerds talk to each other: specific, generous and a little obsessed.

Thrill Wave is a production company and a team of creatives (writers, producers, directors, cinematographers, editors, sound people) who care about the world, people and stories, and about the communication, tech and medicine that make the world go round. Posts sound like us talking shop, not like a company pitching.

- Never say how many people Thrill Wave is, or call it small, tiny or lean (no "the three of us", "three partners", "small team"). Say "we", "our founders" or "our crew".
- No selling, pricing, promo or "why you should hire a video team". Never "marketing agency" or "ad agency". Prefer films, stories, work and craft over "content" and "campaign".
- Never mention AI or how the post was made.
- At most one short, soft line at the very end that points somewhere useful (a related film, `/portfolio`, `/sitrep` or `/contact`). The page already ends with a "Start a project" block.

## 1. Get set up

- Clone the repo (`arieverett/thrill-wave-website-wix-replicate`), `npm ci`, read `CLAUDE.md`, then `npm run build`.
- Read `dist/llms.txt`, `content/home.json` and `content/portfolio.json`: who Thrill Wave is, its films, clients and industries.
- List every existing post (`content/posts/*.md`: titles, dates, categories) so the new one doesn't repeat a topic and the categories rotate.

## 2. Pick the topic

One specific question a filmmaker, producer, communicator or curious client would actually search or ask an AI assistant. Niche is good: a narrow, deep, correct answer beats a broad, shallow one. Rotate through these veins:

- **Gear and glass:** specific lenses, cameras and tools. Angénieux zooms and anamorphics, Cooke, Zeiss, Atlas, Sirui; Sony FX9, FX6, FX3, Burano and Venice; anamorphic squeeze factors and desqueeze; ND filters; gimbals and drones.
- **How-tos for working crews:** setting up vertical anamorphic on a Sony FX9; matching two camera bodies in color; recording clean dialogue in a loud room; lighting an interview in an Arizona office with a west-facing window.
- **Science and engineering:** sensor size and crop factor, dynamic range and stops, global vs rolling shutter, bit depth and codecs, lens coatings and how glass is made, how the eye perceives motion and color, why 24 fps and the 180-degree shutter.
- **Intersections:** where other fields push film forward, explained carefully. New sensor tech from phones reaching cinema cameras, display and rendering advances (for example how Apple renders "liquid glass" in software vs how real glass bends light), medical imaging and optics, audio tech, color science on streaming platforms.
- **The disciplines and their woes:** the writer who leans on exposition, the producer who can't see the whole story, the editor's discipline of killing darlings, the director's prep, the DP's fight with the schedule, the sound mixer nobody thanks.
- **Art and film history:** a technique, a famous shot or a movement, what it teaches now.
- **Communication that matters:** how to film patients, scientists, engineers and communities with honesty and care; explaining complex medical or technical ideas on camera; the Arizona light and landscape.
- Thrill Wave's own work, when it genuinely illustrates the point (a film from `content/portfolio.json`, a case study, the SITREP).

## 3. Research before writing

- Web search every fact, spec, date and number, and confirm it on the original source (the manufacturer's spec page, the paper, the official announcement, a respected trade outlet like American Cinematographer, ProVideo Coalition, Newsshooter or CineD). If two sources disagree, use the manufacturer or say so.
- Never invent specs, prices, quotes, studies, clients, results or Thrill Wave experiences. If you can't verify it, leave it out.
- Keep a list of sources as you go: they appear at the end of the post.

## 4. Write it

- 700 to 1,200 words. Brief, concise, no filler: every sentence earns its place. Title under 65 characters, specific and plain (the question people ask is often the best title).
- Voice: first person plural, warm and confident, nerdy in the best way, a little humor, a "heart of gold" tone. Explain jargon the first time in a few words, then use it.
- Structure: a short opening that states the problem or question, then `##` sections, then a short close.
- **Something visual in nearly every section** (roughly every two or three short paragraphs), mixing types, at least four per post:
  - a table (specs, comparisons, settings, a checklist of numbers),
  - a chart made with `scripts/chart.py` (only sourced numbers; source in the caption),
  - a big-number callout: `> **2x** squeeze: an anamorphic lens fits twice the width of view onto the same sensor.`,
  - a photo or film frame with a caption (see step 5),
  - one of our films embedded with `{{youtube:ID}}` on its own line, when it fits.
  Use real numbers, percentages, measurements and dollars wherever they teach something (focal lengths, stops, millimeters, frame rates, bit rates, kilograms, years).
- Link to 1 or 2 relevant pages on the site where natural, and to sources inline where a claim comes from them.
- End with a `## Sources` list: `- [Title](URL), Publisher`.
- No em dashes or spaced dashes (comma, colon or new sentence). No `<br>`. Keep Phoenix and Arizona mentions where they're natural, never stuffed.

Front matter:

```
---
title: "..."
description: "One plain sentence for Google, 120 to 155 characters."
date: <today, YYYY-MM-DD>
author: Thrill Wave
cover_image: <see step 5>
cover_alt: "What the cover image shows, in a short phrase"
categories: [<one or two of: Gear and Tech, Craft, Storytelling, Industries, Arizona, Planning a Video>]
---
```

The file name is the slug: lowercase words joined by hyphens, under 60 characters, `content/posts/<slug>.md`.

## 5. Images (cover and in the post)

The workspace can't download images from other sites, so outside images are shown directly from their source. Pick in this order, choosing whatever fits the topic best:

1. **Our library:** stills partners add to `public/images/blog/library/`, or a fitting photo already in `public/images/blog/` (avoid covers used by the last few posts). For a cover, save `.jpg` (1200px) + `.webp` (1200px) + `-card.webp` (720px) with Pillow in `public/images/blog/<slug>/`.
2. **A frame from one of our films:** YouTube `https://i.ytimg.com/vi/<ID>/maxresdefault.jpg` (IDs in `content/portfolio.json`; `maxres1.jpg` to `maxres3.jpg` give other frames, but only use those for IDs the site already uses that way, e.g. a `still` of `ID:2` in `content/home.json`). Caption it with the film's name.
3. **Stock from Unsplash** (free Unsplash License only, never Unsplash+ / plus.unsplash.com): find a photo with WebFetch on `https://unsplash.com/s/photos/<search-terms>`, take its `https://images.unsplash.com/photo-...` address and add `?w=1600&h=900&fit=crop&q=80&auto=format` (in-post images may use other sizes, always with both `w` and `h`). Caption: `*Photo: <Photographer> on [Unsplash](<photo page URL>).*`. Pick photos that look real and cinematic, not cheesy stock.

In the post, every image is followed on the next line by an italic caption: `![alt text](src)` then `*caption*`. Alt text describes the image; the caption adds meaning or credit.

## 6. Check and publish

- `npm run check` must report 0 errors and no warnings about the new post.
- Re-read the built page in `dist/post/<slug>.html`: facts against sources, voice, every image and link, at least four visuals.
- Commit to `main` ("New post: <title>") and push. Cloudflare publishes it in a minute or two.
- If something can't meet these rules (a fact you couldn't verify, no fitting image), cut it. If the post as a whole can't meet them, push it to a branch named `draft/<slug>` instead of `main` and say why.

## 7. Report

Send the partners a short message: the post title, its link (`https://thrillwave.com/post/<slug>`), one line on why this topic, and anything worth a second look.
