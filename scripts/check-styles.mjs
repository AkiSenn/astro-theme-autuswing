import { spawnSync } from 'node:child_process';

// Exercise the static output through the existing Node preview adapter.
// This task has no upload, web-server installation or deployment step.
const args = process.argv.slice(2);
if (args.some((arg) => arg.startsWith('--update-snapshots'))) {
  throw new Error(
    'verify:styles compares approved baselines. Update baselines separately after review.',
  );
}
if (process.platform !== 'win32') {
  throw new Error(
    'The approved screenshots use Windows Edge/WebKit and Windows fonts. Establish a separately reviewed baseline for this OS before pixel comparison.',
  );
}
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('Run this check through npm run verify:styles.');
for (const task of ['check', 'build', 'test:styles']) {
  const command = ['run', task, ...(task === 'test:styles' && args.length ? ['--', ...args] : [])];
  const result = spawnSync(process.execPath, [npmCli, ...command], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
