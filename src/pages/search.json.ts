import { posts, isIndexable } from '../lib/content';
import { searchText } from '../lib/search-index.mjs';
import { mountPath } from '../lib/deployment.mjs';
import { theme } from '../site.config';
export async function GET() {
  const items = (await posts())
    .filter((p) => isIndexable(p) && p.data.search !== false)
    .map((p) => ({
      title: p.title,
      url: mountPath(p.path),
      tags: p.tags,
      categories: p.categories,
      excerpt: p.excerpt,
      content: theme.search.content ? searchText(p.html) : '',
    }));
  return Response.json(theme.search.enable ? items : []);
}
