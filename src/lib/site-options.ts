import { translate } from './i18n';

export type MenuValue = string | { path?: string; url?: string; icon?: string; new_tab?: boolean };
export interface MenuItem {
  name: string;
  path: string;
  icon: string;
  new_tab: boolean;
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
