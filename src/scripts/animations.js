import { client, reduced, idle, script, css } from './helpers';
const config = client(),
  labels = config.labels;
(() => {
  try {
    if (!config.animations.enable || reduced.matches || !('IntersectionObserver' in window)) return;
    const effects = ['fade', 'right', 'flip', 'speed', 'rotate', 'slide', 'zoom', 'pulse'];
    const items = [
      ...(config.animations.articles ? document.querySelectorAll('.post-card') : []),
      ...(config.animations.page
        ? document.querySelectorAll(
            '.article-header, .page-heading, .prose > h2, .prose > p, .prose > figure',
          )
        : []),
    ];
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.remove('reveal-pending');
            entry.target.classList.add('reveal-visible');
            observer.unobserve(entry.target);
          }
        }),
      { threshold: 0.02 },
    );
    items.forEach((item, index) => {
      if (item.getBoundingClientRect().height > innerHeight * 0.8) return;
      item.dataset.reveal = effects[index % effects.length];
      item.classList.add('reveal-pending');
      observer.observe(item);
    });
    // A failed observer must never leave the article invisible.
    const showAll = () => {
      observer.disconnect();
      items.forEach((item) => item.classList.remove('reveal-pending'));
    };
    setTimeout(showAll, 3500);
    reduced.addEventListener('change', (event) => {
      if (event.matches) showAll();
    });
  } catch (error) {
    console.warn('AutuSwing optional feature', error);
  }
})();
