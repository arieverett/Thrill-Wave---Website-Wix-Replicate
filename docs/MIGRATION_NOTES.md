# Wix → GitHub migration notes (Sept 27, 2026)

## How the content was captured

Wix doesn't export site code, so the live site was crawled page by page and rebuilt by hand. The text is copied word for word. The layout and visual design are a clean re-creation, not a pixel copy. The fonts (Archivo / Archivo Black) are a stand-in; swap them in `public/css/site.css` if you know the originals.

## What was captured

| Wix URL | New site |
|---|---|
| `/` | `src/pages/index.html` |
| `/portfolio` (6 categories, 36 videos) | `src/pages/portfolio.html` + `content/portfolio.json` |
| `/sitrep` | `src/pages/sitrep.html` |
| `/contact` | `src/pages/contact.html` |
| `/medical` | `src/pages/medical.html` |
| `/marketingchallenges` | `src/pages/marketingchallenges.html` |
| `/app-landing-page` ("Process") | `src/pages/app-landing-page.html` |
| `/blog` + 59 posts at `/post/<slug>` | `content/posts/*.md` |
| `/blog/categories/<cat>` | generated for the 8 categories that have posts |
| `/faq` (empty, "No FAQs yet") | 301 → `/contact` |
| `/paywall` (Wix members error page) | 301 → `/` |
| `/inquiry-services-page` (Wix template filler text) | 301 → `/contact` |
| `/pricing-plans/plans-pricing` (same packages as /medical) | 301 → `/medical#packages` |
| 5 empty blog categories (tech, sports, art, news, law) | 301 → `/blog` |

## Things to check or fix (all flagged in the code with TODO or NOTE)

1. **"Watch our reel" button (home).** I couldn't read where the Wix button pointed, so it currently links to `/portfolio`. A 2023 post embeds reel `qpYa-VZRO2g`; if there's a newer reel, use that.
2. **Andres Plastic Surgery video.** The portfolio page listed it as a Vimeo video (ID `2128733738`), while the home page listed it as YouTube `N3yfL_gk_vE`. The YouTube version is used everywhere.
3. **Aurelio PT – Mission Statement.** Captured as Vimeo ID `2128718462`. Confirm it plays.
4. **Aurelio PT – Fitness Forward Performance.** Two different YouTube IDs were captured: `Ny-eNXzNrtA` (Healthcare tab) and `ASbLkvgd874` (Sports tab). One is probably a re-upload.
5. **"Goilf Digest" typo** on Wix. Corrected to "Golf Digest".
6. **Client logos.** Six logos had no readable name, so their alt text is "Client logo". Add the real client names; this helps both SEO and accessibility.
7. **Medical page video thumbnails** and **Marketing Challenges "Featured videos."** Wix showed thumbnails without readable video IDs. Medical shows the thumbnails as images; Marketing Challenges uses the home-page featured reel for now. Swap in the real embeds.
8. **Contact page mailbox address.** The Wix copy says "the address below is just our mailbox", but the address itself wasn't readable. Add it or drop the sentence.
9. **Blog post `premium-video-services-for-local-businesses-in-phoenix`.** The live post literally says "{Company Name}" five times. Replaced with "Thrill Wave".
10. **Two posts end mid-sentence on Wix** as well: `the-history-of-cinema-in-the-state-of-arizona-and-the-future` and `how-large-companies-can-leverage-ai-to-create-personalized-ad-campaigns-for-their-customers`. They were copied as-is; finish or trim them.
11. **Wix stock photos** (`11062b_*`) on `/marketingchallenges` and `/sitrep` are licensed for Wix sites only. Replace them.
12. **Hero images ending in `f000.jpg`** are poster frames from Wix background videos. If you want motion back, host the clip (YouTube, Vimeo or Cloudflare Stream) and add a `<video>` element.
13. **Contact page form.** The Wix contact page had no form, so none was added (to stay faithful). The site's forms live on `/marketingchallenges` and `/app-landing-page`. Adding one to `/contact` is a one-line copy.

## Wix-only features that didn't come over

- The Wix blog's likes, views and comments, member profiles (`/profile/*` now redirects to the blog) and the paywall.
- Wix Forms submissions history. Export it from the Wix dashboard (Contacts / Form submissions) before cancelling.
- Wix Analytics history. Export anything you want to keep.
