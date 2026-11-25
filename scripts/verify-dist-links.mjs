#!/usr/bin/env node
// Fails the build when dist references a local file or route it does not contain.
// Catches the "new fingerprint shipped in HTML but missing from the asset pool" class of 404.
import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve('dist');
if (!fs.existsSync(dist)) {
  console.error('verify-dist-links: dist/ not found, run the build first');
  process.exit(1);
}

const skip = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i;
const attributes = /(?:href|src|poster|action)\s*=\s*["']([^"']+)["']/gi;
const srcsets = /srcset\s*=\s*["']([^"']+)["']/gi;
const cssUrls = /url\(\s*["']?([^"')\s]+)["']?\s*\)/gi;

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(path.relative(dist, full).split(path.sep).join('/'));
  }
  return out;
}

const files = walk(dist);
const fileSet = new Set(files);

function basePrefix() {
  const sw = path.join(dist, 'sw.js');
  if (!fs.existsSync(sw)) return '/';
  const match = /BASE="([^"]*)"/.exec(fs.readFileSync(sw, 'utf8'));
  const base = match?.[1] || '/';
  return base.endsWith('/') ? base : base + '/';
}
const base = basePrefix();

function decodes(ref) {
  try {
    return decodeURI(ref);
  } catch {
    return ref;
  }
}

function resolves(ref, page) {
  const clean = decodes(ref).split('#')[0].split('?')[0].trim();
  if (!clean) return true;
  let candidate;
  if (clean.startsWith('/')) {
    candidate = clean.startsWith(base) ? clean.slice(base.length) : clean.slice(1);
  } else {
    candidate = path.posix.normalize(path.posix.join(path.posix.dirname(page), clean));
  }
  candidate = candidate.replace(/^\.\//, '');
  if (candidate === '' || candidate === '.') return true;
  if (fileSet.has(candidate)) return true;
  if (fileSet.has(candidate.replace(/\/$/, '') + '/index.html')) return true;
  return false;
}

function referencesOf(file) {
  const text = fs.readFileSync(path.join(dist, file), 'utf8');
  const refs = [];
  if (file.endsWith('.html')) {
    for (const m of text.matchAll(attributes)) refs.push(m[1]);
    for (const m of text.matchAll(srcsets))
      for (const part of m[1].split(',')) {
        const url = part.trim().split(/\s+/)[0];
        if (url) refs.push(url);
      }
    for (const m of text.matchAll(/<meta[^>]+(?:property|name)\s*=\s*["'](?:og:image|twitter:image)["'][^>]*>/gi)) {
      const content = /content\s*=\s*["']([^"']+)["']/i.exec(m[0]);
      if (content) refs.push(content[1]);
    }
  } else if (file.endsWith('.css')) {
    for (const m of text.matchAll(cssUrls)) refs.push(m[1]);
  }
  return refs;
}

const missing = new Map();
let checked = 0;
for (const file of files) {
  if (!file.endsWith('.html') && !file.endsWith('.css')) continue;
  for (const ref of referencesOf(file)) {
    if (!ref || skip.test(ref)) continue;
    checked++;
    if (resolves(ref, file)) continue;
    if (!missing.has(ref)) missing.set(ref, []);
    if (missing.get(ref).length < 3) missing.get(ref).push(file);
  }
}

const manifest = path.join(dist, 'manifest.webmanifest');
if (fs.existsSync(manifest)) {
  const data = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  for (const icon of data.icons || []) {
    checked++;
    if (!resolves(icon.src, 'index.html')) missing.set(icon.src, ['manifest.webmanifest']);
  }
}

if (missing.size) {
  console.error('verify-dist-links: ' + missing.size + ' referenced path(s) are absent from dist/');
  for (const [ref, pages] of missing) console.error('  ' + ref + '  <- ' + pages.join(', '));
  process.exit(1);
}

console.log('verify-dist-links: ' + checked + ' local references across ' + files.length + ' files, 0 missing');
