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
    panes = ['.reading-sidebar-scroll', '.desktop-contents', '.contents-dialog']
      .map((selector) => document.querySelector<HTMLElement>(selector))
      .filter((node): node is HTMLElement => !!node),
    contentRoot = document.querySelector<HTMLElement>('.article, .standalone-page'),
    allLinks = [...document.querySelectorAll<HTMLAnchorElement>('.toc-link')];
  const subscriptions: (() => void)[] = [];
  let disposed = false,
    observer: ResizeObserver | undefined,
    updateFrame: number | undefined,
    followFrame: number | undefined,
    pending = false,
    dirty = true,
    followPending = false,
    active: string | undefined | null = null,
    readingLine = 0,
    maximumScroll = 0,
    positions: number[] = [];
  type Group = { heading: HTMLElement; links: HTMLAnchorElement[] };
  let ordered: Group[] = [];
  function listen(
    target: EventTarget,
    name: string,
    handler: EventListener,
    options?: AddEventListenerOptions | boolean,
  ) {
    target.addEventListener(name, handler, options);
    subscriptions.push(() => target.removeEventListener(name, handler, options));
  }
  function clearHighlight() {
    allLinks.forEach((link) => {
      link.classList.toggle('active', false);
      link.removeAttribute('aria-current');
    });
  }
  function cancelFrames() {
    if (updateFrame !== undefined) cancelAnimationFrame(updateFrame);
    if (followFrame !== undefined) cancelAnimationFrame(followFrame);
    updateFrame = undefined;
    followFrame = undefined;
    pending = false;
    followPending = false;
  }
  function cleanup() {
    if (disposed) return;
    disposed = true;
    subscriptions.splice(0).forEach((remove) => remove());
    observer?.disconnect();
    cancelFrames();
    active = null;
    clearHighlight();
    if (disposeReading === cleanup) disposeReading = undefined;
  }
  disposeReading = cleanup;
  clearHighlight();
  const groups = new Map<string, Group>();
  allLinks.forEach((link) => {
    let id: string;
    try {
      id = decodeURIComponent(link.hash.slice(1));
    } catch {
      return;
    }
    const heading = document.getElementById(id);
    if (
      !heading?.matches('.prose :is(h2,h3,h4,h5,h6)') ||
      (contentRoot && !contentRoot.contains(heading))
    )
      return;
    const group = groups.get(id) || { heading, links: [] };
    group.links.push(link);
    groups.set(id, group);
  });
  function followCurrentChapter() {
    if (!active) return;
    const links = groups.get(active)?.links;
    if (!links?.length) return;
    for (const pane of panes) {
      const current = links.find((link) => pane.contains(link));
      if (!current || !pane.getClientRects().length) continue;
      const area = pane.getBoundingClientRect(),
        row = current.getBoundingClientRect(),
        padTop = parseFloat(getComputedStyle(pane).scrollPaddingTop) || 0,
        visibleTop = area.top + padTop;
      if (row.top < visibleTop || row.bottom > area.bottom)
        pane.scrollTop += row.top - visibleTop - Math.max(0, pane.clientHeight - padTop) / 3;
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
  listen(window, 'hashchange', invalidate);
  listen(document, 'autuswing:layout-change', invalidate);
  // 缓存恢复保留所有者，但冻帧前取消未决 rAF，避免返回后 pending 锁死刷新。
  listen(window, 'pagehide', (event) => {
    if ((event as PageTransitionEvent).persisted) {
      cancelFrames();
      dirty = true;
    } else cleanup();
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
