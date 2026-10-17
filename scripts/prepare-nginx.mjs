import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { redirects } from '../src/lib/legacy-redirects.mjs';
import { verifyRelease } from './release-integrity.mjs';
import policy from '../deployment/release-policy.json' with { type: 'json' };

const { values } = parseArgs({
  options: {
    root: { type: 'string', default: path.resolve('dist') },
    output: { type: 'string', default: '.local-tools/nginx-config' },
    listen: { type: 'string', default: '127.0.0.1:8788' },
    mode: { type: 'string', default: 'preview' },
    'mime-types': { type: 'string' },
    release: { type: 'string' },
  },
});
if (!/^(?:127\.0\.0\.1|0\.0\.0\.0):\d{2,5}$/.test(values.listen))
  throw new Error('Use an explicit IPv4 listen address and port');
if (!['preview', 'production'].includes(values.mode)) throw new Error('Unknown build policy');
if (values.mode === 'production') {
  if (!values.release)
    throw new Error('Production Nginx requires --release <verified-candidate-directory>');
  const directory = path.resolve(values.release);
  verifyRelease(directory, policy);
  values.root = path.join(directory, 'site');
} else if (values.release)
  throw new Error('A verified production release must use --mode production');
if (Number(values.listen.split(':')[1]) > 65535) throw new Error('Invalid listen port');
if (!path.posix.isAbsolute(values.root) && !path.win32.isAbsolute(values.root))
  throw new Error('Use an absolute web root');
const output = path.resolve(values.output);
const quote = (value) => {
  if (/[\r\n\0]/.test(value)) throw new Error('Unsafe Nginx value');
  return value.replaceAll('\\', '/').replaceAll('$', '\\$').replaceAll('"', '\\"');
};
fs.mkdirSync(output, { recursive: true });
for (const directory of ['logs', 'temp'])
  fs.mkdirSync(path.join(output, directory), { recursive: true });
const redirectFile = path.join(output, 'redirects.conf');
const rules = redirects();
fs.writeFileSync(
  redirectFile,
  '# Generated from the historical URL manifest; preserves query strings.\n' +
    rules
      .map(
        (r) =>
          `location = "${quote(decodeURI(r.from))}" { return ${r.status} "${quote(r.to)}$is_args$args"; }`,
      )
      .join('\n') +
    '\n',
);
let template = fs.readFileSync('deployment/nginx/site.conf.template', 'utf8');
for (const [key, value] of Object.entries({
  LISTEN: values.listen,
  ROOT: quote(values.root),
  REDIRECTS: quote(redirectFile),
  ROBOTS: values.mode === 'preview' ? 'add_header X-Robots-Tag "noindex, nofollow" always;' : '',
}))
  template = template.replaceAll(`@@${key}@@`, value);
fs.writeFileSync(path.join(output, 'site.conf'), template);
if (values['mime-types']) {
  fs.writeFileSync(
    path.join(output, 'nginx.conf'),
    `worker_processes 1;\ndaemon off;\nerror_log "${quote(path.join(output, 'error.log'))}" info;\npid "${quote(path.join(output, 'nginx.pid'))}";\nevents { worker_connections 256; }\nhttp {\n include "${quote(path.resolve(values['mime-types']))}";\n default_type application/octet-stream;\n access_log off;\n include "${quote(path.join(output, 'site.conf'))}";\n}\n`,
  );
}
console.log({
  output,
  root: values.root,
  listen: values.listen,
  mode: values.mode,
  redirectRules: rules.length,
});
