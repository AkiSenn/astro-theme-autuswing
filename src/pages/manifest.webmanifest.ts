import { site, theme } from '../site.config';
export function GET() {
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
      icons: [{ src: theme.pwa.icon, sizes: '512x512', type: 'image/png', purpose: 'any' }],
    }),
    { headers: { 'Content-Type': 'application/manifest+json' } },
  );
}
