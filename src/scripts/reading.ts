import { scrollBehavior } from './helpers';
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
  const back = document.querySelector<HTMLButtonElement>('.back-top'),
    tools = document.querySelector<HTMLElement>('.floating-tools'),
    contentsButton = tools?.querySelector<HTMLElement>('.goto-toc'),
    pane = document.querySelector<HTMLElement>('.reading-sidebar-scroll'),
    article = document.querySelector<HTMLElement>('.article');
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
  let pending = false,
    dirty = true,
    followPending = false,
    active: string | undefined,
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
    if (followPending) return;
    followPending = true;
    requestAnimationFrame(() => {
      followPending = false;
      followCurrentChapter();
    });
  }
  function updateTools(y = scrollY) {
    if (back) back.hidden = y < 250;
    if (tools) tools.hidden = y < 250 && (!contentsButton || contentsButton.hidden);
  }
  function update() {
    pending = false;
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
      follow();
    }
    updateTools(y);
  }
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(update);
  }
  function invalidate() {
    dirty = true;
    schedule();
  }
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', invalidate);
  addEventListener('pageshow', invalidate);
  addEventListener('hashchange', schedule);
  document.addEventListener('reading-contents-change', () => {
    // 关闭旧 Dialog 后，焦点恢复前必须同步显示目录入口。
    updateTools();
    invalidate();
    follow();
  });
  if (groups.size) {
    if (article && 'ResizeObserver' in window) new ResizeObserver(invalidate).observe(article);
    const contentChanged = (event: Event) => {
      const target = event.target;
      if (
        target instanceof Element &&
        article &&
        (article.contains(target) || target.contains(article))
      )
        invalidate();
    };
    document.addEventListener('load', contentChanged, true);
    document.addEventListener('toggle', contentChanged, true);
    // 入场 transform 不触发 ResizeObserver，结束后需刷新标题坐标。
    document.addEventListener('animationend', contentChanged, true);
    document.addEventListener('animationcancel', contentChanged, true);
    document.addEventListener('transitionend', contentChanged, true);
    document.fonts?.ready.then(invalidate);
    document.fonts?.addEventListener('loadingdone', invalidate);
  }
  update();
  back?.addEventListener('click', () => scrollTo({ top: 0, behavior: scrollBehavior() }));
}
