export type SearchItem = {
  title: string;
  url: string;
  tags: string[];
  categories: string[];
  excerpt: string;
  content: string;
};
export const normalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase();
const prepared = new WeakMap<
  SearchItem,
  { title: string; tags: string; content: string; body: string }
>();
function index(item: SearchItem) {
  let value = prepared.get(item);
  if (!value) {
    const content = normalize(item.content);
    value = {
      title: normalize(item.title),
      tags: normalize([...item.tags, ...item.categories].join(' ')),
      content,
      body: content + ' ' + normalize(item.excerpt),
    };
    prepared.set(item, value);
  }
  return value;
}

const queryTerms = (query: string) => [
  ...new Set(normalize(query).trim().split(/\s+/).filter(Boolean)),
];

export function search(items: SearchItem[], query: string, limit = 30) {
  const terms = queryTerms(query);
  if (!terms.length) return [];
  return items
    .map((item) => {
      const { title, tags, body } = index(item);
      const scores = terms.map(
        (term) =>
          (title.includes(term) ? 12 : 0) +
          (tags.includes(term) ? 6 : 0) +
          (body.includes(term) ? 1 : 0),
      );
      return { item, score: scores.every(Boolean) ? scores.reduce((a, b) => a + b, 0) : 0 };
    })
    .filter((x) => x.score)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.item);
}

export function searchExcerpt(item: SearchItem, query: string, length = 140) {
  const terms = queryTerms(query),
    content = index(item).content;
  const size = Math.max(1, Math.floor(length));
  const hits = terms.map((term) => content.indexOf(term)).filter((at) => at >= 0);
  if (!hits.length) return (item.excerpt || item.content).slice(0, size);
  const before = Math.floor(size / 3);
  // 只比较每个查询词的首个命中窗口，不为高频词枚举整篇文章的所有出现位置。
  const anchor = hits.reduce((best, at) => {
    const score = (position: number) => {
      const window = content.slice(
        Math.max(0, position - before),
        Math.max(0, position - before) + size,
      );
      return terms.filter((term) => window.includes(term)).length;
    };
    return score(at) > score(best) || (score(at) === score(best) && at < best) ? at : best;
  }, hits[0]);
  let low = Math.min(anchor, item.content.length);
  const around = (position: number) =>
    item.content.slice(Math.max(0, position - before), Math.max(0, position - before) + size);
  const anchorTerm = terms.find((term) => content.indexOf(term) === anchor)!;
  // 常见文本只规范化短窗口；连字等造成位置偏移时才回查原文，不保存全文逐字映射。
  if (!normalize(around(low)).includes(anchorTerm)) {
    low = 0;
    let high = item.content.length;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (normalize(item.content.slice(0, middle)).length < anchor) low = middle + 1;
      else high = middle;
    }
  }
  let start = Math.max(0, low - before),
    end = Math.min(item.content.length, start + size);
  if (start > 0 && /[\uDC00-\uDFFF]/.test(item.content[start])) start--;
  if (end < item.content.length && /[\uDC00-\uDFFF]/.test(item.content[end])) end++;
  return (
    (start ? '…' : '') + item.content.slice(start, end) + (end < item.content.length ? '…' : '')
  );
}
