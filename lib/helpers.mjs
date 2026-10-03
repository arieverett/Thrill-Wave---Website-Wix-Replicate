import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { transform } from 'esbuild';
import { DEV, ROOT, DIST, site } from './context.mjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
export const esc = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const decode = (s = '') =>
  s.replace(/&#39;|&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
export const slugify = (s) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
export const fmtDate = (d) =>
  new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
export const absUrl = (u) => (u.startsWith('/') ? site.url + u : u);
export const canonicalOf = (urlPath) => site.url + (urlPath === '/' ? '' : urlPath);
export const clip = (text, max) => (text.length <= max ? text : text.slice(0, max - 3).replace(/[\s,;:.-]+\S*$/, '') + '...');
export const exists = (publicPath) => fs.existsSync(path.join(ROOT, 'public', publicPath));

// Fill {{key}} and {{site.key}} tokens. Unknown tokens are left in place.
export function fill(tpl, vars) {
  return tpl.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, key) => {
    const val = key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), vars);
    return val === undefined ? m : val;
  });
}

export function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name === '.DS_Store') continue;
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    entry.isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d);
  }
}

// Read pixel dimensions from PNG, JPEG and WebP headers (no image library needed).
const sizeCache = new Map();
export function imageSize(file) {
  if (sizeCache.has(file)) return sizeCache.get(file);
  let size = null;
  try {
    const b = fs.readFileSync(file);
    if (/\.svg$/i.test(file)) {
      const vb = b.toString('utf8', 0, 2000).match(/viewBox="[\d.\s-]*?([\d.]+)\s+([\d.]+)"/);
      if (vb) size = [Math.round(+vb[1]), Math.round(+vb[2])];
    } else if (b.toString('ascii', 1, 4) === 'PNG') size = [b.readUInt32BE(16), b.readUInt32BE(20)];
    else if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
      const chunk = b.toString('ascii', 12, 16);
      if (chunk === 'VP8X') size = [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
      else if (chunk === 'VP8L') { const n = b.readUInt32LE(21); size = [1 + (n & 0x3fff), 1 + ((n >> 14) & 0x3fff)]; }
      else if (chunk === 'VP8 ') size = [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
    } else if (b[0] === 0xff && b[1] === 0xd8) {
      for (let i = 2; i < b.length - 8; ) {
        if (b[i] !== 0xff || b[i + 1] === 0xff) { i++; continue; }
        const m = b[i + 1];
        if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) { size = [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)]; break; }
        i += 2 + b.readUInt16BE(i + 2);
      }
    }
  } catch { /* missing file: leave unsized */ }
  sizeCache.set(file, size);
  return size;
}

// Remote images we allow in posts (YouTube and Vimeo frames of our films, Unsplash stock) carry their size in the URL.
// Unsplash: ...?w=1600&h=900&fit=crop  YouTube: maxresdefault / maxres1-3 (1280x720), hqdefault (480x360)  Vimeo: ...-d_1280x720
export function remoteSize(src) {
  if (!/^https:\/\//.test(src || '')) return null;
  const u = src.replace(/&amp;/g, '&');
  if (/images\.unsplash\.com/.test(u)) { const w = +(u.match(/[?&]w=(\d+)/) || [])[1], h = +(u.match(/[?&]h=(\d+)/) || [])[1]; return w && h ? [w, h] : null; }
  if (/i\.ytimg\.com\/vi(_webp)?\/[^/]+\/maxres(default|\d)/.test(u)) return [1280, 720];
  if (/i\.ytimg\.com\/vi(_webp)?\/[^/]+\/(hqdefault|hq\d)/.test(u)) return [480, 360];
  const v = u.match(/i\.vimeocdn\.com\/video\/[^?]*-d_(\d+)x(\d+)/);
  return v ? [+v[1], +v[2]] : null;
}
// A smaller copy of a remote image for post cards and phones (Unsplash only; others are already small enough).
export const remoteCard = (src) => (/images\.unsplash\.com/.test(src) ? src.replace(/([?&])w=\d+/, '$1w=720').replace(/([?&])h=\d+/, (m, a) => `${a}h=${Math.round(720 * remoteSize(src)[1] / remoteSize(src)[0])}`) : src);

// Add width/height to every local <img> that doesn't have them (prevents layout shift).
export const sizeImages = (html) =>
  html.replace(/<img\b[^>]*>/g, (tag) => {
    if (/loading="lazy"/.test(tag) && !/decoding=/.test(tag)) tag = tag.replace(/<img\b/, '<img decoding="async"');
    if (/\swidth=/.test(tag)) return tag;
    const src = tag.match(/\ssrc="([^"]+)"/)?.[1];
    const size = src && (src.startsWith('/') ? imageSize(path.join(DIST, decodeURI(src))) : remoteSize(src));
    if (!size) return tag;
    return tag.replace(/<img\b/, `<img width="${size[0]}" height="${size[1]}"`);
  });

// Minify with esbuild (skipped in dev so the browser shows readable code).
export const minify = async (code, loader) =>
  DEV ? code : (await transform(code, { loader, minify: true, target: ['chrome100', 'edge100', 'firefox100', 'safari15'] })).code;

// Rename dist/css/site.css -> dist/css/site.<hash>.css (same for JS) and return the new URL.
export async function fingerprint(rel, loader) {
  const src = path.join(DIST, rel);
  const body = await minify(fs.readFileSync(src, 'utf8'), loader);
  const hash = crypto.createHash('sha256').update(body).digest('hex').slice(0, 10);
  const out = rel.replace(/(\.\w+)$/, `.${hash}$1`);
  fs.writeFileSync(path.join(DIST, out), body);
  fs.rmSync(src);
  return '/' + out;
}
