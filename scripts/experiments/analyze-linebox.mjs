import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { sha256 } from '../release-integrity.mjs';
const out = path.resolve(process.argv[2]);
fs.mkdirSync(out, { recursive: true });
const directories = process.argv.slice(3),
  groups = new Map(),
  runs = [];
let samples = 0,
  immediateChanges = 0,
  repeatChanges = 0;
for (const directory of directories) {
  const bytes = fs.readFileSync(path.join(directory, 'measurements.json')),
    data = JSON.parse(bytes),
    records = data.measurements || data.records;
  fs.writeFileSync(path.join(out, path.basename(directory) + '.json.gz'), gzipSync(bytes));
  const set = {
    experiment: path.basename(directory),
    samples: records.length,
    fixtureSHA256: data.fixtureSHA256,
    actualWidths: [],
    fonts: [],
    immediateChanges: 0,
    repeatChanges: 0,
  };
  const widths = new Set(),
    fonts = new Set();
  for (const r of records) {
    samples++;
    const s = r.first;
    widths.add(s.viewport.width);
    for (const f of s.fonts || []) fonts.add(f.name);
    const key = [path.basename(directory), r.dpr, r.variant, r.text, s.viewport.width].join('|');
    const g = groups.get(key) || {
      key,
      count: 0,
      first: s,
      heights: new Set(),
      advances: new Set(),
      codeHeights: new Set(),
      firstChangedLine: null,
      repeatableExactly: true,
    };
    g.count++;
    for (const l of s.lines) g.heights.add(l.rect.height);
    for (let i = 1; i < s.lines.length; i++)
      g.advances.add(s.lines[i].rect.y - s.lines[i - 1].rect.y);
    g.codeHeights.add(s.code.height);
    if (JSON.stringify(s) !== JSON.stringify(r.second)) {
      immediateChanges++;
      set.immediateChanges++;
    }
    if (JSON.stringify(s) !== JSON.stringify(g.first)) {
      repeatChanges++;
      set.repeatChanges++;
      g.repeatableExactly = false;
      g.firstChangedLine ??=
        s.lines.findIndex((l, i) => JSON.stringify(l) !== JSON.stringify(g.first.lines[i])) + 1;
    }
    groups.set(key, g);
  }
  set.actualWidths = [...widths];
  set.fonts = [...fonts];
  runs.push(set);
}
const summary = {
  generatedAt: new Date().toISOString(),
  samples,
  observations: samples * 2,
  immediateChanges,
  repeatChanges,
  runs,
  groups: [...groups.values()].map(({ first, heights, advances, codeHeights, ...g }) => ({
    ...g,
    css: first.style || first.computed,
    fonts: first.fonts || 'not available to ordinary page script',
    lineCount: first.lines.length,
    lineBoxHeights: [...heights],
    lineAdvances: [...advances],
    codeHeights: [...codeHeights],
  })),
};
// This analysis never rounds or increases a tolerance: strict comparison of raw JSON.
fs.writeFileSync(path.join(out, 'minimal-summary.json'), JSON.stringify(summary, null, 2));
const lines = [...groups.values()]
  .filter((g) => g.key.includes('|original|') && g.key.endsWith('|320'))
  .map((g) => ({ experiment: g.key, lines: g.first.lines }));
fs.writeFileSync(path.join(out, 'representative-lines.json'), JSON.stringify(lines, null, 2));
const old = JSON.parse(
  fs.readFileSync('.local-tools/firefox-contracts-20261018/element-timing.json'),
);
const a = old[0].nodes,
  b = old.at(-1).nodes;
assert.equal(a.length, b.length);
const oldLines = a.flatMap((node, i) =>
  node.cls === 'line' ? [{ domIndex: i, text: node.text, before: node, after: b[i] }] : [],
);
const legacy = {
  source: 'previous full-site trace, not newly reproduced by the minimal experiment',
  lines: oldLines.length,
  firstHeightChange: oldLines.find((n) => n.before.h !== n.after.h),
  firstAccumulatedTopChange: oldLines.find((n) => n.before.y !== n.after.y),
  totalHeightChange: oldLines.reduce((s, n) => s + n.before.h - n.after.h, 0),
  allLines: oldLines,
};
fs.writeFileSync(
  path.join(out, 'historical-first-displacement.json'),
  JSON.stringify(legacy, null, 2),
);
// Preserve executed bytes, never substitute a reformatted/newer fixture.
for (const [i, run] of runs.entries()) {
  const archived = path.join(out, `fixture-${run.fixtureSHA256.slice(0, 16)}.html`);
  const local = path.join(directories[i], 'fixture.html');
  const bytes = fs.readFileSync(fs.existsSync(local) ? local : archived);
  assert.equal(sha256(bytes), run.fixtureSHA256, 'Executed fixture bytes are missing or modified');
  fs.writeFileSync(archived, bytes);
}
console.log(
  JSON.stringify(
    {
      samples,
      observations: samples * 2,
      immediateChanges,
      repeatChanges,
      groups: groups.size,
      out,
    },
    null,
    2,
  ),
);
