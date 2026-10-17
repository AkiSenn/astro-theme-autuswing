import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createPost } from './new-post.mjs';
import { frontmatter } from '../src/lib/frontmatter.mjs';
import { load } from 'cheerio';

const root = path.resolve('.'),
  created = [];
const build = (production = false) =>
  execFileSync(process.execPath, ['node_modules/astro/bin/astro.mjs', 'build'], {
    cwd: root,
    stdio: 'pipe',
    env: {
      ...process.env,
      SITE_ENV: production ? 'production' : 'preview',
      ASTRO_TELEMETRY_DISABLED: '1',
    },
  });
const report = {
  productionDraftExcluded: false,
  publishedFalseExcluded: false,
  stablePublishedId: false,
  explicitDescription: false,
  sampleAbsentFromProduction: false,
  previewRestored: false,
};
try {
  const file = createPost({ root, title: 'WRITING_PRIVATE_MARKER_20261017', template: 'tutorial' });
  created.push(file);
  const raw = fs.readFileSync(file, 'utf8'),
    { data } = frontmatter(raw);
  const other = createPost({ root, title: 'WRITING_UNPUBLISHED_MARKER_20261017' });
  created.push(other);
  const otherRaw = fs.readFileSync(other, 'utf8');
  fs.writeFileSync(other, otherRaw.replace('draft: true', 'draft: false\npublished: false'));
  build(true);
  for (const name of [
    'index.html',
    'archives/index.html',
    'search.json',
    'rss.xml',
    'atom.xml',
    'sitemap-0.xml',
  ]) {
    const output = fs.readFileSync(path.join('dist', name), 'utf8');
    assert.ok(!output.includes('WRITING_PRIVATE_MARKER_20261017'), name);
    assert.ok(!output.includes('WRITING_UNPUBLISHED_MARKER_20261017'), name);
    assert.ok(!output.includes('AUTUSWING_MARKDOWN_TEST_ONLY'), name);
  }
  assert.ok(!fs.existsSync(path.join('dist', data.id)));
  assert.ok(!fs.existsSync(path.join('dist', frontmatter(otherRaw).data.id)));
  assert.equal(fs.readFileSync(file, 'utf8'), raw);
  report.productionDraftExcluded = report.publishedFalseExcluded = true;
  report.sampleAbsentFromProduction = true;
  const published = raw
    .replace('draft: true', 'draft: false')
    .replace('description: ""', 'description: "作者手写摘要，正文保持不变。"');
  fs.writeFileSync(file, published);
  build(true);
  const $ = load(fs.readFileSync(path.join('dist', data.id, 'index.html'), 'utf8'));
  assert.equal($('link[rel=canonical]').attr('href'), `https://akisenn.com/${data.id}/`);
  assert.equal($('meta[name=description]').attr('content'), '作者手写摘要，正文保持不变。');
  assert.equal(fs.readFileSync(file, 'utf8'), published);
  report.stablePublishedId = report.explicitDescription = true;
} finally {
  for (const file of created) {
    const target = path.resolve(file);
    assert.ok(target.startsWith(path.join(root, 'content/posts') + path.sep));
    fs.unlinkSync(target);
  }
  build();
  report.previewRestored = true;
}
fs.mkdirSync('docs/evidence/writing-reading', { recursive: true });
fs.writeFileSync(
  'docs/evidence/writing-reading/production-content.json',
  JSON.stringify(report, null, 2) + '\n',
);
console.log(report);
