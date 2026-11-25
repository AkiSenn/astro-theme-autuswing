import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { markdownProcessor } from './src/lib/markdown.mjs';
import { staticArtifacts } from './scripts/static-artifacts.mjs';
import { deploymentUrl, unmountPath } from './src/lib/deployment.mjs';
import fs from 'node:fs';
import { siteIdentity } from './src/lib/site-identity.mjs';
import {
  loadOptionalYamlFile,
  loadYamlFile,
  themeConfig as theme,
} from './src/lib/config-loader.mjs';

const artifacts = staticArtifacts({ markdownProcessor });
const avatar = siteIdentity.profile.avatar?.split(/[?#]/, 1)[0];
export default defineConfig({
  output: 'static',
  trailingSlash: 'always',
  build: {
    format: 'directory',
    assetsPrefix: theme.assets.cdn || undefined,
  },
  devToolbar: { enabled: false },
  compressHTML: theme.performance.minify,
  // Native imported Markdown images get responsive variants. Public /img URLs
  // remain untouched; the established prose CSS owns their presentation.
  image: { layout: 'constrained', responsiveStyles: false },
  // Keep CSS minification from rewriting min/max queries into Safari 16.4+
  // range syntax. JavaScript's target and all visual declarations stay intact.
  vite: {
    plugins: [{
      name: 'autuswing-configured-avatar',
      resolveId(id) {
        if (id === 'virtual:autuswing-avatar') return '\0' + id;
      },
      load(id) {
        if (id !== '\0virtual:autuswing-avatar') return;
        // Import only the configured raster; public assets already ship as-is.
        if (avatar?.startsWith('/') && /\.(?:png|jpe?g|webp)$/i.test(avatar))
          return 'export { default } from ' + JSON.stringify('/public' + decodeURIComponent(avatar));
        return 'export default undefined';
      },
    }, {
      name: 'autuswing-config-loader',
      load(id) {
        if (!id.replaceAll('\\', '/').endsWith('/src/lib/config-loader.mjs')) return;
        const dir = new URL('./src/config/', import.meta.url);
        return [
          "import fs from 'node:fs';",
          "import { load, JSON_SCHEMA } from 'js-yaml';",
          'export function loadYamlFile(filePath) { return load(fs.readFileSync(filePath, "utf8"), { schema: JSON_SCHEMA }); }',
          'export function loadOptionalYamlFile(filePath, fallback) { if (!fs.existsSync(filePath)) return fallback; const v = loadYamlFile(filePath); return v === undefined || v === null ? fallback : v; }',
          `export const siteConfig = ${JSON.stringify(loadYamlFile(new URL('site.yml', dir)))};`,
          `export const themeConfig = ${JSON.stringify(loadYamlFile(new URL('theme.yml', dir)))};`,
          `export const environmentsConfig = ${JSON.stringify(loadYamlFile(new URL('environments.yml', dir)))};`,
          `export const redirectsConfig = ${JSON.stringify(loadOptionalYamlFile(new URL('redirects.yml', dir), []))};`,
        ].join('\n');
      },
      configureServer(server) {
        server.watcher.on('change', (file) => {
          if (/[/\\]src[/\\]config[/\\][^/\\]+\.ya?ml$/i.test(file)) server.restart();
        });
      },
    }],
    build: {
      minify: theme.performance.minify,
      cssMinify: theme.performance.minify,
      cssTarget: 'safari14',
    },
  },
  prerenderConflictBehavior: 'error',
  markdown: {
    syntaxHighlight: 'shiki',
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
      defaultColor: false,
      langAlias: { sh: 'bash', zsh: 'bash', gitignore: 'text' },
    },
  },
  integrations: [
    artifacts.configuration,
    ...(theme.seo.sitemap
      ? [
          sitemap({
            filter: (page) => theme.seo.sitemap && !/(?:404|offline)(?:\.html|\/)/.test(page),
            serialize(item) {
              const manifest = JSON.parse(
                fs.readFileSync(new URL('./.astro/autuswing-routes.json', import.meta.url), 'utf8'),
              );
              const deployment = artifacts.deployment();
              const publicPath = decodeURI(new URL(item.url).pathname);
              const pathname = unmountPath(publicPath, deployment)?.replace(/\/$/, '');
              const route = manifest.find((r) => r.path.replace(/\/$/, '') === pathname);
              if (!route || !route.indexable) return undefined;
              item.url = deploymentUrl(route.path, deployment);
              if (route.updated) item.lastmod = route.updated;
              return item;
            },
          }),
        ]
      : []),
    artifacts,
  ],
  server: { host: '127.0.0.1', port: 4322 },
});
