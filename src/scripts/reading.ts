import { scrollBehavior } from './helpers';
export function initReading() {
  const back = document.querySelector<HTMLButtonElement>('.back-top'),
    tools = document.querySelector<HTMLElement>('.floating-tools');
  let pending = false;
  function update() {
    pending = false;
    if (back) back.hidden = scrollY < 250;
    if (tools) tools.hidden = scrollY < 250 && !tools.querySelector('.goto-toc:not([hidden])');
  }
  addEventListener(
    'scroll',
    () => {
      if (!pending) {
        pending = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true },
  );
  addEventListener('resize', update);
  update();
  back?.addEventListener('click', () => scrollTo({ top: 0, behavior: scrollBehavior() }));
  const headings = [
      ...document.querySelectorAll<HTMLElement>('.prose h2[id],.prose h3[id],.prose h4[id]'),
    ],
    links = [...document.querySelectorAll<HTMLAnchorElement>('.toc-link')];
  function followCurrentChapter() {
    const pane = document.querySelector<HTMLElement>('.reading-sidebar-scroll');
    const current = pane?.querySelector<HTMLElement>('.toc-link.active');
    if (pane && current && pane.getClientRects().length) {
      const area = pane.getBoundingClientRect(),
        row = current.getBoundingClientRect();
      if (row.top < area.top || row.bottom > area.bottom)
        pane.scrollTop += row.top - area.top - pane.clientHeight / 3;
    }
  }
  document.addEventListener('reading-contents-change', () => {
    update();
    followCurrentChapter();
  });
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (first)
          links.forEach((link) => {
            const active = decodeURIComponent(link.hash.slice(1)) === first.target.id;
            link.classList.toggle('active', active);
            if (active) link.setAttribute('aria-current', 'location');
            else link.removeAttribute('aria-current');
          });
        // Follow the active chapter inside its own scroll area, without
        // scrollIntoView moving the article or the browser viewport.
        followCurrentChapter();
      },
      { rootMargin: '-10% 0px -65% 0px' },
    );
    headings.forEach((h) => observer.observe(h));
  }
}
