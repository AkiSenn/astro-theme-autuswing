import { preview, theme } from '../site.config';
import { absolute } from '../lib/urls';
export function GET() {
  return new Response(
    preview
      ? 'User-agent: *\nDisallow: /\n'
      : theme.seo.robots
        ? `User-agent: *\nAllow: /\n${theme.seo.sitemap ? `Sitemap: ${absolute('/sitemap.xml')}\nSitemap: ${absolute('/baidusitemap.xml')}\n` : ''}`
        : '',
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  );
}
