import { test, expect } from '@playwright/test';

test('Nginx delivers small avatars, math and comments-disabled pages without failed resources', async ({
  page,
  baseURL,
}) => {
  const failures: string[] = [];
  const errors: string[] = [];
  page.on('response', (response) => {
    if (response.url().startsWith(baseURL!) && response.status() >= 400)
      failures.push(`${response.status()} ${response.url()}`);
  });
  page.on('pageerror', (error) => errors.push(error.message));
  for (const width of [390, 820, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/post/4e395565/');
    await expect(page.locator('.katex')).toHaveCount(4);
    await page.evaluate(() => document.fonts.ready);
    const avatar = page.locator(
      width < 720
        ? '.mobile-brand img'
        : width < 1000
          ? '.rail-brand img'
          : '.desktop-sidebar .avatar',
    );
    expect(await avatar.getAttribute('src')).toMatch(/\/_astro\/.*\.webp$/);
    expect(
      await avatar.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth === 144),
    ).toBe(true);
    await expect(page.locator('.comments')).toHaveCount(0);
  }
  expect(failures).toEqual([]);
  expect(errors).toEqual([]);
});

test('Nginx PWA offline fallback is styled, updates owned caches and preserves unrelated caches', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({ serviceWorkers: 'allow' });
  const page = await context.newPage();
  // The standalone fallback has no registration script: create old caches
  // before v2 activates, then confirm the activation cleanup is scoped.
  await page.goto(new URL('/offline.html', baseURL).href);
  await page.evaluate(async () => {
    await caches.open('unrelated-test-cache');
    await caches.open('autuswing-astro-shell-v1');
  });
  await page.goto(baseURL!);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  const cache = await page.evaluate(async () => ({
    names: await caches.keys(),
    keys: await (
      await caches.open('autuswing-astro-shell-v2')
    )
      .keys()
      .then((keys) => keys.map((key) => new URL(key.url).pathname)),
  }));
  expect(cache.names).toContain('unrelated-test-cache');
  expect(cache.names).not.toContain('autuswing-astro-shell-v1');
  expect(cache.keys).toEqual(['/offline.html']);
  await context.setOffline(true);
  await page.goto(new URL('/nginx-offline-check/', baseURL).href);
  await expect(page.locator('h1')).toHaveText('暂时离线');
  expect(await page.locator('body').evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(
    'rgb(245, 244, 240)',
  );
  await context.setOffline(false);
  await page.goto(baseURL!);
  await expect(page.locator('.post-card')).toHaveCount(3);
  await context.close();
});
