import { client, toast, motionEnabled, reduced } from './helpers';

let dispose: (() => void) | undefined;

export function initAppearance() {
  dispose?.();
  const root = document.documentElement;
  const modes = ['auto', 'light', 'dark'];
  const scheme = matchMedia('(prefers-color-scheme: dark)');
  const config = client();
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('.mode-toggle'));
  const fallback = modes.includes(config.mode) ? config.mode : 'auto';
  let requestedMode = modes.includes(root.dataset.mode || '') ? root.dataset.mode! : fallback;
  let revision = 0;
  let transition: ViewTransition | undefined;
  let pending: (() => void) | undefined;
  let disconnectMotion = () => {};
  const effectiveTheme = (mode: string) =>
    mode === 'auto' ? (scheme.matches ? 'dark' : 'light') : mode;

  function skip() {
    transition?.skipTransition();
    delete root.dataset.appearanceTransition;
  }
  function settle() {
    pending?.();
    revision++;
    skip();
  }
  function nativeBusy() {
    if (document.activeViewTransition) return true;
    // 兼容已有 startViewTransition、尚无 activeViewTransition 属性的实现。
    try {
      return root.matches(':active-view-transition');
    } catch {
      return false;
    }
  }
  function change(value: string, animate = false, persist = false) {
    const mode = modes.includes(value) ? value : fallback;
    requestedMode = mode;
    const request = ++revision;
    let applied = false;
    const update = () => {
      // skipTransition 不会取消更新回调；过期回调不得覆盖后来的选择。
      if (applied || request !== revision) return;
      applied = true;
      if (pending === update) pending = undefined;
      if (persist) {
        try {
          localStorage.setItem('autuswing-appearance', mode);
        } catch {}
      }
      apply(mode);
      if (persist) toast(config.labels['mode_' + mode]);
    };
    pending = update;
    if (
      !animate ||
      typeof document.startViewTransition !== 'function' ||
      !motionEnabled() ||
      effectiveTheme(mode) === root.dataset.theme ||
      transition ||
      nativeBusy()
    ) {
      // 快速反向时立即采用最新状态，不排队启动第二次截图动画。
      skip();
      update();
      return;
    }
    root.dataset.appearanceTransition = '';
    try {
      const current = document.startViewTransition(update);
      transition = current;
      current.ready.catch(() => {});
      const done = () => {
        if (transition !== current) return;
        transition = undefined;
        delete root.dataset.appearanceTransition;
      };
      current.finished.then(done, done);
    } catch {
      delete root.dataset.appearanceTransition;
      update();
    }
  }
  function apply(value: string) {
    const mode = modes.includes(value) ? value : fallback;
    const theme = effectiveTheme(mode);
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
    change(modes[(modes.indexOf(requestedMode) + 1) % modes.length], true, true);
  }
  function systemChange() {
    if (requestedMode === 'auto') change('auto');
  }
  function storage(event: StorageEvent) {
    if (event.key === null || event.key === 'autuswing-appearance')
      change(event.newValue || fallback);
  }
  function restore(event: PageTransitionEvent) {
    if (!event.persisted) return;
    let mode = root.dataset.mode || fallback;
    try {
      mode = localStorage.getItem('autuswing-appearance') || fallback;
    } catch {}
    change(mode);
  }
  function leave(event: PageTransitionEvent) {
    settle();
    if (!event.persisted) cleanup();
  }
  // Safari 14 的 MediaQueryList 仍使用 addListener；绑定与释放必须成对。
  const modernMedia = typeof scheme.addEventListener === 'function';
  function cleanup() {
    settle();
    disconnectMotion();
    buttons.forEach((button) => button.removeEventListener('click', click));
    if (modernMedia) scheme.removeEventListener('change', systemChange);
    else scheme.removeListener(systemChange);
    removeEventListener('storage', storage);
    removeEventListener('pageshow', restore);
    removeEventListener('pagehide', leave);
    if (dispose === cleanup) dispose = undefined;
  }
  if (typeof document.startViewTransition === 'function') {
    const policyChanged = () => {
      if (!motionEnabled()) settle();
    };
    const modernReduced = typeof reduced.addEventListener === 'function';
    if (modernReduced) reduced.addEventListener('change', policyChanged);
    else reduced.addListener(policyChanged);
    const observer = new MutationObserver(policyChanged);
    observer.observe(root, { attributes: true, attributeFilter: ['data-motion'] });
    // 出站截图前恢复跨文档名称，不能把主题截图带入下一页或 BFCache。
    addEventListener('pageswap', settle);
    disconnectMotion = () => {
      observer.disconnect();
      if (modernReduced) reduced.removeEventListener('change', policyChanged);
      else reduced.removeListener(policyChanged);
      removeEventListener('pageswap', settle);
    };
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
