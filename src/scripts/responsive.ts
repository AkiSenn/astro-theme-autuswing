import { openDialog, closeDialog, restoreDialogFocus } from './dialogs';
import { isLegacyDialog } from './legacy-dialog';
import { contentsMotion } from './contents-motion';

export function initResponsive() {
  const wide = matchMedia('(min-width: 1000px)'),
    docked = matchMedia('(min-width: 1280px)'),
    expandedDefault = matchMedia('(min-width: 1440px)'),
    compact = matchMedia('(min-width: 720px)'),
    header = document.querySelector<HTMLElement>('.mobile-header'),
    dialog = document.querySelector<HTMLDialogElement>('.contents-dialog'),
    desktopHeading = document.querySelector<HTMLElement>(
      '#reading-sidebar-title,#desktop-contents-title',
    ),
    panel = document.querySelector<HTMLElement>('.reading-sidebar'),
    rail = document.querySelector<HTMLElement>('.tablet-sidebar'),
    panelClose = document.querySelector<HTMLButtonElement>('.reading-contents-close'),
    buttons = [...document.querySelectorAll<HTMLButtonElement>('.contents-open,.goto-toc')];
  let trigger: HTMLElement | null = null;
  let panelPreference: boolean | null = null;
  const visibleButton = () => buttons.find((button) => button.getClientRects().length) || null;
  const setExpanded = (value: boolean) =>
    buttons.forEach((button) => button.setAttribute('aria-expanded', String(value)));
  const panelOpen = () => !!panel && docked.matches && (panelPreference ?? expandedDefault.matches);
  const animatePanel =
    panel && contentsMotion(panel, () => visibleButton()?.focus({ preventScroll: true }));
  function syncContents(animate = false) {
    animatePanel?.(panelOpen(), animate && docked.matches);
    if (panelPreference === null) delete document.body.dataset.readingContents;
    else document.body.dataset.readingContents = panelPreference ? 'open' : 'closed';
    buttons.forEach((button) => {
      const inDock = !!panel && docked.matches;
      button.setAttribute('aria-controls', inDock ? panel.id : 'reading-contents');
      if (inDock) button.removeAttribute('aria-haspopup');
      else button.setAttribute('aria-haspopup', 'dialog');
      const label = panelOpen() ? button.dataset.closeLabel : button.dataset.openLabel;
      if (label) {
        button.title = label;
        button.setAttribute('aria-label', label);
      }
      // The visible navigation shell chooses the opener. An open contents
      // surface owns its close action; background openers have no role then.
      const hasRail = !!rail?.getClientRects().length;
      const selected = hasRail ? rail!.contains(button) : button.matches('.goto-toc');
      const hasDesktopContents = !panel && wide.matches;
      button.hidden = !selected || panelOpen() || !!dialog?.open || hasDesktopContents;
    });
    setExpanded(panelOpen() || !!dialog?.open);
    if (panelClose) panelClose.hidden = !panelOpen();
    document.dispatchEvent(new Event('reading-contents-change'));
  }
  panelClose?.addEventListener('click', () => {
    panelPreference = false;
    syncContents(true);
    visibleButton()?.focus({ preventScroll: true });
  });
  panel?.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      panelClose?.click();
      event.preventDefault();
    }
  });
  syncContents();
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
      button.addEventListener('click', () => {
        if (panel && docked.matches) {
          panelPreference = !panelOpen();
          syncContents(true);
          if (panelOpen()) desktopHeading?.focus({ preventScroll: true });
          return;
        }
        if (wide.matches && !panel) {
          desktopHeading?.focus();
          return;
        }
        trigger = button;
        openDialog(dialog);
        syncContents();
      });
    });
    dialog.querySelector('.contents-close')?.addEventListener('click', () => closeDialog(dialog));
    dialog.addEventListener('keydown', (event) => {
      if (event.key !== 'Tab') return;
      const targets = [...dialog.querySelectorAll<HTMLElement>('button,a[href]')].filter(
        (node) => node.getClientRects().length,
      );
      const first = targets[0],
        last = targets[targets.length - 1];
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
        closeDialog(dialog);
    });
    let destination: HTMLElement | null = null;
    dialog.querySelectorAll<HTMLAnchorElement>('.toc-link').forEach((link) =>
      link.addEventListener('click', (event) => {
        destination = document.getElementById(decodeURIComponent(link.hash.slice(1)));
        if (isLegacyDialog(dialog)) {
          event.preventDefault();
          const target = destination;
          closeDialog(dialog, true);
          if (location.hash !== link.hash) location.hash = link.hash;
          else target?.scrollIntoView({ block: 'start' });
          return;
        }
        closeDialog(dialog);
      }),
    );
    dialog.addEventListener('close', () => {
      syncContents();
      if (destination && !document.querySelector('dialog[open]')) {
        destination.tabIndex = -1;
        destination.focus({ preventScroll: true });
        destination = null;
      } else {
        destination = null;
        restoreDialogFocus(
          trigger?.getClientRects().length
            ? trigger
            : wide.matches && desktopHeading?.getClientRects().length
              ? desktopHeading
              : visibleButton(),
        );
      }
    });
  }

  function settleLayout() {
    const active = document.activeElement as HTMLElement | null;
    if (dialog?.open) closeDialog(dialog, true);
    syncContents();
    if (active && active !== document.body && !active.getClientRects().length) {
      const key = active.dataset.focusKey;
      const equivalent =
        key &&
        [...document.querySelectorAll<HTMLElement>('[data-focus-key]')].find(
          (node) => node.dataset.focusKey === key && node.getClientRects().length,
        );
      (
        equivalent ||
        (wide.matches && desktopHeading?.getClientRects().length ? desktopHeading : visibleButton())
      )?.focus({
        preventScroll: true,
      });
    }
    updateHeader();
  }
  wide.addEventListener('change', settleLayout);
  compact.addEventListener('change', settleLayout);
  docked.addEventListener('change', settleLayout);
  expandedDefault.addEventListener('change', settleLayout);
}
