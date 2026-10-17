import { theme } from '../site.config';
import { offlineHtml } from '../lib/offline.mjs';
import { serviceWorker } from '../lib/service-worker.mjs';
export function GET() {
  return new Response(serviceWorker(offlineHtml, theme.pwa.enable), {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  });
}
