import { client } from './helpers';
export function initPwa() {
  if (!('serviceWorker' in navigator)) return;
  addEventListener('load', async () => {
    try {
      const config = client();
      const scope = new URL(config.root, location.origin);
      if (scope.origin !== location.origin || !scope.pathname.endsWith('/')) return;
      const script = new URL('sw.js', scope).href;
      if (config.pwa) {
        const registration = await navigator.serviceWorker.register(script, {
          scope: scope.href,
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
        const registration = await navigator.serviceWorker.getRegistration(scope.href);
        if (registration?.scope === scope.href &&
            [registration.active, registration.waiting, registration.installing].some(worker => worker?.scriptURL === script))
          await registration.unregister();
      }
    } catch (error) {
      console.warn('AutuSwing service worker unavailable', error);
    }
  });
}
