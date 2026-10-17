import { posts, isIndexable } from './content';
import { theme } from '../site.config';
import { absolute } from './urls';
import { decodeHTML } from 'entities';
export async function feedPosts() {
  const all = (await posts()).filter((p) => isIndexable(p) && p.data.feed !== false);
  return theme.feed.enable ? (theme.feed.limit > 0 ? all.slice(0, theme.feed.limit) : all) : [];
}
export const xml = (s: unknown) =>
  String(s ?? '')
    .replace(/[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu, '')
    .replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!,
    );
export function absoluteHtml(html: string, path: string) {
  // Feed readers do not share the site's responsive layout or document base.
  // Use the complete optimized src; relative srcset candidates are inappropriate.
  return html
    .replace(/\s+(?:srcset|sizes)="[^"]*"/gi, '')
    .replace(
      /\b(href|src)="([^"]+)"/g,
      (_, attr, value) => `${attr}="${xml(new URL(decodeHTML(value), absolute(path)).href)}"`,
    );
}
export const feedContent = (p: Awaited<ReturnType<typeof feedPosts>>[number]) =>
  theme.feed.full_content ? absoluteHtml(p.html, p.path) : `<p>${xml(p.excerpt)}</p>`;
