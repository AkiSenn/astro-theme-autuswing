import test from 'node:test';
import assert from 'node:assert/strict';
import { markdownProcessor, scanMath } from '../src/lib/markdown.mjs';
import { mathEnabled, mathPlainText } from '../src/lib/math.mjs';

test('scanner recognizes four delimiters and ignores code, HTML attributes and currency examples', () => {
  const input = [
    String.raw`$x$ \(y\)`,
    String.raw`\[z\]`,
    '$$w$$',
    '`$literal$`',
    '```tex',
    '$code$',
    '```',
    '    $indented$',
    String.raw`\$5 and $5 and $10`,
    '<!-- $comment$ -->',
    '<code>$html_code$</code>',
    '<span title="$attribute$">text</span>',
  ].join('\n');
  const formulas = scanMath(input);
  assert.equal(formulas.length, 4);
  assert.deepEqual(
    formulas.map((f) => f.tex),
    ['x', 'y', 'z', 'w'],
  );
  assert.deepEqual(
    formulas.map((f) => f.line),
    [1, 1, 2, 3],
  );
});
test('legacy flags enable KaTeX while explicit opt-out and global disable are honored', () => {
  for (const data of [
    {},
    { mathjax: true },
    { katex: true },
    { math: true },
    { math: 'mathjax' },
    { math: 'katex' },
    { mathjax: false, katex: true },
  ])
    assert.equal(mathEnabled(data), true);
  for (const data of [
    { math: false },
    { math: 'off' },
    { mathjax: false },
    { katex: false },
    { math: false, mathjax: true },
  ])
    assert.equal(mathEnabled(data), false);
  assert.equal(mathEnabled({ mathjax: true }, false), false);
});
test('unmarked and legacy-marked posts render HTML and accessible MathML at build time', async () => {
  const renderer = await markdownProcessor().createRenderer({ syntaxHighlight: false });
  for (const data of [
    {},
    { mathjax: true },
    { katex: true },
    { math: true },
    { math: 'mathjax' },
  ]) {
    const result = await renderer.render(String.raw`Inline $x^2$ and \(y_1\).`, {
      frontmatter: data,
    });
    assert.equal((result.code.match(/class="katex"/g) || []).length, 2);
    assert.equal(
      (result.code.match(/<annotation encoding="application\/x-tex">/g) || []).length,
      2,
    );
    assert.ok(!result.code.includes('<script'));
  }
  const off = await renderer.render('$x$', { frontmatter: { math: false } });
  assert.ok(!off.code.includes('class="katex"'));
  const empty = await renderer.render('No formulas, despite the legacy flag.', {
    frontmatter: { mathjax: true },
  });
  assert.ok(!empty.code.includes('class="katex"'));
});
test('unsupported commands fail explicitly and identify the article and expression', async () => {
  const renderer = await markdownProcessor().createRenderer({ syntaxHighlight: false });
  await assert.rejects(
    () =>
      renderer.render(String.raw`$\UnknownHistoricalCommand{x}$`, {
        frontmatter: { title: 'Compatibility fixture', mathjax: true },
      }),
    /KaTeX failed in "Compatibility fixture".*UnknownHistoricalCommand/,
  );
});
test('macro state is shared within an article and isolated between articles', async () => {
  const renderer = await markdownProcessor().createRenderer({ syntaxHighlight: false });
  await renderer.render(String.raw`$\gdef\PrivateMacro{\mathbb{R}}$ and $\PrivateMacro$`);
  await assert.rejects(
    () => renderer.render(String.raw`$\PrivateMacro$`),
    /Undefined control sequence/,
  );
});
test('search text retains the original expression once, without visual/MathML duplication', async () => {
  const renderer = await markdownProcessor().createRenderer({ syntaxHighlight: false });
  const result = await renderer.render(String.raw`中文 $\frac{1}{2}$ 后文。`);
  const text = mathPlainText(result.code)!;
  assert.equal((text.match(/\\frac/g) || []).length, 1);
  assert.ok(text.includes('中文') && text.includes('后文'));
  assert.equal(mathPlainText('<p>ordinary content</p>'), null);
});
