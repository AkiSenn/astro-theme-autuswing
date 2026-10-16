export type SearchItem = {
  title: string;
  url: string;
  tags: string[];
  categories: string[];
  excerpt: string;
  content: string;
};
export const normalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase();
export function search(items: SearchItem[], query: string, limit = 30) {
  const terms = normalize(query).trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return items
    .map((item) => {
      const title = normalize(item.title),
        tags = normalize([...item.tags, ...item.categories].join(' ')),
        body = normalize(item.content + ' ' + item.excerpt);
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
