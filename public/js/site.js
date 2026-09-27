// thrillwave.com — small progressive enhancements. The site works without this file.

// Mobile menu
const toggle = document.querySelector('.nav-toggle');
const nav = document.getElementById('site-nav');
if (toggle && nav) {
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!open));
    nav.classList.toggle('is-open', !open);
    document.body.classList.toggle('nav-open', !open);
  });
  nav.addEventListener('click', (e) => {
    if (e.target.closest('a')) {
      toggle.setAttribute('aria-expanded', 'false');
      nav.classList.remove('is-open');
      document.body.classList.remove('nav-open');
    }
  });
}

// Click-to-load YouTube: shows a thumbnail first, loads the player only on click.
// Keeps pages fast (a YouTube iframe is ~1MB each; the portfolio has 36).
document.querySelectorAll('.video[data-youtube]').forEach((el) => {
  el.addEventListener('click', () => {
    const id = el.dataset.youtube;
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
    iframe.title = el.dataset.title || 'YouTube video';
    iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    iframe.allowFullscreen = true;
    el.innerHTML = '';
    el.appendChild(iframe);
  }, { once: true });
});

// Portfolio category tabs
const tabs = [...document.querySelectorAll('.tab[role="tab"]')];
tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    tabs.forEach((t) => {
      const selected = t === tab;
      t.setAttribute('aria-selected', String(selected));
      document.getElementById(t.getAttribute('aria-controls')).hidden = !selected;
    });
    history.replaceState(null, '', '#' + tab.id.replace(/^tab-/, ''));
  });
});
if (tabs.length && location.hash) {
  const match = document.getElementById('tab-' + location.hash.slice(1));
  if (match) match.click();
}

// Lead forms: submit in the background, show the confirmation message in place.
document.querySelectorAll('form.lead-form').forEach((form) => {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const status = form.querySelector('.form-status');
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    status.textContent = 'Sending...';
    try {
      const res = await fetch(form.action, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: new FormData(form),
      });
      if (!res.ok) throw new Error(await res.text());
      form.reset();
      status.textContent = form.dataset.success || 'Thanks!';
    } catch (err) {
      status.textContent = 'Something went wrong. Email us at hi@thrillwave.com.';
      button.disabled = false;
    }
  });
});
