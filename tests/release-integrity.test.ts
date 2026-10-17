import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { buildMode, assertProductionUrl } from '../src/lib/build-mode.mjs';
import { fileManifest, verifyFiles, verifyRelease, sha256 } from '../scripts/release-integrity.mjs';

test('build modes are explicit; production requires the approved HTTPS origin', () => {
  assert.equal(buildMode(undefined, true), 'development');
  assert.equal(buildMode(undefined), 'preview');
  assert.equal(buildMode('production'), 'production');
  assert.throws(() => buildMode('prod'), /Unknown/);
  for (const url of ['http://akisenn.com', 'https://preview.akisenn.com', 'https://akisenn.com/blog', 'https://user@akisenn.com', 'https://akisenn.com/?x=1'])
    assert.throws(() => assertProductionUrl(url, 'https://akisenn.com'));
  assert.doesNotThrow(() => assertProductionUrl('https://akisenn.com', 'https://akisenn.com'));
});

test('release seal detects missing, changed, extra files and metadata; older packages remain verifiable', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'autuswing-seal-'));
  try {
    const site = path.join(root, 'site'); fs.mkdirSync(site);
    fs.writeFileSync(path.join(site, 'index.html'), 'candidate A');
    const files = fileManifest(site);
    const policy = { productionUrl: 'https://akisenn.com', noindexPaths: ['/404.html', '/offline.html'] };
    const release = { status: 'verified', build: { mode: 'production', siteUrl: policy.productionUrl, policyHash: sha256(JSON.stringify(policy)), files } };
    const seal = () => { const json = JSON.stringify(release); fs.writeFileSync(path.join(root, 'release.json'), json); fs.writeFileSync(path.join(root, 'READY'), sha256(json)); };
    seal(); assert.doesNotThrow(() => verifyRelease(root, policy));
    fs.writeFileSync(path.join(site, 'index.html'), 'candidate B');
    assert.throws(() => verifyRelease(root, policy), /artifact changed/);
    fs.unlinkSync(path.join(site, 'index.html')); assert.throws(() => verifyFiles(site, files));
    fs.writeFileSync(path.join(site, 'index.html'), 'candidate A');
    fs.writeFileSync(path.join(site, 'stale.html'), 'old page'); assert.throws(() => verifyRelease(root, policy));
    fs.unlinkSync(path.join(site, 'stale.html')); assert.doesNotThrow(() => verifyRelease(root, policy));
    release.build.mode = 'preview'; seal(); assert.throws(() => verifyRelease(root, policy), /Preview/);
    release.build.mode = 'production'; seal();
    fs.appendFileSync(path.join(root, 'release.json'), ' '); assert.throws(() => verifyRelease(root, policy), /metadata changed/);
    seal(); assert.doesNotThrow(() => verifyRelease(root, policy));
    fs.unlinkSync(path.join(root, 'READY')); assert.throws(() => verifyRelease(root, policy));
  } finally {
    assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(root, { recursive: true });
  }
});
