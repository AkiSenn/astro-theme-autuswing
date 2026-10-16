import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { load } from 'cheerio';
import { outputFile } from '../src/lib/urls';
import oldRoutes from '../migration/existing-output-routes.json';
import legacy from '../migration/effective-metadata.json';
const root = path.resolve('dist');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');
const files = (dir: string): string[] =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)]));
const old = oldRoutes.filter((r) => r.canonical && !r.redirect && !r.noindex);
for (const r of old) {
  const $ = load(read(outputFile(r.path)));
  assert.equal($('link[rel=canonical]').attr('href'), r.canonical, `Canonical changed: ${r.path}`);
}
let localReferences = 0;
for (const file of files(root).filter((f) => f.endsWith('.html'))) {
  const $ = load(fs.readFileSync(file, 'utf8'));
  assert.equal($('h1').length, 1, `Expected one h1: ${file}`);
  $('[src],[href]').each((_, el) => {
    const value = $(el).attr('src') || $(el).attr('href');
    if (!value || /^(https?:|data:|mailto:|tel:|#|\/\/)/i.test(value)) return;
    const rel = path.relative(root, file).replaceAll('\\', '/'),
      base = 'https://akisenn.com/' + rel.replace(/index\.html$/, '');
    const url = new URL(value, base),
      target = path.join(root, decodeURIComponent(url.pathname));
    let found =
      (fs.existsSync(target) && fs.statSync(target).isFile()) ||
      fs.existsSync(path.join(target, 'index.html'));
    if (!found && url.pathname.endsWith('/404.html'))
      found = fs.existsSync(path.join(root, '404.html'));
    assert.ok(found, `Missing local reference ${value} in ${rel}`);
    localReferences++;
  });
}
for (const p of legacy) {
  const $ = load(read(outputFile(p.path)));
  assert.equal($('meta[property="article:published_time"]').attr('content'), p.date);
  assert.equal($('meta[property="article:modified_time"]').attr('content'), p.updated);
  const ids = new Set(
    $('.prose [id]')
      .toArray()
      .map((el) => $(el).attr('id')),
  );
  for (const h of p.headings) assert.ok(ids.has(h.id), `Missing historical heading ${h.id}`);
  const ld = JSON.parse($('script[type="application/ld+json"]').text());
  assert.equal(ld['@type'], 'BlogPosting');
  assert.equal(ld.url, 'https://akisenn.com' + p.path);
  assert.equal(ld.dateModified, p.updated);
  assert.equal(
    $('[data-comments-config]').length,
    0,
    'Current preview must not initialize real comments',
  );
}
const math = load(read('post/4e395565/index.html'));
assert.equal(math('.math-inline,.math-display').length, 4);
const plain = load(read('post/4c6caf67/index.html'));
assert.equal(JSON.parse(plain('#autuswing-config').text()).math, null);
const rss = load(read('rss.xml'), { xml: true }),
  atom = load(read('atom.xml'), { xml: true });
assert.equal(rss('item').length, 3);
assert.equal(atom('entry').length, 3);
for (const p of legacy) {
  const guid = 'https://akisenn.com' + p.path;
  assert.equal(
    rss('item > guid')
      .toArray()
      .filter((e) => rss(e).text() === guid).length,
    1,
    `RSS guid must be unique: ${guid}`,
  );
  assert.ok(
    atom('entry > id')
      .toArray()
      .some((e) => atom(e).text() === guid),
  );
}
const map = load(read('sitemap-0.xml'), { xml: true });
const locations = map('url > loc')
  .toArray()
  .map((el) => map(el).text());
assert.equal(locations.length, 26);
for (const r of old)
  assert.ok(
    locations.some((url) => decodeURI(url) === decodeURI(r.canonical!)),
    `Missing sitemap route ${r.path}`,
  );
for (const p of legacy) {
  const element = map('url')
    .toArray()
    .find((el) => map(el).find('loc').text() === 'https://akisenn.com' + p.path);
  assert.ok(element);
  assert.ok(map(element).find('lastmod').text().startsWith(p.updated.slice(0, 10)));
}
const redirects = read('_redirects');
for (const p of legacy) {
  assert.ok(redirects.includes(`/post/${p.abbrlink}.html ${p.path} 301`));
  assert.ok(redirects.includes(`/p/${p.abbrlink}/ ${p.path} 301`));
}
const search = JSON.parse(read('search.json'));
assert.equal(search.length, 3);
assert.ok(search.every((p: { url: string }) => legacy.some((old) => old.path === p.url)));
const report = {
  checkedAt: new Date().toISOString(),
  canonicalPages: old.length,
  posts: legacy.length,
  localReferences,
  mathWrappers: 4,
  feedEntries: 3,
  sitemapUrls: locations.length,
  redirectRules: redirects.trim().split('\n').length,
};
fs.mkdirSync('docs/evidence', { recursive: true });
fs.writeFileSync('docs/evidence/output-check.json', JSON.stringify(report, null, 2) + '\n');
console.log(report);
