import { getCollection, render, type CollectionEntry } from 'astro:content';
import { site, theme } from '../site.config';
import legacy from '../../migration/effective-metadata.json';
import legacyPages from '../../migration/page-metadata.json';
import { publicPath, newPostPath, persistentId, assertUniquePaths } from './urls';
import { parseDate, formatDate } from './dates';
import { decodeHTML } from 'entities';
import { mathPlainText } from './math.mjs';
import { isPublished } from './content-schema';
export type Entry = CollectionEntry<'posts'> | CollectionEntry<'pages'>;
export type Post = Awaited<ReturnType<typeof prepare>>;
export function list(value: unknown): string[] {
  return [...new Set(Array.isArray(value) ? value.map(String) : value ? [String(value)] : [])];
}
export function categoryLinks(value: unknown) {
  const branches = Array.isArray(value)
    ? value.some(Array.isArray)
      ? value.map((v) => (Array.isArray(v) ? v : [v]))
      : [value]
    : value
      ? [[value]]
      : [];
  const result = new Map<string, { name: string; path: string }>();
  for (const branch of branches) {
    let path = '/categories/';
    for (const raw of branch) {
      const name = String(raw);
      path += name + '/';
      result.set(path, { name, path });
    }
  }
  return [...result.values()];
}
export function plain(value = '') {
  return (
    mathPlainText(value) ??
    decodeHTML(
      value.replace(/<(script|style|pre)\b[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<[^>]*>/g, ' '),
    )
  )
    .replace(/\s+/g, ' ')
    .trim();
}
export function countWords(value: string) {
  const t = plain(value),
    cjk = /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff\uac00-\ud7af]/g;
  return (
    (t.match(cjk) || []).length +
    (t.replace(cjk, ' ').match(/[A-Za-z0-9][A-Za-z0-9'’_-]*/g) || []).length
  );
}
export function isIndexable(p: { data: Entry['data'] }) {
  return (
    !p.data.password &&
    p.data.noindex !== true &&
    p.data.published !== false &&
    p.data.draft !== true
  );
}
async function prepare(entry: Entry) {
  const data = entry.data,
    source = entry.filePath || entry.id;
  const historical =
    entry.collection === 'posts'
      ? legacy.find(
          (p) =>
            p.source === `_posts/${entry.id.replace(/^legacy\/posts\//, '')}.md` ||
            p.abbrlink === String(data.id || data.abbrlink || ''),
        )
      : legacyPages.find((p) => p.source === entry.id + '.md');
  const date = parseDate(data.date),
    updated = data.updated ? parseDate(data.updated) : historical?.updated || date;
  const path =
    entry.collection === 'posts'
      ? historical
        ? publicPath(data, historical.path)
        : newPostPath(data)
      : publicPath({ permalink: data.permalink || '/' + entry.id.replace(/\/index$/, '') + '/' });
  const rendered = await render(entry);
  const html = entry.rendered?.html || '';
  const paragraphs = [
    ...html
      .replace(/<(h[1-6]|pre|figure|blockquote|table|ul|ol)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
      .matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g),
  ]
    .map((m) => plain(m[1]))
    .filter(Boolean);
  const more = html.split(/<!--\s*more\s*-->/i);
  const summary = plain(
    data.description ||
      data.excerpt ||
      (more.length > 1
        ? more[0]
        : paragraphs.slice(0, theme.article.excerpt_paragraphs).join(' ')) ||
      plain(html),
  );
  const excerpt =
    summary.length > theme.article.excerpt_length
      ? summary.slice(0, theme.article.excerpt_length) + '…'
      : summary;
  const words = countWords(html),
    minutes = Math.max(1, Math.ceil(words / theme.reading.words_per_minute));
  const categoryItems = categoryLinks(data.categories),
    categories = categoryItems.map((c) => c.name),
    tags = list(data.tags);
  return {
    entry,
    data,
    source,
    isLegacy: !!historical,
    path,
    date,
    updated,
    dateLabel: formatDate(date),
    title: data.title,
    excerpt,
    words,
    minutes,
    tags,
    categories,
    categoryItems,
    html,
    rendered,
    math: html.includes('data-math-rendered="katex"'),
    lang: data.lang || data.language || site.language,
  };
}
let postPromise: Promise<Post[]> | undefined, pagePromise: Promise<Post[]> | undefined;
// Explicit local authoring mode; static builds always exclude unpublished work.
const previewDrafts = import.meta.env.DEV && process.env.ASTRO_PREVIEW_DRAFTS === '1';
export function posts() {
  return (postPromise ??= getCollection('posts').then(async (entries) => {
    const ids = new Set<string>();
    for (const entry of entries) {
      const id = persistentId(entry.data).toLowerCase();
      if (ids.has(id)) throw new Error(`Duplicate persistent post ID: ${id}`);
      ids.add(id);
    }
    const result = await Promise.all(
      entries.filter((e) => isPublished(e.data) || previewDrafts).map(prepare),
    );
    assertUniquePaths(result);
    return result.sort((a, b) => b.date.localeCompare(a.date) || a.path.localeCompare(b.path));
  }));
}
export function pages() {
  return (pagePromise ??= getCollection('pages').then((entries) =>
    Promise.all(entries.filter((e) => isPublished(e.data) || previewDrafts).map(prepare)),
  ));
}
export function taxonomy(all: Post[], kind: 'tags' | 'categories') {
  const result = new Map<string, { name: string; path: string; posts: Post[] }>();
  for (const p of all)
    for (const item of kind === 'tags'
      ? p.tags.map((name) => ({ name, path: `/tags/${name}/` }))
      : p.categoryItems) {
      const group = result.get(item.path) || { ...item, posts: [] };
      group.posts.push(p);
      result.set(item.path, group);
    }
  return [...result.values()].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
}
