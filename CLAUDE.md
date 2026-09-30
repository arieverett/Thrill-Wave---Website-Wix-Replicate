# Working on thrillwave.com (instructions for Claude)

The Thrill Wave partners (Ari, Tony, Chris) are not developers. They ask Claude to make changes in plain English; Claude edits this repo, checks the result, and pushes. Keep explanations non-technical and confirm what changed on the live site.

## How the site works

- `build.mjs` turns templates + content into plain HTML in `dist/`. Never edit `dist/`; it is regenerated.
- `npm run dev` previews locally at http://localhost:8788 (opens the browser, reloads on save).
- `npm run check` builds and audits every page. It must report 0 errors before any push.
- Cloudflare Pages builds and deploys on every push to `main` (build command `npm run build`, output `dist`). Other branches get a preview URL: use a branch for anything the partners should see before it goes live.

## Where to make common changes

| Request | Edit |
|---|---|
| Text on a page | `src/pages/<page>.html` (line 1 holds the page title and meta description) |
| Add or edit a blog post | `content/posts/<slug>.md` (front matter: title, date, author, cover_image, categories) |
| Add/remove a portfolio video | `content/portfolio.json` (`client`, `title`, `youtube` ID) |
| Phone, email, nav, social links, team (incl. About page bios), reel video | `content/site.json` |
| Homepage lists: services (What we do), Who we serve (portrait tiles on a still from one of our films: its `youtube` ID), Industries (short name, example clients, link to the matching work), Our process steps, client logo carousel | `content/home.json` (icons are named in `ICONS` in `build.mjs`) |
| Header background video on Home and SITREP (Vimeo ID + poster, which is the video's Vimeo thumbnail URL) | `content/site.json` → `headerVideo` |
| Blog page description (shown in Google) | `build.mjs`, the `write('/blog', …)` call |
| Header, footer, `<head>` | `src/partials/` |
| Colors, fonts, spacing, animation | `public/css/site.css` (tokens at the top) |
| Redirects for old or changed URLs | `public/_redirects` |

## Rules

- Never change or remove a published URL without adding a 301 in `public/_redirects`.
- Images: save as WebP in `public/images/<page>/` with a descriptive kebab-case name, max ~1600px wide. The build adds width/height automatically. Every `<img>` needs alt text (empty `alt=""` only for decorative images).
- Blog cover images need a `.jpg` (1200px wide, used for social previews) plus `.webp` and `-card.webp` (720px) versions next to it.
- Keep the design system: mostly black pages (Portfolio, Blog, Contact, SITREP and most homepage sections) with a few white or grey bands; a see-through header that turns into a dark bar on scroll, with white text links and plain Call / text and Email us buttons; a very dark grey footer with a legal bar; one highlight colour, red `--accent` (pure red: #FF0000, RGB 255/0/0, CMYK 0/100/100/0; About page hero, hovers, focus rings, marks, arrows and small highlights; anything filled red gets white text); every page except Contact ends with the shared black `{{start_project}}` block that links to `/contact#start`; League Spartan for headings, Montserrat for everything else; one content width (`--content`); tiles use the `.step-cards` style; video tiles use `videoLink()` in `build.mjs`.
- Page titles use one format: `Page name | Thrill Wave` (the homepage is `Thrill Wave | Video Production Company`; long blog post titles stand alone). Don't use em dashes or spaced dashes in site copy; use a comma, colon or a new sentence.
- **Text width rule (all pages, including new ones):** paragraph text always runs the full width of its column and wraps naturally, on desktop and mobile. Never add character caps (`max-width: …ch`), fixed widths or `text-wrap: pretty/balance` to paragraphs, intros, lists or quotes, and never hard-break lines with `<br>` to shape a paragraph. Only headlines (h1 to h3) may be capped. `npm run check` fails if the stylesheet breaks this. When building a page, check every paragraph fills its column at laptop and phone widths before pushing.
- Keep one `<h1>` per page. Meta descriptions must fit Google without "...": the homepage's stays at about 140 characters or less, and the menu pages (About, Work, SITREP, Blog, Contact) stay at about 55 characters or less, because Google shows them as one-line sitelinks under the homepage result. Everything else stays under 160.
- The public site is Home, About, Work (`/portfolio`), SITREP, Blog (with its posts) and Contact, plus Privacy policy and Terms of service (linked from the footer only, noindex). Pages removed from the site are listed with their 301s in `public/_redirects`; don't bring them back or add unlinked pages without asking.
- Anything new that loads from another domain (analytics, embeds) must be added to the Content-Security-Policy in `public/_headers`.
- Homepage sections end with a button row (`.section__actions.btn-row`): a clear button to the section's own page, and the red Start a project button only in a few sections (01 Who we are, 04 Industries, 08 SITREP) plus the closing Start a project block. A button to a page that doesn't exist yet carries `data-until-built="#section-id"`; the build points it at that section until `src/pages/<page>.html` exists, so there are never broken links.
- Open items and history are in `docs/MIGRATION_NOTES.md`.
