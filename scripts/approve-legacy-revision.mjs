import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { contentHash, legacyRevisionState } from './legacy-revisions.mjs';

export function approveRevision({ root, id, from, to, reason, confirm, now = new Date() }) {
  assert.equal(confirm, id, 'Explicit --confirm <article ID> is required');
  assert.ok(typeof reason === 'string' && reason.trim(), 'A nonempty change reason is required');
  const item = legacyRevisionState(root, { checkCurrent: false }).get(id);
  assert.ok(item, `Unknown historical ID: ${id}`);
  assert.equal(from, item.approvedSha256, '--from does not match the previous approved version');
  assert.equal(to, item.currentSha256, '--to does not match the reviewed current file');
  assert.notEqual(to, from, 'No content change to approve');
  // Never let approving one article silently approve changes in other articles.
  for (const other of legacyRevisionState(root, { checkCurrent: false }).values())
    if (other.id !== id)
      assert.equal(
        other.currentSha256,
        other.approvedSha256,
        `Other unapproved historical content: ${other.id}`,
      );
  const git = (...args) => execFileSync('git', args, { cwd: root, windowsHide: true });
  assert.equal(
    fs.realpathSync.native(git('rev-parse', '--show-toplevel').toString().trim()),
    fs.realpathSync.native(root),
    'Approval must run at the Git checkout root',
  );
  const commit = git('rev-parse', '--verify', 'HEAD').toString().trim();
  assert.equal(
    contentHash(git('show', `${commit}:${item.source}`)),
    to,
    'Commit the reviewed article before approving it',
  );
  const approvedAt = now.toISOString();
  assert.ok(!item.approvedAt || approvedAt >= item.approvedAt, 'Revision time runs backwards');
  const sequence = item.sequence + 1;
  assert.ok(sequence <= 999999, 'Revision sequence exhausted');
  const record = {
    version: 1,
    id,
    source: item.source,
    sequence,
    previousSha256: from,
    approvedSha256: to,
    reason: reason.trim(),
    approvedAt,
    commit,
  };
  const directory = path.join(root, 'migration/revisions');
  fs.mkdirSync(directory, { recursive: true });
  const target = path.join(directory, `${id}.${String(sequence).padStart(6, '0')}.json`);
  fs.writeFileSync(target, JSON.stringify(record, null, 2) + '\n', { flag: 'wx' });
  return target;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({
    options: Object.fromEntries(
      ['id', 'from', 'to', 'reason', 'confirm'].map((k) => [k, { type: 'string' }]),
    ),
  });
  const root = fileURLToPath(new URL('../', import.meta.url));
  assert.ok(values.id, 'Pass --id <historical article ID>');
  if (!values.confirm) {
    assert.ok(
      !values.from && !values.to && !values.reason,
      'Approval requires explicit --confirm <article ID>',
    );
    const item = legacyRevisionState(root, { checkCurrent: false }).get(values.id);
    assert.ok(item, 'Unknown historical ID');
    console.log(
      JSON.stringify(
        {
          id: item.id,
          source: item.source,
          from: item.approvedSha256,
          to: item.currentSha256,
          changed: item.approvedSha256 !== item.currentSha256,
          action:
            'Review git diff, commit the article, then supply --from, --to, --reason and --confirm; nothing written',
        },
        null,
        2,
      ),
    );
  } else console.log(approveRevision({ root, ...values }));
}
