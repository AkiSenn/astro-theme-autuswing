import { motionEnabled, reduced } from './helpers';

type LegacyMediaQuery = {
  addListener?: (cb: () => void) => void;
  removeListener?: (cb: () => void) => void;
};

// 只保留退出动画所需的绘制，不改变正文预留空间或目录的逻辑开关。
export function contentsMotion(panel: HTMLElement, restoreFocus: () => void) {
  let opened: boolean | undefined;
  let animation: Animation | undefined;
  const tabStops = new Map<HTMLElement, string | null>();

  function settle() {
    const previous = animation;
    animation = undefined;
    previous?.cancel();
    delete panel.dataset.contentsAnimating;
  }

  function accessible(value: boolean) {
    panel.toggleAttribute('inert', !value);
    panel.setAttribute('aria-hidden', String(!value));
    if (value) {
      tabStops.forEach((tabindex, node) => {
        if (tabindex === null) node.removeAttribute('tabindex');
        else node.setAttribute('tabindex', tabindex);
      });
      tabStops.clear();
    } else {
      // Safari 14 没有 inert；退出期间仍须立即移除 Tab 停靠点。
      panel
        .querySelectorAll<HTMLElement>(
          'a[href],button,input,select,textarea,summary,[tabindex],[contenteditable]',
        )
        .forEach((node) => {
          if (!tabStops.has(node)) tabStops.set(node, node.getAttribute('tabindex'));
          node.tabIndex = -1;
        });
    }
  }

  const onFocusIn = () => {
    if (opened === false) restoreFocus();
  };
  panel.addEventListener('focusin', onFocusIn);
  const policyChanged = () => {
    if (!motionEnabled()) settle();
  };
  let stopReduced = () => {};
  if (typeof reduced.addEventListener === 'function') {
    reduced.addEventListener('change', policyChanged);
    stopReduced = () => reduced.removeEventListener?.('change', policyChanged);
  } else {
    const legacy = reduced as unknown as LegacyMediaQuery;
    if (typeof legacy.addListener === 'function') {
      legacy.addListener(policyChanged);
      stopReduced = () => legacy.removeListener?.(policyChanged);
    }
  }
  const observer = new MutationObserver(policyChanged);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-motion'],
  });
  addEventListener('pagehide', settle);

  const update = (value: boolean, animate = false) => {
    if (opened === value && animate) return;
    const previous = opened;
    const style = getComputedStyle(panel);
    const from =
      animation || previous
        ? { opacity: style.opacity, transform: style.transform }
        : { opacity: '0', transform: 'translateY(4px)' };
    settle();
    opened = value;
    accessible(value);
    if (previous === undefined || !animate || !motionEnabled() || !panel.animate) return;

    // 调用方随后更新 display 条件；先保留面板，让退出也能完成。
    panel.dataset.contentsAnimating = '';
    const token = style.getPropertyValue('--motion-normal').trim();
    const milliseconds = parseFloat(token) * (token.endsWith('ms') ? 1 : 1000);
    const next = panel.animate(
      [
        from,
        value
          ? { opacity: '1', transform: 'none' }
          : { opacity: '0', transform: 'translateY(4px)' },
      ],
      {
        duration: Number.isFinite(milliseconds) ? milliseconds : 180,
        easing: style.getPropertyValue('--motion-ease').trim() || 'ease-out',
        fill: 'both',
      },
    );
    animation = next;
    next.finished
      .then(() => {
        if (animation === next) settle();
      })
      .catch(() => {}); // 快速反向操作取消旧动画，最终状态由最后一次操作决定。
  };
  (update as typeof update & { dispose?: () => void }).dispose = () => {
    settle();
    observer.disconnect?.();
    panel.removeEventListener?.('focusin', onFocusIn);
    stopReduced();
    if (typeof removeEventListener === 'function') removeEventListener('pagehide', settle);
  };
  return update as typeof update & { dispose?: () => void };
}
