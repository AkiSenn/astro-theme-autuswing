import { feedPosts, feedContent, xml } from '../lib/feeds';
import { site, theme } from '../site.config';
import { absolute } from '../lib/urls';
export async function GET() {
  const all = await feedPosts(),
    updated =
      all
        .map((p) => p.updated)
        .sort()
        .at(-1) || '2020-08-24T16:00:00.000Z';
  const body = `<?xml version="1.0" encoding="utf-8"?><feed xmlns="http://www.w3.org/2005/Atom"><title>${xml(site.title)}</title><id>${xml(site.url)}/</id><link href="${xml(site.url)}/"/><link href="${xml(site.url)}/atom.xml" rel="self"/><updated>${updated}</updated><author><name>${xml(theme.profile.author)}</name></author>${all.map((p) => `<entry><title>${xml(p.title)}</title><id>${xml(absolute(p.path))}</id><link href="${xml(absolute(p.path))}"/><published>${p.date}</published><updated>${p.updated}</updated><summary>${xml(p.excerpt)}</summary><content type="html">${xml(feedContent(p))}</content></entry>`).join('')}</feed>`;
  return new Response(body, { headers: { 'Content-Type': 'application/atom+xml; charset=utf-8' } });
}
