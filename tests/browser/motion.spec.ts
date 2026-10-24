import { test, expect, type Page } from '@playwright/test';
import { load } from 'cheerio';
import fs from 'node:fs';
import { activeLayoutMetrics } from './layout-metrics';
import { layoutReference } from '../support/layout-reference';
import { referencePage } from '../support/reference-page';
import { inspectTransitionMode, assertUnanimatedNavigation } from '../support/transition-contract';

import { evidenceDirectory } from '../../scripts/test-evidence.mjs';
const dir = evidenceDirectory('motion');
fs.mkdirSync(dir, { recursive: true });
const article = '/post/55b0541c/';
const actions =
  '.contents-open:visible,.goto-toc:visible,.reading-contents-close:visible,.contents-close:visible';

async function observe(page: Page) {
  const events: any[] = [];
  await page.exposeFunction('recordMotion', (event: any) => events.push(event));
  await page.addInitScript(() => {
    (window as any).__documentId = Math.random().toString(36);
    addEventListener('pagereveal', async (event: any) => {
      const record: any = { path: location.pathname, transition: !!event.viewTransition };
      if (event.viewTransition) {
        try {
          await event.viewTransition.ready;
          record.contentName = getComputedStyle(
            document.querySelector('#main')!,
          ).viewTransitionName;
          record.rootName = getComputedStyle(document.documentElement).viewTransitionName;
          record.animations = document.getAnimations().map((animation: any) => ({
            name: animation.animationName,
            pseudo: animation.effect?.pseudoElement,
            duration: animation.effect?.getTiming().duration,
            frames: animation.effect?.getKeyframes(),
          }));
        } catch (error) {
          record.skipped = String(error);
        }
      }
      (window as any).recordMotion(record);
    });
  });
  return events;
}
async function settled(page: Page) {
  // Observe the rendered animations, not an artificial flag carried through
  // BFCache or a finished promise belonging to a page that was interrupted.
  // pagereveal runs before the first rendering update of the new document.
  await page.evaluate(async () => {
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    await Promise.all(
      document
        .getAnimations()
        .filter((animation: any) =>
          ['autuswing-page-in', 'autuswing-page-out'].includes(animation.animationName),
        )
        .map((animation) => animation.finished.catch(() => {})),
    );
  });
}
async function freshContents(page: Page) {
  const expected = await page
    .locator('.prose h2[id],.prose h3[id],.prose h4[id]')
    .evaluateAll((nodes) => nodes.map((node) => node.id));
  const actual = await page
    .locator('.reading-sidebar .toc-link')
    .evaluateAll((nodes) =>
      nodes.map((node) => decodeURIComponent((node as HTMLAnchorElement).hash.slice(1))),
    );
  expect(actual).toEqual(expected);
  await expect(page.locator(actions)).toHaveCount(1);
  expect(await page.locator('.code-block .code-block,.code-toolbar + .code-toolbar').count()).toBe(
    0,
  );
}

test('native transitions keep the correct navigation shell across responsive layouts', async ({
  page,
  browserName,
}) => {
  test.setTimeout(60000);
  const events = await observe(page);
  const results = [];
  for (const [width, height] of [
    [390, 844],
    [768, 1024],
    [1024, 768],
    [1366, 768],
    [1440, 900],
    [1920, 1080],
    [2560, 1440],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    const mode = await inspectTransitionMode(page, browserName);
    const documentId = await page.evaluate(() => (window as any).__documentId);
    const homeShell =
      width < 720 ? '.mobile-header' : width < 1000 ? '.tablet-sidebar' : '.desktop-sidebar';
    await expect(page.locator(homeShell)).toBeVisible();
    const count = events.filter((e) => e.transition).length;
    await page.locator('.post-card-title a').first().click();
    await settled(page);
    if (mode === 'native')
      await expect.poll(() => events.filter((e) => e.transition).length).toBe(count + 1);
    else {
      expect(events.filter((e) => e.transition)).toHaveLength(0);
      expect(await page.evaluate(() => (window as any).__documentId)).not.toBe(documentId);
      await assertUnanimatedNavigation(page);
    }
    await expect(page.locator(width < 720 ? '.mobile-header' : '.reading-rail')).toBeVisible();
    await freshContents(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.goBack();
    await settled(page);
    await expect(page.locator(homeShell)).toBeVisible();
    results.push({ width, height, homeShell, mode, passed: true });
  }
  fs.writeFileSync(`${dir}/responsive-transitions.json`, JSON.stringify(results, null, 2));
});

test('search and image dialogs use actual shared fades and a live preference change cancels an exit', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(article);
  const entry = await page.evaluate(() => {
    (document.querySelector('.search-open') as HTMLButtonElement).click();
    const dialog = document.querySelector('.search-dialog')!;
    return {
      animations: dialog.getAnimations().length,
      duration: getComputedStyle(dialog).transitionDuration,
    };
  });
  expect(entry.duration).toBe('0.18s, 0.18s');
  expect(entry.animations).toBeGreaterThan(0);
  await page.keyboard.press('Escape');
  await expect(page.locator('.search-dialog')).not.toBeVisible();
  await page.locator('.prose img[role=button]').first().click();
  await expect(page.locator('.image-dialog')).toBeVisible();
  await page.evaluate(() => (document.querySelector('.image-close') as HTMLButtonElement).click());
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await expect(page.locator('dialog[data-closing]')).toHaveCount(0);
  expect(await page.evaluate(() => !!document.querySelector(':modal'))).toBe(false);
});

test('native MPA transitions use only the content group and refresh article state', async ({
  page,
  browserName,
}) => {
  const events = await observe(page);
  await page.emulateMedia({ reducedMotion: 'no-preference', colorScheme: 'dark' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const mode = await inspectTransitionMode(page, browserName);
  const documentId = await page.evaluate(() => (window as any).__documentId);
  await page.locator('.post-card-title a').first().click();
  await expect(page).toHaveURL(new RegExp(article));
  await settled(page);
  expect(await page.evaluate(() => (window as any).__documentId)).not.toBe(documentId);
  await expect(page.locator('.reading-rail')).toBeVisible();
  await freshContents(page);
  const firstArticleDocument = await page.evaluate(() => (window as any).__documentId);
  await page.locator('.post-navigation a').first().click();
  await settled(page);
  const secondDocument = await page.evaluate(() => (window as any).__documentId);
  expect(secondDocument).not.toBe(firstArticleDocument);
  await freshContents(page);
  await page.locator('.reading-rail a[href="/about/"]').click();
  await expect(page).toHaveURL(/\/about\/$/);
  await settled(page);
  await expect(page.locator('.desktop-sidebar')).toBeVisible();
  if (mode === 'native') await expect.poll(() => events.filter((e) => e.transition).length).toBe(3);
  else {
    expect(events.filter((e) => e.transition)).toHaveLength(0);
    expect(await page.evaluate(() => (window as any).__documentId)).not.toBe(secondDocument);
    await assertUnanimatedNavigation(page);
    await page.locator('.search-open:visible').click();
    await expect(page.locator('#search-input')).toBeFocused();
    await page.keyboard.press('Escape');
  }
  for (const event of events.filter((e) => e.transition)) {
    expect(event.skipped).toBeUndefined();
    expect(event.animations.map((a: any) => a.name).sort()).toEqual([
      'autuswing-page-in',
      'autuswing-page-out',
    ]);
    expect(event.contentName).toBe('main-content');
    expect(event.rootName).toBe('none');
    // WebKit exposes the actual CSS animations but currently returns null
    // for KeyframeEffect.pseudoElement on view-transition pseudo elements.
    for (const animation of event.animations)
      if (animation.pseudo !== null) expect(animation.pseudo).toContain('(main-content)');
    const incoming = event.animations.find((a: any) => a.name === 'autuswing-page-in');
    expect(incoming.duration).toBe(360);
    expect(incoming.frames[0]).toMatchObject({ transform: 'translateY(14px)', opacity: '0' });
    expect(event.animations.find((a: any) => a.name === 'autuswing-page-out').duration).toBe(160);
  }
  fs.writeFileSync(`${dir}/native-transitions.json`, JSON.stringify(events, null, 2));
});

test('back and forward restore long-page scroll and current navigation without reinitializing', async ({
  page,
}) => {
  await observe(page);
  // The current home has only three posts. Use a shorter desktop viewport so
  // its history entry has a real, nonzero scroll position to restore.
  await page.setViewportSize({ width: 1440, height: 600 });
  await page.goto('/');
  await page.locator('.post-card-title a').last().scrollIntoViewIfNeeded();
  const homeY = await page.evaluate(() => scrollY);
  expect(homeY).toBeGreaterThan(0);
  await page.locator('.post-card-title a').last().click();
  await settled(page);
  // Use the long article, keeping a native link navigation rather than goto.
  if (!page.url().endsWith(article)) {
    await page.locator('.reading-rail a[href="/archives/"]').click();
    await settled(page);
    await page.locator(`.timeline a[href="${article}"]`).click();
    await settled(page);
  }
  await page.evaluate(() => scrollTo({ top: 1800, behavior: 'instant' }));
  const articleY = await page.evaluate(() => scrollY);
  expect(articleY).toBeGreaterThan(1000);
  await page.locator('.reading-rail a[href="/about/"]').click();
  await settled(page);
  await page.goBack();
  await settled(page);
  await expect.poll(() => page.evaluate(() => Math.abs(scrollY - 1800))).toBeLessThan(3);
  await freshContents(page);
  await expect(page.locator('.reading-progress')).toHaveCount(0);
  await expect(page.locator('.back-top')).toBeVisible();
  await page.goForward();
  await settled(page);
  await expect(page).toHaveURL(/\/about\/$/);
  await page.goBack();
  await settled(page);
  // Walk back to the actual home history entry (some posts have a short body).
  for (let i = 0; i < 3 && new URL(page.url()).pathname !== '/'; i++) {
    await page.goBack();
    await settled(page);
  }
  await expect(page.locator('.desktop-sidebar')).toBeVisible();
  await expect.poll(() => page.evaluate((y) => Math.abs(scrollY - y), homeY)).toBeLessThan(3);
  fs.writeFileSync(
    `${dir}/history.json`,
    JSON.stringify({ homeY, articleY, restoredHomeY: await page.evaluate(() => scrollY) }, null, 2),
  );
});

test('fragment links do not navigate a document or run a page transition', async ({ page }) => {
  const events = await observe(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(article);
  const id = await page.evaluate(() => (window as any).__documentId);
  await page.locator('.reading-sidebar .toc-link').nth(8).click();
  await expect(page).toHaveURL(/#/);
  expect(await page.evaluate(() => (window as any).__documentId)).toBe(id);
  expect(events.filter((event) => event.transition)).toHaveLength(0);
  await expect(page.locator('.reading-sidebar .toc-link.active')).toHaveCount(1);
});

test('functional dialog exits keep a single TOC action and handle reopening and replacements', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto(article);
  await page.locator('.contents-open:visible').click();
  await expect(page.locator(actions)).toHaveCount(1);
  // A close stays modal until its opacity/transform animation has finished.
  const closing = await page.evaluate(() => {
    (document.querySelector('.contents-close') as HTMLButtonElement).click();
    const dialog = document.querySelector('.contents-dialog') as HTMLDialogElement;
    return {
      open: dialog.open,
      closing: dialog.dataset.closing,
      actions: [...document.querySelectorAll('.contents-open,.goto-toc,.contents-close')].filter(
        (n) => n.getClientRects().length,
      ).length,
    };
  });
  expect(closing).toEqual({ open: true, closing: 'true', actions: 1 });
  await expect(page.locator('.contents-dialog')).not.toBeVisible();
  await expect(page.locator('.contents-open:visible')).toBeFocused();
  await page.locator('.contents-open:visible').click();
  await page.evaluate(() => {
    (document.querySelector('.contents-close') as HTMLButtonElement).click();
    // Simulate a second direct activation during exit; cancel the old exit.
    (document.querySelector('.contents-open') as HTMLButtonElement).click();
  });
  await expect(page.locator('.contents-dialog')).toBeVisible();
  await expect(page.locator('.contents-dialog')).not.toHaveAttribute('data-closing');
  await page.keyboard.press('Control+k');
  await expect(page.locator('.search-dialog')).toBeVisible();
  await expect(page.locator('.contents-dialog')).not.toBeVisible();
  await expect(page.locator('dialog[open]')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await page.locator('.contents-open:visible').click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator('.contents-dialog')).not.toBeVisible();
  await expect(page.locator(actions)).toHaveCount(1);
  expect(await page.evaluate(() => !!document.querySelector(':modal'))).toBe(false);
});

test('reduced motion disables page and decorative motion while keeping controls functional', async ({
  page,
}) => {
  const events = await observe(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.locator('.post-card-title a').first().click();
  await settled(page);
  expect(events.some((e) => e.transition)).toBe(false);
  await page.locator('.goto-toc').click();
  const open = await page.locator('.contents-dialog').evaluate((n) => ({
    duration: getComputedStyle(n).transitionDuration,
    animations: n.getAnimations().length,
  }));
  expect(open).toEqual({ duration: '0s', animations: 0 });
  await page.locator('.contents-close').click();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await page.evaluate(() => scrollTo({ top: 1200, behavior: 'instant' }));
  await page.locator('.back-top').click();
  expect(await page.evaluate(() => scrollY)).toBe(0);
  await expect(page.locator('.goto-toc')).toBeVisible();
});

test('without the native opt-in normal MPA links and interactions work', async ({ page }) => {
  const events = await observe(page);
  await page.route('**/*', async (route) => {
    if (route.request().resourceType() !== 'document') return route.continue();
    const response = await route.fetch();
    const $ = load(await response.text());
    $('#autuswing-page-motion').remove();
    await route.fulfill({ response, body: $.html() });
  });
  await page.goto('/');
  const id = await page.evaluate(() => (window as any).__documentId);
  await page.locator('.post-card-title a').first().click();
  await expect(page).toHaveURL(new RegExp(article));
  await settled(page);
  expect(await page.evaluate(() => (window as any).__documentId)).not.toBe(id);
  expect(events.some((e) => e.transition)).toBe(false);
  await page.locator('.search-open:visible').click();
  await expect(page.locator('#search-input')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('dialog[open]')).toHaveCount(0);
});

test('rapid native navigation and back interruptions settle without stale controls', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await observe(page);
  await page.goto('/');
  for (let i = 0; i < 3; i++) {
    // Do not wait for animation completion before issuing the next navigation.
    await page.locator('.post-card-title a').first().click({ noWaitAfter: true });
    await expect(page.locator('.reading-rail')).toBeVisible();
    await page.locator('.reading-rail .rail-nav a[href="/"]').click({ noWaitAfter: true });
    await expect(page.locator('.desktop-sidebar')).toBeVisible();
  }
  await page.locator('.post-card-title a').first().click({ noWaitAfter: true });
  await expect(page).toHaveURL(new RegExp(article));
  await page.goBack();
  await settled(page);
  await expect(page.locator('.desktop-sidebar')).toBeVisible();
  expect(await page.evaluate(() => !!document.querySelector(':modal'))).toBe(false);
  await page.locator('.post-card-title a').first().click();
  await settled(page);
  await freshContents(page);
  expect(errors).toEqual([]);
});

test('actual transition frames preserve the live shell and selected appearance', async ({
  page,
  browserName,
}) => {
  await page.addInitScript(() => {
    (window as any).__frozenTransition = false;
    (window as any).__revealTheme = null;
    addEventListener('pagereveal', async (event: any) => {
      if (!event.viewTransition) return;
      (window as any).__revealTheme = document.documentElement.dataset.theme;
      try {
        await event.viewTransition.ready;
        const animations = document
          .getAnimations()
          .filter((a: any) =>
            ['autuswing-page-in', 'autuswing-page-out'].includes(a.animationName),
          );
        for (const animation of animations) {
          animation.pause();
          animation.currentTime = 80;
        }
        (window as any).__frozenAnimations = animations;
        (window as any).__frozenTransition = true;
      } catch {}
    });
  });
  await page.goto('/');
  const crossDocumentMode = await inspectTransitionMode(page, browserName);
  for (const mode of ['dark', 'light']) {
    await page.evaluate((value) => localStorage.setItem('autuswing-appearance', value), mode);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await page.locator('.post-card-title a').first().click();
    const native = crossDocumentMode === 'native';
    if (native) {
      await expect.poll(() => page.evaluate(() => (window as any).__frozenTransition)).toBe(true);
      expect(await page.evaluate(() => (window as any).__revealTheme)).toBe(mode);
    } else {
      await settled(page);
      await assertUnanimatedNavigation(page);
      expect(await page.evaluate(() => (window as any).__frozenTransition)).toBe(false);
      await expect(page.locator('html')).toHaveAttribute('data-theme', mode);
      await freshContents(page);
    }
    const frame = await page.evaluate(() => {
      const navigation = document.querySelector('.reading-rail')!,
        main = document.querySelector('#main')!;
      const old = getComputedStyle(document.documentElement, '::view-transition-old(main-content)');
      const incoming = getComputedStyle(
        document.documentElement,
        '::view-transition-new(main-content)',
      );
      return {
        shellOpacity: getComputedStyle(navigation).opacity,
        shellTransform: getComputedStyle(navigation).transform,
        root: getComputedStyle(document.documentElement).viewTransitionName,
        mainOpacity: getComputedStyle(main).opacity,
        oldOpacity: old.opacity,
        newOpacity: incoming.opacity,
      };
    });
    expect(frame).toMatchObject({
      shellOpacity: '1',
      shellTransform: 'none',
      root: 'none',
      mainOpacity: '1',
    });
    if (native) {
      expect(+frame.newOpacity).toBeGreaterThan(0);
      expect(+frame.newOpacity).toBeLessThan(1);
      await page.screenshot({ path: `${dir}/native-frame-80ms-${mode}.png`, animations: 'allow' });
      await page.evaluate(() =>
        (window as any).__frozenAnimations.forEach((a: Animation) => a.play()),
      );
    } else {
      await page.screenshot({ path: `${dir}/fallback-frame-${mode}.png`, animations: 'disabled' });
    }
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document
              .getAnimations()
              .filter((a: any) =>
                ['autuswing-page-in', 'autuswing-page-out'].includes(a.animationName),
              ).length,
        ),
      )
      .toBe(0);
  }
});

test('responsive layout geometry is unchanged after motion cleanup', async ({
  page,
  browserName,
  browser,
}) => {
  test.setTimeout(90000);
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
  const { baseline: before } = layoutReference('motion-system', browserName);
  const results = [];
  for (const sample of before.cases) {
    await referencePage(browser, page, browserName, sample, async (page) => {
      const regions = await page.evaluate(
        (selectors) =>
          Object.fromEntries(
            selectors.map((selector) => [
              selector,
              [...document.querySelectorAll(selector)].map((el) => {
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
            ]),
          ),
        Object.keys(sample.regions),
      );
      for (const selector of Object.keys(sample.regions)) {
        expect(
          activeLayoutMetrics(regions[selector]),
          `${sample.path} ${sample.width}x${sample.height} ${selector}`,
        ).toEqual(activeLayoutMetrics(sample.regions[selector]));
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({
        path: `${dir}/${sample.path === '/' ? 'home' : 'article'}-${sample.width}x${sample.height}.png`,
      });
      results.push({
        width: sample.width,
        height: sample.height,
        path: sample.path,
        matched: true,
      });
    });
  }
  fs.writeFileSync(`${dir}/layout-regression.json`, JSON.stringify(results, null, 2));
});
