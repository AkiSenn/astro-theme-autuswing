import { client } from './helpers';
export function initPwa() {
  if (!('serviceWorker' in navigator)) return;
  addEventListener('load', async () => {
    try {
      if (client().pwa) {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        });
        let lastCheck = Date.now();
        const update = () => {
          if (!navigator.onLine || Date.now() - lastCheck < 60000) return;
          lastCheck = Date.now();
          void registration.update().catch(() => {});
        };
        addEventListener('online', () => {
          lastCheck = 0;
          update();
        });
        addEventListener('pageshow', update);
        document.addEventListener('visibilitychange', () => {
          if (!document.hidden) update();
        });
        // Claiming a new network-first worker does not reload open documents.
      } else {
        for (const registration of await navigator.serviceWorker.getRegistrations())
          if (registration.active?.scriptURL === new URL('/sw.js', location.origin).href)
            await registration.unregister();
      }
    } catch (error) {
      console.warn('AutuSwing service worker unavailable', error);
    }
  });
}
