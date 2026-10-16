import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';

const dir = process.env.VISUAL_EVIDENCE_DIR || 'docs/evidence/social-links/edge';
fs.mkdirSync(dir, { recursive: true });
const config = JSON.parse(fs.readFileSync('src/config/theme.json', 'utf8'));
const expectedLinks = [...Object.entries(config.social), ['RSS', '/rss.xml']];

async function checkSocial(page: Page, width: number, article: boolean) {
  const fullSidebar = width >= 1000 && !article;
  const social = page.locator('.social-links:visible');
  await expect(social).toHaveCount(1);
  await expect(social.locator('a')).toHaveCount(4);
  await expect(page.locator('.tablet-sidebar .social-links')).toHaveCount(0);
  if (fullSidebar) {
    await expect(page.locator('.desktop-sidebar .social-links')).toBeVisible();
    await expect(page.locator('.compact-social')).not.toBeVisible();
  } else {
    await expect(page.locator('.compact-social')).toBeVisible();
    await social.scrollIntoViewIfNeeded();
  }
  for (const [i, [name, url]] of expectedLinks.entries()) {
    const link = social.locator('a').nth(i);
    await expect(link).toHaveAttribute('href', String(url));
    await expect(link).toHaveAccessibleName(String(name));
    await expect(link).toHaveAttribute('title', String(name));
    await expect(link).toHaveText('');
    await expect(link.locator('use')).toHaveAttribute(
      'href',
      `#i-${['mail', 'github', 'bilibili', 'rss'][i]}`,
    );
    expect(
      await link.evaluate((el) => {
        const box = el.getBoundingClientRect();
        return el.contains(
          document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2),
        );
      }),
    ).toBe(true);
  }
  const geometry = await social.evaluate((el) => {
    const box = el.getBoundingClientRect();
    const links = [...el.querySelectorAll('a')].map((a) => {
      const b = a.getBoundingClientRect(),
        icon = a.querySelector('svg')!.getBoundingClientRect();
      return {
        x: b.x,
        y: b.y,
        width: b.width,
        height: b.height,
        right: b.right,
        iconWidth: icon.width,
        iconHeight: icon.height,
      };
    });
    return {
      links,
      centerDifference: Math.abs((links[0].x + links.at(-1)!.right) / 2 - box.x - box.width / 2),
      overflow: document.documentElement.scrollWidth - innerWidth,
    };
  });
  expect(geometry.centerDifference).toBeLessThan(1);
  expect(geometry.overflow).toBeLessThanOrEqual(1);
  for (const item of geometry.links) {
    expect(item.width).toBe(44);
    expect(item.height).toBe(44);
    expect(item.iconWidth).toBe(20);
    expect(item.iconHeight).toBe(20);
    expect(item.y).toBeCloseTo(geometry.links[0].y);
    expect(item.x).toBeGreaterThanOrEqual(0);
    expect(item.right).toBeLessThanOrEqual(width);
  }
  for (let i = 1; i < geometry.links.length; i++)
    expect(geometry.links[i].x - geometry.links[i - 1].right).toBe(8);
  const footer = page.locator('.site-footer');
  expect(await footer.evaluate((el) => getComputedStyle(el).borderTopWidth)).toBe('1px');
  const copyright = footer.locator(':scope > .footer-row').first();
  const registration = footer.locator('.registration');
  if (!fullSidebar) {
    const icons = (await social.boundingBox())!;
    expect((await copyright.boundingBox())!.y).toBeGreaterThanOrEqual(icons.y + icons.height);
  }
  expect((await registration.boundingBox())!.y).toBeGreaterThan((await copyright.boundingBox())!.y);
  return { width, article, fullSidebar, ...geometry };
}

test('social icons are centered, unique, recognizable and reachable across layouts and breakpoints', async ({
  page,
}) => {
  test.setTimeout(180000);
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
  const checks = [];
  for (const [width, height] of [
    [320, 640],
    [375, 812],
    [390, 844],
    [430, 932],
    [719, 900],
    [720, 900],
    [768, 1024],
    [820, 1180],
    [999, 900],
    [1000, 900],
    [1024, 768],
    [1180, 820],
    [1280, 900],
    [1366, 768],
    [1440, 900],
    [1920, 1080],
    [2560, 1440],
  ]) {
    await page.setViewportSize({ width, height });
    for (const path of ['/', '/post/55b0541c/']) {
      await page.goto(path);
      const article = path !== '/';
      checks.push(await checkSocial(page, width, article));
      if ([320, 390, 768, 1024, 1366, 1920].includes(width)) {
        await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
        await page.screenshot({
          path: `${dir}/social-${article ? 'article' : 'home'}-${width}x${height}.png`,
          animations: 'disabled',
        });
      }
    }
  }
  for (const width of [390, 820, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ['/archives/', '/tags/', '/links/', '/about/']) {
      await page.goto(path);
      checks.push({ path, ...(await checkSocial(page, width, false)) });
    }
  }
  fs.writeFileSync(
    `${dir}/social-layout.json`,
    JSON.stringify({ checkedAt: new Date().toISOString(), checks }, null, 2) + '\n',
  );
});

test('social icon keyboard feedback and native tooltips survive both appearances and disabled JavaScript', async ({
  page,
  browser,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const mode of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: mode as 'light' | 'dark', reducedMotion: 'reduce' });
    await page.goto('/');
    const links = page.locator('.compact-social a');
    await links.first().focus();
    for (const link of await links.all()) {
      await expect(link).toBeFocused();
      expect(await link.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe('none');
      const original = await link.evaluate((el) => getComputedStyle(el).backgroundColor);
      await link.hover();
      expect(await link.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe(original);
      await page.mouse.move(0, 0);
      await page.keyboard.press('Tab');
    }
    await page.screenshot({ path: `${dir}/social-footer-${mode}.png`, animations: 'disabled' });
  }
  for (const width of [320, 820, 1440]) {
    const context = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width, height: 900 },
    });
    const native = await context.newPage();
    await native.goto('http://127.0.0.1:4322/');
    await checkSocial(native, width, false);
    await context.close();
  }
});
