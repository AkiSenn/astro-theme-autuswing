import { client, reduced } from './helpers';
export function initReading() {
  const progress = document.querySelector<HTMLElement>('.reading-progress'),
    article = document.querySelector<HTMLElement>('.article .prose'),
    back = document.querySelector<HTMLButtonElement>('.back-top'),
    tools = document.querySelector<HTMLElement>('.floating-tools');
  let pending = false;
  function update() {
    pending = false;
    const top = article ? article.getBoundingClientRect().top + scrollY : 0,
      length = article
        ? article.scrollHeight - innerHeight
        : document.documentElement.scrollHeight - innerHeight;
    const amount = length <= 0 ? 1 : Math.min(1, Math.max(0, (scrollY - top) / length));
    if (progress) progress.style.transform = `scaleX(${amount})`;
    if (back) back.hidden = scrollY < 250;
    if (tools) tools.hidden = scrollY < 250;
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
  back?.addEventListener('click', () =>
    scrollTo({ top: 0, behavior: reduced.matches ? 'instant' : 'smooth' }),
  );
  const headings = [
      ...document.querySelectorAll<HTMLElement>('.prose h2[id],.prose h3[id],.prose h4[id]'),
    ],
    links = [...document.querySelectorAll<HTMLAnchorElement>('.toc-link')];
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
      },
      { rootMargin: '-10% 0px -65% 0px' },
    );
    headings.forEach((h) => observer.observe(h));
  }
  if (!client().article.lightbox) return;
}
