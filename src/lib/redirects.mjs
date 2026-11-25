import { redirectsConfig } from './config-loader.mjs';

/**
 * Returns configured redirect rules from src/config/redirects.yml.
 * @returns {{ from: string, to: string, status: number }[]}
 */
export function redirects(entries = redirectsConfig) {
  if (!entries) return [];
  if (!Array.isArray(entries)) {
    throw new TypeError('src/config/redirects.yml: must be a YAML list of redirect rules');
  }
  return entries.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new TypeError(`src/config/redirects.yml: redirects[${index}] must be an object`);
    }
    const from = typeof item.from === 'string' ? item.from.trim() : '';
    const to = typeof item.to === 'string' ? item.to.trim() : '';
    const status = item.status === undefined ? 301 : item.status;
    if (!from.startsWith('/') || from.startsWith('//')) {
      throw new TypeError(`src/config/redirects.yml: redirects[${index}].from must be a local path`);
    }
    if (!to.startsWith('/') || to.startsWith('//')) {
      throw new TypeError(`src/config/redirects.yml: redirects[${index}].to must be a local path`);
    }
    if (typeof status !== 'number' || !Number.isInteger(status) || status < 300 || status > 399) {
      throw new TypeError(`src/config/redirects.yml: redirects[${index}].status must be a 3xx integer`);
    }
    return { from, to, status };
  });
}
