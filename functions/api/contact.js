// Cloudflare Pages Function: handles POST /api/contact from every lead form on the site.
//
// It forwards each submission as JSON to FORM_WEBHOOK_URL, which you set in
// Cloudflare Pages > Settings > Environment variables. Point it at whatever should
// receive leads: a HubSpot/Zapier/Make webhook, a Slack incoming webhook, a Google
// Apps Script that appends to a Sheet, etc. Nothing else to configure.

export async function onRequestPost({ request, env }) {
  const wantsJson = (request.headers.get('Accept') || '').includes('application/json');
  let data = {};

  const type = request.headers.get('Content-Type') || '';
  if (type.includes('application/json')) {
    data = await request.json();
  } else {
    const form = await request.formData();
    for (const [k, v] of form.entries()) data[k] = typeof v === 'string' ? v.trim() : '';
  }

  // Honeypot: bots fill the hidden field, people don't.
  if (data.company_website) return done(wantsJson, request);
  delete data.company_website;

  if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    return new Response('A valid email is required.', { status: 400 });
  }

  const payload = {
    ...data,
    page: request.headers.get('Referer') || '',
    submitted_at: new Date().toISOString(),
    country: request.cf?.country || '',
  };

  if (!env.FORM_WEBHOOK_URL) {
    console.error('FORM_WEBHOOK_URL is not set; lead not delivered:', payload);
    return new Response('Form endpoint not configured.', { status: 500 });
  }

  // redirect: 'manual' — Google Apps Script answers a successful POST with a 302 to a
  // "result" page. The lead is already saved at that point, so a 3xx counts as delivered.
  // Following the redirect only added a slow (up to ~20s) and occasionally failing second
  // request, which made visitors see an error even though their lead had arrived.
  const res = await fetch(env.FORM_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    redirect: 'manual',
  });
  if (res.status >= 400) {
    console.error('Webhook rejected lead', res.status, await res.text());
    return new Response('Could not deliver message.', { status: 502 });
  }
  return done(wantsJson, request);
}

function done(wantsJson, request) {
  if (wantsJson) return Response.json({ ok: true });
  // No-JS fallback: send them back to the page they came from.
  const back = request.headers.get('Referer') || '/contact';
  return Response.redirect(back, 303);
}
