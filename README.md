# thrillwave.com

This repo holds the Thrill Wave website. It is plain HTML, CSS and JS, built by a small Node script and hosted free on Cloudflare Pages.

It was rebuilt from the live Wix site in September 2026. Every Wix URL is kept, either as a page at the same address or as a 301 redirect, so search rankings carry over.

## Run it locally

```bash
npm install
npm run dev        # builds and serves at http://localhost:8788
```

## Where things live

| To change… | Edit |
|---|---|
| Header or footer on every page | `src/partials/header.html`, `src/partials/footer.html` |
| `<head>` tags and analytics snippet | `src/partials/head.html` |
| A page's content | `src/pages/<page>.html` (the first line holds its title and description) |
| Phone, email, nav, social links | `content/site.json` |
| Portfolio videos | `content/portfolio.json` (YouTube ID or Vimeo ID per video) |
| Blog posts | `content/posts/<slug>.md` (the slug becomes `/post/<slug>`) |
| Colors, fonts, spacing | `public/css/site.css` (tokens at the top) |
| Old-URL redirects | `public/_redirects` |

To add a blog post, drop a new `.md` file into `content/posts/` with the same front matter as the others. Push it, and Cloudflare rebuilds the site.

To add a page, create `src/pages/new-page.html`. It is served at `/new-page`.

## Deploy (Cloudflare Pages)

1. Push this repo to GitHub.
2. In Cloudflare, go to Workers & Pages → Create → Pages → Connect to Git, and pick the repo.
3. Use these build settings:
   - Build command: `npm run build`
   - Output directory: `dist`
   - Environment variable: `NODE_VERSION = 22`
4. Add the environment variable `FORM_WEBHOOK_URL`. Every lead form posts to `/api/contact` (in `functions/api/contact.js`), which forwards the submission as JSON to this URL. It can be a Zapier, Make or HubSpot webhook, a Slack webhook, or a Google Apps Script that writes to a Sheet.
5. Test on the `*.pages.dev` preview URL first. Then go to Custom domains, add `www.thrillwave.com` and `thrillwave.com`, and add a redirect rule sending `thrillwave.com/*` to `https://www.thrillwave.com/$1` (301). The Wix site used `www` as its canonical address, so keep it that way.

A push to `main` deploys to production. Any other branch gets a preview URL.

## Before cancelling Wix

- [ ] Run `npm run localize-images` on your own machine. It downloads every image still hosted on `static.wixstatic.com` into `public/images/wix/` and rewrites the references. Those URLs stop working once the Wix site is deleted. Commit the result.
- [ ] Replace the Wix stock photos. Files whose names start with `11062b_` are licensed for use on Wix only; they appear on `/marketingchallenges` and `/sitrep`.
- [ ] Set `FORM_WEBHOOK_URL`, then send a test lead from `/marketingchallenges` and `/app-landing-page`.
- [ ] Turn on analytics: GA4 (paste its snippet into `src/partials/head.html`) and/or Cloudflare Web Analytics (a toggle in the Pages dashboard).
- [ ] Submit `https://www.thrillwave.com/sitemap.xml` in Google Search Console. The existing `google-site-verification` TXT record carries over in Cloudflare DNS.
- [ ] Work through the open items in `docs/MIGRATION_NOTES.md`.

## Moving to Astro later

The layout is set up for a clean move: partials become components, `content/posts` becomes a content collection, and `portfolio.json` stays as-is. To start, tell Claude Code: "Convert this site to Astro, keep every URL and the visual output identical."
