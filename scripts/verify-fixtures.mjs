import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { load } from 'cheerio';
import assert from 'node:assert/strict';
const root = path.resolve('.'),
  dir = path.join(root, 'content/posts'),
  created = [];
const build = () =>
  execFileSync(process.execPath, ['node_modules/astro/bin/astro.mjs', 'build'], {
    cwd: root,
    stdio: 'pipe',
    env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' },
  });
const report = {
  customFilePermalink: false,
  pagination: false,
  nestedCategories: false,
  visibility: false,
  assetCollisionRejected: false,
  newPostPersistence: false,
  rootIdRouting: false,
  protectedAliasCollisionRejected: false,
  duplicateIdRejected: false,
};
fs.mkdirSync(dir, { recursive: true });
try {
  for (let i = 0; i < 11; i++) {
    const file = path.join(dir, `contract-${i}.md`);
    if (fs.existsSync(file)) throw new Error('Refuse fixture overwrite');
    const extra =
      i === 0 ? 'permalink: /__contract.html\nnoindex: true\nsearch: false\nfeed: false\n' : '';
    fs.writeFileSync(
      file,
      `---\ntitle: Contract ${i}\ndate: '2021-02-03 04:05:06'\nabbrlink: 'fixture${i}'\ncategories:\n  - [Parent, Child]\n  - Other\n${extra}---\n\nFixture正文。\n`,
    );
    created.push(file);
  }
  build();
  assert.ok(fs.existsSync('dist/fixture1/index.html'));
  assert.ok(!fs.existsSync('dist/post/fixture1/index.html'));
  report.rootIdRouting = true;
  for (const file of ['search.json', 'rss.xml', 'atom.xml', 'sitemap-0.xml']) {
    const output = fs.readFileSync('dist/' + file, 'utf8');
    assert.ok(output.includes('/fixture1/'));
    assert.ok(!output.includes('/post/fixture1/'));
  }
  assert.ok(fs.statSync('dist/__contract.html').isFile());
  const $ = load(fs.readFileSync('dist/__contract.html', 'utf8'));
  assert.equal($('link[rel=canonical]').attr('href'), 'https://akisenn.com/__contract.html');
  report.customFilePermalink = true;
  for (const file of [
    'page/2/index.html',
    'archives/page/2/index.html',
    'categories/Parent/index.html',
    'categories/Parent/Child/index.html',
    'categories/Other/index.html',
  ])
    assert.ok(fs.existsSync(path.join('dist', file)), file);
  report.pagination = true;
  report.nestedCategories = true;
  assert.ok(!fs.readFileSync('dist/sitemap-0.xml', 'utf8').includes('__contract.html'));
  assert.ok(!fs.readFileSync('dist/search.json', 'utf8').includes('__contract.html'));
  assert.ok(!fs.readFileSync('dist/rss.xml', 'utf8').includes('__contract.html'));
  report.visibility = true;
  const before = fs.readFileSync(created[0], 'utf8');
  fs.writeFileSync(created[0], before.replace('/__contract.html', '/img/avatar.png'));
  let failed = false;
  try {
    build();
  } catch (error) {
    failed =
      String(error.stderr).includes('collision') || String(error.stdout).includes('collision');
  }
  assert.ok(failed, 'Static asset collision must stop build');
  report.assetCollisionRejected = true;
  fs.writeFileSync(created[0], before);
  for (const [text, marker, label] of [
    [
      before.replace('/__contract.html', '/p/55b0541c/'),
      'collision',
      'protectedAliasCollisionRejected',
    ],
    [
      before.replace("abbrlink: 'fixture0'", "abbrlink: '55b0541c'"),
      'Duplicate persistent post ID',
      'duplicateIdRejected',
    ],
  ]) {
    fs.writeFileSync(created[0], text);
    let rejected = false;
    try {
      build();
    } catch (error) {
      rejected = String(error.stderr).includes(marker) || String(error.stdout).includes(marker);
    }
    assert.ok(rejected, label);
    report[label] = true;
    fs.writeFileSync(created[0], before);
  }
  const createdPost = execFileSync(
    process.execPath,
    ['scripts/new-post.mjs', 'Creation contract'],
    { encoding: 'utf8' },
  ).trim();
  assert.ok(createdPost.startsWith(dir + path.sep));
  created.push(createdPost);
  const raw = fs.readFileSync(createdPost, 'utf8');
  build();
  assert.equal(fs.readFileSync(createdPost, 'utf8'), raw);
  const id = raw.match(/^id: '([^']+)'/m)[1];
  assert.ok(
    !fs.existsSync(path.join('dist', id, 'index.html')),
    'New articles start as private drafts',
  );
  fs.writeFileSync(createdPost, raw.replace('draft: true', 'draft: false'));
  build();
  assert.ok(fs.existsSync(path.join('dist', id, 'index.html')));
  assert.ok(raw.includes(`permalink: '/${id}/'`));
  report.newPostPersistence = true;
} finally {
  for (const file of created) {
    const absolute = path.resolve(file);
    if (!absolute.startsWith(dir + path.sep))
      throw new Error('Refuse fixture cleanup outside content/posts');
    fs.unlinkSync(absolute);
  }
  build();
}
fs.writeFileSync('docs/evidence/fixture-check.json', JSON.stringify(report, null, 2) + '\n');
console.log(report);
