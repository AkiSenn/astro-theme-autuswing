import { test, expect } from '@playwright/test';
import { legacySafariComponents } from '../support/legacy-safari';

test.beforeEach(async ({ context, page }) => {
  await legacySafariComponents(context);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
});

test('missing dialog APIs leave closed overlays hidden and home gutters/cards contained', async ({
  page,
}) => {
  for (const width of [320, 390, 430, 768, 820, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    await expect(page.locator('dialog:visible')).toHaveCount(0);
    expect(
      await page
        .locator('dialog')
        .first()
        .evaluate((node) => typeof (node as HTMLDialogElement).showModal),
    ).toBe('undefined');
    const metrics = await page.evaluate(() => {
      const shell = getComputedStyle(document.querySelector('.main-shell')!);
      const cards = [...document.querySelectorAll('.post-card')].map((n) =>
        n.getBoundingClientRect(),
      );
      return {
        left: parseFloat(shell.paddingLeft),
        right: parseFloat(shell.paddingRight),
        cardLeft: cards[0].left,
        cardRight: cards[0].right,
        gap: cards[1].top - cards[0].bottom,
        gapRule: getComputedStyle(document.querySelector('.post-list')!).gap,
        display: getComputedStyle(document.querySelector('.post-list')!).display,
        client: document.documentElement.clientWidth,
        scroll: document.documentElement.scrollWidth,
      };
    });
    expect(metrics.scroll).toBeLessThanOrEqual(metrics.client + 1);
    if (width < 720) {
      expect(metrics.left).toBe(16);
      expect(metrics.right).toBe(16);
      expect(metrics.cardLeft).toBeGreaterThanOrEqual(16);
      expect(metrics.client - metrics.cardRight).toBeGreaterThanOrEqual(16);
    }
    expect(metrics.gapRule).toBe('20px');
    expect(metrics.display).toBe('grid');
    expect(metrics.gap).toBeGreaterThan(0);
  }
});

test('search fallback traps focus, blocks background interaction and restores scroll on all dismissal paths', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.evaluate(() => {
    document.body.style.setProperty('--author-test-token', 'preserve');
    scrollTo(0, 400);
  });
  const before = await page.evaluate(() => ({
    y: scrollY,
    style: document.body.getAttribute('style'),
  }));
  for (const method of ['button', 'escape', 'backdrop']) {
    // Locator.click scrolls this sticky header back to its original document
    // position in Chromium. A coordinate click models the visible user tap.
    const opener = await page.locator('.search-open:visible').boundingBox();
    await page.mouse.click(opener!.x + opener!.width / 2, opener!.y + opener!.height / 2);
    const dialog = page.locator('#site-search');
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await expect(dialog).toHaveAttribute('role', 'dialog');
    await expect(page.locator('#search-input')).toBeFocused();
    await expect(page.locator('body')).toHaveCSS('position', 'fixed');
    await expect(page.locator('body')).toHaveCSS('top', `-${before.y}px`);
    await expect(page.locator('.main-shell')).toHaveAttribute('aria-hidden', 'true');
    await page.locator('.search-close').focus();
    await page.keyboard.press('Shift+Tab');
    await expect(page.locator('#search-input')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('.search-close')).toBeFocused();
    await page.evaluate(() => document.querySelector<HTMLElement>('.mobile-brand')?.focus());
    expect(await dialog.evaluate((n) => n.contains(document.activeElement))).toBe(true);
    if (method === 'button') await page.locator('.search-close').click();
    if (method === 'escape') await page.keyboard.press('Escape');
    if (method === 'backdrop') await page.mouse.click(2, 2);
    await expect(dialog).not.toBeVisible();
    await expect(page.locator('.legacy-dialog-host')).toHaveCount(0);
    await expect(page.locator('.search-open:visible')).toBeFocused();
    expect(
      await page.evaluate(() => ({ y: scrollY, style: document.body.getAttribute('style') })),
    ).toEqual(before);
    expect(await page.locator('.main-shell').getAttribute('aria-hidden')).toBeNull();
  }
  expect(errors).toEqual([]);
});

test('contents fallback is a viewport sheet, navigates headings, and rotates without stale locks', async ({
  page,
}) => {
  await page.goto('/post/55b0541c/');
  await page.evaluate(() => scrollTo(0, 900));
  const before = await page.evaluate(() => scrollY);
  const trigger = page.locator('.contents-open:visible,.goto-toc:visible');
  await trigger.click();
  const dialog = page.locator('#reading-contents');
  await expect(dialog).toBeVisible();
  await expect(page.locator('.contents-close')).toBeFocused();
  let box = await dialog.boundingBox();
  expect(box!.x).toBe(0);
  expect(box!.width).toBe(390);
  expect(box!.y).toBeGreaterThanOrEqual(844 * 0.25 - 1);
  expect(box!.y + box!.height).toBeLessThanOrEqual(845);
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.locator('.toc-link').last()).toBeFocused();
  const focused = await dialog.locator('.toc-link').last().boundingBox();
  expect(focused!.y).toBeGreaterThanOrEqual(box!.y);
  expect(focused!.y + focused!.height).toBeLessThanOrEqual(845);
  await page.keyboard.press('Tab');
  await expect(page.locator('.contents-close')).toBeFocused();
  await page.locator('.contents-close').click();
  await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => scrollY)).toBe(before);
  await trigger.click();
  await dialog.locator('.toc-link').nth(5).click();
  await expect(dialog).not.toBeVisible();
  const heading = await page.evaluate(() => ({
    id: document.activeElement?.id,
    hash: decodeURIComponent(location.hash.slice(1)),
    top: document.activeElement!.getBoundingClientRect().top,
    header: document.querySelector('.mobile-header')!.getBoundingClientRect().bottom,
  }));
  expect(heading.id).toBe(heading.hash);
  expect(heading.hash).not.toBe('');
  expect(heading.top).toBeGreaterThanOrEqual(heading.header - 1);
  await trigger.click();
  await page.setViewportSize({ width: 430, height: 500 });
  box = await dialog.boundingBox();
  expect(box!.y + box!.height).toBeLessThanOrEqual(501);
  await page.setViewportSize({ width: 820, height: 600 });
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('.legacy-dialog-host')).toHaveCount(0);
  expect(await page.locator('body').getAttribute('style')).toBeNull();
});

test('replacement, keyboard search navigation, and image preview share one fallback modal', async ({
  page,
}) => {
  await page.goto('/post/55b0541c/');
  await page.locator('.contents-open:visible,.goto-toc:visible').click();
  await page.keyboard.press('Control+k');
  await expect(page.locator('#site-search')).toBeVisible();
  await expect(page.locator('#reading-contents')).not.toBeVisible();
  await expect(page.locator('.legacy-dialog-host')).toHaveCount(1);
  await page.locator('#search-input').fill('网站笔记');
  await expect(page.locator('.search-results a')).toHaveCount(1);
  await page.keyboard.press('ArrowDown');
  await Promise.all([page.waitForURL('**/post/4c6caf67/'), page.keyboard.press('Enter')]);
  await expect(page.locator('body')).not.toHaveCSS('position', 'fixed');
  await page.goto('/post/55b0541c/');
  const image = page.locator('.prose img').first();
  await image.scrollIntoViewIfNeeded();
  await image.click();
  await expect(page.locator('.image-dialog')).toBeVisible();
  await page.locator('.image-close').click();
  await expect(image).toBeFocused();
  await expect(page.locator('.legacy-dialog-host')).toHaveCount(0);
});

test('long code is horizontally scrollable without clipping its text or widening the document', async ({
  page,
}) => {
  await page.goto('/post/55b0541c/');
  const results = await page.locator('.code-block pre').evaluateAll((nodes) =>
    nodes
      .filter((n) => n.scrollWidth > n.clientWidth + 2)
      .map((node) => {
        const text = node.textContent;
        node.scrollLeft = node.scrollWidth;
        return {
          scroll: node.scrollLeft,
          max: node.scrollWidth - node.clientWidth,
          overflow: getComputedStyle(node).overflowX,
          intact: text === node.textContent,
        };
      }),
  );
  expect(results.length).toBeGreaterThan(0);
  for (const result of results) {
    expect(result.overflow).toBe('auto');
    expect(result.scroll).toBeGreaterThan(0);
    expect(Math.abs(result.scroll - result.max)).toBeLessThanOrEqual(1);
    expect(result.intact).toBe(true);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    ),
  ).toBe(true);
});
