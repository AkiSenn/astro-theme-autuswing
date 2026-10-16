import { openDialog, restoreDialogFocus } from './dialogs';

export function initResponsive() {
  const wide = matchMedia('(min-width: 1000px)'),
    compact = matchMedia('(min-width: 720px)'),
    header = document.querySelector<HTMLElement>('.mobile-header'),
    dialog = document.querySelector<HTMLDialogElement>('.contents-dialog'),
    desktopHeading = document.querySelector<HTMLElement>('#desktop-contents-title'),
    buttons = [...document.querySelectorAll<HTMLButtonElement>('.contents-open,.goto-toc')];
  let trigger: HTMLElement | null = null;
  const visibleButton = () => buttons.find((button) => button.getClientRects().length) || null;
  const setExpanded = (value: boolean) =>
    buttons.forEach((button) => button.setAttribute('aria-expanded', String(value)));
  const updateHeader = () => {
    document.documentElement.style.setProperty(
      '--mobile-header-height',
      `${header?.getBoundingClientRect().height || 0}px`,
    );
  };
  updateHeader();
  if (header && 'ResizeObserver' in window) new ResizeObserver(updateHeader).observe(header);
  addEventListener('resize', updateHeader);

  if (dialog) {
    buttons.forEach((button) => {
      button.hidden = false;
      button.addEventListener('click', () => {
        if (wide.matches) {
          desktopHeading?.focus();
          return;
        }
        trigger = button;
        setExpanded(true);
        openDialog(dialog);
      });
    });
    dialog.querySelector('.contents-close')?.addEventListener('click', () => dialog.close());
    dialog.addEventListener('keydown', (event) => {
      if (event.key !== 'Tab') return;
      const targets = [...dialog.querySelectorAll<HTMLElement>('button,a[href]')].filter(
        (node) => node.getClientRects().length,
      );
      const first = targets[0],
        last = targets.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    });
    dialog.addEventListener('click', (event) => {
      if (event.target !== dialog) return;
      const box = dialog.getBoundingClientRect();
      if (
        event.clientX < box.left ||
        event.clientX > box.right ||
        event.clientY < box.top ||
        event.clientY > box.bottom
      )
        dialog.close();
    });
    let destination: HTMLElement | null = null;
    dialog.querySelectorAll<HTMLAnchorElement>('.toc-link').forEach((link) =>
      link.addEventListener('click', () => {
        destination = document.getElementById(decodeURIComponent(link.hash.slice(1)));
        dialog.close();
      }),
    );
    dialog.addEventListener('close', () => {
      setExpanded(false);
      if (destination && !document.querySelector('dialog[open]')) {
        destination.tabIndex = -1;
        destination.focus({ preventScroll: true });
        destination = null;
      } else {
        destination = null;
        restoreDialogFocus(
          trigger?.getClientRects().length
            ? trigger
            : wide.matches
              ? desktopHeading
              : visibleButton(),
        );
      }
    });
  }

  function settleLayout() {
    const active = document.activeElement as HTMLElement | null;
    if (dialog?.open) dialog.close();
    if (active && active !== document.body && !active.getClientRects().length) {
      const key = active.dataset.focusKey;
      const equivalent =
        key &&
        [...document.querySelectorAll<HTMLElement>('[data-focus-key]')].find(
          (node) => node.dataset.focusKey === key && node.getClientRects().length,
        );
      (equivalent || (wide.matches ? desktopHeading : visibleButton()))?.focus({
        preventScroll: true,
      });
    }
    updateHeader();
  }
  wide.addEventListener('change', settleLayout);
  compact.addEventListener('change', settleLayout);
}
