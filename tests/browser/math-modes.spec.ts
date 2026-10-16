import { test, expect } from '@playwright/test';
import { markdownProcessor } from '../../src/lib/markdown.mjs';

test('KaTeX is present in static HTML and only formula pages request math CSS/fonts', async ({
  page,
  request,
}) => {
  const response = await request.get('/post/4e395565/');
  const source = await response.text();
  expect((source.match(/class="katex"/g) || []).length).toBe(4);
  expect(source).toContain('encoding="application/x-tex"');
  const assets: string[] = [];
  page.on('request', (req) => {
    if (/\/assets\/vendor\//.test(req.url())) assets.push(req.url());
  });
  await page.goto('/post/4e395565/');
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('.katex')).toHaveCount(4);
  expect(assets.some((url) => url.endsWith('/katex.min.css'))).toBe(true);
  expect(assets.some((url) => /\.woff2?$/.test(url))).toBe(true);
  expect(assets.every((url) => !/\.js(?:\?|$)/.test(url))).toBe(true);
  expect(await page.evaluate(() => 'MathJax' in window || 'renderMathInElement' in window)).toBe(
    false,
  );
  for (const path of ['/', '/post/4c6caf67/', '/archives/', '/tags/MathJax/']) {
    assets.length = 0;
    await page.goto(path);
    await expect(page.locator('link[data-math-styles],.katex')).toHaveCount(0);
    expect(assets).toEqual([]);
  }
});

test('all historical formulas remain visible with JavaScript disabled', async ({ browser }) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 900 },
  });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4322/post/4e395565/');
  await expect(page.locator('.katex')).toHaveCount(4);
  await expect(page.locator('.katex math annotation')).toHaveCount(4);
  await expect(page.locator('link[data-math-styles]')).toHaveCount(1);
  for (const formula of await page.locator('.katex').all()) {
    await formula.scrollIntoViewIfNeeded();
    const box = await formula.boundingBox();
    expect(box!.height).toBeGreaterThan(10);
    expect(box!.width).toBeGreaterThan(10);
  }
  await context.close();
});

test('wide KaTeX displays scroll inside the article at every layout width', async ({ page }) => {
  const renderer = await markdownProcessor().createRenderer({ syntaxHighlight: false });
  const result = await renderer.render(
    '$$' + Array.from({ length: 70 }, () => 'x^2').join('+') + '$$',
  );
  for (const width of [320, 390, 820, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/post/4e395565/');
    await page
      .locator('.prose')
      .evaluate((node, html) => node.insertAdjacentHTML('beforeend', html), result.code);
    const sizes = await page
      .locator('.katex-display')
      .last()
      .evaluate((node) => ({
        own: node.scrollWidth,
        client: node.clientWidth,
        root: document.documentElement.scrollWidth,
        document: document.documentElement.clientWidth,
      }));
    expect(sizes.own).toBeGreaterThan(sizes.client);
    expect(sizes.root).toBeLessThanOrEqual(sizes.document + 1);
  }
});
