import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import {
  planTestEvidence,
  reserveTestEvidence,
  validateTestArguments,
} from '../scripts/test-evidence.mjs';

const project = process.cwd();
const cli = path.join(project, 'node_modules/@playwright/test/cli.js');
function fixture() {
  // 只创建本测试拥有的新文件；失败证据与 fixture 均保留，不做递归清理。
  return fs.mkdtempSync(path.join(os.tmpdir(), 'autuswing-evidence-'));
}
function plan(root: string, env: Record<string, string> = {}) {
  return planTestEvidence({ root, env, args: [], id: 'sample' });
}
function originals(root: string) {
  fs.mkdirSync(root, { recursive: true });
  for (const name of ['original.png', 'approved.html', 'test.log', 'acceptance.json'])
    fs.writeFileSync(path.join(root, name), `original:${name}`, { flag: 'wx' });
  return () => {
    assert.deepEqual(fs.readdirSync(root).sort(), [
      'acceptance.json',
      'approved.html',
      'original.png',
      'test.log',
    ]);
    for (const name of fs.readdirSync(root))
      assert.equal(fs.readFileSync(path.join(root, name), 'utf8'), `original:${name}`);
  };
}

test('default paths are explicit, fresh and separate; reservation never creates the cleanup leaf', () => {
  const root = fixture(),
    value = plan(root),
    env: Record<string, string> = {};
  for (const file of [value.output, value.evidence, value.report, value.screenshots])
    assert.ok(path.isAbsolute(file));
  reserveTestEvidence(value, { env });
  assert.equal(fs.existsSync(value.output), false);
  assert.equal(fs.existsSync(value.evidence), true);
  assert.equal(env.VISUAL_EVIDENCE_DIR, value.screenshots);
  assert.ok(!value.report.startsWith(value.output + path.sep));
  assert.throws(() => reserveTestEvidence(value, { env: {} }), /拒绝复用/);
});

test('explicit absolute output and evidence paths are accepted only in separate owned scopes', () => {
  const root = fixture();
  const value = plan(root, {
    PLAYWRIGHT_OUTPUT_DIR: path.join(root, '.local-tools/test-runs/custom/artifacts'),
    AUTUSWING_EVIDENCE_DIR: path.join(root, '.local-tools/test-evidence/custom'),
    PLAYWRIGHT_REPORT_FILE: path.join(root, '.local-tools/test-evidence/custom/report.json'),
  });
  reserveTestEvidence(value, { env: {} });
  assert.ok(fs.existsSync(path.join(value.evidence, 'run.json')));
});

for (const value of ['', 'test-results/new', '../evidence', '/relative-to-drive']) {
  test(`reject ambiguous output before creating directories: ${JSON.stringify(value)}`, () => {
    if (value === '/relative-to-drive' && process.platform !== 'win32')
      return assert.throws(() => plan(fixture(), { PLAYWRIGHT_OUTPUT_DIR: value }), /清理范围/);
    const root = fixture();
    assert.throws(() => plan(root, { PLAYWRIGHT_OUTPUT_DIR: value }), /绝对路径/);
    assert.deepEqual(fs.readdirSync(root), []);
  });
}

test('existing output container, including empty directories, cannot be reused', () => {
  const root = fixture(),
    value = plan(root);
  fs.mkdirSync(path.dirname(value.output), { recursive: true });
  assert.throws(() => reserveTestEvidence(value, { env: {} }), /拒绝复用/);
  assert.equal(fs.existsSync(value.evidence), false);
});

test('existing evidence keeps all original files and is rejected before output allocation', () => {
  const root = fixture(),
    value = plan(root),
    unchanged = originals(value.evidence);
  assert.throws(() => reserveTestEvidence(value, { env: {} }), /拒绝复用/);
  unchanged();
  assert.equal(fs.existsSync(path.dirname(value.output)), false);
});

test('cleanup cannot escape to workspace, old results, frozen baselines or a parent run directory', () => {
  const root = fixture();
  for (const output of [
    root,
    path.join(root, 'test-results'),
    path.join(root, 'tests/styles/snapshots'),
    path.join(root, '.local-tools/test-runs'),
    path.join(root, '.local-tools/test-runs/sample'),
  ]) {
    assert.throws(() => plan(root, { PLAYWRIGHT_OUTPUT_DIR: output }), /清理范围/);
  }
  assert.throws(
    () =>
      plan(root, {
        PLAYWRIGHT_OUTPUT_DIR:
          path.join(root, '.local-tools/test-runs') +
          path.sep +
          '..' +
          path.sep +
          'evidence/artifacts',
      }),
    /绝对路径/,
  );
  assert.deepEqual(fs.readdirSync(root), []);
});

test('evidence, report and screenshot overrides cannot point into cleanup or historical evidence', () => {
  const root = fixture();
  assert.throws(
    () => plan(root, { AUTUSWING_EVIDENCE_DIR: path.join(root, 'docs/evidence') }),
    /证据必须/,
  );
  assert.throws(
    () =>
      plan(root, {
        PLAYWRIGHT_REPORT_FILE: path.join(
          root,
          '.local-tools/test-runs/sample/artifacts/report.json',
        ),
      }),
    /报告必须/,
  );
  assert.throws(
    () => plan(root, { VISUAL_EVIDENCE_DIR: path.join(root, 'docs/evidence') }),
    /截图必须/,
  );
  assert.throws(
    () =>
      plan(root, {
        PLAYWRIGHT_REPORT_FILE: path.join(root, '.local-tools/test-evidence/sample/run.json'),
      }),
    /报告必须/,
  );
  assert.throws(
    () =>
      plan(root, {
        PLAYWRIGHT_REPORT_FILE: path.join(root, '.local-tools/test-evidence/sample/a.json'),
        STYLE_REPORT: path.join(root, '.local-tools/test-evidence/sample/b.json'),
      }),
    /不能指向不同报告/,
  );
  assert.deepEqual(fs.readdirSync(root), []);
});

test('directory junctions and symlinks cannot redirect cleanup into original evidence', () => {
  const root = fixture(),
    target = path.join(root, 'originals'),
    unchanged = originals(target);
  fs.mkdirSync(path.join(root, '.local-tools/test-runs'), { recursive: true });
  fs.symlinkSync(
    target,
    path.join(root, '.local-tools/test-runs/link'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  assert.throws(
    () =>
      plan(root, {
        PLAYWRIGHT_OUTPUT_DIR: path.join(root, '.local-tools/test-runs/link/artifacts'),
      }),
    /符号链接或目录联接/,
  );
  unchanged();
});

test('CLI overrides, missing grep values and UI reruns fail closed', () => {
  for (const args of [
    ['--output', '/old'],
    ['--output=/old'],
    ['-o/old'],
    ['--grep-invert', '--output', '/old'],
    ['--reporter=json'],
    ['--add-reporter=html'],
    ['--last-failed-file=/old'],
    ['--ui'],
    ['--update-snapshots'],
    ['-u'],
  ])
    assert.throws(() => validateTestArguments(args), /测试证据保护/);
  validateTestArguments(['--grep', 'contents', '--project=firefox', '--workers=1']);
});

test('native reporter environment overrides cannot bypass the configured evidence path', () => {
  const root = fixture();
  for (const key of [
    'PLAYWRIGHT_JSON_OUTPUT_FILE',
    'PLAYWRIGHT_JSON_OUTPUT_DIR',
    'PLAYWRIGHT_JSON_OUTPUT_NAME',
    'PW_TEST_REPORTER',
    'PLAYWRIGHT_LAST_RUN_OUTPUT_FILE',
  ])
    assert.throws(() => plan(root, { [key]: path.join(root, 'original.json') }), /不能通过/);
  assert.deepEqual(fs.readdirSync(root), []);
});

function runner() {
  const root = fixture();
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ type: 'module' }), {
    flag: 'wx',
  });
  fs.mkdirSync(path.join(root, 'scripts'));
  fs.mkdirSync(path.join(root, 'tests'));
  for (const file of ['test-evidence.mjs', 'test-evidence-reporter.mjs'])
    fs.copyFileSync(path.join(project, 'scripts', file), path.join(root, 'scripts', file));
  fs.symlinkSync(
    path.join(project, 'node_modules'),
    path.join(root, 'node_modules'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  fs.writeFileSync(
    path.join(root, 'playwright.config.ts'),
    `import {defineConfig} from '@playwright/test';
import {prepareTestEvidence,protectedReporters} from './scripts/test-evidence.mjs';
const run=prepareTestEvidence();
export default defineConfig({testDir:'./tests',workers:2,fullyParallel:true,outputDir:run.output,reporter:protectedReporters(run),projects:process.env.SAFETY_PROJECT_OUTPUT?[{name:'override',outputDir:process.env.SAFETY_PROJECT_OUTPUT}]:undefined});`,
    { flag: 'wx' },
  );
  fs.writeFileSync(
    path.join(root, 'tests/safety.spec.ts'),
    `import {test,expect} from '@playwright/test';
import fs from 'node:fs'; import path from 'node:path';
import {evidenceDirectory} from '../scripts/test-evidence.mjs';
for(const name of ['first','second']) test(name,async()=>{const dir=evidenceDirectory('probe');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,name+'.txt'),'evidence',{flag:'wx'});if(process.env.SAFETY_ARCHIVE_FAIL==='1'){try{fs.writeFileSync(path.join(JSON.parse(process.env.AUTUSWING_TEST_EVIDENCE).evidence,'attachments'),'blocked',{flag:'wx'});}catch(error){if(error.code!=='EEXIST')throw error;}}const raw=test.info().outputPath('raw.txt');fs.writeFileSync(raw,'raw evidence bytes',{flag:'wx'});await test.info().attach('raw-original',{path:raw});console.log('retained test log');expect(process.env.SAFETY_FAIL==='1').toBe(false);});`,
    { flag: 'wx' },
  );
  const env = { ...process.env };
  for (const key of Object.keys(env))
    if (
      /^(AUTUSWING_.*EVIDENCE|PLAYWRIGHT_(OUTPUT|REPORT|LAST|JSON|HTML|JUNIT|BLOB)|VISUAL_EVIDENCE|STYLE_REPORT|TEST_WORKER_INDEX|TEST_PARALLEL_INDEX|PW_TEST_REPORTER)/.test(
        key,
      )
    )
      delete env[key];
  return {
    root,
    run: (args: string[], extra: Record<string, string> = {}) =>
      spawnSync(process.execPath, [cli, 'test', ...args], {
        cwd: root,
        env: { ...env, ...extra },
        encoding: 'utf8',
      }),
  };
}

test('real CLI rejects the incident argument pattern without touching original fixture evidence', () => {
  const { root, run } = runner(),
    originalDir = path.join(root, 'test-results'),
    unchanged = originals(originalDir);
  const result = run(['--grep-invert', '--output', originalDir]);
  assert.notEqual(result.status, 0);
  assert.match(result.stdout + result.stderr, /测试证据保护/);
  unchanged();
});

test('real CLI rejects existing and unsafe environment destinations before cleanup', () => {
  const { root, run } = runner(),
    value = plan(root),
    unchanged = originals(value.evidence);
  const result = run([], { AUTUSWING_EVIDENCE_DIR: value.evidence });
  assert.notEqual(result.status, 0);
  assert.match(result.stdout + result.stderr, /拒绝复用/);
  unchanged();
  const dangerous = run([], { PLAYWRIGHT_OUTPUT_DIR: root });
  assert.notEqual(dangerous.status, 0);
  assert.match(dangerous.stdout + dangerous.stderr, /清理范围/);
  unchanged();
});

test('effective per-project overrides stop the real runner before deleting original fixture files', () => {
  const { root, run } = runner(),
    destination = path.join(root, 'originals'),
    unchanged = originals(destination);
  const result = run([], { SAFETY_PROJECT_OUTPUT: destination });
  assert.notEqual(result.status, 0);
  assert.match(result.stdout + result.stderr, /实际项目输出与已独占路径不同/);
  unchanged();
});

test('real CLI preserves reports, logs and worker evidence across successful and failed runs', () => {
  const { root, run } = runner();
  const first = run([]);
  assert.equal(first.status, 0, first.stdout + first.stderr);
  const archive = path.join(root, '.local-tools/test-evidence');
  const firstName = fs.readdirSync(archive)[0],
    firstDir = path.join(archive, firstName);
  const firstReport = fs.readFileSync(path.join(firstDir, 'report.json'));
  assert.equal(JSON.parse(firstReport.toString()).stats.expected, 2);
  assert.match(fs.readFileSync(path.join(firstDir, 'console.log'), 'utf8'), /retained test log/);
  const workerFiles = fs
    .readdirSync(path.join(firstDir, 'screenshots/probe'), { recursive: true })
    .filter((f) => f.endsWith('.txt'));
  assert.equal(workerFiles.length, 2);
  const attachments = fs
    .readFileSync(path.join(firstDir, 'attachments.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  assert.equal(attachments.length, 2);
  for (const attachment of attachments) {
    assert.equal(fs.readFileSync(attachment.saved, 'utf8'), 'raw evidence bytes');
    assert.ok(!attachment.saved.startsWith(path.join(root, '.local-tools/test-runs') + path.sep));
  }
  const second = run([], { SAFETY_FAIL: '1' });
  assert.notEqual(second.status, 0);
  assert.deepEqual(fs.readFileSync(path.join(firstDir, 'report.json')), firstReport);
  const next = fs.readdirSync(archive).find((n) => n !== firstName)!;
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(archive, next, 'report.json'), 'utf8')).stats.unexpected,
    2,
  );
  assert.equal(fs.readdirSync(archive).length, 2);
  const failedAttachments = fs
    .readFileSync(path.join(archive, next, 'attachments.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  assert.equal(
    failedAttachments.filter((attachment) => attachment.name === 'raw-original').length,
    2,
  );
  for (const attachment of failedAttachments.filter(
    (attachment) => attachment.name === 'raw-original',
  ))
    assert.equal(fs.readFileSync(attachment.saved, 'utf8'), 'raw evidence bytes');
});

test('attachment archival failure fails the run even when product assertions pass', () => {
  const { root, run } = runner();
  const result = run([], { SAFETY_ARCHIVE_FAIL: '1' });
  assert.notEqual(result.status, 0);
  const archive = path.join(root, '.local-tools/test-evidence');
  const evidence = path.join(archive, fs.readdirSync(archive)[0]);
  const report = JSON.parse(fs.readFileSync(path.join(evidence, 'report.json'), 'utf8'));
  assert.equal(report.stats.expected, 2);
  assert.equal(report.stats.unexpected, 0);
  assert.match(fs.readFileSync(path.join(evidence, 'console.log'), 'utf8'), /附件保存失败/);
});
