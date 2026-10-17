// Validate evidence and causal controls; never substitutes for browser acceptance.
import fs from 'node:fs';
import { gunzipSync } from 'node:zlib';
import assert from 'node:assert/strict';
import test from 'node:test';
const dir = 'docs/evidence/engine-focused-20261018/';
const read = (name) => JSON.parse(gunzipSync(fs.readFileSync(dir + name + '.json.gz')));
const summary = JSON.parse(fs.readFileSync(dir + 'summary.json'));
test('font evidence identifies the generated digit and normal text separately', () => {
  const r = read('firefox-font-cause-controls-20261018').records.find((r) => r.cold === 5);
  const s = r.samples[0].data,
    g = s.anonymous[0];
  assert.equal(g.name, '_moz_generated_content_before');
  assert.equal(g.fonts[0].ranges[0].text, '1');
  assert.equal(g.fonts[0].name, 'Arial');
  assert.equal(g.fonts[0].fromFontGroup, true);
  assert.equal(g.fonts[0].fromSystemFallback, false);
  assert.equal(s.anonymous[1].fonts[0].name, 'Cascadia Code Regular');
  assert.equal(s.firstLine.gutter.minWidth, '20px');
  assert.equal(r.twin.fonts[0].name, 'Arial'); // Not confined to counter() or pseudo elements.
});
test('recomputing ch and replacing counter() do not repair the anomalous group', () => {
  const r = read('firefox-font-cause-controls-20261018').records.find((r) => r.cold === 5);
  for (const stage of [
    'after-canvas',
    'after-same-value-ch-recompute',
    'restored-counter-family',
    'literal-counter',
  ])
    assert.equal(r.samples.find((s) => s.stage === stage).data.anonymous[0].fonts[0].name, 'Arial');
  const single = r.samples.find((s) => s.stage === 'single-family').data;
  assert.equal(single.anonymous[0].fonts[0].name, 'Cascadia Code Regular');
  assert.equal(single.firstLine.gutter.minWidth, '21.1px');
});
test('font mismatch also exists with shared font list disabled and local Firefox 155', () => {
  const off = read('firefox-font-no-shared-list-20261018');
  assert.equal(off.records[0].fontPreferences['gfx.e10s.font-list.shared'], false);
  assert.equal(off.records[2].samples[0].data.anonymous[0].fonts[0].name, 'Arial');
  const local = read('firefox-stock155-font-controls-20261018');
  assert.equal(local.records[0].browser.browserVersion, '155.0');
  for (const cold of [3, 8]) {
    const r = local.records[cold];
    assert.equal(r.samples[0].data.anonymous[0].fonts[0].name, 'Arial');
    assert.equal(
      r.samples.find((s) => s.stage === 'single-family').data.anonymous[0].fonts[0].name,
      'Cascadia Code Regular',
    );
    assert.equal(
      r.samples.find((s) => s.stage === 'restore-exact-group').data.anonymous[0].fonts[0].name,
      'Arial',
    );
  }
});
test('font substitution evidence does not prove the historical 23.5px trigger', () => {
  const full = read('firefox-font-cause-20261018').records.flatMap((r) =>
    r.samples.filter((s) => s.stage.startsWith('full-article-')),
  );
  assert.equal(full.length, 36);
  assert.equal(
    full.some((s) => s.data.firstLine.rect.height === 23.5),
    false,
  );
  const matrix = read('firefox-font-matrix-20261018').records[0].samples.filter((s) =>
    s.stage.startsWith('matrix-'),
  );
  assert.equal(matrix.length, 16);
  assert.equal(
    matrix.some((s) => s.data.firstLine.rect.height === 23.5),
    false,
  );
});
test('WebKit missing transitions have true outbound events and the observed 4s boundary', () => {
  const pairs = summary.timing.pairs;
  assert.equal(pairs.length, 117);
  assert.equal(pairs.filter((p) => !p.transition).length, 39);
  assert.equal(
    pairs.every((p) => p.outbound),
    true,
  );
  assert.equal(
    pairs.some((p) => p.previousFinished === false || p.sourceRevealed === false),
    false,
  );
  assert.equal(Math.min(...pairs.filter((p) => !p.transition).map((p) => p.swapToRevealMs)), 4019);
  assert.equal(Math.max(...pairs.filter((p) => p.transition).map((p) => p.swapToRevealMs)), 3918);
});
test('independent WebKit page reproduces with external CSS and without Node bindings', () => {
  const inline = read('webkit-minimal-20261018');
  assert.equal(inline.results.length, 12);
  assert.equal(
    inline.results.every(
      (r) => r.persisted.filter((e) => e.type === 'pagereveal' && e.transition).length === 3,
    ),
    true,
  );
  const external = read('webkit-minimal-external-css-20261018');
  assert.equal(external.externalCSS, true);
  assert.equal(
    external.results.filter(
      (r) => r.persisted.filter((e) => e.type === 'pagereveal' && e.transition).length !== 3,
    ).length,
    4,
  );
  const noBridge = read('webkit-minimal-no-bridge-20261018');
  assert.equal(noBridge.noBridge, true);
  const failed = noBridge.results.find((r) => r.reuse && r.run === 1);
  assert.equal(failed.events.length, 0);
  assert.equal(failed.persisted.filter((e) => e.type === 'pagereveal' && e.transition).length, 0);
  assert.equal(failed.persisted.findLast((e) => e.type === 'init').path, '/3/');
});
test('disabling enhancement modules and inlining CSS are not demonstrated fixes', () => {
  assert.equal(
    read('webkit-no-modules-20261018').results.every((r) => !r.passed),
    true,
  );
  assert.equal(
    read('webkit-paired-css-20261018').results.filter(
      (r) => r.control === 'inline-styles' && !r.passed,
    ).length,
    3,
  );
  const calls = read('webkit-storage-trace-20261018').results.flatMap((r) =>
    r.storageReports.flatMap((s) => s.calls),
  );
  assert.equal(Math.max(...calls.map((c) => c.duration)), 1);
});
