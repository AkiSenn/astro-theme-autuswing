import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  assertLegacyMediaQuery,
  assertLegacyMediaCss,
  verifyMediaCompatibility,
} from '../scripts/css-media-compat.mjs';

test('accepts traditional queries, whole-query negation and nested conditional groups', () => {
  for (const query of [
    'not all and (min-width: 720px)',
    'screen and (min-width: 1280px)',
    '(min-width: 720px) and (max-height: 800px)',
    'only screen and (max-width: 760px), print',
    '(prefers-reduced-motion: reduce)',
    '(color)',
  ])
    assert.doesNotThrow(() => assertLegacyMediaQuery(query));
  assert.doesNotThrow(() =>
    assertLegacyMediaCss(
      '@media (min-width:720px){@media not all and (min-width:1000px){a{color:red}}}',
    ),
  );
});

test('rejects range comparisons and MQ4 boolean syntax, including minifier rewrites', () => {
  for (const query of [
    '(width < 720px)',
    '(width <= 720px)',
    '(width >= 1000px)',
    '(width > 1000px)',
    '(720px <= width < 1000px)',
    'not (min-width:720px)',
    '((min-width:720px))',
    '(color) or (monochrome)',
    'screen and (not (min-width:720px))',
    'screen, (width<720px)',
  ])
    assert.throws(() => assertLegacyMediaQuery(query, 'fixture'), /fixture: media query/);
  assert.throws(() => assertLegacyMediaCss('@media screen{@media(width<720px){a{color:red}}}'));
});

test('build gate checks external CSS, inline noscript CSS and media attributes', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'autuswing-media-'));
  try {
    await fs.writeFile(
      path.join(root, 'index.html'),
      '<noscript><style>@media not all and (min-width:720px){a{color:red}}</style></noscript>',
    );
    await fs.writeFile(path.join(root, 'site.css'), '@media(max-width:450px){a{color:red}}');
    assert.equal(await verifyMediaCompatibility(root), 2);
    await fs.writeFile(path.join(root, 'site.css'), '@media(width<720px){a{color:red}}');
    await assert.rejects(verifyMediaCompatibility(root), /site.css: media query/);
    await fs.writeFile(path.join(root, 'site.css'), 'a{color:red}');
    await fs.writeFile(
      path.join(root, 'index.html'),
      '<noscript><style>@media not (min-width:720px){a{color:red}}</style></noscript>',
    );
    await assert.rejects(verifyMediaCompatibility(root), /style\[0\]: media query/);
    await fs.writeFile(
      path.join(root, 'index.html'),
      '<link rel="stylesheet" href="site.css" media="(width&lt;720px)">',
    );
    await assert.rejects(verifyMediaCompatibility(root), /index.html: media query/);
  } finally {
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('autuswing-media-'));
    await fs.rm(root, { recursive: true, force: true });
  }
});
