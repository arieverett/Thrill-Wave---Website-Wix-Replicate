import { readJSON, site, home, portfolio, faq, warnings } from './context.mjs';
import { slugify, absUrl, canonicalOf } from './helpers.mjs';
import { ytThumb, videoName } from './media.mjs';

// ---------------------------------------------------------------------------
// Structured data (schema.org JSON-LD)
// ---------------------------------------------------------------------------
export const ORG_ID = `${site.url}/#organization`;
export const WEBSITE_ID = `${site.url}/#website`;
export const BLOG_ID = `${site.url}/blog#blog`;
export const personId = (name) => `${site.url}/#${slugify(name)}`;
export const telephone = '+1-' + site.phone;
// Google wants dates in structured data with a time and timezone. Content files use plain
// YYYY-MM-DD, so add noon Phoenix time (Arizona is UTC-7 all year, no daylight saving).
export const withTz = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T12:00:00-07:00` : d);

export const orgNode = {
  '@type': ['Organization', 'ProfessionalService'],
  '@id': ORG_ID,
  name: site.name,
  url: site.url,
  logo: { '@type': 'ImageObject', url: absUrl(site.logo), width: 800, height: 458 },
  image: absUrl(site.ogImage),
  description: site.summary,
  slogan: site.tagline,
  email: site.email,
  telephone,
  address: { '@type': 'PostalAddress', addressLocality: site.region.locality, addressRegion: site.region.region, addressCountry: site.region.country },
  // Kept in step with the Google Business Profile (service area + hours).
  areaServed: [
    ...['Phoenix', 'Scottsdale', 'Tempe', 'Mesa', 'Chandler', 'Gilbert', 'Glendale', 'Peoria', 'Tucson', 'Flagstaff']
      .map((name) => ({ '@type': 'City', name, containedInPlace: { '@type': 'State', name: 'Arizona' } })),
    { '@type': 'AdministrativeArea', name: 'Maricopa County, Arizona' },
    { '@type': 'State', name: 'Arizona' },
    { '@type': 'Country', name: 'United States' },
  ],
  openingHoursSpecification: [
    { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: '09:00', closes: '17:00' },
  ],
  founder: site.team.map((m) => ({ '@type': 'Person', '@id': personId(m.name), name: m.name, jobTitle: m.jobTitle, image: absUrl(m.image), worksFor: { '@id': ORG_ID } })),
  knowsAbout: site.services,
  // The services list from the homepage (content/home.json), so search and answer engines know what we offer
  hasOfferCatalog: {
    '@type': 'OfferCatalog',
    name: 'Video production services',
    itemListElement: home.services.map((x) => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name: x.name, description: x.text, provider: { '@id': ORG_ID }, areaServed: { '@type': 'State', name: 'Arizona' } } })),
  },
  sameAs: site.social.map((s) => s.href),
  contactPoint: { '@type': 'ContactPoint', contactType: 'sales', telephone, email: site.email, areaServed: 'US', availableLanguage: 'English' },
};

export const websiteNode = {
  '@type': 'WebSite',
  '@id': WEBSITE_ID,
  url: site.url,
  name: site.name,
  description: site.defaultDescription,
  publisher: { '@id': ORG_ID },
  inLanguage: 'en-US',
};

export const breadcrumbNode = (canonical, trail) => ({
  '@type': 'BreadcrumbList',
  '@id': `${canonical}#breadcrumb`,
  itemListElement: trail.map(([name, p], i) => ({ '@type': 'ListItem', position: i + 1, name, item: canonicalOf(p) })),
});

export const jsonLd = (nodes) =>
  `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': nodes }).replace(/</g, '\\u003c')}</script>`;

// ---- videos in the structured data (VideoObject) ----
// Real upload dates and lengths from YouTube, kept in content/video-meta.json. Never shown on the page;
// search and answer engines use them to list the films (and can show them as video results).
export const videoMeta = readJSON('content/video-meta.json');
export const uniqueVideos = [...new Map([...portfolio.featured, ...portfolio.categories.flatMap((c) => c.videos)].map((v) => [v.youtube || v.vimeo, v])).values()];
export const isoDuration = (sec) => `PT${sec >= 60 ? `${Math.floor(sec / 60)}M` : ''}${sec % 60}S`;
export const videoNode = (v) => {
  const meta = v.youtube && videoMeta[v.youtube];
  if (!meta) return null;
  return {
    '@type': 'VideoObject',
    '@id': `${site.url}/#video-${v.youtube}`,
    name: videoName(v),
    description: `${videoName(v)}, a film by ${site.name}, a video production company in Phoenix, Arizona.`,
    thumbnailUrl: ytThumb(v.youtube),
    uploadDate: withTz(meta.uploadDate),
    duration: isoDuration(meta.seconds),
    embedUrl: `https://www.youtube.com/embed/${v.youtube}`,
    publisher: { '@id': ORG_ID },
    inLanguage: 'en-US',
  };
};
export function checkVideoMeta() {
  for (const v of uniqueVideos) if (v.youtube && !videoMeta[v.youtube]) warnings.push(`video ${videoName(v)} (${v.youtube}) has no upload date in content/video-meta.json`);
}

// ---- extra structured data for specific pages ----
export const pageExtras = {
  index: {
    pageProps: { about: { '@id': ORG_ID } },
    nodes: [...portfolio.featured.map(videoNode).filter(Boolean), ...(site.reel.uploadDate ? [{
      '@type': 'VideoObject',
      name: `${site.name}: ${site.reel.title}`,
      description: `${site.name} brand reel. ${site.defaultDescription}`,
      thumbnailUrl: site.reel.thumbnail || ytThumb(site.reel.youtube, 'maxresdefault'),
      uploadDate: withTz(site.reel.uploadDate),
      duration: site.reel.duration,
      embedUrl: site.reel.vimeo ? `https://player.vimeo.com/video/${site.reel.vimeo}` : `https://www.youtube.com/embed/${site.reel.youtube}`,
      publisher: { '@id': ORG_ID },
    }] : [])],
  },
  portfolio: { pageType: 'CollectionPage', nodes: uniqueVideos.map(videoNode).filter(Boolean) },
  contact: { pageType: 'ContactPage' },
  faq: {
    pageType: 'FAQPage',
    pageProps: { mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
  },
  about: { pageType: 'AboutPage', pageProps: { about: { '@id': ORG_ID } } },
};
