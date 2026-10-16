import { client, reduced, idle, script, css } from './helpers';
const config = client(),
  labels = config.labels;
(() => {
  try {
    const stats = document.querySelector('[data-counter]');
    if (!stats) return;
    const status = stats.querySelector('.statistics-status');
    const local =
      /^(localhost|127(?:\.\d+){3}|0\.0\.0\.0|\[?::1\]?)$/i.test(location.hostname) ||
      /^\d+(\.\d+){3}$/.test(location.hostname);
    if (local && stats.dataset.allowLocal !== 'true') {
      status.textContent = labels.statistics_local;
      return;
    }
    // A loaded provider that never fills the figures (backend down) must still report itself.
    const load = () =>
      script(stats.dataset.src)
        .then(() =>
          setTimeout(() => {
            if (
              [...stats.querySelectorAll('strong')].every((node) => node.textContent.trim() === '—')
            )
              status.textContent = labels.statistics_failed;
          }, 8000),
        )
        .catch(() => {
          status.textContent = labels.statistics_failed;
        });
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            observer.disconnect();
            load();
          }
        },
        { rootMargin: '300px' },
      );
      observer.observe(stats);
    } else load();
  } catch (error) {
    console.warn('AutuSwing optional feature', error);
  }
})();
