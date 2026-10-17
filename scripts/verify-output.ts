import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import assert from 'node:assert/strict';
import { load } from 'cheerio';
import {
  outputFile,
  persistentId,
  newPostPath,
  publicPath,
  assertUniquePaths,
} from '../src/lib/urls';
import { contentSchema, isPublished } from '../src/lib/content-schema';
import { frontmatter } from '../src/lib/frontmatter.mjs';
import { markdownFiles } from './new-post.mjs';
import { inputManifest, verifyFiles, sha256 } from './release-integrity.mjs';
import { assertProductionUrl } from '../src/lib/build-mode.mjs';
import oldRoutes from '../migration/existing-output-routes.json';
import legacy from '../migration/effective-metadata.json';
import { redirects } from '../src/lib/legacy-redirects.mjs';
import { imageMetadata } from 'astro/assets/utils';
import { parseDate } from '../src/lib/dates';
import legacyPages from '../migration/page-metadata.json';

function inventory(root: string) {
  const entries = ['content/posts', 'content/legacy/posts', 'content/legacy/pages']
    .flatMap((dir) => markdownFiles(path.join(root, dir)))
    .map((file) => {
      const data = contentSchema.parse(frontmatter(fs.readFileSync(file, 'utf8')).data);
      const source = path.relative(root, file).replaceAll('\\', '/');
      const post = !source.startsWith('content/legacy/pages/');
      const url = post
        ? source.startsWith('content/legacy/posts/')
          ? publicPath(data)
          : newPostPath(data)
        : publicPath({
            permalink:
              data.permalink ||
              '/' +
                source.replace(/^content\/legacy\/pages\//, '').replace(/(?:\/index)?\.md$/, '') +
                '/',
          });
      const historical = post
        ? legacy.find((p) => p.abbrlink === persistentId(data))
        : legacyPages.find((p) => p.source === source.replace(/^content\/legacy\/pages\//, ''));
      return {
        source,
        collection: post ? 'posts' : 'pages',
        id: post ? persistentId(data) : undefined,
        path: url,
        title: data.title,
        published: isPublished(data),
        indexable: isPublished(data) && !data.noindex && !data.password,
        search: data.search !== false,
        feed: data.feed !== false,
        date: isPublished(data) ? parseDate(data.date) : undefined,
        updated: isPublished(data)
          ? data.updated
            ? parseDate(data.updated)
            : historical?.updated || parseDate(data.date)
          : undefined,
      };
    });
  const ids = entries.filter((e) => e.collection === 'posts').map((e) => e.id!.toLowerCase());
  assert.equal(new Set(ids).size, ids.length, 'Duplicate article ID in source inventory');
  assertUniquePaths(
    entries.filter((e) => e.published).map((e) => ({ path: e.path, source: e.source })),
  );
  return entries;
}
const sorted = (values: string[]) => [...values].sort();
const canonicalKey = (url: string) => decodeURI(new URL(url).href);
function sameUrls(actual: string[], expected: string[], label: string) {
  assert.equal(new Set(actual.map(canonicalKey)).size, actual.length, `Duplicate ${label}`);
  assert.deepEqual(
    sorted(actual.map(canonicalKey)),
    sorted(expected.map(canonicalKey)),
    `Incorrect ${label}`,
  );
}

export async function verifyOutput({
  projectRoot = process.cwd(),
  outDir = path.join(projectRoot, 'dist'),
  recordFile = path.join(projectRoot, '.astro/autuswing-build.json'),
  production = false,
}: { projectRoot?: string; outDir?: string; recordFile?: string; production?: boolean } = {}) {
  const root = path.resolve(outDir);
  const build = JSON.parse(fs.readFileSync(recordFile, 'utf8'));
  const contract = build.contract;
  const policy = JSON.parse(
    fs.readFileSync(path.join(projectRoot, 'deployment/release-policy.json'), 'utf8'),
  );
  assert.equal(build.outputRoot, root, 'Build record belongs to another artifact');
  assert.equal(build.mode, contract.mode);
  assert.equal(build.siteUrl, contract.siteUrl);
  assert.equal(build.policyHash, sha256(JSON.stringify(policy)));
  assert.deepEqual(inputManifest(projectRoot), build.inputs, 'Source inputs changed after build');
  verifyFiles(root, build.files);
  if (production) {
    assert.equal(build.mode, 'production', 'Production gate rejects preview/development artifacts');
    assertProductionUrl(build.siteUrl, policy.productionUrl);
  }
  const source = inventory(projectRoot);
  const comparable = (e: any) =>
    Object.fromEntries(Object.keys(source[0] || {}).map((key) => [key, e[key]]));
  assert.deepEqual(
    contract.entries.map(comparable).sort((a: any, b: any) => a.source.localeCompare(b.source)),
    source.map(comparable).sort((a, b) => String(a.source).localeCompare(String(b.source))),
    'Collections/source inventory differs',
  );
  const entries = contract.entries.filter((e: any) => e.published);
  const posts = entries
    .filter((e: any) => e.collection === 'posts')
    .sort((a: any, b: any) => b.date.localeCompare(a.date) || a.path.localeCompare(b.path));
  const routes = contract.routes;
  assertUniquePaths(routes.map((r: any) => ({ path: r.path, source: r.kind })));
  sameUrls(
    routes
      .filter(
        (r: any) =>
          ['post', 'page'].includes(r.kind) && entries.some((e: any) => e.path === r.path),
      )
      .map((r: any) => new URL(r.path, build.siteUrl).href),
    entries.map((e: any) => new URL(e.path, build.siteUrl).href),
    'content routes',
  );
  const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');
  const expectedHtml = new Set([
    ...routes.map((r: any) => outputFile(r.path)),
    ...policy.noindexPaths.map((p: string) => p.slice(1)),
    ...build.inputs
      .filter((f: any) => f.file.startsWith('public/') && f.file.endsWith('.html'))
      .map((f: any) => f.file.slice(7)),
  ]);
  assert.deepEqual(
    sorted(build.files.filter((f: any) => f.file.endsWith('.html')).map((f: any) => f.file)),
    sorted([...expectedHtml]),
    'Unexpected/missing HTML (possibly stale or draft content)',
  );
  const headers = fs.existsSync(path.join(root, '_headers')) ? read('_headers') : '';
  const headerBlocks: { pattern: string; robots: string; cache: string }[] = [];
  for (const line of headers.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) headerBlocks.push({ pattern: line.trim(), robots: '', cache: '' });
    else if (/^\s*x-robots-tag:/i.test(line)) {
      assert.ok(headerBlocks.length, 'Header without path pattern');
      headerBlocks.at(-1)!.robots += ' ' + line;
    } else if (/^\s*cache-control:/i.test(line)) {
      assert.ok(headerBlocks.length, 'Header without path pattern');
      headerBlocks.at(-1)!.cache += line;
    }
  }
  assert.ok(
    !headerBlocks.some((block) => block.pattern === '/*' && block.cache),
    'Global and asset cache rules must not overlap',
  );
  const headerRobots = (uri: string) =>
    headerBlocks
      .filter((block) =>
        new RegExp(
          '^' + block.pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replaceAll('*', '.*') + '$',
        ).test(uri),
      )
      .map((b) => b.robots)
      .join(' ');
  let localReferences = 0;
  for (const route of routes) {
    const $ = load(read(outputFile(route.path)));
    const absolute = new URL(route.path, build.siteUrl).href;
    assert.equal($('h1').length, 1, route.path);
    assert.equal($('link[rel=canonical]').length, 1, route.path);
    assert.equal($('link[rel=canonical]').attr('href'), absolute, route.path);
    assert.equal($('meta[property="og:url"]').attr('content'), absolute, route.path);
    assert.equal($('body').attr('data-preview'), String(build.mode !== 'production'));
    const robots = $('meta[name=robots], meta[name=googlebot], meta[name=bingbot]')
      .toArray()
      .map((e) => $(e).attr('content'))
      .join(' ');
    if (build.mode === 'production' && route.indexable) {
      assert.ok(
        !/noindex|none|nofollow/i.test(robots),
        `Production public page blocks indexing: ${route.path}`,
      );
      assert.ok(
        !/noindex|none|nofollow/i.test(headerRobots(route.path)),
        `X-Robots-Tag blocks public page: ${route.path}`,
      );
    } else {
      assert.match(robots, /noindex/i, `Missing exclusion policy: ${route.path}`);
      if (build.mode !== 'production' && headers)
        assert.match(headerRobots(route.path), /noindex/i, 'Missing preview X-Robots-Tag');
    }
    const entry = entries.find((e: any) => e.path === route.path);
    if (entry?.collection === 'posts') {
      const ld = JSON.parse($('script[type="application/ld+json"]').text());
      assert.equal(ld['@type'], 'BlogPosting');
      assert.equal(ld.url, absolute);
      assert.equal(ld.mainEntityOfPage, absolute);
      assert.equal(ld.datePublished, entry.date);
      assert.equal(ld.dateModified, entry.updated);
      assert.equal($('meta[property="article:published_time"]').attr('content'), entry.date);
      assert.equal($('meta[property="article:modified_time"]').attr('content'), entry.updated);
      assert.equal($('link[data-math-styles]').length, entry.math ? 1 : 0);
      if (!entry.math) assert.equal('math' in JSON.parse($('#autuswing-config').text()), false);
    }
  }
  // Include 404/offline/static HTML references too, preserving the pre-migration
  // integrity checks without assuming a fixed number of public pages.
  for (const file of build.files.filter((file: any) => file.file.endsWith('.html'))) {
    const $ = load(read(file.file));
    assert.equal($('h1').length, 1, file.file);
    const absolute = new URL('/' + file.file.replace(/index\.html$/, ''), build.siteUrl).href;
    $('[src],[href]').each((_, el) => {
      const value = $(el).attr('src') || $(el).attr('href');
      if (!value || /^(https?:|data:|mailto:|tel:|#|\/\/)/i.test(value)) return;
      const url = new URL(value, absolute),
        target = path.resolve(root, '.' + decodeURIComponent(url.pathname));
      assert.ok(
        target.startsWith(root + path.sep) || target === root,
        `Unsafe reference: ${value}`,
      );
      assert.ok(
        (fs.existsSync(target) && fs.statSync(target).isFile()) ||
          fs.existsSync(path.join(target, 'index.html')),
        `Missing local reference ${value} in ${file.file}`,
      );
      localReferences++;
    });
  }
  for (const hidden of contract.entries.filter((e: any) => !e.published)) {
    assert.ok(
      !routes.some((r: any) => r.path === hidden.path),
      `Draft route leaked: ${hidden.path}`,
    );
    assert.ok(
      !fs.existsSync(path.join(root, outputFile(hidden.path))),
      `Draft file leaked: ${hidden.path}`,
    );
  }
  for (const uri of policy.noindexPaths)
    assert.match(
      load(read(uri.slice(1)))('meta[name=robots]').attr('content') || '',
      /noindex/i,
      uri,
    );
  const expectedRobots =
    build.mode !== 'production'
      ? 'User-agent: *\nDisallow: /\n'
      : contract.config.seo.robots
        ? `User-agent: *\nAllow: /\n${contract.config.seo.sitemap ? `Sitemap: ${build.siteUrl}/sitemap.xml\nSitemap: ${build.siteUrl}/baidusitemap.xml\n` : ''}`
        : '';
  assert.equal(read('robots.txt'), expectedRobots, 'robots.txt does not match build policy');
  const search = JSON.parse(read('search.json'));
  sameUrls(
    search.map((p: any) => new URL(p.url, build.siteUrl).href),
    (contract.config.search.enable ? posts.filter((e: any) => e.indexable && e.search) : []).map(
      (e: any) => new URL(e.path, build.siteUrl).href,
    ),
    'search membership',
  );
  let feed = contract.config.feed.enable ? posts.filter((e: any) => e.indexable && e.feed) : [];
  if (contract.config.feed.limit > 0) feed = feed.slice(0, contract.config.feed.limit);
  for (const [file, selector] of [
    ['rss.xml', 'item > guid'],
    ['atom.xml', 'entry > id'],
  ]) {
    const $ = load(read(file), { xml: true });
    assert.equal(
      $(file === 'rss.xml' ? 'item' : 'entry').length,
      feed.length,
      file + ' entry count',
    );
    sameUrls(
      $(selector)
        .toArray()
        .map((e) => $(e).text()),
      feed.map((e: any) => new URL(e.path, build.siteUrl).href),
      file,
    );
    const links =
      file === 'rss.xml'
        ? $('item > link')
            .toArray()
            .map((e) => $(e).text())
        : $('entry > link')
            .toArray()
            .map((e) => $(e).attr('href')!);
    sameUrls(
      links,
      feed.map((e: any) => new URL(e.path, build.siteUrl).href),
      file + ' links',
    );
  }
  let locations: string[] = [];
  function sitemap(file: string, seen = new Set<string>()): string[] {
    assert.ok(!seen.has(file), 'Sitemap loop');
    seen.add(file);
    const $ = load(read(file), { xml: true });
    if ($('sitemapindex').length)
      return $('sitemap > loc')
        .toArray()
        .flatMap((e) => {
          const url = new URL($(e).text());
          assert.equal(url.origin, new URL(build.siteUrl).origin, 'External sitemap index');
          assert.match(url.pathname, /^\/sitemap-\d+\.xml$/);
          return sitemap(url.pathname.slice(1), seen);
        });
    assert.equal($('urlset').length, 1, file);
    for (const node of $('url').toArray()) {
      const location = $(node).find('loc').text();
      const entry = entries.find(
        (entry: any) =>
          canonicalKey(new URL(entry.path, build.siteUrl).href) === canonicalKey(location),
      );
      if (entry?.updated)
        assert.ok(
          $(node).find('lastmod').text().startsWith(entry.updated.slice(0, 10)),
          `Incorrect Sitemap lastmod: ${entry.path}`,
        );
    }
    return $('url > loc')
      .toArray()
      .map((e) => $(e).text());
  }
  if (contract.config.seo.sitemap) {
    locations = sitemap('sitemap-index.xml');
    const expected = routes
      .filter((r: any) => r.indexable)
      .map((r: any) => new URL(r.path, build.siteUrl).href);
    sameUrls(locations, expected, 'Sitemap routes');
    for (const file of ['sitemap.xml', 'baidusitemap.xml']) sameUrls(sitemap(file), expected, file);
    sameUrls(read('sitemap.txt').trim().split('\n').filter(Boolean), expected, 'sitemap.txt');
  }
  if (contract.config.pwa.enable) {
    const manifest = JSON.parse(read('manifest.webmanifest'));
    assert.equal(manifest.scope, '/');
    assert.equal(manifest.start_url, '/');
    assert.equal(manifest.display, 'standalone');
    assert.deepEqual(sorted(manifest.icons.map((i: any) => `${i.purpose}:${i.sizes}`)), [
      'any:192x192',
      'any:512x512',
      'maskable:512x512',
    ]);
    for (const icon of manifest.icons) {
      assert.match(icon.src, /^\/pwa\/(?:icon-(?:192|512)|maskable-512)\.[a-f0-9]{16}\.webp$/);
      const data = fs.readFileSync(path.join(root, icon.src));
      assert.ok(icon.src.includes(sha256(data).slice(0, 16)), 'Icon filename hash differs');
      assert.ok(data.length < 64 * 1024, 'PWA icon exceeds budget');
      const metadata = await imageMetadata(data, icon.src);
      assert.equal(icon.type, 'image/webp');
      assert.equal(metadata.format, 'webp');
      assert.equal(`${metadata.width}x${metadata.height}`, icon.sizes);
    }
  }
  // Frozen migration requirements are a subset, never the site's total size.
  for (const r of oldRoutes.filter((r) => r.canonical && !r.redirect && !r.noindex))
    assert.equal(load(read(outputFile(r.path)))('link[rel=canonical]').attr('href'), r.canonical);
  for (const p of legacy) {
    const $ = load(read(outputFile(p.path)));
    assert.equal($('meta[property="article:published_time"]').attr('content'), p.date);
    assert.equal($('meta[property="article:modified_time"]').attr('content'), p.updated);
    const ids = new Set(
      $('.prose [id]')
        .toArray()
        .map((el) => $(el).attr('id')),
    );
    for (const h of p.headings) assert.ok(ids.has(h.id), `Missing historical heading ${h.id}`);
    if (p.abbrlink === '4e395565') {
      assert.equal(
        $('.math-inline,.math-display').length,
        4,
        'Historical formula containers changed',
      );
      assert.equal($('.katex').length, 4, 'Historical formulas were lost');
      assert.equal($('.katex math annotation[encoding="application/x-tex"]').length, 4);
    }
    for (const alias of [`/post/${p.abbrlink}.html`, `/p/${p.abbrlink}/`])
      assert.ok(read('_redirects').includes(`${alias} ${p.path} 301`));
  }
  const redirectRows = read('_redirects')
    .trim()
    .split('\n')
    .map((line) => line.trim().split(/\s+/));
  assert.deepEqual(
    redirectRows.map(([from, to, status]) => ({
      from: decodeURI(from),
      to,
      status: Number(status),
    })),
    redirects(),
    'Historical redirect rules differ',
  );
  if (!contract.config.comments)
    for (const e of entries)
      assert.equal(load(read(outputFile(e.path)))('[data-comments-config]').length, 0);
  return {
    checkedAt: new Date().toISOString(),
    mode: build.mode,
    canonicalPages: routes.filter((r: any) => r.indexable).length,
    posts: posts.length,
    draftsExcluded: contract.entries.filter((e: any) => !e.published).length,
    localReferences,
    mathWrappers: posts.reduce(
      (n: number, e: any) => n + load(read(outputFile(e.path)))('.katex').length,
      0,
    ),
    feedEntries: feed.length,
    sitemapUrls: locations.length,
    redirectRules: read('_redirects').trim().split('\n').length,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({
    options: {
      root: { type: 'string' },
      record: { type: 'string' },
      production: { type: 'boolean' },
    },
  });
  const result = await verifyOutput({
    outDir: values.root,
    recordFile: values.record,
    production: values.production,
  });
  const evidence = process.env.OUTPUT_EVIDENCE_FILE || 'docs/evidence/output-check.json';
  fs.mkdirSync(path.dirname(evidence), { recursive: true });
  fs.writeFileSync(evidence, JSON.stringify(result, null, 2) + '\n');
  console.log(result);
}
