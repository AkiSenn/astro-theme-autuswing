import { client, reduced } from './helpers';
const config = client();
// Content stays visible. Only elements already in view receive a short lift.
if (config.animations.enable && !reduced.matches && Element.prototype.animate) {
  const items = [
    ...(config.animations.articles ? document.querySelectorAll('.post-card') : []),
    ...(config.animations.page ? document.querySelectorAll('.article-header,.page-heading') : []),
  ];
  const active = items
    .filter((node) => {
      const box = node.getBoundingClientRect();
      return box.bottom > 0 && box.top < innerHeight;
    })
    .map((node) =>
      node.animate([{ transform: 'translateY(6px)' }, { transform: 'none' }], {
        duration: 180,
        easing: 'ease-out',
      }),
    );
  reduced.addEventListener('change', (event) => {
    if (event.matches) active.forEach((animation) => animation.cancel());
  });
}
