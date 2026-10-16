import { test, expect } from '@playwright/test';
test('KaTeX uses only local scripts, styles and fonts', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (req) => {
    if (/^https?:/.test(req.url()) && !req.url().startsWith('http://127.0.0.1:4322'))
      external.push(req.url());
  });
  await page.route('**/post/4e395565/', async (route) => {
    const response = await route.fetch();
    let body = await response.text();
    body = body.replace(
      /(<script[^>]*id="autuswing-config"[^>]*>)([\s\S]*?)(<\/script>)/,
      (_, start, value, end) => {
        const config = JSON.parse(value);
        config.math.engine = 'katex';
        return start + JSON.stringify(config) + end;
      },
    );
    await route.fulfill({ response, body });
  });
  await page.goto('/post/4e395565/');
  await expect(page.locator('.katex')).toHaveCount(4);
  await expect(page.locator('mjx-container')).toHaveCount(0);
  expect(external).toEqual([]);
});
test('independent full-content card scopes can render both engines', async ({ page }) => {
  await page.route('**/post/4e395565/', async (route) => {
    const response = await route.fetch();
    let body = await response.text();
    const match = body.match(/<script[^>]*id="autuswing-config"[^>]*>([\s\S]*?)<\/script>/)!;
    const config = JSON.parse(match[1]),
      math = config.math;
    config.math = null;
    body = body.replace(match[1], JSON.stringify(config));
    const attr = (value: unknown) =>
      JSON.stringify(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;');
    const scopes = `<section id="test-scopes"><div class="prose" data-math-config="${attr(math)}">$x_1$</div><div class="prose" data-math-config="${attr(math)}">\\(y_2\\)</div><div class="prose" data-math-config="${attr({ ...math, engine: 'katex' })}">$z_3$</div></section>`;
    body = body.replace('</main>', scopes + '</main>');
    await route.fulfill({ response, body });
  });
  await page.goto('/post/4e395565/');
  await expect(page.locator('#test-scopes mjx-container')).toHaveCount(2);
  await expect(page.locator('#test-scopes .katex')).toHaveCount(1);
});
