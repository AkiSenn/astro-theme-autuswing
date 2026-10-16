import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
const backup = 'E:/autuswing-backups/2026-10-16T00-59-43-724Z',
  source = 'E:/hexo-akisenn';
const manifest = JSON.parse(fs.readFileSync(path.join(backup, 'files.json'), 'utf8'));
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
for (const f of manifest)
  assert.equal(sha(path.join(source, f.path)), f.sha256, 'Original changed: ' + f.path);
const statuses = JSON.parse(fs.readFileSync('migration/git-status-baseline.json', 'utf8'));
for (const [repo, status] of Object.entries(statuses))
  assert.equal(
    execFileSync('git', ['-C', repo, 'status', '--porcelain=v1', '-z']).toString('utf8'),
    status,
    'Original Git status changed: ' + repo,
  );
const report = {
  checkedAt: new Date().toISOString(),
  originalFilesVerified: manifest.length,
  originalGitStatusesUnchanged: Object.keys(statuses),
  unchanged: true,
};
fs.writeFileSync('docs/evidence/source-integrity.json', JSON.stringify(report, null, 2) + '\n');
console.log(report);
