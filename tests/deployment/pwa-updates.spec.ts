import { test, expect, chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { serviceWorker } from '../../src/lib/service-worker.mjs';

async function server() {
  const root = path.resolve(process.env.PWA_ARTIFACT_ROOT || 'dist');
  const initial = fs.readFileSync(path.join(root, 'offline.html'), 'utf8');
  const state = { html: initial, workerHtml: initial };
  const mime: Record<string, string> = {
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.webp': 'image/webp',
    '.png': 'image/png',
    '.json': 'application/json',
    '.webmanifest': 'application/manifest+json',
    '.woff2': 'font/woff2',
    '.xml': 'application/xml',
  };
  const instance = http.createServer((req, res) => {
    const pathname = new URL(req.url!, 'http://localhost').pathname;
    res.setHeader('Cache-Control', 'no-store');
    if (pathname === '/sw.js') {
      res.setHeader('Content-Type', 'application/javascript');
      res.end(serviceWorker(state.workerHtml));
      return;
    }
    if (pathname === '/offline.html') {
      res.setHeader('Content-Type', 'text/html');
      res.end(state.html);
      return;
    }
    const file = path.resolve(root, '.' + decodeURI(pathname));
    if (!file.startsWith(root + path.sep) && file !== root) {
      res.writeHead(400).end();
      return;
    }
    try {
      const target = fs.statSync(file).isDirectory() ? path.join(file, 'index.html') : file;
      res.setHeader('Content-Type', mime[path.extname(target)] || 'text/html');
      res.end(fs.readFileSync(target));
    } catch {
      res.writeHead(404).end('Missing');
    }
  });
  await new Promise<void>((resolve) => instance.listen(0, '127.0.0.1', resolve));
  const address = instance.address() as { port: number };
  return {
    state,
    initial,
    origin: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve) => {
        instance.close(() => resolve());
        instance.closeAllConnections();
      }),
  };
}

test('PWA updates online across tabs without reloading unsaved input; offline launch and reconnection work', async ({
  browser,
}) => {
  const fixture = await server();
  const context = await browser.newContext({ serviceWorkers: 'allow' });
  try {
    const first = await context.newPage(),
      second = await context.newPage();
    await first.goto(fixture.origin);
    await first.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await first.reload();
    await first.waitForFunction(() => !!navigator.serviceWorker.controller);
    await second.goto(fixture.origin);
    for (const page of [first, second])
      await page.evaluate(() => {
        const input = document.createElement('textarea');
        input.id = 'unsaved';
        input.value = 'keep my text';
        document.body.append(input);
        (window as any).__unchangedDocument = 'yes';
      });
    const before = await first.evaluate(() => caches.keys());
    fixture.state.html = fixture.state.workerHtml = fixture.initial.replace('暂时离线', '新版离线');
    await first.evaluate(async () => (await navigator.serviceWorker.getRegistration())!.update());
    await expect.poll(() => first.evaluate(() => caches.keys())).not.toEqual(before);
    for (const page of [first, second]) {
      await expect(page.locator('#unsaved')).toHaveValue('keep my text');
      expect(await page.evaluate(() => (window as any).__unchangedDocument)).toBe('yes');
    }
    await context.setOffline(true);
    const offline = await context.newPage();
    await offline.goto(fixture.origin + '/offline-start/');
    await expect(offline).toHaveTitle(/新版离线/);
    await context.setOffline(false);
    await offline.goto(fixture.origin);
    await expect(offline.locator('.post-card').first()).toBeVisible();
  } finally {
    await context.close();
    await fixture.close();
  }
});

test('PWA keeps the active version when worker and CDN offline bytes differ, then recovers', async ({
  browser,
}) => {
  const fixture = await server();
  const context = await browser.newContext({ serviceWorkers: 'allow' });
  try {
    const page = await context.newPage();
    await page.goto(fixture.origin);
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await page.reload();
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    const before = await page.evaluate(() => caches.keys());
    fixture.state.workerHtml = fixture.initial.replace('暂时离线', '更新离线');
    await page.evaluate(async () => {
      const registration = (await navigator.serviceWorker.getRegistration())!;
      await registration.update();
      const installing = registration.installing;
      if (installing && !['redundant', 'activated'].includes(installing.state))
        await new Promise<void>((resolve) =>
          installing.addEventListener('statechange', () => {
            if (['redundant', 'activated'].includes(installing.state)) resolve();
          }),
        );
    });
    expect(await page.evaluate(() => caches.keys())).toEqual(before);
    await context.setOffline(true);
    await page.goto(fixture.origin + '/old-version-offline/');
    await expect(page.locator('h1')).toHaveText('暂时离线');
    await context.setOffline(false);
    fixture.state.html = fixture.state.workerHtml;
    await page.goto(fixture.origin);
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())!.update());
    await expect.poll(() => page.evaluate(() => caches.keys())).not.toEqual(before);
    await context.setOffline(true);
    await page.goto(fixture.origin + '/new-version-offline/');
    await expect(page).toHaveTitle(/更新离线/);
  } finally {
    await context.close();
    await fixture.close();
  }
});

test('PWA manifest/icons are downloadable and rendered; favicon and Apple icon stay available', async ({
  browser,
}) => {
  const fixture = await server();
  const context = await browser.newContext({ serviceWorkers: 'allow' });
  try {
    const page = await context.newPage();
    await page.goto(fixture.origin);
    const result = await page.evaluate(async () => {
      const manifest = await (await fetch('/manifest.webmanifest')).json();
      const images = [];
      for (const icon of manifest.icons) {
        const img = new Image();
        img.src = icon.src;
        await img.decode();
        images.push({
          ...icon,
          actual: `${img.naturalWidth}x${img.naturalHeight}`,
          bytes: (await (await fetch(icon.src)).arrayBuffer()).byteLength,
        });
      }
      return { manifest, images };
    });
    expect(result.manifest.display).toBe('standalone');
    expect(result.images).toHaveLength(3);
    for (const icon of result.images) {
      expect(icon.actual).toBe(icon.sizes);
      expect(icon.bytes).toBeLessThan(64 * 1024);
    }
    expect(result.images.some((i: any) => i.purpose === 'maskable')).toBe(true);
    for (const selector of ['link[rel=icon]', 'link[rel=apple-touch-icon]']) {
      const href = await page.locator(selector).first().getAttribute('href');
      expect((await context.request.get(new URL(href!, fixture.origin).href)).ok()).toBe(true);
      expect(
        await page.evaluate(async (url) => {
          const img = new Image();
          img.src = url;
          await img.decode();
          return img.naturalWidth > 0;
        }, href!),
      ).toBe(true);
    }
    if (browser.browserType().name() === 'chromium') {
      // Ordinary Playwright contexts are incognito and cannot install apps.
      // Use a fresh isolated persistent profile for the actual browser criteria.
      fs.mkdirSync('.local-tools', { recursive: true });
      const profile = fs.mkdtempSync(path.resolve('.local-tools/pwa-installability-'));
      const persistent = await chromium.launchPersistentContext(profile, {
        channel: 'msedge',
        headless: true,
        serviceWorkers: 'allow',
      });
      try {
        const normalPage = await persistent.newPage();
        await normalPage.goto(fixture.origin);
        await normalPage.evaluate(() => navigator.serviceWorker.ready.then(() => true));
        await normalPage.waitForFunction(() => !!navigator.serviceWorker.controller);
        const cdp = await persistent.newCDPSession(normalPage);
        await cdp.send('Page.enable');
        const manifest = await cdp.send('Page.getAppManifest');
        expect(manifest.errors).toEqual([]);
        const installability = await cdp.send('Page.getInstallabilityErrors');
        expect(installability.installabilityErrors).toEqual([]);
        await cdp.detach();
      } finally {
        await persistent.close();
      }
    }
  } finally {
    await context.close();
    await fixture.close();
  }
});
