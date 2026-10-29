import { test, expect, type Page } from '@playwright/test';
import { load } from 'cheerio';

const article = '/post/55b0541c/';

async function ready(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

test.use({ reducedMotion: 'reduce' });

for (const width of [320, 375, 390, 430]) {
  test(`mobile article metadata and navigation at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(article);
    await ready(page);
    const header = page.locator('.article-header');
    await expect(header.locator('h1')).toBeVisible();
    await expect(header.locator('.post-meta > time')).toBeVisible();
    await expect(header.locator('.post-meta > :visible')).toHaveCount(3);
    await expect(header.locator('.article-meta-mobile-updated')).toBeVisible();
    await expect(header.locator('.article-meta-mobile-updated')).toHaveText('更新于 2026.10.05');
    for (const el of await header.locator('.article-meta-secondary, .card-tags').all()) {
      await expect(el).toBeHidden();
    }
    const details = page.locator('.article-mobile-details');
    await expect(details).toBeVisible();
    const topTags = await header
      .locator('.card-tags a')
      .evaluateAll((els) =>
        els.map((el) => ({ text: el.textContent, href: el.getAttribute('href') })),
      );
    expect(
      await details
        .locator('.card-tags a')
        .evaluateAll((els) =>
          els.map((el) => ({ text: el.textContent, href: el.getAttribute('href') })),
        ),
    ).toEqual(topTags);
    await expect(details.locator('.post-meta')).toContainText('字');
    await expect(details.locator('time')).toHaveCount(0);
    await expect(page.locator('.copyright-details time').last()).toBeVisible();
    await expect(page.locator('.article h1')).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(
      await page
        .locator('.article .prose')
        .evaluate((el) => Number.parseFloat(getComputedStyle(el.firstElementChild!).marginTop)),
    ).toBe(0);
    expect(
      await header
        .locator('.card-tags a')
        .first()
        .evaluate((el) => {
          (el as HTMLElement).focus();
          return document.activeElement === el;
        }),
    ).toBe(false);
    await expect(page.locator('.mobile-navigation a[href="/"]')).toBeVisible();
    await expect(page.locator('.mobile-navigation a[href="/archives/"]')).toBeVisible();
    await page.evaluate(() => scrollTo(0, 0));
    const button = page.locator('.goto-toc');
    await button.click();
    const dialog = page.locator('.contents-dialog');
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(button).toBeFocused();
    await button.click();
    const link = dialog.locator('.toc-link').nth(1);
    const id = (await link.getAttribute('href'))!.slice(1);
    await link.click();
    await expect(dialog).toBeHidden();
    await expect(page.locator('[id="' + id + '"]')).toBeInViewport();
    const position = await page.evaluate(
      (target) => ({
        top: document.getElementById(target)!.getBoundingClientRect().top,
        navigationBottom: document.querySelector('.mobile-header')!.getBoundingClientRect().bottom,
      }),
      id,
    );
    expect(position.top).toBeGreaterThanOrEqual(position.navigationBottom - 1);
  });
}

for (const width of [768, 1024, 1440]) {
  test(`tablet and desktop retain header metadata at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1024 });
    await page.goto(article);
    await ready(page);
    await expect(page.locator('.article-mobile-details')).toBeHidden();
    await expect(page.locator('.article-header .card-tags')).toBeVisible();
    for (const el of await page.locator('.article-header .article-meta-secondary').all()) {
      await expect(el).toBeVisible();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

test('long title and many taxonomy links keep mobile text in bounds', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 667 });
  await page.route('**' + article, async (route) => {
    const response = await route.fetch();
    const $ = load(await response.text());
    $('.article-header h1').text(
      '中文长文章的构建与发布：代码排版、跨浏览器阅读体验和静态博客维护实践',
    );
    $('.article-header .card-tags, .article-mobile-details .card-tags').each((_, el) => {
      for (let n = 0; n < 12; n++) {
        $(el).append(
          $('<a>')
            .attr('href', '/tags/qa-' + n + '/')
            .text('#长标签测试' + n),
        );
      }
    });
    await route.fulfill({ response, body: $.html() });
  });
  await page.goto(article);
  await ready(page);
  const title = page.locator('.article-header h1'),
    meta = page.locator('.article-header .post-meta');
  const titleBox = (await title.boundingBox())!,
    metaBox = (await meta.boundingBox())!;
  expect(titleBox.y + titleBox.height).toBeLessThanOrEqual(metaBox.y);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const details = page.locator('.article-mobile-details');
  await details.scrollIntoViewIfNeeded();
  await expect(details.locator('a').last()).toBeVisible();
  await details.locator('a').last().focus();
  await expect(details.locator('a').last()).toBeFocused();
});

test('browser history restores the article and scroll position', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(article);
  await ready(page);
  await page.evaluate(() => scrollTo(0, 1000));
  const archives = page.locator('.mobile-navigation a[href="/archives/"]');
  // 自动化点击会先滚动定位链接，在实际 click 时取样才能验证原生历史恢复。
  let departure: number | undefined;
  page.on('console', (message) => {
    if (message.text().startsWith('qa-departure:')) {
      departure = Number(message.text().slice('qa-departure:'.length));
    }
  });
  await archives.evaluate((el) => {
    el.addEventListener('click', () => console.debug('qa-departure:' + scrollY), { once: true });
  });
  await archives.click();
  await expect(page).toHaveURL(/\/archives\/$/);
  expect(departure).toBeDefined();
  const before = departure!;
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(article + '$'));
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThanOrEqual(before - 1);
  expect(await page.evaluate(() => scrollY)).toBeLessThanOrEqual(before + 1);
  await page.goForward();
  await expect(page).toHaveURL(/\/archives\/$/);
});

test('direct hash remains readable with normal motion enabled', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(article);
  const hash = (await page.locator('.contents-dialog .toc-link').nth(1).getAttribute('href'))!;
  await page.goto(article + hash);
  await ready(page);
  await expect(page.locator('[id="' + hash.slice(1) + '"]')).toBeInViewport();
  expect(
    await page.evaluate(
      (id) =>
        document.getElementById(id)!.getBoundingClientRect().top -
        document.querySelector('.mobile-header')!.getBoundingClientRect().bottom,
      hash.slice(1),
    ),
  ).toBeGreaterThanOrEqual(-1);
  await expect(page.locator('.article')).toBeVisible();
});
