import { test, expect, type Page } from '@playwright/test';

const article = '/post/55b0541c/';

async function expectArticleNavigation(page: Page) {
  await expect(page.locator('.article-header h1')).toBeVisible();
  await expect(page.locator('[data-article-back],.back-link')).toHaveCount(0);
  expect(await page.locator('.article-header').evaluate((node) => ({
    first: node.firstElementChild?.tagName,
    emptyChildren: [...node.children].filter((child) => !child.textContent?.trim()).length,
    paddingTop: getComputedStyle(node).paddingTop,
  }))).toEqual({ first: 'H1', emptyChildren: 0, paddingTop: '0px' });
  await expect(page.locator('.mobile-navigation a[href="/"]')).toBeVisible();
  await expect(page.locator('.mobile-navigation a[href="/archives/"]')).toBeVisible();
}

async function browserHistory(page: Page, direction: 'back' | 'forward', path: string, restoredSearch = false) {
  const expected = new URL(path, page.url()).href;
  await page.evaluate((direction) => history[direction](), direction);
  // 缓存恢复没有新 load；只观察真实地址、文档状态和最终可见内容。
  await expect(page).toHaveURL(expected);
  await page.waitForFunction(() => document.readyState === 'complete' &&
    !document.activeViewTransition && !document.documentElement.hasAttribute('data-page-entry') &&
    !document.documentElement.hasAttribute('data-reading-native') &&
    !document.documentElement.hasAttribute('data-reading-stage'));
  await expect(page.locator('#main')).toHaveCSS('opacity', '1');
  await expect(page.locator('#main')).toHaveCSS('transform', 'none');
  if (restoredSearch) {
    await expect(page.locator('.search-dialog[open]')).toHaveCount(1);
    await expect(page.locator('dialog[open]:not(.search-dialog),.legacy-dialog-host')).toHaveCount(0);
  } else {
    await expect(page.locator('dialog[open],.legacy-dialog-host')).toHaveCount(0);
  }
}

for (const source of ['/', '/archives/'])
  test(`article entered from ${source} has no top navigation and retains existing mobile links`, async ({ page }) => {
    await page.goto(source);
    await page.locator(`#main a[href="${article}"]`).first().click();
    await expectArticleNavigation(page);
    await page.locator('.mobile-navigation a[href="/archives/"]').click();
    await expect(page).toHaveURL(/\/archives\/$/);
    await expect(page.locator('.timeline')).toBeVisible();
  });

test('external direct entry can reach home and archives through existing mobile navigation', async ({ page }) => {
  const external = process.env.ARTICLE_EXTERNAL_ORIGIN!;
  expect(external).toBeTruthy();
  await page.goto(external);
  await page.getByRole('link', { name: 'Read article' }).click();
  await expectArticleNavigation(page);
  expect(await page.evaluate(() => document.referrer)).toBe(external + '/');
  await page.locator('.mobile-navigation a[href="/"]').click();
  await expect(page.locator('.post-card')).toHaveCount(3);
  await page.goto(article);
  await expectArticleNavigation(page);
  await page.locator('.mobile-navigation a[href="/archives/"]').focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/archives\/$/);
});

test('direct and refreshed articles do not recreate a top button', async ({ page }) => {
  await page.goto(article);
  await expectArticleNavigation(page);
  await page.reload();
  await expectArticleNavigation(page);
});

test('missing Navigation API retains mobile navigation and native history (not an iOS device test)', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'navigation', {
    value: undefined, configurable: true,
  }));
  await page.goto('/');
  await page.locator(`#main a[href="${article}"]`).first().click();
  await expectArticleNavigation(page);
  expect(await page.evaluate(() => typeof window.navigation)).toBe('undefined');
  await browserHistory(page, 'back', '/');
  await browserHistory(page, 'forward', article);
  await expectArticleNavigation(page);
  await page.locator('.mobile-navigation a[href="/archives/"]').click();
  await expect(page).toHaveURL(/\/archives\/$/);
});

test('disabled JavaScript retains usable home and archive links', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  try {
    const page = await context.newPage();
    await page.goto(article);
    await expectArticleNavigation(page);
    await page.locator('.mobile-navigation a[href="/"]').click();
    await expect(page.locator('.post-card')).toHaveCount(3);
    await page.goto(article);
    await page.locator('.mobile-navigation a[href="/archives/"]').click();
    await expect(page.locator('.timeline')).toBeVisible();
  } finally { await context.close(); }
});

test('browser back and forward preserve the original target and scroll without overlays', async ({ page }, info) => {
  const events: unknown[] = [];
  await page.exposeFunction('recordArticleHistory', (event: unknown) => events.push(event));
  await page.addInitScript(() => {
    const send = (kind: string, extra: object = {}) => (window as any).recordArticleHistory({
      kind, path: location.pathname, ...extra,
    });
    addEventListener('pageshow', (event) => send('pageshow', { persisted: event.persisted }));
    addEventListener('pagereveal', (event: any) => {
      send('pagereveal', { native: !!event.viewTransition });
      event.viewTransition?.ready.then(() => send('native-ready', {
        animations: document.getAnimations().map((a: any) => ({ name: a.animationName, duration: a.effect?.getTiming().duration })),
      }), (error: unknown) => send('native-skipped', { error: String(error) }));
    });
    document.addEventListener('animationstart', (event) => {
      if (event.animationName === 'autuswing-content-enter') send('css-entry');
    });
  });
  await page.goto('/');
  await page.evaluate(() => scrollTo(0, 150));
  const before = await page.evaluate(() => scrollY);
  await page.locator(`#main a[href="${article}"]`).first().evaluate((node: HTMLAnchorElement) => node.click());
  await expectArticleNavigation(page);
  await browserHistory(page, 'back', '/');
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(before);
  await browserHistory(page, 'forward', article);
  await expectArticleNavigation(page);
  await info.attach('native-history-and-entry', { body: JSON.stringify({ events, before }), contentType: 'application/json' });
});

test('browser history retains existing search restoration independently of the article list link', async ({
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
  await expect(page.locator('.article-header h1')).toBeVisible();
  await page.reload();
  await browserHistory(page, 'back', '/archives/', true);
  await expect(page.locator('.search-dialog')).toBeVisible();
  await expect(page.locator('#search-input')).toHaveValue('GitHub');
  await expect(page.locator('.search-results a.selected')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.locator('.search-dialog')).not.toBeVisible();
  expect(
    await page.evaluate(() => navigation.currentEntry?.getState()?.autuswingSearch),
  ).toBeUndefined();
  await browserHistory(page, 'forward', article);
  await browserHistory(page, 'back', '/archives/');
  await expect(page.locator('.search-dialog')).not.toBeVisible();
});
