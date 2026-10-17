import { test, expect, type Page } from '@playwright/test';
import { pwaServer } from '../support/pwa-server';

async function controlled(page: Page, origin: string) {
  await page.goto(origin);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  expect(
    await page.evaluate(
      async () => (await navigator.serviceWorker.getRegistration())!.active!.state,
    ),
  ).toBe('activated');
}
async function cacheState(page: Page) {
  return page.evaluate(async () => {
    const keys = await caches.keys();
    const shells = await Promise.all(
      keys
        .filter((k) => k.startsWith('autuswing-astro-shell-'))
        .map(async (key) => ({
          key,
          html: await (await (await caches.open(key)).match('/offline.html'))?.text(),
        })),
    );
    const r = await navigator.serviceWorker.getRegistration();
    return {
      shells,
      active: r?.active?.state,
      waiting: r?.waiting?.state,
      installing: r?.installing?.state,
    };
  });
}

test('offline emulation is characterized separately from actual Worker connection failure', async ({
  browser,
  browserName,
}) => {
  const fixture = await pwaServer();
  const context = await browser.newContext({ serviceWorkers: 'allow' });
  try {
    const page = await context.newPage();
    await controlled(page, fixture.origin);
    const initial = await cacheState(page);
    expect(initial.shells).toHaveLength(1);
    expect(initial.shells[0].html).toBe(fixture.initial);
    await context.setOffline(true);
    const directFetch = await page.evaluate(() =>
      fetch('/emulated-direct-fetch/')
        .then((r) => r.status)
        .catch(() => 'network-error'),
    );
    expect(directFetch).toBe('network-error');
    const simulated = await page.goto(fixture.origin + '/emulated-navigation/');
    const reachedServer = fixture.requests.some((r) => r.path === '/emulated-navigation/');
    // Checked, versioned backend behavior: a changed outcome needs review.
    expect(reachedServer).toBe(browserName === 'firefox');
    expect(simulated!.status()).toBe(reachedServer ? 404 : 200);
    await expect(page.locator('h1')).toHaveText(
      reachedServer ? 'Network is reachable' : '暂时离线',
    );
    await context.setOffline(false);
    fixture.state.disconnected = true;
    const actual = await page.goto(fixture.origin + '/connection-failure/');
    expect(actual!.status()).toBe(200);
    await expect(page.locator('h1')).toHaveText('暂时离线');
    expect(fixture.requests.some((r) => r.path === '/connection-failure/' && r.disconnected)).toBe(
      true,
    );
    expect((await cacheState(page)).shells).toEqual(initial.shells);
    fixture.state.disconnected = false;
    await page.goto(fixture.origin);
    await expect(page.locator('.post-card')).toHaveCount(3);
    await test.info().attach('offline-timing-and-cache', {
      body: JSON.stringify(
        { initial, reachedServer, directFetch, requests: fixture.requests },
        null,
        2,
      ),
      contentType: 'application/json',
    });
  } finally {
    await context.close();
    await fixture.close();
  }
});

test('cold start requires installation; cached navigation survives failure and an empty cache returns explicit 503', async ({
  browser,
}) => {
  const fixture = await pwaServer();
  const context = await browser.newContext({ serviceWorkers: 'allow' });
  try {
    let page = await context.newPage();
    fixture.state.disconnected = true;
    await expect(page.goto(fixture.origin + '/uninstalled/')).rejects.toThrow();
    // Chromium commits its internal error document after rejecting goto.
    // Close that failed navigation before testing the installed lifecycle.
    await page.close();
    page = await context.newPage();
    fixture.state.disconnected = false;
    await controlled(page, fixture.origin);
    const active = await cacheState(page);
    expect(active.shells).toHaveLength(1);
    expect(active.shells[0].html).toBe(fixture.initial);
    fixture.state.disconnected = true;
    const installed = await context.newPage();
    await installed.goto(fixture.origin + '/installed/');
    await expect(installed.locator('h1')).toHaveText('暂时离线');
    await installed.evaluate(async () => {
      for (const key of await caches.keys())
        if (key.startsWith('autuswing-astro-shell-')) await caches.delete(key);
    });
    const missing = await installed.goto(fixture.origin + '/missing-cache/');
    expect(missing!.status()).toBe(503);
    await expect(installed.locator('body')).toHaveText('暂时离线');
    fixture.state.disconnected = false;
    await installed.goto(fixture.origin);
    await expect(installed.locator('.post-card')).toHaveCount(3);
    await test.info().attach('cold-start-cache-miss', {
      body: JSON.stringify({ active, requests: fixture.requests }, null, 2),
      contentType: 'application/json',
    });
  } finally {
    await context.close();
    await fixture.close();
  }
});
