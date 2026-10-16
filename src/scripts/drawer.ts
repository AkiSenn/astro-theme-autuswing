// Temporary phase-two presentation adapter. Content/search/appearance do not
// depend on this module. Phase three replaces this shell with three layouts.
export function initDrawer() {
  const sidebar = document.querySelector<HTMLElement>('.sidebar'),
    menu = document.querySelector<HTMLButtonElement>('.menu-toggle'),
    overlay = document.querySelector<HTMLButtonElement>('.sidebar-overlay'),
    close = document.querySelector<HTMLButtonElement>('.drawer-close');
  if (!sidebar || !menu || !overlay || !close) return;
  const mobile = matchMedia('(max-width: 760px)');
  function toggle(open: boolean) {
    if (!sidebar || !overlay || !menu) return;
    document.body.classList.toggle('menu-open', open);
    overlay.hidden = !open;
    menu.setAttribute('aria-expanded', String(open));
    sidebar.inert = mobile.matches && !open;
    if (mobile.matches && open) {
      sidebar.setAttribute('role', 'dialog');
      sidebar.setAttribute('aria-modal', 'true');
      document.querySelector<HTMLElement>('.main-shell')!.inert = true;
      close?.focus();
    } else {
      sidebar.removeAttribute('role');
      sidebar.removeAttribute('aria-modal');
      document.querySelector<HTMLElement>('.main-shell')!.inert = false;
    }
  }
  window.Autuswing.openMenu = () => toggle(true);
  toggle(false);
  mobile.addEventListener('change', () => toggle(false));
  menu.addEventListener('click', () => toggle(menu.getAttribute('aria-expanded') !== 'true'));
  overlay.addEventListener('click', () => toggle(false));
  close.addEventListener('click', () => {
    toggle(false);
    menu.focus();
  });
  sidebar
    .querySelectorAll('.site-nav a,.toc a')
    .forEach((link) => link.addEventListener('click', () => toggle(false)));
  document.addEventListener('keydown', (e) => {
    if (!document.body.classList.contains('menu-open')) return;
    if (e.key === 'Escape') {
      toggle(false);
      menu.focus();
    }
    if (e.key === 'Tab') {
      const links = [...sidebar.querySelectorAll<HTMLElement>('a[href],button')].filter(
          (e) => e.getClientRects().length,
        ),
        first = links[0],
        last = links.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
  });
}
