import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { approveRevision } from '../scripts/approve-legacy-revision.mjs';
import { legacyRevisionState, contentHash } from '../scripts/legacy-revisions.mjs';
import { importRevisionHistory } from '../scripts/revision-fixture-git.mjs';

function workspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'autuswing-revision-'));
  const source = 'content/legacy/posts/original.md';
  fs.mkdirSync(path.join(root, 'content/legacy/posts'), { recursive: true });
  fs.mkdirSync(path.join(root, 'migration'));
  const original =
    "---\ntitle: Original\nabbrlink: 'old123'\ndate: 2020-01-02 08:00:00\n---\n\nOriginal body.\n";
  fs.writeFileSync(path.join(root, source), original);
  fs.writeFileSync(
    path.join(root, 'migration/source-manifest.json'),
    JSON.stringify({
      files: [
        { source: 'source/_posts/original.md', target: source, sha256: contentHash(original) },
      ],
    }),
  );
  fs.writeFileSync(
    path.join(root, 'migration/effective-metadata.json'),
    JSON.stringify([
      {
        source: '_posts/original.md',
        abbrlink: 'old123',
        path: '/post/old123/',
        date: '2020-01-02T00:00:00.000Z',
        updated: '2020-01-03T00:00:00.000Z',
      },
    ]),
  );
  const git = (...args: string[]) =>
    execFileSync(
      'git',
      [
        '-c',
        'core.autocrlf=false',
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
      { cwd: root, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
    ).trim();
  git('init', '-b', 'codex/revision-fixture');
  git('add', '.');
  git('commit', '-m', 'Original import');
  const manifest = fs.readFileSync(path.join(root, 'migration/source-manifest.json'));
  const edit = (text = original + '\nReviewed correction.\n') =>
    fs.writeFileSync(path.join(root, source), text);
  const commit = () => {
    git('add', source);
    git('commit', '-m', 'Review content revision');
  };
  const approve = (extra: Record<string, unknown> = {}) =>
    approveRevision({
      root,
      id: 'old123',
      confirm: 'old123',
      from: legacyRevisionState(root, { checkCurrent: false }).get('old123')!.approvedSha256,
      to: contentHash(fs.readFileSync(path.join(root, source))),
      reason: 'Correct an outdated instruction',
      now: new Date('2026-10-18T06:00:00Z'),
      ...extra,
    });
  return {
    root,
    source,
    original,
    manifest,
    git,
    edit,
    commit,
    approve,
    close() {
      assert.ok(
        path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep + 'autuswing-revision-'),
      );
      fs.rmSync(root, { recursive: true, force: true });
    },
  };
}

test('approved revisions extend immutable original evidence and preserve identity across a chain', () => {
  const w = workspace();
  try {
    w.edit(
      w.original.replace(
        'date: 2020-01-02 08:00:00',
        'date: 2020-01-02 08:00:00\nupdated: 2026-10-18T14:00:00+08:00',
      ) + '\nCorrection one.\n',
    );
    w.commit();
    const first = w.approve();
    const bytes = fs.readFileSync(first);
    const originalHash = contentHash(w.original);
    const one = legacyRevisionState(w.root).get('old123')!;
    assert.equal(one.sequence, 1);
    assert.equal(one.originalSha256, originalHash);
    assert.equal(one.historical.path, '/post/old123/');
    assert.equal(one.historical.date, '2020-01-02T00:00:00.000Z');
    assert.equal(one.updated, '2026-10-18T06:00:00.000Z');
    w.edit(fs.readFileSync(path.join(w.root, w.source), 'utf8') + '\nCorrection two.\n');
    w.commit();
    const second = w.approve({ now: new Date('2026-10-18T07:00:00Z') });
    const record = JSON.parse(fs.readFileSync(second, 'utf8'));
    assert.equal(record.previousSha256, one.approvedSha256);
    assert.equal(record.id, 'old123');
    assert.equal(record.reason, 'Correct an outdated instruction');
    assert.equal(record.approvedAt, '2026-10-18T07:00:00.000Z');
    assert.equal(record.commit, w.git('rev-parse', 'HEAD'));
    assert.deepEqual(fs.readFileSync(first), bytes);
    assert.deepEqual(
      fs.readFileSync(path.join(w.root, 'migration/source-manifest.json')),
      w.manifest,
    );
    assert.equal(legacyRevisionState(w.root).get('old123')!.sequence, 2);
  } finally {
    w.close();
  }
});

test('unapproved edits are rejected without writing approval records or accepting a new hash', () => {
  const w = workspace();
  try {
    w.edit();
    assert.throws(() => legacyRevisionState(w.root), /Unapproved historical content/);
    assert.equal(fs.existsSync(path.join(w.root, 'migration/revisions')), false);
    assert.deepEqual(
      fs.readFileSync(path.join(w.root, 'migration/source-manifest.json')),
      w.manifest,
    );
  } finally {
    w.close();
  }
});

test('isolated release copies retain approval provenance without using the author checkout', () => {
  const w = workspace();
  const copy = fs.mkdtempSync(path.join(os.tmpdir(), 'autuswing-revision-copy-'));
  try {
    w.edit();
    w.commit();
    w.approve();
    for (const directory of ['content', 'migration'])
      fs.cpSync(path.join(w.root, directory), path.join(copy, directory), { recursive: true });
    assert.throws(() => legacyRevisionState(copy));
    importRevisionHistory(w.root, copy);
    assert.equal(legacyRevisionState(copy).get('old123')!.sequence, 1);
    fs.appendFileSync(path.join(copy, w.source), '\nUnapproved copy edit.\n');
    assert.throws(() => legacyRevisionState(copy), /Unapproved/);
    assert.doesNotThrow(() => legacyRevisionState(w.root));
  } finally {
    w.close();
    assert.ok(
      path
        .resolve(copy)
        .startsWith(path.resolve(os.tmpdir()) + path.sep + 'autuswing-revision-copy-'),
    );
    fs.rmSync(copy, { recursive: true, force: true });
  }
});

test('approval requires explicit confirmation, reviewed hashes, reason and committed content', () => {
  const w = workspace();
  try {
    w.edit();
    assert.throws(() => w.approve(), /Commit the reviewed article/);
    w.commit();
    for (const [extra, message] of [
      [{ confirm: undefined }, /confirm/],
      [{ confirm: 'other' }, /confirm/],
      [{ reason: ' ' }, /reason/],
      [{ from: '0'.repeat(64) }, /--from/],
      [{ to: '0'.repeat(64) }, /--to/],
    ] as const)
      assert.throws(() => w.approve(extra), message);
    const record = w.approve();
    assert.ok(fs.existsSync(record));
    assert.throws(() => w.approve(), /No content change/);
  } finally {
    w.close();
  }
});

test('approval cannot change the original ID, permalink or publication date', () => {
  const w = workspace();
  try {
    for (const changed of [
      w.original.replace('old123', 'new123'),
      w.original.replace('title: Original', 'title: Original\nid: new123'),
      w.original.replace('title: Original', 'title: Original\npermalink: /another/'),
      w.original.replace('2020-01-02', '2021-01-02'),
    ]) {
      w.edit(changed);
      w.commit();
      assert.throws(() => w.approve(), /Historical/);
      assert.throws(() => legacyRevisionState(w.root), /Historical/);
    }
  } finally {
    w.close();
  }
});

test('malformed approval records, wrong IDs, chain hashes and times fail closed', () => {
  const w = workspace();
  try {
    w.edit();
    w.commit();
    const file = w.approve();
    const approved = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const changed of [
      { ...approved, version: 2 },
      { ...approved, id: 'missing' },
      { ...approved, source: 'content/legacy/posts/other.md' },
      { ...approved, sequence: 2 },
      { ...approved, previousSha256: '0'.repeat(64) },
      { ...approved, approvedSha256: '0'.repeat(64) },
      { ...approved, reason: '' },
      { ...approved, approvedAt: '2026-02-30T00:00:00Z' },
      { ...approved, commit: 'wrong' },
      { ...approved, commit: '0'.repeat(40) },
      { ...approved, extra: true },
    ]) {
      fs.writeFileSync(file, JSON.stringify(changed));
      assert.throws(() => legacyRevisionState(w.root));
    }
    fs.writeFileSync(file, '{');
    assert.throws(() => legacyRevisionState(w.root));
    fs.writeFileSync(file, JSON.stringify(approved));
    assert.doesNotThrow(() => legacyRevisionState(w.root));
    w.edit(w.original + '\nAnother correction.\n');
    w.commit();
    assert.throws(() => w.approve({ now: new Date('2026-10-17T00:00:00Z') }), /backwards/);
    assert.throws(() => legacyRevisionState(w.root), /Unapproved/);
  } finally {
    w.close();
  }
});
