// Shared state for the build: the content files every module reads, where the site is
// written, and the lists each stage adds to (warnings, sitemap, llms.txt pages).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEV = process.argv.includes('--dev');

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DIST = path.join(ROOT, 'dist');
export const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
export const readJSON = (p) => JSON.parse(read(p));

export const site = readJSON('content/site.json');
export const portfolio = readJSON('content/portfolio.json');
export const faq = readJSON('content/faq.json');
export const home = readJSON('content/home.json'); // homepage lists: services, who we serve, industries, process, client logos
export const socialIcons = readJSON('content/social-icons.json');
// Social profiles: all of them go into the structured data (sameAs); icons show for the ones not marked "show": false
export const shownSocial = site.social.filter((s) => s.show !== false);
export const partials = Object.fromEntries(['head', 'header', 'footer'].map((n) => [n, read(`src/partials/${n}.html`)]));

export const warnings = [];
export const sitemap = []; // { path, lastmod }
export const pageIndex = []; // { path, title, description } for llms.txt
export const assets = {}; // filled in once public/ is copied and fingerprinted
