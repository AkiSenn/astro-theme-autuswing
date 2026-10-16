import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
const root = path.resolve('dist');
function snapshot(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory()
        ? snapshot(path.join(dir, e.name))
        : [
            {
              path: path.relative(root, path.join(dir, e.name)).replaceAll('\\', '/'),
              sha256: crypto
                .createHash('sha256')
                .update(fs.readFileSync(path.join(dir, e.name)))
                .digest('hex'),
            },
          ],
    )
    .sort((a, b) => a.path.localeCompare(b.path));
}
const build = () =>
  execFileSync(process.execPath, ['node_modules/astro/bin/astro.mjs', 'build'], {
    stdio: 'pipe',
    env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' },
  });
build();
const first = snapshot(root);
build();
const second = snapshot(root);
assert.deepEqual(second, first, 'Consecutive builds must preserve route/content/asset hashes');
const report = { checkedAt: new Date().toISOString(), files: first.length, identical: true };
fs.writeFileSync('docs/evidence/reproducible-build.json', JSON.stringify(report, null, 2) + '\n');
console.log(report);
