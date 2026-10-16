import rss from '@astrojs/rss';
import { feedPosts, feedContent, xml } from '../lib/feeds';
import { absolute } from '../lib/urls';
import { site } from '../site.config';
export async function GET() {
  return rss({
    title: site.title,
    description: site.description,
    site: site.url,
    items: (await feedPosts()).map((p) => ({
      title: p.title,
      pubDate: new Date(p.date),
      description: p.excerpt,
      link: p.path,
      content: feedContent(p),
      categories: p.categories,
      customData: `<guid isPermaLink="true">${xml(absolute(p.path))}</guid>`,
    })),
    customData: `<language>${xml(site.language)}</language>`,
  });
}
