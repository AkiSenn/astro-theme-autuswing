import { unified } from '@astrojs/markdown-remark';
import { themeConfig as theme } from './config-loader.mjs';
import { getDeployment, mountReference, unmountPath } from './deployment.mjs';
import { authoredAssetReference, imageUrl } from './image-url.mjs';
import rehypeRaw from 'rehype-raw';
import { mapInlineCssUrls } from './inline-css-urls.mjs';
import { markdownAttachmentHref } from './attachment-links.mjs';
import { mathEnabled, renderMath } from './math.mjs';
import { codeMetadata, localImageDimensions, writingBlocks } from './markdown-features.mjs';

const escaped = (s, i) => {
  let n = 0;
  while (i > 0 && s[--i] === '\\') n++;
  return n % 2 === 1;
};
const entities = (s) => Array.from(s, (c) => `&#${c.codePointAt(0)};`).join('');
// Only protect TeX delimiters. Parsing/rendering remains Astro's Markdown pipeline.
// Code fences, indented code, code spans and HTML tags are opaque to this pass.
export function protectMath(source, collect) {
  let out = '',
    i = 0;
  while (i < source.length) {
    if (i === 0 || source[i - 1] === '\n') {
      const rest = source.slice(i),
        f = rest.match(/^[ \t]{0,3}(`{3,}|~{3,})[^\n]*\n/);
      if (f) {
        const marker = f[1][0],
          end = new RegExp(`^ {0,3}${marker}{${f[1].length},}[^\\S\\n]*(?:\\n|$)`, 'gm');
        end.lastIndex = f[0].length;
        const close = end.exec(rest),
          length = close ? close.index + close[0].length : rest.length;
        out += rest.slice(0, length);
        i += length;
        continue;
      }
      const indented = rest.match(/^(?:(?: {4}|\t)[^\n]*(?:\n|$))+/);
      if (indented) {
        out += indented[0];
        i += indented[0].length;
        continue;
      }
    }
    if (source[i] === '`' && !escaped(source, i)) {
      const mark = source.slice(i).match(/^`+/)[0],
        end = source.indexOf(mark, i + mark.length);
      if (end >= 0) {
        out += source.slice(i, end + mark.length);
        i = end + mark.length;
        continue;
      }
    }
    if (source[i] === '<') {
      const raw = source
        .slice(i)
        .match(
          /^<(pre|code|script|style|textarea)\b[^>]*>[\s\S]*?<\/\1\s*>|^<!--[\s\S]*?-->|^<\/?[A-Za-z][^>]*>/i,
        );
      if (raw) {
        out += raw[0];
        i += raw[0].length;
        continue;
      }
    }
    const opening = ['$$', '\\[', '\\(', '$'].find(
      (d) => source.startsWith(d, i) && !escaped(source, i),
    );
    if (opening) {
      if (opening === '$' && /\s/.test(source[i + 1] || ' ')) {
        out += source[i++];
        continue;
      }
      const closing = { $$: '$$', '\\[': '\\]', '\\(': '\\)', $: '$' }[opening],
        display = ['$$', '\\['].includes(opening);
      let end = source.indexOf(closing, i + opening.length);
      while (
        end >= 0 &&
        (escaped(source, end) ||
          (opening === '$' && (/\s/.test(source[end - 1]) || /\d/.test(source[end + 1] || ''))))
      )
        end = source.indexOf(closing, end + closing.length);
      if (end >= 0 && (display || !source.slice(i, end).includes('\n'))) {
        const tex = source.slice(i, end + closing.length);
        collect?.({
          raw: tex,
          tex: source.slice(i + opening.length, end),
          display,
          line: source.slice(0, i).split('\n').length,
        });
        out += display
          ? `\n<div class="math-display" data-math="tex">${entities(tex)}</div>\n`
          : `<span class="math-inline" data-math="tex">${entities(tex)}</span>`;
        i = end + closing.length;
        continue;
      }
    }
    out += source[i++];
  }
  return out;
}
export function scanMath(source) {
  const formulas = [];
  protectMath(source, (formula) => formulas.push(formula));
  return formulas;
}
const text = (node) =>
  node.type === 'text' ? node.value : (node.children || []).map(text).join('');
function rejectHexoTags() {
  return (tree, file) => {
    function visit(node) {
      if (node.type === 'code' || node.type === 'inlineCode') return;
      if ((node.type === 'text' || node.type === 'html') && /{%\s*[\w-]+/.test(node.value || ''))
        file.fail('Unsupported Hexo tag syntax; migrate it explicitly before building', node);
      for (const child of node.children || []) visit(child);
    }
    visit(tree);
  };
}
export function compatibleHtml({
  deployment = getDeployment(), siteUrl = deployment.origin, deferAttachmentHrefs = false,
} = {}) {
  const siteOrigin = new URL(siteUrl).origin;
  return async (tree, file) => {
    const used = new Set();
    const dimensions = [];
    let image = 0;
    function visit(node, parent, index, protectedText = false) {
      if (node.type === 'element') {
        node.properties ||= {};
        const mounted = node.properties.dataAutuswingUrlSpace === 'mounted';
        const asset = value => authoredAssetReference(value, deployment);
        if (/^h[1-6]$/.test(node.tagName)) {
          if (node.tagName === 'h1') node.tagName = 'h2';
          const title = text(node).replace(/\s+/g, ' ').trim();
          const original =
            node.properties.id ||
            title
              .replace(/[^\p{L}\p{N}_\-\s、，。：！？（）]/gu, '-')
              .replace(/\s+/g, '-')
              .replace(/-+/g, '-')
              .replace(/^-|-$/g, '') ||
            'heading';
          let id = original,
            n = 2;
          while (used.has(id)) id = `${original}-${n++}`;
          used.add(id);
          node.properties.id = id;
        }
        if (node.tagName === 'img') {
          // Imported images use Astro's responsive variants. Match the reading
          // column rather than advertising the entire desktop viewport as sizes.
          if (file.data.astro?.localImagePaths?.includes(decodeURI(node.properties.src || '')))
            node.properties.sizes ||=
              '(max-width: 719px) calc(100vw - 48px), (max-width: 999px) calc(100vw - 168px), 810px';
          const source = node.properties.src;
          const logicalSource = !source ? source : mounted
            ? unmountPath(source.split(/[?#]/, 1)[0], deployment)
            : asset(source);
          if (source && !mounted) node.properties.src = imageUrl(logicalSource, '/', deployment);
          if (!node.properties.width && !node.properties.height)
            dimensions.push(
              localImageDimensions(logicalSource).then((size) => {
                if (size) {
                  node.properties.width = size.width;
                  node.properties.height = size.height;
                }
              }),
            );
          node.properties.decoding = 'async';
          node.properties.alt ||= '';
          node.properties.loading ||= theme.article.lazyload
            ? image === 0
              ? 'eager'
              : 'lazy'
            : undefined;
          if (image++ === 0) node.properties.fetchPriority = 'high';
        }
        if (node.tagName === 'a' && theme.open_in_new) {
          try {
            const url = new URL(node.properties.href, siteUrl);
            if (
              /^https?:$/.test(url.protocol) &&
              url.origin !== siteOrigin &&
              !theme.open_in_new_exclude.some(
                (host) => url.hostname === host || url.hostname.endsWith('.' + host),
              )
            ) {
              node.properties.target = '_blank';
              node.properties.rel = ['noopener', 'noreferrer'];
            }
          } catch {}
        }
        if (!mounted && deployment.basePath !== '/') {
          const mount = value => mountReference(value, deployment);
          const mountAsset = value => mount(asset(value));
          if (typeof node.properties.href === 'string')
            node.properties.href = node.tagName === 'a'
              ? markdownAttachmentHref(node.properties.href, deployment, deferAttachmentHrefs)
              : mount(node.properties.href);
          if (typeof node.properties.src === 'string')
            node.properties.src = node.tagName === 'img' ? mount(node.properties.src) : mountAsset(node.properties.src);
          if (typeof node.properties.poster === 'string') node.properties.poster = mountAsset(node.properties.poster);
          if (typeof node.properties.srcSet === 'string')
            node.properties.srcSet = node.properties.srcSet.replace(
              /(^|,)(\s*)(\S+?)(?=,+(?:\s|$)|\s|$)/g,
              (_, separator, whitespace, url) => separator + whitespace + mountAsset(url),
            );
          if (typeof node.properties.style === 'string')
            node.properties.style = mapInlineCssUrls(node.properties.style, mountAsset);
        }
        if (
          node.tagName === 'table' &&
          parent &&
          parent.properties?.className?.includes('table-wrap') !== true
        ) {
          parent.children[index] = {
            type: 'element',
            tagName: 'div',
            properties: { className: ['table-wrap'], tabIndex: 0 },
            children: [node],
          };
        }
        protectedText ||=
          /^(pre|code|kbd|samp|script|style|textarea|svg|math)$/.test(node.tagName) ||
          (node.properties.className || []).some((x) => /^math-(inline|display)$/.test(x));
      }
      if (node.type === 'text' && theme.article.autospace && !protectedText)
        node.value = node.value
          .replace(/([\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af])([A-Za-z0-9])/g, '$1 $2')
          .replace(/([A-Za-z0-9])([\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af])/g, '$1 $2');
      (node.children || []).forEach((child, i) => visit(child, node, i, protectedText));
    }
    visit(tree);
    await Promise.all(dimensions);
  };
}
export function markdownProcessor(deployment, { deferAttachmentHrefs = false } = {}) {
  const processor = unified({
    smartypants: false,
    remarkPlugins: [rejectHexoTags, writingBlocks],
    rehypePlugins: [rehypeRaw, [compatibleHtml, { deployment, deferAttachmentHrefs }], renderMath],
  });
  const create = processor.createRenderer.bind(processor);
  processor.createRenderer = async (shared) => {
    const renderer = await create({
      ...shared,
      shikiConfig: {
        ...shared?.shikiConfig,
        transformers: [...(shared?.shikiConfig?.transformers || []), codeMetadata()],
      },
    });
    return {
      render: async (content, options) => {
        const data = options?.frontmatter || {};
        const enabled = mathEnabled(data);
        return renderer.render(enabled ? protectMath(content) : content, options);
      },
    };
  };
  return processor;
}
