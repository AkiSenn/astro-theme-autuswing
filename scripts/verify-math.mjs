import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { load } from 'cheerio';

const themeFile = 'src/config/theme.json',
  siteFile = 'src/config/site.json';
const originalTheme = fs.readFileSync(themeFile),
  originalSite = fs.readFileSync(siteFile);
const created = [];
const build = () =>
  execFileSync(process.execPath, ['node_modules/astro/bin/astro.mjs', 'build'], {
    stdio: 'pipe',
    env: { ...process.env, SITE_ENV: 'preview', ASTRO_TELEMETRY_DISABLED: '1' },
  });
const page = (route) => load(fs.readFileSync(path.join('dist', route, 'index.html'), 'utf8'));
const report = {
  automaticDetection: false,
  legacyFlags: false,
  noFormulaNoStyles: false,
  explicitOptOut: false,
  fullContentPagination: false,
  unsupportedBuildRejected: false,
  previewRestored: false,
};
fs.mkdirSync('content/posts', { recursive: true });
function fixture(id, flags, body) {
  const file = `content/posts/${id}.md`;
  assert.ok(!fs.existsSync(file), 'Never overwrite an existing post');
  fs.writeFileSync(
    file,
    `---\ntitle: '${id}'\ndate: '2026-01-01 00:00:00'\nid: '${id}'\n${flags}---\n\n${body}\n`,
  );
  created.push(file);
  return file;
}
try {
  fixture('ssr-auto', '', '$x^2$');
  fixture('ssr-legacy', 'katex: true\n', '$y_1$');
  fixture('ssr-empty', 'mathjax: true\n', 'No formula. `$code$`\n\n```tex\n$example$\n```');
  fixture('ssr-disabled', 'math: false\nmathjax: true\n', '$z$');
  build();
  for (const route of ['ssr-auto', 'ssr-legacy']) {
    const $ = page(route);
    assert.equal($('.katex').length, 1);
    assert.equal($('link[data-math-styles]').length, 1);
  }
  report.automaticDetection = report.legacyFlags = true;
  for (const route of ['ssr-empty', 'ssr-disabled']) {
    const $ = page(route);
    assert.equal($('.katex,link[data-math-styles]').length, 0);
  }
  report.noFormulaNoStyles = report.explicitOptOut = true;
  const theme = JSON.parse(originalTheme),
    site = JSON.parse(originalSite);
  theme.article.excerpt = false;
  site.per_page = 1;
  fs.writeFileSync(themeFile, JSON.stringify(theme, null, 2) + '\n');
  fs.writeFileSync(siteFile, JSON.stringify(site, null, 2) + '\n');
  build();
  let mathPages = 0,
    plainPages = 0;
  for (let i = 1; i <= 7; i++) {
    const $ = page(i === 1 ? '' : `page/${i}`);
    const hasMath = $('.katex').length > 0;
    assert.equal($('link[data-math-styles]').length, hasMath ? 1 : 0);
    hasMath ? mathPages++ : plainPages++;
  }
  assert.ok(mathPages > 0 && plainPages > 0);
  report.fullContentPagination = true;
  const bad = fixture(
    'ssr-unsupported',
    'mathjax: true\n',
    String.raw`$\UnknownHistoricalCommand{x}$`,
  );
  try {
    build();
  } catch (error) {
    const output = String(error.stdout) + String(error.stderr);
    assert.ok(output.includes('ssr-unsupported') && output.includes('UnknownHistoricalCommand'));
    report.unsupportedBuildRejected = true;
  }
  assert.ok(report.unsupportedBuildRejected);
  fs.unlinkSync(bad);
  created.splice(created.indexOf(bad), 1);
} finally {
  for (const file of created) {
    assert.ok(path.resolve(file).startsWith(path.resolve('content/posts') + path.sep));
    fs.unlinkSync(file);
  }
  fs.writeFileSync(themeFile, originalTheme);
  fs.writeFileSync(siteFile, originalSite);
  build();
}
assert.equal(page('post/4e395565')('.katex').length, 4);
assert.equal(page('')('link[data-math-styles]').length, 0);
report.previewRestored = true;
fs.mkdirSync('docs/evidence/math', { recursive: true });
fs.writeFileSync('docs/evidence/math/build-check.json', JSON.stringify(report, null, 2) + '\n');
console.log(report);
