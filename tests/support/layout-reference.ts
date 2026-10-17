import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export function assertFirefoxReference(reference: any, bytes: Buffer, file: string) {
  assert.equal(reference.engine, 'firefox');
  assert.equal(
    reference.status,
    'validated-repeatable',
    'Firefox geometry reference is not repeatable; release remains blocked. See docs/firefox-acceptance.md',
  );
  assert.equal(
    reference.records.find((r: { file: string }) => r.file === file)?.sha256,
    createHash('sha256').update(bytes).digest('hex'),
    'Firefox reference changed without review',
  );
  const baseline = JSON.parse(bytes.toString());
  assert.equal(baseline.engine, 'firefox', 'Firefox must never use another engine reference');
  return baseline;
}

export function layoutReference(group: 'motion-system' | 'sidebar-bottom', browserName: string) {
  if (browserName !== 'firefox') {
    const engine = browserName === 'webkit' ? 'webkit' : 'edge';
    return {
      engine,
      baseline: JSON.parse(fs.readFileSync(`docs/evidence/${group}/before-${engine}.json`, 'utf8')),
    };
  }
  const file = group === 'motion-system' ? 'motion.json' : 'sidebar.json';
  const bytes = fs.readFileSync(`tests/fixtures/firefox-layout/${file}`);
  const reference = JSON.parse(
    fs.readFileSync('tests/fixtures/firefox-layout/reference.json', 'utf8'),
  );
  const baseline = assertFirefoxReference(reference, bytes, file);
  return { engine: 'firefox', baseline };
}
