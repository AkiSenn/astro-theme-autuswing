import http from 'node:http';
import { test, expect } from '@playwright/test';
import { inspectTransitionMode } from '../support/transition-contract';

test('independent MPA probe verifies the declared native or fallback capability', async ({
  browser,
  browserName,
}) => {
  const requests: string[] = [],
    reveals: any[] = [];
  const server = http.createServer((req, res) => {
    requests.push(req.url!);
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Cache-Control', 'no-store');
    res.end(`<style>@view-transition{navigation:auto}html{view-transition-name:none}main{view-transition-name:probe}</style>
      <main><h1>${req.url}</h1><a href="${req.url === '/a' ? '/b' : '/a'}">Next</a></main>`);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const context = await browser.newContext({
    reducedMotion: 'no-preference',
    serviceWorkers: 'block',
  });
  await context.exposeBinding('recordCapabilityReveal', (_, event) => {
    reveals.push(event);
  });
  await context.addInitScript(() => {
    (window as any).__probeDocument = Math.random().toString(36);
    addEventListener('pagereveal', (event: any) => {
      (window as any).recordCapabilityReveal({
        path: location.pathname,
        transition: !!event.viewTransition,
      });
    });
  });
  try {
    const page = await context.newPage();
    await page.goto(origin + '/a');
    const mode = await inspectTransitionMode(page, browserName);
    const documentA = await page.evaluate(() => (window as any).__probeDocument);
    await page.locator('a').click();
    await expect(page.locator('h1')).toHaveText('/b');
    expect(await page.evaluate(() => (window as any).__probeDocument)).not.toBe(documentA);
    await page.locator('a').click();
    await expect(page.locator('h1')).toHaveText('/a');
    if (mode === 'native')
      await expect.poll(() => reveals.filter((e) => e.transition).length).toBe(2);
    else {
      expect(reveals.filter((e) => e.transition)).toHaveLength(0);
      expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
    }
    expect(requests).toContain('/a');
    expect(requests).toContain('/b');
    await test
      .info()
      .attach('independent-capability', {
        body: JSON.stringify({ mode, version: browser.version(), requests, reveals }, null, 2),
        contentType: 'application/json',
      });
  } finally {
    await context.close();
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections();
    });
  }
});
