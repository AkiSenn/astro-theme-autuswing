import { scrollBehavior } from './helpers';

// A home-page brand click is still a return-to-top action. Other links retain
// native navigation, including modified clicks and browser history behavior.
export function initBrand() {
  document.querySelectorAll<HTMLAnchorElement>('.avatar-home').forEach((link) => {
    link.addEventListener('click', (event) => {
      if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = new URL(link.href);
      if (target.origin !== location.origin) return;
      if (
        location.pathname !== target.pathname &&
        location.pathname !== target.pathname + 'index.html'
      )
        return;
      event.preventDefault();
      scrollTo({ top: 0, behavior: scrollBehavior() });
    });
  });
}
