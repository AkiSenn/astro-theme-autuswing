// Isolated test copies need the same approved Git objects as the source checkout.
// Fetch only from the local project; never change the author's refs or files.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

export function importRevisionHistory(source, destination) {
  const directory = path.join(source, 'migration/revisions');
  const files = fs.existsSync(directory)
    ? fs.readdirSync(directory).filter((n) => n.endsWith('.json'))
    : [];
  if (!files.length) return;
  const git = (...args) =>
    execFileSync('git', args, {
      cwd: destination,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  if (!fs.existsSync(path.join(destination, '.git'))) git('init', '-b', 'codex/revision-fixture');
  const commits = new Set(
    files.map((file) => JSON.parse(fs.readFileSync(path.join(directory, file), 'utf8')).commit),
  );
  for (const commit of commits) {
    assert.match(commit, /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/);
    git('fetch', '--quiet', '--no-tags', path.resolve(source), commit);
  }
}
