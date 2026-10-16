import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const dir = process.env.VISUAL_EVIDENCE_DIR || 'docs/evidence/sidebar-bottom/edge';
fs.mkdirSync(dir, { recursive: true });

test('full desktop sidebar separates restrained functional buttons from social icons', async ({
  page,
}) => {
  test.setTimeout(90000);
  const checks = [];
  for (const mode of ['dark', 'light'] as const) {
    await page.emulateMedia({ colorScheme: mode, reducedMotion: 'reduce' });
    for (const [width, height] of [
      [1366, 768],
      [1920, 1080],
      [1440, 900],
      [1366, 640],
      [1000, 640],
    ]) {
      await page.setViewportSize({ width, height });
      await page.goto('/');
      await page.mouse.move(0, 0);
      const bottom = page.locator('.desktop-sidebar .sidebar-bottom');
      await expect(bottom.locator('.site-tools button')).toHaveCount(2);
      await expect(bottom.locator('.social-links a')).toHaveCount(4);
      const result = await bottom.evaluate((el) => {
        const tools = el.querySelector('.site-tools')!,
          social = el.querySelector('.social-links')!,
          sidebar = el.closest('.desktop-sidebar')!;
        const box = (node: Element) => {
          const b = node.getBoundingClientRect();
          return {
            x: b.x,
            y: b.y,
            width: b.width,
            height: b.height,
            bottom: b.bottom,
            right: b.right,
          };
        };
        const rows = (selector: string) =>
          [...el.querySelectorAll(selector)].map((node) => {
            const s = getComputedStyle(node);
            return {
              ...box(node),
              color: s.color,
              background: s.backgroundColor,
              radius: s.borderRadius,
            };
          });
        const t = rows('.site-tools button'),
          s = rows('.social-links a');
        const center = (items: typeof t) => (items[0].x + items.at(-1)!.right) / 2;
        const b = box(el);
        return {
          bottom: b,
          tools: box(tools),
          social: box(social),
          buttons: t,
          links: s,
          toolsCenterDifference: Math.abs(center(t) - b.x - b.width / 2),
          socialCenterDifference: Math.abs(center(s) - b.x - b.width / 2),
          display: getComputedStyle(el).display,
          direction: getComputedStyle(el).flexDirection,
          position: getComputedStyle(el).position,
          parentBorder: getComputedStyle(el).borderTopWidth,
          toolsBorder: getComputedStyle(tools).borderTopWidth,
          socialBorder: getComputedStyle(social).borderTopWidth,
          socialPadding: getComputedStyle(social).paddingTop,
          sidebarHeight: sidebar.clientHeight,
          sidebarScrollHeight: sidebar.scrollHeight,
          innerScroll: el.scrollHeight > el.clientHeight,
          bottomSpace: innerHeight - b.bottom,
          navBottom: box(sidebar.querySelector('.site-nav')!).bottom,
        };
      });
      expect(result.display).toBe('flex');
      expect(result.direction).toBe('column');
      expect(result.position).toBe('static');
      expect(result.parentBorder).toBe('0px');
      expect(result.toolsBorder).toBe('0px');
      expect(result.socialBorder).toBe('1px');
      expect(result.socialPadding).toBe('12px');
      expect(result.social.y - result.tools.bottom).toBe(12);
      expect(result.navBottom).toBeLessThanOrEqual(result.bottom.y);
      expect(result.bottomSpace).toBe(24);
      expect(result.innerScroll).toBe(false);
      expect(result.sidebarScrollHeight).toBeLessThanOrEqual(result.sidebarHeight + 1);
      expect(result.toolsCenterDifference).toBeLessThan(1);
      expect(result.socialCenterDifference).toBeLessThan(1);
      for (const button of result.buttons) {
        expect(button.width).toBe(42);
        expect(button.height).toBe(42);
        expect(button.radius).toBe('10px');
        expect(button.background).not.toBe('rgba(0, 0, 0, 0)');
        expect(button.color).not.toBe(result.links[0].color);
      }
      expect(result.buttons[1].x - result.buttons[0].right).toBe(12);
      for (const link of result.links) {
        expect(link.width).toBe(44);
        expect(link.height).toBe(44);
        expect(link.background).toBe('rgba(0, 0, 0, 0)');
      }
      for (const control of await bottom.locator('button,a').all()) {
        await expect(control).toHaveAccessibleName(/.+/);
        await expect(control).toHaveAttribute('title', /.+/);
        expect(
          await control.evaluate((el) => {
            const b = el.getBoundingClientRect();
            return el.contains(document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2));
          }),
        ).toBe(true);
      }
      checks.push({ width, height, mode, ...result });
      await page
        .locator('.desktop-sidebar')
        .screenshot({
          path: `${dir}/sidebar-${mode}-${width}x${height}.png`,
          animations: 'disabled',
        });
      if (width === 1920 || (width === 1366 && height === 768))
        await page.screenshot({
          path: `${dir}/home-${mode}-${width}x${height}.png`,
          animations: 'disabled',
        });
    }
  }
  fs.writeFileSync(
    `${dir}/sidebar-layout.json`,
    JSON.stringify({ checkedAt: new Date().toISOString(), checks }, null, 2) + '\n',
  );
});

test('desktop search, appearance and social keyboard controls retain their original behavior', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/');
  const bottom = page.locator('.desktop-sidebar .sidebar-bottom');
  const search = bottom.locator('.search-open'),
    mode = bottom.locator('.mode-toggle');
  const resting = await search.evaluate((el) => getComputedStyle(el).backgroundColor);
  await search.focus();
  expect(await search.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe('solid');
  await expect(search).not.toHaveCSS('background-color', resting);
  const ready = page.waitForResponse((response) => response.url().endsWith('/search.json'));
  await page.keyboard.press('Enter');
  await expect(page.locator('#search-input')).toBeFocused();
  await page.locator('#search-input').fill('欧拉');
  await (await ready).finished();
  await expect(page.locator('.search-results a')).toHaveAttribute('href', '/post/4e395565/');
  await page.keyboard.press('Escape');
  await expect(search).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(mode).toBeFocused();
  for (const value of ['light', 'dark', 'auto']) {
    await page.keyboard.press('Enter');
    await expect(page.locator('html')).toHaveAttribute('data-mode', value);
  }
  await page.keyboard.press('Tab');
  for (const link of await bottom.locator('.social-links a').all()) {
    await expect(link).toBeFocused();
    expect(await link.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe('solid');
    await link.hover();
    await expect(link).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await page.mouse.move(0, 0);
    await page.keyboard.press('Tab');
  }
});

test('footer, mini rail, profile, navigation and content remain equal to their own browser baseline', async ({
  page,
  browserName,
}) => {
  const engine = browserName === 'webkit' ? 'webkit' : 'edge';
  const baseline = JSON.parse(
    fs.readFileSync(`docs/evidence/sidebar-bottom/before-${engine}.json`, 'utf8'),
  );
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
  for (const item of baseline.cases) {
    await page.setViewportSize({ width: item.width, height: item.height });
    await page.goto(item.path);
    await page.evaluate(() => document.fonts.ready);
    for (const [selector, expected] of Object.entries(item.regions)) {
      const actual = await page.locator(selector).evaluateAll((nodes) =>
        nodes.map((el) => {
          const b = el.getBoundingClientRect(),
            s = getComputedStyle(el);
          return {
            x: b.x,
            y: b.y,
            width: b.width,
            height: b.height,
            display: s.display,
            fontSize: s.fontSize,
            lineHeight: s.lineHeight,
            color: s.color,
            background: s.backgroundColor,
            gap: s.gap,
            padding: s.padding,
            border: s.borderTop,
          };
        }),
      );
      expect(actual, `${engine} ${item.width} ${item.path} ${selector}`).toEqual(expected);
    }
  }
});
