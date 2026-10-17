import identity from './config/site.json';
import themeConfig from './config/theme.json';
import { translate } from './lib/i18n';
import { imageUrl } from './lib/image-url.mjs';
import { buildMode } from './lib/build-mode.mjs';
export const site = identity;
type MenuValue = string | { path?: string; url?: string; icon?: string; new_tab?: boolean };
type SocialValue = string | { url?: string; path?: string; icon?: string };
const menu_items = Object.entries(themeConfig.menu as Record<string, MenuValue>).map(
  ([name, value]) => ({
    name,
    path: typeof value === 'string' ? value : value.path || value.url || '/',
    icon: typeof value === 'string' ? '' : value.icon || '',
    new_tab: typeof value === 'object' && value.new_tab === true,
  }),
);
const social_items = Object.entries(themeConfig.social as Record<string, SocialValue>)
  .filter(([, v]) => v)
  .map(([name, value]) => ({
    name,
    url: typeof value === 'string' ? value : value.url || value.path || '',
    icon: typeof value === 'string' ? name : value.icon || name,
  }));
if (themeConfig.profile.email && !social_items.some((item) => /^(email|mail)$/i.test(item.name)))
  social_items.push({
    name: 'Email',
    url: 'mailto:' + themeConfig.profile.email.replace(/^mailto:/, ''),
    icon: 'mail',
  });
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
  avatar: imageUrl(themeConfig.avatar),
  favicon: imageUrl(themeConfig.favicon),
  apple_touch_icon: imageUrl(themeConfig.apple_touch_icon),
  menu_items,
  social_items,
  backgrounds,
} as Omit<typeof themeConfig, 'article'> & {
  article: Omit<typeof themeConfig.article, 'excerpt'> & { excerpt: string | boolean };
  backgrounds: string[];
  menu_items: typeof menu_items;
  social_items: typeof social_items;
};
// Preview is the default. Only an explicit production build changes crawl policy.
export const environment = buildMode(process.env.SITE_ENV, import.meta.env.DEV);
export const preview = environment !== 'production';
export const navigation = theme.menu_items.map((item) => ({
  ...item,
  icon:
    item.icon ||
    (
      {
        Home: 'home',
        Archives: 'list',
        Tags: 'tag',
        Categories: 'folder',
        Links: 'link',
        About: 'user',
      } as Record<string, string>
    )[item.name] ||
    'globe',
  label: ['Home', 'Archives', 'Tags', 'Categories', 'Links', 'About'].includes(item.name)
    ? translate()(item.name.toLowerCase())
    : item.name,
}));
export function isCurrentPath(path: string, href: string) {
  return href === '/'
    ? path === '/'
    : href.startsWith('/') &&
        (path === href || path.startsWith(href.endsWith('/') ? href : href + '/'));
}
export function safeLink(value: string) {
  return /^(https?:\/\/|mailto:|tel:|\/|#)/i.test(value) && !/^\/\//.test(value) ? value : '#';
}
