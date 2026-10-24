import { test, expect, type Page } from '@playwright/test';

const article = '/post/55b0541c/';

async function scroll(page: Page, y: number) {
  await page.evaluate((top) => {
    document.documentElement.style.scrollBehavior = 'auto';
    window.scrollTo(0, top);
  }, y);
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(y);
  // reading.ts 在下一帧同步 hidden，测量应晚于该帧，而非用延长等待掩盖位移。
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
}

async function geometry(page: Page) {
  return page.evaluate(() => {
    const toc = document.querySelector<HTMLElement>('.goto-toc')!;
    const back = document.querySelector<HTMLElement>('.back-top')!;
    const box = toc.getBoundingClientRect();
    const main = document.querySelector('#main')!.getBoundingClientRect();
    const tools = getComputedStyle(document.querySelector('.floating-tools')!);
    const button = getComputedStyle(toc);
    // stable scrollbar gutter 会使固定定位视口小于 clientWidth；用独立参照测量实际边界。
    const viewport = document.createElement('div');
    viewport.style.cssText = 'position:fixed;inset:0;visibility:hidden;pointer-events:none';
    document.body.append(viewport);
    const viewportWidth = viewport.getBoundingClientRect().width;
    viewport.remove();
    return {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      mainX: main.x,
      mainWidth: main.width,
      backHidden: back.hidden,
      scroll: scrollY,
      right: tools.right,
      bottom: tools.bottom,
      color: button.color,
      background: button.backgroundColor,
      border: button.border,
      overflow: document.documentElement.scrollWidth > innerWidth,
      viewportWidth,
    };
  });
}

async function ready(page: Page, width: number) {
  await page.setViewportSize({ width, height: 844 });
  await page.goto(article);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => {})),
    );
  });
  await expect(page.locator('.goto-toc')).toBeVisible();
  await scroll(page, 0);
}

for (const width of [320, 375, 390]) {
  test(`${width}px: TOC remains fixed across the 250px threshold in both themes`, async ({
    page,
  }, info) => {
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await ready(page, width);
      const initial = await geometry(page);
      const observations = [];
      for (const y of [0, 249, 250, 251, 600, 249, 0]) {
        await scroll(page, y);
        const current = await geometry(page);
        observations.push(current);
        // 先保存测量，旧版失败时也保留真实的 52px 差异。
        await info.attach(`${scheme}-${y}-geometry`, {
          body: JSON.stringify({ initial, current }),
          contentType: 'application/json',
        });
        if (width === 390 && scheme === 'light' && (y === 0 || y === 600))
          await info.attach(`tools-${y}`, {
            body: await page.screenshot(),
            contentType: 'image/png',
          });
        expect(current.x).toBe(initial.x);
        expect(current.y).toBe(initial.y);
        expect([current.width, current.height]).toEqual([44, 44]);
        expect([current.mainX, current.mainWidth]).toEqual([initial.mainX, initial.mainWidth]);
        expect([current.color, current.background, current.border]).toEqual([
          initial.color,
          initial.background,
          initial.border,
        ]);
        expect(current.backHidden).toBe(y < 250);
        expect(current.overflow).toBe(false);
        if (y < 250) {
          await page.locator('.goto-toc').focus();
          await page.locator('.back-top').evaluate((node) => (node as HTMLElement).focus());
          await expect(page.locator('.goto-toc')).toBeFocused();
          await expect(page.locator('.back-top')).not.toBeVisible();
        }
      }
      await info.attach(`${scheme}-all-positions`, {
        body: JSON.stringify(observations),
        contentType: 'application/json',
      });
      await scroll(page, 600);
      await page.locator('.goto-toc').focus();
      await page.keyboard.press('Tab');
      await expect(page.locator('.back-top')).toBeFocused();
      await page.keyboard.press('Enter');
      await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
      await expect(page.locator('.back-top')).not.toBeVisible();
    }
  });
}

for (const legacy of [false, true]) {
  test(`modal, focus and edge insets remain usable (${legacy ? 'legacy dialog capability model' : 'native dialog'})`, async ({
    page,
  }, info) => {
    if (legacy)
      await page.addInitScript(() => {
        Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
          configurable: true,
          value: undefined,
        });
      });
    await ready(page, 390);
    await scroll(page, 600);
    const initial = await geometry(page);
    const toc = page.locator('.goto-toc');
    const dialog = page.locator('.contents-dialog');
    await toc.focus();
    await page.keyboard.press('Enter');
    await expect(dialog).toBeVisible();
    await expect(toc).not.toBeVisible();
    const exposed = await page.locator('.back-top').evaluate((node) => {
      const box = node.getBoundingClientRect();
      const target = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
      return target === node || (!!target && node.contains(target));
    });
    expect(exposed).toBe(false);
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(toc).toBeFocused();
    expect((await geometry(page)).scroll).toBe(600);
    expect((await geometry(page)).x).toBe(initial.x);
    for (let n = 0; n < 3; n++) {
      await toc.click();
      await page.locator('.contents-close').click();
      await expect(dialog).not.toBeVisible();
      await expect(toc).toBeFocused();
    }
    // 合成边距模型只验证更大的安全区预留；不冒充真实 iOS safe-area 环境。
    await page.addStyleTag({
      content: '.floating-tools { right: max(12px, 28px); bottom: max(16px, 34px); }',
    });
    await scroll(page, 0);
    const insetStart = await geometry(page);
    await scroll(page, 600);
    const insetEnd = await geometry(page);
    expect(insetEnd.x).toBe(insetStart.x);
    expect(insetEnd.y).toBe(insetStart.y);
    expect(insetEnd.right).toBe('28px');
    expect(insetEnd.bottom).toBe('34px');
    expect(insetEnd.x + insetEnd.width).toBe(insetEnd.viewportWidth - 28);
    expect(insetEnd.y + insetEnd.height).toBe(844 - 34);
    await info.attach('modal-and-inset-model', {
      body: JSON.stringify({ initial, insetStart, insetEnd, legacy }),
      contentType: 'application/json',
    });
  });
}

test('desktop retains its original vertical tools and article geometry', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(article);
  const main = await page.locator('#main').boundingBox();
  await scroll(page, 600);
  await expect(page.locator('.back-top')).toBeVisible();
  expect(
    await page.locator('.floating-tools').evaluate((node) => getComputedStyle(node).flexDirection),
  ).toBe('column');
  expect(await page.locator('.back-top').evaluate((node) => getComputedStyle(node).order)).toBe(
    '0',
  );
  const after = await page.locator('#main').boundingBox();
  expect([after!.x, after!.width]).toEqual([main!.x, main!.width]);
});
