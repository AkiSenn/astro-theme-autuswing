import { client } from './helpers';

(() => {
  // 文档持有清理入口，重复执行模块也能释放前一实例；不依赖模块缓存去重。
  const ownership = Symbol.for('autuswing.runtime.dispose');
  try {
    document[ownership]?.();

    const display = document.querySelector('.site-runtime');
    if (!display) return;
    const suppliedDate = display.dataset.since || '';
    // 纯日期保持既有 UTC+8 规则；带时区的输入交给标准日期解析器。
    const epoch = Date.parse(
      /^\d{4}-\d{2}-\d{2}$/.test(suppliedDate) ? `${suppliedDate}T00:00:00+08:00` : suppliedDate,
    );
    display.hidden = !Number.isFinite(epoch);
    if (display.hidden) return;

    const { labels } = client();
    const units = [
      ['d', 86400],
      ['h', 3600],
      ['m', 60],
      ['s', 1],
    ];
    let task = null;
    let inViewport = true;
    let pageActive = true;
    let disposed = false;
    let watcher;

    function cancelTask() {
      if (task !== null) window.clearTimeout(task);
      task = null;
    }

    function synchronize() {
      cancelTask();
      if (disposed) return;
      if (!display.isConnected) return dispose();
      if (!pageActive || document.hidden || !inViewport) return;

      let remaining = Math.floor(Math.max(0, Date.now() - epoch) / 1000);
      let message = labels.runtime_format;
      for (const [token, size] of units) {
        const amount = Math.floor(remaining / size);
        remaining %= size;
        message = message.split(`{${token}}`).join(String(amount));
      }
      display.textContent = `${display.dataset.prefix || labels.runtime} ${message}`;
      task = window.setTimeout(synchronize, 1000);
    }

    function leavePage(event) {
      // BFCache 保留控制器，但缓存期间停表；普通离开彻底释放监听器和观察器。
      if (!event.persisted) return dispose();
      pageActive = false;
      cancelTask();
    }

    function enterPage() {
      pageActive = true;
      synchronize();
    }

    function dispose() {
      disposed = true;
      cancelTask();
      watcher?.disconnect();
      document.removeEventListener('visibilitychange', synchronize);
      window.removeEventListener('pagehide', leavePage);
      window.removeEventListener('pageshow', enterPage);
      if (document[ownership] === dispose) delete document[ownership];
    }

    document[ownership] = dispose;
    document.addEventListener('visibilitychange', synchronize);
    window.addEventListener('pagehide', leavePage);
    window.addEventListener('pageshow', enterPage);
    if ('IntersectionObserver' in window) {
      watcher = new window.IntersectionObserver((entries) => {
        if (disposed) return;
        const current = entries.find((entry) => entry.target === display);
        if (!current) return;
        inViewport = current.isIntersecting;
        synchronize();
      });
      watcher.observe(display);
    }
    synchronize();
  } catch (error) {
    document[ownership]?.();
    console.warn('Autuswing runtime unavailable', error);
  }
})();
