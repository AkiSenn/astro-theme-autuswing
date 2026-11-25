// Local fallback for engines without native modal dialogs. Modern engines
// retain showModal(), their top layer and their existing focus behavior.
type Session = {
  dialog: HTMLDialogElement;
  host: HTMLDivElement;
  marker: Comment;
  bodyStyle: string | null;
  x: number;
  y: number;
  hidden: [Element, string | null][];
  viewport: () => void;
};
let session: Session | undefined;
let legacyFocus = false;
const legacy = new WeakSet<HTMLDialogElement>();
const focusable = 'a[href],button,input,select,textarea,[tabindex]';
const targets = (dialog: HTMLElement) =>
  [...dialog.querySelectorAll<HTMLElement>(focusable)].filter(
    (node) => !node.hasAttribute('disabled') && node.tabIndex >= 0 && node.getClientRects().length,
  );
const focusFirst = (dialog: HTMLElement) =>
  focusDialogTarget(
    dialog.querySelector<HTMLElement>('[autofocus]') || targets(dialog)[0] || dialog,
  );

function restoreScroll(x: number, y: number) {
  const style = document.documentElement.style;
  const value = style.getPropertyValue('scroll-behavior');
  const priority = style.getPropertyPriority('scroll-behavior');
  style.setProperty('scroll-behavior', 'auto', 'important');
  scrollTo(x, y);
  if (value) style.setProperty('scroll-behavior', value, priority);
  else style.removeProperty('scroll-behavior');
}

// iOS 14 also ignores focus({preventScroll:true}). Preserve the document
// position explicitly, while allowing the modal's own scroll area to follow
// keyboard focus (including links initially below the fold).
export function focusDialogTarget(target: HTMLElement) {
  if (!legacyFocus) {
    target.focus({ preventScroll: true });
    return;
  }
  const x = scrollX,
    y = scrollY;
  target.focus();
  restoreScroll(x, y);
}

export const isLegacyDialog = (dialog: HTMLDialogElement) => legacy.has(dialog);

export function prepareLegacyDialog(dialog: HTMLDialogElement) {
  if (typeof dialog.showModal === 'function' && typeof dialog.close === 'function') return;
  legacyFocus = true;
  legacy.add(dialog);
  dialog.dataset.dialogFallback = '';
  dialog.setAttribute('role', 'dialog');
  dialog.tabIndex = -1;
  const readOpen = () => dialog.hasAttribute('open');
  if (!('open' in dialog)) Object.defineProperty(dialog, 'open', { get: readOpen });
}

export function showLegacyDialog(dialog: HTMLDialogElement, dismiss: () => void) {
  const marker = document.createComment('dialog position');
  dialog.before(marker);
  const host = document.createElement('div');
  host.className = 'legacy-dialog-host';
  if (dialog.classList.contains('contents-dialog')) host.dataset.contents = '';
  const state: Session = {
    dialog,
    host,
    marker,
    bodyStyle: document.body.getAttribute('style'),
    x: scrollX,
    y: scrollY,
    hidden: [],
    viewport: () => {
      const viewport = window.visualViewport;
      host.style.top = `${viewport?.offsetTop || 0}px`;
      host.style.left = `${viewport?.offsetLeft || 0}px`;
      host.style.width = `${viewport?.width || innerWidth}px`;
      host.style.height = `${viewport?.height || innerHeight}px`;
      host.style.setProperty('--legacy-viewport-height', host.style.height);
    },
  };
  session = state;
  host.append(dialog);
  document.body.append(host);
  dialog.setAttribute('open', '');
  dialog.setAttribute('aria-modal', 'true');
  for (const child of document.body.children) {
    if (child === host || child.matches('script,style,link')) continue;
    state.hidden.push([child, child.getAttribute('aria-hidden')]);
    child.setAttribute('aria-hidden', 'true');
  }
  // Body fixation also works on iOS versions that do not honor overflow locks.
  document.body.style.position = 'fixed';
  document.body.style.top = `${-state.y}px`;
  document.body.style.left = `${-state.x}px`;
  document.body.style.width = '100%';
  document.documentElement.dataset.legacyModalOpen = '';
  state.viewport();
  window.visualViewport?.addEventListener('resize', state.viewport);
  window.visualViewport?.addEventListener('scroll', state.viewport);
  addEventListener('resize', state.viewport);
  host.addEventListener('click', (event) => {
    if (event.target === host) dismiss();
  });
  host.addEventListener(
    'touchmove',
    (event) => {
      if (event.target === host) event.preventDefault();
    },
    { passive: false },
  );
  focusFirst(dialog);
}

export function closeLegacyDialog(dialog: HTMLDialogElement) {
  const state = session;
  if (!state || state.dialog !== dialog) return;
  session = undefined;
  dialog.removeAttribute('open');
  dialog.removeAttribute('aria-modal');
  state.marker.replaceWith(dialog);
  state.host.remove();
  for (const [node, hidden] of state.hidden) {
    if (hidden === null) node.removeAttribute('aria-hidden');
    else node.setAttribute('aria-hidden', hidden);
  }
  if (state.bodyStyle === null) document.body.removeAttribute('style');
  else document.body.setAttribute('style', state.bodyStyle);
  delete document.documentElement.dataset.legacyModalOpen;
  window.visualViewport?.removeEventListener('resize', state.viewport);
  window.visualViewport?.removeEventListener('scroll', state.viewport);
  removeEventListener('resize', state.viewport);
  // Restoring scroll must finish before close listeners focus an opener or a
  // selected heading. Temporarily disable CSS smooth scrolling for the restore.
  restoreScroll(state.x, state.y);
  dialog.dispatchEvent(new Event('close'));
  // Close listeners can focus a heading using an option an old engine ignores.
  // TOC navigation performs its deliberate fragment scroll after this returns.
  restoreScroll(state.x, state.y);
}

let disposeLegacyDialogs: (() => void) | undefined;

export function initLegacyDialogs(dismiss: (dialog: HTMLDialogElement) => void) {
  disposeLegacyDialogs?.();
  const onKeydown = (event: KeyboardEvent) => {
    if (!session) return;
    const { dialog } = session;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      dismiss(dialog);
    } else if (event.key === 'Tab') {
      event.preventDefault();
      event.stopImmediatePropagation();
      const nodes = targets(dialog),
        index = nodes.indexOf(document.activeElement as HTMLElement);
      const next =
        index < 0
          ? event.shiftKey
            ? nodes.length - 1
            : 0
          : (index + (event.shiftKey ? -1 : 1) + nodes.length) % nodes.length;
      focusDialogTarget(nodes[next] || dialog);
    }
  };
  const onFocusin = (event: FocusEvent) => {
    if (session && !session.dialog.contains(event.target as Node)) focusFirst(session.dialog);
  };
  const onPagehide = (event: PageTransitionEvent) => {
    if (session) dismiss(session.dialog);
    if (!event.persisted) cleanup();
  };
  const cleanup = () => {
    document.removeEventListener('keydown', onKeydown, true);
    document.removeEventListener('focusin', onFocusin);
    removeEventListener('pagehide', onPagehide);
    if (disposeLegacyDialogs === cleanup) disposeLegacyDialogs = undefined;
  };
  document.addEventListener('keydown', onKeydown, true);
  document.addEventListener('focusin', onFocusin);
  addEventListener('pagehide', onPagehide);
  disposeLegacyDialogs = cleanup;
  return cleanup;
}
