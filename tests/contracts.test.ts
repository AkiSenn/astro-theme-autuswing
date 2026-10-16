import test from 'node:test';
import assert from 'node:assert/strict';
import {
  publicPath,
  newPostPath,
  assertUniquePaths,
  normalizePath,
  outputFile,
} from '../src/lib/urls';
import { parseDate } from '../src/lib/dates';
import { search } from '../src/lib/search';
import { frontmatter } from '../src/lib/frontmatter.mjs';
import { protectMath, markdownProcessor } from '../src/lib/markdown.mjs';
import { redirects } from '../scripts/static-artifacts.mjs';

test('public IDs are persistent; explicit URLs and leading zeros are retained', () => {
  assert.equal(publicPath({ id: '00123', abbrlink: 'other' }), '/post/00123/');
  assert.equal(publicPath({ id: '', abbrlink: '000abc' }), '/post/000abc/');
  assert.equal(publicPath({ permalink: '/custom.html', id: 'ignored' }), '/custom.html');
  assert.equal(publicPath({ permalink: '/custom-index.html' }), '/custom-index.html');
  assert.equal(normalizePath('/tags/Machine%20Learning/'), '/tags/Machine Learning/');
  assert.equal(publicPath({ permalink: 'notes/custom' }), '/notes/custom/');
  assert.throws(() => publicPath({}), /persistent/);
  for (const permalink of [
    'https://evil.example/a',
    '//evil.example/a',
    '/a/../b/',
    '/%2e%2e/a',
    '/%252e%252e/',
    '/a?x=1',
  ])
    assert.throws(() => publicPath({ permalink }));
});
test('new posts use root IDs while legacy links retain /post/', () => {
  assert.equal(newPostPath({ id: 'a1b2c3' }), '/a1b2c3/');
  assert.equal(newPostPath({ id: '001234' }), '/001234/');
  assert.equal(publicPath({ abbrlink: '55b0541c' }), '/post/55b0541c/');
  assert.equal(newPostPath({ id: 'a1b2c3', permalink: '/custom.html' }), '/custom.html');
  assert.throws(() => newPostPath({ id: 'about' }), /reserved/);
  assert.throws(() => newPostPath({}), /persistent/);
});
test('route collisions include case, percent encoding and index.html', () => {
  for (const pair of [
    ['/post/AbC/', '/post/abc/'],
    ['/tags/写作/', '/tags/%E5%86%99%E4%BD%9C/'],
    ['/a/', '/a/index.html'],
  ])
    assert.throws(
      () => assertUniquePaths(pair.map((path, i) => ({ path, source: String(i) }))),
      /collision/,
    );
  assert.equal(outputFile('/'), 'index.html');
  assert.equal(outputFile('/a/'), 'a/index.html');
  assert.equal(outputFile('/a.html'), 'a.html');
});
test('YAML keeps dates and numeric-looking identifiers in their original semantics', () => {
  const { data, body } = frontmatter(
    '---\ntitle: test\nabbrlink: 000123\ndate: 2022-01-20 13:23:24\ncustom: keep\n---\n正文',
  );
  assert.equal(data.abbrlink, '000123');
  assert.equal(data.date, '2022-01-20 13:23:24');
  assert.equal(data.custom, 'keep');
  assert.equal(body, '正文');
});
test('dates use Shanghai offsets independent of the process TZ', () => {
  for (const tz of ['UTC', 'America/New_York', 'Asia/Singapore']) {
    const before = process.env.TZ;
    process.env.TZ = tz;
    try {
      assert.equal(parseDate('2022-01-20 13:23:24'), '2022-01-20T05:23:24.000Z');
      assert.equal(parseDate('2026-10-05'), '2026-10-04T16:00:00.000Z');
    } finally {
      process.env.TZ = before;
    }
  }
  assert.throws(() => parseDate('2026-02-30'));
  assert.throws(() => parseDate(new Date()));
  assert.throws(() => parseDate('yesterday'));
});
test('search is NFKC, multi-term AND and weighted title/tags/content', () => {
  const items = [
    { title: 'Ａｓｔｒｏ 中文', tags: [], categories: [], excerpt: '', content: '迁移' },
    { title: '其他', tags: ['Astro'], categories: [], excerpt: '', content: '中文 迁移' },
    { title: '文章', tags: [], categories: [], excerpt: '', content: 'astro 中文 迁移' },
  ].map((p, i) => ({ ...p, url: `/post/${i}/` }));
  assert.deepEqual(
    search(items, 'astro 中文').map((p) => p.url),
    ['/post/0/', '/post/1/', '/post/2/'],
  );
  assert.equal(search(items, 'astro 不存在').length, 0);
  assert.equal(search(items, '').length, 0);
});
test('all four TeX delimiters survive Markdown; code stays opaque', async () => {
  const input = [
    String.raw`行内 $x_1$ 和 \(a_b\)。`,
    '',
    '$$',
    String.raw`\begin{matrix}a&b\\c&d\end{matrix}`,
    '$$',
    '',
    String.raw`\[ x^2 \]`,
    '',
    '`$not_math$`',
    '',
    '```tex',
    '$x_code$',
    '```',
  ].join('\n');
  const renderer = await markdownProcessor().createRenderer({ syntaxHighlight: false });
  const result = await renderer.render(input, { frontmatter: { mathjax: true } });
  assert.equal((result.code.match(/class="math-(inline|display)"/g) || []).length, 4);
  assert.ok(result.code.includes('a_b'));
  assert.ok(result.code.includes('$x_code$'));
  assert.ok(!result.code.includes('<em>1'));
  assert.equal(protectMath('`$literal$`'), '`$literal$`');
});
test('headings stay unique, h1 becomes h2 and autospace leaves code intact', async () => {
  const renderer = await markdownProcessor().createRenderer({ syntaxHighlight: false });
  const result = await renderer.render('# 中文Astro\n\n## 重复\n\n## 重复\n\n`中文Astro`');
  assert.ok(result.code.includes('<h2'));
  assert.equal(new Set(result.metadata.headings.map((h) => h.slug)).size, 3);
  assert.ok(result.code.includes('中文 Astro'));
  assert.ok(result.code.includes('<code>中文Astro</code>'));
});
test('unsupported Hexo tags fail explicitly, fenced examples are accepted', async () => {
  const renderer = await markdownProcessor().createRenderer({ syntaxHighlight: false });
  await assert.rejects(() => renderer.render('{% unsupported value %}'), /Unsupported Hexo/);
  await renderer.render('```\n{% example %}\n```');
  await renderer.render('~~~text\n{% example %}\n~~~');
  await renderer.render('`{% example %}`');
});
test('redirect manifest has one rule per path, stable 301 targets', () => {
  const rules = redirects();
  assert.equal(new Set(rules.map((r) => r.from)).size, rules.length);
  assert.equal(rules.length, 21);
  assert.ok(rules.every((r) => r.status === 301 && /^\/post\/[a-z\d]+\/$/.test(r.to)));
});
