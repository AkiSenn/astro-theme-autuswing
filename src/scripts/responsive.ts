import { openDialog, closeDialog, restoreDialogFocus } from './dialogs';
import { isLegacyDialog } from './legacy-dialog';
import { contentsMotion } from './contents-motion';

type LegacyMediaQuery = {
  addListener?: (cb: () => void) => void;
  removeListener?: (cb: () => void) => void;
};

const TOC_STORAGE_KEY = 'autuswing-reading-contents';

function readStoredContents(): boolean | null {
  try {
    const value = localStorage.getItem(TOC_STORAGE_KEY);
    if (value === 'open') return true;
    if (value === 'closed') return false;
  } catch {}
  return null;
}

function writeStoredContents(value: boolean) {
  try {
    localStorage.setItem(TOC_STORAGE_KEY, value ? 'open' : 'closed');
  } catch {}
}

let disposeResponsive: (() => void) | undefined;

export function initResponsive() {
  disposeResponsive?.();
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
  const subscriptions: (() => void)[] = [];
  let disposed = false;
  let trigger: HTMLElement | null = null;
  let panelPreference: boolean | null = readStoredContents();
  let destination: HTMLElement | null = null;
  let tocNavigating = false;
  let lastHeaderHeight = -1;
  let headerObserver: ResizeObserver | undefined;
  let tooltip: HTMLDivElement | null = null;
  let tooltipAnchor: HTMLElement | null = null;
  const listen = (
    target: EventTarget,
    name: string,
    handler: EventListener,
    options?: AddEventListenerOptions | boolean,
  ) => {
    target.addEventListener(name, handler, options);
    subscriptions.push(() => target.removeEventListener(name, handler, options));
  };
  const onMedia = (query: MediaQueryList, handler: () => void) => {
    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', handler);
      subscriptions.push(() => query.removeEventListener('change', handler));
    } else {
      const legacy = query as unknown as LegacyMediaQuery;
      if (typeof legacy.addListener === 'function') {
        legacy.addListener(handler);
        subscriptions.push(() => legacy.removeListener?.(handler));
      }
    }
  };
  const visibleButton = () => buttons.find((button) => button.getClientRects().length) || null;
  const setExpanded = (value: boolean) =>
    buttons.forEach((button) => button.setAttribute('aria-expanded', String(value)));
  const panelOpen = () => !!panel && docked.matches && (panelPreference ?? expandedDefault.matches);
  const animatePanel =
    panel && contentsMotion(panel, () => visibleButton()?.focus({ preventScroll: true }));
  function clearDestination() {
    destination = null;
    tocNavigating = false;
  }
  function syncContents(animate = false) {
    if (disposed) return;
    animatePanel?.(panelOpen(), animate && docked.matches);
    if (panelPreference === null) {
      delete document.body.dataset.readingContents;
      delete document.documentElement.dataset.readingContents;
    } else {
      const state = panelPreference ? 'open' : 'closed';
      document.body.dataset.readingContents = state;
      document.documentElement.dataset.readingContents = state;
    }
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
  if (panelClose) {
    listen(panelClose, 'click', () => {
      panelPreference = false;
      writeStoredContents(false);
      syncContents(true);
      visibleButton()?.focus({ preventScroll: true });
    });
  }
  listen(window, 'storage', (event) => {
    const storageEvent = event as StorageEvent;
    if (storageEvent.key !== TOC_STORAGE_KEY) return;
    const next =
      storageEvent.newValue === 'open'
        ? true
        : storageEvent.newValue === 'closed'
          ? false
          : null;
    if (next === panelPreference) return;
    panelPreference = next;
    syncContents();
  });
  if (panel) {
    listen(panel, 'keydown', (event) => {
      if ((event as KeyboardEvent).key === 'Escape') {
        panelClose?.click();
        event.preventDefault();
      }
    });
  }
  syncContents();
  const updateHeader = () => {
    const height = header?.getBoundingClientRect().height || 0;
    document.documentElement.style.setProperty('--mobile-header-height', `${height}px`);
    if (lastHeaderHeight !== -1 && height !== lastHeaderHeight) {
      document.dispatchEvent(new Event('autuswing:layout-change'));
    }
    lastHeaderHeight = height;
  };
  updateHeader();
  if (header && 'ResizeObserver' in window) {
    headerObserver = new ResizeObserver(updateHeader);
    headerObserver.observe(header);
  }
  listen(window, 'resize', updateHeader);

  if (dialog) {
    buttons.forEach((button) => {
      listen(button, 'click', () => {
        if (panel && docked.matches) {
          panelPreference = !panelOpen();
          writeStoredContents(panelPreference);
          syncContents(true);
          if (panelOpen()) desktopHeading?.focus({ preventScroll: true });
          return;
        }
        if (wide.matches && !panel) {
          desktopHeading?.focus();
          return;
        }
        clearDestination();
        trigger = button;
        openDialog(dialog);
        syncContents();
      });
    });
    const dialogClose = dialog.querySelector('.contents-close');
    if (dialogClose) {
      listen(dialogClose, 'click', () => {
        clearDestination();
        closeDialog(dialog);
      });
    }
    listen(dialog, 'cancel', () => {
      clearDestination();
    });
    listen(dialog, 'keydown', (event) => {
      if ((event as KeyboardEvent).key !== 'Tab') return;
      const targets = [...dialog.querySelectorAll<HTMLElement>('button,a[href]')].filter(
        (node) => node.getClientRects().length,
      );
      const first = targets[0],
        last = targets[targets.length - 1];
      if ((event as KeyboardEvent).shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!(event as KeyboardEvent).shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    });
    listen(dialog, 'click', (event) => {
      if (event.target !== dialog) return;
      const box = dialog.getBoundingClientRect();
      const pointer = event as MouseEvent;
      if (
        pointer.clientX < box.left ||
        pointer.clientX > box.right ||
        pointer.clientY < box.top ||
        pointer.clientY > box.bottom
      ) {
        clearDestination();
        closeDialog(dialog);
      }
    });
    dialog.querySelectorAll<HTMLAnchorElement>('.toc-link').forEach((link) =>
      listen(link, 'click', (event) => {
        let id: string;
        try {
          id = decodeURIComponent(link.hash.slice(1));
        } catch {
          clearDestination();
          return;
        }
        destination = document.getElementById(id);
        tocNavigating = !!destination;
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
    listen(dialog, 'close', () => {
      const replaced = dialog.dataset.replaced === 'true';
      if (replaced) delete dialog.dataset.replaced;
      const target = tocNavigating ? destination : null;
      clearDestination();
      syncContents();
      if (replaced) return;
      if (target && !document.querySelector('dialog[open]')) {
        target.tabIndex = -1;
        target.focus({ preventScroll: true });
      } else {
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
    if (disposed) return;
    hideTooltip();
    const active = document.activeElement as HTMLElement | null;
    clearDestination();
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
  onMedia(wide, settleLayout);
  onMedia(compact, settleLayout);
  onMedia(docked, settleLayout);
  onMedia(expandedDefault, settleLayout);

  function hideTooltip() {
    tooltipAnchor = null;
    if (!tooltip) return;
    tooltip.classList.remove('visible');
    tooltip.hidden = true;
  }

  function showTooltip(target: HTMLElement) {
    if (disposed || !rail?.getClientRects().length) return;
    const label = (target.getAttribute('aria-label') || target.getAttribute('title') || '').trim();
    if (!label) return;
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.className = 'rail-tooltip';
      tooltip.setAttribute('role', 'tooltip');
      tooltip.hidden = true;
      document.body.append(tooltip);
    }
    const rect = target.getBoundingClientRect();
    if (!rect.width && !rect.height) return;
    const railRect = rail.getBoundingClientRect();
    tooltipAnchor = target;
    tooltip.textContent = label;
    tooltip.style.left = `${Math.round(Math.max(railRect.right, rect.right) + 10)}px`;
    tooltip.style.top = `${Math.round(rect.top + rect.height / 2)}px`;
    tooltip.hidden = false;
    tooltip.classList.add('visible');
  }

  if (rail) {
    const railControls = rail.querySelectorAll<HTMLElement>('a[href],button');
    railControls.forEach((control) => {
      listen(control, 'pointerenter', (event) => {
        if ((event as PointerEvent).pointerType === 'touch') return;
        showTooltip(control);
      });
      listen(control, 'pointerleave', () => {
        if (tooltipAnchor === control) hideTooltip();
      });
      listen(control, 'focus', () => {
        try {
          if (!control.matches(':focus-visible')) return;
        } catch {}
        showTooltip(control);
      });
      listen(control, 'blur', () => {
        if (tooltipAnchor === control) hideTooltip();
      });
      listen(control, 'click', hideTooltip);
    });
    listen(rail, 'scroll', hideTooltip, { passive: true });
    listen(document, 'keydown', (event) => {
      if ((event as KeyboardEvent).key === 'Escape') hideTooltip();
    });
  }

  function cleanup() {
    if (disposed) return;
    disposed = true;
    hideTooltip();
    tooltip?.remove();
    tooltip = null;
    clearDestination();
    subscriptions.splice(0).forEach((remove) => remove());
    headerObserver?.disconnect();
    animatePanel?.dispose?.();
    if (disposeResponsive === cleanup) disposeResponsive = undefined;
  }
  listen(window, 'pagehide', (event) => {
    clearDestination();
    if (dialog?.open) closeDialog(dialog, true);
    if (!(event as PageTransitionEvent).persisted) cleanup();
  });
  listen(window, 'pageshow', (event) => {
    if ((event as PageTransitionEvent).persisted) settleLayout();
  });
  disposeResponsive = cleanup;
  return cleanup;
}
