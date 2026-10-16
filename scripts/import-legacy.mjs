import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, 'migration/source-manifest.json'), 'utf8'),
);
const source = path.resolve(process.argv[2] || manifest.source),
  sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
for (const item of manifest.files.filter(
  (f) => f.target.startsWith('content/') || f.target.startsWith('public/'),
)) {
  const input = path.join(source, item.source),
    target = path.join(root, item.target);
  if (sha(input) !== item.sha256)
    throw new Error('Source does not match approved snapshot: ' + item.source);
  if (fs.existsSync(target)) {
    if (sha(target) !== item.sha256)
      throw new Error('Refuse to overwrite modified target: ' + item.target);
    continue;
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(input, target);
}
console.log('Imported snapshot verified; original input files are read-only.');
