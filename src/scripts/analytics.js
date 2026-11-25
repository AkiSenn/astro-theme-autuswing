import { client, idle, script, isLiveSite } from './helpers';
const config = client();
(() => {
  try {
    const analytics = config.analytics || {};
    const start = () =>
      idle(() => {
        if (!isLiveSite()) return;
        if (/^G-[A-Z0-9]+$/i.test(analytics.google_analytics || '')) {
          window.dataLayer = window.dataLayer || [];
          window.gtag = function () {
            window.dataLayer.push(arguments);
          };
          window.gtag('js', new Date());
          window.gtag('config', analytics.google_analytics);
          script(
            'https://www.googletagmanager.com/gtag/js?id=' +
              encodeURIComponent(analytics.google_analytics),
          ).catch(() => {});
        }
        if (/^[a-f\d]{32}$/i.test(analytics.baidu_tongji || '')) {
          window._hmt = window._hmt || [];
          script('https://hm.baidu.com/hm.js?' + analytics.baidu_tongji).catch(() => {});
        }
      });
    if (document.prerendering)
      document.addEventListener('prerenderingchange', start, { once: true });
    else start();
  } catch (error) {
    console.warn('AutuSwing optional feature', error);
  }
})();
