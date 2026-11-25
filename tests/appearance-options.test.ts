import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAppearance, type AppearanceOptions } from '../src/lib/appearance-options';

test('appearance defaults preserve existing tokens and unrelated options', () => {
  assert.deepEqual(
    normalizeAppearance({ sidebar_width: 272 } as AppearanceOptions & { sidebar_width: number }),
    {
      sidebar_width: 272,
      accent: '',
      accent_dark: '',
      font_family: '',
      code_font: '',
      radius: 18,
    },
  );
});

test('appearance accepts separate light/dark colors, font stacks and zero radius', () => {
  const input = {
    accent: '#246',
    accent_dark: '#BFCDBF',
    font_family: '"PingFang SC", serif',
    code_font: "'Cascadia Code', monospace",
    radius: 0,
  };
  assert.deepEqual(normalizeAppearance(input), input);
  assert.equal(normalizeAppearance({ font_family: '微软雅黑, system-ui', radius: 32 }).radius, 32);
});

test('appearance rejects unquoted CSS-wide keywords in either font stack', () => {
  for (const field of ['font_family', 'code_font']) {
    for (const keyword of [
      'inherit',
      'initial',
      'unset',
      'revert',
      'revert-layer',
      'revert-rule',
      'default',
    ]) {
      for (const value of [
        keyword,
        `${keyword}, serif`,
        `Arial, ${keyword.toUpperCase()}`,
        `A ${keyword}`,
      ]) {
        assert.throws(() => normalizeAppearance({ [field]: value }), {
          name: 'TypeError',
          message: new RegExp(`appearance\\.${field}:`),
        });
      }
    }
  }
});

test('appearance compares CSS keywords with ASCII case folding only', () => {
  for (const stack of [
    'unſet, serif',
    'UNſET, serif',
    'curſive serif, monospace',
    '微软雅黑, sans-serif',
    'Cafe\u0301, serif',
  ]) {
    const input = { font_family: stack, code_font: stack };
    assert.equal(normalizeAppearance(input).font_family, stack);
    assert.equal(normalizeAppearance(input).code_font, stack);
  }
});

test('appearance keeps generic families separate and respects quoted member boundaries', () => {
  for (const stack of [
    'serif, cursive',
    'Noto Serif, serif',
    '-apple-system, BlinkMacSystemFont, sans-serif',
    `"cursive serif, fallback", 'inherit', "revert-rule", monospace`,
  ]) {
    const input = { font_family: stack, code_font: stack };
    assert.equal(normalizeAppearance(input).font_family, stack);
    assert.equal(normalizeAppearance(input).code_font, stack);
  }
  for (const field of ['font_family', 'code_font']) {
    for (const value of [
      'cursive serif',
      'Arial, SERIF Sans',
      'system-ui Name',
      '-webkit-body Font',
      'Arial, revert-rule, serif',
      'Arial,, serif',
      ', serif',
      'Arial,',
      '"A,B" next',
      '"A" "B"',
      '"A,B',
      '"A;B", serif',
      '"A\\42", serif',
    ]) {
      assert.throws(
        () => normalizeAppearance({ [field]: value }),
        new RegExp(`appearance\\.${field}:`),
      );
    }
  }
});

test('appearance rejects controls in quoted names and between families in both fields', () => {
  for (const field of ['font_family', 'code_font']) {
    for (const control of [
      '\u0000',
      '\t',
      '\n',
      '\u000b',
      '\f',
      '\r',
      '\u001f',
      '\u007f',
      '\u0085',
      '\u009f',
    ]) {
      for (const value of [`"A${control}B", monospace`, `Arial,${control}serif`]) {
        assert.throws(() => normalizeAppearance({ [field]: value }), {
          name: 'TypeError',
          message: new RegExp(`appearance\\.${field}:`),
        });
      }
    }
  }
});

test('appearance preserves quoted keywords, Unicode names and normal fallback families', () => {
  const input = {
    font_family: '微软雅黑, "Noto Sans CJK SC", Inherited Sans, "initial", system-ui, sans-serif',
    code_font: `"A,B", 'revert-layer', 'Cascadia Code', Consolas, monospace`,
  };
  assert.deepEqual(normalizeAppearance(input).font_family, input.font_family);
  assert.deepEqual(normalizeAppearance(input).code_font, input.code_font);
});

for (const [key, values] of Object.entries({
  accent: ['red', '#12345', 'var(--x)', '#fff; color:red', null, 7],
  accent_dark: ['url(x)', '#12345678', '</style>', false],
  font_family: [
    'serif; color:red',
    'url(https://x)',
    '</style>',
    '"unclosed',
    'serif,',
    '\\41',
    '   ',
    '123',
    null,
  ],
  code_font: ['var(--font)', 'a\nb', 'x'.repeat(501), 12],
  radius: [-1, 33, NaN, Infinity, '18', null],
})) {
  test(`appearance rejects invalid ${key} with actionable field name`, () => {
    for (const value of values) {
      assert.throws(
        () => normalizeAppearance({ [key]: value } as AppearanceOptions),
        new RegExp(`appearance\\.${key}`),
      );
    }
  });
}
