import test from 'node:test';
import assert from 'node:assert/strict';
import { transitionMode } from './support/transition-contract';
import { createHash } from 'node:crypto';
import { layoutReference, assertFirefoxReference } from './support/layout-reference';

test('same-document support alone cannot select the native cross-document contract', () => {
  assert.equal(
    transitionMode({
      sameDocument: true,
      pageReveal: false,
      pageSwap: false,
      cssRule: false,
      navigationAuto: false,
    }),
    'fallback',
  );
  assert.equal(
    transitionMode({
      sameDocument: true,
      pageReveal: true,
      pageSwap: true,
      cssRule: true,
      navigationAuto: true,
    }),
    'native',
  );
  assert.throws(
    () =>
      transitionMode({
        sameDocument: true,
        pageReveal: true,
        pageSwap: false,
        cssRule: false,
        navigationAuto: false,
      }),
    /contract review/,
  );
});
test('Firefox layout references are independent of Edge and have immutable capture provenance', () => {
  for (const group of ['motion-system', 'sidebar-bottom'] as const) {
    const edge = layoutReference(group, 'chromium');
    assert.throws(() => layoutReference(group, 'firefox'), /not repeatable/);
    assert.equal(edge.engine, 'edge');
  }
});

test('reference validation rejects engine substitution, byte edits and provisional captures', () => {
  const bytes = Buffer.from(JSON.stringify({ engine: 'firefox', cases: [] }));
  const valid = {
    engine: 'firefox',
    status: 'validated-repeatable',
    records: [{ file: 'sample.json', sha256: createHash('sha256').update(bytes).digest('hex') }],
  };
  assert.equal(assertFirefoxReference(valid, bytes, 'sample.json').engine, 'firefox');
  assert.throws(() => assertFirefoxReference({ ...valid, engine: 'edge' }, bytes, 'sample.json'));
  assert.throws(() =>
    assertFirefoxReference({ ...valid, status: 'provisional' }, bytes, 'sample.json'),
  );
  assert.throws(() =>
    assertFirefoxReference(valid, Buffer.concat([bytes, Buffer.from(' ')]), 'sample.json'),
  );
});
