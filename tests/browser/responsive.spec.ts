import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
const evidenceDir = process.env.VISUAL_EVIDENCE_DIR || 'docs/evidence/phase3';

const widths = [320, 375, 390, 430, 719, 720, 768, 820, 999, 1000, 1024, 1280, 1600];
const pages = [
  '/',
  '/post/55b0541c/',
  '/post/4e395565/',
  '/archives/',
  '/tags/',
  '/tags/MathJax/',
  '/links/',
  '/about/',
];
const activeShell = (width: number) =>
  width < 720 ? '.mobile-header' : width < 1000 ? '.tablet-sidebar' : '.desktop-sidebar';

test('page matrix preserves one visible shell, direct navigation and comfortable single-column text', async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const measurements: object[] = [];
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of pages) {
      await page.goto(path);
      const shell = page.locator(activeShell(width));
      await expect(shell).toBeVisible();
      await expect(
        page.locator('.desktop-sidebar:visible,.tablet-sidebar:visible,.mobile-header:visible'),
      ).toHaveCount(1);
      await expect(shell.locator('nav a[href="/archives/"]')).toBeVisible();
      await expect(shell.locator('.search-open')).toBeVisible();
      await expect(shell.locator('.mode-toggle')).toBeVisible();
      if (path.startsWith('/tags/'))
        await expect(shell.locator('nav a[href="/tags/"]')).toHaveAttribute('aria-current', 'page');
      const metrics = await page.evaluate(() => {
        const prose = document.querySelector<HTMLElement>('.article .prose');
        const cards = [...document.querySelectorAll('.post-card')];
        return {
          document: document.documentElement.clientWidth,
          usable: document.documentElement.getBoundingClientRect().width,
          scroll: document.documentElement.scrollWidth,
          prose: prose?.getBoundingClientRect().width || null,
          columns:
            cards.length > 1 &&
            Math.abs(cards[0].getBoundingClientRect().top - cards[1].getBoundingClientRect().top) <
              2
              ? 2
              : 1,
          duplicateIds: [...document.querySelectorAll('[id]')]
            .map((n) => n.id)
            .filter((id, i, all) => all.indexOf(id) !== i),
          wrappedDates: [...document.querySelectorAll('.card-date span,.card-date small')].filter(
            (node) =>
              node.getBoundingClientRect().height >
              parseFloat(getComputedStyle(node).lineHeight) + 1,
          ).length,
        };
      });
      expect(metrics.scroll, `${width} ${path}`).toBeLessThanOrEqual(metrics.document + 1);
      expect(metrics.duplicateIds).toEqual([]);
      expect(metrics.wrappedDates, `${width} ${path}: dates must not wrap`).toBe(0);
      if (metrics.prose) {
        expect(metrics.prose).toBeLessThanOrEqual(width >= 1000 ? 755 : 705);
        if (width < 720) expect(metrics.usable - metrics.prose).toBeLessThanOrEqual(33);
        if (width >= 1000) expect(metrics.prose).toBeGreaterThan(580);
      }
      if (path === '/' && width === 768) expect(metrics.columns).toBe(1);
      if (path === '/' && width === 820) expect(metrics.columns).toBe(2);
      measurements.push({ width, path, ...metrics });
      if (path === '/' && ![719, 720, 999, 1000].includes(width)) {
        await page.screenshot({
          path: `${evidenceDir}/home-${width}.png`,
          fullPage: true,
          animations: 'disabled',
        });
      }
      if (path === '/post/4e395565/' && [390, 768, 820, 1280].includes(width)) {
        await expect(page.locator('.katex')).toHaveCount(4);
        await page.screenshot({
          path: `${evidenceDir}/math-${width}.png`,
          fullPage: true,
          animations: 'disabled',
        });
      }
    }
  }
  expect(errors).toEqual([]);
  fs.writeFileSync(
    `${evidenceDir}/layout-check.json`,
    JSON.stringify(
      { checkedAt: new Date().toISOString(), cases: measurements.length, measurements },
      null,
      2,
    ) + '\n',
  );
});

test('tablet and mobile navigation, search and appearance are direct and keyboard accessible', async ({
  page,
}) => {
  for (const width of [320, 390, 720, 768, 820, 999]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const shell = page.locator(activeShell(width));
    for (const href of ['/', '/archives/', '/tags/', '/links/', '/about/']) {
      const link = shell.locator(`nav a[href="${href}"]`);
      await expect(link).toHaveAccessibleName(/.+/);
      const box = await link.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.width).toBeGreaterThanOrEqual(44);
    }
    const tags = shell.locator('nav a[href="/tags/"]');
    await tags.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/tags\/$/);
    await expect(shell.locator('nav a[href="/tags/"]')).toHaveAttribute('aria-current', 'page');
    await shell.locator('.search-open').click();
    await expect(page.locator('#search-input')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(shell.locator('.search-open')).toBeFocused();
    await shell.locator('.mode-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('data-mode', /light|dark|auto/);
  }
});

test('compact contents is independent, modal, dismissible and navigates to unobscured headings', async ({
  page,
}) => {
  for (const width of [320, 390, 768, 820]) {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/post/4e395565/');
    const trigger = page.locator('.contents-access .contents-open');
    const dialog = page.locator('#reading-contents');
    await trigger.click();
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.contents-close')).toBeFocused();
    expect(
      await page.evaluate(() => document.querySelector('#reading-contents')!.matches(':modal')),
    ).toBe(true);
    await page.keyboard.press('Shift+Tab');
    expect(
      await page.evaluate(() =>
        document.querySelector('#reading-contents')!.contains(document.activeElement),
      ),
    ).toBe(true);
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await trigger.click();
    // The upper-left corner is outside the sheet/centered dialog.
    await page.mouse.click(2, 2);
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
    await trigger.click();
    await dialog.locator('.toc-link').last().click();
    await expect(dialog).not.toBeVisible();
    const position = await page.evaluate(() => ({
      top: document.activeElement?.getBoundingClientRect().top || 0,
      header: document.querySelector('.mobile-header')?.getBoundingClientRect().bottom || 0,
      id: document.activeElement?.id,
      hash: decodeURIComponent(location.hash.slice(1)),
    }));
    expect(position.id).toBe(position.hash);
    expect(position.top).toBeGreaterThanOrEqual(position.header - 1);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).not.toBe(
      'hidden',
    );
  }
});

test('rotation closes contents, releases native inertness and restores focus across shells', async ({
  page,
}) => {
  for (const [from, fromHeight, to, toHeight] of [
    [768, 1024, 1024, 768],
    [820, 1180, 1180, 820],
    [390, 844, 820, 1180],
    [999, 900, 1000, 900],
    [719, 900, 720, 900],
  ]) {
    await page.setViewportSize({ width: from, height: fromHeight });
    await page.goto('/post/4e395565/');
    await page.locator('.contents-access .contents-open').click();
    await page.setViewportSize({ width: to, height: toHeight });
    await expect(page.locator('#reading-contents')).not.toBeVisible();
    await expect(page.locator(activeShell(to))).toBeVisible();
    expect(await page.evaluate(() => !!document.activeElement?.getClientRects().length)).toBe(true);
    expect(await page.evaluate(() => document.querySelectorAll('[inert]').length)).toBe(0);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).not.toBe(
      'hidden',
    );
    await page.locator('.search-open:visible').click();
    await page.setViewportSize({ width: from, height: fromHeight });
    await page.keyboard.press('Escape');
    await expect(page.locator('.search-open:visible')).toBeFocused();
  }
});

test('contents, search and image preview never stack modal surfaces', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/post/55b0541c/');
  await page.locator('.contents-access .contents-open').click();
  await page.keyboard.press('Control+k');
  await expect(page.locator('#site-search')).toBeVisible();
  await expect(page.locator('#reading-contents')).not.toBeVisible();
  await expect(page.locator('dialog[open]')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.locator('.search-open:visible')).toBeFocused();
  const image = page.locator('.prose img').first();
  await image.scrollIntoViewIfNeeded();
  await image.click();
  await expect(page.locator('.image-dialog')).toBeVisible();
  await page.keyboard.press('Control+k');
  await expect(page.locator('#site-search')).toBeVisible();
  await expect(page.locator('.image-dialog')).not.toBeVisible();
  await expect(page.locator('dialog[open]')).toHaveCount(1);
});

test('all three layouts retain navigation and native contents without JavaScript', async ({
  browser,
}) => {
  for (const width of [320, 768, 1280]) {
    const context = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width, height: 900 },
    });
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4322/post/4e395565/');
    await expect(page.locator(`${activeShell(width)} nav a[href="/archives/"]`)).toBeVisible();
    if (width < 1000) {
      await page.locator('.contents-fallback summary').click();
      await expect(page.locator('.contents-fallback .toc-link').first()).toBeVisible();
      await page.locator('.contents-fallback .toc-link').last().click();
      expect(new URL(page.url()).hash).not.toBe('');
    } else {
      await expect(page.locator('.desktop-contents .toc-link').first()).toBeVisible();
    }
    await context.close();
  }
});

test('light/dark layouts pass basic axe and long titles, menus and contents remain contained', async ({
  page,
}) => {
  test.setTimeout(120000);
  const checks: object[] = [];
  for (const width of [390, 820, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const mode of ['light', 'dark']) {
      await page.goto('/post/4e395565/');
      await page.evaluate((mode) => {
        localStorage.setItem('autuswing-appearance', mode);
      }, mode);
      await page.reload();
      const result = await new AxeBuilder({ page }).analyze();
      const failures = result.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious',
      );
      expect(failures.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }))).toEqual([]);
      let modalCriticalOrSerious: number | null = null;
      if (width < 1000) {
        await page.locator('.contents-access .contents-open').click();
        const modalResult = await new AxeBuilder({ page }).analyze();
        const modalFailures = modalResult.violations.filter(
          (v) => v.impact === 'critical' || v.impact === 'serious',
        );
        modalCriticalOrSerious = modalFailures.length;
        expect(modalFailures).toEqual([]);
      }
      await page.screenshot({
        path: `${evidenceDir}/${mode}-${width}.png`,
        fullPage: true,
        animations: 'disabled',
      });
      checks.push({ width, mode, criticalOrSerious: failures.length, modalCriticalOrSerious });
    }
  }
  fs.writeFileSync(
    `${evidenceDir}/accessibility-check.json`,
    JSON.stringify({ checkedAt: new Date().toISOString(), checks }, null, 2) + '\n',
  );
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/post/4e395565/');
  await page.evaluate(() => {
    document.querySelector('h1')!.textContent = '非常长的标题 LongUnbrokenArticleTitle'.repeat(8);
    document.querySelector('.mobile-navigation a')!.textContent = 'VeryLongNavigationLabel没有空格';
    const toc = document.querySelector('.contents-dialog .toc')!;
    for (let i = 0; i < 50; i++) toc.append(toc.children[0].cloneNode(true));
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    ),
  ).toBe(true);
  await page.locator('.contents-access .contents-open').click();
  const last = page.locator('.contents-dialog .toc-link').last();
  await last.scrollIntoViewIfNeeded();
  await expect(last).toBeVisible();
  expect(
    await page
      .locator('.contents-dialog')
      .evaluate((node) => node.scrollHeight > node.clientHeight),
  ).toBe(true);
});

test('short tablet/desktop heights keep navigation and tools reachable and full-content cards stay single-column', async ({
  page,
}) => {
  for (const width of [820, 1024]) {
    await page.setViewportSize({ width, height: 480 });
    await page.goto('/post/4e395565/');
    const tools = page.locator(`${activeShell(width)} .mode-toggle`);
    await tools.scrollIntoViewIfNeeded();
    const box = await tools.boundingBox();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(481);
    await tools.click();
  }
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto('/');
  await page
    .locator('.card-body')
    .first()
    .evaluate((node) => {
      const prose = document.createElement('div');
      prose.className = 'prose';
      const paragraph = document.createElement('p');
      paragraph.textContent = 'Full content mode uses the reading font in one column.';
      prose.append(paragraph);
      node.append(prose);
    });
  const tops = await page
    .locator('.post-card')
    .evaluateAll((cards) => cards.slice(0, 2).map((c) => c.getBoundingClientRect().top));
  expect(tops[1]).toBeGreaterThan(tops[0] + 40);
  const fonts = await page.locator('.post-card .prose').evaluate((node) => ({
    parent: getComputedStyle(node).fontSize,
    paragraph: getComputedStyle(node.querySelector('p')!).fontSize,
  }));
  expect(fonts.paragraph).toBe(fonts.parent);
});

test('touch navigation and contents work in phone/tablet browser contexts', async ({ browser }) => {
  for (const width of [390, 820]) {
    const context = await browser.newContext({
      hasTouch: true,
      isMobile: true,
      viewport: { width, height: 1180 },
    });
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4322/');
    await page.locator(`${activeShell(width)} nav a[href="/archives/"]`).tap();
    await expect(page).toHaveURL(/\/archives\/$/);
    await page.goto('http://127.0.0.1:4322/post/4e395565/');
    await page.locator('.contents-access .contents-open').tap();
    await expect(page.locator('#reading-contents')).toBeVisible();
    await page.locator('#reading-contents .toc-link').last().tap();
    await expect(page.locator('#reading-contents')).not.toBeVisible();
    expect(new URL(page.url()).hash).not.toBe('');
    await context.close();
  }
});

test('direct historical heading URLs and doubled reading/navigation font sizes stay usable', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/post/4e395565/#公式配置');
    await expect(page.locator('.katex')).toHaveCount(4);
    const position = await page.locator('.prose #公式配置').evaluate((node) => ({
      top: node.getBoundingClientRect().top,
      header: document.querySelector('.mobile-header')!.getBoundingClientRect().bottom,
    }));
    expect(position.top).toBeGreaterThanOrEqual(position.header - 1);
  }
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/post/4e395565/');
  // Stress fixed-size text and dynamic sticky-header offsets; this is not a
  // substitute for browser-chrome zoom or a real device accessibility setting.
  await page.addStyleTag({
    content:
      '.prose{font-size:32px!important}.mobile-navigation a{font-size:26px!important}.mobile-brand-row .mobile-brand{font-size:28px!important}',
  });
  await page.locator('.contents-access .contents-open').click();
  await page.locator('#reading-contents .toc-link').last().click();
  const size = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
    top: document.activeElement!.getBoundingClientRect().top,
    header: document.querySelector('.mobile-header')!.getBoundingClientRect().bottom,
  }));
  expect(size.scroll).toBeLessThanOrEqual(size.client + 1);
  expect(size.top).toBeGreaterThanOrEqual(size.header - 1);
});
