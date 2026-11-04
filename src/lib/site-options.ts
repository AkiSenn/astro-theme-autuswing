import { translate } from './i18n';

export type MenuValue = string | { path?: string; url?: string; icon?: string; new_tab?: boolean };
export type SocialValue = string | { url?: string; path?: string; icon?: string } | boolean | null;
export interface MenuItem {
  name: string;
  path: string;
  icon: string;
  new_tab: boolean;
}
export interface SocialItem {
  name: string;
  url: string;
  icon: string;
}
export interface FooterOptions {
  powered_by: boolean;
  theme_name?: string;
  theme_url?: string;
}

export function normalizeFooter<T extends FooterOptions>(footer: T) {
  return {
    ...footer,
    theme_name: footer.theme_name ?? 'AutuSwing',
    theme_url: footer.theme_url ?? 'https://github.com/AkiSenn/astro-theme-autuswing',
  };
}

export function normalizeMenu(menu: Record<string, MenuValue>): MenuItem[] {
  return Object.entries(menu).map(([name, value]) => ({
    name,
    path: typeof value === 'string' ? value : value.path || value.url || '/',
    icon: typeof value === 'string' ? '' : value.icon || '',
    new_tab: typeof value === 'object' && value.new_tab === true,
  }));
}

export function normalizeSocial(social: Record<string, SocialValue>, email = ''): SocialItem[] {
  const items = Object.entries(social)
    .filter((entry): entry is [string, Exclude<SocialValue, boolean | null>] => {
      if (entry[1] === true)
        throw new TypeError(
          `social.${entry[0]} cannot be true; provide a link or use false to disable it`,
        );
      return Boolean(entry[1]);
    })
    .map(([name, value]) => ({
      name,
      url: typeof value === 'string' ? value : value.url || value.path || '',
      icon: typeof value === 'string' ? name : value.icon || name,
    }));
  if (email && !items.some((item) => /^(email|mail)$/i.test(item.name)))
    items.push({ name: 'Email', url: 'mailto:' + email.replace(/^mailto:/, ''), icon: 'mail' });
  return items;
}

const menuIcons = new Map([
  ['Home', 'home'],
  ['Archives', 'list'],
  ['Tags', 'tag'],
  ['Categories', 'folder'],
  ['Links', 'link'],
  ['About', 'user'],
]);

export function navigationItems(items: readonly MenuItem[], language: string) {
  const t = translate(language);
  return items.map((item) => ({
    ...item,
    icon: item.icon || menuIcons.get(item.name) || 'globe',
    label: menuIcons.has(item.name) ? t(item.name.toLowerCase()) : item.name,
  }));
}
