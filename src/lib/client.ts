import { theme, preview } from '../site.config';
import zh from '../config/zh-CN.json';
import en from '../config/default.json';
import vendor from '../../public/assets/vendor/manifest.json';
import type { Post } from './content';
export function clientConfig(post?: Post) {
  const math = post?.math ? structuredClone(theme.math) : null;
  if (math) {
    math.engine = post?.data.katex ? 'katex' : math.engine;
    if (math.source === 'local') {
      const base = (theme.assets.cdn || '').replace(/\/$/, '');
      const jax = base + '/assets/vendor/' + vendor.packages.mathjax.directory,
        font = base + '/assets/vendor/' + vendor.packages.newcm.directory,
        katex = base + '/assets/vendor/' + vendor.packages.katex.directory + '/dist';
      math.mathjax.cdn = jax + '/tex-mml-chtml.js';
      math.mathjax.config = {
        loader: { paths: { mathjax: jax } },
        chtml: { fontURL: font + '/chtml/woff2', dynamicPrefix: font + '/chtml/dynamic' },
        ...math.mathjax.config,
      };
      math.katex.cdn = katex + '/katex.min.js';
      math.katex.auto_render = katex + '/contrib/auto-render.min.js';
      math.katex.css = katex + '/katex.min.css';
    }
  }
  const labels = { ...(post?.lang?.startsWith('en') ? en : zh) } as Record<string, string>;
  return {
    root: '/',
    search: '/search.json',
    mode: theme.color_mode,
    searchLimit: theme.search.limit,
    searchOptions: theme.search,
    article: theme.article,
    animations: {
      ...theme.animations,
      enable: theme.animations.enable && theme.appearance.animate,
    },
    instantNav: theme.performance.instant_nav,
    pwa: theme.pwa.enable,
    analytics: preview ? {} : theme.analytics,
    math,
    labels: {
      ...labels,
      empty: labels.search_empty,
      loading: labels.search_loading,
      error: labels.search_error,
      shareError: labels.share_error,
    },
  };
}
