import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import AxeBuilder from '@axe-core/playwright';

const dir = process.env.VISUAL_EVIDENCE_DIR || 'docs/evidence/reading-layout/edge';
const baseline = JSON.parse(fs.readFileSync('docs/evidence/contents-controls/before.json', 'utf8'));
fs.mkdirSync(dir, { recursive: true });
const views = [
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
  { width: 2560, height: 1440 },
];

for (const viewport of views) {
  test(`home retains the full Yelee sidebar without a contents gutter at ${viewport.width}`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.locator('.desktop-sidebar')).toBeVisible();
    await expect(page.locator('.tablet-sidebar')).not.toBeVisible();
    await expect(page.locator('.profile h2')).toHaveText('AkiSenn');
    await expect(page.locator('.profile p')).toHaveText('记录技术与生活');
    await expect(page.locator('.profile-site-name,.reading-sidebar,.desktop-contents')).toHaveCount(
      0,
    );
    await expect(page.locator('.site-nav a[aria-current=page]')).toHaveAttribute('href', '/');
    const sizes = await page.evaluate(() => {
      const b = document.querySelector('.desktop-sidebar')!.getBoundingClientRect();
      const main = document.querySelector('.main-shell')!.getBoundingClientRect();
      const list = document.querySelector('#main')!.getBoundingClientRect();
      return {
        sidebar: b.width,
        mainLeft: main.left,
        mainWidth: list.width,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    expect(sizes.sidebar).toBe(272);
    expect(sizes.mainLeft).toBe(272);
    expect(sizes.mainWidth).toBeGreaterThan(900);
    expect(sizes.mainWidth).toBeLessThanOrEqual(1120);
    expect(sizes.overflow).toBeLessThanOrEqual(1);
    for (const control of await page
      .locator(
        '.desktop-sidebar .site-nav a,.desktop-sidebar .site-tools button,.desktop-sidebar .social-links a',
      )
      .all()) {
      const b = (await control.boundingBox())!;
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.y + b.height).toBeLessThanOrEqual(viewport.height);
    }
    await page.screenshot({
      path: `${dir}/home-${viewport.width}x${viewport.height}.png`,
      animations: 'disabled',
    });
  });
}

test('compact body widths and typography remain equal after removing the redundant top control', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const item of baseline.cases.filter((c: any) => c.width < 1000)) {
    await page.setViewportSize({ width: item.width, height: item.height });
    await page.goto(item.path);
    await page.evaluate(() => document.fonts.ready);
    for (const selector of [
      '.main-shell',
      '#main',
      '.article-layout',
      '.article .prose',
      '.post-card',
      '.mobile-header',
      '.tablet-sidebar',
    ]) {
      const actual = await page.locator(selector).evaluateAll((nodes) => {
        const el = nodes[0];
        if (!el) return null;
        const b = el.getBoundingClientRect(),
          c = getComputedStyle(el);
        return {
          x: b.x,
          y: b.y,
          width: b.width,
          height: b.height,
          fontSize: c.fontSize,
          lineHeight: c.lineHeight,
          display: c.display,
        };
      });
      const expected = item.boxes[selector];
      if (item.path.startsWith('/post/') && actual && expected) {
        // Removing the top TOC control intentionally changes vertical placement,
        // not the article's width, fonts, line wrapping or navigation geometry.
        const { y: _y, height: _height, ...stableActual } = actual;
        const { y: _beforeY, height: _beforeHeight, ...stableExpected } = expected;
        expect(stableActual, `${item.width} ${selector}`).toEqual(stableExpected);
        if (
          selector === '.article .prose' ||
          selector === '.mobile-header' ||
          selector === '.tablet-sidebar'
        )
          expect(actual.height).toEqual(expected.height);
      } else if (selector === '.main-shell' && actual && expected) {
        // Footer social icons intentionally change total page height. Preserve
        // its position, width and typography; content geometry stays exact.
        const { height: _height, ...stableActual } = actual;
        const { height: _beforeHeight, ...stableExpected } = expected;
        expect(stableActual, `${item.width} ${selector}`).toEqual(stableExpected);
      } else expect(actual, `${item.width} ${item.path} ${selector}`).toEqual(expected);
    }
  }
});

test('long docked contents scroll independently, follow active chapters and retain H2/H3 hierarchy', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/post/55b0541c/');
  const pane = page.locator('.reading-sidebar-scroll');
  await expect(pane.locator('.toc-level-2')).not.toHaveCount(0);
  await expect(pane.locator('.toc-level-3')).not.toHaveCount(0);
  const mainY = await page.evaluate(() => scrollY);
  await pane.hover();
  await page.mouse.wheel(0, 1000);
  await expect.poll(() => pane.evaluate((el) => el.scrollTop)).toBeGreaterThan(100);
  expect(await page.evaluate(() => scrollY)).toBe(mainY);
  await pane.locator('.toc-link').last().click();
  await expect.poll(() => page.evaluate(() => decodeURIComponent(location.hash))).not.toBe('');
  const heading = page.locator('.article .prose h2[id]').nth(3);
  const id = await heading.getAttribute('id');
  await heading.evaluate((el) =>
    scrollTo({
      top: el.getBoundingClientRect().top + scrollY - innerHeight * 0.25,
      behavior: 'instant',
    }),
  );
  await expect(pane.locator('.toc-link.active')).toHaveAttribute('href', `#${id}`);
  await expect(pane.locator('.toc-link.active')).toBeInViewport();
  await pane.locator('.toc').evaluate((el) => {
    for (let i = 0; i < 120; i++) el.append(el.firstElementChild!.cloneNode(true));
  });
  expect(await pane.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
  expect(
    await page.locator('.reading-sidebar').evaluate((el) => el.scrollHeight <= el.clientHeight),
  ).toBe(true);
});

test('narrow desktop uses a dedicated contents dialog without moving or shrinking the article', async ({
  page,
}) => {
  for (const width of [1000, 1024, 1180, 1279]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/post/55b0541c/');
    const before = await page.locator('.article-layout').boundingBox();
    expect(before!.width).toBeGreaterThan(800);
    await page.locator('.reading-rail .contents-open').click();
    await expect(page.locator('#reading-contents')).toBeVisible();
    await expect(page.locator('.reading-sidebar')).not.toBeVisible();
    expect(await page.locator('.article-layout').boundingBox()).toEqual(before);
    await page.keyboard.press('Escape');
    await expect(page.locator('.reading-rail .contents-open')).toBeFocused();
    expect(await page.locator('.article-layout').boundingBox()).toEqual(before);
  }
});

test('navigation, panel keyboard controls, dark mode, native fallback and page-type switching remain accessible', async ({
  page,
  browser,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.locator('.post-card-title a').first().click();
  await expect(page.locator('.reading-rail')).toBeVisible();
  for (const link of await page.locator('.reading-rail nav a').all()) {
    await expect(link).toHaveAccessibleName(/.+/);
    await expect(link).toHaveAttribute('title', /.+/);
    await link.focus();
    expect(await link.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe('none');
  }
  await page.locator('#reading-sidebar-title').focus();
  await page.keyboard.press('Escape');
  await expect(page.locator('.reading-rail .contents-open')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#reading-sidebar-title')).toBeFocused();
  await page.locator('.reading-rail .mode-toggle').click();
  const result = await new AxeBuilder({ page }).analyze();
  expect(
    result.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious'),
  ).toEqual([]);
  await page.screenshot({ path: `${dir}/reading-dark-1440.png`, animations: 'disabled' });
  await page.locator('.reading-rail nav a[href="/"]').click();
  await expect(page.locator('.desktop-sidebar')).toBeVisible();
  await expect(page.locator('.reading-sidebar')).toHaveCount(0);
  for (const width of [1024, 1366, 1920]) {
    const context = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width, height: 900 },
    });
    const native = await context.newPage();
    await native.goto('http://127.0.0.1:4322/post/55b0541c/');
    if (width < 1280) {
      await native.locator('.contents-fallback summary').click();
      await expect(native.locator('.contents-fallback .toc-link').first()).toBeVisible();
    } else await expect(native.locator('.reading-sidebar .toc-link').first()).toBeVisible();
    await context.close();
  }
});

test('social-only changes preserve article, card, navigation and content typography geometry', async ({
  page,
}) => {
  const baseline = JSON.parse(fs.readFileSync('docs/evidence/social-links/before.json', 'utf8'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const item of baseline.cases) {
    await page.setViewportSize({ width: item.width, height: item.height });
    await page.goto(item.path);
    await page.evaluate(() => document.fonts.ready);
    for (const [selector, expected] of Object.entries(item.boxes)) {
      if (selector === '.main-shell') continue; // Footer height intentionally changes.
      const actual = await page.locator(selector).evaluateAll((nodes) => {
        const el = nodes[0];
        if (!el) return null;
        const b = el.getBoundingClientRect(),
          c = getComputedStyle(el);
        return {
          x: b.x,
          y: b.y,
          width: b.width,
          height: b.height,
          fontSize: c.fontSize,
          lineHeight: c.lineHeight,
          display: c.display,
        };
      });
      expect(actual, `${item.width} ${item.path} ${selector}`).toEqual(expected);
    }
  }
});
