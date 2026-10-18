// Real release gates run in a private copy; never edit the author's articles.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { load } from 'cheerio';
import { contentHash } from './legacy-revisions.mjs';
import { importRevisionHistory } from './revision-fixture-git.mjs';

const original = process.cwd();
fs.mkdirSync('.local-tools', { recursive: true });
const root = fs.mkdtempSync(path.resolve('.local-tools/legacy-revision-fixtures-'));
for (const directory of [
  'src',
  'public',
  'content',
  'scripts',
  'migration',
  'templates',
  'deployment',
  'tests',
])
  fs.cpSync(path.join(original, directory), path.join(root, directory), { recursive: true });
for (const file of [
  'package.json',
  'package-lock.json',
  'astro.config.mjs',
  'tsconfig.json',
  '.gitattributes',
])
  fs.copyFileSync(path.join(original, file), path.join(root, file));
fs.symlinkSync(
  path.join(original, 'node_modules'),
  path.join(root, 'node_modules'),
  process.platform === 'win32' ? 'junction' : 'dir',
);
const report = { workspace: root, cases: [] };
function run(name, args, expected = true) {
  let output,
    success = true;
  try {
    output = execFileSync(process.execPath, args, {
      cwd: root,
      env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' },
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
  } catch (error) {
    success = false;
    output = (error.stdout || '') + (error.stderr || '') + '\n' + error.message;
  }
  fs.writeFileSync(path.join(root, name + '.log'), output);
  assert.equal(success, expected, `${name}: ${output.slice(-5000)}`);
  report.cases.push({ name, expected: expected ? 'success' : 'blocked', passed: true });
  console.log(name, expected ? 'passed' : 'correctly blocked');
  return output;
}
const git = (...args) =>
  execFileSync(
    'git',
    [
      '-c',
      'commit.gpgsign=false',
      '-c',
      `core.hooksPath=${path.join(root, '.empty-hooks')}`,
      '-c',
      'user.name=Revision fixture',
      '-c',
      'user.email=revision@example.invalid',
      ...args,
    ],
    { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true },
  );
git('init', '-b', 'codex/legacy-fixture');
importRevisionHistory(original, root);
const source = 'content/legacy/posts/网站笔记.md';
git('add', '--', source);
git('commit', '-m', 'Original historical fixture');
const file = path.join(root, source),
  raw = fs.readFileSync(file);
const manifest = fs.readFileSync(path.join(root, 'migration/source-manifest.json'));
const text = raw.toString();
const initialRecords = fs
  .readdirSync(path.join(root, 'migration/revisions'))
  .filter((n) => n.endsWith('.json')).length;
const changed =
  (text.match(/^updated:/m)
    ? text.replace(/^updated:.*$/m, 'updated: 2026-10-18T16:00:00+08:00')
    : text.replace('title: 网站笔记', 'title: 网站笔记\nupdated: 2026-10-18T16:00:00+08:00')) +
  '\n\nAPPROVED_REVISION_FIXTURE_CONTENT\n';
fs.writeFileSync(file, changed);
git('add', '--', source);
git('commit', '-m', 'Reviewed historical correction');
run('unapproved-content', ['scripts/verify-content.mjs'], false);
assert.equal(
  fs.readdirSync(path.join(root, 'migration/revisions')).filter((n) => n.endsWith('.json')).length,
  initialRecords,
);
const approval = [
  'scripts/approve-legacy-revision.mjs',
  '--id',
  '4c6caf67',
  '--from',
  contentHash(raw),
  '--to',
  contentHash(changed),
  '--reason',
  'Integration fixture: reviewed instruction correction',
  '--confirm',
  '4c6caf67',
];
run('explicit-approval', approval);
run('approved-integrity', ['scripts/verify-content.mjs']);
const output = run('approved-production-release', ['scripts/release.mjs']);
const candidate = output.match(/VERIFIED_RELEASE=(.+)/)?.[1].trim();
assert.ok(candidate, 'Release must produce a verified candidate');
const html = load(fs.readFileSync(path.join(candidate, 'site/post/4c6caf67/index.html'), 'utf8'));
assert.equal(html('link[rel=canonical]').attr('href'), 'https://akisenn.com/post/4c6caf67/');
assert.equal(
  html('meta[property="article:published_time"]').attr('content'),
  '2022-01-18T11:08:43.000Z',
);
assert.equal(
  html('meta[property="article:modified_time"]').attr('content'),
  '2026-10-18T08:00:00.000Z',
);
assert.ok(html('.prose').text().includes('APPROVED_REVISION_FIXTURE_CONTENT'));
assert.deepEqual(fs.readFileSync(path.join(root, 'migration/source-manifest.json')), manifest);
report.cases.push({
  name: 'published-body-new-updated-stable-id-url-date-and-original-manifest',
  passed: true,
});
fs.appendFileSync(file, '\nNot approved after the release.\n');
run('post-approval-edit', ['scripts/verify-content.mjs'], false);
run(
  'post-approval-output-check',
  [
    'node_modules/tsx/dist/cli.mjs',
    'scripts/verify-output.ts',
    '--root',
    path.join(candidate, 'site'),
    '--production',
  ],
  false,
);
report.candidate = candidate;
fs.writeFileSync(path.join(root, 'report.json'), JSON.stringify(report, null, 2));
console.log(`REVISION_REPORT=${path.join(root, 'report.json')}`);
