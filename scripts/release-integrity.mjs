import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { assertProductionUrl } from '../src/lib/build-mode.mjs';

export const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
export function walkFiles(root) {
  return fs
    .readdirSync(root, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name, 'en'))
    .flatMap((entry) => {
      assert.ok(
        !entry.isSymbolicLink(),
        `Symlink is not allowed in a release/input: ${entry.name}`,
      );
      const file = path.join(root, entry.name);
      return entry.isDirectory() ? walkFiles(file) : [file];
    });
}
export function fileManifest(root) {
  return walkFiles(root)
    .map((file) => ({
      file: path.relative(root, file).replaceAll('\\', '/'),
      bytes: fs.statSync(file).size,
      sha256: sha256(fs.readFileSync(file)),
    }))
    .sort((a, b) => a.file.localeCompare(b.file, 'en'));
}
export function inputManifest(root) {
  const directories = [
    'src',
    'public',
    'content',
    'scripts',
    'migration',
    'templates',
    'deployment',
    'tests',
  ];
  const files = directories.flatMap((dir) =>
    fs.existsSync(path.join(root, dir)) ? walkFiles(path.join(root, dir)) : [],
  );
  for (const file of [
    'astro.config.mjs',
    'package.json',
    'package-lock.json',
    'tsconfig.json',
    'playwright.config.ts',
    'playwright.styles.config.ts',
    'playwright.cross.config.ts',
    'playwright.nginx.config.ts',
  ])
    if (fs.existsSync(path.join(root, file))) files.push(path.join(root, file));
  return files
    .map((file) => ({
      file: path.relative(root, file).replaceAll('\\', '/'),
      sha256: sha256(fs.readFileSync(file)),
    }))
    .sort((a, b) => a.file.localeCompare(b.file, 'en'));
}
export function verifyFiles(root, expected) {
  assert.deepEqual(
    fileManifest(root),
    expected,
    'Final artifact changed: missing, added or modified files',
  );
}
export function verifyHttpBytes(build, uri, bytes) {
  const pathname = decodeURIComponent(new URL(uri, 'https://candidate.invalid').pathname).slice(1);
  const file = build.files.find(
    (file) =>
      file.file === pathname ||
      file.file ===
        (pathname.endsWith('/') || !pathname ? pathname : pathname + '/') + 'index.html',
  );
  if (!file) return false;
  assert.equal(sha256(bytes), file.sha256, `HTTP bytes differ from the verified candidate: ${uri}`);
  return true;
}
export function verifyRelease(directory, policy) {
  const metadata = fs.readFileSync(path.join(directory, 'release.json'));
  const ready = fs.readFileSync(path.join(directory, 'READY'), 'utf8').trim();
  assert.equal(ready, sha256(metadata), 'Release metadata changed or READY marker is invalid');
  const release = JSON.parse(metadata);
  assert.equal(release.version, 1, 'Unsupported release format');
  assert.equal(release.build.version, 1, 'Unsupported build record');
  assert.equal(release.status, 'verified');
  assert.equal(
    release.build.mode,
    'production',
    'Preview/development artifacts cannot be released',
  );
  assertProductionUrl(release.build.siteUrl, policy.productionUrl);
  assert.equal(release.build.policyHash, sha256(JSON.stringify(policy)), 'Release policy differs');
  assert.equal(
    release.inputDigest,
    sha256(JSON.stringify(release.build.inputs)),
    'Build input digest differs',
  );
  for (const name of [
    'dependencies',
    'types',
    'content',
    'unit',
    'historical-integrity',
    'build',
    'content-output',
    'production-output',
  ])
    assert.equal(
      release.checks.filter((check) => check.name === name && check.passed === true).length,
      1,
      `Missing successful release gate: ${name}`,
    );
  verifyFiles(path.join(directory, 'site'), release.build.files);
  return release;
}
