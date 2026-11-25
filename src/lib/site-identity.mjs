import fs from 'node:fs';
import path from 'node:path';
import { siteConfig as config } from './config-loader.mjs';

/** @typedef {{name: string, url: string, icon: string, label: string}} SocialLink */
/** @typedef {{label: string, url: string | undefined, icon: string | undefined}} Registration */
/** @typedef {Record<string, string | {path: string, icon?: string, new_tab?: boolean}>} Menu */

/** @param {string} field @param {string} reason @returns {never} */
function invalid(field, reason) {
  throw new TypeError(`src/config/site.yml: ${field} ${reason}`);
}

/** @param {unknown} value @param {string} field @returns {Record<string, unknown>} */
function object(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(field, 'must be an object');
  return /** @type {Record<string, unknown>} */ (value);
}

/** @param {unknown} value @param {string} field @param {boolean} [optional] */
function string(value, field, optional = false) {
  if (optional && value === undefined) return undefined;
  if (typeof value !== 'string' || !value.trim()) invalid(field, 'must be a non-empty string');
  return value.trim();
}

/** @param {unknown} value @param {string} field */
function required(value, field) {
  return /** @type {string} */ (string(value, field));
}

/** @param {unknown} value @param {string} field @returns {unknown[]} */
function list(value, field) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) invalid(field, 'must be an array');
  return value;
}

/** @param {string} value @param {string} field @param {{local?: boolean, contact?: boolean}} [options] */
function link(value, field, { local = false, contact = false } = {}) {
  if (/[\s\\\x00-\x1f\x7f]/u.test(value)) invalid(field, 'contains an unsafe URL character');
  if (local && value.startsWith('/') && !value.startsWith('//')) return value;
  const parsed = URL.parse(value);
  if (parsed && !parsed.username && !parsed.password) {
    if (/^https?:\/\//i.test(value) && parsed.hostname) return value;
    if (contact && /^(mailto:|tel:)$/i.test(parsed.protocol) && parsed.pathname) return value;
  }
  return invalid(field, 'must be a valid URL with an allowed scheme');
}

/** @param {unknown} value @param {string} field @param {string} publicRoot @param {boolean} [localOnly] */
function image(value, field, publicRoot, localOnly = false) {
  const source = string(value, field, true);
  if (!source) return undefined;
  link(source, field, { local: true });
  if (source.startsWith('/')) {
    let relative = '';
    try {
      relative = decodeURIComponent(source.split(/[?#]/, 1)[0]).slice(1);
    } catch {
      invalid(field, 'contains an invalid escaped image path');
    }
    if (!relative || /[\\:#?\x00-\x1f\x7f]/u.test(relative) ||
        relative.split('/').some(part => !part || part === '.' || part === '..'))
      invalid(field, 'must be a safe path under public/');
    const stat = fs.statSync(path.join(publicRoot, relative), { throwIfNoEntry: false });
    if (!stat?.isFile()) invalid(field, 'must refer to an existing file under public/');
  } else if (localOnly) {
    invalid(field, 'must be a local public image');
  }
  return source;
}

/** @param {unknown} value @returns {SocialLink[]} */
function socialLinks(value) {
  const names = new Set();
  const urls = new Set();
  return list(value, 'social').flatMap((value, index) => {
    const field = `social[${index}]`;
    const item = object(value, field);
    const name = required(item.name, field + '.name');
    const label = string(item.label, field + '.label', true) ?? name;
    const icon = string(item.icon, field + '.icon', true) ?? name;
    if (item.enabled !== undefined && typeof item.enabled !== 'boolean')
      invalid(field + '.enabled', 'must be a boolean');
    if (item.url !== undefined && typeof item.url !== 'string')
      invalid(field + '.url', 'must be a string');
    if (item.enabled === false || !item.url?.trim()) return [];
    const url = link(item.url.trim(), field + '.url', { local: true, contact: true });
    const key = name.toLowerCase();
    if (names.has(key) || urls.has(url)) invalid(field, 'duplicates an enabled social item');
    names.add(key);
    urls.add(url);
    return [{ name, label, url, icon }];
  });
}

/** @param {unknown} value @returns {Menu} */
function menuItems(value) {
  const entries = object(value, 'menu');
  return Object.fromEntries(Object.entries(entries).map(([name, value]) => {
    if (!name.trim()) invalid('menu', 'must have non-empty labels');
    const field = `menu.${name}`;
    if (typeof value === 'string') return [name, link(required(value, field), field, { local: true })];
    const item = object(value, field);
    if (item.new_tab !== undefined && typeof item.new_tab !== 'boolean')
      invalid(field + '.new_tab', 'must be a boolean');
    return [name, {
      path: link(required(item.path ?? item.url, field + '.path'), field + '.path', { local: true }),
      icon: string(item.icon, field + '.icon', true),
      new_tab: item.new_tab === true,
    }];
  }));
}

/** @param {unknown} input @param {string} [publicRoot] */
export function normalizeSiteIdentity(input, publicRoot = path.resolve('public')) {
  const data = object(input, 'identity');
  const author = required(data.author, 'author');
  const title = required(data.title, 'title');
  const language = required(data.language, 'language');
  const profile = object(data.profile ?? {}, 'profile');
  const footer = object(data.footer ?? {}, 'footer');
  const copyright = object(footer.copyright ?? {}, 'footer.copyright');
  const pwa = object(data.pwa ?? {}, 'pwa');
  const seo = object(data.seo ?? {}, 'seo');
  const runtime = data.runtime === undefined ? undefined : object(data.runtime, 'runtime');
  const homepage = string(profile.homepage, 'profile.homepage', true);
  const since = copyright.since;
  if (since !== undefined && (typeof since !== 'number' || !Number.isInteger(since) || since < 1 ||
      since > new Date().getFullYear())) invalid('footer.copyright.since', 'must be a valid year');
  const favicons = data.favicon === undefined ? [] : Array.isArray(data.favicon) ? data.favicon : [data.favicon];
  return {
    title, author, language,
    subtitle: string(data.subtitle, 'subtitle', true),
    description: required(data.description, 'description'),
    profile: {
      avatar: image(profile.avatar, 'profile.avatar', publicRoot),
      tagline: string(profile.tagline, 'profile.tagline', true),
      bio: string(profile.bio, 'profile.bio', true),
      homepage: homepage && link(homepage, 'profile.homepage'),
    },
    favicon: favicons.map((icon, i) => image(required(icon, `favicon[${i}]`), `favicon[${i}]`, publicRoot)),
    apple_touch_icon: image(data.apple_touch_icon, 'apple_touch_icon', publicRoot),
    menu: menuItems(data.menu),
    social: socialLinks(data.social),
    friends: list(data.friends, 'friends').map((value, i) => {
      const field = `friends[${i}]`;
      const friend = object(value, field);
      return { name: required(friend.name, field + '.name'),
        url: link(required(friend.url, field + '.url'), field + '.url', { local: true }),
        description: string(friend.description, field + '.description', true) };
    }),
    footer: {
      copyright: { holder: string(copyright.holder, 'footer.copyright.holder', true) ?? author, since },
      registrations: /** @type {Registration[]} */ (list(footer.registrations, 'footer.registrations').map((value, i) => {
        const field = `footer.registrations[${i}]`;
        const item = object(value, field);
        const url = string(item.url, field + '.url', true);
        return { label: required(item.label, field + '.label'),
          url: url && link(url, field + '.url'), icon: image(item.icon, field + '.icon', publicRoot) };
      })),
      statement: string(footer.statement, 'footer.statement', true),
      extra: string(footer.extra, 'footer.extra', true),
      custom_html: string(footer.custom_html, 'footer.custom_html', true),
    },
    runtime: runtime && { since: required(runtime.since, 'runtime.since'), text: string(runtime.text, 'runtime.text', true) },
    seo: { social_image: image(seo.social_image, 'seo.social_image', publicRoot),
      twitter: string(seo.twitter, 'seo.twitter', true) },
    pwa: { short_name: string(pwa.short_name, 'pwa.short_name', true) ?? title,
      icon: image(pwa.icon, 'pwa.icon', publicRoot, true) },
  };
}

/** @typedef {ReturnType<typeof normalizeSiteIdentity>} SiteIdentity */
export const siteIdentity = normalizeSiteIdentity(config);
