import { test, expect } from '@playwright/test';
test('legacy appearance, system changes and cross-tab preference sync', async ({
  context,
  page,
}) => {
  await context.addInitScript(() => {
    if (!localStorage.getItem('autuswing-appearance'))
      localStorage.setItem('sunna-appearance', 'dark');
  });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
  expect(await page.evaluate(() => localStorage.getItem('autuswing-appearance'))).toBe('dark');
  const second = await context.newPage();
  await second.goto('/');
  await page.locator('.mode-toggle:visible').click();
  await expect(second.locator('html')).toHaveAttribute('data-mode', 'auto');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});
test('search can retry a failed index and renders injected markup as text', async ({ page }) => {
  let first = true;
  await page.route('**/search.json', (route) => {
    if (first) {
      first = false;
      return route.fulfill({ status: 503, body: 'Unavailable' });
    }
    return route.fulfill({
      json: [
        {
          title: '<img src=x onerror=alert(1)> test',
          url: '/post/4c6caf67/',
          tags: [],
          categories: [],
          content: 'test',
          excerpt: '<script>danger</script>',
        },
      ],
    });
  });
  await page.goto('/');
  await page.locator('.search-open:visible').click();
  await page.locator('#search-input').fill('test');
  await expect(page.locator('.search-status')).toContainText('失败');
  await page.locator('#search-input').fill('tes');
  await expect(page.locator('.search-results a')).toHaveCount(1);
  await expect(page.locator('.search-results img,.search-results script')).toHaveCount(0);
  await expect(page.locator('.search-results h3')).toContainText('<img');
});
test('site content and navigation stay accessible without JS', async ({ browser }) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4322/');
  await expect(page.locator('.post-card')).toHaveCount(3);
  await expect(page.locator('.mobile-navigation a[href="/archives/"]')).toBeVisible();
  await context.close();
});
test('PWA installs its own shell cache and returns the offline page', async ({ browser }) => {
  const context = await browser.newContext({ serviceWorkers: 'allow' });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4322/');
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.goto('http://127.0.0.1:4322/offline-check/');
  await expect(page.locator('h1')).toHaveText('暂时离线');
  await context.setOffline(false);
  await context.close();
});
