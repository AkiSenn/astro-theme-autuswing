import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createPost } from '../scripts/new-post.mjs';
import { startDraftPreview } from '../scripts/dev-drafts.mjs';
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

test('schema validates public identifiers and permalinks without changing author data', () => {
  const ordinary = { title: '地址校验', date: '2024-02-29' };
  for (const [field, value] of [
    ['id', 'bad/id'],
    ['abbrlink', 'bad id'],
    ['permalink', 'https://example.invalid/post/'],
    ['permalink', '/%252e%252e/private/'],
  ]) {
    const result = contentSchema.safeParse({ ...ordinary, [field]: value });
    assert.equal(result.success, false, `${field}: ${value}`);
    if (!result.success)
      assert.ok(result.error.issues.some((issue) => issue.path.join('.') === field));
  }
  for (const extra of [
    { id: '000123', abbrlink: 42, permalink: '/custom.html' },
    { id: '', abbrlink: '000abc', permalink: '' },
    { id: 42, permalink: 'notes/custom' },
  ]) {
    const input = { ...ordinary, ...extra, custom: { untouched: ['value', 42] } };
    assert.deepEqual(contentSchema.parse(input), input);
  }
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

test('draft preview uses Astro on loopback and overrides inherited production settings', () => {
  for (const [args, port] of [
    [[], '4322'],
    [['--port', '4323'], '4323'],
    [['--port=4324'], '4324'],
  ] as const) {
    const child = {},
      calls: any[] = [];
    const result = startDraftPreview(
      [...args],
      {
        SITE_ENV: 'production',
        ASTRO_PREVIEW_DRAFTS: '0',
        WRITING_TEST_VALUE: 'retained',
      },
      (...values: any[]) => {
        calls.push(values);
        return child;
      },
    );
    assert.equal(result, child);
    assert.equal(calls.length, 1);
    const [command, argv, options] = calls[0];
    assert.equal(command, process.execPath);
    assert.ok(argv[0].replaceAll('\\', '/').endsWith('/node_modules/astro/bin/astro.mjs'));
    assert.deepEqual(argv.slice(1), ['dev', '--host', '127.0.0.1', '--port', port]);
    assert.equal(options.env.SITE_ENV, 'preview');
    assert.equal(options.env.ASTRO_PREVIEW_DRAFTS, '1');
    assert.equal(options.env.WRITING_TEST_VALUE, 'retained');
  }
});

test('draft preview rejects network/configuration overrides and invalid ports before launching', () => {
  let launches = 0;
  const launch = () => {
    launches++;
  };
  for (const args of [
    ['--host'],
    ['--host', '0.0.0.0'],
    ['--host=::'],
    ['--no-host'],
    ['--config', 'other.mjs'],
    ['--root', '..'],
    ['--allowed-hosts'],
    ['build'],
    ['--port'],
    ['--port', '0'],
    ['--port', '65536'],
    ['--port', '4322.5'],
    ['--port=NaN'],
    ['--port=-1'],
  ])
    assert.throws(
      () => startDraftPreview(args, {}, launch),
      /Unknown option|Unexpected argument|--port/,
    );
  assert.equal(launches, 0);
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

test('external HTTP audit is opt-in and treats restrictions differently from missing pages', async () => {
  const { root, close } = workspace();
  const originalFetch = globalThis.fetch,
    calls: string[] = [];
  try {
    const file = createPost({ root, title: '外链检查' });
    fs.writeFileSync(
      file,
      fs.readFileSync(file, 'utf8').replace('draft: true', 'draft: false') +
        '\n[missing](https://example.invalid/missing)\n[restricted](https://example.invalid/restricted)\n[fallback](https://example.invalid/fallback)\n',
    );
    globalThis.fetch = (async (url, options) => {
      calls.push(`${options?.method || 'GET'} ${url}`);
      const status = String(url).endsWith('/missing')
        ? 404
        : String(url).endsWith('/restricted')
          ? 403
          : options?.method === 'HEAD'
            ? 405
            : 200;
      return new Response(null, { status });
    }) as typeof fetch;
    await checkContent({ root });
    assert.equal(calls.length, 0);
    const report = await checkContent({ root, remote: true });
    assert.equal(report.remoteResults.length, 3);
    assert.ok(
      report.issues.some((issue) => issue.level === 'error' && /HTTP 404/.test(issue.message)),
    );
    assert.ok(
      report.issues.some((issue) => issue.level === 'warning' && /HTTP 403/.test(issue.message)),
    );
    assert.ok(calls.some((call) => call.startsWith('GET ') && call.endsWith('/fallback')));
  } finally {
    globalThis.fetch = originalFetch;
    close();
  }
});

test('publication checks return file and field context for invalid metadata and unsafe links', async () => {
  const { root, close } = workspace();
  try {
    const file = createPost({ root, title: '不安全链接' });
    const raw =
      fs.readFileSync(file, 'utf8').replace('draft: true', 'draft: false') +
      '\n[unsafe](/%252e%252e/private/)\n';
    fs.writeFileSync(file, raw);
    const draft = createPost({ root, title: '草稿资源' });
    const draftRaw = fs.readFileSync(draft, 'utf8') + '\n[unsafe](/%252e%252e/draft/)\n';
    fs.writeFileSync(draft, draftRaw);
    const missingId = path.join(root, 'content/posts/missing-id.md');
    fs.writeFileSync(missingId, '---\ntitle: 缺少编号\ndate: 2024-02-29\n---\n正文');
    const invalid = path.join(root, 'content/posts/invalid.md');
    fs.writeFileSync(
      invalid,
      '---\ntitle: 无效字段\ndate: 2024-02-29\nid: bad/id\npermalink: https://example.invalid/post/\n---\n正文',
    );

    const report = await checkContent({ root, output: true });
    assert.ok(
      report.issues.some(
        (issue) =>
          issue.file === 'content/posts/missing-id.md' &&
          /id\/abbrlink:.*Missing persistent/.test(issue.message),
      ),
    );
    for (const field of ['id', 'permalink'])
      assert.ok(
        report.issues.some(
          (issue) =>
            issue.file === 'content/posts/invalid.md' && issue.message.startsWith(`${field}: `),
        ),
      );
    assert.ok(
      report.issues.some(
        (issue) =>
          issue.file.endsWith(path.basename(file)) &&
          /link:.*Unsafe local path/.test(issue.message),
      ),
    );
    assert.ok(!report.issues.some((issue) => issue.file.endsWith(path.basename(draft))));
    const draftReport = await checkContent({ root, output: true, includeDrafts: true });
    assert.ok(
      draftReport.issues.some(
        (issue) =>
          issue.file.endsWith(path.basename(draft)) &&
          issue.level === 'warning' &&
          /link:.*Unsafe local path/.test(issue.message),
      ),
    );
    assert.equal(fs.readFileSync(file, 'utf8'), raw);
    assert.equal(fs.readFileSync(draft, 'utf8'), draftRaw);
  } finally {
    close();
  }
});
