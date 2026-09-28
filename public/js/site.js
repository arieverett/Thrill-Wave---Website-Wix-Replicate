// thrillwave.com: progressive enhancements. Every page works without this file;
// it adds the mobile menu, video lightbox, scroll reveals and background form posts.

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------------------------------------------------------------------------
// Mobile menu
// ---------------------------------------------------------------------------
const toggle = $('.nav-toggle');
const nav = $('#site-nav');
if (toggle && nav) {
  const setMenu = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    nav.classList.toggle('is-open', open);
    document.body.classList.toggle('nav-open', open);
  };
  toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
  nav.addEventListener('click', (e) => e.target.closest('a') && setMenu(false));
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) { setMenu(false); toggle.focus(); }
  });
  matchMedia('(min-width: 761px)').addEventListener('change', (e) => e.matches && setMenu(false));
}

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
  '.work-tile', '.step-cards li', '.team li', '.post-card', '.failure-grid li', '.proof', '.engagement',
  '.cards li', '.plan', '.split > *', '.photo-grid li', '.booking', '.faq', '.map', '.portfolio-cat__title',
  '.cta h2', '.cta p', '.checklist li', '.quote',
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
