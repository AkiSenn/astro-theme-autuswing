import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { themeConfig as theme } from './config-loader.mjs';
import { getDeployment, unmountPath } from './deployment.mjs';

export function publicAssetFile(pathname) {
  const root = path.resolve('public') + path.sep;
  try {
    const file = path.resolve(root, '.' + decodeURIComponent(pathname));
    if (file.startsWith(root) && fs.statSync(file, { throwIfNoEntry: false })?.isFile()) return file;
  } catch (error) {
    if (!(error instanceof URIError)) throw error;
  }
}

// Older Markdown may contain pre-prefixed public files (including srcset).
// A valid logical file always wins; accept a legacy public URL only if it is unambiguous.
export function authoredAssetReference(value, deployment) {
  if (deployment.basePath === '/' || !value.startsWith('/') || value.startsWith('//')) return value;
  const pathname = value.split(/[?#]/, 1)[0];
  if (pathname.endsWith('/')) return value;
  const logical = unmountPath(pathname, deployment);
  return logical && !publicAssetFile(pathname) && publicAssetFile(logical)
    ? logical + value.slice(pathname.length)
    : value;
}

export function imageUrl(value, pagePath = '/', deployment = getDeployment()) {
  if (!theme.assets.image_fingerprint || !value || /^(?:https?:|data:|\/\/|#)/i.test(value))
    return value;
  const url = new URL(value, new URL(pagePath, deployment.origin));
  const file = publicAssetFile(url.pathname);
  if (!file) return value;
  const hash = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 12);
  const [base, fragment] = value.split('#'),
    [pathname, query] = base.split('?'),
    search = new URLSearchParams(query);
  search.set('v', hash);
  return pathname + '?' + search + (fragment ? '#' + fragment : '');
}
