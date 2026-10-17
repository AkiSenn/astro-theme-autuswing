import { createHash } from 'node:crypto';
export function serviceWorker(html, enabled = true) {
  const digest = createHash('sha256').update(html).digest('hex');
  return `const CACHE='autuswing-astro-shell-${digest.slice(0, 16)}',DIGEST='${digest}',ENABLED=${enabled};
const owned=key=>key.startsWith('autuswing-astro-shell-')||/^(?:autuswing|sunna)-[a-f0-9]{12}$/.test(key);
self.addEventListener('install',event=>event.waitUntil((async()=>{
  if(ENABLED){
    const response=await fetch(new Request('/offline.html?v='+DIGEST,{cache:'reload'}));
    if(!response.ok)throw new Error('Offline shell unavailable');
    const bytes=await response.clone().arrayBuffer();
    const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
    if(digest!==DIGEST)throw new Error('Offline shell and worker versions differ; retaining active worker');
    await (await caches.open(CACHE)).put('/offline.html',response);
  }
  await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  await Promise.all((await caches.keys()).filter(key=>owned(key)&&(!ENABLED||key!==CACHE)).map(key=>caches.delete(key)));
  await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
  if(!ENABLED||event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin||event.request.mode!=='navigate')return;
  event.respondWith(fetch(event.request).catch(async()=>await (await caches.open(CACHE)).match('/offline.html')||new Response('暂时离线',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}})));
});
`;
}
