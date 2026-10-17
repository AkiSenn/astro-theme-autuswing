import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { load } from 'cheerio';
import { redirects } from '../src/lib/legacy-redirects.mjs';

const origin = new URL(process.argv[2] || 'http://127.0.0.1:8788');
const production = process.argv.includes('--production');
const reportFile = process.env.HTTP_EVIDENCE_FILE || 'docs/evidence/phase5/nginx-http.json';
const routes = process.env.HTTP_RELEASE_DIR
  ? JSON.parse(fs.readFileSync(path.join(process.env.HTTP_RELEASE_DIR, 'release.json'), 'utf8')).build.contract.routes
  : JSON.parse(fs.readFileSync('.astro/autuswing-routes.json', 'utf8'));
const checks = [];
async function request(uri, options = {}) {
  const response = await fetch(new URL(uri, origin), { redirect: 'manual', ...options });
  const cache = response.headers.get('cache-control') || '';
  assert.ok(
    (cache.match(/max-age=/g) || []).length <= 1,
    `Conflicting cache rules: ${uri}: ${cache}`,
  );
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff', uri);
  if (!production) assert.match(response.headers.get('x-robots-tag') || '', /noindex/, uri);
  else assert.equal(response.headers.get('x-robots-tag'), null, uri);
  checks.push({
    uri,
    status: response.status,
    type: response.headers.get('content-type'),
    cache,
    location: response.headers.get('location'),
  });
  return response;
}
for (const route of routes.filter((r) => r.indexable)) {
  const response = await request(route.path);
  assert.equal(response.status, 200, route.path);
  const $ = load(await response.text());
  assert.equal(
    $('link[rel=canonical]').attr('href'),
    new URL(route.path, 'https://akisenn.com').href,
  );
  assert.equal($('h1').length, 1, route.path);
  if (!production) assert.match($('meta[name=robots]').attr('content') || '', /noindex/);
  else assert.equal($('meta[name=robots]').length, 0, route.path);
}
for (const rule of redirects()) {
  const response = await request(rule.from + '?from=phase5&value=1');
  assert.equal(response.status, 301, rule.from);
  assert.equal(new URL(response.headers.get('location'), origin).pathname, rule.to);
  assert.equal(new URL(response.headers.get('location'), origin).search, '?from=phase5&value=1');
}
const slash = await request('/post/55b0541c?from=phase5');
assert.equal(slash.status, 301);
assert.equal(new URL(slash.headers.get('location'), origin).pathname, '/post/55b0541c/');
assert.equal(new URL(slash.headers.get('location'), origin).search, '?from=phase5');
for (const uri of [
  '/missing-check/',
  '/img/missing-check.png',
  '/_astro/missing-check.js',
  '/_headers',
  '/_redirects',
  '/redirects.json',
]) {
  const response = await request(uri);
  assert.equal(response.status, 404, uri);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.match(await response.text(), /404/);
}
const $ = load(
  fs.readFileSync(path.join(process.env.HTTP_ASSET_ROOT || 'dist', 'index.html'), 'utf8'),
);
const script = $('script[src]').attr('src');
const avatar = $('.desktop-sidebar .profile img').attr('src');
const font = '/assets/vendor/katex/0.19.0/dist/fonts/KaTeX_Main-Regular.woff2';
for (const [uri, type, immutable] of [
  [script, /javascript/, true],
  [avatar, /image\/webp/, true],
  ['/assets/vendor/katex/0.19.0/dist/katex.min.css', /text\/css/, true],
  [font, /woff2/, true],
  ['/img/avatar.png', /image\/png/, false],
  ['/rss.xml', /xml/, false],
  ['/atom.xml', /xml/, false],
  ['/sitemap.xml', /xml/, false],
  ['/search.json', /application\/json/, false],
  ['/manifest.webmanifest', /manifest\+json/, false],
]) {
  const response = await request(uri);
  assert.equal(response.status, 200, uri);
  assert.match(response.headers.get('content-type') || '', type, uri);
  if (immutable) assert.match(response.headers.get('cache-control'), /max-age=31536000, immutable/);
  if (uri.startsWith('/assets/vendor/'))
    assert.equal(response.headers.get('access-control-allow-origin'), '*');
  if (uri === avatar)
    assert.ok(Number(response.headers.get('content-length')) < 16000, 'Avatar is oversized');
  const etag = response.headers.get('etag');
  assert.ok(etag, `Missing ETag: ${uri}`);
  assert.equal((await request(uri, { headers: { 'If-None-Match': etag } })).status, 304, uri);
}
const sw = await request('/sw.js');
assert.equal(sw.status, 200);
assert.equal(sw.headers.get('cache-control'), 'no-cache');
const compressed = await request('/post/55b0541c/', { headers: { 'Accept-Encoding': 'gzip' } });
assert.equal(compressed.headers.get('content-encoding'), 'gzip');
const robots = await request('/robots.txt');
assert.match(await robots.text(), production ? /Allow: \// : /Disallow: \//);
const report = {
  checkedAt: new Date().toISOString(),
  origin: origin.href,
  policy: production ? 'production-artifact-local-only' : 'preview',
  canonicalPages: routes.filter((r) => r.indexable).length,
  redirectRules: redirects().length,
  checks,
};
fs.mkdirSync(path.dirname(reportFile), { recursive: true });
fs.writeFileSync(reportFile, JSON.stringify(report, null, 2) + '\n');
console.log({
  origin: report.origin,
  policy: report.policy,
  checks: checks.length,
  canonicalPages: report.canonicalPages,
  redirectRules: report.redirectRules,
});
