import { test, expect } from '@playwright/test';
import { searchText } from '../../src/lib/search-index.mjs';

const fixture = {
  title: '搜索 QA TitleOnlyQA <svg onload="window.searchXSS=1">',
  url: '/post/55b0541c/',
  tags: ['TagOnlyQA'],
  categories: [],
  excerpt: '仅在标题命中时显示的开头简介。',
  content: searchText(
    '<p>inlineOnlyQA</p><pre><code>npm run CodeNeedleQA -- --config=ConfigOnlyQA</code></pre><p>' +
      '中文长篇正文。'.repeat(4000) +
      '终章 EndNeedleQA</p><pre>&lt;img src=x onerror="window.searchXSS=1"&gt; XSSNeedleQA [a+b].* Ａｓｔｒｏ</pre>',
  ),
};

test.beforeEach(async ({ page }) => {
  await page.route('**/search.json', async (route) => {
    const response = await route.fetch();
    const items = await response.json();
    await route.fulfill({ response, json: [...items, fixture] });
  });
});

test('索引按需下载并复用，长文尾部和代码命中展示实际上下文', async ({ page }) => {
  let downloads = 0;
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/search.json') downloads++;
  });
  await page.goto('/');
  expect(downloads).toBe(0);
  await page.locator('.search-open:visible').click();
  expect(downloads).toBe(0);
  const input = page.locator('#search-input');
  for (const query of [
    'EndNeedleQA',
    'CodeNeedleQA',
    '--config=ConfigOnlyQA',
    '终章 EndNeedleQA',
  ]) {
    await input.fill(query);
    await expect(page.locator('.search-results a')).toHaveCount(1);
    await expect(page.locator('.search-results p mark').first()).toBeVisible();
    await expect(page.locator('.search-results p')).not.toContainText('开头简介');
    await expect(page.locator('.search-results p')).toContainText(
      query.includes('终章') ? 'EndNeedleQA' : query,
    );
  }
  expect(downloads).toBe(1);
});

test('字面特殊字符和 NFKC 高亮安全，无结果时清除旧列表', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.locator('.search-open:visible').click();
  for (const query of ['XSSNeedleQA', '[a+b].*', 'astro XSSNeedleQA']) {
    await page.locator('#search-input').fill(query);
    await expect(page.locator('.search-results a')).toHaveCount(1);
    await expect(page.locator('.search-results p mark').first()).toBeVisible();
    await expect(
      page
        .locator('.search-results p mark')
        .filter({ hasText: query === 'astro XSSNeedleQA' ? 'Ａｓｔｒｏ' : query }),
    ).toHaveCount(1);
    await expect(page.locator('.search-results img,.search-results svg')).toHaveCount(0);
    expect(await page.evaluate(() => (window as any).searchXSS)).toBeUndefined();
  }
  await page.locator('#search-input').fill('NoSuchSearchTermQA');
  await expect(page.locator('.search-results a')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('快速输入、键盘关闭恢复焦点及结果原生导航正常', async ({ page }) => {
  await page.goto('/');
  const trigger = page.locator('.search-open:visible');
  await trigger.click();
  const input = page.locator('#search-input');
  await input.fill('EndNeedleQA');
  await input.fill('NoSuchSearchTermQA');
  await input.fill('TitleOnlyQA');
  await expect(page.locator('.search-results a')).toHaveCount(1);
  await expect(page.locator('.search-results p')).toContainText('开头简介');
  await input.press('Escape');
  await expect(page.locator('.search-dialog')).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await input.fill('CodeNeedleQA');
  await expect(page.locator('.search-results a')).toHaveCount(1);
  await input.press('ArrowDown');
  await expect(page.locator('.search-results a.selected')).toHaveCount(1);
  await input.press('Enter');
  await expect(page).toHaveURL(/\/post\/55b0541c\/$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('main')).toBeVisible();
});

test('320/390px 浅深色界面没有新增横向溢出，关闭后焦点恢复', async ({ page }) => {
  for (const width of [320, 390])
    for (const theme of ['light', 'dark']) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/');
      await page.evaluate((theme) => {
        document.documentElement.dataset.theme = theme;
      }, theme);
      await page.locator('.search-open:visible').click();
      await page.locator('#search-input').fill('--config=ConfigOnlyQA');
      await expect(page.locator('.search-results a')).toHaveCount(1);
      const geometry = await page.locator('.search-dialog').evaluate((el) => {
        const box = el.getBoundingClientRect();
        return {
          left: box.left,
          right: box.right,
          width: innerWidth,
          scroll: el.scrollWidth,
          client: el.clientWidth,
        };
      });
      expect(geometry.left).toBeGreaterThanOrEqual(0);
      expect(geometry.right).toBeLessThanOrEqual(geometry.width);
      expect(geometry.scroll).toBeLessThanOrEqual(geometry.client + 1);
      await page.keyboard.press('Escape');
      await expect(page.locator('.search-open:visible')).toBeFocused();
    }
});

test('无原生 Dialog 和 Navigation API 的能力模型仍可查询和关闭', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'navigation', { value: undefined, configurable: true });
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      value: undefined,
      configurable: true,
    });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', {
      value: undefined,
      configurable: true,
    });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.locator('.search-open:visible').click();
  await page.locator('#search-input').fill('EndNeedleQA');
  await expect(page.locator('.search-results a')).toHaveCount(1);
  await expect(page.locator('.legacy-dialog-host')).toBeVisible();
  await page.locator('.search-close').click();
  await expect(page.locator('.search-dialog')).not.toBeVisible();
  await expect(page.locator('.search-open:visible')).toBeFocused();
});
