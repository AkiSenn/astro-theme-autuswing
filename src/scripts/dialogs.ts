import { motionEnabled, reduced } from './helpers';

type LegacyMediaQuery = {
  addListener?: (cb: () => void) => void;
  removeListener?: (cb: () => void) => void;
};
import {
  prepareLegacyDialog,
  showLegacyDialog,
  closeLegacyDialog,
  isLegacyDialog,
  initLegacyDialogs,
  focusDialogTarget,
} from './legacy-dialog';

const closing = new Map<HTMLDialogElement, Animation>();
const finishClose = (dialog: HTMLDialogElement) =>
  isLegacyDialog(dialog) ? closeLegacyDialog(dialog) : dialog.close();

// Keep native modal semantics until the exit finishes. In particular, the TOC
// opener must not reappear while its dialog is still visible. No timer guesses.
export function closeDialog(dialog: HTMLDialogElement, immediate = false) {
  if (!dialog.open) return;
  if (immediate || !motionEnabled() || !dialog.animate) {
    closing.get(dialog)?.cancel();
    closing.delete(dialog);
    delete dialog.dataset.closing;
    finishClose(dialog);
    return;
  }
  if (closing.has(dialog)) return;
  const style = getComputedStyle(dialog);
  const token = style.getPropertyValue('--motion-normal').trim();
  const value = parseFloat(token) * (token.endsWith('ms') ? 1 : 1000);
  const duration = Number.isFinite(value) ? value : 180;
  const easing = style.getPropertyValue('--motion-ease').trim() || 'ease-out';
  const animation = dialog.animate(
    [
      { opacity: style.opacity, transform: style.transform },
      { opacity: 0, transform: 'translateY(6px)' },
    ],
    { duration, easing, fill: 'forwards' },
  );
  closing.set(dialog, animation);
  dialog.dataset.closing = 'true';
  animation.finished
    .then(() => {
      if (closing.get(dialog) !== animation) return;
      closing.delete(dialog);
      delete dialog.dataset.closing;
      finishClose(dialog);
      animation.cancel();
    })
    .catch(() => {}); // Reopening or replacing a surface cancels its exit.
}

let disposeDialogs: (() => void) | undefined;

export function initDialogs() {
  disposeDialogs?.();
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
  initLegacyDialogs((dialog) => closeDialog(dialog, true));
  document.querySelectorAll<HTMLDialogElement>('dialog').forEach((dialog) => {
    prepareLegacyDialog(dialog);
    listen(dialog, 'cancel', (event) => {
      event.preventDefault();
      closeDialog(dialog);
    });
  });
  const onReduced = () => {
    if (reduced.matches) [...closing.keys()].forEach((dialog) => closeDialog(dialog, true));
  };
  let stopReduced = () => {};
  if (typeof reduced.addEventListener === 'function') {
    reduced.addEventListener('change', onReduced);
    stopReduced = () => reduced.removeEventListener('change', onReduced);
  } else {
    const legacy = reduced as unknown as LegacyMediaQuery;
    if (typeof legacy.addListener === 'function') {
      legacy.addListener(onReduced);
      stopReduced = () => legacy.removeListener?.(onReduced);
    }
  }
  // 总开关在退出中关闭时，同样立即释放模态状态和恢复焦点。
  const observer = new MutationObserver(() => {
    if (!motionEnabled()) [...closing.keys()].forEach((dialog) => closeDialog(dialog, true));
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] });
  const cleanup = () => {
    subscriptions.splice(0).forEach((remove) => remove());
    observer.disconnect();
    stopReduced();
    if (disposeDialogs === cleanup) disposeDialogs = undefined;
  };
  // Do not restore an in-flight exit from the back/forward cache.
  listen(window, 'pagehide', (event) => {
    [...closing.keys()].forEach((dialog) => closeDialog(dialog, true));
    if (!(event as PageTransitionEvent).persisted) cleanup();
  });
  disposeDialogs = cleanup;
  return cleanup;
}

// Replacing a modal must release inertness immediately, with no stacked fades.
export function openDialog(dialog: HTMLDialogElement) {
  document.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach((other) => {
    if (other !== dialog) {
      other.dataset.replaced = 'true';
      closeDialog(other, true);
    }
  });
  closing.get(dialog)?.cancel();
  closing.delete(dialog);
  delete dialog.dataset.closing;
  delete dialog.dataset.replaced;
  if (!dialog.open) {
    if (isLegacyDialog(dialog)) showLegacyDialog(dialog, () => closeDialog(dialog));
    else dialog.showModal();
  }
}
export function restoreDialogFocus(trigger: HTMLElement | null) {
  if (document.querySelector('dialog[open]')) return;
  const key = trigger?.dataset.focusKey;
  const destination = trigger?.getClientRects().length
    ? trigger
    : key &&
      [...document.querySelectorAll<HTMLElement>('[data-focus-key]')].find(
        (node) => node.dataset.focusKey === key && node.getClientRects().length,
      );
  if (destination) focusDialogTarget(destination);
}
