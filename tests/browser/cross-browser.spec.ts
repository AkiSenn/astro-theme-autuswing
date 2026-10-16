import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const dir = process.env.VISUAL_EVIDENCE_DIR || 'docs/evidence/phase5/edge';
fs.mkdirSync(dir, { recursive: true });

test('welcome message belongs to the about page rather than the sidebar', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [390, 820, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/about/');
    await expect(page.locator('.standalone-page .about-intro')).toHaveText('欢迎来到我的网站喵');
    await expect(page.getByText('欢迎来到我的网站喵', { exact: true })).toHaveCount(1);
    await expect(page.locator('.standalone-page .prose')).toContainText('你好，我是');
    await expect(page.locator('.desktop-sidebar')).not.toContainText('欢迎来到我的网站喵');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: `${dir}/about-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    });
    await page.goto('/post/55b0541c/');
    await expect(page.getByText('欢迎来到我的网站喵', { exact: true })).toHaveCount(0);
  }
});

test('portable desktop reading contract at the four requested desktop viewports', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const checks = [];
  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
    { width: 2560, height: 1440 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/post/55b0541c/');
    await page.evaluate(() => document.fonts.ready);
    const panel = page.locator('.reading-sidebar');
    const toggle = page.locator('.reading-rail .contents-open');
    await expect(toggle).toHaveAttribute(
      'aria-expanded',
      viewport.width >= 1440 ? 'true' : 'false',
    );
    const initial = await page.locator('.article-layout').boundingBox();
    await page.screenshot({
      path: `${dir}/reading-default-${viewport.width}x${viewport.height}.png`,
      animations: 'disabled',
    });
    if (viewport.width < 1440) await toggle.click();
    const sizes = await page.evaluate(() => {
      const box = (selector: string) => document.querySelector(selector)!.getBoundingClientRect();
      const sidebar = document.querySelector<HTMLElement>('.reading-rail')!;
      const toc = document.querySelector<HTMLElement>('.reading-sidebar-scroll')!;
      const prose = document.querySelector<HTMLElement>('.article .prose')!;
      const area = box('#main'),
        text = box('.article .prose'),
        bottom = box('.reading-rail .rail-tools');
      return {
        fontSize: getComputedStyle(prose).fontSize,
        lineHeight: getComputedStyle(prose).lineHeight,
        proseWidth: text.width,
        articleWidth: box('.article-layout').width,
        sidebarWidth: sidebar.getBoundingClientRect().width,
        panelWidth: box('.reading-sidebar').width,
        panelHeight: box('.reading-sidebar').height,
        centerDifference: Math.abs(text.x + text.width / 2 - area.x - area.width / 2),
        sidebarHeight: sidebar.clientHeight,
        sidebarScrollHeight: sidebar.scrollHeight,
        tocHeight: toc.clientHeight,
        tocScrollHeight: toc.scrollHeight,
        bottom: bottom.bottom,
        rootOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    expect(sizes.fontSize).toBe('18px');
    expect(parseFloat(sizes.lineHeight) / 18).toBeCloseTo(1.8);
    expect(sizes.articleWidth).toBe(860);
    expect(sizes.proseWidth).toBe(810);
    expect(sizes.sidebarWidth).toBe(72);
    expect(sizes.panelWidth).toBe(260);
    expect(sizes.panelHeight).toBe(viewport.height);
    expect(sizes.centerDifference).toBeLessThan(1);
    expect(sizes.sidebarScrollHeight).toBeLessThanOrEqual(sizes.sidebarHeight + 1);
    expect(sizes.tocHeight).toBeGreaterThan(viewport.height - 220);
    if (viewport.height <= 1080) expect(sizes.tocScrollHeight).toBeGreaterThan(sizes.tocHeight);
    expect(sizes.bottom).toBeLessThanOrEqual(viewport.height);
    expect(sizes.rootOverflow).toBeLessThanOrEqual(1);
    await expect(page.locator('.desktop-sidebar')).toHaveCount(0);
    await expect(page.locator('.reading-rail nav a')).toHaveCount(5);
    await page.screenshot({
      path: `${dir}/desktop-${viewport.width}x${viewport.height}.png`,
      animations: 'disabled',
    });
    await panel.locator('.reading-contents-close').click();
    await expect(panel).not.toBeVisible();
    expect(await page.locator('.article-layout').boundingBox()).toEqual(initial);
    await expect(toggle).toBeFocused();
    await page.screenshot({
      path: `${dir}/reading-collapsed-${viewport.width}x${viewport.height}.png`,
      animations: 'disabled',
    });
    await toggle.click();
    await expect(panel).toBeVisible();
    expect(await page.locator('.article-layout').boundingBox()).toEqual(initial);
    checks.push({ viewport, ...sizes });
  }
  fs.writeFileSync(
    `${dir}/portable-desktop.json`,
    JSON.stringify({ checkedAt: new Date().toISOString(), checks }, null, 2) + '\n',
  );
});
