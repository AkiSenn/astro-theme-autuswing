import { client, toast } from './helpers';

let dispose: (() => void) | undefined;

export function initAppearance() {
  dispose?.();
  const root = document.documentElement;
  const modes = ['auto', 'light', 'dark'];
  const scheme = matchMedia('(prefers-color-scheme: dark)');
  const config = client();
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('.mode-toggle'));
  const fallback = modes.includes(config.mode) ? config.mode : 'auto';
  function apply(value: string) {
    const mode = modes.includes(value) ? value : fallback;
    const theme = mode === 'auto' ? (scheme.matches ? 'dark' : 'light') : mode;
    root.dataset.mode = mode;
    root.dataset.theme = theme;
    const paper = getComputedStyle(root).getPropertyValue('--paper').trim();
    if (paper)
      document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
        meta.content = paper;
      });
    const selected = config.labels['mode_' + mode] || mode;
    const label = `${config.labels.mode}: ${selected}${mode === 'auto' ? ` (${config.labels['mode_' + theme] || theme})` : ''}`;
    buttons.forEach((button) => {
      button.dataset.mode = mode;
      button.dataset.theme = theme;
      button.title = label;
      button.setAttribute('aria-label', label);
    });
    dispatchEvent(new CustomEvent('autuswing:appearance', { detail: theme }));
  }
  function click() {
    const mode = modes[(modes.indexOf(root.dataset.mode || 'auto') + 1) % modes.length];
    try {
      localStorage.setItem('autuswing-appearance', mode);
    } catch {}
    apply(mode);
    toast(config.labels['mode_' + mode]);
  }
  function systemChange() {
    if (root.dataset.mode === 'auto') apply('auto');
  }
  function storage(event: StorageEvent) {
    if (event.key === null || event.key === 'autuswing-appearance')
      apply(event.newValue || fallback);
  }
  function restore(event: PageTransitionEvent) {
    if (!event.persisted) return;
    let mode = root.dataset.mode || fallback;
    try {
      mode = localStorage.getItem('autuswing-appearance') || fallback;
    } catch {}
    apply(mode);
  }
  function leave(event: PageTransitionEvent) {
    if (!event.persisted) cleanup();
  }
  // Safari 14 的 MediaQueryList 仍使用 addListener；绑定与释放必须成对。
  const modernMedia = typeof scheme.addEventListener === 'function';
  function cleanup() {
    buttons.forEach((button) => button.removeEventListener('click', click));
    if (modernMedia) scheme.removeEventListener('change', systemChange);
    else scheme.removeListener(systemChange);
    removeEventListener('storage', storage);
    removeEventListener('pageshow', restore);
    removeEventListener('pagehide', leave);
    if (dispose === cleanup) dispose = undefined;
  }
  apply(root.dataset.mode || fallback);
  buttons.forEach((button) => button.addEventListener('click', click));
  if (modernMedia) scheme.addEventListener('change', systemChange);
  else scheme.addListener(systemChange);
  addEventListener('storage', storage);
  addEventListener('pageshow', restore);
  addEventListener('pagehide', leave);
  dispose = cleanup;
}
