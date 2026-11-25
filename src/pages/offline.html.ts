import { offlineHtml } from '../lib/offline.mjs';
export function GET() {
  return new Response(offlineHtml, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
