import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { redirects } from '../../scripts/static-artifacts.mjs';
const ids = ['55b0541c', '4c6caf67', '4e395565'];
const evidenceDir = process.env.VISUAL_EVIDENCE_DIR || 'docs/evidence/phase3';
test('copy buttons preserve raw code without line numbers or UI text', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          (window as any).__copied = value;
        },
      },
    });
  });
  await page.goto('/post/55b0541c/');
  const code = await page.locator('.prose pre code').first().textContent();
  await page.locator('.copy-code').first().click();
  expect(await page.evaluate(() => (window as any).__copied)).toBe(code);
});
test('pages, metadata, search and appearance work without console failures', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('.post-card')).toHaveCount(3);
  await expect(page.locator('.profile .avatar')).toBeVisible();
  await page.locator('.search-open:visible').click();
  await page.locator('#search-input').fill('欧拉');
  await expect(page.locator('.search-results a')).toHaveCount(1);
  await expect(page.locator('.search-results a')).toHaveAttribute('href', '/post/4e395565/');
  await page.keyboard.press('Escape');
  await expect(page.locator('.search-dialog')).not.toBeVisible();
  await page.locator('.mode-toggle:visible').click();
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'light');
  for (const path of [
    '/archives/',
    '/archives/2022/01/',
    '/tags/',
    '/tags/MathJax/',
    '/categories/网站建设/',
    '/about/',
    '/links/',
  ]) {
    await page.goto(path);
    await expect(page.locator('main h1')).toBeVisible();
  }
  expect(errors).toEqual([]);
});
test('formulas are prerendered and ordinary posts do not load math resources', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (req) => {
    if (/^https?:/.test(req.url()) && !req.url().startsWith('http://127.0.0.1:4322'))
      external.push(req.url());
  });
  await page.goto('/post/4e395565/');
  await expect(page.locator('.katex')).toHaveCount(4);
  expect(external).toEqual([]);
  await page.goto('/post/4c6caf67/');
  await expect(page.locator('link[data-math-styles],script[src*=tex-mml]')).toHaveCount(0);
  await expect(page.locator('.prose h1')).toHaveCount(0);
});
test('code, TOC and lightbox keyboard interaction', async ({ page }) => {
  await page.goto('/post/55b0541c/');
  await expect(page.locator('.copy-code').first()).toBeVisible();
  await expect(page.locator('.toc-link').first()).toBeVisible();
  const image = page.locator('.prose img').first();
  await image.scrollIntoViewIfNeeded();
  await image.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.image-dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.image-dialog')).not.toBeVisible();
  await expect(image).toBeFocused();
});
test('redirects keep query strings and unknown routes return 404', async ({ request }) => {
  for (const rule of redirects()) {
    const response = await request.get(rule.from + '?from=test', { maxRedirects: 0 });
    expect(response.status()).toBe(301);
    expect(response.headers().location).toBe(rule.to + '?from=test');
  }
  for (const id of ids) {
    for (const alias of [`/post/${id}.html`, `/p/${id}/`, `/p/${id}/index.html`]) {
      const response = await request.get(alias + '?from=test', { maxRedirects: 0 });
      expect(response.status()).toBe(301);
      expect(response.headers().location).toBe(`/post/${id}/?from=test`);
    }
  }
  expect((await request.get('/this-page-does-not-exist/')).status()).toBe(404);
});
test('three-layout shell at the nine widths has no root overflow', async ({ page }) => {
  for (const width of [320, 375, 390, 430, 768, 820, 1024, 1280, 1600]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/post/55b0541c/');
    await page.waitForTimeout(500);
    const size = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }));
    expect(size.scroll, `width=${width}`).toBeLessThanOrEqual(size.client + 1);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('.mobile-navigation a')).toHaveCount(5);
  await expect(page.locator('.mobile-navigation a[href="/archives/"]')).toBeVisible();
  await expect(page.locator('.menu-toggle,.sidebar-tabs,.sidebar-overlay')).toHaveCount(0);
});
test('basic accessibility and screenshots for stage-three comparison', async ({ page }) => {
  // Full-page captures must include offscreen content before scroll-reveal runs.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await page.waitForTimeout(500);
  const result = await new AxeBuilder({ page }).analyze();
  expect(
    result.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious'),
  ).toEqual([]);
  await page.screenshot({
    path: `${evidenceDir}/home-1280.png`,
    fullPage: true,
    animations: 'disabled',
  });
  await page.goto('/post/4e395565/');
  await expect(page.locator('.katex')).toHaveCount(4);
  await page.screenshot({
    path: `${evidenceDir}/math-1280.png`,
    fullPage: true,
    animations: 'disabled',
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.screenshot({
    path: `${evidenceDir}/home-390.png`,
    fullPage: true,
    animations: 'disabled',
  });
});
