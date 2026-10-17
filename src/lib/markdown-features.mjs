import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { imageMetadata } from 'astro/assets/utils';

// Reuse Astro's metadata decoder. Never fetch remote images or rewrite old URLs.
const publicRoot = fileURLToPath(new URL('../../public/', import.meta.url));
const imageCache = new Map();
export async function localImageDimensions(src) {
  if (typeof src !== 'string' || !src.startsWith('/') || src.startsWith('//')) return;
  const file = path.resolve(publicRoot, '.' + decodeURIComponent(src.split(/[?#]/)[0]));
  if (!file.startsWith(publicRoot)) return;
  const stat = await fs.stat(file).catch(() => undefined);
  if (!stat?.isFile()) return;
  const key = `${file}:${stat.size}:${stat.mtimeMs}`;
  if (!imageCache.has(key)) imageCache.set(key, imageMetadata(await fs.readFile(file), src));
  return imageCache.get(key);
}

function inRanges(spec, line) {
  return spec?.split(',').some((part) => {
    const [start, end = start] = part.trim().split('-').map(Number);
    return Number.isInteger(start) && Number.isInteger(end) && start <= line && line <= end;
  });
}

// Shiki already exposes metadata and line hooks; no second highlighter is needed.
export function codeMetadata() {
  return {
    name: 'autuswing-code-metadata',
    pre(node) {
      const meta = this.options.meta?.__raw || '';
      const name = meta.match(/(?:^|\s)(?:title|file|filename)=("[^"]*"|'[^']*'|[^\s{}]+)/)?.[1];
      if (name) node.properties['data-filename'] = name.replace(/^(["'])(.*)\1$/, '$2');
    },
    line(node, line) {
      const meta = this.options.meta?.__raw || '';
      const specs = [
        ['code-line-highlight', meta.match(/(?:^|\s)\{([\d,\s-]+)\}/)?.[1]],
        ['code-line-add', meta.match(/\badd=\{([\d,\s-]+)\}/)?.[1]],
        ['code-line-delete', meta.match(/\bdel=\{([\d,\s-]+)\}/)?.[1]],
      ];
      for (const [name, spec] of specs) if (inRanges(spec, line)) this.addClassToHast(node, name);
    },
  };
}

export function writingBlocks() {
  const labels = { NOTE: '说明', TIP: '提示', IMPORTANT: '重要', WARNING: '注意', CAUTION: '警告' };
  return (tree) => {
    function visit(node) {
      if (node.type === 'blockquote') {
        const first = node.children?.[0]?.children?.[0];
        const match =
          first?.type === 'text' &&
          first.value.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?:\n|$)/);
        if (match) {
          node.data ||= {};
          node.data.hProperties = {
            ...node.data.hProperties,
            className: ['admonition'],
            'data-kind': match[1].toLowerCase(),
          };
          first.value = first.value.slice(match[0].length);
          node.children[0].children.unshift({
            type: 'strong',
            children: [{ type: 'text', value: labels[match[1]] + '：' }],
          });
        }
      }
      for (const child of node.children || []) visit(child);
    }
    visit(tree);
  };
}
