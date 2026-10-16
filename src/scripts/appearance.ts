import { client, toast } from './helpers';
export function initAppearance() {
  const root = document.documentElement,
    modes = ['auto', 'light', 'dark'],
    scheme = matchMedia('(prefers-color-scheme: dark)'),
    config = client();
  function apply(mode: string) {
    root.dataset.mode = modes.includes(mode) ? mode : config.mode;
    root.dataset.theme =
      root.dataset.mode === 'auto' ? (scheme.matches ? 'dark' : 'light') : root.dataset.mode;
    document.querySelectorAll<HTMLButtonElement>('.mode-toggle').forEach((button) => {
      button.dataset.mode = root.dataset.mode;
      button.title = `${config.labels.mode}: ${root.dataset.mode}`;
      button.setAttribute(
        'aria-label',
        `${config.labels.mode}: ${config.labels['mode_' + root.dataset.mode] || root.dataset.mode}`,
      );
    });
    dispatchEvent(new CustomEvent('autuswing:appearance', { detail: root.dataset.theme }));
  }
  apply(root.dataset.mode || config.mode);
  document.querySelectorAll('.mode-toggle').forEach((button) =>
    button.addEventListener('click', () => {
      const mode = modes[(modes.indexOf(root.dataset.mode || 'auto') + 1) % 3];
      try {
        localStorage.setItem('autuswing-appearance', mode);
      } catch {}
      apply(mode);
      toast(config.labels['mode_' + mode]);
    }),
  );
  scheme.addEventListener('change', () => {
    if (root.dataset.mode === 'auto') apply('auto');
  });
  addEventListener('storage', (event) => {
    if (event.key === 'autuswing-appearance') apply(event.newValue || config.mode);
  });
}
