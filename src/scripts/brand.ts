import { scrollBehavior } from './helpers';

let disposeBrand: (() => void) | undefined;

// A home-page brand click is still a return-to-top action. Other links retain
// native navigation, including modified clicks and browser history behavior.
export function initBrand() {
  disposeBrand?.();
  const subscriptions: (() => void)[] = [];
  const listen = (
    target: EventTarget,
    name: string,
    handler: EventListener,
    options?: AddEventListenerOptions | boolean,
  ) => {
    target.addEventListener(name, handler, options);
    subscriptions.push(() => target.removeEventListener(name, handler, options));
  };
  document.querySelectorAll<HTMLAnchorElement>('.avatar-home').forEach((link) => {
    listen(link, 'click', (event) => {
      const e = event as MouseEvent;
      if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const target = new URL(link.href);
      if (target.origin !== location.origin) return;
      if (
        location.pathname !== target.pathname &&
        location.pathname !== target.pathname + 'index.html'
      )
        return;
      e.preventDefault();
      scrollTo({ top: 0, behavior: scrollBehavior() });
    });
  });
  const cleanup = () => {
    subscriptions.splice(0).forEach((remove) => remove());
    if (disposeBrand === cleanup) disposeBrand = undefined;
  };
  listen(window, 'pagehide', (event) => {
    if (!(event as PageTransitionEvent).persisted) cleanup();
  });
  disposeBrand = cleanup;
  return cleanup;
}
