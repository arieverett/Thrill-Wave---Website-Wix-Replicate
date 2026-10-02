// thrillwave.com: progressive enhancements. Every page works without this file;
// it adds the mobile menu, video lightbox, header background video, scroll reveals and background form posts.

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
// Visitors who asked for less motion or data saving get still images instead of autoplaying video
const quietVideo = reduceMotion || navigator.connection?.saveData;

// Embedded players (YouTube, Vimeo) talk to the page with postMessage, usually as JSON strings
const YT = 'https://www.youtube-nocookie.com';
const VIMEO = 'https://player.vimeo.com';
const playerMessage = (e) => {
  if (typeof e.data !== 'string') return e.data;
  try { return JSON.parse(e.data); } catch { return null; }
};
// Vimeo players announce "ready"; ask them for play/progress events, then call onPlay(box) once footage is really running
const PLAY_EVENTS = ['play', 'timeupdate', 'playProgress'];
const tellVimeo = (frame, message) => frame?.contentWindow?.postMessage(JSON.stringify(message), VIMEO);
const startVimeoMuted = (frame) => {
  tellVimeo(frame, { method: 'setMuted', value: true });
  tellVimeo(frame, { method: 'setVolume', value: 0 });
  tellVimeo(frame, { method: 'play' });
};
function onVimeoPlaying(boxes, frameOf, onPlay) {
  addEventListener('message', (e) => {
    if (e.origin !== VIMEO) return;
    const box = boxes.find((b) => frameOf(b)?.contentWindow === e.source);
    if (!box) return;
    const data = playerMessage(e);
    if (data?.event === 'ready') {
      for (const value of PLAY_EVENTS) e.source.postMessage(JSON.stringify({ method: 'addEventListener', value }), VIMEO);
      // Don't rely on the URL's autoplay flag alone: Safari can load a muted Vimeo iframe without
      // actually starting it. Explicitly mute and play again once Vimeo says the player is ready.
      startVimeoMuted(frameOf(box));
    } else if (PLAY_EVENTS.includes(data?.event)) onPlay(box);
  });
}

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
// Menu dropdowns: a group's name (a button, not a link) opens it (laptops: a panel under the item, also opened by hovering;
// phones: the links expand inside the drawer). One group open at a time; Escape or a click elsewhere closes it.
// ---------------------------------------------------------------------------
const subToggles = $$('.site-nav__toggle');
if (subToggles.length) {
  const setGroup = (btn, open) => {
    btn.setAttribute('aria-expanded', String(open));
    btn.parentElement.classList.toggle('is-open', open);
  };
  const closeGroups = (except) => subToggles.forEach((b) => b !== except && setGroup(b, false));
  subToggles.forEach((btn) => btn.addEventListener('click', () => {
    const open = btn.getAttribute('aria-expanded') !== 'true';
    closeGroups(btn);
    setGroup(btn, open);
  }));
  // The group of the page you're on starts expanded in the phone drawer
  if (matchMedia('(max-width: 760px)').matches) {
    const here = subToggles.find((b) => b.parentElement.classList.contains('is-here'));
    if (here) setGroup(here, true);
  }
  document.addEventListener('click', (e) => {
    // A link in a panel (even to a spot on this same page) or a click outside the menu closes it
    if (matchMedia('(min-width: 761px)').matches && (!e.target.closest('.has-sub') || e.target.closest('.site-nav__sub a'))) closeGroups();
  });
  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const open = subToggles.find((b) => b.getAttribute('aria-expanded') === 'true');
    if (open && matchMedia('(min-width: 761px)').matches) { setGroup(open, false); open.focus(); }
  });
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
    ? `${YT}/embed/${youtube}?autoplay=1&rel=0&playsinline=1`
    : `${VIMEO}/video/${vimeo}?autoplay=1&dnt=1`;
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
// Autoplay tiles (data-autoplay): the player is only added once half the tile is on screen, so it costs
// nothing at page load. It plays muted in place (never in the lightbox) and pauses when scrolled away.
// A 16:9 tile gets the normal player controls. A cropped tile (portrait or zoomed past letterbox bars)
// fills the tile as a silent preview with no controls: clicking it swaps in the full player (uncropped,
// with sound and controls) from the top. Reduced-motion and data-saver visitors get the still until they click it.
// ---------------------------------------------------------------------------
const autoTiles = $$('[data-autoplay]');
if (autoTiles.length) {
  const players = new Map(); // tile -> { frame, native, muted }
  const visible = new Set();
  // YouTube reports its state once we're listening: fade the player in a moment after it really starts
  // (which also hides its opening title card)
  addEventListener('message', (e) => {
    if (e.origin !== YT) return;
    const data = playerMessage(e);
    const tile = [...players].find(([, p]) => p.frame.contentWindow === e.source)?.[0];
    if (!tile || data?.info?.playerState === undefined) return;
    players.get(tile).state = data.info.playerState;
    if (data.info.playerState === 1 && !tile.classList.contains('is-playing')) setTimeout(() => tile.classList.add('is-playing'), 1200);
  });
  const command = (tile, action, arg) => {
    const p = players.get(tile);
    if (!p?.frame.contentWindow) return;
    if (tile.dataset.youtube) {
      const func = { play: 'playVideo', pause: 'pauseVideo', mute: 'mute', unmute: 'unMute', restart: 'seekTo' }[action];
      p.frame.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args: action === 'restart' ? [0, true] : [] }), YT);
    } else {
      const msg = { play: { method: 'play' }, pause: { method: 'pause' }, mute: { method: 'setMuted', value: true },
        unmute: { method: 'setMuted', value: false }, restart: { method: 'setCurrentTime', value: 0 } }[action];
      if (action === 'unmute') p.frame.contentWindow.postMessage(JSON.stringify({ method: 'setVolume', value: 1 }), VIMEO);
      p.frame.contentWindow.postMessage(JSON.stringify(msg), VIMEO);
    }
  };
  const start = (tile, { sound = false, full = false } = {}) => {
    if (players.has(tile)) return;
    const native = full || (!tile.classList.contains('video--zoom') && Math.abs(tile.clientWidth / tile.clientHeight - 16 / 9) < 0.06);
    const { youtube, vimeo, title = 'Video' } = tile.dataset;
    const mute = sound ? 0 : 1;
    const frame = document.createElement('iframe');
    frame.src = youtube
      ? `${YT}/embed/${youtube}?autoplay=1&mute=${mute}&playsinline=1&loop=1&playlist=${youtube}&rel=0&iv_load_policy=3&cc_load_policy=0&enablejsapi=1&controls=${native ? 1 : 0}`
      : `${VIMEO}/video/${vimeo}?autoplay=1&muted=${mute}&loop=1&autopause=0&dnt=1&title=0&byline=0&portrait=0${native ? '' : '&controls=0'}`;
    frame.title = title;
    frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    frame.allowFullscreen = true;
    if (!native) frame.tabIndex = -1;
    const box = document.createElement('span');
    box.className = 'video__player';
    box.append(frame);
    tile.append(box);
    tile.classList.add(native ? 'is-native' : 'is-cropped', sound ? 'is-sound' : 'is-muted');
    players.set(tile, { frame, native, muted: !sound });
    frame.addEventListener('load', () => {
      if (youtube) {
        // YouTube often ignores autoplay=1 in an embed, so ask it to play once it's ready, and listen for its state
        frame.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: youtube }), YT);
        let tries = 0;
        const nudge = setInterval(() => {
          const p = players.get(tile);
          if (p.state === 1 || ++tries > 15) return clearInterval(nudge);
          frame.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: youtube }), YT);
          if (visible.has(tile) || sound) command(tile, 'play');
        }, 700);
      } else setTimeout(() => tile.classList.add('is-playing'), native ? 600 : 2000);
    }, { once: true });
    if (!native) tile.setAttribute('aria-label', `${sound ? 'Mute' : 'Play with sound'}: ${title}`);
  };
  for (const tile of autoTiles) {
    tile.addEventListener('click', (e) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      const p = players.get(tile);
      if (p?.native) return;
      // Clicking the muted preview swaps it for the full player: uncropped, with sound and the usual controls, from the top
      if (p) { p.frame.parentElement.remove(); players.delete(tile); tile.classList.remove('is-cropped', 'is-muted', 'is-playing'); }
      start(tile, { sound: true, full: true });
      tile.setAttribute('aria-label', tile.dataset.title || 'Video');
    });
  }
  if ('IntersectionObserver' in window && !quietVideo) {
    const watch = new IntersectionObserver((entries) => {
      for (const { isIntersecting, target: tile } of entries) {
        if (isIntersecting) visible.add(tile); else visible.delete(tile);
        if (!players.has(tile)) { if (isIntersecting) start(tile); continue; }
        command(tile, isIntersecting ? 'play' : 'pause');
      }
    }, { threshold: 0.5 });
    const begin = () => autoTiles.forEach((t) => watch.observe(t));
    if (document.readyState === 'complete') begin();
    else addEventListener('load', begin, { once: true });
  }
}

// ---------------------------------------------------------------------------
// Background videos (Home hero, SITREP strip, the vertical clip beside 01 and the closing block): a muted, looping Vimeo player in
// background mode, added after the page has loaded so it never slows the first paint.
// The poster (the video's thumbnail) stays underneath until the video is playing.
// Visitors who ask for reduced motion or data saving keep the still image.
// ---------------------------------------------------------------------------
const bgVideos = $$('[data-vimeo-bg]');
if (bgVideos.length && !quietVideo) {
  const show = (box) => box.classList.add('is-playing');
  onVimeoPlaying(bgVideos, (box) => $('iframe', box), show);
  const start = (boxes) => boxes.forEach((box) => {
    const frame = document.createElement('iframe');
    frame.className = 'bg-video__frame';
    frame.src = `${VIMEO}/video/${box.dataset.vimeoBg}?background=1&autoplay=1&loop=1&muted=1&autopause=0&playsinline=1&dnt=1`;
    frame.title = box.dataset.title || 'Background video';
    frame.allow = 'autoplay; fullscreen; picture-in-picture';
    frame.tabIndex = -1;
    frame.setAttribute('aria-hidden', 'true');
    frame.addEventListener('load', () => {
      // A second explicit play request covers Safari builds that ignore autoplay during iframe creation.
      startVimeoMuted(frame);
      setTimeout(() => startVimeoMuted(frame), 700);
    }, { once: true });
    box.append(frame);
  });
  // Each player is added once its box is near the screen (after the page has loaded), so below-the-fold clips cost nothing up front
  const begin = () => {
    if (!('IntersectionObserver' in window)) return start(bgVideos);
    const near = new IntersectionObserver((entries) => {
      for (const { target, isIntersecting } of entries) if (isIntersecting) { near.unobserve(target); start([target]); }
    }, { rootMargin: '400px 0px' });
    bgVideos.forEach((box) => near.observe(box));
  };
  // site.js is deferred, so the DOM is already parsed here. Start observing immediately:
  // the visible hero can begin loading/playing without waiting for every image/font on the page.
  begin();
}

// ---------------------------------------------------------------------------
// Homepage reel: starts playing (muted, with controls to unmute) once half of it is
// on screen, pauses when scrolled away. Until then, or for reduced-motion / data-saver
// visitors, it's a thumbnail that opens the lightbox player.
// ---------------------------------------------------------------------------
const reels = [...document.querySelectorAll('[data-vimeo-inline]')];
if (reels.length && 'IntersectionObserver' in window && !quietVideo) {
  const send = (frame, msg) => tellVimeo(frame, msg);
  onVimeoPlaying(reels, (box) => $('.reel__frame', box), (box) => box.classList.add('is-playing'));
  const watch = new IntersectionObserver((entries) => {
    for (const { isIntersecting, target: box } of entries) {
      let frame = $('.reel__frame', box);
      if (!isIntersecting) { if (frame) send(frame, { method: 'pause' }); continue; }
      if (frame) { send(frame, { method: 'play' }); continue; }
      frame = document.createElement('iframe');
      frame.className = 'reel__frame';
      frame.src = `${VIMEO}/video/${box.dataset.vimeoInline}?autoplay=1&muted=1&loop=1&autopause=0&playsinline=1&dnt=1&title=0&byline=0&portrait=0`;
      frame.title = $('a', box)?.dataset.title || 'Brand reel';
      frame.allow = 'autoplay; fullscreen; picture-in-picture';
      frame.allowFullscreen = true;
      frame.addEventListener('load', () => {
        startVimeoMuted(frame);
        setTimeout(() => startVimeoMuted(frame), 700);
      }, { once: true });
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
      // Small tiles keep the 480px frame, unless the tile crops it (square or portrait), where its black bars would show
      const cropped = img.clientHeight && img.clientWidth / img.clientHeight < 1.6;
      if (!cropped && img.clientWidth * devicePixelRatio <= 520) continue;
      const hd = new Image();
      hd.onload = () => { if (hd.naturalWidth >= 1280) img.src = hd.src; };
      hd.src = img.dataset.hires;
    }
  }, { rootMargin: '200px' });
  $$('img[data-hires]').forEach((img) => thumbs.observe(img));
}

// ---------------------------------------------------------------------------
// Case studies: clicking an item opens its photo panel (right column on laptops, under the item on phones)
// ---------------------------------------------------------------------------
for (const list of $$('.cases')) {
  const tabs = $$('.cases__tab', list);
  const open = (tab) => tabs.forEach((t) => {
    const on = t === tab;
    t.setAttribute('aria-expanded', String(on));
    t.parentElement.classList.toggle('is-open', on);
  });
  tabs.forEach((t) => t.addEventListener('click', () => open(t)));
  list.classList.add('is-ready');
}

// ---------------------------------------------------------------------------
// Typewriter titles (pages with body class "page-typed"): the hero headline types first, then each section
// title types as it scrolls into view. The whole title is in the HTML the entire time, so search engines
// and screen readers always get the full text.
// Each letter gets its own span once, up front, drawn transparent. Typing only flips a letter's fill
// colour on and moves the caret (a thin bar every letter carries, hidden until it's that letter's turn).
// Nothing is added, removed or resized while a title types, so the page never re-lays out and the hero
// video behind the headline is never redrawn (that redraw flickered on iPhones).
// One caret for the whole page: a title waits its turn while the one above is still typing on screen;
// if that one has scrolled away, it finishes instantly and the caret moves down. The last title typed
// keeps the blinking caret.
// ---------------------------------------------------------------------------
const TYPE_TITLES = '.page-typed .hero__content > .hero__stack, .page-typed .section__title';
// Milliseconds to wait after each character. Same rhythm on every title.
const TYPE_PACE = { letter: 67, space: 40, pause: 205, stop: 360, beat: 590, lead: 170 };
// pause: after , ; : and dashes. stop: after . ! ? and ellipses.
// beat: optional data-type-beat="n" holds after the nth character ("Hi" ... ", welcome").

const typeTitles = reduceMotion || !('IntersectionObserver' in window) ? [] : $$(TYPE_TITLES);
if (typeTitles.length) {
  // Split a title's text into letter spans (spaces stay plain text, so lines wrap exactly as before).
  // Screen readers get one hidden copy of the full title instead of the letters.
  const split = (title) => {
    const chars = [];
    const nodes = [];
    const walker = document.createTreeWalker(title, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) if (walker.currentNode.data.trim()) nodes.push(walker.currentNode);
    const label = title.textContent.replace(/\s+/g, ' ').trim();
    for (const node of nodes) {
      const wrap = document.createElement('span');
      wrap.setAttribute('aria-hidden', 'true');
      for (const part of node.data.split(/(\s+)/)) {
        if (!part) continue;
        if (/^\s+$/.test(part)) { wrap.append(part); chars.push({ ch: part }); continue; }
        for (const ch of part) {
          const el = document.createElement('span');
          el.className = 'tw-ch';
          el.textContent = ch;
          wrap.append(el);
          chars.push({ ch, el });
        }
      }
      node.replaceWith(wrap);
    }
    const spoken = document.createElement('span');
    spoken.className = 'visually-hidden';
    spoken.textContent = label;
    title.append(spoken);
    title.classList.add('tw-on');
    return chars;
  };

  const states = new Map(typeTitles.map((title) => [title, { title, chars: split(title), beat: Number(title.dataset.typeBeat) || 0, visible: false, state: 'waiting', i: 0, count: 0, timer: 0 }]));

  // The caret: shown after the last letter typed, or before the next one (at the start, and after a space)
  let caret = null;
  const setCaret = (el, side) => {
    if (caret) caret.el.classList.remove(caret.cls);
    caret = el ? { el, cls: side === 'before' ? 'tw-caret-before' : 'tw-caret-after' } : null;
    caret?.el.classList.add(caret.cls);
  };
  const nextLetter = (st, from) => st.chars.slice(from).find((c) => c.el)?.el;

  let active = null;

  const pace = (char, st) => {
    if (st.beat && st.count === st.beat) return TYPE_PACE.beat;
    if (/[.!?…]/.test(char)) return TYPE_PACE.stop;
    if (/[,;:—–]/.test(char)) return TYPE_PACE.pause;
    if (/\s/.test(char)) return TYPE_PACE.space;
    return TYPE_PACE.letter;
  };

  const done = (st) => {
    st.state = 'done';
    st.title.classList.remove('is-typing');
    io.unobserve(st.title);
    if (active === st) active = null;
  };

  // Reveal everything left in a title at once (it scrolled away before it finished)
  const finish = (st) => {
    clearTimeout(st.timer);
    st.title.classList.add('tw-all');
    setCaret([...st.chars].reverse().find((c) => c.el)?.el, 'after');
    done(st);
  };

  const tick = (st) => {
    const c = st.chars[st.i];
    if (!c) { done(st); next(); return; }
    st.i += 1;
    st.count += 1;
    if (c.el) {
      c.el.classList.add('is-on');
      setCaret(c.el, 'after');
    } else {
      const upcoming = nextLetter(st, st.i);
      if (upcoming) setCaret(upcoming, 'before');
    }
    st.timer = setTimeout(tick, pace(c.ch, st), st);
  };

  const start = (st) => {
    active = st;
    st.state = 'typing';
    st.title.classList.add('is-typing');
    setCaret(nextLetter(st, 0), 'before'); // the caret waits at the start of the title
    st.timer = setTimeout(tick, TYPE_PACE.lead, st);
  };

  // Start the first title on screen that hasn't typed yet, in page order
  const next = () => {
    if (active) {
      if (active.visible) return;
      finish(active);
    }
    for (const st of states.values()) {
      if (st.state === 'waiting' && st.visible) { start(st); return; }
    }
  };

  const io = new IntersectionObserver((entries) => {
    for (const { target, isIntersecting } of entries) states.get(target).visible = isIntersecting;
    next();
  }, { rootMargin: '0px 0px -14% 0px', threshold: 0.15 });
  typeTitles.forEach((title) => io.observe(title));
}

// ---------------------------------------------------------------------------
// Intel: show nine posts, then a See more button that adds nine at a time.
// Every post is still in the page, so search engines (and visitors without JS) see them all.
// ---------------------------------------------------------------------------
for (const grid of $$('.post-grid[data-show]')) {
  const step = Number(grid.dataset.show) || 9;
  const cards = [...grid.children];
  if (cards.length <= step) continue;
  cards.slice(step).forEach((card) => { card.hidden = true; });
  const more = document.createElement('div');
  more.className = 'post-more';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn btn--plain btn--pill btn--clear';
  button.textContent = 'See more';
  more.append(button);
  grid.after(more);
  button.addEventListener('click', () => {
    const next = cards.filter((card) => card.hidden).slice(0, step);
    next.forEach((card) => { card.hidden = false; });
    // Keyboard users land on the first new post; the page itself doesn't jump
    next[0]?.querySelector('a')?.focus({ preventScroll: true });
    if (!cards.some((card) => card.hidden)) more.remove();
  });
}

// ---------------------------------------------------------------------------
// Scroll reveal: below-the-fold blocks fade up as they enter the viewport.
// Only elements that start off-screen are hidden, so nothing flickers on load.
// ---------------------------------------------------------------------------
const REVEAL = [
  '.section__title', '.section .container > p', '.section .container > .lede', '.reel',
  '.work-tile', '.step-cards li', '.team li', '.post-card', '.proof__title',
  '.booking', '.map', '.portfolio-cat__title',
  '.cta h2', '.cta p', '.kicker', '.service-list li', '.cases__tab', '.charter li', '.guide__item', '.audience-cards li', '.industry-cards li', '.sitrep-steps li', '.promise-list li', '.process li', '.stats li', '.lessons li', '.roster li', '.campfire', '.intel-card', '.intel__intro > *',
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
    if (el.matches(TYPE_TITLES) || el.getBoundingClientRect().top < fold || el.closest('.reveal')) continue;
    // Stagger siblings in a row: 0, 70, 140ms...
    const i = [...el.parentElement.children].indexOf(el);
    el.style.setProperty('--reveal-delay', `${(i % 4) * 70}ms`);
    el.classList.add('reveal');
    io.observe(el);
  }
}

// ---------------------------------------------------------------------------
// Portfolio and Intel: once the category bar sticks under the header, the two share one frosted
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
// (Intel's chips link to category pages and already mark the one you're on, so they're left alone)
// ---------------------------------------------------------------------------
const chipList = $('.chip-nav ul');
if (chipList && $('.portfolio-cat') && 'IntersectionObserver' in window) {
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
// Newsletter sign-up (Intel): not connected yet. Nothing is sent or saved; the visitor gets a short note instead.
// When the newsletter is set up, post the form to its endpoint here (like the contact form below).
// ---------------------------------------------------------------------------
for (const toggle of $$('[data-newsletter-toggle]')) {
  const form = document.getElementById(toggle.getAttribute('aria-controls'));
  if (!form) continue;
  toggle.addEventListener('click', () => {
    form.hidden = !form.hidden;
    toggle.setAttribute('aria-expanded', String(!form.hidden));
    if (!form.hidden) $('input', form)?.focus();
  });
}
for (const form of $$('form[data-newsletter]')) {
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    $('.newsletter__status', form).textContent = "Thanks! Our newsletter isn't live yet, so we didn't save your details. Check back soon.";
  });
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

// ---------------------------------------------------------------------------
// Missing HD stills: some older YouTube uploads have no 1280px frame, and YouTube
// answers with a 120px grey stub. Fall back to the 480px frame so the tile never shows grey.
// ---------------------------------------------------------------------------
$$('img[src*="i.ytimg.com/vi/"][src*="/maxres"]').forEach((img) => {
  const fix = () => {
    if (img.naturalWidth > 120) return;
    const n = img.src.match(/\/maxres(\d)\.jpg/)?.[1];
    img.removeAttribute('data-hires');
    img.src = img.src.replace(/\/maxres(default|\d)\.jpg/, n ? `/hq${n}.jpg` : '/hqdefault.jpg');
  };
  if (img.complete && img.naturalWidth) fix();
  else img.addEventListener('load', fix, { once: true });
});
