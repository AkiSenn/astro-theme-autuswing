// Isolated Windows Nginx rehearsal. Never reads production credentials or connects remotely.
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { fileManifest, verifyFiles, verifyRelease, sha256 } from '../release-integrity.mjs';
import policy from '../../deployment/release-policy.json' with { type: 'json' };

const base = process.cwd();
const root = path.resolve(process.argv[2] || `.local-tools/release-drill-${Date.now()}`);
assert.ok(
  root.startsWith(path.join(base, '.local-tools') + path.sep),
  'Drill must stay in the local workspace scratch directory',
);
fs.mkdirSync(root, { recursive: false });
const nginx = path.resolve(process.env.DRILL_NGINX || '.local-tools/nginx-1.30.6/nginx.exe');
const candidates = {
  A: path.resolve(process.env.DRILL_BASE_RELEASE || '.local-tools/releases/autuswing-20261018-r4'),
  B: path.resolve(
    process.env.DRILL_NEXT_RELEASE ||
      '.local-tools/release-fixtures-vcbVHE/.local-tools/releases/fourth',
  ),
};
const historical = {
  root: path.resolve(
    process.env.DRILL_HISTORICAL_SITE || '.local-tools/release-audit-20261017/workspace/dist',
  ),
  files: JSON.parse(
    fs.readFileSync(
      process.env.DRILL_HISTORICAL_MANIFEST ||
        'docs/evidence/release-audit/2026-10-17/artifact-manifest.json',
    ),
  ).files,
};
// This older audit manifest used a different enumeration order; compare the complete
// identical path/length/SHA set using today's verifier ordering, without editing it.
historical.files.sort((a, b) => a.file.localeCompare(b.file, 'en'));
const report = {
  startedAt: new Date().toISOString(),
  scope: 'loopback-only; upload simulated by local copy; no production/ESA access',
  root,
  nginxVersion: spawnSync(nginx, ['-v'], { encoding: 'utf8', windowsHide: true }).stderr.trim(),
  steps: [],
  candidates: {},
};
const record = (name, details = {}) => {
  report.steps.push({ name, passed: true, ...details });
  console.log(name);
};
const save = () =>
  fs.writeFileSync(path.join(root, 'report.json'), JSON.stringify(report, null, 2));
process.on('exit', () => {
  if (!report.result) {
    report.result = 'incomplete; no activation certified';
    save();
  }
});
const q = (p) => p.replaceAll('\\', '/');
const run = (cmd, args, extra = {}) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8', windowsHide: true, ...extra });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')}: ${r.stderr}\n${r.stdout}`);
  return r;
};
const releases = {};
for (const [id, source] of Object.entries(candidates)) {
  const metadata = verifyRelease(source, policy),
    destination = path.join(root, 'releases', id);
  fs.cpSync(source, destination, { recursive: true, errorOnExist: true, force: false });
  verifyRelease(destination, policy);
  releases[id] = { directory: destination, metadata };
  report.candidates[id] = {
    source,
    sourceCommit: metadata.git.commit,
    READY: fs.readFileSync(path.join(source, 'READY'), 'utf8').trim(),
    files: metadata.build.files.length,
    siteSHA256: sha256(JSON.stringify(metadata.build.files)),
  };
  record(`upload-${id}-complete-set-and-SHA256`, { files: metadata.build.files.length });
}
// Reject altered, incomplete, extra and metadata-corrupted uploads before activation.
const rejected = path.join(root, 'rejected-upload');
fs.cpSync(releases.A.directory, rejected, { recursive: true });
const original = fs.readFileSync(path.join(rejected, 'site/index.html'));
for (const mutation of ['modified', 'missing', 'extra', 'metadata']) {
  const index = path.join(rejected, 'site/index.html'),
    extra = path.join(rejected, 'site/unexpected-drill-file'),
    meta = path.join(rejected, 'release.json'),
    metaBytes = fs.readFileSync(meta);
  if (mutation === 'modified') fs.appendFileSync(index, 'corrupt');
  if (mutation === 'missing') fs.unlinkSync(index);
  if (mutation === 'extra') fs.writeFileSync(extra, 'extra');
  if (mutation === 'metadata') fs.appendFileSync(meta, ' ');
  assert.throws(() => verifyRelease(rejected, policy));
  record(`blocked-${mutation}-upload`);
  fs.writeFileSync(index, original);
  if (fs.existsSync(extra)) fs.unlinkSync(extra);
  fs.writeFileSync(meta, metaBytes);
}
verifyFiles(historical.root, historical.files);
record('historical-audit-artifact-SHA256', {
  files: historical.files.length,
  certification: 'audit snapshot only; not a production-approved rollback candidate',
});
const pool = path.join(root, 'immutable-pool');
fs.mkdirSync(pool);
const immutable = (file) =>
  file.startsWith('_astro/') ||
  /^pwa\/.+\.[a-f0-9]{16}\.webp$/.test(file) ||
  /^assets\/vendor\/(katex|mathjax|newcm)\/[0-9][^/]+\//.test(file);
function addPool(source, files) {
  for (const entry of files.filter((f) => immutable(f.file))) {
    const dest = path.join(pool, entry.file),
      bytes = fs.readFileSync(path.join(source, entry.file));
    assert.equal(sha256(bytes), entry.sha256);
    if (fs.existsSync(dest))
      assert.equal(
        sha256(fs.readFileSync(dest)),
        entry.sha256,
        `Immutable path collision: ${entry.file}`,
      );
    else {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, bytes, { flag: 'wx' });
    }
  }
}
addPool(historical.root, historical.files);
for (const r of Object.values(releases))
  addPool(path.join(r.directory, 'site'), r.metadata.build.files);
const poolManifest = fileManifest(pool);
fs.writeFileSync(path.join(root, 'pool-manifest.json'), JSON.stringify(poolManifest, null, 2));
// Collision check against a separate single test file; never corrupts the real pool.
const canary = poolManifest[0],
  canarySource = path.join(root, 'collision-fixture');
fs.mkdirSync(path.dirname(path.join(canarySource, canary.file)), { recursive: true });
fs.writeFileSync(path.join(canarySource, canary.file), 'different bytes');
assert.throws(
  () => addPool(canarySource, [{ file: canary.file, sha256: sha256('different bytes') }]),
  /Immutable path collision/,
);
record('blocked-immutable-path-collision');
const probe = net.createServer();
await new Promise((r) => probe.listen(0, '127.0.0.1', r));
const port = probe.address().port;
await new Promise((r) => probe.close(r));
const origin = `http://127.0.0.1:${port}`,
  config = path.join(root, 'nginx');
run(process.execPath, [
  'scripts/prepare-nginx.mjs',
  '--release',
  releases.A.directory,
  '--mode',
  'production',
  '--output',
  config,
  '--listen',
  `127.0.0.1:${port}`,
  '--mime-types',
  path.resolve(process.env.DRILL_MIME_TYPES || '.local-tools/nginx-1.30.6/conf/mime.types'),
]);
const pointer = path.join(config, 'active-root.conf');
const contents = (id) =>
  `root "${q(path.join(releases[id].directory, 'site'))}";\nset $drill_release "${id}";\n`;
function writePointer(bytes) {
  const temp = pointer + '.next';
  fs.writeFileSync(temp, bytes);
  fs.renameSync(temp, pointer);
}
writePointer(contents('A'));
const site = path.join(config, 'site.conf');
let conf = fs.readFileSync(site, 'utf8');
conf = conf.replace(
  `root "${q(path.join(releases.A.directory, 'site'))}";`,
  `include "${q(pointer)}";\n    add_header X-Drill-Release $drill_release always;`,
);
// Test-only resource-pool fallback; the sealed roots themselves are not changed.
conf = conf.replace(
  /(location \^~ \/_astro\/ \{[\s\S]*?)try_files \$uri =404;/,
  '$1try_files $uri @retained_asset;',
);
conf = conf.replace(
  /(location ~ "\^\/pwa\/[\s\S]*?)try_files \$uri =404;/,
  '$1try_files $uri @retained_asset;',
);
conf = conf.replace(
  /(location ~ \^\/assets\/vendor\/[\s\S]*?)try_files \$uri =404;/,
  '$1try_files $uri @retained_asset;',
);
conf = conf.replace(
  '    location / {',
  `    location @retained_asset {\n        root "${q(pool)}";\n        try_files $uri =404;\n    }\n    location / {`,
);
fs.writeFileSync(site, conf);
const args = ['-p', q(config) + '/', '-c', 'nginx.conf'];
function syntax() {
  const r = run(nginx, [...args, '-t']);
  fs.appendFileSync(path.join(root, 'syntax.log'), r.stderr);
}
syntax();
const log = fs.openSync(path.join(root, 'nginx-console.log'), 'w');
const child = spawn(nginx, args, { windowsHide: true, stdio: ['ignore', log, log] });
const request = async (uri) => {
  const response = await fetch(origin + uri, {
    redirect: 'manual',
    headers: { Connection: 'close' },
  });
  return {
    status: response.status,
    headers: Object.fromEntries(response.headers),
    sha256: sha256(Buffer.from(await response.arrayBuffer())),
  };
};
async function waitFor(id) {
  const end = Date.now() + 10000;
  while (Date.now() < end) {
    try {
      const r = await request('/');
      if (
        r.status === 200 &&
        r.headers['x-drill-release'] === id &&
        r.sha256 === releases[id].metadata.build.files.find((f) => f.file === 'index.html').sha256
      )
        return;
    } catch {}
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`No healthy release ${id}`);
}
async function health(id, label) {
  await waitFor(id);
  const evidence = path.join(root, `${label}-http.json`);
  const r = run(process.execPath, ['scripts/verify-http.mjs', origin, '--production'], {
    env: {
      ...process.env,
      HTTP_RELEASE_DIR: releases[id].directory,
      HTTP_ASSET_ROOT: path.join(releases[id].directory, 'site'),
      HTTP_EVIDENCE_FILE: evidence,
    },
  });
  fs.writeFileSync(path.join(root, `${label}-http.log`), r.stdout + r.stderr);
  for (const uri of [
    '/READY',
    '/release.json',
    '/audit/',
    '/_headers',
    '/_redirects',
    '/redirects.json',
  ])
    assert.equal((await request(uri)).status, 404, uri);
  for (const entry of poolManifest) {
    const r = await request('/' + entry.file);
    assert.equal(r.status, 200, entry.file);
    assert.equal(r.sha256, entry.sha256, entry.file);
    assert.match(r.headers['cache-control'], /31536000, immutable/);
  }
  record(`${label}-health`, {
    release: id,
    httpChecks: JSON.parse(fs.readFileSync(evidence)).checks.length,
    retainedAssets: poolManifest.length,
  });
}
const observed = [];
let probing = false,
  probePromise;
function startProbes() {
  probing = true;
  probePromise = (async () => {
    while (probing) {
      const r = await request('/');
      assert.equal(r.status, 200);
      const id = r.headers['x-drill-release'];
      assert.ok(releases[id]);
      assert.equal(
        r.sha256,
        releases[id].metadata.build.files.find((f) => f.file === 'index.html').sha256,
      );
      observed.push(id);
      await new Promise((r) => setTimeout(r, 10));
    }
  })();
}
async function stopProbes() {
  probing = false;
  await probePromise;
}
try {
  await health('A', 'initial');
  const old = fs.readFileSync(pointer);
  writePointer('this_is_not_an_nginx_directive;\n');
  const bad = spawnSync(nginx, [...args, '-t'], { encoding: 'utf8', windowsHide: true });
  assert.notEqual(bad.status, 0);
  fs.writeFileSync(path.join(root, 'rejected-config.log'), bad.stderr);
  writePointer(old);
  await waitFor('A');
  record('invalid-config-rejected-without-reload');
  startProbes();
  writePointer(contents('B'));
  syntax();
  run(nginx, [...args, '-s', 'reload']);
  await health('B', 'switched');
  // Missing route is a genuine health failure. Rollback uses the original A package.
  await assert.rejects(async () =>
    assert.equal((await request('/drill-required-route-does-not-exist/')).status, 200),
  );
  record('health-failure-detected');
  writePointer(contents('A'));
  syntax();
  run(nginx, [...args, '-s', 'reload']);
  await health('A', 'rollback');
  assert.equal(
    (await request('/release4/')).status,
    404,
    'Version B route must be absent after rollback',
  );
  await stopProbes();
  record('concurrent-requests-no-500-no-mixed-release-body', {
    requests: observed.length,
    versions: [...new Set(observed)],
  });
  for (const [id, source] of Object.entries(candidates)) {
    verifyRelease(source, policy);
    verifyRelease(releases[id].directory, policy);
  }
  verifyFiles(historical.root, historical.files);
  verifyFiles(pool, poolManifest);
  record('all-source-uploaded-and-pooled-bytes-unchanged');
  report.finishedAt = new Date().toISOString();
  report.result = 'isolated drill passed; not production authorization';
} catch (error) {
  report.result = 'failed';
  report.error = String(error.stack || error);
  throw error;
} finally {
  if (probing)
    try {
      await stopProbes();
    } catch (error) {
      report.probeError = String(error);
    }
  try {
    run(nginx, [...args, '-s', 'quit']);
  } catch {}
  await Promise.race([
    once(child, 'exit'),
    new Promise((r) => {
      const t = setTimeout(r, 3000);
      t.unref();
    }),
  ]);
  if (child.exitCode === null) child.kill();
  fs.closeSync(log);
  save();
}
console.log(`Evidence: ${root}`);
