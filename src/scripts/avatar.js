import { client, reduced, idle, script, css } from './helpers';
const config = client(),
  labels = config.labels;
(() => {
  try {
    document.querySelectorAll('.avatar-home').forEach((link) => {
      let timer;
      function shake() {
        if (!config.animations.enable || !config.animations.avatar || reduced.matches) return;
        clearTimeout(timer);
        link.classList.remove('avatar-shake');
        void link.offsetWidth;
        link.classList.add('avatar-shake');
        timer = setTimeout(() => link.classList.remove('avatar-shake'), 500);
      }
      link.addEventListener('pointerenter', shake);
      link.addEventListener('click', (event) => {
        if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
          return;
        const target = new URL(link.href);
        if (target.origin !== location.origin) return;
        const home =
          location.pathname === target.pathname ||
          location.pathname === target.pathname + 'index.html';
        if (home) {
          event.preventDefault();
          shake();
          document.querySelector('.drawer-close')?.click();
          scrollTo({ top: 0, behavior: reduced.matches ? 'instant' : 'smooth' });
        } else if (config.animations.enable && config.animations.avatar && !reduced.matches) {
          shake();
        }
      });
    });
  } catch (error) {
    console.warn('AutuSwing optional feature', error);
  }
})();
