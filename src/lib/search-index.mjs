import rehypeRaw from 'rehype-raw';

const parse = rehypeRaw();
const blocks = new Set([
  'p',
  'div',
  'section',
  'article',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'li',
  'pre',
  'tr',
  'td',
  'th',
  'blockquote',
  'br',
]);

// 搜索保留代码，摘要与字数统计仍沿用各自规则；公式只读取原始表达式一次。
export function searchText(html) {
  const tree = parse({ type: 'root', children: [{ type: 'raw', value: html }] });
  function text(node) {
    if (['script', 'style', 'template'].includes(node.tagName)) return '';
    if (node.properties?.className?.includes('gutter')) return '';
    if (node.properties?.dataMathSource !== undefined)
      return String(node.properties.dataMathSource);
    if (node.type === 'text') return node.value;
    const value = (node.children || []).map(text).join('');
    return blocks.has(node.tagName) ? ' ' + value + ' ' : value;
  }
  return text(tree).replace(/\s+/g, ' ').trim();
}
