import { scrollBehavior } from './helpers';
let disposeReading: (() => void) | undefined;
export function chapterAt(positions: readonly number[], boundary: number) {
  let low = 0,
    high = positions.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (positions[middle] <= boundary) low = middle + 1;
    else high = middle;
  }
  return low - 1;
}

export function initReading() {
  disposeReading?.();
  const back = document.querySelector<HTMLButtonElement>('.back-top'),
    tools = document.querySelector<HTMLElement>('.floating-tools'),
    contentsButton = tools?.querySelector<HTMLElement>('.goto-toc'),
    pane = document.querySelector<HTMLElement>('.reading-sidebar-scroll'),
    contentRoot = document.querySelector<HTMLElement>('.article, .standalone-page');
  const subscriptions: (() => void)[] = [];
  let disposed = false,
    observer: ResizeObserver | undefined,
    updateFrame: number | undefined,
    followFrame: number | undefined;
  function listen(
    target: EventTarget,
    name: string,
    handler: EventListener,
    options?: AddEventListenerOptions | boolean,
  ) {
    target.addEventListener(name, handler, options);
    subscriptions.push(() => target.removeEventListener(name, handler, options));
  }
  function cleanup() {
    if (disposed) return;
    disposed = true;
    subscriptions.splice(0).forEach((remove) => remove());
    observer?.disconnect();
    if (updateFrame !== undefined) cancelAnimationFrame(updateFrame);
    if (followFrame !== undefined) cancelAnimationFrame(followFrame);
    if (disposeReading === cleanup) disposeReading = undefined;
  }
  disposeReading = cleanup;
  type Group = { heading: HTMLElement; links: HTMLAnchorElement[] };
  const groups = new Map<string, Group>();
  document.querySelectorAll<HTMLAnchorElement>('.toc-link').forEach((link) => {
    let id: string;
    try {
      id = decodeURIComponent(link.hash.slice(1));
    } catch {
      return;
    }
    const heading = document.getElementById(id);
    if (!heading?.matches('.prose :is(h2,h3,h4,h5,h6)')) return;
    const group = groups.get(id) || { heading, links: [] };
    group.links.push(link);
    groups.set(id, group);
  });
  // null 强制首次同步，重复初始化时也能清除上次留下的高亮。
  let pending = false,
    dirty = true,
    followPending = false,
    active: string | undefined | null = null,
    readingLine = 0,
    maximumScroll = 0,
    positions: number[] = [],
    ordered: Group[] = [];
  function followCurrentChapter() {
    const current = active && groups.get(active)?.links.find((link) => pane?.contains(link));
    if (pane && current && pane.getClientRects().length) {
      const area = pane.getBoundingClientRect(),
        row = current.getBoundingClientRect();
      if (row.top < area.top || row.bottom > area.bottom)
        pane.scrollTop += row.top - area.top - pane.clientHeight / 3;
    }
  }
  function follow() {
    if (disposed || followPending) return;
    followPending = true;
    followFrame = requestAnimationFrame(() => {
      followFrame = undefined;
      followPending = false;
      if (!disposed) followCurrentChapter();
    });
  }
  function updateTools(y = scrollY) {
    if (back) back.hidden = y < 250;
    if (tools) tools.hidden = y < 250 && (!contentsButton || contentsButton.hidden);
  }
  function update() {
    updateFrame = undefined;
    pending = false;
    if (disposed) return;
    const y = scrollY;
    if (dirty) {
      // 与原生锚点采用相同的 padding/margin 坐标；滚动中只查缓存，不逐标题读布局。
      readingLine = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
      const measured = [...groups.values()]
        .map((group) => ({
          group,
          top: Math.round(
            group.heading.getBoundingClientRect().top +
              y -
              (parseFloat(getComputedStyle(group.heading).scrollMarginTop) || 0),
          ),
        }))
        .sort((a, b) => a.top - b.top);
      ordered = measured.map((entry) => entry.group);
      positions = measured.map((entry) => entry.top);
      maximumScroll = document.documentElement.scrollHeight - innerHeight;
      dirty = false;
    }
    const atBottom = y > 0 && Math.round(y) >= Math.round(maximumScroll);
    const index = atBottom ? ordered.length - 1 : chapterAt(positions, Math.round(y + readingLine));
    const next = ordered[index]?.heading.id;
    if (next !== active) {
      active = next;
      groups.forEach((group, id) =>
        group.links.forEach((link) => {
          const current = id === active;
          link.classList.toggle('active', current);
          if (current) link.setAttribute('aria-current', 'location');
          else link.removeAttribute('aria-current');
        }),
      );
      if (groups.size) follow();
    }
    updateTools(y);
  }
  function schedule() {
    if (disposed || pending) return;
    pending = true;
    updateFrame = requestAnimationFrame(update);
  }
  function invalidate() {
    if (disposed) return;
    dirty = true;
    schedule();
  }
  listen(window, 'scroll', schedule, { passive: true });
  listen(window, 'resize', invalidate);
  listen(window, 'pageshow', invalidate);
  listen(window, 'hashchange', schedule);
  // 缓存恢复仍复用当前文档；只有最终离页才释放订阅。
  listen(window, 'pagehide', (event) => {
    if (!(event as PageTransitionEvent).persisted) cleanup();
  });
  listen(document, 'reading-contents-change', () => {
    // 关闭旧 Dialog 后，焦点恢复前必须同步显示目录入口。
    updateTools();
    invalidate();
    follow();
  });
  if (groups.size) {
    if (contentRoot && 'ResizeObserver' in window) {
      observer = new ResizeObserver(invalidate);
      observer.observe(contentRoot);
    }
    const contentChanged = (event: Event) => {
      const target = event.target;
      if (
        target instanceof Element &&
        contentRoot &&
        (contentRoot.contains(target) || target.contains(contentRoot))
      )
        invalidate();
    };
    listen(document, 'load', contentChanged, true);
    listen(document, 'toggle', contentChanged, true);
    // 入场 transform 不触发 ResizeObserver，结束后需刷新标题坐标。
    listen(document, 'animationend', contentChanged, true);
    listen(document, 'animationcancel', contentChanged, true);
    listen(document, 'transitionend', contentChanged, true);
    document.fonts?.ready.then(invalidate);
    if (document.fonts) listen(document.fonts, 'loadingdone', invalidate);
  }
  update();
  if (back) listen(back, 'click', () => scrollTo({ top: 0, behavior: scrollBehavior() }));
  return cleanup;
}
