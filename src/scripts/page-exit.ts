import { motionEnabled } from './helpers';

const EXIT_MS = 120;

let disposePageExit: (() => void) | undefined;

export function initPageExit() {
  disposePageExit?.();
  const root = document.documentElement;
  const reset = () => {
    delete root.dataset.pageExit;
  };
  reset();

  if (!document.getElementById('autuswing-page-entry')) return;
  const revealEvent = (window as unknown as Record<string, unknown>).PageRevealEvent as
    | (Function & { prototype?: object })
    | undefined;
  const hasNativeCrossDocument =
    'onpagereveal' in window &&
    typeof revealEvent === 'function' &&
    !!revealEvent.prototype &&
    'viewTransition' in revealEvent.prototype &&
    'CSSViewTransitionRule' in window;
  if (hasNativeCrossDocument) return;

  let timer: ReturnType<typeof setTimeout> | undefined;
  const cancel = () => {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
    reset();
  };

  const onClick = (event: MouseEvent) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      !motionEnabled()
    )
      return;
    const anchor = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[href]');
    if (!anchor) return;
    if (
      anchor.hasAttribute('download') ||
      (anchor.target && anchor.target !== '_self') ||
      anchor.relList?.contains('external')
    )
      return;
    let url: URL;
    try {
      url = new URL(anchor.href, location.href);
    } catch {
      return;
    }
    if (url.origin !== location.origin) return;
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
    if (url.pathname === location.pathname && url.search === location.search) return;

    event.preventDefault();
    if (timer !== undefined) clearTimeout(timer);
    root.dataset.pageExit = '';
    timer = setTimeout(() => {
      timer = undefined;
      location.assign(url.href);
    }, EXIT_MS);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') cancel();
  };

  document.addEventListener('click', onClick);
  document.addEventListener('keydown', onKeyDown);
  window.addEventListener('pagehide', cancel);
  window.addEventListener('pageshow', cancel);

  disposePageExit = () => {
    cancel();
    document.removeEventListener('click', onClick);
    document.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('pagehide', cancel);
    window.removeEventListener('pageshow', cancel);
    disposePageExit = undefined;
  };
}
