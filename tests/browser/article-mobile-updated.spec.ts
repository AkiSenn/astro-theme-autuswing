import { test, expect, type Page } from '@playwright/test';

const article = '/post/55b0541c/';

async function ready(page: Page) {
  await page.evaluate(() => document.fonts.ready);
}

async function geometry(page: Page) {
  return page.evaluate(() => {
    const header = document.querySelector('.article-header')!;
    const article = document.querySelector('.article')!;
    const rect = (e: Element) => {
      const r = e.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    };
    return {
      article: rect(article),
      title: rect(header.querySelector('h1')!),
      date: rect(header.querySelector('.post-meta > time')!),
      firstParagraph: rect(document.querySelector('.article .prose > :first-child')!),
      visibleMetadata: [...header.querySelector('.post-meta')!.children]
        .filter((e) => e.getBoundingClientRect().height > 0)
        .map((e) => e.textContent!.trim().replace(/\s+/g, ' ')),
    };
  });
}

for (const width of [320, 375, 390, 430, 768, 900, 1024, 1440]) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test.describe(`${width}px ${colorScheme}`, () => {
      test.use({ viewport: { width, height: 844 }, colorScheme, reducedMotion: 'reduce' });
      test('真实文章更新可见且保留紧凑首屏与桌面布局', async ({ page }, info) => {
        expect(process.env.ARTICLE_BASELINE_URL).toBeTruthy();
        await page.goto(process.env.ARTICLE_BASELINE_URL! + article);
        await ready(page);
        const before = await geometry(page);
        if (info.project.name === 'edge' && width === 375)
          await page.screenshot({ path: info.outputPath(`before-${width}-${colorScheme}.png`) });
        await page.goto(article);
        await ready(page);
        const after = await geometry(page);
        const mobile = page.locator('.article-meta-mobile-updated');
        const desktop = page.locator('.article-header .article-meta-secondary time');
        await expect(mobile).toHaveCount(1);
        if (width < 720) {
          await expect(mobile).toBeVisible();
          await expect(mobile).toBeInViewport();
          await expect(mobile).toHaveText('更新于 2026.10.05');
          await expect(mobile.locator('time')).toHaveAttribute(
            'datetime',
            '2026-10-04T16:00:00.000Z',
          );
          await expect(desktop).toBeHidden();
          await expect(page.locator('.article-header .post-meta > :visible')).toHaveCount(3);
          await expect(page.locator('.article-header .card-tags')).toBeHidden();
          expect(after.visibleMetadata).toEqual([...before.visibleMetadata, '更新于 2026.10.05']);
          expect(after.firstParagraph.y - before.firstParagraph.y).toBeGreaterThanOrEqual(0);
          expect(after.firstParagraph.y - before.firstParagraph.y).toBeLessThanOrEqual(26);
          const hit = await mobile.locator('time').evaluate((element) => {
            const r = element.getBoundingClientRect();
            const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
            return top === element || element.contains(top);
          });
          expect(hit, '更新时间实际绘制且没有被覆盖').toBe(true);
          const details = page.locator('.article-mobile-details');
          await expect(details).toBeVisible();
          await expect(details.locator('.post-meta')).toContainText('4478');
          expect(await details.locator('.card-tags a').count()).toBeGreaterThan(0);
        } else {
          await expect(mobile).toBeHidden();
          await expect(desktop).toBeVisible();
          expect(after).toEqual(before);
        }
        expect(after.title).toEqual(before.title);
        expect(after.date).toEqual(before.date);
        expect(after.article.x).toBe(before.article.x);
        expect(after.article.width).toBe(before.article.width);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        await info.attach('geometry', {
          body: JSON.stringify({ width, colorScheme, before, after }, null, 2),
          contentType: 'application/json',
        });
        if (info.project.name === 'edge' && width === 375)
          await page.screenshot({ path: info.outputPath(`after-${width}-${colorScheme}.png`) });
      });
    });
  }
}

test('未显式更新的文章不新增首部提示，首页卡片更新仍可见', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  for (const path of ['/post/4c6caf67/', '/post/4e395565/']) {
    await page.goto(path);
    await expect(page.locator('.article-meta-mobile-updated')).toHaveCount(0);
    await expect(page.locator('.article-header .post-meta > :visible')).toHaveCount(2);
    await expect(page.locator('.copyright-details time').last()).toBeVisible();
  }
  await page.goto('/');
  await expect(page.locator('.post-card .post-meta time')).toHaveText('更新于 2026-10-05');
  await expect(page.locator('.post-card .post-meta time')).toBeVisible();
});
