// thrillwave.com: progressive enhancements. Every page works without this file;
// it adds the mobile menu, video lightbox, header background video, scroll reveals and background form posts.

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------------------------------------------------------------------------
// Mobile menu
// ---------------------------------------------------------------------------
const toggle = $('.nav-toggle');
const nav = $('#site-nav');
if (toggle && nav) {
  const header = $('.site-header');
  const body = document.body;
  let closing;
  const setMenu = (open) => {
    const wasOpen = nav.classList.contains('is-open');
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    nav.classList.toggle('is-open', open);
    body.classList.toggle('nav-open', open);
    // Keep the header's own blur off until the drawer and dimmer have finished fading out (see site.css)
    clearTimeout(closing);
    body.classList.toggle('nav-closing', wasOpen && !open);
    if (wasOpen && !open) closing = setTimeout(() => body.classList.remove('nav-closing'), 400);
  };
  // Leaving the page from the menu: give the header its page-transition name back so it stays put
  addEventListener('pageswap', () => { if (header) header.style.viewTransitionName = 'site-header'; });
  addEventListener('pageshow', (e) => { if (header) header.style.viewTransitionName = ''; if (e.persisted) setMenu(false); });
  toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
  nav.addEventListener('click', (e) => e.target.closest('a') && setMenu(false));
  // Tapping the dimmed page around the menu card closes it
  document.addEventListener('click', (e) => {
    if (nav.classList.contains('is-open') && !nav.contains(e.target) && !toggle.contains(e.target)) setMenu(false);
  });
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) { setMenu(false); toggle.focus(); }
  });
  matchMedia('(min-width: 761px)').addEventListener('change', (e) => e.matches && setMenu(false));
}

// ---------------------------------------------------------------------------
// Phones: stop the rubber-band bounce past the footer (which looked like empty white
// page) while keeping pull-down-to-refresh at the top. CSS can only turn both off, so
// this only cancels an upward swipe once the page is already at the very bottom.
// ---------------------------------------------------------------------------
if (matchMedia('(pointer: coarse)').matches) {
  let lastY = 0;
  addEventListener('touchstart', (e) => { lastY = e.touches[0].clientY; }, { passive: true });
  addEventListener('touchmove', (e) => {
    const y = e.touches[0].clientY;
    const pushingUp = y < lastY;
    lastY = y;
    if (!pushingUp || e.touches.length > 1 || !e.cancelable) return;
    if (e.target.closest?.('dialog, .chip-nav, iframe')) return;
    const root = document.scrollingElement || document.documentElement;
    if (root.scrollTop + innerHeight >= root.scrollHeight - 1) e.preventDefault();
  }, { passive: false });
}

// ---------------------------------------------------------------------------
// "Call / text" in the header: on a computer the first click shows the number
// (a second click dials, e.g. via FaceTime); on phones it dials straight away.
// ---------------------------------------------------------------------------
$$('[data-reveal-phone]').forEach((a) => a.addEventListener('click', (e) => {
  if (a.dataset.revealed || matchMedia('(pointer: coarse)').matches) return;
  e.preventDefault();
  a.dataset.revealed = '1';
  a.textContent = a.dataset.revealPhone;
  a.setAttribute('aria-label', `Call or text ${a.dataset.revealPhone}`);
}));

// ---------------------------------------------------------------------------
// Header gets a soft shadow once the page scrolls
// ---------------------------------------------------------------------------
const header = $('.site-header');
if (header) {
  let ticking = false;
  const update = () => { header.classList.toggle('is-scrolled', scrollY > 8); ticking = false; };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  update();
}

// ---------------------------------------------------------------------------
// Video lightbox: any link with data-youtube / data-vimeo plays in a <dialog>.
// Cmd/Ctrl-click still opens YouTube in a new tab; without JS the link just goes to YouTube.
// ---------------------------------------------------------------------------
let dialog;
function getDialog() {
  if (dialog) return dialog;
  dialog = document.createElement('dialog');
  dialog.className = 'lightbox';
  dialog.innerHTML =
    '<button class="lightbox__close" type="button" aria-label="Close video"></button>' +
    '<div class="lightbox__frame"></div><p class="lightbox__title"></p>';
  document.body.append(dialog);
  $('.lightbox__close', dialog).addEventListener('click', () => dialog.close());
  // Click on the dimmed backdrop (outside the player) closes it
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  // Stop playback when closed
  dialog.addEventListener('close', () => $('.lightbox__frame', dialog).replaceChildren());
  return dialog;
}

document.addEventListener('click', (e) => {
  const trigger = e.target.closest('[data-youtube], [data-vimeo]');
  if (!trigger || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  if (typeof HTMLDialogElement !== 'function') return;
  e.preventDefault();

  const { youtube, vimeo, title = 'Video' } = trigger.dataset;
  const iframe = document.createElement('iframe');
  iframe.src = youtube
    ? `https://www.youtube-nocookie.com/embed/${youtube}?autoplay=1&rel=0&playsinline=1`
    : `https://player.vimeo.com/video/${vimeo}?autoplay=1&dnt=1`;
  iframe.title = title;
  iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
  iframe.allowFullscreen = true;

  const d = getDialog();
  d.setAttribute('aria-label', title);
  $('.lightbox__frame', d).replaceChildren(iframe);
  $('.lightbox__title', d).textContent = title;
  d.showModal();
});

// ---------------------------------------------------------------------------
// Header background video (Home hero, SITREP strip): a muted, looping Vimeo player in
// background mode, added after the page has loaded so it never slows the first paint.
// The poster (the video's thumbnail) stays underneath until the video is playing.
// Visitors who ask for reduced motion or data saving keep the still image.
// ---------------------------------------------------------------------------
const bgVideos = $$('[data-vimeo-bg]');
if (bgVideos.length && !reduceMotion && !navigator.connection?.saveData) {
  const VIMEO = 'https://player.vimeo.com';
  const show = (box) => box.classList.add('is-playing');
  addEventListener('message', (e) => {
    if (e.origin !== VIMEO) return;
    const box = bgVideos.find((b) => $('iframe', b)?.contentWindow === e.source);
    if (!box) return;
    let data = e.data;
    if (typeof data === 'string') { try { data = JSON.parse(data); } catch { return; } }
    if (data?.event === 'ready') {
      for (const value of ['play', 'timeupdate', 'playProgress']) e.source.postMessage(JSON.stringify({ method: 'addEventListener', value }), VIMEO);
    } else if (['play', 'timeupdate', 'playProgress'].includes(data?.event)) show(box);
  });
  const start = () => bgVideos.forEach((box) => {
    const frame = document.createElement('iframe');
    frame.className = 'bg-video__frame';
    frame.src = `${VIMEO}/video/${box.dataset.vimeoBg}?background=1&autoplay=1&loop=1&muted=1&autopause=0&dnt=1`;
    frame.title = box.dataset.title || 'Background video';
    frame.allow = 'autoplay; fullscreen; picture-in-picture';
    frame.tabIndex = -1;
    frame.setAttribute('aria-hidden', 'true');
    // Fallback if the player's events don't arrive: its background is transparent, so the poster shows through.
    frame.addEventListener('load', () => setTimeout(() => show(box), 2500), { once: true });
    box.append(frame);
  });
  if (document.readyState === 'complete') start();
  else addEventListener('load', start, { once: true });
}

// ---------------------------------------------------------------------------
// Homepage reel: starts playing (muted, with controls to unmute) once half of it is
// on screen, pauses when scrolled away. Until then, or for reduced-motion / data-saver
// visitors, it's a thumbnail that opens the lightbox player.
// ---------------------------------------------------------------------------
const reels = $$('[data-vimeo-inline]');
if (reels.length && 'IntersectionObserver' in window && !reduceMotion && !navigator.connection?.saveData) {
  const VIMEO = 'https://player.vimeo.com';
  const send = (frame, msg) => frame.contentWindow?.postMessage(JSON.stringify(msg), VIMEO);
  addEventListener('message', (e) => {
    if (e.origin !== VIMEO) return;
    const box = reels.find((b) => $('.reel__frame', b)?.contentWindow === e.source);
    if (!box) return;
    let data = e.data;
    if (typeof data === 'string') { try { data = JSON.parse(data); } catch { return; } }
    if (data?.event === 'ready') {
      for (const value of ['play', 'timeupdate', 'playProgress']) e.source.postMessage(JSON.stringify({ method: 'addEventListener', value }), VIMEO);
    } else if (['play', 'timeupdate', 'playProgress'].includes(data?.event)) box.classList.add('is-playing');
  });
  const watch = new IntersectionObserver((entries) => {
    for (const { isIntersecting, target: box } of entries) {
      let frame = $('.reel__frame', box);
      if (!isIntersecting) { if (frame) send(frame, { method: 'pause' }); continue; }
      if (frame) { send(frame, { method: 'play' }); continue; }
      frame = document.createElement('iframe');
      frame.className = 'reel__frame';
      frame.src = `${VIMEO}/video/${box.dataset.vimeoInline}?autoplay=1&muted=1&loop=1&autopause=0&dnt=1&title=0&byline=0&portrait=0`;
      frame.title = $('a', box)?.dataset.title || 'Brand reel';
      frame.allow = 'autoplay; fullscreen; picture-in-picture';
      frame.allowFullscreen = true;
      frame.addEventListener('load', () => setTimeout(() => box.classList.add('is-playing'), 2500), { once: true });
      box.append(frame);
    }
  }, { threshold: 0.5 });
  reels.forEach((r) => watch.observe(r));
}

// ---------------------------------------------------------------------------
// Sharper thumbnails: swap YouTube's 480px frame for the 1280px one when a tile
// is shown large enough (and the HD frame exists; YouTube returns a 120px stub if not).
// ---------------------------------------------------------------------------
if ('IntersectionObserver' in window) {
  const thumbs = new IntersectionObserver((entries) => {
    for (const { isIntersecting, target: img } of entries) {
      if (!isIntersecting) continue;
      thumbs.unobserve(img);
      if (img.clientWidth * devicePixelRatio <= 520) continue;
      const hd = new Image();
      hd.onload = () => { if (hd.naturalWidth >= 1280) img.src = hd.src; };
      hd.src = img.dataset.hires;
    }
  }, { rootMargin: '200px' });
  $$('img[data-hires]').forEach((img) => thumbs.observe(img));
}

// ---------------------------------------------------------------------------
// Scroll reveal: below-the-fold blocks fade up as they enter the viewport.
// Only elements that start off-screen are hidden, so nothing flickers on load.
// ---------------------------------------------------------------------------
const REVEAL = [
  '.section__title', '.section .container > p', '.section .container > .lede', '.reel', '.logo-wall li',
  '.work-tile', '.step-cards li', '.team li', '.post-card', '.proof__title',
  '.cards li', '.plan', '.split > *', '.photo-grid li', '.booking', '.map', '.portfolio-cat__title',
  '.cta h2', '.cta p', '.checklist li', '.quote', '.kicker', '.service-list li', '.audience-grid li', '.process li', '.stats li', '.lessons li', '.roster li', '.campfire', '.intel-card', '.intel__intro > *',
].join(',');

if (!reduceMotion && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    for (const { isIntersecting, target } of entries) {
      if (!isIntersecting) continue;
      target.classList.add('is-in');
      io.unobserve(target);
      // Once it has landed, drop the helper classes so the element's own hover transitions apply again
      const done = (ev) => {
        if (ev.target !== target) return;
        target.classList.remove('reveal', 'is-in');
        target.removeEventListener('transitionend', done);
      };
      target.addEventListener('transitionend', done);
    }
  }, { rootMargin: '0px 0px -8% 0px' });

  const fold = innerHeight * 0.92;
  for (const el of $$(REVEAL)) {
    if (el.getBoundingClientRect().top < fold || el.closest('.reveal')) continue;
    // Stagger siblings in a row: 0, 70, 140ms...
    const i = [...el.parentElement.children].indexOf(el);
    el.style.setProperty('--reveal-delay', `${(i % 4) * 70}ms`);
    el.classList.add('reveal');
    io.observe(el);
  }
}

// ---------------------------------------------------------------------------
// Portfolio: once the category bar sticks under the header, the two share one frosted
// background (CSS stretches the bar's frost up behind a transparent header)
// ---------------------------------------------------------------------------
const subnav = $('.chip-nav');
if (subnav) {
  const wide = matchMedia('(min-width: 761px)');
  let ticking = false;
  const check = () => {
    const top = parseFloat(getComputedStyle(subnav).top) || 0;
    document.body.classList.toggle('subnav-stuck', wide.matches && subnav.getBoundingClientRect().top <= top + 0.5);
    ticking = false;
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(check); } }, { passive: true });
  wide.addEventListener('change', check);
  check();
}

// ---------------------------------------------------------------------------
// Portfolio: highlight the category chip for the section on screen
// ---------------------------------------------------------------------------
const chipList = $('.chip-nav ul');
if (chipList && 'IntersectionObserver' in window) {
  const chips = new Map($$('a', chipList).map((a) => [a.hash.slice(1), a]));
  const spy = new IntersectionObserver((entries) => {
    for (const { isIntersecting, target } of entries) {
      if (!isIntersecting) continue;
      chips.forEach((a) => a.removeAttribute('aria-current'));
      const chip = chips.get(target.id);
      if (!chip) continue;
      chip.setAttribute('aria-current', 'true');
      // On phones the chip row scrolls sideways: keep the active chip in view
      if (chipList.scrollWidth > chipList.clientWidth) {
        chipList.scrollTo({ left: chip.offsetLeft - chipList.clientWidth / 2 + chip.clientWidth / 2, behavior: reduceMotion ? 'auto' : 'smooth' });
      }
    }
  }, { rootMargin: '-40% 0px -55% 0px' });
  $$('.portfolio-cat').forEach((s) => spy.observe(s));
  // Back at the top of the page: no category is "current"
  const head = $('.page-head');
  if (head) new IntersectionObserver(([e]) => e.isIntersecting && chips.forEach((c) => c.removeAttribute('aria-current'))).observe(head);
}

// ---------------------------------------------------------------------------
// Lead forms: post in the background and confirm in place.
// Without JS the form posts normally and /api/contact redirects back.
// ---------------------------------------------------------------------------
for (const form of $$('form.lead-form')) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const status = $('.form-status', form);
    const button = $('button[type="submit"]', form);
    button.disabled = true;
    status.className = 'form-status';
    status.textContent = 'Sending...';
    try {
      const res = await fetch(form.action, { method: 'POST', headers: { Accept: 'application/json' }, body: new FormData(form) });
      if (!res.ok) throw new Error(await res.text());
      form.reset();
      status.classList.add('is-ok');
      status.textContent = form.dataset.success || 'Thanks! We will be in touch shortly.';
    } catch {
      status.classList.add('is-error');
      const mail = document.createElement('a');
      mail.href = 'mailto:hi@thrillwave.com';
      mail.textContent = 'hi@thrillwave.com';
      status.replaceChildren("That didn't go through. Please email us at ", mail, '.');
    } finally {
      button.disabled = false;
    }
  });
}
