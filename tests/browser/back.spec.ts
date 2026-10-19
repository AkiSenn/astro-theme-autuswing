import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import { inspectTransitionMode, assertUnanimatedNavigation } from '../support/transition-contract';

const article = '/post/55b0541c/';
import { evidenceDirectory } from '../../scripts/test-evidence.mjs';
const dir = evidenceDirectory('back');
fs.mkdirSync(dir, { recursive: true });
async function settled(page: Page) {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    await Promise.all(
      document
        .getAnimations()
        .filter((a: any) => ['autuswing-page-in', 'autuswing-page-out'].includes(a.animationName))
        .map((a) => a.finished.catch(() => {})),
    );
  });
}
async function back(page: Page, path: string) {
  const href = new URL(path, page.url()).href;
  await expect(page.locator('[data-article-back]')).toHaveAccessibleName('返回');
  await expect(page.locator('[data-article-back]')).toHaveAttribute('href', href);
  await page.locator('[data-article-back]').click();
  await expect(page).toHaveURL(href);
  await settled(page);
}

test('direct and refreshed article entries fall back to archives', async ({ page }) => {
  await page.goto(article);
  await expect(page.locator('[data-article-back]')).toHaveText('← 返回');
  await expect(page.locator('[data-article-back]')).toHaveAttribute('href', /\/archives\/$/);
  await page.reload();
  await page.locator('[data-article-back]').click();
  await expect(page).toHaveURL(/\/archives\/$/);
  await expect(page.locator('.timeline')).toBeVisible();
});

test('an external previous page and a same-origin new tab cannot become an unsafe back target', async ({
  page,
  context,
  baseURL,
}) => {
  await page.route('https://outside.invalid/**', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<a href="${new URL(article, baseURL).href}">Read</a>`,
    }),
  );
  await page.goto('https://outside.invalid/');
  await page.getByRole('link', { name: 'Read' }).click();
  await page.locator('[data-article-back]').click();
  await expect(page).toHaveURL(new URL('/archives/', baseURL).href);
  await page.goto('/');
  await page
    .locator('.post-card-title a')
    .first()
    .evaluate((node) => node.setAttribute('target', '_blank'));
  const popupPromise = context.waitForEvent('page');
  await page.locator('.post-card-title a').first().click();
  const popup = await popupPromise;
  await popup.waitForLoadState();
  expect(await popup.evaluate(() => document.referrer)).toContain(new URL(baseURL!).origin);
  await expect(popup.locator('[data-article-back]')).toHaveAttribute('href', /\/archives\/$/);
  await popup.locator('[data-article-back]').click();
  await expect(popup).toHaveURL(/\/archives\/$/);
  await popup.close();
});

test('home returns share one implementation on phone, tablet and PC without scroll resets', async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
  const checks = [];
  for (const [width, height] of [
    [390, 844],
    [820, 1180],
    [1024, 768],
    [1366, 768],
    [1920, 1080],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await page.locator('.post-card-title a').last().scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => scrollY);
    await page.locator('.post-card-title a').last().click();
    await settled(page);
    await page.screenshot({ path: `${dir}/article-back-${width}.png` });
    await back(page, '/');
    await expect.poll(() => page.evaluate((y) => Math.abs(scrollY - y), before)).toBeLessThan(3);
    checks.push({ width, height, before, after: await page.evaluate(() => scrollY) });
  }
  fs.writeFileSync(`${dir}/layouts.json`, JSON.stringify(checks, null, 2));
});

test('archive and taxonomy sources survive article refresh and repeated forward/back traversal', async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const source of ['/archives/', '/tags/Hexo/', '/categories/网站建设/']) {
    await page.goto(source);
    const href = page.url();
    await page.locator(`.timeline a[href="${article}"]`).click();
    await page.reload();
    await back(page, href);
    await page.goForward();
    await settled(page);
    await expect(page.locator('[data-article-back]')).toHaveAttribute('href', href);
    await back(page, href);
    await expect(page.locator('a[href="/archives/"]:visible').first()).toBeVisible();
  }
});

test('article fragments are skipped and long-page scroll is restored by native history', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 600 });
  await page.goto('/');
  await page.locator('.post-card-title a').last().scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => scrollY);
  expect(before).toBeGreaterThan(0);
  // Programmatic anchor activation keeps the source list's scroll position.
  await page
    .locator(`.post-card-title a[href="${article}"]`)
    .evaluate((node: HTMLAnchorElement) => node.click());
  await expect(page).toHaveURL(new RegExp(article));
  await page.locator('.reading-sidebar .toc-link').nth(7).click();
  await page.locator('.reading-sidebar .toc-link').nth(12).click();
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(1000);
  await back(page, '/');
  await expect.poll(() => page.evaluate((y) => Math.abs(scrollY - y), before)).toBeLessThan(3);
  fs.writeFileSync(
    `${dir}/scroll.json`,
    JSON.stringify({ before, restored: await page.evaluate(() => scrollY) }),
  );
});

test('return restores search results on cold history navigation and respects a later manual close', async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/archives/');
  await page.locator('.search-open:visible').click();
  await page.locator('#search-input').fill('GitHub');
  await expect(page.locator('.search-results a').first()).toBeVisible();
  await page.locator('#search-input').press('ArrowDown');
  await page.locator('#search-input').press('Enter');
  await expect(page.locator('[data-article-back]')).toBeVisible();
  await page.reload();
  await back(page, '/archives/');
  await expect(page.locator('.search-dialog')).toBeVisible();
  await expect(page.locator('#search-input')).toHaveValue('GitHub');
  await expect(page.locator('.search-results a.selected')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.locator('.search-dialog')).not.toBeVisible();
  expect(
    await page.evaluate(() => navigation.currentEntry?.getState()?.autuswingSearch),
  ).toBeUndefined();
  await page.goForward();
  await back(page, '/archives/');
  await expect(page.locator('.search-dialog')).not.toBeVisible();
});

test('missing Navigation API and disabled JavaScript keep the ordinary archive link', async ({
  page,
  browser,
  baseURL,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, 'navigation', { value: undefined, configurable: true }),
  );
  await page.goto('/');
  await page.locator('.post-card-title a').first().click();
  await expect(page.locator('[data-article-back]')).toHaveAttribute('href', /\/archives\/$/);
  await page.locator('[data-article-back]').click();
  await expect(page).toHaveURL(/\/archives\/$/);
  const context = await browser.newContext({
    baseURL,
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  const native = await context.newPage();
  await native.goto(article);
  await expect(native.locator('[data-article-back]')).toHaveAccessibleName('返回');
  await native.locator('[data-article-back]').click();
  await expect(native).toHaveURL(/\/archives\/$/);
  await context.close();
});

test('smart return runs the existing native content transition', async ({ page, browserName }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const events: any[] = [];
  await page.exposeFunction('recordBackTransition', (event: any) => events.push(event));
  await page.addInitScript(() =>
    addEventListener('pagereveal', async (event: any) => {
      if (!event.viewTransition) return;
      await event.viewTransition.ready;
      (window as any).recordBackTransition({
        path: location.pathname,
        type: navigation.activation?.navigationType,
        names: document.getAnimations().map((a: any) => a.animationName),
      });
    }),
  );
  await page.goto('/');
  const mode = await inspectTransitionMode(page, browserName);
  await page.locator('.post-card-title a').first().click();
  await settled(page);
  await back(page, '/');
  if (mode === 'native') {
    await expect
      .poll(() => events.filter((e) => e.path === '/' && e.type === 'traverse').length)
      .toBe(1);
    expect(events.at(-1).names.sort()).toEqual(['autuswing-page-in', 'autuswing-page-out']);
  } else {
    expect(events).toHaveLength(0);
    await assertUnanimatedNavigation(page);
    await expect(page.locator('.desktop-sidebar')).toBeVisible();
    await expect(page.locator('.post-card')).toHaveCount(3);
    expect(await page.evaluate(() => navigation.activation?.navigationType)).toBe('traverse');
    await page.goForward();
    await expect(page).toHaveURL(new RegExp(article));
    await assertUnanimatedNavigation(page);
  }
  fs.writeFileSync(`${dir}/transition.json`, JSON.stringify(events, null, 2));
});

test('a failed traversal falls back and rapid duplicate activations do not navigate twice', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('.post-card-title a').first().click();
  await settled(page);
  await page.evaluate(() => {
    navigation.traverseTo = () => ({
      committed: Promise.reject(new DOMException('Disposed', 'InvalidStateError')),
      finished: Promise.reject(new DOMException('Disposed', 'InvalidStateError')),
    });
  });
  await page.locator('[data-article-back]').click();
  await expect(page).toHaveURL(/\/archives\/$/);
  await page.locator(`.timeline a[href="${article}"]`).click();
  await settled(page);
  await page.evaluate(() => {
    const link = document.querySelector<HTMLAnchorElement>('[data-article-back]')!;
    link.click();
    link.click();
  });
  await expect(page).toHaveURL(/\/archives\/$/);
  await settled(page);
});
