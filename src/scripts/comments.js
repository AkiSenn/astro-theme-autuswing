export {};
(() => {
  'use strict';
  const section = document.querySelector('[data-comments-config]');
  if (!section) return;
  const config = JSON.parse(section.dataset.commentsConfig);
  const labels = JSON.parse(document.querySelector('#autuswing-config').textContent).labels;
  const panel = section.querySelector('.comment-panel'),
    bar = section.querySelector('.comment-bar');
  const mount = section.querySelector('.comments-container'),
    status = section.querySelector('.comment-status'),
    retry = section.querySelector('.comment-retry');
  let pending,
    instance,
    themeHandler,
    generation = 0,
    observer;
  const mode = () => document.documentElement.dataset.theme || 'light';
  const lang =
    config.lang && config.lang !== 'auto'
      ? config.lang
      : document.documentElement.lang.startsWith('en')
        ? 'en'
        : 'zh-CN';
  const timeout = Math.max(1000, Number(config.timeout) || 20000);
  function script(src, attrs = {}, target = document.head, dataAttributes = true) {
    return new Promise((resolve, reject) => {
      const element = document.createElement('script');
      element.src = src;
      element.async = true;
      element.crossOrigin = 'anonymous';
      element.dataset.autuswingCommentSdk = '';
      Object.entries(attrs).forEach(([key, value]) => {
        if (value !== undefined && value !== '')
          element.setAttribute((dataAttributes ? 'data-' : '') + key, String(value));
      });
      const timer = setTimeout(() => fail(), timeout);
      function fail() {
        clearTimeout(timer);
        element.onload = element.onerror = null;
        element.remove();
        reject(new Error('Comment SDK unavailable'));
      }
      element.onload = () => {
        clearTimeout(timer);
        element.onload = element.onerror = null;
        resolve(element);
      };
      element.onerror = fail;
      target.append(element);
    });
  }
  function stylesheet(url) {
    if (!url || [...document.styleSheets].some((sheet) => sheet.href === url)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    link.dataset.autuswingCommentSdk = '';
    document.head.append(link);
  }
  function frameTheme(provider, origin, dark, light) {
    themeHandler = () => {
      const frame = mount.querySelector('iframe');
      if (!frame?.contentWindow) return;
      const theme =
        config.theme && config.theme !== 'auto' ? config.theme : mode() === 'dark' ? dark : light;
      frame.contentWindow.postMessage(
        provider === 'giscus' ? { giscus: { setConfig: { theme } } } : { type: 'set-theme', theme },
        origin,
      );
    };
  }
  async function initialize(attempt) {
    const autoTheme = config.theme && config.theme !== 'auto' ? config.theme : mode();
    switch (config.provider) {
      case 'giscus': {
        const mapping = config.mapping || 'pathname';
        const term =
          mapping === 'specific'
            ? config.term || config.identifier
            : mapping === 'url'
              ? config.canonical
              : mapping === 'pathname'
                ? new URL(config.canonical).pathname
                : undefined;
        await script(
          config.src || 'https://giscus.app/client.js',
          {
            repo: config.repo,
            'repo-id': config.repo_id,
            category: config.category,
            'category-id': config.category_id,
            mapping: term ? 'specific' : mapping,
            term,
            strict: config.strict ? '1' : '0',
            'reactions-enabled': String(config.reactions_enabled ?? '1'),
            'emit-metadata': '0',
            'input-position': config.input_position || 'top',
            theme: autoTheme,
            lang,
            loading: 'lazy',
          },
          mount,
        );
        frameTheme('giscus', 'https://giscus.app', 'dark', 'light');
        break;
      }
      case 'utterances':
        await script(
          config.src || 'https://utteranc.es/client.js',
          {
            repo: config.repo,
            'issue-term':
              config.issue_term === 'pathname' || !config.issue_term
                ? new URL(config.canonical).pathname
                : config.issue_term === 'url'
                  ? config.canonical
                  : config.issue_term,
            label: config.label,
            theme:
              config.theme && config.theme !== 'auto'
                ? config.theme
                : mode() === 'dark'
                  ? 'github-dark'
                  : 'github-light',
          },
          mount,
          false,
        );
        frameTheme('utterances', 'https://utteranc.es', 'github-dark', 'github-light');
        break;
      case 'disqus':
        window.disqus_config = function () {
          this.page.url = config.canonical;
          this.page.identifier = config.identifier;
          this.page.title = config.title;
        };
        if (window.DISQUS) window.DISQUS.reset({ reload: true, config: window.disqus_config });
        else await script(`https://${config.shortname}.disqus.com/embed.js`);
        break;
      case 'waline': {
        stylesheet(config.css);
        const sdk = await import(
          /* @vite-ignore */ config.cdn || 'https://unpkg.com/@waline/client@3.16.0/dist/waline.js'
        );
        if (attempt !== generation) return;
        instance = sdk.init({
          el: mount,
          serverURL: config.serverURL,
          lang: config.lang || lang,
          path: config.identifier,
          dark: 'html[data-theme="dark"]',
          ...(config.options || {}),
        });
        break;
      }
      case 'twikoo':
        if (!window.twikoo)
          await script(
            config.cdn || 'https://cdn.jsdelivr.net/npm/twikoo@1.6.45/dist/twikoo.all.min.js',
          );
        if (attempt !== generation) return;
        await window.twikoo.init({
          envId: config.envId,
          region: config.region || '',
          el: '#comments-mount',
          path: config.identifier,
          ...(config.options || {}),
        });
        break;
      case 'valine':
        if (!window.Valine)
          await script(
            config.cdn || 'https://cdn.jsdelivr.net/npm/valine@1.5.3/dist/Valine.min.js',
          );
        if (attempt !== generation) return;
        instance = new window.Valine({
          el: '#comments-mount',
          appId: config.appid,
          appKey: config.appkey,
          serverURLs: config.serverURLs || undefined,
          path: config.identifier,
          lang: lang.startsWith('zh') ? 'zh-CN' : 'en',
          ...(config.options || {}),
        });
        break;
      default:
        throw new Error('Unsupported comments provider');
    }
  }
  function load() {
    if (section.dataset.state === 'ready' || pending) return pending;
    section.dataset.state = 'loading';
    section.setAttribute('aria-busy', 'true');
    status.textContent = labels.comments_loading;
    retry.hidden = true;
    const attempt = ++generation;
    let timer;
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Comments timed out')), timeout);
    });
    pending = Promise.race([initialize(attempt), deadline])
      .then(() => {
        if (attempt !== generation) return;
        section.dataset.state = 'ready';
        status.textContent = '';
        themeHandler?.();
      })
      .catch(() => {
        if (attempt !== generation) return;
        ++generation;
        section.dataset.state = 'error';
        status.textContent = labels.comments_failed;
        retry.hidden = false;
        instance?.destroy?.();
        instance = undefined;
        mount.replaceChildren();
        document
          .querySelectorAll('script[data-autuswing-comment-sdk]')
          .forEach((element) => element.remove());
      })
      .finally(() => {
        clearTimeout(timer);
        pending = undefined;
        section.removeAttribute('aria-busy');
      });
    return pending;
  }
  function open(scroll = false) {
    panel.hidden = false;
    bar.setAttribute('aria-expanded', 'true');
    bar.querySelector('span:last-child').textContent = labels.comments_collapse + ' ↑';
    if (config.lazyload === false || scroll || !('IntersectionObserver' in window)) load();
    else if (!observer) {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting) && !panel.hidden) {
            observer.disconnect();
            load();
          }
        },
        { rootMargin: '160px' },
      );
      observer.observe(panel);
    } else load();
    if (scroll)
      section.scrollIntoView({
        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
        block: 'start',
      });
  }
  function close() {
    if (config.collapsible === false) return;
    panel.hidden = true;
    bar.setAttribute('aria-expanded', 'false');
    bar.querySelector('span:last-child').textContent = labels.comments_expand + ' ↓';
  }
  bar.addEventListener('click', () => (panel.hidden ? open(true) : close()));
  section.querySelector('.comment-collapse')?.addEventListener('click', () => {
    close();
    bar.focus();
  });
  retry.addEventListener('click', load);
  document.querySelectorAll('a[href="#comments"]').forEach((link) =>
    link.addEventListener('click', (event) => {
      event.preventDefault();
      open(true);
      history.replaceState(null, '', '#comments');
    }),
  );
  addEventListener('autuswing:appearance', () => {
    themeHandler?.();
    instance?.update?.({ dark: 'html[data-theme="dark"]' });
  });
  if (config.preload) open();
  if (location.hash === '#comments') open(true);
  addEventListener('hashchange', () => {
    if (location.hash === '#comments') open(true);
  });
  window.AutuswingComments = { open, close, load };
})();
