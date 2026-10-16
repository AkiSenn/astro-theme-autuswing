import { client, reduced, idle, script, css } from './helpers';
const config = client(),
  labels = config.labels;
(() => {
  try {
    const tabs = [...document.querySelectorAll('.sidebar-tabs [role="tab"]')];
    function select(tab) {
      tabs.forEach((item) => {
        const active = item === tab;
        item.setAttribute('aria-selected', String(active));
        item.tabIndex = active ? 0 : -1;
        document.getElementById(item.getAttribute('aria-controls')).hidden = !active;
      });
    }
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => select(tab));
      tab.addEventListener('keydown', (event) => {
        const next = {
          ArrowRight: (index + 1) % tabs.length,
          ArrowLeft: (index - 1 + tabs.length) % tabs.length,
          Home: 0,
          End: tabs.length - 1,
        }[event.key];
        if (next === undefined) return;
        event.preventDefault();
        select(tabs[next]);
        tabs[next].focus();
      });
    });
    document.querySelector('.goto-toc')?.addEventListener('click', () => {
      const tab = document.querySelector('#side-tab-contents');
      if (!tab) return;
      select(tab);
      if (matchMedia('(max-width: 760px)').matches) window.Autuswing.openMenu();
      tab.focus({ preventScroll: true });
    });
  } catch (error) {
    console.warn('AutuSwing optional feature', error);
  }
})();
