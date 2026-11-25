import { deploymentUrl } from './deployment.mjs';
export type UrlMetadata = { id?: unknown; abbrlink?: unknown; permalink?: unknown };
export const reservedIds = new Set(
  'post p posts archives tags categories links about page img assets _astro background 404 offline search rss atom sitemap robots manifest sw'.split(
    ' ',
  ),
);
export function persistentId(data: UrlMetadata) {
  const code =
    data.id !== undefined && data.id !== null && String(data.id) !== '' ? data.id : data.abbrlink;
  if (code === undefined || code === null || String(code) === '')
    throw new Error('Missing persistent post ID. Run npm run new-post; build never generates IDs.');
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(String(code))) throw new Error(`Invalid public ID: ${code}`);
  return String(code);
}
export function normalizePath(value: string): string {
  if (!value.startsWith('/') || value.startsWith('//') || /[?#\\\x00-\x1f]/.test(value))
    throw new Error(`Invalid local path: ${value}`);
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    throw new Error(`Invalid URL encoding: ${value}`);
  }
  if (
    /[?#\\\x00-\x1f]/.test(decoded) ||
    decoded.split('/').some((x) => x === '.' || x === '..') ||
    /%[a-f\d]{2}/i.test(decoded)
  )
    throw new Error(`Unsafe local path: ${value}`);
  const clean = decoded.replace(/\/+/g, '/').replace(/\/index\.html$/, '/');
  return /\.[a-z0-9]+$/i.test(clean) || clean.endsWith('/') ? clean : clean + '/';
}
export const collisionKey = (value: string) => normalizePath(value).toLocaleLowerCase('en-US');
export function publicPath(data: UrlMetadata, fallback?: string): string {
  if (data.permalink !== undefined && data.permalink !== '') {
    const value = String(data.permalink);
    if (/^[a-z][\w+.-]*:|^\/\//i.test(value)) throw new Error('Permalink must be a local path');
    return normalizePath(value.replace(/^(?!\/)/, '/'));
  }
  const code =
    data.id !== undefined && data.id !== null && String(data.id) !== '' ? data.id : data.abbrlink;
  if (code !== undefined && code !== null && String(code) !== '') {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(String(code))) throw new Error(`Invalid public ID: ${code}`);
    return `/post/${code}/`;
  }
  if (fallback) return normalizePath(fallback);
  throw new Error(
    'Missing persistent post ID. Run npm run new-post -- "title"; build never generates IDs.',
  );
}
export function newPostPath(data: UrlMetadata) {
  const id = persistentId(data);
  if (data.permalink) return publicPath(data);
  if (reservedIds.has(id.toLowerCase()))
    throw new Error(`New post ID conflicts with reserved route: ${id}`);
  return `/${id}/`;
}
export function assertUniquePaths(items: { path: string; source: string }[]) {
  const seen = new Map<string, string>(),
    physical = new Map<string, string>();
  for (const item of items) {
    const key = collisionKey(item.path),
      file = outputFile(item.path).toLocaleLowerCase('en-US');
    if (seen.has(key))
      throw new Error(`URL collision ${item.path}: ${seen.get(key)} / ${item.source}`);
    for (const [existing, source] of physical)
      if (file === existing || file.startsWith(existing + '/') || existing.startsWith(file + '/'))
        throw new Error(`Output collision ${item.path}: ${source} / ${item.source}`);
    seen.set(key, item.source);
    physical.set(file, item.source);
  }
}
export function outputFile(path: string) {
  const p = normalizePath(path).slice(1);
  return !p ? 'index.html' : p.endsWith('/') ? p + 'index.html' : p;
}
export const absolute = (path: string) => deploymentUrl(path);
