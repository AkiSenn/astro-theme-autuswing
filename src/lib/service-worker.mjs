import { createHash } from 'node:crypto';
import { getDeployment, mountPath } from './deployment.mjs';
import { siteIdentity as site } from './site-identity.mjs';
import zh from '../config/zh-CN.json' with { type: 'json' };
import en from '../config/default.json' with { type: 'json' };

const sha256 = value => createHash('sha256').update(value).digest('hex');

export function pwaCachePrefix({ mode, origin, basePath }) {
  return 'autuswing-pwa-' + sha256(JSON.stringify([mode, origin, basePath])) + '-';
}

export const pwaReleaseId = inputs =>
  sha256(JSON.stringify(inputs.filter(({ file }) => !/^(?:tests\/|playwright\.)/.test(file))));

export function serviceWorker(html, enabled = true, {
  deployment = getDeployment(), release = '', routes = ['/', '/offline.html'],
  language = site.language,
} = {}) {
  const labels = language.toLowerCase().startsWith('en') ? en : zh;
  const digest = sha256(html);
  const prefix = pwaCachePrefix(deployment);
  const version = sha256(JSON.stringify([release, digest]));
  const base = deployment.basePath;
  const offline = mountPath('/offline.html', deployment);
  const owned = new Set([base, offline]);
  for (const route of routes) {
    const pathname = new URL(mountPath(route, deployment), deployment.origin).pathname;
    owned.add(pathname);
    if (pathname !== base && pathname.endsWith('/')) owned.add(pathname.slice(0, -1));
  }
  return `const PREFIX=${JSON.stringify(prefix)},CACHE=PREFIX+'${version}',DIGEST='${digest}',ENABLED=${enabled};
const BASE=${JSON.stringify(base)},OFFLINE=${JSON.stringify(offline)},NAVIGATION=new Set(${JSON.stringify([...owned].sort())});
const owned=key=>(key.startsWith(PREFIX)&&/^[a-f0-9]{64}$/.test(key.slice(PREFIX.length)))||
  (BASE==='/'&&(/^(?:autuswing|sunna)-[a-f0-9]{12}$/.test(key)||/^autuswing-astro-shell-(?:v[12]|[a-f0-9]{16})$/.test(key)));
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const scope=new URL(self.registration.scope);
  if(scope.origin!==self.location.origin||scope.pathname!==BASE)throw new Error('Unexpected Autuswing worker scope');
  if(ENABLED){
    const response=await fetch(new Request(OFFLINE+'?v='+DIGEST,{cache:'reload',redirect:'error'}));
    if(!response.ok)throw new Error('Offline shell unavailable');
    const bytes=await response.clone().arrayBuffer();
    const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
    if(digest!==DIGEST)throw new Error('Offline shell and worker versions differ; retaining active worker');
    await (await caches.open(CACHE)).put(OFFLINE,response);
  }
  await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  await Promise.all((await caches.keys()).filter(key=>owned(key)&&(!ENABLED||key!==CACHE)).map(key=>caches.delete(key)));
  await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
  if(!ENABLED||event.request.method!=='GET'||event.request.mode!=='navigate')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin||!NAVIGATION.has(url.pathname))return;
  event.respondWith(fetch(event.request).catch(async()=>await caches.match(OFFLINE,{cacheName:CACHE})||new Response(${JSON.stringify(labels.offline_title)},{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}})));
});
`;
}
