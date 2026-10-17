import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { randomUUID } from 'node:crypto';
import { inputManifest, sha256, verifyFiles, verifyRelease } from './release-integrity.mjs';
import policy from '../deployment/release-policy.json' with { type: 'json' };

// Builds once into a new candidate directory. Neither dist nor a previous
// verified release is overwritten. READY is written only after every gate.
const root = process.cwd();
const { values } = parseArgs({ options: { output: { type: 'string' } } });
const base = path.resolve('.local-tools/releases');
const directory = path.resolve(
  values.output ||
    path.join(
      base,
      new Date().toISOString().replace(/[:.]/g, '-') + '-' + randomUUID().slice(0, 8),
    ),
);
if (!directory.startsWith(base + path.sep))
  throw new Error('Release output must be a new directory under .local-tools/releases/');
if (fs.existsSync(directory))
  throw new Error('Refusing to overwrite an existing release directory');
fs.mkdirSync(base, { recursive: true });
const lockFile = path.join(base, '.build-lock');
const lock = fs.openSync(lockFile, 'wx');
fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, directory }));
const site = path.join(directory, 'site');
const audit = path.join(directory, 'audit');
let inputs;
const env = {
  ...process.env,
  SITE_ENV: 'production',
  ASTRO_TELEMETRY_DISABLED: '1',
  ASTRO_PREVIEW_DRAFTS: '0',
};
const steps = [];
function run(name, args, extraEnv = {}) {
  const start = Date.now();
  try {
    const output = execFileSync(process.execPath, args, {
      cwd: root,
      env: { ...env, ...extraEnv },
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    });
    fs.writeFileSync(path.join(audit, name + '.log'), output);
    steps.push({ name, passed: true, elapsedMs: Date.now() - start });
    console.log(`${name}: passed`);
  } catch (error) {
    fs.writeFileSync(
      path.join(audit, name + '.log'),
      (error.stdout || '') + (error.stderr || '') + '\n' + error.message,
    );
    throw new Error(`${name} failed; see ${path.join(audit, name + '.log')}`);
  }
}
try {
  fs.mkdirSync(audit, { recursive: true });
  inputs = inputManifest(root);
  const npmCli =
    process.env.npm_execpath ||
    path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
  run('dependencies', [npmCli, 'ls', '--depth=0', '--json']);
  run('types', ['node_modules/astro/bin/astro.mjs', 'check']);
  run('content', ['node_modules/tsx/dist/cli.mjs', 'scripts/check-content.ts']);
  run('unit', [
    'node_modules/tsx/dist/cli.mjs',
    '--test',
    ...fs
      .readdirSync('tests')
      .filter((name) => name.endsWith('.test.ts'))
      .map((name) => 'tests/' + name),
  ]);
  run('historical-integrity', ['scripts/verify-content.mjs']);
  run('build', ['node_modules/astro/bin/astro.mjs', 'build', '--outDir', site]);
  const record = JSON.parse(fs.readFileSync('.astro/autuswing-build.json', 'utf8'));
  if (record.outputRoot !== site)
    throw new Error('Build record does not match the candidate directory');
  run('content-output', [
    'node_modules/tsx/dist/cli.mjs',
    'scripts/check-content.ts',
    '--output',
    '--out-dir',
    site,
  ]);
  run(
    'production-output',
    ['node_modules/tsx/dist/cli.mjs', 'scripts/verify-output.ts', '--root', site, '--production'],
    { OUTPUT_EVIDENCE_FILE: path.join(audit, 'output.json') },
  );
  if (JSON.stringify(inputs) !== JSON.stringify(inputManifest(root)))
    throw new Error('Inputs changed during release checks; candidate is not valid');
  verifyFiles(site, record.files);
  let git;
  try {
    if (
      path.resolve(
        execFileSync('git', ['rev-parse', '--show-toplevel'], {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
        }).trim(),
      ) !== root
    )
      throw new Error('Not the checkout root');
    git = {
      commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      status: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(),
    };
  } catch {
    git = { commit: null, status: 'No Git checkout; input hashes identify the build' };
  }
  const metadata =
    JSON.stringify(
      {
        version: 1,
        status: 'verified',
        checkedAt: new Date().toISOString(),
        git,
        runtime: { node: process.version, platform: process.platform, arch: process.arch },
        inputDigest: sha256(JSON.stringify(inputs)),
        checks: steps,
        build: record,
      },
      null,
      2,
    ) + '\n';
  fs.writeFileSync(path.join(directory, 'release.json'), metadata, { flag: 'wx' });
  fs.writeFileSync(path.join(directory, 'READY'), sha256(metadata) + '\n', { flag: 'wx' });
  verifyRelease(directory, policy);
  console.log(`VERIFIED_RELEASE=${directory}`);
} catch (error) {
  // Failed candidates never contain READY. Preserve logs for diagnosis.
  if (fs.existsSync(path.join(directory, 'READY'))) fs.unlinkSync(path.join(directory, 'READY'));
  if (fs.existsSync(audit)) fs.writeFileSync(path.join(audit, 'FAILED.txt'), String(error));
  throw error;
} finally {
  fs.closeSync(lock);
  fs.unlinkSync(lockFile);
}
