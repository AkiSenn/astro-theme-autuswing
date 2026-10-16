import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { markdownProcessor } from './src/lib/markdown.mjs';
import { staticArtifacts } from './scripts/static-artifacts.mjs';
import site from './src/config/site.json' with { type: 'json' };
import fs from 'node:fs';
import theme from './src/config/theme.json' with { type: 'json' };
export default defineConfig({
  site: site.url,
  output: 'static',
  trailingSlash: 'always',
  build: {
    format: 'directory',
    assetsPrefix: theme.assets.cdn || undefined,
  },
  devToolbar: { enabled: false },
  compressHTML: theme.performance.minify,
  vite: { build: { minify: theme.performance.minify, cssMinify: theme.performance.minify } },
  prerenderConflictBehavior: 'error',
  markdown: {
    processor: markdownProcessor(),
    syntaxHighlight: 'shiki',
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
      defaultColor: false,
      langAlias: { sh: 'bash', zsh: 'bash', gitignore: 'text' },
    },
  },
  integrations: [
    ...(theme.seo.sitemap
      ? [
          sitemap({
            filter: (page) => theme.seo.sitemap && !/(?:404|offline)(?:\.html|\/)/.test(page),
            serialize(item) {
              const manifest = JSON.parse(
                fs.readFileSync(new URL('./.astro/autuswing-routes.json', import.meta.url), 'utf8'),
              );
              const pathname = decodeURI(new URL(item.url).pathname).replace(/\/$/, '');
              const route = manifest.find((r) => r.path.replace(/\/$/, '') === pathname);
              if (!route || !route.indexable) return undefined;
              item.url = new URL(route.path, site.url).href;
              if (route.updated) item.lastmod = route.updated;
              return item;
            },
          }),
        ]
      : []),
    staticArtifacts(),
  ],
  server: { host: '127.0.0.1', port: 4322 },
});
