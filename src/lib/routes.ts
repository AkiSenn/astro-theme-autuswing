import { posts, pages, taxonomy, type Post } from './content';
import { assertUniquePaths, collisionKey } from './urls';
import { redirects } from './legacy-redirects.mjs';
import { site } from '../site.config';
import fs from 'node:fs';
import path from 'node:path';
import type { PaginateFunction } from 'astro';
import { translate } from './i18n';
export type Route = {
  path: string;
  title: string;
  kind: 'post' | 'page' | 'archive' | 'taxonomy' | 'links' | 'home';
  post?: Post;
  posts?: Post[];
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
  const addListing = (base: string, title: string, selected: Post[], kind: Route['kind']) => {
    const per = site.per_page > 0 ? site.per_page : Number.POSITIVE_INFINITY;
    const result = paginate(selected, {
      pageSize: per,
      format: (url) => {
        const number = url === '/' ? 1 : Number(url.replaceAll('/', ''));
        return number === 1 ? base : `${base}page/${number}/`;
      },
    });
    for (const item of result) {
      const page = item.props.page;
      routes.push({
        path: page.url.current,
        title,
        kind,
        posts: page.data as Post[],
        page: page.currentPage,
        totalPages: page.lastPage,
        base,
      });
    }
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
  fs.mkdirSync('.astro', { recursive: true });
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
  return routes;
}
