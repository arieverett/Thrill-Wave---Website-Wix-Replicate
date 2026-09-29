# Wix → GitHub migration notes (updated Sept 27, 2026)

## How the content was captured

Wix doesn't export site code, so the live site was crawled page by page and rebuilt. Text is copied word for word (a few typos fixed, listed below). The layout follows the Wix design: League Spartan for the Futura-style headings, Montserrat for everything else, black pill navigation and arrow-box buttons, a white footer. Every page shares one content width (880px on desktop).

Where the new site goes beyond Wix, it's additive: entrance and scroll animations, video titles laid over every thumbnail (bold client, then the video name), a video lightbox, hover states, a category bar on the portfolio, one card style for every numbered tile (with arrows through the SITREP proof steps), a reading-progress bar on posts and smooth page-to-page transitions. All motion switches off for visitors who set "reduce motion" on their device.

## Page map

| Wix URL | New site |
|---|---|
| `/` | `src/pages/index.html` |
| `/portfolio` (6 categories, 36 videos) | `src/pages/portfolio.html` + `content/portfolio.json` |
| `/sitrep` | `src/pages/sitrep.html` |
| `/contact` | `src/pages/contact.html` |
| `/medical`, `/marketingchallenges`, `/app-landing-page` ("Process") | Rebuilt at launch, then taken off the site Sept 29, 2026 (not in the menu). 301 → `/portfolio#healthcare-medical`, `/contact`, `/sitrep`. Archived offline, not in this repo |
| `/blog` + posts at `/post/<slug>` | `content/posts/*.md` (58 posts; `premium-video-services-for-local-businesses-in-phoenix` removed Sept 29, 2026, 301 → `/blog`) |
| `/blog/categories/<cat>` | generated for the 8 categories that have posts |
| `/blog-feed.xml` | generated RSS feed at the same address |
| `/faq` (empty) | 301 → `/contact` |
| `/paywall`, `/inquiry-services-page` (Wix filler) | 301 → `/`, `/contact` |
| `/pricing-plans/*`, `/plans-pricing` (Wix "Plans & Pricing") | 301 → `/contact` |
| 5 empty blog categories (tech, sports, art, news, law) | 301 → `/blog` |

## Resolved

- **Reel:** "Watch our reel" and the "What we do" video play the Vimeo brand reel "Thrill Wave - Style is Eternal" (`1170100005`, set as `reel` in `content/site.json`).
- **Domain:** the canonical address moves from `www.thrillwave.com` (Wix) to `thrillwave.com`. A Cloudflare redirect rule sends every `www` URL to the same path without `www` (301), so old links, bookmarks and rankings follow. See README > Deploy.
- **Images:** all 112 downloaded from Wix, renamed descriptively, organized by page and compressed to WebP. Nothing loads from `static.wixstatic.com` any more.
- **Client logos:** all 13 identified and named (alt text): Relentless Beats, NFL, State Farm, NBC, UFC, Thermo Fisher Scientific, Golf Digest, Boston Scientific, Uber, UBS, 1st Bank, Aura, Pathnostics.
- **Calendly:** the booking widget uses the "30 Minute Video Consult" event (`christhrillwave/30-minute-meeting-clone`) and shows two columns with no inner scrolling.
- **Aurelio PT – Mission Statement:** the Vimeo ID captured from Wix (`2128718462`) no longer exists. It now uses YouTube `ASbLkvgd874`, the video whose thumbnail matches the Wix tile.
- **"Goilf Digest"** typo on Wix corrected to "Golf Digest". "Find a solution for that works" and "theres" typos fixed on /medical and /marketingchallenges.
- **`{Company Name}`** placeholder in `premium-video-services-for-local-businesses-in-phoenix` (five times on Wix) replaced with "Thrill Wave". (Post removed Sept 29, 2026.)

## Still open (need something from the team)

1. **ITCA video on /sitrep.** Wix embeds a Vimeo video; its ID wasn't readable, so "ITCA WIC - Dear Mom" (YouTube) stands in. Add the Vimeo ID as `itcaVimeoId` in `content/site.json`.
2. **Two stand-in photos.** The home hero (Wix plays a halftone camera close-up video) and the /sitrep top strip (an orange-lit on-set photo) use similar photos from the site. Send the originals and they drop straight in. (The /contact banner original, hands touching at a concert, went in Sept 29, 2026 as `images/contact/hands-touching-at-concert.webp`.)
3. **Contact page mailbox.** The Wix copy says "the address below is just our mailbox", but the map only shows Phoenix. Add the mailbox address or trim the sentence.
4. **SITREP animation.** Wix shows an animated particle graphic above the three steps (a custom embed). A static three-step panel stands in; send the embed code to recreate it.
5. ~~**Medical page videos** and **Marketing Challenges "Listen to our clients"**~~ No longer needed: both pages were taken off the site Sept 29, 2026.
6. **Two posts end mid-sentence on Wix too:** `the-history-of-cinema-in-the-state-of-arizona-and-the-future` and `how-large-companies-can-leverage-ai-to-create-personalized-ad-campaigns-for-their-customers`. Finish or trim them.
7. ~~**Wix stock photos** on /marketingchallenges~~ Replaced Sept 28, 2026 with Thrill Wave shoot stills (doctor-explaining-scan-wide, clinicians-reviewing-tablet).
8. **`FORM_WEBHOOK_URL`** needs a destination before launch (see README > Deploy). The only lead forms were on /marketingchallenges and /app-landing-page, so no page has a form since Sept 29, 2026; the handler (`functions/api/contact.js`) is kept for the next one.
9. **Aurelio PT titles.** Wix listed "Fitness Forward Performance" under two different YouTube IDs (`Ny-eNXzNrtA` under Healthcare, `ASbLkvgd874` under Sports), and `ASbLkvgd874` is also the video behind the Mission Statement tile. Confirm which video is which and fix the titles in `content/portfolio.json`.

## Wix-only features that didn't come over

- Blog likes, views and comments, member profiles (`/profile/*` now redirects to the blog) and the paywall.
- Wix Forms submission history and Wix Analytics history. Export them from the Wix dashboard before cancelling.
