import { posts, isIndexable, plain } from '../lib/content';
import { theme } from '../site.config';
export async function GET() {
  const items = (await posts())
    .filter((p) => isIndexable(p) && p.data.search !== false)
    .map((p) => ({
      title: p.title,
      url: p.path,
      tags: p.tags,
      categories: p.categories,
      excerpt: p.excerpt,
      content: theme.search.content ? plain(p.html).slice(0, theme.search.max_content_length) : '',
    }));
  return Response.json(theme.search.enable ? items : []);
}
