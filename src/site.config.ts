import identity from './config/site.json';
import themeConfig from './config/theme.json';
import {
  normalizeMenu,
  normalizeSocial,
  navigationItems,
  normalizeFooter,
} from './lib/site-options';
import { imageUrl } from './lib/image-url.mjs';
import { buildMode } from './lib/build-mode.mjs';
export const site = identity;
const menu_items = normalizeMenu(themeConfig.menu);
const social_items = normalizeSocial(themeConfig.social, themeConfig.profile.email);
const footer = normalizeFooter(themeConfig.footer);
const bg = themeConfig.appearance.background_image as boolean | number | string | string[];
const backgrounds = Array.isArray(bg)
  ? bg
  : typeof bg === 'number'
    ? Array.from({ length: Math.min(6, Math.max(0, bg)) }, (_, i) => `/background/bg-${i + 1}.webp`)
    : typeof bg === 'string' && bg
      ? [bg]
      : [];
export const theme = {
  ...themeConfig,
  footer,
  avatar: imageUrl(themeConfig.avatar),
  favicon: imageUrl(themeConfig.favicon),
  apple_touch_icon: imageUrl(themeConfig.apple_touch_icon),
  menu_items,
  social_items,
  backgrounds,
} as Omit<typeof themeConfig, 'article' | 'footer'> & {
  article: Omit<typeof themeConfig.article, 'excerpt'> & { excerpt: string | boolean };
  footer: typeof footer;
  backgrounds: string[];
  menu_items: typeof menu_items;
  social_items: typeof social_items;
};
// Preview is the default. Only an explicit production build changes crawl policy.
export const environment = buildMode(process.env.SITE_ENV, import.meta.env.DEV);
export const preview = environment !== 'production';
export const navigation = navigationItems(theme.menu_items, site.language);
export function isCurrentPath(path: string, href: string) {
  return href === '/'
    ? path === '/'
    : href.startsWith('/') &&
        (path === href || path.startsWith(href.endsWith('/') ? href : href + '/'));
}
export function safeLink(value: string) {
  return /^(https?:\/\/|mailto:|tel:|\/|#)/i.test(value) && !/^\/\//.test(value) ? value : '#';
}
