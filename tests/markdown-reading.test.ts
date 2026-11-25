import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { load } from 'cheerio';
import { markdownProcessor } from '../src/lib/markdown.mjs';
import { frontmatter } from '../src/lib/frontmatter.mjs';

test('the non-public Markdown sample covers the real renderer without losing code or anchors', async () => {
  const { body, data } = frontmatter(fs.readFileSync('tests/fixtures/markdown/reading.md', 'utf8'));
  const renderer = await markdownProcessor().createRenderer({
    syntaxHighlight: 'shiki',
    shikiConfig: { themes: { light: 'github-light', dark: 'github-dark' }, defaultColor: false },
  });
  const result = await renderer.render(body, { frontmatter: data });
  const $ = load(result.code);
  const code = $('pre[data-filename="src/examples/reading-demo.ts"]');
  assert.equal(code.length, 1);
  assert.equal(code.find('.code-line-highlight').length, 3);
  assert.equal(code.find('.code-line-add').length, 1);
  assert.equal(code.find('.code-line-delete').length, 1);
  assert.ok(code.find('code').text().startsWith("const language = 'TypeScript';\n"));
  assert.equal($('img').first().attr('width'), '512');
  assert.equal($('img').first().attr('height'), '512');
  assert.ok($('img').first().attr('src')!.startsWith('/img/placeholder.svg'));
  assert.equal($('figcaption').length, 1);
  assert.equal($('.table-wrap').length, 2);
  assert.equal($('td,th').filter('[rowspan],[colspan]').length, 2);
  assert.equal($('.admonition').length, 2);
  assert.equal($('[data-footnotes]').length, 1);
  assert.equal($('math').length, 4);
  assert.equal($('h1').length, 0, 'Body H1 remains H2 to preserve the existing article hierarchy');
  for (const depth of [2, 3, 4, 5, 6]) assert.ok($(`h${depth}[id]`).length);
  assert.ok(result.metadata.headings.some((heading) => heading.slug === '代码与文件名'));
  for (const href of $('a[href^="#"]')
    .map((_, node) => $(node).attr('href')!)
    .get())
    assert.ok(
      $('[id]')
        .toArray()
        .some((node) => node.attribs.id === decodeURIComponent(href.slice(1))),
      href,
    );
});

test('code metadata cannot inject markup or contaminate copied source', async () => {
  const renderer = await markdownProcessor().createRenderer({ syntaxHighlight: 'shiki' });
  const { code } = await renderer.render('```js title="<img-onerror>" add={1}\nconst x = 1;\n```');
  const $ = load(code);
  assert.equal($('pre').attr('data-filename'), '<img-onerror>');
  assert.equal($('img-onerror').length, 0);
  assert.equal($('code').text(), 'const x = 1;');
});
