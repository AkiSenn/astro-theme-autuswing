import { client } from './helpers';
export function initPwa() {
  if (!('serviceWorker' in navigator)) return;
  addEventListener('load', async () => {
    try {
      if (client().pwa) {
        await navigator.serviceWorker.register('/sw.js', { scope: '/' });
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
