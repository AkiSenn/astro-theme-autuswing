import { site, theme } from '../site.config';
import { pwaIcons } from '../lib/pwa-icons.mjs';
export async function GET() {
  return new Response(
    JSON.stringify({
      name: site.title,
      short_name: theme.pwa.short_name,
      start_url: '/',
      scope: '/',
      display: 'standalone',
      lang: site.language,
      background_color: '#f5f4f0',
      theme_color: '#31594a',
      icons: theme.pwa.enable
        ? (await pwaIcons(theme.pwa.icon)).map(({ data, ...icon }) => icon)
        : [],
    }),
    { headers: { 'Content-Type': 'application/manifest+json' } },
  );
}
