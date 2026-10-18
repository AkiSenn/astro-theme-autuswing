// Render real static pages in a private copy, including an empty collection.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { load } from 'cheerio';

const original = process.cwd();
fs.mkdirSync('.local-tools', { recursive: true });
const root = fs.mkdtempSync(path.resolve('.local-tools/listing-fixtures-'));
for (const directory of [
  'src',
  'public',
  'content',
  'scripts',
  'migration',
  'templates',
  'deployment',
])
  fs.cpSync(path.join(original, directory), path.join(root, directory), { recursive: true });
for (const file of ['package.json', 'package-lock.json', 'astro.config.mjs', 'tsconfig.json'])
  fs.copyFileSync(path.join(original, file), path.join(root, file));
fs.symlinkSync(
  path.join(original, 'node_modules'),
  path.join(root, 'node_modules'),
  process.platform === 'win32' ? 'junction' : 'dir',
);
const report = { workspace: root, cases: [] };
const build = (name) => {
  try {
    const log = execFileSync(process.execPath, ['node_modules/astro/bin/astro.mjs', 'build'], {
      cwd: root,
      env: { ...process.env, SITE_ENV: 'preview', ASTRO_TELEMETRY_DISABLED: '1' },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 32 * 1024 * 1024,
      windowsHide: true,
    });
    fs.writeFileSync(path.join(root, name + '.log'), log);
  } catch (error) {
    fs.writeFileSync(path.join(root, name + '.log'), (error.stdout || '') + (error.stderr || ''));
    throw error;
  }
};
const inspect = (base, count, expected) => {
  const pages = Math.max(1, Math.ceil(count / 10));
  const actual = [];
  for (let page = 1; page <= pages; page++) {
    const uri = page === 1 ? base : `${base}page/${page}/`;
    const $ = load(fs.readFileSync(path.join(root, 'dist', uri.slice(1), 'index.html'), 'utf8'));
    assert.equal($('.page-heading h1 .count').text(), String(count), uri + ' total');
    const links = $('.timeline article a')
      .map((_, n) => $(n).attr('href'))
      .get();
    actual.push(...links);
    assert.equal(
      links.length,
      Math.min(10, Math.max(0, count - (page - 1) * 10)),
      uri + ' page count',
    );
    if (page > 1)
      assert.equal(
        $('.pagination a[rel=prev]').attr('href'),
        page === 2 ? base : `${base}page/${page - 1}/`,
      );
    if (page < pages)
      assert.equal($('.pagination a[rel=next]').attr('href'), `${base}page/${page + 1}/`);
  }
  assert.deepEqual(actual, expected, base + ' membership/order');
  assert.ok(
    !fs.existsSync(path.join(root, 'dist', base.slice(1), 'page', String(pages + 1), 'index.html')),
  );
  report.cases.push({ base, total: count, pages, passed: true });
};
const legacyPaths = JSON.parse(
  fs.readFileSync(path.join(root, 'migration/effective-metadata.json'), 'utf8'),
)
  .sort((a, b) => b.date.localeCompare(a.date))
  .map((p) => p.path);
build('original-three');
inspect('/archives/', 3, legacyPaths);
for (let i = 0; i < 25; i++) {
  const tags = [
    '总组25',
    ...(i < 11 ? ['组11'] : []),
    ...(i < 10 ? ['组10'] : []),
    ...(i === 0 ? ['组1'] : []),
  ];
  const categories = i < 11 ? [['父11', '子11']] : ['其他14'];
  fs.writeFileSync(
    path.join(root, 'content/posts', `listing-fixture-${i}.md`),
    `---\ntitle: Listing ${i}\nid: 'list${String(i).padStart(2, '0')}'\ndate: '2026-01-${String(i + 1).padStart(2, '0')}T00:00:00+08:00'\ndraft: false\ntags: ${JSON.stringify(tags)}\ncategories: ${JSON.stringify(categories)}\n---\n\nListing fixture.\n`,
    { flag: 'wx' },
  );
}
const ids = Array.from({ length: 25 }, (_, i) => i).reverse();
const paths = (indices) => indices.map((i) => `/list${String(i).padStart(2, '0')}/`);
build('pagination-boundaries');
for (const count of [1, 10, 11, 25])
  inspect(
    `/tags/${count === 25 ? '总组25' : '组' + count}/`,
    count,
    paths(ids.filter((i) => i < count)),
  );
inspect('/categories/父11/', 11, paths(ids.filter((i) => i < 11)));
inspect('/categories/父11/子11/', 11, paths(ids.filter((i) => i < 11)));
inspect('/categories/其他14/', 14, paths(ids.filter((i) => i >= 11)));
inspect('/archives/', 28, [...paths(ids), ...legacyPaths]);
inspect('/archives/2026/', 25, paths(ids));
inspect('/archives/2026/01/', 25, paths(ids));
assert.ok(
  !fs.existsSync(path.join(root, 'dist/tags/组0/index.html')),
  'No fabricated empty taxonomy',
);
// Delete only Markdown within this private copy. The author's files are untouched.
function removeMarkdown(directory) {
  const absolute = path.resolve(directory);
  assert.ok(absolute.startsWith(root + path.sep + 'content' + path.sep));
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    const file = path.join(absolute, entry.name);
    if (entry.isDirectory()) removeMarkdown(file);
    else if (file.endsWith('.md')) fs.unlinkSync(file);
  }
}
removeMarkdown(path.join(root, 'content/posts'));
removeMarkdown(path.join(root, 'content/legacy/posts'));
build('empty-archive');
inspect('/archives/', 0, []);
fs.writeFileSync(path.join(root, 'report.json'), JSON.stringify(report, null, 2));
console.log(`LISTING_REPORT=${path.join(root, 'report.json')}`);
console.log(report.cases);
