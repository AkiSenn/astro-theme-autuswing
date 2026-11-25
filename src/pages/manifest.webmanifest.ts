import { site, theme } from '../site.config';
import { pwaIcons } from '../lib/pwa-icons.mjs';
import { getDeployment, mountPath } from '../lib/deployment.mjs';
export async function GET() {
  const deployment = getDeployment();
  const { basePath } = deployment;
  return new Response(
    JSON.stringify({
      name: site.title,
      short_name: site.pwa.short_name,
      start_url: basePath,
      scope: basePath,
      ...(basePath !== '/' && { id: basePath }),
      display: 'standalone',
      lang: site.language,
      background_color: '#f5f4f0',
      theme_color: '#31594a',
      icons: theme.pwa.enable && site.pwa.icon
        ? (await pwaIcons(site.pwa.icon)).map(({ data, ...icon }) => ({ ...icon, src: mountPath(icon.src, deployment) }))
        : [],
    }),
    { headers: { 'Content-Type': 'application/manifest+json' } },
  );
}
