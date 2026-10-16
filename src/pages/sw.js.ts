import { theme } from '../site.config';
export function GET() {
  return new Response(
    `const CACHE='autuswing-astro-shell-v2',ENABLED=${theme.pwa.enable};
self.addEventListener('install',event=>{event.waitUntil((ENABLED?caches.open(CACHE).then(cache=>cache.addAll(['/offline.html'])):Promise.resolve()).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>(key.startsWith('autuswing-')||key.startsWith('sunna-'))&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{if(!ENABLED||event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).catch(()=>caches.match('/offline.html')));return;}
});
`,
    {
      headers: {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    },
  );
}
