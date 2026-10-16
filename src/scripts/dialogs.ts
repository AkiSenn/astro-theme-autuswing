// Native dialogs provide focus containment and inert background content.
// Keep the three independent features from stacking multiple modal surfaces.
export function openDialog(dialog: HTMLDialogElement) {
  document.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach((other) => {
    if (other !== dialog) other.close();
  });
  if (!dialog.open) dialog.showModal();
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
  if (destination) destination.focus({ preventScroll: true });
}
