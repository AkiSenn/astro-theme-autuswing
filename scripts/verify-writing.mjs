import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
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
      ASTRO_PREVIEW_DRAFTS: '1', // An authoring flag must never leak into a build.
    },
  });
const report = {
  productionDraftExcluded: false,
  publishedFalseExcluded: false,
  stablePublishedId: false,
  explicitDescription: false,
  nativeResponsiveImage: false,
  localDraftPreview: false,
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
  // Local-only authoring mode is a dev-server feature, never a build flag.
  const server = spawn(
    process.execPath,
    ['node_modules/astro/bin/astro.mjs', 'dev', '--host', '127.0.0.1', '--port', '4323'],
    {
      cwd: root,
      stdio: 'ignore',
      env: { ...process.env, ASTRO_PREVIEW_DRAFTS: '1', SITE_ENV: 'preview' },
    },
  );
  try {
    let response;
    for (let i = 0; i < 50; i++) {
      try {
        response = await fetch(`http://127.0.0.1:4323/${data.id}/`, {
          signal: AbortSignal.timeout(1000),
        });
      } catch {
        /* Server is compiling its initial routes. */
      }
      if (response?.ok) break;
      if (server.exitCode !== null) throw new Error('Draft dev server stopped unexpectedly');
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    assert.ok(response?.ok, 'Local draft preview route');
    const draft = load(await response.text());
    assert.equal(draft('.article-header h1').text(), 'WRITING_PRIVATE_MARKER_20261017');
    assert.ok(draft('meta[name=robots]').attr('content')?.includes('noindex'));
    assert.ok(
      !(await (await fetch('http://127.0.0.1:4323/search.json')).text()).includes(
        'WRITING_PRIVATE_MARKER_20261017',
      ),
    );
    report.localDraftPreview = true;
  } finally {
    const closed = new Promise((resolve) => server.once('exit', resolve));
    if (server.exitCode === null) {
      server.kill();
      await closed;
    }
  }
  const asset = path.join(path.dirname(file), data.id + '-native-image.png');
  fs.copyFileSync('public/img/posts/hexo-yelee/01-workflow.png', asset, fs.constants.COPYFILE_EXCL);
  created.push(asset);
  const published =
    raw
      .replace('draft: true', 'draft: false')
      .replace('description: ""', 'description: "作者手写摘要，正文保持不变。"') +
    `\n\n![响应式图片](./${path.basename(asset)})\n`;
  fs.writeFileSync(file, published);
  build(true);
  const $ = load(fs.readFileSync(path.join('dist', data.id, 'index.html'), 'utf8'));
  assert.equal($('link[rel=canonical]').attr('href'), `https://akisenn.com/${data.id}/`);
  assert.equal($('meta[name=description]').attr('content'), '作者手写摘要，正文保持不变。');
  assert.equal(fs.readFileSync(file, 'utf8'), published);
  const image = $('.prose img');
  assert.equal(image.attr('width'), '1440');
  assert.equal(image.attr('height'), '840');
  assert.ok(image.attr('srcset')?.includes('w'), 'Native Astro responsive variants');
  assert.ok(image.attr('sizes')?.includes('810px'));
  assert.ok(image.attr('src')?.startsWith('/_astro/'));
  report.nativeResponsiveImage = true;
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
