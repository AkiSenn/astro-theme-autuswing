import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const child = spawn(
  process.execPath,
  [
    fileURLToPath(new URL('../node_modules/astro/bin/astro.mjs', import.meta.url)),
    'dev',
    '--host',
    '127.0.0.1',
    ...(!args.includes('--port') ? ['--port', '4322'] : []),
    ...args,
  ],
  {
    cwd: fileURLToPath(new URL('../', import.meta.url)),
    stdio: 'inherit',
    env: { ...process.env, ASTRO_PREVIEW_DRAFTS: '1' },
  },
);
child.on('error', (error) => {
  console.error(error);
  process.exitCode = 1;
});
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
