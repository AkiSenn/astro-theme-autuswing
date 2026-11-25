import { siteConfig, themeConfig } from './lib/config-loader.mjs';
import { siteIdentity } from './lib/site-identity.mjs';
import {
  normalizeMenu,
  navigationItems,
  normalizeFooter,
} from './lib/site-options';
import { imageUrl } from './lib/image-url.mjs';
import { getDeployment, mountReference, unmountPath } from './lib/deployment.mjs';
import { normalizeAppearance } from './lib/appearance-options';
import { normalizeLayout } from './lib/layout-options';
export { siteIdentity };
export const site = {
  ...siteConfig,
  ...siteIdentity,
  avatar: siteIdentity.profile.avatar && imageUrl(siteIdentity.profile.avatar),
  favicon: siteIdentity.favicon.map((icon) => icon && imageUrl(icon)),
  apple_touch_icon: siteIdentity.apple_touch_icon && imageUrl(siteIdentity.apple_touch_icon),
};
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
  appearance: normalizeAppearance(themeConfig.appearance),
  layout: normalizeLayout(
    'layout' in themeConfig ? themeConfig.layout : undefined,
    themeConfig.appearance.sidebar_width,
  ),
  footer,
  backgrounds,
} as Omit<typeof themeConfig, 'article' | 'footer' | 'appearance' | 'layout'> & {
  appearance: ReturnType<typeof normalizeAppearance<typeof themeConfig.appearance>>;
  layout: ReturnType<typeof normalizeLayout>;
  article: Omit<typeof themeConfig.article, 'excerpt'> & { excerpt: string | boolean };
  footer: typeof footer;
  backgrounds: string[];
};
// Preview is the default. Only an explicit production build changes crawl policy.
export const environment = getDeployment().mode;
export const preview = environment !== 'production';
export const navigation = navigationItems(normalizeMenu(site.menu), site.language).map((item) => {
  const href = mountReference(safeLink(item.path));
  const matchPath = href.startsWith('/') ? unmountPath(href) ?? href : href;
  return { ...item, href, matchPath };
});
export function isCurrentPath(path: string, href: string) {
  return href === '/'
    ? path === '/' || /^\/page\/\d+\/$/.test(path)
    : href.startsWith('/') &&
        (path === href || path.startsWith(href.endsWith('/') ? href : href + '/'));
}
export function safeLink(value: string) {
  return /^(https?:\/\/|mailto:|tel:|\/|#)/i.test(value) && !/^\/\//.test(value) ? value : '#';
}
