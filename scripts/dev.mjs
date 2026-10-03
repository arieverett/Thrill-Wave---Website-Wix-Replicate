// Local dev server: `npm run dev` (the equivalent of VS Code's Live Server)
// ---------------------------------------------------------------------------
// Builds the site, opens it in your browser, and rebuilds + reloads the page
// whenever you save a file. Serves dist/ the way Cloudflare Pages will. No dependencies.
//
//   - first run installs the packages it needs (npm install) automatically
//   - opens http://localhost:8788 in your default browser (skip: npm run dev -- --no-open)
//   - port already taken? it moves to the next free one, like Live Server
//   - clean URLs (/portfolio serves portfolio.html; /portfolio.html redirects)
//   - public/_redirects and public/_headers applied, CSP included
//   - 404.html for unknown paths
//   - POST /api/contact runs functions/api/contact.js. Without a FORM_WEBHOOK_URL
//     (env var or a .dev.vars file) the lead is printed here instead of sent.
//   - CSS-only edits swap the stylesheet in place; everything else reloads the page

import http from 'node:http';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.env.PORT) || 8788;
const WATCH = ['src', 'content', 'public', 'build.mjs', 'lib'];

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  '.mp4': 'video/mp4', '.pdf': 'application/pdf',
};

const c = { dim: (s) => `\x1b[2m${s}\x1b[0m`, green: (s) => `\x1b[32m${s}\x1b[0m`, red: (s) => `\x1b[31m${s}\x1b[0m`, bold: (s) => `\x1b[1m${s}\x1b[0m` };

// ---------------------------------------------------------------------------
// Build (in a child process, so every rebuild starts fresh)
// ---------------------------------------------------------------------------
function build() {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(process.execPath, ['build.mjs', '--dev'], { cwd: ROOT });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('close', (code) => {
      const ms = Date.now() - started;
      if (code === 0) console.log(c.dim(out.trim()) + c.dim(` (${ms}ms)`));
      else console.error(c.red('Build failed:\n') + out);
      resolve(code === 0 ? null : out);
    });
  });
}

// ---------------------------------------------------------------------------
// Cloudflare Pages rules: _redirects and _headers
// ---------------------------------------------------------------------------
const pattern = (from) =>
  new RegExp('^' + from.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '(?<splat>.*)').replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$');

function loadRedirects() {
  const file = path.join(DIST, '_redirects');
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split('\n')
    .map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
    .map((l) => { const [from, to, status = '302'] = l.split(/\s+/); return { re: pattern(from), to, status: Number(status) }; });
}

function loadHeaders() {
  const file = path.join(DIST, '_headers');
  if (!fs.existsSync(file)) return [];
  const rules = [];
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) rules.push({ re: pattern(line.trim()), headers: {} });
    else if (rules.length) {
      const i = line.indexOf(':');
      rules.at(-1).headers[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
  }
  return rules;
}

let redirects = [];
let headerRules = [];
const reloadRules = () => { redirects = loadRedirects(); headerRules = loadHeaders(); };

function headersFor(urlPath) {
  const h = {};
  for (const r of headerRules) if (r.re.test(urlPath)) Object.assign(h, r.headers);
  delete h['Strict-Transport-Security']; // meaningless on http://localhost
  h['Content-Security-Policy'] = (h['Content-Security-Policy'] || '').replace(/;?\s*upgrade-insecure-requests/, '');
  return h;
}

// ---------------------------------------------------------------------------
// Live reload (Server-Sent Events)
// ---------------------------------------------------------------------------
const clients = new Set();
const send = (event, data = '') => { for (const res of clients) res.write(`event: ${event}\ndata: ${data}\n\n`); };

const LIVERELOAD_JS = `// dev only
(() => {
  const es = new EventSource('/__livereload');
  es.addEventListener('reload', () => location.reload());
  es.addEventListener('css', (e) => {
    const link = document.querySelector('link[rel="stylesheet"][href^="/css/"]');
    if (!link) return location.reload();
    const next = link.cloneNode();
    next.href = e.data;
    next.onload = () => link.remove();
    link.after(next);
  });
  es.addEventListener('error-msg', (e) => {
    let box = document.getElementById('__build-error');
    if (!box) {
      box = document.createElement('pre');
      box.id = '__build-error';
      box.style.cssText = 'position:fixed;inset:auto 16px 16px 16px;z-index:9999;max-height:50vh;overflow:auto;margin:0;padding:16px;background:#1b0b0b;color:#ffb4b4;font:12px/1.5 ui-monospace,monospace;border:1px solid #e5484d;border-radius:8px;white-space:pre-wrap';
      document.body.append(box);
    }
    box.textContent = 'Build failed. Fix the error and save again.\\n\\n' + JSON.parse(e.data);
  });
})();
`;

// ---------------------------------------------------------------------------
// POST /api/contact: run the real Pages Function locally
// ---------------------------------------------------------------------------
function devVars() {
  const vars = { FORM_WEBHOOK_URL: process.env.FORM_WEBHOOK_URL };
  const file = path.join(ROOT, '.dev.vars');
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^\s*([\w]+)\s*=\s*"?(.*?)"?\s*$/);
      if (m) vars[m[1]] = m[2];
    }
  }
  return vars;
}

async function handleContact(req, res) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const headers = {};
  for (const h of ['content-type', 'accept', 'referer', 'user-agent']) if (req.headers[h]) headers[h] = req.headers[h];
  const request = new Request(`http://localhost:${PORT}${req.url}`, { method: 'POST', headers, body: Buffer.concat(chunks) });
  const env = devVars();
  let response;
  if (env.FORM_WEBHOOK_URL) {
    const { onRequestPost } = await import(pathToFileURL(path.join(ROOT, 'functions/api/contact.js')).href + `?t=${Date.now()}`);
    response = await onRequestPost({ request, env });
  } else {
    const form = Object.fromEntries((await request.clone().formData().catch(() => new Map())).entries());
    console.log(c.green('Lead received (dev, not sent anywhere):'), form);
    response = Response.json({ ok: true });
  }
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}

// ---------------------------------------------------------------------------
// Static file server
// ---------------------------------------------------------------------------
function resolveFile(urlPath) {
  const safe = path.normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, '');
  const file = path.join(DIST, safe);
  if (!file.startsWith(DIST)) return null;
  const candidates = urlPath.endsWith('/') ? [path.join(file, 'index.html')] : [file, file + '.html', path.join(file, 'index.html')];
  return candidates.find((f) => fs.existsSync(f) && fs.statSync(f).isFile()) || null;
}

function serveFile(res, file, status, urlPath) {
  const ext = path.extname(file);
  const rules = headersFor(urlPath);
  const headers = { ...rules, 'Content-Type': rules['Content-Type'] || MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-cache' };
  if (ext === '.html') {
    const html = fs.readFileSync(file, 'utf8').replace('</body>', '<script src="/__livereload.js"></script>\n</body>');
    res.writeHead(status, headers);
    return res.end(html);
  }
  res.writeHead(status, headers);
  fs.createReadStream(file).pipe(res);
}

// no-store so the browser doesn't cache a 301 while you're still editing _redirects
const redirect = (res, to, status = 308) => { res.writeHead(status, { Location: to, 'Cache-Control': 'no-store' }); res.end(); };
const withSearch = (to, search) => {
  if (!search || to.includes('?')) return to;
  const hash = to.indexOf('#');
  return hash === -1 ? to + search : to.slice(0, hash) + search + to.slice(hash);
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const p = url.pathname;
  try {
    if (p === '/__livereload') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      res.write(': connected\n\n');
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }
    if (p === '/__livereload.js') {
      res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-cache' });
      return res.end(LIVERELOAD_JS);
    }
    if (p === '/api/contact') {
      if (req.method !== 'POST') { res.writeHead(405, { Allow: 'POST' }); return res.end('Method not allowed'); }
      return await handleContact(req, res);
    }

    // _redirects first, like Cloudflare
    for (const r of redirects) {
      const m = p.match(r.re);
      if (!m) continue;
      let to = r.to;
      for (const [k, v] of Object.entries(m.groups || {})) to = to.replace(k === 'splat' ? ':splat' : `:${k}`, v);
      return redirect(res, withSearch(to, url.search), r.status);
    }

    // Clean URLs: /index.html -> /, /foo.html -> /foo, /foo/ -> /foo
    if (p.endsWith('/index.html')) return redirect(res, p.slice(0, -'index.html'.length) + url.search);
    if (p.endsWith('.html')) return redirect(res, p.slice(0, -5) + url.search);
    if (p.length > 1 && p.endsWith('/') && !resolveFile(p)) return redirect(res, p.slice(0, -1) + url.search);

    const file = resolveFile(p);
    if (file) return serveFile(res, file, 200, p);
    const notFound = path.join(DIST, '404.html');
    if (fs.existsSync(notFound)) return serveFile(res, notFound, 404, p);
    res.writeHead(404); res.end('Not found');
  } catch (err) {
    console.error(c.red(err.stack || err));
    if (!res.headersSent) res.writeHead(500);
    res.end('Dev server error: ' + err.message);
  }
});

// ---------------------------------------------------------------------------
// Watch + rebuild
// ---------------------------------------------------------------------------
let timer;
let pending = new Set();
let building = false;

async function rebuild() {
  if (building) return;
  building = true;
  const changed = [...pending];
  pending = new Set();
  console.log(c.dim(`\nchanged: ${changed.join(', ')}`));
  const error = await build();
  reloadRules();
  if (error) send('error-msg', JSON.stringify(error));
  else if (changed.every((f) => f.startsWith(path.join('public', 'css')))) {
    const css = fs.readdirSync(path.join(DIST, 'css')).find((f) => /^site\.\w+\.css$/.test(f));
    send('css', `/css/${css}`);
  } else send('reload');
  building = false;
  if (pending.size) rebuild();
}

function watch() {
  for (const target of WATCH) {
    const full = path.join(ROOT, target);
    if (!fs.existsSync(full)) continue;
    const isDir = fs.statSync(full).isDirectory();
    fs.watch(full, { recursive: isDir }, (_event, name) => {
      const rel = isDir ? path.join(target, String(name || '')) : target;
      if (/(^|[/\\])\.|~$|\.swp$/.test(rel)) return; // editor temp files, .DS_Store
      pending.add(rel);
      clearTimeout(timer);
      timer = setTimeout(rebuild, 120);
    });
  }
}

// ---------------------------------------------------------------------------
// Start: install packages on first run, build, serve, open the browser
// ---------------------------------------------------------------------------
if (!['marked', 'esbuild'].every((m) => fs.existsSync(path.join(ROOT, 'node_modules', m)))) {
  console.log(c.dim('First run: installing packages (one time only)...'));
  const win = process.platform === 'win32';
  const npm = spawnSync(win ? 'npm.cmd' : 'npm', ['install', '--no-audit', '--no-fund'], { cwd: ROOT, stdio: 'inherit', shell: win });
  if (npm.status !== 0) process.exit(1);
}

const error = await build();
if (error) process.exit(1);
reloadRules();
watch();

// Same Wi-Fi as this computer? Open the Network address on your phone to test the mobile layout.
const lanUrl = (port) => {
  const ip = Object.values(os.networkInterfaces()).flat().find((i) => i && i.family === 'IPv4' && !i.internal)?.address;
  return ip ? `http://${ip}:${port}` : null;
};

function openBrowser(url) {
  if (process.argv.includes('--no-open') || process.env.NO_OPEN || process.env.CI) return;
  const [cmd, args] =
    process.platform === 'darwin' ? ['open', [url]] : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : ['xdg-open', [url]];
  spawn(cmd, args, { stdio: 'ignore', detached: true }).on('error', () => {}).unref();
}

let port = PORT;
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE' && port < PORT + 20) return server.listen(++port);
  console.error(err);
  process.exit(1);
});
server.on('listening', () => {
  const local = `http://localhost:${port}`;
  console.log(`\n  ${c.bold('Thrill Wave')} dev server${port !== PORT ? c.dim(` (port ${PORT} was busy)`) : ''}`);
  console.log(`  Local:    ${c.green(local)}`);
  if (lanUrl(port)) console.log(`  Network:  ${c.green(lanUrl(port))} ${c.dim('(open on your phone, same Wi-Fi)')}`);
  console.log(c.dim('  Watching src/, content/, public/, build.mjs and lib/. Save a file and the browser updates. Ctrl+C to stop.\n'));
  openBrowser(local);
});
server.listen(port);
