import type { APIRoute, GetStaticPaths } from 'astro';
import { theme } from '../../site.config';
import { pwaIcons } from '../../lib/pwa-icons.mjs';
export const getStaticPaths: GetStaticPaths = async () =>
  theme.pwa.enable
    ? (await pwaIcons(theme.pwa.icon)).map((icon) => ({
        params: { icon: icon.src.split('/').pop() },
      }))
    : [];
export const GET: APIRoute = async ({ params }) => {
  const icon =
    theme.pwa.enable &&
    (await pwaIcons(theme.pwa.icon)).find((item) => item.src.split('/').pop() === params.icon);
  return icon
    ? new Response(new Uint8Array(icon.data), {
        headers: {
          'Content-Type': icon.type,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      })
    : new Response(null, { status: 404 });
};
