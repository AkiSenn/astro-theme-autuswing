import { theme, preview } from '../site.config';
import zh from '../config/zh-CN.json';
import en from '../config/default.json';
import type { Post } from './content';
export function clientConfig(post?: Post) {
  const labels = { ...(post?.lang?.startsWith('en') ? en : zh) } as Record<string, string>;
  return {
    root: '/',
    search: '/search.json',
    mode: theme.color_mode,
    searchLimit: theme.search.limit,
    searchOptions: theme.search,
    article: theme.article,
    instantNav: theme.performance.instant_nav,
    pwa: theme.pwa.enable,
    analytics: preview ? {} : theme.analytics,
    labels: {
      ...labels,
      empty: labels.search_empty,
      loading: labels.search_loading,
      error: labels.search_error,
      shareError: labels.share_error,
    },
  };
}
