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

1. ~~**ITCA video on /sitrep.**~~ Closed Oct 1, 2026: "ITCA WIC - Dear Mom" is the right film for that spot (the WIC PSA the results paragraph describes), so it stays. `itcaVimeoId` remains available if a Vimeo version is ever preferred.
2. ~~**Stand-in header photos**~~ Done Sept 29, 2026: the /contact banner uses the original photo, and Home and SITREP play the Vimeo header video "Thrill Wave - Site Lander" (`1231402333`, set as `headerVideo` in `content/site.json`).
3. ~~**Contact page mailbox.**~~ Closed Oct 1, 2026: the mailbox sentence is no longer on /contact.
4. **SITREP animation.** Wix shows an animated particle graphic above the three steps (a custom embed). A static three-step panel stands in; send the embed code to recreate it.
5. ~~**Medical page videos** and **Marketing Challenges "Listen to our clients"**~~ No longer needed: both pages were taken off the site Sept 29, 2026.
6. ~~**Two posts end mid-sentence on Wix too:**~~ Closed Oct 1, 2026: the AI ad-campaign post was removed with the other AI posts, and the Arizona cinema history post was removed (factual errors and copyrighted movie posters); both URLs 301 to /blog.
7. ~~**Wix stock photos** on /marketingchallenges~~ Replaced Sept 28, 2026 with Thrill Wave shoot stills (doctor-explaining-scan-wide, clinicians-reviewing-tablet).
8. **`FORM_WEBHOOK_URL`** needs a destination before launch (see README > Deploy). The /contact page has the lead form again since Sept 29, 2026 (fields: source, first_name, last_name, email, phone, organization, message). Send a test lead after any change to the form or webhook.
9. ~~**Aurelio PT titles.**~~ Closed Oct 1, 2026: `ASbLkvgd874` is Aurelio's "Fitness Forward Performance" ad (Healthcare and Sports). `Ny-eNXzNrtA` is actually a Thrill Wave healthcare and medical supercut (per its YouTube description), now titled that way; its YouTube title still says Aurelio and should be renamed on YouTube.

## Wix-only features that didn't come over

- Blog likes, views and comments, member profiles (`/profile/*` now redirects to the blog) and the paywall.
- Wix Forms submission history and Wix Analytics history. Export them from the Wix dashboard before cancelling.

## Next up (noted Sept 29, 2026)

- ~~About us page~~ Done Sept 29, 2026 (`/about`, copy adapted from the terminal site). Contact form added to `/contact` the same day.
- **Case studies:** start with ITCA (TEC, WIC, Your Voice Your Power): problem, SITREP finding, film, result.
- **Blog cleanup before any automation:** prune or redirect 2023 posts that pitch a "marketing agency", refresh the best, then ~2 edited posts a month.
- **Google Business Profile:** new tagline, services, photos, a push for 10+ reviews.
- **Pages the homepage buttons are waiting for (noted Sept 30, 2026; build only when Ari asks):** `/services` ("See our services" in What we do), `/who-we-serve` ("See who we serve") and `/process` ("See our process"). The buttons are already in `src/pages/index.html` with `data-until-built`, so they point back to their own homepage section until the page file exists, then link to it on their own.
- **Homepage rethink (started Sept 30, 2026):** final section order and copy, fewer sections, a conversational voice that reads like a 30-second pitch (references: sandwich.co and the Thrill Wave terminal site; lookstudios.co as the "too much" example). Ari will send full-page screenshots of reference sites.
- **Housekeeping:** make the GitHub repo private; DMARC to p=quarantine a few weeks after launch; compare Search Console and Cloudflare numbers to the Wix baseline (~84 visits/month) around the end of October.
- ~~**Code cleanup with speed, SEO and AEO in mind**~~ Done Oct 1, 2026: removed ~70 unused style rules left from the Wix-era pages, merged repeated video-player code, added the services to the structured data, descriptive alt text on team photos and case-study stills, and made the homepage sections reusable (`src/templates/page-starter.html`, body classes `page-sections` and `page-typed`, see CLAUDE.md > Building a new page).
- **Content engine:** automatically draft and publish new Intel articles every week or month for SEO and answer engines (AEO).
- **Rebuild on Astro** plus a broader design and backend overhaul (see README > Moving to Astro later).
