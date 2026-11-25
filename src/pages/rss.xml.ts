import rss from '@astrojs/rss';
import { feedPosts, feedContent, xml } from '../lib/feeds';
import { absolute } from '../lib/urls';
import { site } from '../site.config';
import { getDeployment, mountPath } from '../lib/deployment.mjs';
export async function GET() {
  const mounted = getDeployment().basePath !== '/';
  const self = mounted ? '<atom:link href="' + xml(absolute('/rss.xml')) + '" rel="self" type="application/rss+xml"/>' : '';
  return rss({
    title: site.title,
    description: site.description,
    site: absolute('/'),
    xmlns: { dc: 'http://purl.org/dc/elements/1.1/', ...(mounted ? { atom: 'http://www.w3.org/2005/Atom' } : {}) },
    items: (await feedPosts()).map((p) => ({
      title: p.title,
      pubDate: new Date(p.date),
      description: p.excerpt,
      link: mountPath(p.path),
      content: feedContent(p),
      categories: p.categories,
      customData: `<guid isPermaLink="true">${xml(absolute(p.path))}</guid><dc:creator>${xml(p.data.author || site.author)}</dc:creator>`,
    })),
    customData: `${self}<language>${xml(site.language)}</language><dc:creator>${xml(site.author)}</dc:creator>`,
  });
}
