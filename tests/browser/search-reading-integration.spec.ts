import { test, expect } from '@playwright/test';

test.use({ reducedMotion: 'reduce' });

for (const width of [375, 390]) {
  test(`code search opens the compact article and preserves navigation at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/');
    await page.locator('.search-open:visible').click();
    await page.locator('#search-input').fill('git clone');
    const result = page.locator('.search-results a[href="/post/55b0541c/"]');
    await expect(result).toHaveCount(1);
    await expect(result.locator('p')).toContainText('git clone');
    await expect(result.locator('p mark').first()).toBeVisible();
    await result.click();
    await expect(page).toHaveURL(/\/post\/55b0541c\/$/);
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator('.article-header h1')).toBeVisible();
    await expect(page.locator('.article-header .post-meta > :visible')).toHaveCount(3);
    await expect(page.locator('.article-meta-mobile-updated')).toBeVisible();
    await expect(page.locator('.article-meta-mobile-updated')).toHaveText('更新于 2026.10.05');
    await expect(page.locator('.article-header .card-tags')).toBeHidden();
    const details = page.locator('.article-mobile-details');
    await expect(details).toBeVisible();
    await expect(details.locator('.post-meta')).toContainText('字');
    expect(await details.locator('.card-tags a').count()).toBeGreaterThan(0);
    const date = page.locator('.article-header .post-meta > time');
    await expect(date).toHaveAttribute('datetime', /\d{4}-\d{2}-\d{2}T/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.locator('.goto-toc').click();
    await expect(page.locator('.contents-dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.contents-dialog')).toBeHidden();
    await expect(page.locator('.goto-toc')).toBeFocused();
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('main')).toBeVisible();
    await page.goForward();
    await expect(page).toHaveURL(/\/post\/55b0541c\/$/);
    await expect(page.locator('.article-header .card-tags')).toBeHidden();
    expect(errors).toEqual([]);
  });
}
