import { site, home, portfolio, faq, socialIcons, shownSocial } from './context.mjs';
import { esc, slugify, fmtDate } from './helpers.mjs';
import { still, videoAttrs, videoLink, workGrid, vimeoEmbed, findVideo } from './media.mjs';
import { posts } from './posts.mjs';

// ---------------------------------------------------------------------------
// Reusable HTML blocks
// ---------------------------------------------------------------------------
// ---- blocks available to src/pages as {{name}} ----
// ---- line icons (24px grid, drawn with currentColor) ----
export const ICONS = {
  compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3"/>',
  camera: '<rect x="2.5" y="7" width="13" height="10" rx="2"/><path d="M15.5 10.5l6-3v9l-6-3z"/>',
  sliders: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  aperture: '<circle cx="12" cy="12" r="9"/><path d="M12 3l3 7M21 12l-7 2M16 20l-4-6M5 18l5-6M4 8l7 2M12 3L9 10"/>',
  sparkle: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M18.5 16l.6 1.9 1.9.6-1.9.6-.6 1.9-.6-1.9-1.9-.6 1.9-.6z"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  heart: '<path d="M12 20s-7-4.4-9-8.6C1.6 8.4 3.5 5 6.8 5c2 0 3.4 1.1 5.2 3 1.8-1.9 3.2-3 5.2-3 3.3 0 5.2 3.4 3.8 6.4C19 15.6 12 20 12 20z"/>',
  building: '<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M10 21v-3h4v3"/>',
  clapper: '<rect x="3" y="10" width="18" height="11" rx="1.5"/><path d="M3 10l1.3-5.2 16.2 2.9L20 10M8.4 5.6L9.8 10M13.6 6.5L15 10"/>',
  bulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.9V16h5v-.2c0-.8.4-1.5 1-1.9A6 6 0 0 0 12 3z"/>',
  chat: '<path d="M4 5h16v11H9.5L4 20z"/><path d="M8 9.5h8M8 12.5h5"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.7 2.7L16 9.8"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  photo: '<rect x="3" y="6.5" width="18" height="13" rx="2"/><path d="M8.5 6.5L10 4h4l1.5 2.5"/><circle cx="12" cy="13" r="3.5"/>',
  wave: '<path d="M3 12h2M7 8v8M11 5v14M15 9v6M19 7v10M21 12h0"/>',
  broadcast: '<circle cx="12" cy="12" r="1.6"/><path d="M8.5 15.5a5 5 0 0 1 0-7M15.5 8.5a5 5 0 0 1 0 7M5.6 18.4a9 9 0 0 1 0-12.8M18.4 5.6a9 9 0 0 1 0 12.8"/>',
  radar: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 12l6.4-6.4"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>',
  // Industries (homepage)
  pulse: '<path d="M3 12h4l2.5-6 5 12 2.5-6h4"/>',
  landmark: '<path d="M3 9l9-5 9 5z"/><path d="M5.5 9v9M10 9v9M14 9v9M18.5 9v9M3 20.5h18"/>',
  trophy: '<path d="M7 4h10v4.5a5 5 0 0 1-10 0z"/><path d="M7 6H4.5a2.8 2.8 0 0 0 3.1 3.9M17 6h2.5a2.8 2.8 0 0 1-3.1 3.9M12 13.5V17"/><rect x="8.5" y="17" width="7" height="3.5" rx=".8"/>',
  music: '<path d="M9 18V5.5l11-2V16"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  chart: '<path d="M4 20h16"/><path d="M5 16l4.5-5 3.5 3 6-7.5"/><path d="M15 6.5h4v4"/>',
  chip: '<rect x="7" y="7" width="10" height="10" rx="1.5"/><path d="M10 7V4M14 7V4M10 20v-3M14 20v-3M7 10H4M7 14H4M20 10h-3M20 14h-3"/>',
  hardhat: '<path d="M5 16a7 7 0 0 1 14 0"/><path d="M10 9.5V6h4v3.5"/><rect x="3" y="16" width="18" height="3.5" rx="1"/>',
  bag: '<path d="M5 8h14l-1.2 12H6.2z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>',
  house: '<path d="M4 11l8-7 8 7"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-5h4v5"/>',
  glass: '<path d="M8 3h8l-.4 5.2a3.6 3.6 0 0 1-7.2 0z"/><path d="M12 11.8V20M8.5 20h7"/>',
};
export const icon = (name) =>
  `<svg class="icon" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
export const pad2 = (n) => String(n).padStart(2, '0');
// Three numbered facts about a customer type or industry (`points` in content/home.json, full sentences):
// who we work with, how we help, what we make. Led in by a short sentence, so the row never appears unannounced.
export const POINT_LABELS = ['Who we work with', 'How we help', 'What we make', 'Where it plays'];
export const pointsBlock = (points, lead = "Here's the short version:") => (points?.length
  ? `<p class="detail-points__lead">${esc(lead)}</p>
    <ol class="detail-points">${points.map((pt, k) => `<li><span class="detail-points__num">${pad2(k + 1)}</span><h3>${POINT_LABELS[k]}</h3><p>${esc(pt)}</p></li>`).join('')}</ol>`
  : '');
// One section per customer type or industry (Our customers, Industries): the name, a short headline, one or two
// plain sentences (`about` in content/home.json, ending with a colon that leads into the film), the film, and a link
// to that entry's own page. `pathOf` gives each entry's page; `more` is the button text that links to it
export function detailSections(list, pathOf, more) {
  return list.map((x, i) => {
    const dark = i % 2 === 0;
    const ref = typeof x.example === 'string' ? findVideo(x.example) : x.example;
    const film = ref && videoLink({ ...ref, zoom: x.zoom && x.zoom !== 'vertical' }, { feature: true, hires: true });
    return `<section class="section${dark ? ' section--dark' : ''} case-study" id="${slugify(x.name)}">
  <div class="container">
    <p class="kicker">${esc(x.name)}</p>
    <h2 class="section__title">${esc(x.title || x.name)}</h2>
    <div class="case-study__grid case-study__grid--text-first">
      <div class="case-study__text"><p>${esc(x.text)}</p><p>${esc(x.about || '')}</p></div>
      <div class="case-study__film">${film || ''}</div>
    </div>
    ${pointsBlock(x.points)}
    ${pathOf ? `<div class="section__actions btn-row"><a class="btn btn--plain btn--pill ${dark ? 'btn--clear' : 'btn--clear-dark'}" href="${pathOf(x)}">${esc(more(x))}</a></div>` : ''}
  </div>
</section>`;
  }).join('\n\n');
}

// ---- the breakout pages' addresses (built further down, see "Breakout pages") ----
// /industries/medical-and-biotech, /who-we-serve/agencies, /case-studies/dear-mom. A customer type can share
// another page instead (`page` in content/home.json: Nonprofits uses the Nonprofits industry page).
export const industryPath = (x) => `/industries/${slugify(x.name)}`;
export const audiencePath = (x) => x.page || `/who-we-serve/${slugify(x.name)}`;
export const casePath = (x) => `/case-studies/${slugify(x.title)}`;
export const industryNamed = (name) => {
  const x = home.industries.find((i) => i.name === name);
  if (!x) throw new Error(`content/home.json names an industry that doesn't exist: "${name}"`);
  return x;
};
// Vertical looping clip beside the text in a two-column band (01 Who we are, the closing Start a project block)
export const sideVideo = site.sideVideo?.vimeo
  ? `<div class="split-media__clip" aria-hidden="true"><div class="split-media__video"><div class="bg-video bg-video--vertical" data-vimeo-bg="${site.sideVideo.vimeo}" data-title="${esc(site.sideVideo.title)}"><img class="bg-video__poster" src="${site.sideVideo.poster}" width="1280" height="2276" alt="" loading="lazy" decoding="async"></div></div></div>`
  : '';

// Industry tiles (homepage, Industries, customer pages): darkened film still, name and a few client names;
// the heading link covers the whole tile and opens the industry's page
export const industryCards = (list) => `<ul class="industry-cards">
${list.map((x) => `  <li>
    <div class="industry-cards__media${x.zoom ? (x.zoom === 'vertical' ? ' is-zoom is-vertical' : ' is-zoom') : ''}"><img src="${still(x.still)}" alt="" width="1280" height="720" loading="lazy" decoding="async"></div>
    <svg class="industry-cards__go" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8"/></svg>
    <h3><a href="${industryPath(x)}">${esc(x.name)}</a></h3>
    <p class="industry-cards__clients">${x.clients.map(esc).join('&nbsp;&middot; ')}</p>
  </li>`).join('\n')}
</ul>`;
// Sourced stat boxes for a case study (value, label, source)
export const statsList = (stats, dark) => (stats?.length
  ? `<ul class="stats stats--3${dark ? '' : ' stats--light'}">${stats.map((st) => `<li><strong>${esc(st.value)}</strong><span>${esc(st.label)}</span>${st.source ? `<small>Source: ${esc(st.source)}</small>` : ''}</li>`).join('')}</ul>`
  : '');

export const blocks = {
  portfolio_featured: workGrid(portfolio.featured, { portrait: true }),
  portfolio_intro: esc(portfolio.intro),
  // Contact page: round social icons (same list as the footer, from content/site.json)
  social_icons: `<ul class="social">${shownSocial.map((x) => `<li><a href="${x.href}" target="_blank" rel="noopener" aria-label="${esc(x.label)}"><svg viewBox="0 0 24 24" aria-hidden="true">${socialIcons[x.label] || ''}</svg></a></li>`).join('')}</ul>`,
  // Portfolio: one line pointing to the social accounts in content/site.json
  follow_line: (() => {
    const icons = shownSocial.map((x) => `<a class="inline-social" href="${x.href}" rel="noopener" target="_blank" aria-label="${esc(x.label)}"><svg viewBox="0 0 24 24" aria-hidden="true">${socialIcons[x.label] || ''}</svg></a>`).join('');
    return `For behind the scenes, new releases and the work between the big projects, you can follow us here: <span class="inline-social-row">${icons}</span>`;
  })(),
  portfolio_nav: `<nav class="chip-nav" aria-labelledby="chip-nav-label">
  <div class="container">
    <p class="chip-nav__label" id="chip-nav-label">Jump to a kind of work:</p>
    <ul>${portfolio.categories.map((c) => `<li><a href="#${c.slug}">${esc(c.short || c.name)}</a></li>`).join('')}</ul>
  </div>
</nav>`,
  portfolio_categories: portfolio.categories
    .map((c) => `<section class="portfolio-cat" id="${c.slug}" aria-labelledby="${c.slug}-title">
  <div class="container"><h2 class="portfolio-cat__title" id="${c.slug}-title">${esc(c.name)}</h2></div>
  ${workGrid(c.videos)}
</section>`)
    .join('\n'),
  // Home reel ("What we do" + the hero's "Watch our reel" button), set in content/site.json
  // The reel starts playing (muted, with controls) when it scrolls into view; see public/js/site.js.
  reel_embed: `<div class="reel reel--inline"${site.reel.vimeo ? ` data-vimeo-inline="${site.reel.vimeo}"` : ''}>${videoLink({ client: 'Thrill Wave', ...site.reel }, { feature: true })}</div>`,
  // ---- homepage lists, from content/home.json ----
  services_list: `<ol class="service-list">
${home.services.map((x, i) => `  <li><span class="service-list__num">${pad2(i + 1)}</span><span class="service-list__icon">${icon(x.icon)}</span><h3>${esc(x.name)}</h3><p>${esc(x.text)}</p></li>`).join('\n')}
</ol>`,
  // ---- fuller versions of the homepage lists, for the Services, Our customers and Process pages ----
  // Services page: same rows as the homepage list, with a longer line and what each service includes
  services_full: `<ol class="service-list service-list--full">
${home.services.map((x, i) => `  <li><span class="service-list__num">${pad2(i + 1)}</span><span class="service-list__icon">${icon(x.icon)}</span><h3>${esc(x.name)}</h3><p>${esc(x.more || x.text)}${x.includes ? `<span class="service-list__includes">${esc(x.includes)}</span>` : ''}</p></li>`).join('\n')}
</ol>`,
  // Our customers and Industries pages: one section per entry (content/home.json > audiences / industries),
  // a sentence or two that leads into an example film, and a button to that entry's own page
  customer_sections: detailSections(home.audiences, audiencePath, (x) => `More on ${x.name.toLowerCase()}`),
  industry_sections: detailSections(home.industries, industryPath, (x) => `More on ${x.name}`),
  // Process page: each step in a numbered row with what happens in it
  process_detail: `<ol class="promise-list process-detail">
${home.process.map((x, i) => `  <li><span class="promise-list__num">${pad2(i + 1)}</span><h4>${esc(x.name)}</h4><p>${esc(x.more || x.text)}</p></li>`).join('\n')}
</ol>`,
  // Case studies page: one section per case (content/home.json > cases): the film, the story, three sourced numbers
  case_study_sections: home.cases.map((x, i) => {
    const dark = i % 2 === 0;
    const film = x.video && videoLink({ client: x.client, title: x.title, ...x.video }, { feature: true, hires: true });
    return `<section class="section${dark ? ' section--dark' : ''} case-study" id="${slugify(x.title)}">
  <div class="container">
    <p class="kicker">${esc(x.client)}</p>
    <h2 class="section__title">${esc(x.title)}</h2>
    <div class="case-study__grid">
      <div class="case-study__film">${film || ''}</div>
      <div class="case-study__text"><p class="case-study__goal">Goal: ${esc(x.goal)}</p><p>${esc(x.story || x.text)}</p>${x.stats?.length ? '<p>Here are a few public numbers from around the project, each with its source:</p>' : ''}</div>
    </div>
    ${statsList(x.stats, dark)}
    <div class="section__actions btn-row"><a class="btn btn--plain btn--pill ${dark ? 'btn--clear' : 'btn--clear-dark'}" href="${casePath(x)}">Read the whole story</a></div>
  </div>
</section>`;
  }).join('\n\n'),
  // FAQ page: every question in content/faq.json (also used for the FAQ structured data and llms.txt)
  faq_list: `<div class="faq">
${faq.map((f) => `  <div class="faq__item"><h2>${esc(f.q)}</h2><p>${esc(f.a)}</p></div>`).join('\n')}
</div>`,
  // A card that sends people to the FAQ page (Services and Process), like Sandwich's
  faq_card: `<a class="faq-card" href="/faq"><span class="faq-card__q">&ldquo;${esc(faq[0].q)}&rdquo;</span><span class="faq-card__more">See all FAQs <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6"/></svg></span></a>`,
  // Who we serve: six cards, a film still on top and the name and one sentence below, like the team cards
  // Each card links to that customer type's page
  audience_grid: `<ul class="audience-cards is-linked">
${home.audiences.map((x) => `  <li>
    <div class="audience-cards__photo${x.zoom ? ' is-zoom' : ''}${x.focus ? ` focus-${x.focus}` : ''}"><img src="${still(x.still)}" alt="" width="1280" height="720" loading="lazy" decoding="async"></div>
    <div class="audience-cards__body"><h3><a href="${audiencePath(x)}">${esc(x.name)}</a></h3><p>${esc(x.text)}</p></div>
  </li>`).join('\n')}
</ul>`,
  // Industries: square tiles on a darkened film still, short name and a few client names.
  // The heading link covers the whole tile and goes to the industry's own page.
  industry_grid: industryCards(home.industries),
  // SITREP steps (homepage and SITREP page): three tiles, each with a little black screen running the terminal site's animation in red
  sitrep_steps: `<ol class="sitrep-steps">
  <li><div class="sitrep-steps__screen" aria-hidden="true"><span class="sitrep-steps__num">01</span><span class="sitrep-glyphs sitrep-glyphs--ingest"><svg viewBox="0 0 24 24"><path d="M3 6h18l-9 14z"/></svg><svg viewBox="0 0 24 24"><path d="M3 6h18l-9 14z"/></svg><svg viewBox="0 0 24 24"><path d="M3 6h18l-9 14z"/></svg></span></div><h4>Dig in</h4><p>We study your craft, your peers, your industry and the sector around it.</p></li>
  <li><div class="sitrep-steps__screen" aria-hidden="true"><span class="sitrep-steps__num">02</span><span class="sitrep-glyphs sitrep-glyphs--synth"><svg viewBox="0 0 24 24"><path d="M12 2.5 21.5 12 12 21.5 2.5 12z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/></svg><svg viewBox="0 0 24 24"><path d="M12 2.5 21.5 12 12 21.5 2.5 12z"/></svg><svg viewBox="0 0 24 24"><path d="M12 2.5 21.5 12 12 21.5 2.5 12z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/></svg></span></div><h4>Find the story</h4><p>We bring you a point of view on what's worth saying and why people will care.</p></li>
  <li><div class="sitrep-steps__screen" aria-hidden="true"><span class="sitrep-steps__num">03</span><span class="sitrep-glyphs sitrep-glyphs--exec"><svg viewBox="0 0 24 24"><path d="M13.5 2 4 13.5h6.5L9.5 22 20 9.5h-6.5z"/></svg><svg viewBox="0 0 24 24"><path d="M13.5 2 4 13.5h6.5L9.5 22 20 9.5h-6.5z"/></svg><svg viewBox="0 0 24 24"><path d="M13.5 2 4 13.5h6.5L9.5 22 20 9.5h-6.5z"/></svg></span></div><h4>Make it</h4><p>We film that story with real people and plan where it will be seen.</p></li>
</ol>`,
  // Case studies: numbered list; the open one shows its photo, goal, one sentence and a link (site.js switches them)
  case_studies: `<ol class="cases">
${home.cases.map((x, i) => `  <li${i === 0 ? ' class="is-open"' : ''}>
    <button class="cases__tab" type="button" aria-expanded="${i === 0}" aria-controls="case-${i + 1}"><span class="cases__num">${pad2(i + 1)}</span><span><span class="cases__client">${esc(x.client)}</span><span class="cases__title">${esc(x.title)}</span></span><svg class="cases__chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button>
    <div class="cases__panel${x.zoom ? ' is-zoom' : ''}" id="case-${i + 1}"><img src="${x.image || still(x.still)}" alt="${esc(`Still from ${x.client}: ${x.title}, a Thrill Wave film`)}" width="1280" height="720" loading="lazy" decoding="async"><div class="cases__caption"><p class="cases__goal">${esc(x.goal)}</p><p>${esc(x.text)}</p><a class="cases__link" href="${x.link}">See the work <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6"/></svg></a></div></div>
  </li>`).join('\n')}
</ol>`,
  process_steps: `<ol class="process">
${home.process.map((x, i) => `  <li${x.link ? ' class="process__key"' : ''}><span class="process__node">${icon(x.icon)}</span><span class="process__num">${pad2(i + 1)}</span><h3>${esc(x.name)}</h3><p>${esc(x.text)}</p>${x.link ? `<a class="process__zoom" href="${x.link}">Zoom in <span aria-hidden="true">&darr;</span></a>` : ''}</li>`).join('\n')}
</ol>`,
  client_marquee: (() => {
    const items = (hidden) => home.clients.map((c) => `<li><img src="${c.logo}" alt="${hidden ? '' : esc(c.name)}" loading="lazy" decoding="async"></li>`).join('');
    return `<div class="marquee"><ul class="marquee__track">${items(false)}</ul><ul class="marquee__track" aria-hidden="true">${items(true)}</ul></div>`;
  })(),
  // Intel: newest post as a tall 9:16 card, the next two as small squares under it (titles only)
  intel_posts: `<div class="intel__posts">
${posts.slice(0, 3).map((p, i) => `  <a class="intel-card${i === 0 ? ' intel-card--tall' : ''}" href="/post/${p.slug}">
    <div class="intel-card__media"><img src="${i === 0 ? p.coverDisplay : p.card}" alt="" loading="lazy" decoding="async"></div>
    <div class="intel-card__body"><p class="intel-card__meta"><time datetime="${p.date}">${fmtDate(p.date)}</time> &middot; ${p.minutes} min</p><h3>${esc(p.title)}</h3></div>
  </a>`).join('\n')}
</div>`,
  reel_link: videoAttrs({ client: 'Thrill Wave', ...site.reel }),
  // Muted, looping header video on Home and SITREP (content/site.json > headerVideo). The poster is
  // the video's Vimeo thumbnail; it shows first, and public/js/site.js fades the Vimeo player in over it
  // after the page loads (skipped for reduced-motion and data-saver visitors). Needs a paid Vimeo plan.
  header_video: site.headerVideo?.vimeo
    // The player is in the HTML itself (not added by site.js), so it starts loading while the page is still being
    // read and the footage is up about a second sooner. It stays invisible until it's really playing.
    ? `<div class="bg-video" data-vimeo-bg="${site.headerVideo.vimeo}" data-title="${esc(site.headerVideo.title)}"><img class="bg-video__poster" src="${site.headerVideo.poster}" width="1920" height="1080" alt="" fetchpriority="high"><iframe class="bg-video__frame" src="https://player.vimeo.com/video/${site.headerVideo.vimeo}?background=1&amp;autoplay=1&amp;loop=1&amp;muted=1&amp;autopause=0&amp;playsinline=1&amp;dnt=1" title="${esc(site.headerVideo.title)}" allow="autoplay; fullscreen; picture-in-picture" tabindex="-1" aria-hidden="true"></iframe></div>`
    : '',
  // Vertical looping clip beside the text in 01 Who we are and the closing block (content/site.json > sideVideo).
  // It starts once it scrolls near the screen (site.js); until then the poster shows.
  side_video: sideVideo,
  // SITREP page: the dashboard loop under the hero (content/site.json > sitrepLoop), muted and looping like the header video
  sitrep_loop: site.sitrepLoop?.vimeo
    ? `<div class="loop-panel"><div class="bg-video" data-vimeo-bg="${site.sitrepLoop.vimeo}" data-title="${esc(site.sitrepLoop.title)}"><img class="bg-video__poster" src="${site.sitrepLoop.poster}" width="1280" height="720" alt="" loading="lazy" decoding="async"></div></div>`
    : '',
  itca_embed: site.itcaVimeoId
    ? vimeoEmbed(site.itcaVimeoId, 'ITCA film')
    : workGrid([{ client: 'ITCA WIC', title: 'Dear Mom', youtube: 'QlP7wPaFcVU', zoom: true, autoplay: true }], { single: true }),
  // SITREP page: Tony's TEC case-study breakdown (Vimeo) and two more ITCA pieces under "Dear Mom"
  tec_case_study: workGrid([{ client: 'ITCA TEC', title: 'Case Study Using SITREP', autoplay: true, vimeo: '1175739079', thumbnail: 'https://i.vimeocdn.com/video/2206610840-ab9c7452ada6128dda809c82750fb931c920b1da79ebba045b626a540217cd86-d_1280x720' }], { single: true }),
  sitrep_demo: workGrid([{ client: 'Thrill Wave', title: 'SITREP Demo', outline: true, autoplay: true, vimeo: '1195773700', thumbnail: 'https://i.vimeocdn.com/video/2206611238-36b31d4267e033d1faea571b53afef1fc733e3ba65f040361b1ce4271ea9746e-d_1280x720' }], { single: true }),
  itca_more: workGrid([
    { client: 'ITCA Native Vote', title: 'Your Voice, Your Power: Full Episode', youtube: 'Gh67yEMyOCs', frame: 3, zoom: true },
    { client: 'ITCA WIC', title: 'Welcome to WIC', youtube: 'zLy49zenWIM' },
  ], { pair: true }),
  team: `<ul class="team">
${site.team.map((m) => `  <li>
    <img src="${m.image}" alt="${esc(`${m.name} of Thrill Wave`)}" loading="lazy" decoding="async">
    <div class="team__body"><h3>${esc(m.name)}</h3><p>${esc(m.role)}</p></div>
  </li>`).join('\n')}
</ul>`,
  // About page: founder cards with photo, handle-style tag and bio (content/site.json > team)
  team_roster: `<ul class="roster">
${site.team.map((m) => `  <li>
    <div class="roster__photo"><img src="${m.image}" alt="${esc(`${m.name} of Thrill Wave`)}" loading="lazy" decoding="async"></div>
    <div class="roster__body">
      <h3>${esc(m.name)}</h3>
      <p class="roster__role">${esc(m.position || m.role)}</p>
      <p>${esc(m.bio || '')}</p>
    </div>
  </li>`).join('\n')}
</ul>`,
  // Standard page ending (every page but Contact): black band, one button to the contact form
  start_project: `<section class="cta cta--dark cta--ender has-side-video">
  <div class="container split-media">
    <div class="split-media__text">
      <p class="kicker">Start a project</p>
      <h2 class="section__title">We'd love to hear your story.</h2>
      <p>Tell us what you're working on, even if it's only a hunch so far. We'll do the homework, and then we'll help you find the best way to tell it. The easiest way to start is to write to us here:</p>
      <a class="btn btn--plain btn--pill btn--red" href="/contact#start">Write to us</a>
    </div>
    ${sideVideo}
  </div>
</section>`,
  calendly_embed: site.calendlyUrl
    ? `<div class="booking">
  <div class="booking__details">
    <img src="${site.logoSmall}" alt="" width="84" height="48">
    <p class="booking__host">Chris Kuzman</p>
    <h3 class="booking__title">30 Minute Video Consult</h3>
    <ul class="booking__meta">
      <li><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>30 min</li>
      <li><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3z"/></svg>Web conferencing details provided upon confirmation.</li>
    </ul>
    <p>This is a 30-minute call to see how Thrill Wave can help you with your next project!</p>
  </div>
  <iframe class="booking__calendar" src="${site.calendlyUrl}?embed_type=Inline&amp;hide_landing_page_details=1&amp;hide_event_type_details=1&amp;hide_gdpr_banner=1&amp;embed_domain=${new URL(site.url).hostname}" title="Pick a time for a 30-minute video consult" loading="lazy"></iframe>
</div>`
    : `<p class="center"><a class="btn" href="mailto:${site.email}?subject=30%20minute%20video%20consult">Book a 30-minute consult</a></p>`,
  // Contact map: the Phoenix metro, outlined by Google's Maricopa County boundary (Google has no "metro area" outline)
  // Contact page map: Arizona and the Southwest, no pin or highlighted area (centered on the state, zoom 6)
  map_embed: `<iframe class="map" src="https://maps.google.com/maps?ll=34.2,-111.7&amp;z=6&amp;t=m&amp;output=embed" title="Map of Arizona and the Southwest, where Thrill Wave is based" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>`,
};
