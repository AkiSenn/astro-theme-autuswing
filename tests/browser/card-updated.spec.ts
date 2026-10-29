import { test, expect, type Page } from '@playwright/test';

async function ready(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

async function cards(page: Page) {
  return page.locator('.post-card').evaluateAll((elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect();
      const date = element.querySelector('.card-date')!;
      const dateRect = date.getBoundingClientRect();
      const meta = element.querySelector('.post-meta')!;
      const style = getComputedStyle(meta);
      return {
        title: element.querySelector('h2')!.textContent!.trim(),
        path: element.querySelector('h2 a')!.getAttribute('href'),
        date: date.querySelector('time')!.getAttribute('datetime'),
        dateText: date.textContent!.trim(),
        excerpt: element.querySelector('.card-body > p')!.textContent,
        tags: element.querySelector('.card-tags')!.textContent,
        x: rect.x,
        width: rect.width,
        height: rect.height,
        dateX: dateRect.x - rect.x,
        dateY: dateRect.y - rect.y,
        font: style.fontSize,
        color: style.color,
        links: [...element.querySelectorAll('a')].map((a) => a.getAttribute('href')),
      };
    }),
  );
}

for (const width of [375, 390, 430, 900, 1024, 1440]) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test.describe(`${width}px ${colorScheme}`, () => {
      test.use({ viewport: { width, height: 932 }, colorScheme, reducedMotion: 'reduce' });
      test('仅显式更新显示，原日期、链接、颜色和卡片几何保持约定', async ({
        page,
        context,
      }, info) => {
        expect(process.env.CARD_BASELINE_URL, '需要提供同版本旧构建以作几何对照').toBeTruthy();
        const baseline = await context.newPage();
        await baseline.goto(process.env.CARD_BASELINE_URL!);
        await ready(baseline);
        const before = await cards(baseline);
        await page.goto('/');
        await ready(page);
        const after = await cards(page);
        expect(after).toHaveLength(3);
        expect(await page.locator('.post-card .post-meta time').count()).toBe(1);
        const updated = page.locator('.post-card .post-meta time');
        await expect(updated).toHaveText('更新于 2026-10-05');
        await expect(updated).toHaveAttribute('datetime', '2026-10-04T16:00:00.000Z');
        expect(await updated.getAttribute('tabindex')).toBeNull();
        expect(
          await updated.evaluate((e) => ({
            color: getComputedStyle(e).color,
            font: getComputedStyle(e).fontSize,
          })),
        ).toEqual({ color: after[0].color, font: after[0].font });
        for (let index = 0; index < after.length; index++) {
          const { height: oldHeight, ...oldStable } = before[index];
          const { height: newHeight, ...newStable } = after[index];
          expect(newStable).toEqual(oldStable);
          if (index === 0) {
            expect(newHeight).toBeGreaterThanOrEqual(oldHeight);
            expect(newHeight - oldHeight).toBeLessThanOrEqual(26);
          } else expect(newHeight).toBe(oldHeight);
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        const updateBounds = await updated.boundingBox();
        expect(updateBounds!.x).toBeGreaterThanOrEqual(0);
        expect(updateBounds!.x + updateBounds!.width).toBeLessThanOrEqual(width);
        const record = { width, colorScheme, before, after, updateBounds };
        await info.attach('layout', {
          body: JSON.stringify(record, null, 2),
          contentType: 'application/json',
        });
        if (info.project.name === 'edge' && [375, 1440].includes(width))
          await page.screenshot({
            path: info.outputPath(`home-${width}-${colorScheme}.png`),
            fullPage: true,
          });
        await baseline.close();
      });
    });
  }
}

test('无 JavaScript 仍显示提示且文章、归档普通链接可用', async ({ browser, baseURL }) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    baseURL,
    viewport: { width: 375, height: 844 },
  });
  try {
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.locator('.post-card .post-meta time')).toHaveText('更新于 2026-10-05');
    await page.locator('.post-card-title a').first().click();
    await expect(page).toHaveURL(/\/post\/55b0541c\/$/);
    await expect(page.locator('h1')).toHaveCount(1);
    await page.goto('/archives/');
    await expect(page.locator('.timeline article')).toHaveCount(3);
    await expect(page.locator('.post-meta time')).toHaveCount(0);
  } finally {
    await context.close();
  }
});
