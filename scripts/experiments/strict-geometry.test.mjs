// Proof-of-contract tests for the isolated experiment only. This does NOT replace
// either blocked Firefox acceptance test or establish an approved site baseline.
import fs from 'node:fs';
import { gunzipSync } from 'node:zlib';
import assert from 'node:assert/strict';
import test from 'node:test';
const read = (name) =>
  JSON.parse(gunzipSync(fs.readFileSync(`docs/evidence/linebox-deploy-drill/${name}.json.gz`)));
const exact = (a, b) => assert.deepEqual(a, b); // No rounding, tolerance, excluded geometry, or retries.
const pw = read('linebox-playwright-20261018').records;
const base = pw.find(
  (r) => r.variant === 'original' && r.width === 320 && r.dpr === 1 && r.text === 'latin',
).first;
test('Playwright samples repeat exactly in their complete actual viewport/text/style groups', () => {
  const seen = new Map();
  for (const r of pw) {
    const key = JSON.stringify([r.first.viewport, r.variant, r.text]);
    exact(r.first, r.second);
    if (seen.has(key)) exact(seen.get(key), r.first);
    else seen.set(key, r.first);
  }
});
test('strict local geometry rejects 0.1px line-box and 1px position/width mutations', () => {
  for (const mutate of [
    (s) => (s.lines[0].rect.height += 0.1),
    (s) => (s.lines[1].rect.y += 1),
    (s) => (s.code.width += 1),
    (s) => (s.after.y += 1),
    (s) => s.lines.pop(),
    (s) => (s.computed.fontSize = '14px'),
  ]) {
    const changed = structuredClone(base);
    mutate(changed);
    assert.throws(() => exact(base, changed));
  }
});
test('experimental block and pixel-line-height controls cause real geometry changes', () => {
  const find = (v) =>
    pw.find((r) => r.variant === v && r.width === 320 && r.dpr === 1 && r.text === 'latin').first;
  assert.equal(base.code.height, 3744);
  assert.equal(find('pixel-height').code.height, 3824);
  assert.equal(find('block-lines').code.height, 7464.60009765625);
  assert.throws(() => exact(base, find('pixel-height')));
  assert.throws(() => exact(base, find('block-lines')));
});
test('cold system-font mismatches remain failures despite fonts.ready', () => {
  const records = read('linebox-cold-fonts-20261018').measurements;
  const normal = records.find(
    (r) => r.dpr === 1 && !r.first.fonts.some((f) => f.name === 'Arial'),
  ).first;
  const unusual = records.filter((r) => r.first.fonts.some((f) => f.name === 'Arial'));
  assert.equal(unusual.length, 2);
  for (const r of unusual) {
    assert.equal(r.first.fontStatus, 'loaded');
    assert.equal(r.first.counterStyle.width, '20px');
    assert.equal(normal.counterStyle.width, '21.1px');
    assert.throws(() => exact(normal, r.first));
  }
});
test('hash-pinned font contract repeats exactly across 24 independent cold processes', () => {
  const data = read('linebox-pinned-font-20261018');
  assert.equal(data.measurements.length, 24);
  assert.equal(
    data.controlledFont.sha256,
    'cfb6a8d474018fe46d53a427e5fbee44b998822d0d3d8772914bd712cfc55ac4',
  );
  const groups = new Map();
  for (const r of data.measurements) {
    assert.equal(r.first.viewport.width, 320);
    assert.equal(r.first.fonts.length, 1);
    assert.equal(r.first.fonts[0].name, 'Cascadia Code Regular');
    assert.match(r.first.fonts[0].URI, /\/fixture-font\.ttf$/);
    assert.equal(r.first.counterStyle.width, '21.1px');
    assert.equal(r.first.code.height, 3744);
    exact(r.first, r.second);
    if (groups.has(r.dpr)) exact(groups.get(r.dpr), r.first);
    else groups.set(r.dpr, r.first);
  }
  assert.deepEqual([...groups.keys()], [1, 2]);
});
test('historical 23.5px/23.4px evidence is not accepted as numeric noise', () => {
  const old = JSON.parse(
    fs.readFileSync('docs/evidence/linebox-deploy-drill/historical-first-displacement.json'),
  );
  assert.equal(old.lines, 160);
  assert.equal(old.firstHeightChange.domIndex, 499);
  assert.equal(old.firstAccumulatedTopChange.domIndex, 502);
  assert.notEqual(old.firstHeightChange.before.h, old.firstHeightChange.after.h);
  assert.notEqual(old.firstAccumulatedTopChange.before.y, old.firstAccumulatedTopChange.after.y);
});
