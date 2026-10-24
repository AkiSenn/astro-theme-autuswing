import { test, expect, chromium, type Page } from '@playwright/test';
import { load } from 'cheerio';

const article = '/post/55b0541c/';
const entry = 'autuswing-content-enter';
const browserMessages = new Map<string, { errors: string[]; console: string[] }>();

test.beforeEach(({}, info) => {
  browserMessages.set(info.testId, { errors: [], console: [] });
});
test.afterEach(async ({ page }, info) => {
  if (info.status !== info.expectedStatus && !page.isClosed()) {
    await info.attach('entry-state-at-failure', { body: JSON.stringify(await page.evaluate(() => ({
      readyState: document.readyState, visibility: document.visibilityState,
      root: { ...document.documentElement.dataset }, records: (window as any).__entryRecords,
      main: document.getElementById('main') ? { opacity: getComputedStyle(document.getElementById('main')!).opacity, transform: getComputedStyle(document.getElementById('main')!).transform } : null,
    }))), contentType: 'application/json' });
  }
  const messages = browserMessages.get(info.testId)!;
  await info.attach('browser-messages', { body: JSON.stringify(messages), contentType: 'application/json' });
  browserMessages.delete(info.testId);
  expect(messages.errors).toEqual([]);
});

async function observe(page: Page, hold = true) {
  const records: any[] = [];
  const messages = browserMessages.get(test.info().testId)!;
  page.on('pageerror', (error) => messages.errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') messages.console.push(message.text()); });
  await page.exposeFunction('recordEntry', (record: any) => records.push(record));
  await page.addInitScript(({ hold, entry }) => {
    const local: any[] = [];
    (window as any).__entryRecords = local;
    (window as any).__entryToken = Math.random();
    (window as any).__entryInitialized = false;
    addEventListener('autuswing:appearance', () => queueMicrotask(() => {
      (window as any).__entryInitialized = true;
    }), { once: true });
    const sample = () => {
      const main = document.getElementById('main');
      return {
        marker: document.documentElement.hasAttribute('data-page-entry'),
        opacity: main ? getComputedStyle(main).opacity : null,
        transform: main ? getComputedStyle(main).transform : null,
        animations: document.getAnimations().map((a: any) => ({
          name: a.animationName, duration: a.effect?.getTiming().duration,
          // CSS animation-timing-function 作用于关键帧区间，不是整个 effect 的 easing。
          easing: a.effect?.getKeyframes()[0]?.easing,
          frames: a.effect?.getKeyframes(),
        })),
      };
    };
    const send = (record: any) => {
      const value = { path: location.pathname, token: (window as any).__entryToken, ...record };
      local.push(value);
      (window as any).recordEntry(value).catch(() => {});
    };
    document.addEventListener('animationstart', (event) => {
      if (event.animationName !== entry || event.target !== document.getElementById('main')) return;
      for (const animation of document.getAnimations()) {
        if ((animation as any).animationName === entry && hold) {
          animation.pause(); animation.currentTime = 80;
        }
      }
      send({ kind: 'css', ...sample(), readyState: document.readyState });
    });
    for (const name of ['pageshow', 'pagehide']) addEventListener(name, (event: any) => {
      send({ kind: name, persisted: event.persisted, ...sample() });
    });
    addEventListener('pagereveal', (event: any) => {
      send({ kind: 'reveal', native: !!event.viewTransition });
      event.viewTransition?.ready.then(() => send({ kind: 'cross', ...sample() }),
        (error: unknown) => send({ kind: 'cross-skipped', error: String(error) }));
    });
    if (typeof document.startViewTransition === 'function') {
      const original = document.startViewTransition.bind(document);
      document.startViewTransition = ((update: () => void) => {
        const vt = original(update);
        vt.ready.then(() => send({ kind: 'same', ...sample() }),
          (error: unknown) => send({ kind: 'same-skipped', error: String(error) }));
        return vt;
      }) as typeof document.startViewTransition;
    }
  }, { hold, entry });
  return records;
}

async function finishEntry(page: Page) {
  if (await page.evaluate(() => typeof window.PageRevealEvent === 'function' && 'viewTransition' in window.PageRevealEvent.prototype)) {
    await expect.poll(async () => (await localRecords(page, 'reveal')).length).toBeGreaterThan(0);
  }
  if (await page.locator('html').getAttribute('data-page-entry') !== null) {
    // 先等真实animationstart采样完成，避免迟到的暂停夹具倒退已finish的动画。
    await expect.poll(async () => (await localRecords(page, 'css')).length).toBeGreaterThan(0);
  }
  await page.evaluate(() => {
    document.getAnimations().filter((a: any) => a.animationName === 'autuswing-content-enter')
      .forEach((a) => a.finish());
  });
  await expect(page.locator('html')).not.toHaveAttribute('data-page-entry');
}

async function settled(page: Page) {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    await document.fonts.ready;
    await document.activeViewTransition?.finished.catch(() => {});
    await Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {})));
  });
}

async function localRecords(page: Page, kind: string) {
  return page.evaluate((kind) => (window as any).__entryRecords.filter((e: any) => e.kind === kind), kind);
}

async function assertFinal(page: Page) {
  await expect(page.locator('html')).not.toHaveAttribute('data-page-entry');
  await expect(page.locator('#main')).toHaveCSS('opacity', '1');
  await expect(page.locator('#main')).toHaveCSS('transform', 'none');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
}

test('direct entry and reload use real 280ms/6px CSS with stable shell and finite visible state', async ({ page }, info) => {
  const records = await observe(page);
  for (const operation of ['direct', 'reload']) {
    if (operation === 'direct') await page.goto('/archives/');
    else await page.reload();
    await expect.poll(async () => (await localRecords(page, 'css')).length).toBe(1);
    const css = (await localRecords(page, 'css'))[0];
    const animation = css.animations.find((a: any) => a.name === entry);
    expect(animation.duration).toBe(280);
    expect(animation.easing).toBe('cubic-bezier(0.22, 1, 0.36, 1)');
    expect(animation.frames.map((f: any) => f.transform)).toEqual(['translateY(6px)', 'none']);
    expect(Number(css.opacity)).toBeGreaterThan(0);
    expect(Number(css.opacity)).toBeLessThan(1);
    const layout = await page.evaluate(() => {
      const main = document.getElementById('main')!;
      const nav = document.querySelector('.desktop-sidebar')!.getBoundingClientRect();
      return { main: [main.offsetLeft, main.offsetTop, main.offsetWidth, main.offsetHeight], nav: [nav.x, nav.y, nav.width, nav.height], x: scrollX, y: scrollY };
    });
    await page.screenshot({ path: info.outputPath(operation + '-css-midpoint.png') });
    await finishEntry(page); await settled(page); await assertFinal(page);
    expect(await page.evaluate(() => {
      const main = document.getElementById('main')!;
      const nav = document.querySelector('.desktop-sidebar')!.getBoundingClientRect();
      return { main: [main.offsetLeft, main.offsetTop, main.offsetWidth, main.offsetHeight], nav: [nav.x, nav.y, nav.width, nav.height], x: scrollX, y: scrollY };
    })).toEqual(layout);
  }
  await info.attach('direct-and-reload', { body: JSON.stringify(records), contentType: 'application/json' });
});

test('ordinary MPA navigation chooses actual native cross-document or CSS, never both', async ({ page, browserName }, info) => {
  const records = await observe(page);
  await page.goto(article); await finishEntry(page); await settled(page);
  const native = await page.evaluate(() => 'PageRevealEvent' in window && 'CSSViewTransitionRule' in window);
  expect(native).toBe(browserName !== 'firefox');
  for (const target of ['/', '/archives/', article]) {
    const selector = target === article ? `#main a[href="${article}"]` : `nav:visible a[href="${target}"]`;
    await page.locator(selector).first().click();
    await expect(page).toHaveURL(new RegExp(target.replaceAll('/', '\\/') + '$'));
    if (native) {
      await expect.poll(async () => (await localRecords(page, 'cross')).length).toBe(1);
      const event = (await localRecords(page, 'cross'))[0];
      expect(event.marker).toBe(false);
      expect(event.animations.filter((a: any) => /^autuswing-page-/.test(a.name)).map((a: any) => a.duration).sort((a: number, b: number) => a - b)).toEqual([160, 360]);
      expect(event.animations.filter((a: any) => /^autuswing-page-/.test(a.name)).map((a: any) => a.easing)).toEqual(['cubic-bezier(0.22, 1, 0.36, 1)', 'cubic-bezier(0.22, 1, 0.36, 1)']);
      expect(await localRecords(page, 'css')).toEqual([]);
    } else {
      await expect.poll(async () => (await localRecords(page, 'css')).length).toBe(1);
      expect(await localRecords(page, 'cross')).toEqual([]);
      await finishEntry(page);
    }
    await settled(page); await assertFinal(page);
  }
  await info.attach('actual-navigation-choice', { body: JSON.stringify(records), contentType: 'application/json' });
});

test('slow page and delayed module select entry before late initialization instead of hiding painted content', async ({ page }, info) => {
  const records = await observe(page);
  await page.goto('/archives/?entry-stream=1');
  await expect.poll(async () => (await localRecords(page, 'css')).length).toBe(1);
  await finishEntry(page); await settled(page); await assertFinal(page);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/*.js', async (route) => { await gate; await route.continue(); });
  try {
    await page.goto('/archives/?entry-module=1', { waitUntil: 'commit' });
    await page.waitForFunction(() => document.getElementById('main'));
    expect(await page.evaluate(() => (window as any).__entryInitialized)).toBe(false);
    const blocked = await page.evaluate(() => {
      const root = document.documentElement, main = document.getElementById('main')!;
      return { installed: document.getElementById('autuswing-page-entry')!.hasAttribute('data-installed'), marker: root.hasAttribute('data-page-entry'), opacity: getComputedStyle(main).opacity, visibility: getComputedStyle(main).visibility, hidden: main.hidden, inlineOpacity: main.style.opacity, animations: main.getAnimations().map((a: any) => ({ name: a.animationName, duration: a.effect?.getTiming().duration })) };
    });
    expect(blocked.installed).toBe(true);
    expect(blocked.hidden).toBe(false);
    expect(blocked.visibility).toBe('visible');
    expect(blocked.inlineOpacity).toBe('');
    if (blocked.marker) expect(blocked.animations.filter(a => a.name === entry).map(a => a.duration)).toEqual([280]);
    else expect(blocked.opacity).toBe('1');
    release(); await page.waitForLoadState('load');
    await expect.poll(async () => (await localRecords(page, 'css')).length).toBe(1);
    await finishEntry(page); await settled(page); await assertFinal(page);
    await page.screenshot({ path: info.outputPath('slow-loaded-visible.png') });
    expect(await localRecords(page, 'css')).toHaveLength(1);
    await info.attach('slow-entry', { body: JSON.stringify({ records, blocked }), contentType: 'application/json' });
  } finally { release(); }
});

for (const policy of ['system', 'config']) test(`${policy} motion policy cancels a running entry without replay`, async ({ page }, info) => {
  const records = await observe(page);
  await page.goto('/archives/');
  await expect.poll(async () => (await localRecords(page, 'css')).length).toBe(1);
  if (policy === 'system') await page.emulateMedia({ reducedMotion: 'reduce' });
  else await page.evaluate(() => { document.documentElement.dataset.motion = 'false'; });
  await assertFinal(page);
  if (policy === 'system') await page.emulateMedia({ reducedMotion: 'no-preference' });
  else await page.evaluate(() => { document.documentElement.dataset.motion = 'true'; });
  await settled(page); await assertFinal(page);
  expect(await localRecords(page, 'css')).toHaveLength(1);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(article); await settled(page); await assertFinal(page);
  expect(await localRecords(page, 'css')).toEqual([]);
  await info.attach('entry-policy', { body: JSON.stringify(records), contentType: 'application/json' });
});

test('theme same-document native transition cancels entry and never restarts CSS afterwards', async ({ page }, info) => {
  const records = await observe(page);
  await page.addInitScript(() => localStorage.setItem('autuswing-appearance', 'light'));
  await page.goto('/archives/');
  await expect.poll(async () => (await localRecords(page, 'css')).length).toBe(1);
  await page.waitForFunction(() => (window as any).__entryInitialized);
  await page.locator('.mode-toggle:visible').focus(); await page.keyboard.press('Enter');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect.poll(async () => (await localRecords(page, 'same')).length).toBe(1);
  const event = (await localRecords(page, 'same'))[0];
  expect(event.marker).toBe(false);
  expect(event.animations.filter((a: any) => a.name === 'autuswing-appearance-in').map((a: any) => a.duration)).toEqual([180]);
  expect(event.animations.some((a: any) => a.name === entry)).toBe(false);
  await settled(page); await assertFinal(page);
  expect(await localRecords(page, 'css')).toHaveLength(1);
  await expect(page.locator('.mode-toggle:visible')).toBeFocused();
  await info.attach('theme-and-entry', { body: JSON.stringify(records), contentType: 'application/json' });
});

test('history preserves scroll, cached pages do not reenter, anchors remain browser-owned', async ({ page, browserName, baseURL }, info) => {
  // Playwright默认关闭Edge BFCache；此场景恢复浏览器默认能力并独立保留Trace。
  const cacheBrowser = browserName === 'chromium'
    ? await chromium.launch({ channel: 'msedge', ignoreDefaultArgs: ['--disable-back-forward-cache'] })
    : undefined;
  const cacheContext = await cacheBrowser?.newContext({ baseURL, viewport: { width: 1440, height: 900 }, serviceWorkers: 'block', reducedMotion: 'no-preference' });
  try {
  if (cacheContext) page = await cacheContext.newPage();
  const records = await observe(page, false);
  await page.goto(article); await settled(page);
  await page.evaluate(() => scrollTo({ top: 1200, behavior: 'instant' }));
  const token = await page.evaluate(() => (window as any).__entryToken);
  await page.locator('nav:visible a[href="/"]').click(); await settled(page);
  const homeToken = await page.evaluate(() => (window as any).__entryToken);
  // 缓存恢复没有新的load；触发原生history，再严格验证URL、缓存事件和滚动。
  await page.evaluate(() => history.back());
  await expect(page).toHaveURL(new RegExp(article + '$')); await settled(page);
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(1200);
  await assertFinal(page);
  const restored = (await localRecords(page, 'pageshow')).some((e: any) => e.persisted);
  if (restored) {
    expect(await page.evaluate(() => (window as any).__entryToken)).toBe(token);
    expect(await localRecords(page, 'css')).toHaveLength(1);
  }
  if (browserName === 'chromium') expect(restored, 'Edge must exercise actual BFCache restoration').toBe(true);
  await page.evaluate(() => history.forward());
  await expect.poll(() => new URL(page.url()).pathname).toBe('/'); await settled(page); await assertFinal(page);
  if (browserName === 'chromium') {
    expect(await page.evaluate(() => (window as any).__entryToken)).toBe(homeToken);
    expect(await localRecords(page, 'css')).toEqual([]);
  }
  await page.evaluate(() => history.back());
  await expect(page).toHaveURL(new RegExp(article + '$')); await settled(page);
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(1200);
  const target = await page.locator('.prose h2[id]').first().getAttribute('id');
  expect(target).toBeTruthy();
  const previousEntries = (await localRecords(page, 'css')).length;
  const anchorDocument = await page.evaluate(() => (window as any).__entryToken);
  await page.evaluate((target) => { location.hash = encodeURIComponent(target); }, target!);
  await settled(page); await assertFinal(page);
  expect(await page.evaluate(() => (window as any).__entryToken)).toBe(anchorDocument);
  expect(await localRecords(page, 'css')).toHaveLength(previousEntries);
  await page.goto('/archives/'); await settled(page);
  await page.goto(article + '#' + encodeURIComponent(target!)); await settled(page); await assertFinal(page);
  expect(await localRecords(page, 'css')).toEqual([]);
  const top = await page.locator('.prose h2[id]').first().evaluate((n) => n.getBoundingClientRect().top);
  expect(top).toBeGreaterThanOrEqual(0);
  expect(top).toBeLessThan(200);
  await info.attach('history-and-anchor', { body: JSON.stringify({ records, restored, top }), contentType: 'application/json' });
  } finally {
    if (cacheContext) {
      await cacheContext.close();
    }
    await cacheBrowser?.close();
  }
});

test('navigation away during a paused entry leaves no hidden or animated cached state', async ({ page }, info) => {
  const records = await observe(page);
  await page.goto('/archives/');
  await expect.poll(async () => (await localRecords(page, 'css')).length).toBe(1);
  await page.locator(`#main a[href="${article}"]`).first().click();
  await expect(page).toHaveURL(new RegExp(article));
  await finishEntry(page); await settled(page); await assertFinal(page);
  await page.goBack(); await finishEntry(page); await settled(page); await assertFinal(page);
  expect(new URL(page.url()).pathname).toBe('/archives/');
  await info.attach('entry-navigation-interruption', { body: JSON.stringify(records), contentType: 'application/json' });
});

test('old-API capability model and JavaScript-disabled pages retain mobile content and navigation', async ({ page, browser, baseURL }, info) => {
  const records = await observe(page);
  await page.route('**/*', async (route) => {
    if (route.request().resourceType() !== 'document') return route.continue();
    const response = await route.fetch(), html = load(await response.text());
    html('#autuswing-page-motion').remove();
    await route.fulfill({ response, body: html.html() });
  });
  await page.addInitScript(() => {
    for (const key of ['onpagereveal', 'onpageswap', 'PageRevealEvent', 'PageSwapEvent', 'CSSViewTransitionRule']) {
      for (let object: any = window; object; object = Object.getPrototypeOf(object)) {
        if (Object.prototype.hasOwnProperty.call(object, key)) {
          if (!Reflect.deleteProperty(object, key)) throw Error('Cannot model missing capability: ' + key);
        }
      }
    }
    Object.defineProperty(document, 'startViewTransition', { value: undefined, configurable: true });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(article);
  await expect.poll(async () => (await localRecords(page, 'css')).length).toBe(1);
  await finishEntry(page); await settled(page); await assertFinal(page);
  await page.locator('.mode-toggle:visible').click();
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'light');
  await page.locator('.goto-toc:visible').click(); await expect(page.locator('.contents-dialog')).toBeVisible();
  await page.keyboard.press('Escape'); await expect(page.locator('.contents-dialog')).not.toBeVisible();
  await page.locator('.search-open:visible').click(); await expect(page.locator('#search-input')).toBeFocused();
  await page.keyboard.press('Escape');
  await page.locator('nav:visible a[href="/archives/"]').click(); await finishEntry(page); await settled(page); await assertFinal(page);
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  try {
    const noJS = await context.newPage(); await noJS.goto('/archives/');
    await expect(noJS.locator('#main')).toHaveCSS('opacity', '1');
    await expect(noJS.locator('#main')).toHaveCSS('transform', 'none');
    await noJS.locator(`#main a[href="${article}"]`).first().click(); await expect(noJS).toHaveURL(new RegExp(article));
  } finally { await context.close(); }
  await info.attach('old-api-model-not-real-safari', { body: JSON.stringify(records), contentType: 'application/json' });
});
