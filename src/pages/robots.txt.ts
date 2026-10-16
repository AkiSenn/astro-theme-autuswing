import { preview, site, theme } from '../site.config';
export function GET() {
  return new Response(
    preview
      ? 'User-agent: *\nDisallow: /\n'
      : theme.seo.robots
        ? `User-agent: *\nAllow: /\n${theme.seo.sitemap ? `Sitemap: ${site.url}/sitemap.xml\nSitemap: ${site.url}/baidusitemap.xml\n` : ''}`
        : '',
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  );
}
