import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import theme from '../config/theme.json' with { type: 'json' };
export function imageUrl(value, pagePath = '/') {
  if (!theme.assets.image_fingerprint || !value || /^(?:https?:|data:|\/\/|#)/i.test(value))
    return value;
  const url = new URL(value, 'https://akisenn.com' + pagePath),
    root = path.resolve('public'),
    file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile())
    return value;
  const hash = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 12);
  const [base, fragment] = value.split('#'),
    [pathname, query] = base.split('?'),
    search = new URLSearchParams(query);
  search.set('v', hash);
  return pathname + '?' + search + (fragment ? '#' + fragment : '');
}
