import { posts, pages, taxonomy, type Post } from './content';
import { assertUniquePaths, collisionKey } from './urls';
import { redirects } from './redirects.mjs';
import { site } from '../site.config';
import { getDeployment } from './deployment.mjs';
import fs from 'node:fs';
import path from 'node:path';
import type { PaginateFunction } from 'astro';
import { translate } from './i18n';
import { getCollection } from 'astro:content';
import { isPublished } from './content-schema';
import { persistentId, publicPath, newPostPath } from './urls';
import { environment, theme } from '../site.config';
import { listingRoutes } from './listing';
export type Route = {
  path: string;
  title: string;
  kind: 'post' | 'page' | 'archive' | 'taxonomy' | 'links' | 'home';
  post?: Post;
  posts?: Post[];
  totalItems?: number;
  page?: number;
  totalPages?: number;
  base?: string;
  taxonomyKind?: 'tags' | 'categories';
};
export async function routes(paginate: PaginateFunction) {
  const t = translate();
  const all = await posts(),
    standalone = await pages(),
    routes: Route[] = [];
  const addListing = (base: string, title: string, selected: Post[], kind: 'home' | 'archive') => {
    routes.push(...listingRoutes(paginate, base, title, selected, kind, site.per_page));
  };
  addListing('/', t('latest'), all, 'home');
  addListing('/archives/', t('archives'), all, 'archive');
  const years = [...new Set(all.map((p) => p.dateLabel.slice(0, 4)))];
  for (const year of years) {
    const selected = all.filter((p) => p.dateLabel.startsWith(year));
    addListing(`/archives/${year}/`, `${t('archives')} · ${year}`, selected, 'archive');
    for (const month of [...new Set(selected.map((p) => p.dateLabel.slice(5, 7)))])
      addListing(
        `/archives/${year}/${month}/`,
        `${t('archives')} · ${year}/${month}`,
        selected.filter((p) => p.dateLabel.slice(5, 7) === month),
        'archive',
      );
  }
  for (const kind of ['tags', 'categories'] as const) {
    routes.push({
      path: `/${kind}/`,
      title: t(kind),
      kind: 'taxonomy',
      taxonomyKind: kind,
    });
    for (const t of taxonomy(all, kind)) addListing(t.path, t.name, t.posts, 'archive');
  }
  routes.push(
    ...all.map((post) => ({ path: post.path, title: post.title, kind: 'post' as const, post })),
    ...standalone.map((post) => ({
      path: post.path,
      title: post.title,
      kind: 'page' as const,
      post,
    })),
  );
  if (!routes.some((r) => r.path === '/about/'))
    routes.push({ path: '/about/', title: t('about'), kind: 'page' });
  if (!routes.some((r) => r.path === '/links/'))
    routes.push({ path: '/links/', title: t('links'), kind: 'links' });
  function staticFiles(dir: string): string[] {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .flatMap((e) =>
        e.isDirectory() ? staticFiles(path.join(dir, e.name)) : [path.join(dir, e.name)],
      );
  }
  const assets = staticFiles('public').map((file) => ({
    path: '/' + path.relative('public', file).replaceAll('\\', '/'),
    source: 'static asset',
  }));
  assertUniquePaths([
    ...routes.map((r) => ({ path: r.path, source: r.post?.source || r.kind })),
    ...assets,
    ...[
      ...new Map(
        redirects().map((r) => [
          collisionKey(r.from),
          { path: r.from, source: 'protected historical redirect' },
        ]),
      ).values(),
    ],
    ...[
      '/search.json',
      '/rss.xml',
      '/atom.xml',
      '/sitemap.xml',
      '/sitemap-index.xml',
      '/sitemap-0.xml',
      '/baidusitemap.xml',
      '/sitemap.txt',
      '/robots.txt',
      '/404.html',
      '/offline.html',
      '/manifest.webmanifest',
      '/sw.js',
    ].map((path) => ({ path, source: 'reserved endpoint' })),
  ]);
  if (!import.meta.env.DEV) {
    fs.mkdirSync('.astro', { recursive: true });
    const collections = [...(await getCollection('posts')), ...(await getCollection('pages'))];
    // Private build contract: never copied into the public site. This records the
    // actual Collections result, including exclusion decisions, for final checks.
    const entries = collections.map((entry) => {
      const prepared = [...all, ...standalone].find(
        (p) => p.entry.collection === entry.collection && p.entry.id === entry.id,
      );
      const source = path.relative(process.cwd(), entry.filePath!).replaceAll('\\', '/');
      return {
        collection: entry.collection,
        key: entry.id,
        source,
        id: entry.collection === 'posts' ? persistentId(entry.data) : undefined,
        path:
          prepared?.path ||
          (entry.collection === 'posts'
            ? newPostPath(entry.data)
            : publicPath({
                permalink: entry.data.permalink || '/' + entry.id.replace(/\/index$/, '') + '/',
              })),
        published: isPublished(entry.data),
        indexable: isPublished(entry.data) && !entry.data.noindex && !entry.data.password,
        search: entry.data.search !== false,
        feed: entry.data.feed !== false,
        title: entry.data.title,
        date: prepared?.date,
        updated: prepared?.updated,
        math: prepared?.math || false,
      };
    });
    fs.writeFileSync(
      '.astro/autuswing-content.json',
      JSON.stringify(
        {
          version: 1,
          mode: environment,
          siteUrl: getDeployment().origin,
          entries,
          config: {
            feed: theme.feed,
            search: theme.search,
            seo: theme.seo,
            comments: theme.comments.enable,
            pwa: theme.pwa,
          },
          routes: routes.map((r) => ({
            path: r.path,
            kind: r.kind,
            indexable: !r.post?.data.noindex && !r.post?.data.password,
          })),
        },
        null,
        2,
      ) + '\n',
    );
    fs.writeFileSync(
      '.astro/autuswing-routes.json',
      JSON.stringify(
        routes.map((r) => ({
          path: r.path,
          title: r.title,
          updated: r.post?.updated,
          indexable: !r.post?.data.noindex && !r.post?.data.password,
        })),
        null,
        2,
      ) + '\n',
    );
  }
  return routes;
}
