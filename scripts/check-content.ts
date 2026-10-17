import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { load } from 'cheerio';
import { markdownFiles } from './new-post.mjs';
import { frontmatter } from '../src/lib/frontmatter.mjs';
import { contentSchema, isPublished } from '../src/lib/content-schema';
import { parseDate } from '../src/lib/dates';
import {
  persistentId,
  publicPath,
  newPostPath,
  outputFile,
  assertUniquePaths,
} from '../src/lib/urls';
import { markdownProcessor } from '../src/lib/markdown.mjs';
import { redirects } from '../src/lib/legacy-redirects.mjs';

type Issue = { file: string; message: string; level: 'error' | 'warning' };
export async function checkContent({
  root,
  output = false,
  includeDrafts = false,
  remote = false,
  outDir = path.join(root, 'dist'),
}: {
  root: string;
  output?: boolean;
  includeDrafts?: boolean;
  remote?: boolean;
  outDir?: string;
}) {
  const issues: Issue[] = [],
    entries: any[] = [],
    ids = new Map<string, string>();
  const external = new Map<string, { file: string; warning: boolean }[]>();
  const remoteResults: { url: string; status?: number; error?: string }[] = [];
  const report = {
    files: 0,
    published: 0,
    drafts: 0,
    images: 0,
    links: 0,
    externalLinks: 0,
    deferredLinks: 0,
    remoteResults,
    issues,
  };
  const issue = (file: string, message: string, warning = false) =>
    issues.push({
      file: path.relative(root, file).replaceAll('\\', '/'),
      message,
      level: warning ? 'warning' : 'error',
    });
  const renderer = await markdownProcessor().createRenderer({ syntaxHighlight: false });
  for (const file of markdownFiles(path.join(root, 'content'))) {
    report.files++;
    try {
      const { data: raw, body } = frontmatter(fs.readFileSync(file, 'utf8'));
      const parsed = contentSchema.safeParse(raw);
      if (!parsed.success) {
        for (const error of parsed.error.issues)
          issue(file, `${error.path.join('.')}: ${error.message}`);
        continue;
      }
      const data = parsed.data,
        published = isPublished(data);
      published ? report.published++ : report.drafts++;
      const source = path.relative(path.join(root, 'content'), file).replaceAll('\\', '/');
      const post = source.startsWith('posts/') || source.startsWith('legacy/posts/');
      if (post) {
        const id = persistentId(data).toLowerCase();
        if (ids.has(id)) issue(file, `Duplicate persistent post ID: ${id} (${ids.get(id)})`);
        ids.set(id, file);
      }
      const url = post
        ? source.startsWith('legacy/')
          ? publicPath(data)
          : newPostPath(data)
        : publicPath({
            permalink:
              data.permalink ||
              '/' + source.replace(/^legacy\/pages\//, '').replace(/(?:\/index)?\.md$/, '') + '/',
          });
      if (data.updated && parseDate(data.updated) < parseDate(data.date))
        issue(file, 'updated is earlier than date; verify the intended publication time', true);
      const html = (
        await renderer.render(body, {
          frontmatter: data,
          fileURL: pathToFileURL(file),
        })
      ).code;
      const $ = load(html);
      entries.push({
        file,
        data,
        published,
        url,
        body,
        $,
        anchors: new Set(
          $('[id]')
            .map((_, n) => $(n).attr('id')!)
            .get(),
        ),
      });
    } catch (error) {
      issue(file, (error as Error).message);
    }
  }
  const published = entries.filter((entry) => entry.published);
  try {
    assertUniquePaths(published.map((entry) => ({ path: entry.url, source: entry.file })));
  } catch (error) {
    issue(path.join(root, 'content'), (error as Error).message);
  }
  const byUrl = new Map(published.map((entry) => [entry.url, entry]));
  const hidden = new Set(entries.filter((entry) => !entry.published).map((entry) => entry.url));
  const aliases = new Map(redirects().map((entry) => [entry.from, entry.to]));
  const safeFile = (base: string, name: string) => {
    const target = path.resolve(base, '.' + name);
    return target.startsWith(path.resolve(base) + path.sep) ? target : undefined;
  };
  for (const entry of entries) {
    if (!entry.published && !includeDrafts) continue;
    const { $, file } = entry;
    const warn = !entry.published;
    for (const name of Object.keys(entry.data))
      if (!(name in contentSchema.shape)) issue(file, `Preserving custom field: ${name}`, true);
    const resources: { value: string; image: boolean; alt?: string; source?: boolean }[] = [];
    $('img').each((_: number, node: any) => {
      // Astro serializes relative imported images before emitting their variants.
      const imported = $(node).attr('__astro_image_');
      const image = imported ? JSON.parse(imported) : node.attribs;
      resources.push({ value: image.src || '', image: true, alt: image.alt, source: !!imported });
    });
    if (entry.data.cover)
      resources.push({ value: entry.data.cover, image: true, alt: entry.data.title });
    $('a[href]').each((_: number, node: any) =>
      resources.push({ value: $(node).attr('href')!, image: false }),
    );
    for (const resource of resources) {
      const { value, image } = resource;
      image ? report.images++ : report.links++;
      if (image && !resource.alt?.trim())
        issue(
          file,
          `Image needs alternative text (or intentionally decorative alt=""): ${value}`,
          true,
        );
      if (!value) {
        issue(file, 'Empty image/link URL', warn);
        continue;
      }
      if (/^(?:data:|mailto:|tel:)/i.test(value)) continue;
      let url: URL;
      try {
        url = new URL(value, 'https://akisenn.com' + entry.url);
      } catch {
        issue(file, `Invalid URL: ${value}`, warn);
        continue;
      }
      if (!/^https?:$/.test(url.protocol)) {
        issue(file, `Unsupported link protocol: ${value}`, warn);
        continue;
      }
      if (url.origin !== 'https://akisenn.com') {
        report.externalLinks++;
        url.hash = '';
        const references = external.get(url.href) || [];
        references.push({ file, warning: warn });
        external.set(url.href, references);
        continue;
      }
      let pathname: string, fragment: string;
      try {
        pathname = decodeURIComponent(url.pathname);
        fragment = decodeURIComponent(url.hash.slice(1));
      } catch {
        issue(file, `Invalid URL encoding: ${value}`, warn);
        continue;
      }
      // Relative imported images are handled by Astro's native assets pipeline.
      if (image && resource.source && !value.startsWith('/') && !URL.canParse(value)) {
        const local = path.resolve(path.dirname(file), value.split(/[?#]/)[0]);
        if (fs.existsSync(local) && fs.statSync(local).isFile()) continue;
      }
      const asset = safeFile(path.join(root, 'public'), pathname);
      if (asset && fs.existsSync(asset) && fs.statSync(asset).isFile()) continue;
      if (image) {
        issue(file, `Missing image: ${value}`, warn);
        continue;
      }
      const target = aliases.get(pathname) || pathname;
      const article = byUrl.get(target) || byUrl.get(target.replace(/\/$/, '') + '/');
      if (hidden.has(target)) {
        issue(file, `Link points to unpublished content: ${value}`, warn);
        continue;
      }
      if (article && (!fragment || article.anchors.has(fragment))) continue;
      if (article && fragment) {
        issue(file, `Missing heading/anchor: ${value}`, warn);
        continue;
      }
      if (!output && !image) {
        report.deferredLinks++;
        continue;
      }
      const built = safeFile(outDir, '/' + outputFile(target));
      if (!image && output && built && fs.existsSync(built) && fs.statSync(built).isFile()) {
        if (
          fragment &&
          !load(fs.readFileSync(built, 'utf8'))('[id]')
            .toArray()
            .some((n) => n.attribs.id === fragment)
        )
          issue(file, `Missing output anchor: ${value}`, warn);
        continue;
      }
      issue(file, `${image ? 'Missing image' : 'Missing local output/link'}: ${value}`, warn);
    }
  }
  if (remote) {
    const queue = [...external];
    // Bound concurrency and each request; offline writing never waits on this.
    for (let i = 0; i < queue.length; i += 4)
      await Promise.all(
        queue.slice(i, i + 4).map(async ([url, references]) => {
          try {
            let response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(8000) });
            if (response.status === 405) {
              response = await fetch(url, {
                headers: { Range: 'bytes=0-0' },
                signal: AbortSignal.timeout(8000),
              });
              await response.body?.cancel();
            }
            remoteResults.push({ url, status: response.status });
            if (!response.ok)
              for (const reference of references)
                issue(
                  reference.file,
                  `External HTTP ${response.status}: ${url}`,
                  reference.warning || ![404, 410].includes(response.status),
                );
          } catch (error) {
            remoteResults.push({ url, error: (error as Error).message });
            for (const reference of references)
              issue(reference.file, `External URL could not be verified: ${url}`, true);
          }
        }),
      );
  }
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { parseArgs } = await import('node:util');
  const { values } = parseArgs({ options: {
    output: { type: 'boolean' }, drafts: { type: 'boolean' }, remote: { type: 'boolean' },
    'out-dir': { type: 'string' },
  } });
  const report = await checkContent({
    root: fileURLToPath(new URL('../', import.meta.url)),
    output: values.output,
    includeDrafts: values.drafts,
    remote: values.remote,
    outDir: values['out-dir'],
  });
  for (const issue of report.issues) console.log(`${issue.level}: ${issue.file}: ${issue.message}`);
  console.log(
    JSON.stringify(
      {
        ...report,
        issues: undefined,
        errors: report.issues.filter((i) => i.level === 'error').length,
        warnings: report.issues.filter((i) => i.level === 'warning').length,
      },
      null,
      2,
    ),
  );
  if (report.issues.some((issue) => issue.level === 'error')) process.exitCode = 1;
}
