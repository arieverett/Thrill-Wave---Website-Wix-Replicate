import { portfolio } from './context.mjs';
import { esc } from './helpers.mjs';

// ---------------------------------------------------------------------------
// Video helpers: film stills, video links and thumbnail grids
// ---------------------------------------------------------------------------
export const ytThumb = (id, quality = 'hqdefault') => `https://i.ytimg.com/vi/${id}/${quality}.jpg`;
// Film stills for photo tiles: "ID" is the video's own thumbnail, "ID:2" is YouTube's auto-grabbed frame 1, 2 or 3 (1280px).
export const still = (ref) => { const [id, n] = ref.split(':'); return ytThumb(id, n ? `maxres${n}` : 'maxresdefault'); };

// "Relentless Beats: Gold Rush 2024 Aftermovie", for aria labels, the lightbox and llms.txt
export const videoName = (v) => (v.client ? `${v.client}: ${v.title}` : v.title);
// Public page for a video, on YouTube or Vimeo
export const videoUrl = (v) => (v.vimeo ? `https://vimeo.com/${v.vimeo}` : `https://www.youtube.com/watch?v=${v.youtube}`);

// Link attributes that open a video in the lightbox player (public/js/site.js).
// Without JavaScript the link simply goes to the video on YouTube or Vimeo.
export const videoAttrs = (v) =>
  `href="${videoUrl(v)}" ` + (v.vimeo ? `data-vimeo="${v.vimeo}"` : `data-youtube="${v.youtube}"`) +
  ` data-title="${esc(videoName(v))}"`;

// A video thumbnail with its title laid over the picture: bold client, then the video name.
// `zoom: true` crops in past letterbox bars baked into a thumbnail; `outline: true` adds a blue
// edge to dark thumbnails that would otherwise blend into a black section.
// YouTube thumbnails come from YouTube (`frame: 1|2|3` picks YouTube's auto still from ~25/50/75% of
// the video instead of the uploaded cover); Vimeo videos need a `thumbnail` URL.
export function videoLink(v, { feature = false, hires = false } = {}) {
  const name = esc(videoName(v));
  if (v.vimeo && !v.thumbnail) {
    return `<div class="video video--embed"><iframe src="https://player.vimeo.com/video/${v.vimeo}?dnt=1" title="${name}" loading="lazy" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>`;
  }
  const img = v.vimeo
    ? `<img src="${esc(v.thumbnail)}" alt="" width="1280" height="720" loading="lazy" decoding="async">`
    : hires
    ? `<img src="${ytThumb(v.youtube, v.frame ? `maxres${v.frame}` : 'maxresdefault')}" alt="" width="1280" height="720" loading="lazy" decoding="async">`
    : `<img src="${ytThumb(v.youtube, v.frame ? `hq${v.frame}` : 'hqdefault')}" data-hires="${ytThumb(v.youtube, v.frame ? `maxres${v.frame}` : 'maxresdefault')}" alt="" width="480" height="360" loading="lazy" decoding="async">`;
  // autoplay: true plays the video muted, in place, once the tile is on screen (site.js), and pauses it when scrolled away
  return `<a class="video${feature ? ' video--feature' : ''}${v.zoom ? ' video--zoom' : ''}${v.outline ? ' video--outline' : ''}${v.autoplay ? ' video--autoplay' : ''}" ${videoAttrs(v)}${v.autoplay ? ' data-autoplay' : ''} aria-label="Play video: ${name}">
    ${img}
    <span class="video__play" aria-hidden="true"></span>
    <span class="video__label" aria-hidden="true">${v.client ? `<strong>${esc(v.client)}</strong> ` : ''}${esc(v.title)}</span>
  </a>`;
}

// Edge-to-edge thumbnail grid (home "Our work", SITREP, portfolio)
// portrait: the homepage's 3-across grid of 4:5 tiles (like a social profile grid); it loads YouTube's 1280px
// still straight away, because the 480px one has black bars that would show in a tall crop.
export const workGrid = (videos, { single = false, portrait = false, pair = false } = {}) =>
  `<div class="work-grid${single ? ' work-grid--single' : ''}${portrait ? ' work-grid--portrait' : ''}${pair ? ' work-grid--pair' : ''}">
${videos.map((v) => `  <div class="work-tile">${videoLink(v, { hires: portrait })}</div>`).join('\n')}
</div>`;

export const vimeoEmbed = (id, title) =>
  `<div class="embed-16x9"><iframe src="https://player.vimeo.com/video/${id}?dnt=1" title="${esc(title)}" loading="lazy" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>`;

// A portfolio video by its YouTube ID (for example films named in content/home.json)
export const findVideo = (id) => [...portfolio.featured, ...portfolio.categories.flatMap((c) => c.videos)].find((v) => v.youtube === id);
// A film in a `work` list: a YouTube ID from content/portfolio.json, or a full video ({ youtube | vimeo, client, title... })
export const workVideo = (ref) => {
  const v = typeof ref === 'string' ? findVideo(ref) : ref;
  if (!v) throw new Error(`content/home.json lists a video that isn't in content/portfolio.json: ${ref}`);
  return v;
};
