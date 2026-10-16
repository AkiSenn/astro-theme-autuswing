import katex from 'katex';
import rehypeRaw from 'rehype-raw';
import theme from '../config/theme.json' with { type: 'json' };
import vendor from '../../public/assets/vendor/manifest.json' with { type: 'json' };
export const katexVersion = katex.version;
if (katexVersion !== vendor.packages.katex.version)
  throw new Error('Build-time KaTeX and the local stylesheet/fonts must use the same version');

// Legacy flags enable/disable math; they no longer select a browser engine.
// New posts are detected automatically. Explicit math:false has priority.
export function mathEnabled(data = {}, enabled = theme.math.enable) {
  if (!enabled) return false;
  if (data.math !== undefined) {
    if (data.math === false || /^(false|off|none)$/i.test(String(data.math))) return false;
    return true;
  }
  if (data.mathjax === true || data.katex === true) return true;
  return data.mathjax !== false && data.katex !== false;
}

const text = (node) =>
  node.type === 'text' ? node.value : (node.children || []).map(text).join('');
const parseHtml = rehypeRaw();
export function renderMath() {
  return (tree, file) => {
    const options = theme.math.katex?.config || {};
    const macros = structuredClone(options.macros || {});
    function visit(node) {
      if (node.type === 'element' && node.properties?.dataMath === 'tex') {
        const raw = text(node),
          delimiter = raw.startsWith('$$') ? '$$' : raw.startsWith('\\') ? raw.slice(0, 2) : '$';
        const tex = raw.slice(delimiter.length, -delimiter.length);
        try {
          const html = katex.renderToString(tex, {
            ...options,
            macros,
            displayMode: node.properties.className.includes('math-display'),
            output: 'htmlAndMathml',
            throwOnError: true,
            trust: false,
          });
          node.children = parseHtml(
            { type: 'root', children: [{ type: 'raw', value: html }] },
            file,
          ).children;
          delete node.properties.dataMath;
          node.properties.dataMathRendered = 'katex';
          node.properties.dataMathSource = raw;
        } catch (error) {
          const title = file.data.astro?.frontmatter?.title || file.path || 'untitled article';
          file.fail(
            `KaTeX failed in "${title}" for ${JSON.stringify(tex)}: ${error.message}. Review the command before considering MathJax; no automatic fallback was applied.`,
            node,
          );
        }
        return;
      }
      for (const child of node.children || []) visit(child);
    }
    visit(tree);
  };
}

// KaTeX includes both accessibility MathML and visual HTML. Read the original
// expression once for search/word counts, rather than indexing it three times.
export function mathPlainText(html) {
  if (!html.includes('data-math-rendered=')) return null;
  const tree = parseHtml({ type: 'root', children: [{ type: 'raw', value: html }] });
  function visit(node) {
    if (/^(script|style|pre)$/.test(node.tagName)) return '';
    if (node.properties?.dataMathSource !== undefined)
      return String(node.properties.dataMathSource);
    return node.type === 'text' ? node.value : (node.children || []).map(visit).join(' ');
  }
  return visit(tree);
}
