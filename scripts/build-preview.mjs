import { execFileSync } from 'node:child_process';
execFileSync(process.execPath, ['node_modules/astro/bin/astro.mjs', 'build', ...process.argv.slice(2)], {
  stdio: 'inherit', env: { ...process.env, SITE_ENV: 'preview' },
});
