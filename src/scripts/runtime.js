import { client, reduced, idle, script, css } from './helpers';
const config = client(),
  labels = config.labels;
(() => {
  try {
    const node = document.querySelector('.site-runtime');
    if (!node) return;
    const date = /^\d{4}-\d{2}-\d{2}$/.test(node.dataset.since)
      ? node.dataset.since + 'T00:00:00+08:00'
      : node.dataset.since;
    const start = Date.parse(date);
    if (!Number.isFinite(start)) {
      node.hidden = true;
      return;
    }
    let visible = true,
      timer;
    function tick() {
      clearTimeout(timer);
      if (!visible || document.hidden) return;
      const seconds = Math.max(0, Math.floor((Date.now() - start) / 1000));
      const values = {
        d: Math.floor(seconds / 86400),
        h: Math.floor(seconds / 3600) % 24,
        m: Math.floor(seconds / 60) % 60,
        s: seconds % 60,
      };
      node.textContent =
        (node.dataset.prefix || labels.runtime) +
        ' ' +
        labels.runtime_format.replace(/\{([dhms])\}/g, (_, key) => String(values[key]));
      timer = setTimeout(tick, 1000);
    }
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        visible = entries[0].isIntersecting;
        tick();
      });
      observer.observe(node);
    }
    document.addEventListener('visibilitychange', tick);
    tick();
  } catch (error) {
    console.warn('AutuSwing optional feature', error);
  }
})();
