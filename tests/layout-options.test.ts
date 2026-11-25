import assert from 'node:assert/strict';
import test from 'node:test';
import { layoutVariables, normalizeLayout } from '../src/lib/layout-options';

const defaults = {
  home_sidebar_width: 272,
  article_sidebar_width: 72,
  toc_width: 260,
  content_max_width: 860,
  desktop_gutter: 24,
  mobile_gutter: 16,
  density: 'comfortable',
};

const editorial = {
  home_sidebar_width: 300,
  article_sidebar_width: 88,
  toc_width: 288,
  content_max_width: 980,
  desktop_gutter: 32,
  mobile_gutter: 20,
  density: 'spacious',
};

test('built-in presets resolve to the specified dimensions and density', () => {
  assert.deepEqual(normalizeLayout({ preset: 'classic' }), defaults);
  assert.deepEqual(normalizeLayout({ preset: 'editorial' }), editorial);
  assert.deepEqual(normalizeLayout({ preset: 'compact' }), {
    ...defaults,
    density: 'compact',
  });
  assert.deepEqual(normalizeLayout({ preset: 'custom' }), defaults);
});

test('explicit fields override presets independently', () => {
  assert.deepEqual(normalizeLayout({ preset: 'editorial', content_max_width: 1040 }), {
    ...editorial,
    content_max_width: 1040,
  });
  assert.deepEqual(normalizeLayout({ preset: 'editorial', density: 'compact' }), {
    ...editorial,
    density: 'compact',
  });
  const overrides = {
    home_sidebar_width: 280,
    article_sidebar_width: 88,
    toc_width: 220,
    content_max_width: 920,
    desktop_gutter: 30,
    mobile_gutter: 20,
  };
  assert.deepEqual(normalizeLayout({ preset: 'compact', ...overrides }, 298), {
    ...overrides,
    density: 'compact',
  });
});

test('old settings and partial custom layouts retain compatible defaults', () => {
  assert.deepEqual(normalizeLayout({ density: 'spacious' }, 288), {
    ...defaults,
    density: 'spacious',
    home_sidebar_width: 288,
  });
  assert.equal(normalizeLayout({ preset: 'classic' }, 288).home_sidebar_width, 288);
  assert.equal(normalizeLayout({ preset: 'compact' }, 288).home_sidebar_width, 288);
  assert.deepEqual(normalizeLayout({ preset: 'editorial' }, 288), editorial);
  assert.deepEqual(
    normalizeLayout({ preset: 'custom', mobile_gutter: 18, density: 'compact' }, 288),
    {
      ...defaults,
      home_sidebar_width: 288,
      mobile_gutter: 18,
      density: 'compact',
    },
  );
});

test('invalid presets and invalid explicit overrides still fail with field errors', () => {
  for (const preset of ['wide', 'Classic', '', 'constructor', '__proto__', null, 0, false]) {
    assert.throws(() => normalizeLayout({ preset }), /^TypeError: layout\.preset:/);
  }
  assert.throws(
    () => normalizeLayout({ preset: 'editorial', toc_width: null }),
    /^TypeError: layout\.toc_width:/,
  );
  assert.throws(
    () => normalizeLayout({ preset: 'compact', content_max_width: 639 }),
    /^TypeError: layout\.content_max_width:/,
  );
  assert.throws(
    () => normalizeLayout({ preset: 'editorial', density: null }),
    /^TypeError: layout\.density:/,
  );
});

test('missing layout fields use the existing layout and comfortable rhythm', () => {
  assert.deepEqual(normalizeLayout(undefined), defaults);
  assert.deepEqual(normalizeLayout({}), defaults);
  assert.deepEqual(normalizeLayout({ toc_width: 300 }), { ...defaults, toc_width: 300 });
});

test('a new sidebar value wins; omission preserves the legacy clamped width', () => {
  assert.equal(normalizeLayout(undefined, 288).home_sidebar_width, 288);
  assert.equal(normalizeLayout({}, 500).home_sidebar_width, 300);
  assert.equal(normalizeLayout({}, 100).home_sidebar_width, 240);
  assert.equal(normalizeLayout({ home_sidebar_width: 320 }, 250).home_sidebar_width, 320);
});

const ranges = {
  home_sidebar_width: [240, 320],
  article_sidebar_width: [68, 104],
  toc_width: [180, 320],
  content_max_width: [640, 1120],
  desktop_gutter: [16, 40],
  mobile_gutter: [8, 32],
} as const;

for (const key of Object.keys(ranges) as (keyof typeof ranges)[]) {
  test(`layout.${key} accepts its boundaries and rejects unsafe inputs`, () => {
    const [min, max] = ranges[key];
    for (const value of [min, max]) {
      assert.equal(normalizeLayout({ [key]: value })[key], value);
    }
    for (const value of [
      min - 0.1,
      max + 0.1,
      String(min),
      `${min}px; color:red`,
      NaN,
      Infinity,
      -Infinity,
      null,
      true,
      {},
    ]) {
      assert.throws(
        () => normalizeLayout({ [key]: value }),
        new RegExp(`^TypeError: layout\\.${key}:`),
      );
    }
  });
}

test('layout validates the namespace, density and misspelled fields', () => {
  for (const value of [null, [], 'comfortable', 1]) {
    assert.throws(() => normalizeLayout(value), /^TypeError: layout:/);
  }
  for (const density of ['loose', 'Compact', '', 'constructor', null, 1]) {
    assert.throws(() => normalizeLayout({ density }), /^TypeError: layout\.density:/);
  }
  assert.throws(() => normalizeLayout({ toc_wdith: 260 }), /^TypeError: layout\.toc_wdith:/);
});

test('multiple size overrides and each density emit only static layout variables', () => {
  for (const [density, scale] of [
    ['compact', 0.8],
    ['comfortable', 1],
    ['spacious', 1.25],
  ]) {
    const layout = normalizeLayout({ ...editorial, preset: 'custom', density });
    assert.deepEqual(layout, { ...editorial, density });
    assert.equal(
      layoutVariables(layout),
      '--aw-home-sidebar-width:300px;--aw-article-sidebar-width:88px;--aw-toc-width:288px;' +
        '--aw-content-max-width:980px;--aw-desktop-gutter:32px;--aw-mobile-gutter:20px;' +
        `--aw-density-scale:${scale};`,
    );
  }
});
