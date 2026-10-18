import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { legacyRevisionState } from './legacy-revisions.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, 'migration/source-manifest.json'), 'utf8'),
);
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const revisions = legacyRevisionState(root);
const approved = new Map([...revisions.values()].map((item) => [item.source, item.approvedSha256]));
const files = manifest.files.filter(
  (f) => f.target.startsWith('content/') || f.target.startsWith('public/'),
);
for (const f of files) {
  assert.equal(
    sha(path.join(root, f.target)),
    approved.get(f.target) || f.sha256,
    `Imported file changed: ${f.target}`,
  );
  if (fs.existsSync(manifest.source))
    assert.equal(
      sha(path.join(manifest.source, f.source)),
      f.sha256,
      `Original file changed: ${f.source}`,
    );
}
assert.equal(files.filter((f) => f.target.startsWith('content/legacy/posts/')).length, 3);
assert.equal(files.filter((f) => f.target.startsWith('content/legacy/pages/')).length, 1);
const optional = JSON.parse(
  fs.readFileSync(path.join(root, 'migration/optional-assets.json'), 'utf8'),
);
for (const file of optional.files)
  assert.equal(
    sha(path.join(root, file.target)),
    file.sha256,
    'Optional asset changed: ' + file.target,
  );
const baseline = JSON.parse(
  fs.readFileSync(path.join(root, 'migration/source-baseline.json'), 'utf8'),
);
if (fs.existsSync(manifest.source))
  for (const f of baseline)
    assert.equal(
      sha(path.join(manifest.source, f.path)),
      f.sha256,
      `Source baseline changed: ${f.path}`,
    );
console.log(
  JSON.stringify({
    importedFilesVerified: files.length,
    optionalAssetsVerified: optional.files.length,
    posts: 3,
    pages: 1,
    approvedRevisions: [...revisions.values()].reduce((n, item) => n + item.sequence, 0),
    originalSourceFiles: fs.existsSync(manifest.source)
      ? baseline.length
      : 'original directory unavailable; portable import hashes verified',
  }),
);
