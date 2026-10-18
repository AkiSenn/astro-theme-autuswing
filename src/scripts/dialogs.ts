import { motionEnabled, reduced } from './helpers';
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

export function initDialogs() {
  initLegacyDialogs((dialog) => closeDialog(dialog, true));
  document.querySelectorAll<HTMLDialogElement>('dialog').forEach((dialog) => {
    prepareLegacyDialog(dialog);
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      closeDialog(dialog);
    });
  });
  reduced.addEventListener('change', () => {
    if (reduced.matches) [...closing.keys()].forEach((dialog) => closeDialog(dialog, true));
  });
  // Do not restore an in-flight exit from the back/forward cache.
  addEventListener('pagehide', () => {
    [...closing.keys()].forEach((dialog) => closeDialog(dialog, true));
  });
}

// Replacing a modal must release inertness immediately, with no stacked fades.
export function openDialog(dialog: HTMLDialogElement) {
  document.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach((other) => {
    if (other !== dialog) closeDialog(other, true);
  });
  closing.get(dialog)?.cancel();
  closing.delete(dialog);
  delete dialog.dataset.closing;
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
