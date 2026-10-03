import { home, pageIndex, warnings } from './context.mjs';
import { esc, canonicalOf } from './helpers.mjs';
import { still, videoAttrs, videoLink, workGrid, workVideo } from './media.mjs';
import { ORG_ID, videoNode } from './schema.mjs';
import { layout, write } from './layout.mjs';
import { blocks, industryPath, audiencePath, casePath, industryNamed, industryCards, statsList } from './blocks.mjs';

// ---------------------------------------------------------------------------
// Breakout pages: one per industry, customer type and case study, all from content/home.json
// ---------------------------------------------------------------------------
// /industries/<name>, /who-we-serve/<name> and /case-studies/<title>. Each is built from the same pieces as the
// other pages: a film-still hero, numbered sections and the closing Start a project block. Add an entry to
// content/home.json and its page appears (with sitemap, breadcrumbs, structured data and llms.txt).
const btn = (href, text, kind) => `<a class="btn btn--plain btn--pill btn--${kind}" href="${href}">${text}</a>`;

function breakoutHero({ img, zoom, crumbs, beats, lede, buttons }) {
  return `<section class="hero hero--still${zoom ? ' hero--zoom' : ''}">
  <div class="bg-video"><img class="bg-video__poster" src="${img}" width="1280" height="720" alt="" fetchpriority="high"></div>
  <div class="hero__shade" aria-hidden="true"></div>
  <div class="container hero__content">
    <p class="hero__eyebrow hero__crumbs"><a href="${crumbs[1]}">${esc(crumbs[0])}</a> <span aria-hidden="true">/</span> ${esc(crumbs[2])}</p>
    <h1 class="hero__stack">${beats.map((b) => `<span>${esc(b)}</span>`).join(' ')}</h1>
    <p class="hero__lede">${esc(lede)}</p>
    <div class="btn-row">${buttons}</div>
  </div>
</section>`;
}

// One numbered section. `intro` is one paragraph or a list of them; `inner` sits inside the content column;
// `wide` (a video grid) runs edge to edge after it.
function section({ tone = '', id, kicker, title, intro = '', inner = '', wide = '', actions = '' }) {
  const paras = [].concat(intro).filter(Boolean).map((t) => `<p>${esc(t)}</p>`).join('\n    ');
  const head = `<p class="kicker">${esc(kicker)}</p>
    <h2 class="section__title">${esc(title)}</h2>
    ${paras}
    ${inner}`;
  const acts = actions ? `<div class="section__actions btn-row">${actions}</div>` : '';
  return `<section class="section${tone ? ` section--${tone}` : ''}" id="${id}">
  <div class="container">
    ${head}${wide ? '' : `\n    ${acts}`}
  </div>${wide ? `\n  ${wide}${acts ? `\n  <div class="container">${acts}</div>` : ''}` : ''}
</section>`;
}

const faqItems = (list) =>
  `<div class="faq faq--short">${list.map((f) => `<div class="faq__item"><h3>${esc(f.q)}</h3><p>${esc(f.a)}</p></div>`).join('')}</div>`;
const chipLinks = (links) =>
  `<ul class="chip-links">${links.map(([href, label]) => `<li><a href="${href}">${esc(label)}</a></li>`).join('')}</ul>`;
// Case study cards: still, goal, client and title (the link covers the card), one sentence
const caseCards = (list) => `<ul class="audience-cards is-linked case-cards">
${list.map((c) => `  <li>
    <div class="audience-cards__photo${c.zoom ? ' is-zoom' : ''}"><img src="${c.image || still(c.still)}" alt="" width="1280" height="720" loading="lazy" decoding="async"></div>
    <div class="audience-cards__body"><p class="case-cards__goal">${esc(c.goal)}</p><h3><a href="${casePath(c)}">${esc(c.client)}: ${esc(c.title)}</a></h3><p>${esc(c.text)}</p></div>
  </li>`).join('\n')}
</ul>`;
const videoNodes = (videos) => videos.map((v) => v.youtube && videoNode(v)).filter(Boolean);
// The "Our work" section: up to four films, two across
const workSection = (videos, { tone = 'dark', kicker = 'Our work', title = "Films we've made.", intro = '', actions = '' } = {}) =>
  section({ tone, id: 'work', kicker, title, intro, wide: workGrid(videos, { single: videos.length === 1 }), actions });
const serviceNode = (canonical, name, x) => ({
  '@type': 'Service',
  '@id': `${canonical}#service`,
  name,
  serviceType: 'Video production',
  description: x.intro || x.text,
  provider: { '@id': ORG_ID },
  areaServed: [{ '@type': 'City', name: 'Phoenix' }, { '@type': 'State', name: 'Arizona' }, { '@type': 'Country', name: 'United States' }],
  url: canonical,
});
// Meta description: "Beauty & Salon Video Production in Phoenix, AZ. <one sentence>", shortened to fit Google (160)
const breakoutDescription = (...tries) => {
  const d = tries.find((t) => esc(t).length <= 158) || tries[tries.length - 1];
  if (esc(d).length > 160) warnings.push(`breakout page description is ${esc(d).length} chars: "${d}"`);
  return d;
};

function breakoutPage({ urlPath, title, description, trail, still: img, body, nodes, ogImage }) {
  write(urlPath, layout({ urlPath, title, description, trail, body, nodes, bodyClass: 'page-sections', ogImage }));
  pageIndex.push({ path: urlPath, title, description });
}

// A client's own words (`quote`: text, name, role). Real reviews only, used sparingly where they fit.
const quoteSection = (q) => (q ? `<section class="section section--dark" id="quote">
  <div class="container">
    <p class="kicker">What they said</p>
    <blockquote class="quote-band"><p>&ldquo;${esc(q.text)}&rdquo;</p><footer>${esc(q.name)}${q.role ? `, ${esc(q.role)}` : ''}</footer></blockquote>
  </div>
</section>` : '');

// ---- industries ----
export function writeIndustryPages() {
  for (const x of home.industries) {
    const urlPath = industryPath(x);
    const canonical = canonicalOf(urlPath);
    const videos = (x.work || []).map(workVideo);
    const cases = home.cases.filter((c) => c.industry === x.name);
    const others = home.industries.filter((o) => o !== x);
    const seo = x.seoTitle || `${x.name} Video Production`;
    const body = [
      breakoutHero({
        img: still(x.still),
        zoom: x.zoom,
        crumbs: ['Industries', '/industries', x.name],
        beats: [`${x.headline || `${x.name} video`}.`, x.title],
        lede: x.text,
        buttons: btn('#work', 'See the films', 'red') + btn('/industries', 'All industries', 'clear'),
      }),
      // How we think about it: who we've worked with, then how we approach the work, ending in a colon that leads into the films
      section({
        id: 'how-we-think',
        kicker: 'How we think about it',
        title: x.heading || x.title,
        intro: x.intro,
        inner: `<p class="clients-line"><span>Clients include</span> ${x.clients.map(esc).join(' &middot; ')}</p>\n    <p>${esc(x.approach)}</p>`,
      }),
      videos.length ? workSection(videos, { actions: btn(x.link, 'See all our work', 'clear') }) : '',
      cases.length ? section({ id: 'case-studies', kicker: 'Case studies', title: 'How a few projects went.', intro: cases.length === 1 ? 'We wrote up one project from start to finish, with the research behind it and the numbers around it:' : 'We wrote up a few projects from start to finish, with the research behind them and the numbers around them:', inner: caseCards(cases), actions: btn('/case-studies', 'All case studies', 'clear-dark') }) : '',
      quoteSection(x.quote),
      x.faq?.length ? section({ tone: 'dark', id: 'questions', kicker: 'Questions', title: 'What people usually ask us.', intro: 'Here are the two questions we hear most often, with our answers:', inner: faqItems(x.faq) }) : '',
      section({ tone: 'soft', id: 'more-industries', kicker: 'More industries', title: 'Other places we work.', intro: 'We bring the same research and care to every industry we work in. Here are the others:', inner: chipLinks(others.map((o) => [industryPath(o), o.name])), actions: btn('/industries', 'All industries', 'clear-dark') }),
      blocks.start_project,
    ].filter(Boolean).join('\n\n');
    breakoutPage({
      urlPath,
      title: seo,
      description: breakoutDescription(`${seo} in Phoenix, AZ. ${x.text}`, `${seo}. ${x.text}`, x.text),
      trail: [['Home', '/'], ['Industries', '/industries'], [x.name, urlPath]],
      body,
      nodes: [serviceNode(canonical, seo, x), ...videoNodes(videos)],
    });
  }
}

// ---- customer types (Our customers) ----
export function writeCustomerPages() {
  for (const x of home.audiences.filter((a) => !a.page)) {
    const urlPath = audiencePath(x);
    const canonical = canonicalOf(urlPath);
    const videos = (x.work || []).map(workVideo);
    const cases = home.cases.filter((c) => c.customer === x.name);
    const seo = x.seoTitle || `Video Production for ${x.name}`;
    const body = [
      breakoutHero({
        img: still(x.still),
        zoom: x.zoom,
        crumbs: ['Our customers', '/who-we-serve', x.name],
        beats: [`${x.headline || `Video for ${x.name.toLowerCase()}`}.`, x.title],
        lede: x.text,
        buttons: btn('#work', 'See the films', 'red') + btn('/who-we-serve', 'All customers', 'clear'),
      }),
      // How we think about it, ending in a colon that leads into the films
      section({ id: 'how-we-think', kicker: 'How we think about it', title: x.heading || x.title, intro: [x.intro, x.approach] }),
      videos.length ? workSection(videos, { actions: btn('/portfolio', 'See all our work', 'clear') }) : '',
      cases.length ? section({ id: 'case-studies', kicker: 'Case studies', title: 'How a few projects went.', intro: cases.length === 1 ? 'We wrote up one project from start to finish, with the numbers around it:' : 'We wrote up a few projects from start to finish, with the numbers around them:', inner: caseCards(cases), actions: btn('/case-studies', 'All case studies', 'clear-dark') }) : '',
      quoteSection(x.quote),
      x.faq?.length ? section({ tone: 'dark', id: 'questions', kicker: 'Questions', title: 'What people usually ask us.', intro: 'These two questions come up in almost every first call:', inner: faqItems(x.faq) }) : '',
      x.related?.length ? section({ id: 'industries', kicker: 'Industries', title: "Where we've done it.", intro: `Most of our work for ${x.name.toLowerCase()} happens in these industries:`, inner: industryCards(x.related.map(industryNamed)), actions: btn('/industries', 'All industries', 'clear-dark') }) : '',
      blocks.start_project,
    ].filter(Boolean).join('\n\n');
    breakoutPage({
      urlPath,
      title: seo,
      description: breakoutDescription(`${seo} in Phoenix, AZ. ${x.text}`, `${seo}. ${x.text}`, x.text),
      trail: [['Home', '/'], ['Our customers', '/who-we-serve'], [x.name, urlPath]],
      body,
      nodes: [{ ...serviceNode(canonical, seo, x), audience: { '@type': 'Audience', audienceType: x.name } }, ...videoNodes(videos)],
    });
  }
}

// ---- case studies ----
export function writeCaseStudyPages() {
  for (const [i, x] of home.cases.entries()) {
    const urlPath = casePath(x);
    const film = x.video && { client: x.client, title: x.title, ...x.video };
    const industry = x.industry && industryNamed(x.industry);
    const customer = x.customer && home.audiences.find((a) => a.name === x.customer);
    const moreFilms = (x.work || []).map(workVideo).filter((v) => !film || (v.youtube || v.vimeo) !== (film.youtube || film.vimeo));
    // Other case studies: same industry first, then the next ones in order
    const others = [...home.cases.slice(i + 1), ...home.cases.slice(0, i)].sort((a, b) => (b.industry === x.industry) - (a.industry === x.industry)).slice(0, 3);
    const facts = [
      ['Client', esc(x.client)],
      ['Goal', esc(x.goal)],
      industry && ['Industry', `<a href="${industryPath(industry)}">${esc(industry.name)}</a>`],
      x.services && ['Services', x.services.map((s) => `<a href="/services">${esc(s)}</a>`).join(', ')],
      ...(x.facts || []).map((f) => [f.label, esc(f.value)]),
    ].filter(Boolean);
    const body = [
      breakoutHero({
        img: x.image || still(x.still),
        zoom: x.zoom,
        crumbs: ['Case studies', '/case-studies', x.client],
        beats: [x.client, x.title],
        lede: x.lede || x.text,
        buttons: (film ? `<a class="btn btn--plain btn--pill btn--red" ${videoAttrs(film)}>Watch the film</a>` : '') + btn('/case-studies', 'All case studies', 'clear'),
      }),
      section({
        tone: 'dark',
        id: 'the-project',
        kicker: 'The project',
        title: 'Here\'s what happened.',
        intro: 'Here are the basics, followed by the short version of the story with the film beside it:',
        inner: `<dl class="facts">${facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}</dl>
    <div class="case-study case-study__grid">
      <div class="case-study__film">${film ? videoLink(film, { feature: true, hires: true }) : ''}</div>
      <div class="case-study__text"><p>${esc(x.story || x.text)}</p></div>
    </div>`,
      }),
      // Our SITREP research for this project, told in three plain paragraphs: where things stood, what we found, what we made
      x.sitrep ? section({
        id: 'the-sitrep',
        kicker: 'The SITREP',
        title: 'What our research changed.',
        intro: [
          `Before we filmed anything, we did our SITREP research into ${x.client}'s work, the people it serves and the field around it. It changed the plan, and here's how:`,
          ...x.sitrep,
        ],
        actions: btn('/sitrep', 'How SITREP works', 'clear-dark'),
      }) : '',
      x.stats?.length ? section({ tone: 'dark', id: 'the-numbers', kicker: 'The numbers', title: 'The numbers around it.', intro: 'We like to show the bigger picture around a project. These are public numbers, and each one comes with its source:', inner: statsList(x.stats, true) }) : '',
      moreFilms.length ? workSection(moreFilms, { tone: '', title: 'More from the project.', intro: 'We made more than one film for this project. Here are the others:' }) : '',
      quoteSection(x.quote),
      section({
        tone: 'soft',
        id: 'more-case-studies',
        kicker: 'More case studies',
        title: 'Keep reading.',
        intro: 'If you liked this one, here are a few more stories like it:',
        inner: caseCards(others),
        actions: [industry && btn(industryPath(industry), `More on ${industry.name}`, 'clear-dark'), customer && btn(audiencePath(customer), `More on ${customer.name.toLowerCase()}`, 'clear-dark'), btn('/case-studies', 'All case studies', 'clear-dark')].filter(Boolean).join(''),
      }),
      blocks.start_project,
    ].filter(Boolean).join('\n\n');
    // `seoTitle` overrides the page title when client + title is too long for Google
    const title = x.seoTitle || `${x.client}: ${x.title}`;
    breakoutPage({
      urlPath,
      title,
      description: breakoutDescription(`${x.client} case study by Thrill Wave, Phoenix video production. ${x.lede || x.text}`, `${x.client} case study. ${x.lede || x.text}`, `Case study. ${x.lede || x.text}`, x.lede || x.text),
      trail: [['Home', '/'], ['Case studies', '/case-studies'], [title, urlPath]],
      body,
      ogImage: undefined,
      nodes: videoNodes([film, ...moreFilms].filter(Boolean)),
    });
  }
}
