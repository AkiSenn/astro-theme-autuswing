import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { evidenceDirectory } from '../../scripts/test-evidence.mjs';

const evidence = evidenceDirectory('appearance-controls');
fs.mkdirSync(evidence, { recursive: true });
const button = (page: Page) => page.locator('.mode-toggle:visible');

async function state(page: Page, mode: string, theme: string) {
  await expect(page.locator('html')).toHaveAttribute('data-mode', mode);
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  await expect(button(page)).toHaveAttribute('data-mode', mode);
  await expect(button(page)).toHaveAttribute('data-theme', theme);
  await expect(button(page)).toHaveAccessibleName(
    new RegExp(mode === 'auto' ? '跟随系统' : theme === 'dark' ? '夜间' : '日间'),
  );
  await expect
    .poll(() =>
      button(page)
        .locator('use')
        .evaluateAll((nodes) =>
          nodes
            .filter((node) => getComputedStyle(node).display !== 'none')
            .map((node) => node.getAttribute('href')),
        ),
    )
    .toEqual([`#i-${theme === 'dark' ? 'moon' : 'sun'}`]);
  expect(
    await page
      .locator('.mode-toggle')
      .evaluateAll((nodes) =>
        nodes.every(
          (node) =>
            node.getAttribute('aria-label') === node.getAttribute('title') &&
            node.getAttribute('data-mode') === document.documentElement.dataset.mode &&
            node.getAttribute('data-theme') === document.documentElement.dataset.theme,
        ),
      ),
  ).toBe(true);
}

for (const width of [1440, 820, 390]) {
  test(`appearance cycle history and layout ${width} @smoke`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
    await page.addInitScript(() => {
      if (!localStorage.getItem('autuswing-appearance'))
        localStorage.setItem('autuswing-appearance', 'dark');
    });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await state(page, 'dark', 'dark');
    const initial = await button(page).boundingBox();
    const samples = [];
    await button(page).focus();
    for (const [mode, theme] of [
      ['auto', 'light'],
      ['light', 'light'],
      ['dark', 'dark'],
    ]) {
      await page.keyboard.press('Enter');
      await state(page, mode, theme);
      expect(await button(page).boundingBox()).toEqual(initial);
      samples.push({ mode, theme, bounds: await button(page).boundingBox() });
    }
    await page.reload();
    await state(page, 'dark', 'dark');
    await page.locator('nav:visible a[href="/archives/"]').click();
    await expect(page).toHaveURL(/\/archives\/$/);
    await state(page, 'dark', 'dark');
    await button(page).click();
    await state(page, 'auto', 'light');
    await page.goBack();
    await state(page, 'auto', 'light');
    await page.goForward();
    await state(page, 'auto', 'light');
    await page.emulateMedia({ colorScheme: 'dark' });
    await state(page, 'auto', 'dark');
    await page.emulateMedia({ colorScheme: 'light' });
    await state(page, 'auto', 'light');
    await button(page).click();
    await state(page, 'light', 'light');
    await page.emulateMedia({ colorScheme: 'dark' });
    await state(page, 'light', 'light');
    await page.reload();
    await state(page, 'light', 'light');
    expect(errors).toEqual([]);
    fs.writeFileSync(
      path.join(evidence, `${width}.json`),
      JSON.stringify({ samples, errors }, null, 2),
      { flag: 'wx' },
    );
    await button(page).screenshot({ path: path.join(evidence, `${width}-light.png`) });
    await button(page).click();
    await state(page, 'dark', 'dark');
    await button(page).screenshot({ path: path.join(evidence, `${width}-dark.png`) });
  });
}

test('appearance correct before application script arrives @smoke', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.addInitScript(() => localStorage.setItem('autuswing-appearance', 'dark'));
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/_astro/*.js', async (route) => {
    await pending;
    await route.continue();
  });
  try {
    await page.goto('/', { waitUntil: 'commit' });
    await expect(button(page)).toBeVisible();
    await expect
      .poll(() =>
        button(page)
          .locator('use')
          .evaluateAll((nodes) =>
            nodes
              .filter((node) => getComputedStyle(node).display !== 'none')
              .map((node) => node.getAttribute('href')),
          ),
      )
      .toEqual(['#i-moon']);
    const before = await button(page).boundingBox();
    // 脚本挂起时记录实际计算样式和坐标；部分引擎的截图等待依赖加载完成。
    expect(before).not.toBeNull();
    fs.writeFileSync(
      path.join(evidence, 'before-script-dark.json'),
      JSON.stringify(
        {
          bounds: before,
          icons: await button(page)
            .locator('use')
            .evaluateAll((nodes) =>
              nodes.map((node) => ({
                href: node.getAttribute('href'),
                display: getComputedStyle(node).display,
              })),
            ),
        },
        null,
        2,
      ),
      { flag: 'wx' },
    );
    release();
    await page.waitForLoadState();
    await state(page, 'dark', 'dark');
    expect(await button(page).boundingBox()).toEqual(before);
    await button(page).screenshot({ path: path.join(evidence, 'after-script-dark.png') });
  } finally {
    release();
  }
});

test('appearance legacy preference, old media API and cross-tab sync @smoke', async ({
  page,
  context,
}) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await context.addInitScript(() => {
    if (!localStorage.getItem('autuswing-appearance'))
      localStorage.setItem('sunna-appearance', 'dark');
    const original = window.matchMedia.bind(window);
    window.matchMedia = (query) => {
      const result = original(query);
      if (query === '(prefers-color-scheme: dark)') {
        Object.defineProperty(result, 'addEventListener', { value: undefined });
        Object.defineProperty(result, 'removeEventListener', { value: undefined });
      }
      return result;
    };
  });
  await page.goto('/');
  await state(page, 'dark', 'dark');
  expect(await page.evaluate(() => localStorage.getItem('autuswing-appearance'))).toBe('dark');
  await button(page).click();
  await state(page, 'auto', 'light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await state(page, 'auto', 'dark');
  const second = await context.newPage();
  await second.goto('/');
  await second.evaluate(() => localStorage.setItem('autuswing-appearance', 'light'));
  await state(page, 'light', 'light');
  await second.close();
});
