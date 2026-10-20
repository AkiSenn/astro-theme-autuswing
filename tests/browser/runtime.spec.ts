import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { evidenceDirectory } from '../../scripts/test-evidence.mjs';

const theme = JSON.parse(fs.readFileSync('src/config/theme.json', 'utf8'));
const labels = JSON.parse(fs.readFileSync('src/config/zh-CN.json', 'utf8'));
const screenshots = evidenceDirectory('runtime');
fs.mkdirSync(screenshots, { recursive: true });
const elapsed = (2 * 86400 + 3 * 3600 + 4 * 60 + 5) * 1000;
const fixedNow = Date.parse(theme.footer.runtime.since) + elapsed;
const prefix = theme.footer.runtime.text || labels.runtime;
const expected = `${prefix} 2 天 3 小时 4 分 5 秒`;
const initializer = fs.readFileSync('src/scripts/runtime.js', 'utf8');

async function control(page: Page, { observer = true, visibility = false } = {}) {
  await page.addInitScript(
    ({ fixedNow, observer, visibility }) => {
      const state = ((window as any).__runtimeTest = {
        now: fixedNow,
        hidden: false,
        timers: new Set<number>(),
        observers: new Set<object>(),
        listeners: new Map<string, Set<unknown>>(),
      });
      Date.now = () => state.now;
      if (visibility)
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => state.hidden });
      if (!observer) delete (window as any).IntersectionObserver;
      else {
        const NativeObserver = window.IntersectionObserver;
        window.IntersectionObserver = class extends NativeObserver {
          observe(target: Element) {
            if (target.matches('.site-runtime')) state.observers.add(this);
            super.observe(target);
          }
          disconnect() {
            state.observers.delete(this);
            super.disconnect();
          }
        };
      }
      const schedule = window.setTimeout.bind(window),
        cancel = window.clearTimeout.bind(window);
      window.setTimeout = ((handler: TimerHandler, delay?: number, ...args: any[]) => {
        if (delay !== 1000 || typeof handler !== 'function')
          return schedule(handler, delay, ...args);
        const id = schedule(() => {
          state.timers.delete(id);
          handler(...args);
        }, delay);
        state.timers.add(id);
        return id;
      }) as typeof setTimeout;
      window.clearTimeout = (id) => {
        state.timers.delete(id);
        cancel(id);
      };
      for (const [target, names] of [
        [document, ['visibilitychange']],
        [window, ['pagehide', 'pageshow']],
      ] as const) {
        const add = target.addEventListener.bind(target),
          remove = target.removeEventListener.bind(target);
        (target as any).addEventListener = (name: string, fn: any, options: any) => {
          if ((names as readonly string[]).includes(name)) {
            if (!state.listeners.has(name)) state.listeners.set(name, new Set());
            state.listeners.get(name).add(fn);
          }
          add(name, fn, options);
        };
        (target as any).removeEventListener = (name: string, fn: any, options: any) => {
          state.listeners.get(name)?.delete(fn);
          remove(name, fn, options);
        };
      }
    },
    { fixedNow, observer, visibility },
  );
}

async function ready(page: Page) {
  await page.goto('/about/');
  await page.locator('.site-runtime').scrollIntoViewIfNeeded();
  await expect(page.locator('.site-runtime')).toHaveText(expected);
  await page.evaluate(() => document.fonts.ready);
}

async function resources(page: Page) {
  return page.evaluate(() => {
    const s = (window as any).__runtimeTest;
    return {
      timers: s.timers.size,
      observers: s.observers.size,
      listeners: Object.fromEntries([...s.listeners].map(([key, value]: any) => [key, value.size])),
    };
  });
}

for (const width of [390, 820, 1440])
  for (const mode of ['light', 'dark'] as const) {
    test(`@visual about ${width} ${mode}`, async ({ page, browser }, info) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: mode });
      await page.addInitScript((mode) => localStorage.setItem('autuswing-appearance', mode), mode);
      await control(page);
      await ready(page);
      await expect(page.locator('.site-runtime')).toBeVisible();
      expect(errors).toEqual([]);
      const metrics = await page.evaluate(() => {
        const result: Record<string, unknown> = {};
        for (const selector of [
          '.site-runtime',
          '.about-runtime',
          '.standalone-page',
          '#main',
          '.site-footer',
        ]) {
          const element = document.querySelector<HTMLElement>(selector)!;
          const rect = element.getBoundingClientRect(),
            css = getComputedStyle(element);
          result[selector] = {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            fontSize: css.fontSize,
            lineHeight: css.lineHeight,
            display: css.display,
            visibility: css.visibility,
          };
        }
        return result;
      });
      const name = `${info.project.name}-${width}-${mode}`;
      fs.writeFileSync(
        path.join(screenshots, name + '.json'),
        JSON.stringify(
          {
            metrics,
            text: await page.locator('.site-runtime').textContent(),
            browser: browser.version(),
            viewport: page.viewportSize(),
            deviceScaleFactor: await page.evaluate(() => devicePixelRatio),
          },
          null,
          2,
        ),
        { flag: 'wx' },
      );
      await page.screenshot({
        path: path.join(screenshots, name + '.png'),
        fullPage: true,
        animations: 'disabled',
      });
      await page.locator('.about-runtime').screenshot({
        path: path.join(screenshots, name + '-runtime.png'),
        animations: 'disabled',
      });
    });
  }

test('background and real viewport exit suspend updates, return recomputes wall time', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 240 });
  await control(page, { visibility: true });
  await ready(page);
  await expect.poll(async () => (await resources(page)).timers).toBe(1);
  await page.evaluate(() => {
    const state = (window as any).__runtimeTest;
    state.hidden = true;
    document.dispatchEvent(new Event('visibilitychange'));
    state.now += 2000;
  });
  expect((await resources(page)).timers).toBe(0);
  await expect(page.locator('.site-runtime')).toHaveText(expected);
  await page.evaluate(() => {
    (window as any).__runtimeTest.hidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('.site-runtime')).toHaveText(`${prefix} 2 天 3 小时 4 分 7 秒`);
  await page.evaluate(() => scrollTo(0, 0));
  await expect
    .poll(() =>
      page
        .locator('.site-runtime')
        .evaluate(
          (element) =>
            element.getBoundingClientRect().top >= innerHeight ||
            element.getBoundingClientRect().bottom <= 0,
        ),
    )
    .toBe(true);
  await expect.poll(async () => (await resources(page)).timers).toBe(0);
  await page.evaluate(() => {
    (window as any).__runtimeTest.now += 60000;
  });
  await page.locator('.site-runtime').scrollIntoViewIfNeeded();
  await expect(page.locator('.site-runtime')).toHaveText(`${prefix} 2 天 3 小时 5 分 7 秒`);
  expect((await resources(page)).timers).toBe(1);
});

test('reexecution and actual MPA navigation do not accumulate runtime resources', async ({
  page,
}) => {
  await control(page);
  await ready(page);
  await expect.poll(async () => (await resources(page)).timers).toBe(1);
  const initial = await resources(page);
  expect(initial.observers).toBe(1);
  // 原文件正文不变，仅用测试桥接模块提供相同client配置接口，触发重复模块求值。
  await page.route('**/__runtime__/**', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: new URL(route.request().url()).pathname.endsWith('helpers.js')
        ? 'export const client = () => JSON.parse(document.querySelector("#autuswing-config").textContent);'
        : initializer.replace("'./helpers'", "'/__runtime__/helpers.js'"),
    }),
  );
  for (let i = 0; i < 3; i++) {
    await page.evaluate((i) => import(`/__runtime__/runtime.js?execution=${i}`), i);
    await expect.poll(() => resources(page)).toEqual(initial);
  }
  await page
    .locator('.site-nav a[href="/"]:visible, .mobile-navigation a[href="/"]:visible')
    .first()
    .click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('.site-runtime')).toHaveCount(0);
  expect((await resources(page)).timers).toBe(0);
  await page.goBack();
  await expect(page).toHaveURL(/\/about\/$/);
  await page.locator('.site-runtime').scrollIntoViewIfNeeded();
  await expect(page.locator('.site-runtime')).toHaveText(expected);
  await expect.poll(async () => (await resources(page)).timers).toBe(1);
});

test('observer fallback updates without viewport observation and pauses in background', async ({
  page,
}) => {
  await control(page, { observer: false, visibility: true });
  await ready(page);
  expect((await resources(page)).observers).toBe(0);
  expect((await resources(page)).timers).toBe(1);
  await page.evaluate(() => {
    const state = (window as any).__runtimeTest;
    state.hidden = true;
    document.dispatchEvent(new Event('visibilitychange'));
    state.now += 1000;
  });
  expect((await resources(page)).timers).toBe(0);
  await page.evaluate(() => {
    (window as any).__runtimeTest.hidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('.site-runtime')).toHaveText(`${prefix} 2 天 3 小时 4 分 6 秒`);
  expect((await resources(page)).timers).toBe(1);
});
