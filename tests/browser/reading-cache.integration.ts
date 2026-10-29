import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { cacheFixturePaths } from '../fixtures/reading-cache.mjs';

test.use({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });

test.beforeEach(async ({ page, request, baseURL }) => {
  if (!baseURL || !/^http:\/\/127\.0\.0\.1:\d+$/.test(baseURL))
    throw new Error('[HOLD:fixture] 此显式 integration 入口要求独立构建的本机 QA 站点');
  const response = await request.get(baseURL + cacheFixturePaths.ordinary, { maxRedirects: 0 });
  expect(response.status(), '[HOLD:fixture] 普通页构建夹具缺失').toBe(200);
  expect(await response.text()).toContain('data-reading-cache-fixture="v1"');
  await page.addInitScript(() => {
    const state = { reads: 0, queries: 0, subscriptions: [] as any[], observers: [] as any[] };
    (window as any).__readingCacheState = state;
    const add = EventTarget.prototype.addEventListener,
      remove = EventTarget.prototype.removeEventListener;
    EventTarget.prototype.addEventListener = function (name: any, handler: any, options: any) {
      const capture = typeof options === 'boolean' ? options : !!options?.capture;
      if (
        !state.subscriptions.some(
          (s) =>
            s.target === this && s.name === name && s.handler === handler && s.capture === capture,
        )
      )
        state.subscriptions.push({ target: this, name, handler, capture });
      return add.call(this, name, handler, options);
    };
    EventTarget.prototype.removeEventListener = function (name: any, handler: any, options: any) {
      const capture = typeof options === 'boolean' ? options : !!options?.capture;
      state.subscriptions = state.subscriptions.filter(
        (s) =>
          !(s.target === this && s.name === name && s.handler === handler && s.capture === capture),
      );
      return remove.call(this, name, handler, options);
    };
    const rect = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function () {
      if (!(window as any).__readingCacheProbe && this.matches('.prose :is(h2,h3,h4,h5,h6)'))
        state.reads++;
      return rect.call(this);
    };
    const query = Document.prototype.querySelectorAll;
    Document.prototype.querySelectorAll = function (selector: any) {
      if (!(window as any).__readingCacheProbe && selector === '.toc-link') state.queries++;
      return query.call(this, selector);
    } as typeof query;
    if ('ResizeObserver' in window) {
      const observe = ResizeObserver.prototype.observe,
        disconnect = ResizeObserver.prototype.disconnect;
      ResizeObserver.prototype.observe = function (target, options) {
        state.observers.push({ owner: this, target, active: true });
        return observe.call(this, target, options);
      };
      ResizeObserver.prototype.disconnect = function () {
        state.observers.forEach((o) => {
          if (o.owner === this) o.active = false;
        });
        return disconnect.call(this);
      };
    }
  });
});

async function settled(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
  });
}

async function snapshot(page: Page) {
  return page.evaluate(() => {
    (window as any).__readingCacheProbe = true;
    try {
      const state = (window as any).__readingCacheState;
      const root = document.querySelector('.article, .standalone-page');
      const padding = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
      const headings = [
        ...document.querySelectorAll<HTMLElement>(
          '.prose h2,.prose h3,.prose h4,.prose h5,.prose h6',
        ),
      ].map((h) => ({
        id: h.id,
        top: h.getBoundingClientRect().top,
        margin: parseFloat(getComputedStyle(h).scrollMarginTop) || 0,
      }));
      const active = [
        ...new Set(
          [...document.querySelectorAll<HTMLAnchorElement>('.toc-link.active')].map((a) => a.hash),
        ),
      ];
      return {
        y: scrollY,
        padding,
        headings,
        active,
        reads: state.reads,
        queries: state.queries,
        rootObservers: state.observers.filter((o: any) => o.active && o.target === root).length,
        contentsSubscriptions: state.subscriptions.filter(
          (s: any) => s.name === 'reading-contents-change',
        ).length,
        fontSubscriptions: state.subscriptions.filter(
          (s: any) => s.target === document.fonts && s.name === 'loadingdone',
        ).length,
      };
    } finally {
      (window as any).__readingCacheProbe = false;
    }
  });
}

async function chapter(page: Page, id: string, info: TestInfo, label: string) {
  try {
    await expect.poll(async () => (await snapshot(page)).active).toEqual(['#' + id]);
  } finally {
    await info.attach(label, {
      body: JSON.stringify(await snapshot(page)),
      contentType: 'application/json',
    });
  }
}

async function atB(page: Page, path: string, info: TestInfo) {
  await page.goto(path);
  await settled(page);
  await page.locator('#Cache-B').evaluate((node) => {
    const line =
      (parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0) +
      (parseFloat(getComputedStyle(node).scrollMarginTop) || 0);
    scrollTo({ top: node.getBoundingClientRect().top + scrollY - line + 300, behavior: 'instant' });
  });
  await chapter(page, 'Cache-B', info, 'initial-position');
  return (await snapshot(page)).y;
}

async function keepY(page: Page, y: number) {
  await settled(page);
  await page.evaluate((y) => scrollTo({ top: y, behavior: 'instant' }), y);
  await settled(page);
}

for (const [kind, path] of Object.entries({
  ordinary: cacheFixturePaths.ordinary,
  article: cacheFixturePaths.article,
})) {
  test(`${kind}: expanded content updates actual chapter without resize`, async ({
    page,
  }, info) => {
    const y = await atB(page, path, info);
    await page.locator('#cache-details').evaluate((node: HTMLDetailsElement) => (node.open = true));
    await keepY(page, y);
    expect((await snapshot(page)).headings.find((h) => h.id === 'Cache-B')!.top).toBeGreaterThan(
      1000,
    );
    await chapter(page, 'Cache-A', info, 'expanded-position');
    await page
      .locator('#cache-details')
      .evaluate((node: HTMLDetailsElement) => (node.open = false));
    await keepY(page, y);
    await chapter(page, 'Cache-B', info, 'collapsed-position');
  });

  test(`${kind}: asynchronous image load updates actual chapter`, async ({ page }, info) => {
    const y = await atB(page, path, info);
    await page.locator('#cache-image').evaluate(async (image: HTMLImageElement) => {
      image.src = '/__qa__/reading-cache.svg';
      await image.decode();
    });
    await keepY(page, y);
    await chapter(page, 'Cache-A', info, 'image-position');
  });
}

test('repeated changes preserve one observer and stable-scroll cached measurements', async ({
  page,
}, info) => {
  const y = await atB(page, cacheFixturePaths.ordinary, info);
  const original = await snapshot(page);
  for (let i = 0; i < 5; i++) {
    for (const open of [true, false]) {
      await page
        .locator('#cache-details')
        .evaluate((node: HTMLDetailsElement, open) => (node.open = open), open);
      await keepY(page, y);
      await chapter(page, open ? 'Cache-A' : 'Cache-B', info, `cycle-${i}-${open}`);
    }
  }
  const before = await snapshot(page);
  for (let i = 0; i < 20; i++) {
    await keepY(page, y + i);
  }
  const after = await snapshot(page);
  expect(after.reads).toBe(before.reads);
  expect(after.queries).toBe(before.queries);
  expect(after.rootObservers).toBe(1);
  expect(after.contentsSubscriptions).toBe(original.contentsSubscriptions);
  expect(after.fontSubscriptions).toBe(original.fontSubscriptions);
  await info.attach('steady-scroll-and-subscriptions', {
    body: JSON.stringify({ original, before, after }),
    contentType: 'application/json',
  });
});

test('mobile TOC opens with the corrected chapter and restores focus', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const y = await atB(page, cacheFixturePaths.ordinary, info);
  await page.locator('#cache-details').evaluate((node: HTMLDetailsElement) => (node.open = true));
  await keepY(page, y);
  await chapter(page, 'Cache-A', info, 'before-opening-toc');
  const opener = page.locator('.goto-toc:visible');
  await opener.click();
  await expect(page.locator('.contents-dialog')).toBeVisible();
  await chapter(page, 'Cache-A', info, 'open-toc');
  await page.keyboard.press('Escape');
  await expect(opener).toBeFocused();
  await chapter(page, 'Cache-A', info, 'closed-toc');
});

test('no ResizeObserver uses scoped toggle and image load fallback', async ({ page }, info) => {
  await page.addInitScript(() => {
    delete (window as any).ResizeObserver;
  });
  const y = await atB(page, cacheFixturePaths.ordinary, info);
  await page.locator('#cache-details').evaluate((node: HTMLDetailsElement) => (node.open = true));
  await keepY(page, y);
  await chapter(page, 'Cache-A', info, 'fallback-expanded');
  expect((await snapshot(page)).rootObservers).toBe(0);
  await page.locator('#cache-details').evaluate((node: HTMLDetailsElement) => (node.open = false));
  await keepY(page, y);
  await chapter(page, 'Cache-B', info, 'fallback-collapsed');
  await page.locator('#cache-image').evaluate(async (image: HTMLImageElement) => {
    image.src = '/__qa__/reading-cache.svg';
    await image.decode();
  });
  await keepY(page, y);
  await chapter(page, 'Cache-A', info, 'fallback-image');
});

test('TOC disabled does not subscribe to content size changes', async ({ page }) => {
  await page.goto(cacheFixturePaths.disabled);
  await settled(page);
  await expect(page.locator('.toc-link')).toHaveCount(0);
  await page.locator('#cache-details').evaluate((node: HTMLDetailsElement) => (node.open = true));
  await settled(page);
  const state = await snapshot(page);
  expect(state.active).toEqual([]);
  expect(state.rootObservers).toBe(0);
  expect(state.fontSubscriptions).toBe(0);
});

test('persisted lifecycle model retains owner; final departure model releases it', async ({
  page,
}, info) => {
  const y = await atB(page, cacheFixturePaths.ordinary, info);
  await page.evaluate(() =>
    dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })),
  );
  expect((await snapshot(page)).rootObservers).toBe(1);
  await page.locator('#cache-details').evaluate((node: HTMLDetailsElement) => (node.open = true));
  await keepY(page, y);
  await page.evaluate(() =>
    dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })),
  );
  await chapter(page, 'Cache-A', info, 'persisted-lifecycle-model');
  await page.evaluate(() =>
    dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false })),
  );
  const before = await snapshot(page);
  expect(before.rootObservers).toBe(0);
  expect(before.contentsSubscriptions).toBe(0);
  expect(before.fontSubscriptions).toBe(0);
  await page.locator('#cache-details').evaluate((node: HTMLDetailsElement) => (node.open = false));
  await keepY(page, y);
  expect((await snapshot(page)).reads).toBe(before.reads);
  await info.attach('lifecycle-model-not-real-bfcache', {
    body: JSON.stringify(before),
    contentType: 'application/json',
  });
});
