(function () {
  var root = document.documentElement;
  var script = document.currentScript;
  // 只能在 head 首次绘制前安装；晚加载或重复执行时保留可见内容。
  if (
    !script ||
    script.hasAttribute('data-installed') ||
    document.readyState !== 'loading' ||
    document.getElementById('main') ||
    typeof matchMedia !== 'function' ||
    typeof MutationObserver !== 'function'
  ) return;
  script.setAttribute('data-installed', '');

  var preference = matchMedia('(prefers-reduced-motion: reduce)');
  var finished = false;
  var observer;
  var modernMedia = typeof preference.addEventListener === 'function';
  var reliableReveal =
    'onpagereveal' in window &&
    typeof window.PageRevealEvent === 'function' &&
    'viewTransition' in window.PageRevealEvent.prototype;
  var possibleCross =
    'onpagereveal' in window ||
    'onpageswap' in window ||
    'PageRevealEvent' in window ||
    'PageSwapEvent' in window ||
    'CSSViewTransitionRule' in window;

  function finish() {
    if (finished) return;
    finished = true;
    root.removeAttribute('data-page-entry');
    if (observer) observer.disconnect();
    if (modernMedia) preference.removeEventListener('change', policyChanged);
    else preference.removeListener(policyChanged);
    removeEventListener('pagereveal', reveal);
    removeEventListener('pageswap', finish);
    removeEventListener('pagehide', finish);
    removeEventListener('pageshow', restored);
    document.removeEventListener('animationend', ended);
    document.removeEventListener('animationcancel', ended);
  }
  function allowed() {
    return root.getAttribute('data-motion') === 'true' && !preference.matches;
  }
  function enter() {
    // 锚点与后台页面不做装饰入场，不干预浏览器的阅读定位。
    if (finished || !allowed() || location.hash || document.hidden) return finish();
    root.setAttribute('data-page-entry', '');
  }
  function reveal(event) {
    // 原生转场即使稍后被浏览器跳过，也不在已绘制页面补播 CSS。
    if (event.viewTransition) finish();
    else enter();
  }
  function restored(event) {
    // BFCache 可能先展示缓存帧；只能清理，不能再次隐藏后淡入。
    if (event.persisted) finish();
  }
  function policyChanged() {
    if (!allowed() || root.hasAttribute('data-appearance-transition')) finish();
  }
  function ended(event) {
    if (
      event.animationName === 'autuswing-content-enter' &&
      event.target === document.getElementById('main')
    ) finish();
  }

  // 部分跨文档能力无法保证判定时序，直接显示；不使用同文档 API 推断。
  if ((!reliableReveal && possibleCross) || !allowed()) return;
  observer = new MutationObserver(policyChanged);
  observer.observe(root, {
    attributes: true,
    attributeFilter: ['data-motion', 'data-appearance-transition'],
  });
  if (modernMedia) preference.addEventListener('change', policyChanged);
  else preference.addListener(policyChanged);
  addEventListener('pageswap', finish);
  addEventListener('pagehide', finish);
  addEventListener('pageshow', restored);
  document.addEventListener('animationend', ended);
  document.addEventListener('animationcancel', ended);
  if (reliableReveal) addEventListener('pagereveal', reveal);
  else enter();
})();
