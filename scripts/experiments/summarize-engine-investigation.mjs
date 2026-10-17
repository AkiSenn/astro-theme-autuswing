import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import assert from 'node:assert/strict';
import { sha256 } from '../release-integrity.mjs';
const out = path.resolve(process.argv[2]);
fs.mkdirSync(out, { recursive: true });
const firefoxNames = [
  'firefox-font-cause-20261018',
  'firefox-font-cause-ranges-20261018',
  'firefox-font-cause-controls-20261018',
  'firefox-font-no-shared-list-20261018',
  'firefox-stock155-font-controls-20261018',
  'firefox-times-counter-r2-20261018',
  'firefox-font-matrix-20261018',
];
const webkitNames = [
  'webkit-focused-20261018',
  'webkit-network-focused-20261018',
  'webkit-network-repeat-20261018',
  'webkit-no-modules-20261018',
  'webkit-storage-trace-20261018',
  'webkit-paired-css-20261018',
];
const minimalNames = [
  'webkit-minimal-20261018',
  'webkit-minimal-external-css-20261018',
  'webkit-minimal-no-bridge-20261018',
];
const manifest = [],
  firefox = [],
  webkit = [],
  minimal = [],
  pairs = [],
  details = [];
function archive(name, file) {
  const bytes = fs.readFileSync(path.join('.local-tools', name, file));
  const target = name + '.json.gz';
  fs.writeFileSync(path.join(out, target), gzipSync(bytes));
  manifest.push({
    file: target,
    inputSHA256: sha256(bytes),
    sha256: sha256(fs.readFileSync(path.join(out, target))),
  });
  return JSON.parse(bytes);
}
for (const name of firefoxNames) {
  const d = archive(name, 'fonts.json');
  const anomalous = d.records.filter(
    (r) => r.samples[0].data.firstLine.gutter.minWidth !== '21.1px',
  );
  firefox.push({
    name,
    browser: d.records[0].browser.browserVersion,
    coldProcesses: d.records.length,
    originalFontMismatch: anomalous.map((r) => r.cold),
    fullArticleSamples: d.records.flatMap((r) =>
      r.samples
        .filter((s) => s.stage.startsWith('full-article-'))
        .map((s) => ({
          width: s.data.viewport.width,
          lineHeight: s.data.firstLine.rect.height,
          gutter: s.data.firstLine.gutter.minWidth,
          articleHeight: s.data.article?.height,
        })),
    ),
  });
  for (const r of anomalous)
    details.push({
      name,
      cold: r.cold,
      twin: r.twin,
      stages: r.samples.map((s) => ({
        stage: s.stage,
        gutter: s.data.firstLine.gutter,
        line: s.data.firstLine,
        anonymous: s.data.anonymous,
        canvas: s.canvas,
      })),
    });
}
for (const name of webkitNames) {
  const d = archive(name, 'timeline.json');
  webkit.push({
    name,
    runs: d.results.length,
    passed: d.results.filter((r) => r.passed).length,
    failed: d.results.filter((r) => !r.passed).length,
    controls: d.results.map((r) => ({
      run: r.run,
      instrumentation: r.instrumentation,
      control: r.control,
      count: r.events.filter((e) => e.transition).length,
      passed: r.passed,
    })),
  });
  for (const r of d.results) {
    const e = r.persisted || [];
    for (let i = 0; i < e.length; i++)
      if (e[i].type === 'pagereveal' && e[i].path !== '/') {
        const swap = e.slice(0, i).findLast((x) => x.type === 'pageswap'),
          init = e.slice(0, i).findLast((x) => x.type === 'init'),
          click = e.slice(0, i).findLast((x) => x.type === 'click');
        if (swap)
          pairs.push({
            study: name,
            run: r.run,
            path: e[i].path,
            transition: e[i].transition,
            outbound: swap.transition,
            swapToRevealMs: e[i].time - swap.time,
            initToRevealMs: e[i].time - init.time,
            previousFinished: click?.finished,
            sourceRevealed: click?.revealed,
          });
      }
  }
}
for (const name of minimalNames) {
  const d = archive(name, 'minimal.json');
  assert.equal(d.results.length, 12, 'Incomplete diagnostic study');
  minimal.push({
    name,
    externalCSS: d.externalCSS ?? false,
    noBridge: d.noBridge ?? false,
    cases: d.results.map((r) => ({
      reuse: r.reuse,
      run: r.run,
      transitions: r.persisted.filter((e) => e.type === 'pagereveal' && e.transition).length,
    })),
  });
}
const missed = pairs.filter((p) => !p.transition),
  present = pairs.filter((p) => p.transition);
const summary = {
  createdAt: new Date().toISOString(),
  acceptance: 'NOT CLEARED; no site test assertion/reference was changed',
  firefox,
  webkit,
  minimal,
  timing: {
    measuredHops: pairs.length,
    missing: missed.length,
    missingMinSwapToRevealMs: Math.min(...missed.map((p) => p.swapToRevealMs)),
    missingMaxSwapToRevealMs: Math.max(...missed.map((p) => p.swapToRevealMs)),
    presentMaxSwapToRevealMs: Math.max(...present.map((p) => p.swapToRevealMs)),
    pairs,
  },
  archiveManifest: manifest,
};
const serial = archive('webkit-serial-confirmation-20261018', 'minimal.json');
assert.equal(serial.results.length, 6);
summary.serialMinimalConfirmation = {
  externalCSS: serial.externalCSS,
  noBridge: serial.noBridge,
  cases: serial.results.map((r) => ({
    reuse: r.reuse,
    run: r.run,
    transitions: r.persisted.filter((e) => e.type === 'pagereveal' && e.transition).length,
  })),
};
fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify(summary, null, 2));
fs.writeFileSync(path.join(out, 'font-anomalies.json'), JSON.stringify(details, null, 2));
const logDirs = [...firefoxNames, 'firefox-times-counter-20261018'];
fs.writeFileSync(
  path.join(out, 'firefox-browser-logs.json.gz'),
  gzipSync(
    Buffer.from(
      JSON.stringify(
        logDirs.map((name) => ({
          name,
          logs: fs
            .readdirSync(path.join('.local-tools', name))
            .filter((f) => f.endsWith('.log'))
            .map((file) => ({
              file,
              text: fs.readFileSync(path.join('.local-tools', name, file), 'utf8'),
            })),
        })),
      ),
    ),
  ),
);
console.log(
  JSON.stringify(
    {
      firefox: firefox.map((f) => ({
        name: f.name,
        cold: f.coldProcesses,
        mismatches: f.originalFontMismatch,
      })),
      webkit: webkit.map((w) => ({ name: w.name, pass: w.passed, fail: w.failed })),
      minimal: minimal.map((m) => ({ name: m.name, counts: m.cases.map((c) => c.transitions) })),
      timing: { ...summary.timing, pairs: undefined },
    },
    null,
    2,
  ),
);
