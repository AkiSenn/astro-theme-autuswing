import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';

const dir = process.env.VISUAL_EVIDENCE_DIR || 'docs/evidence/contents-controls/edge';
fs.mkdirSync(dir, { recursive: true });
const actions =
  '.contents-open:visible,.goto-toc:visible,.reading-contents-close:visible,.contents-close:visible';
const opener = '.contents-open:visible,.goto-toc:visible';
const path = '/post/55b0541c/';

async function singleAction(page: Page) {
  await expect(page.locator(actions)).toHaveCount(1);
  await expect(page.locator(actions)).toHaveAccessibleName(/.+/);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
  ).toBeLessThanOrEqual(1);
}

test('one contents action across phone, portrait/landscape tablets, desktop and breakpoint boundaries', async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const checks = [];
  for (const [width, height] of [
    [320, 740],
    [390, 844],
    [430, 932],
    [719, 900],
    [720, 900],
    [721, 900],
    [768, 1024],
    [820, 1180],
    [999, 900],
    [1000, 900],
    [1024, 768],
    [1180, 820],
    [1279, 900],
    [1280, 900],
    [1281, 900],
    [1366, 768],
    [1439, 900],
    [1440, 900],
    [1441, 900],
    [1920, 1080],
    [2560, 1440],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto(path);
    await singleAction(page);
    await expect(page.locator('.contents-access button')).toHaveCount(0);
    const expected =
      width < 720 ? '.goto-toc' : width < 1440 ? '.contents-open' : '.reading-contents-close';
    await expect(page.locator(expected)).toBeVisible();
    const article = await page.locator('.article-layout').boundingBox();
    if (width >= 1440) {
      await page.locator('.reading-contents-close').click();
      await singleAction(page);
      await expect(page.locator('.reading-rail .contents-open')).toBeFocused();
      expect(await page.locator('.article-layout').boundingBox()).toEqual(article);
    }
    await page.locator(opener).click();
    await singleAction(page);
    await expect(page.locator(opener)).toHaveCount(0);
    const panel = width >= 1280 ? '.reading-sidebar' : '#reading-contents';
    await expect(page.locator(panel)).toBeVisible();
    await expect(page.locator(`${panel} .contents-count`)).toHaveText(
      String(await page.locator(`${panel} .toc-link`).count()),
    );
    if ([390, 768, 1024, 1366, 1440, 1920, 2560].includes(width))
      await page.screenshot({
        path: `${dir}/contents-open-${width}x${height}.png`,
        animations: 'disabled',
      });
    await page.locator(actions).click();
    await singleAction(page);
    await expect(page.locator(opener)).toBeFocused();
    expect(await page.locator('.article-layout').boundingBox()).toEqual(article);
    if ([390, 768, 1024, 1366, 1440, 1920, 2560].includes(width))
      await page.screenshot({
        path: `${dir}/contents-closed-${width}x${height}.png`,
        animations: 'disabled',
      });
    checks.push({
      width,
      height,
      action: await page.locator(actions).getAttribute('class'),
      article,
    });
  }
  fs.writeFileSync(
    `${dir}/contents-actions.json`,
    JSON.stringify({ checkedAt: new Date().toISOString(), checks }, null, 2) + '\n',
  );
});

test('resizing an open or closed contents surface keeps exactly one action and releases the modal', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const [from, to] of [
    [719, 720],
    [720, 719],
    [999, 1000],
    [1279, 1280],
    [1280, 1279],
    [1439, 1440],
    [1440, 1439],
  ]) {
    await page.setViewportSize({ width: from, height: 900 });
    await page.goto(path);
    await singleAction(page);
    // Exercise both a user-opened surface and an explicitly closed surface.
    if (from >= 1440) await page.locator(actions).click();
    await page.locator(opener).click();
    await singleAction(page);
    await page.setViewportSize({ width: to, height: 900 });
    await expect(page.locator('#reading-contents')).not.toBeVisible();
    await singleAction(page);
    expect(await page.evaluate(() => !!document.activeElement?.getClientRects().length)).toBe(true);
    await page.locator(actions).click();
    await singleAction(page);
    await page.setViewportSize({ width: from, height: 900 });
    await expect(page.locator('#reading-contents')).not.toBeVisible();
    await singleAction(page);
    expect(await page.locator('[inert]').count()).toBe(0);
  }
});

test('phone contents works at the top and after scrolling without removing back-to-top or search', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(path);
  await expect(page.locator('.goto-toc')).toBeVisible();
  await expect(page.locator('.back-top')).not.toBeVisible();
  await expect(page.locator('.copy-link')).toHaveCount(1);
  await page.evaluate(() => scrollTo({ top: 1200, behavior: 'instant' }));
  await expect(page.locator('.back-top')).toBeVisible();
  await singleAction(page);
  await page.locator('.goto-toc').click();
  await singleAction(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('.goto-toc')).toBeFocused();
  await page.locator('.back-top').click();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  await singleAction(page);
  await page.locator('.search-open:visible').click();
  await expect(page.locator('#search-input')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('.search-open:visible')).toBeFocused();
  await singleAction(page);
});

test('scrolling reveals reading tools without introducing a second contents action', async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [390, 719, 720, 768, 1024, 1279, 1280, 1366, 1439, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(path);
    await page.evaluate(() => scrollTo({ top: 1200, behavior: 'instant' }));
    await expect(page.locator('.back-top')).toBeVisible();
    await singleAction(page);
    if (width >= 720) await expect(page.locator('.goto-toc')).not.toBeVisible();
    await page.locator(actions).click();
    await singleAction(page);
    await page.locator(actions).click();
    await singleAction(page);
    await expect(page.locator('.back-top')).toBeVisible();
  }
});
