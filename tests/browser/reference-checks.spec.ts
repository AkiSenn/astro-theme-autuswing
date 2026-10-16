import { test, expect } from '@playwright/test';
test('search excludes navigation/footer and keeps original tag case', async ({ request }) => {
  const data = await (await request.get('/search.json')).json();
  expect(data).toHaveLength(3);
  expect(data.some((p: any) => p.tags.includes('MathJax'))).toBe(true);
  for (const post of data) {
    expect(post.content).not.toContain('Powered by');
    expect(post.content).not.toContain('粤ICP备2026144331号-1');
  }
});
test('archives use the publish year even when posts were updated later', async ({ page }) => {
  await page.goto('/archives/2020/');
  await expect(page.locator('.timeline h2')).toHaveText('2020');
  await expect(page.locator('.timeline a')).toHaveAttribute('href', '/post/4e395565/');
});
test('wide tables scroll inside their wrapper on narrow screens', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/post/4c6caf67/');
  await page.locator('.prose').evaluate((node) => {
    const wrap = document.createElement('div');
    wrap.className = 'table-wrap';
    const table = document.createElement('table');
    table.innerHTML =
      '<tbody><tr>' +
      Array.from({ length: 12 }, () => '<td>LongUnbrokenTableColumn</td>').join('') +
      '</tr></tbody>';
    wrap.append(table);
    node.append(wrap);
  });
  const dimensions = await page.locator('.table-wrap').evaluate((el) => ({
    scroll: el.scrollWidth,
    client: el.clientWidth,
    root: document.documentElement.scrollWidth,
    width: document.documentElement.clientWidth,
  }));
  expect(dimensions.scroll).toBeGreaterThan(dimensions.client);
  expect(dimensions.root).toBeLessThanOrEqual(dimensions.width + 1);
});
