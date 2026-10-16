import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';

const dir = 'docs/evidence/desktop-reading';
const baseline = JSON.parse(fs.readFileSync(`${dir}/before.json`, 'utf8'));
const viewports = [
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
];
const selectors = [
  '.main-shell',
  '#main',
  '.article-layout',
  '.article .prose',
  '.desktop-sidebar',
  '.desktop-sidebar .profile',
  '.desktop-sidebar .site-nav',
  '.desktop-contents',
  '.sidebar-bottom',
  '.post-card',
  '.tablet-sidebar',
  '.mobile-header',
];
async function metrics(page: Page) {
  return page.evaluate(
    (selectors) =>
      Object.fromEntries(
        selectors.map((selector) => {
          const el = document.querySelector<HTMLElement>(selector);
          if (!el) return [selector, null];
          const b = el.getBoundingClientRect(),
            s = getComputedStyle(el);
          return [
            selector,
            {
              x: b.x,
              y: b.y,
              width: b.width,
              height: b.height,
              fontSize: s.fontSize,
              lineHeight: s.lineHeight,
              color: s.color,
              background: s.backgroundColor,
              display: s.display,
              overflowY: s.overflowY,
              scrollHeight: el.scrollHeight,
              clientHeight: el.clientHeight,
            },
          ];
        }),
      ),
    selectors,
  );
}
async function prepare(page: Page, viewport: { width: number; height: number }, path: string) {
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' });
  await page.setViewportSize(viewport);
  await page.goto(path);
  await page.evaluate(() => document.fonts.ready);
}
async function visibleControls(page: Page, height: number) {
  for (const selector of ['.site-nav a', '.search-open', '.mode-toggle', '.social-links a']) {
    for (const control of await page.locator(`.desktop-sidebar ${selector}`).all()) {
      await expect(control).toBeVisible();
      const b = (await control.boundingBox())!;
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.y + b.height).toBeLessThanOrEqual(height);
      expect(
        await control.evaluate((el) => {
          const b = el.getBoundingClientRect();
          const target = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
          return target === el || (!!target && el.contains(target));
        }),
      ).toBe(true);
    }
  }
}
for (const viewport of viewports) {
  test(`desktop reading remains centered with an independent TOC at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await prepare(page, viewport, '/post/55b0541c/');
    const before = baseline.measurements.find(
      (c: any) => c.changed && c.viewport.width === viewport.width,
    ).metrics;
    const after = await metrics(page);
    const prose = after['.article .prose'],
      old = before['.article .prose'];
    expect(prose.width - old.width).toBeCloseTo(50);
    expect(prose.width).toBeLessThanOrEqual(754);
    expect(prose.fontSize).toBe('18px');
    expect(parseFloat(prose.lineHeight) / 18).toBeCloseTo(1.8);
    expect(prose.x + prose.width / 2).toBeCloseTo(old.x + old.width / 2);
    expect(prose.color).toBe(old.color);
    const sidebar = after['.desktop-sidebar'],
      toc = after['.desktop-contents'];
    expect(sidebar.height).toBe(viewport.height);
    expect(sidebar.overflowY).toBe('hidden');
    expect(sidebar.scrollHeight).toBeLessThanOrEqual(sidebar.clientHeight + 1);
    expect(toc.height).toBeGreaterThan(before['.desktop-contents'].height + 50);
    expect(toc.overflowY).toBe('auto');
    expect(toc.scrollHeight).toBeGreaterThan(toc.clientHeight);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
    await expect(page.locator('.desktop-sidebar .site-nav a')).toHaveCount(5);
    await expect(page.locator('.desktop-sidebar .profile-description')).toBeVisible();
    await visibleControls(page, viewport.height);
    await page.screenshot({
      path: `${dir}/after-${viewport.width}x${viewport.height}.png`,
      animations: 'disabled',
    });
    fs.writeFileSync(
      `${dir}/after-${viewport.width}.json`,
      JSON.stringify({ checkedAt: new Date().toISOString(), viewport, before, after }, null, 2) +
        '\n',
    );
    const bottomBefore = await page.locator('.desktop-sidebar .sidebar-bottom').boundingBox();
    await page.locator('.desktop-contents').evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await expect(page.locator('.desktop-contents .toc-link').last()).toBeInViewport();
    expect(await page.evaluate(() => scrollY)).toBe(0);
    expect(await page.locator('.desktop-sidebar .sidebar-bottom').boundingBox()).toEqual(
      bottomBefore,
    );
    const target = page.locator('.article .prose h2[id]').nth(3);
    const id = await target.getAttribute('id');
    await target.evaluate((el) =>
      window.scrollTo({
        top: el.getBoundingClientRect().top + scrollY - innerHeight * 0.25,
        behavior: 'instant',
      }),
    );
    await expect(page.locator('.desktop-contents .toc-link.active')).toHaveAttribute(
      'href',
      `#${id}`,
    );
    if (viewport.width === 1366) {
      await page.evaluate(() => {
        scrollTo({ top: 0, behavior: 'instant' });
        document.querySelector('.desktop-contents')!.scrollTop = 0;
      });
      await page.locator('.desktop-sidebar .mode-toggle').click();
      await page.locator('.desktop-sidebar .mode-toggle').click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
      await page.screenshot({ path: `${dir}/after-dark-1366x768.png`, animations: 'disabled' });
    }
  });
}
test('desktop home and phone/tablet geometry and typography are unchanged', async ({ page }) => {
  for (const c of baseline.measurements.filter((c: any) => !c.changed)) {
    await prepare(page, c.viewport, c.path);
    expect(await metrics(page), `${c.viewport.width} ${c.path}`).toEqual(c.metrics);
  }
});
test('TOC height responds to remaining space rather than chapter count', async ({ page }) => {
  const heights: number[] = [];
  for (const height of [900, 1080]) {
    await prepare(page, { width: 1440, height }, '/post/55b0541c/');
    const toc = page.locator('.desktop-contents');
    const initial = (await toc.boundingBox())!;
    heights.push(initial.height);
    await toc
      .locator('.toc')
      .evaluate((el) => el.replaceChildren(el.firstElementChild!.cloneNode(true)));
    expect((await toc.boundingBox())!.height).toBeCloseTo(initial.height);
    await toc.locator('.toc').evaluate((el) => {
      const first = el.firstElementChild!;
      for (let i = 0; i < 120; i++) el.append(first.cloneNode(true));
    });
    expect((await toc.boundingBox())!.height).toBeCloseTo(initial.height);
    const sidebar = await metrics(page);
    expect(sidebar['.desktop-sidebar'].scrollHeight).toBeLessThanOrEqual(height);
    await visibleControls(page, height);
  }
  expect(heights[1] - heights[0]).toBeCloseTo(180);
});
