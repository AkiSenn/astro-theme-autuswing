import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createPost } from '../scripts/new-post.mjs';
import { frontmatter } from '../src/lib/frontmatter.mjs';
import { contentSchema, isPublished } from '../src/lib/content-schema';
import { parseDate } from '../src/lib/dates';
import { checkContent } from '../scripts/check-content';

function workspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'autuswing-writing-'));
  fs.mkdirSync(path.join(root, 'src/config'), { recursive: true });
  fs.mkdirSync(path.join(root, 'public'));
  fs.writeFileSync(path.join(root, 'src/config/theme.json'), '{"urls":{"length":6}}');
  fs.cpSync('templates', path.join(root, 'templates'), { recursive: true });
  return {
    root,
    close() {
      assert.ok(root.startsWith(path.join(os.tmpdir(), 'autuswing-writing-')));
      fs.rmSync(root, { recursive: true });
    },
  };
}

test('calendar validation rejects normalization for both legacy and zoned dates', () => {
  for (const value of [
    '2025-02-29',
    '2024-04-31T10:00:00Z',
    '2024-02-30T10:00:00+08:00',
    '2024-02-28 24:00:00',
    '2024-01-01T12:60:00Z',
    '2024-01-01T00:00:00+24:00',
    'yesterday',
  ])
    assert.throws(() => parseDate(value), undefined, value);
  assert.equal(parseDate('2024-02-29'), '2024-02-28T16:00:00.000Z');
  assert.equal(parseDate('2024-02-29T23:30:00-03:00'), '2024-03-01T02:30:00.000Z');
});

test('schema is strict about mistakes, permissive about optional writing metadata', () => {
  assert.ok(contentSchema.safeParse({ title: '正文', date: '2024-02-29' }).success);
  assert.ok(
    contentSchema.safeParse({
      title: '正文',
      date: '2024-02-29',
      custom: 42,
      categories: [['A', 'B']],
      mathjax: true,
    }).success,
  );
  for (const extra of [
    { title: ' ' },
    { updated: '2024-02-30' },
    { draft: 'false' },
    { tags: 42 },
    { series_order: 0 },
  ])
    assert.equal(
      contentSchema.safeParse({ title: '正文', date: '2024-02-29', ...extra }).success,
      false,
    );
  assert.equal(isPublished({}), true);
  assert.equal(isPublished({ draft: true }), false);
  assert.equal(isPublished({ published: false }), false);
  assert.equal(isPublished({ draft: true, published: true }), false);
});

test('all templates persist unique root IDs and default to draft without overwriting', () => {
  const { root, close } = workspace();
  try {
    const ids = new Set();
    for (const template of ['post', 'tutorial', 'series']) {
      const file = createPost({
        root,
        title: '相同:标题?',
        template,
        series: template === 'series' ? 'Astro 实践' : undefined,
      });
      const raw = fs.readFileSync(file, 'utf8'),
        { data } = frontmatter(raw);
      assert.match(data.id, /^[a-z0-9]{6}$/);
      assert.ok(!ids.has(data.id));
      ids.add(data.id);
      assert.equal(data.permalink, `/${data.id}/`);
      assert.equal(data.draft, true);
      assert.ok(contentSchema.safeParse(data).success);
      assert.equal(fs.readFileSync(file, 'utf8'), raw);
      if (template === 'series') assert.equal(data.series, 'Astro 实践');
    }
    assert.throws(() => createPost({ root, title: 'x', template: '../../outside' }), /template/);
    assert.throws(() => createPost({ root, title: 'x', template: 'series' }), /series/i);
  } finally {
    close();
  }
});

test('publication checks detect missing resources, anchors, IDs and warn about alt without rewriting', async () => {
  const { root, close } = workspace();
  try {
    const file = createPost({ root, title: '检查' });
    const original =
      fs.readFileSync(file, 'utf8').replace('draft: true', 'draft: false') +
      '\n## 存在\n\n[坏锚点](#missing)\n\n![](/missing.png)\n\n[缺页](/missing/)\n';
    fs.writeFileSync(file, original);
    const report = await checkContent({ root, output: true });
    assert.ok(report.issues.some((issue) => /Missing image/.test(issue.message)));
    assert.ok(report.issues.some((issue) => /anchor/.test(issue.message)));
    assert.ok(report.issues.some((issue) => /Missing local output/.test(issue.message)));
    assert.ok(
      report.issues.some(
        (issue) => issue.level === 'warning' && /alternative text/.test(issue.message),
      ),
    );
    assert.equal(fs.readFileSync(file, 'utf8'), original);
    fs.copyFileSync(file, path.join(path.dirname(file), 'duplicate.md'));
    assert.ok(
      (await checkContent({ root })).issues.some((issue) =>
        /Duplicate persistent/.test(issue.message),
      ),
    );
  } finally {
    close();
  }
});
