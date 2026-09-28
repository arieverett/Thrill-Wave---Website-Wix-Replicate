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
| Phone, email, nav, social links, team, reel video | `content/site.json` |
| Medical packages and prices | `content/medical.json` |
| Header, footer, `<head>` | `src/partials/` |
| Colors, fonts, spacing, animation | `public/css/site.css` (tokens at the top) |
| Redirects for old or changed URLs | `public/_redirects` |

## Rules

- Never change or remove a published URL without adding a 301 in `public/_redirects`.
- Images: save as WebP in `public/images/<page>/` with a descriptive kebab-case name, max ~1600px wide. The build adds width/height automatically. Every `<img>` needs alt text (empty `alt=""` only for decorative images).
- Blog cover images need a `.jpg` (1200px wide, used for social previews) plus `.webp` and `-card.webp` (720px) versions next to it.
- Keep the design system: an all-black site (white text; `--ink` is the text color and `--paper` the background in `site.css`); League Spartan for headings, Montserrat for everything else; one content width (`--content`); tiles use the `.step-cards` style; video tiles use `videoLink()` in `build.mjs`.
- Keep meta descriptions under 160 characters and one `<h1>` per page.
- Anything new that loads from another domain (analytics, embeds) must be added to the Content-Security-Policy in `public/_headers`.
- Open items and history are in `docs/MIGRATION_NOTES.md`.
