import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { gunzipSync } from 'node:zlib';
import { load } from 'cheerio';
const themeFile = 'src/config/theme.json',
  siteFile = 'src/config/site.json';
const originalTheme = fs.readFileSync(themeFile),
  originalSite = fs.readFileSync(siteFile),
  created = [];
const theme = () => JSON.parse(originalTheme),
  site = () => JSON.parse(originalSite);
const write = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
const build = (production = false) =>
  execFileSync(process.execPath, ['node_modules/astro/bin/astro.mjs', 'build'], {
    stdio: 'pipe',
    env: {
      ...process.env,
      ASTRO_TELEMETRY_DISABLED: '1',
      SITE_ENV: production ? 'production' : 'preview',
    },
  });
const report = {
  perPageZero: false,
  fullContentMath: false,
  optionalSwitches: false,
  precompression: false,
  englishLabels: false,
  productionCrawlPolicy: false,
  previewRestored: false,
};
try {
  fs.mkdirSync('content/posts', { recursive: true });
  for (let i = 0; i < 11; i++) {
    const file = path.resolve(`content/posts/configuration-${i}.md`);
    assert.ok(!fs.existsSync(file));
    fs.writeFileSync(
      file,
      `---\ntitle: Fixture ${i}\ndate: '2021-01-01 00:00:00'\nid: 'config${i}'\n---\n\nFixture.\n`,
    );
    created.push(file);
  }
  const all = site();
  all.per_page = 0;
  write(siteFile, all);
  build();
  assert.equal(load(fs.readFileSync('dist/index.html', 'utf8'))('.post-card').length, 14);
  assert.ok(!fs.existsSync('dist/page/2/index.html'));
  report.perPageZero = true;
  for (const file of created) fs.unlinkSync(file);
  created.length = 0;
  fs.writeFileSync(siteFile, originalSite);
  const full = theme();
  full.article.excerpt = false;
  write(themeFile, full);
  build();
  const page = load(fs.readFileSync('dist/index.html', 'utf8'));
  assert.equal(page('.post-card .prose .katex').length, 4);
  assert.equal(page('link[data-math-styles="katex"]').length, 1);
  assert.equal(page('.post-card .math-inline,.post-card .math-display').length, 4);
  report.fullContentMath = true;
  const off = theme();
  off.seo.sitemap = false;
  off.math.enable = false;
  off.performance.generate_headers = false;
  off.performance.precompress = true;
  off.performance.compression_min_bytes = 1;
  off.performance.precompress_quality = 1;
  write(themeFile, off);
  build();
  assert.ok(!fs.existsSync('dist/sitemap.xml'));
  assert.ok(!fs.existsSync('dist/_headers'));
  assert.equal(
    load(fs.readFileSync('dist/post/4e395565/index.html', 'utf8'))('.math-inline,.math-display')
      .length,
    0,
  );
  assert.equal(
    load(fs.readFileSync('dist/post/4e395565/index.html', 'utf8'))('link[data-math-styles]').length,
    0,
  );
  report.optionalSwitches = true;
  assert.deepEqual(
    gunzipSync(fs.readFileSync('dist/index.html.gz')),
    fs.readFileSync('dist/index.html'),
  );
  assert.ok(fs.existsSync('dist/index.html.br'));
  report.precompression = true;
  fs.writeFileSync(themeFile, originalTheme);
  const english = site();
  english.language = 'en';
  write(siteFile, english);
  build();
  const en = load(fs.readFileSync('dist/index.html', 'utf8'));
  assert.equal(en('html').attr('lang'), 'en');
  assert.ok(en('.site-nav a[href="/archives/"]').text().includes('Archives'));
  assert.ok(en('main h1').text().includes('Recent notes'));
  report.englishLabels = true;
  fs.writeFileSync(siteFile, originalSite);
  build(true);
  const prod = load(fs.readFileSync('dist/index.html', 'utf8'));
  assert.equal(prod('meta[name=robots]').length, 0);
  assert.ok(fs.readFileSync('dist/robots.txt', 'utf8').includes('Allow: /'));
  assert.ok(!fs.readFileSync('dist/_headers', 'utf8').includes('X-Robots-Tag'));
  report.productionCrawlPolicy = true;
} finally {
  for (const file of created) {
    assert.ok(file.startsWith(path.resolve('content/posts') + path.sep));
    fs.unlinkSync(file);
  }
  fs.writeFileSync(themeFile, originalTheme);
  fs.writeFileSync(siteFile, originalSite);
  build();
}
assert.ok(fs.readFileSync('dist/robots.txt', 'utf8').includes('Disallow: /'));
report.previewRestored = true;
fs.writeFileSync('docs/evidence/configuration-check.json', JSON.stringify(report, null, 2) + '\n');
console.log(report);
