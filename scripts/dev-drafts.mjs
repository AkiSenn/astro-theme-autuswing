import { spawn } from 'node:child_process';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

export function startDraftPreview(args = [], environment = process.env, launch = spawn) {
  const { values } = parseArgs({
    args,
    options: { port: { type: 'string', default: '4322' } },
    strict: true,
    allowPositionals: false,
  });
  const port = Number(values.port);
  if (!/^\d+$/.test(values.port) || !Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('--port must be an integer from 1 to 65535');
  return launch(
    process.execPath,
    [
      fileURLToPath(new URL('../node_modules/astro/bin/astro.mjs', import.meta.url)),
      'dev',
      '--host',
      '127.0.0.1',
      '--port',
      String(port),
    ],
    {
      cwd: fileURLToPath(new URL('../', import.meta.url)),
      stdio: 'inherit',
      env: { ...environment, SITE_ENV: 'preview', ASTRO_PREVIEW_DRAFTS: '1' },
    },
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const child = startDraftPreview(process.argv.slice(2));
    child.on('error', (error) => {
      console.error(error);
      process.exitCode = 1;
    });
    child.on('exit', (code) => {
      process.exitCode = code ?? 1;
    });
  } catch (error) {
    console.error(`dev:drafts: ${error.message}`);
    process.exitCode = 1;
  }
}
