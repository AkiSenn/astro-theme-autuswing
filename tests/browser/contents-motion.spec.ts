import { test, expect, type Page } from '@playwright/test';

const article = '/post/55b0541c/';
const panel = '.reading-sidebar';
const opener = '.contents-open:visible,.goto-toc:visible';

async function ready(page: Page, width = 1440) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(article);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {})));
  });
}

async function geometry(page: Page) {
  return page.locator('#main').evaluate((node) => {
    const box = node.getBoundingClientRect();
    return { x: box.x, width: box.width, scroll: scrollY };
  });
}

// 在真实 WAAPI 的中点暂停以检查反向操作；不依赖机器帧率碰巧捕获中间帧。
async function togglePaused(page: Page, open: boolean) {
  return page.evaluate((open) => {
    const button = open
      ? [...document.querySelectorAll<HTMLButtonElement>('.contents-open,.goto-toc')].find(
          (node) => node.getClientRects().length,
        )!
      : document.querySelector<HTMLButtonElement>('.reading-contents-close')!;
    button.click();
    const node = document.querySelector<HTMLElement>('.reading-sidebar')!;
    const animations = node.getAnimations();
    animations.forEach((a) => {
      a.pause();
      a.currentTime = 90;
    });
    const style = getComputedStyle(node);
    return {
      count: animations.length,
      duration: animations[0]?.effect?.getTiming().duration,
      frames: (animations[0]?.effect as KeyframeEffect | undefined)
        ?.getKeyframes()
        .map((f) => ({ opacity: f.opacity, transform: f.transform })),
      opacity: Number(style.opacity),
      y: new DOMMatrixReadOnly(style.transform).m42,
      hidden: node.getAttribute('aria-hidden'),
      pointer: style.pointerEvents,
      tabbable: [...node.querySelectorAll<HTMLElement>('a,button')].filter((n) => n.tabIndex >= 0)
        .length,
    };
  }, open);
}

async function finishPanel(page: Page) {
  await page.locator(panel).evaluate((node) => node.getAnimations().forEach((a) => a.finish()));
  await expect(page.locator(panel)).not.toHaveAttribute('data-contents-animating');
}

for (const width of [1366, 1440])
  test(`desktop ${width}: 180ms/4px entry, exit and reversal preserve main geometry`, async ({
    page,
  }, info) => {
    await ready(page, width);
    const before = await geometry(page);
    if (width === 1440) {
      const close = await togglePaused(page, false);
      expect(close.count).toBe(1);
      expect(close.hidden).toBe('true');
      expect(close.pointer).toBe('none');
      expect(close.tabbable).toBe(0);
      await finishPanel(page);
    }
    const opened = await togglePaused(page, true);
    expect(opened.count).toBe(1);
    expect(opened.duration).toBe(180);
    expect(opened.frames).toEqual([
      { opacity: '0', transform: 'translateY(4px)' },
      { opacity: '1', transform: 'none' },
    ]);
    expect(opened.opacity).toBeGreaterThan(0);
    expect(opened.opacity).toBeLessThan(1);
    expect(opened.y).toBeGreaterThan(0);
    expect(opened.y).toBeLessThan(4);
    expect(await geometry(page)).toEqual(before);
    const closed = await togglePaused(page, false);
    expect(closed.count).toBe(1);
    expect(closed.frames?.[0].opacity).toBe(String(opened.opacity));
    expect(closed.frames?.[1]).toEqual({ opacity: '0', transform: 'translateY(4px)' });
    expect(closed.tabbable).toBe(0);
    for (const next of [true, false, true, false]) await togglePaused(page, next);
    await finishPanel(page);
    await expect(page.locator(panel)).not.toBeVisible();
    await expect(page.locator(opener)).toBeFocused();
    expect(await geometry(page)).toEqual(before);
    await page.locator(opener).click();
    await expect(page.locator(panel)).not.toHaveAttribute('data-contents-animating');
    await expect(page.locator(panel)).toBeVisible();
    expect(await geometry(page)).toEqual(before);
    for (const opening of [false, true, false, true, false, true]) {
      const box = await page.locator(opening ? opener : '.reading-contents-close').boundingBox();
      expect(box).not.toBeNull();
      await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
    }
    await expect(page.locator(panel)).not.toHaveAttribute('data-contents-animating');
    await expect(page.locator(panel)).toBeVisible();
    expect(await geometry(page)).toEqual(before);
    await info.attach('geometry-and-motion', {
      body: JSON.stringify({ before, opened, closed, after: await geometry(page) }),
      contentType: 'application/json',
    });
    await info.attach('desktop-final', { body: await page.screenshot(), contentType: 'image/png' });
  });

test('desktop Enter, Space, Tab, Escape, anchors and focus restoration', async ({
  page,
  browserName,
}) => {
  await ready(page);
  const before = await geometry(page);
  await page.locator('.reading-contents-close').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator(opener)).toBeFocused();
  await expect(page.locator(panel)).not.toBeVisible();
  await page.keyboard.press('Space');
  await expect(page.locator('#reading-sidebar-title')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('.reading-contents-close')).toBeFocused();
  await page.keyboard.press('Tab');
  // 修改前后同环境对照：Firefox 停靠滚动容器；WebKit 默认 Tab 跳过链接。
  if (browserName === 'firefox') {
    await expect(page.locator('.reading-sidebar-scroll')).toBeFocused();
    await page.keyboard.press('Tab');
  } else if (browserName === 'webkit') {
    await expect(page.locator('.heading-link').first()).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(page.locator('.reading-contents-close')).toBeFocused();
    await page.locator('.reading-sidebar .toc-link').first().focus();
  }
  await expect(page.locator('.reading-sidebar .toc-link').first()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator(panel)).not.toBeVisible();
  await expect(page.locator(opener)).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator(panel)).not.toHaveAttribute('data-contents-animating');
  expect(await geometry(page)).toEqual(before);
  await page.evaluate(() => ((window as any).__contentsDocument = Math.random()));
  const stamp = await page.evaluate(() => (window as any).__contentsDocument);
  await page.locator('.reading-sidebar .toc-link').nth(8).click();
  await expect(page).toHaveURL(/#/);
  expect(await page.evaluate(() => (window as any).__contentsDocument)).toBe(stamp);
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0);
  await expect(page.locator('.reading-sidebar .toc-link.active')).toHaveCount(1);
  expect((await geometry(page)).x).toBe(before.x);
  const anchored = await geometry(page);
  await page.locator('.reading-contents-close').click();
  await expect(page.locator(panel)).not.toBeVisible();
  await page.locator(opener).click();
  await expect(page.locator(panel)).not.toHaveAttribute('data-contents-animating');
  expect(await geometry(page)).toEqual(anchored);
});

test('changing motion policy during modal entry immediately settles body and backdrop', async ({
  page,
}, info) => {
  await ready(page, 390);
  const observations: unknown[] = [];
  for (const policy of ['system', 'config']) {
    const during = await page.evaluate(() => {
      (document.querySelector('.goto-toc') as HTMLButtonElement).click();
      const dialog = document.querySelector('.contents-dialog')!;
      getComputedStyle(dialog).opacity;
      getComputedStyle(dialog, '::backdrop').opacity;
      // 同一任务内暂停真实过渡；WebKit 的脚本点击后首个 RAF 可能晚于整个动效。
      const animations = document
        .getAnimations()
        .filter((a) => (a.effect as KeyframeEffect)?.target === dialog);
      animations.forEach((a) => {
        a.pause();
        a.currentTime = 60;
      });
      return {
        body: getComputedStyle(dialog).opacity,
        backdrop: getComputedStyle(dialog, '::backdrop').opacity,
        animations: animations.length,
      };
    });
    expect(during.animations).toBeGreaterThan(0);
    if (policy === 'system') await page.emulateMedia({ reducedMotion: 'reduce' });
    else
      await page.evaluate(() => {
        document.documentElement.dataset.motion = 'false';
      });
    await expect
      .poll(() =>
        page.locator('.contents-dialog').evaluate((n) => ({
          body: getComputedStyle(n).opacity,
          backdrop: getComputedStyle(n, '::backdrop').opacity,
          duration: getComputedStyle(n, '::backdrop').transitionDuration,
          animations: document
            .getAnimations()
            .filter((a) => (a.effect as KeyframeEffect)?.target === n).length,
        })),
      )
      .toEqual({ body: '1', backdrop: '1', duration: '0s', animations: 0 });
    await page.keyboard.press('Escape');
    await expect(page.locator('.goto-toc')).toBeFocused();
    observations.push({ policy, during });
    if (policy === 'system') await page.emulateMedia({ reducedMotion: 'no-preference' });
    else
      await page.evaluate(() => {
        document.documentElement.dataset.motion = 'true';
      });
  }
  await info.attach('entry-interruption', {
    body: JSON.stringify(observations),
    contentType: 'application/json',
  });
});

for (const policy of ['system', 'config'] as const)
  test(`${policy}: disabled and mid-animation preference changes settle panel and modal`, async ({
    page,
  }) => {
    await ready(page);
    await togglePaused(page, false);
    const disable = async () => {
      if (policy === 'system') await page.emulateMedia({ reducedMotion: 'reduce' });
      else
        await page.evaluate(() => {
          document.documentElement.dataset.motion = 'false';
        });
    };
    const enable = async () => {
      if (policy === 'system') await page.emulateMedia({ reducedMotion: 'no-preference' });
      else
        await page.evaluate(() => {
          document.documentElement.dataset.motion = 'true';
        });
    };
    await disable();
    await expect(page.locator(panel)).not.toHaveAttribute('data-contents-animating');
    await expect(page.locator(panel)).not.toBeVisible();
    await page.locator(opener).click();
    expect(await page.locator(panel).evaluate((n) => n.getAnimations().length)).toBe(0);
    await enable();
    await togglePaused(page, false);
    await finishPanel(page);
    await togglePaused(page, true);
    await disable();
    await expect(page.locator(panel)).not.toHaveAttribute('data-contents-animating');
    await expect(page.locator(panel)).toBeVisible();
    await enable();
    await page.setViewportSize({ width: 820, height: 1180 });
    await page.locator(opener).click();
    await expect(page.locator('.contents-dialog')).toBeVisible();
    await page.locator('.contents-dialog').evaluate((n) => {
      (n.querySelector('.contents-close') as HTMLButtonElement).click();
      n.getAnimations()
        .filter((a) => a.constructor.name === 'Animation')
        .forEach((a) => a.pause());
    });
    await expect(page.locator('.contents-dialog')).toHaveAttribute('data-closing', 'true');
    await disable();
    await expect(page.locator('.contents-dialog')).not.toBeVisible();
    await expect(page.locator(opener)).toBeFocused();
  });

for (const width of [390, 820])
  test(`modal ${width}: normal 180ms retained; reduced/config gates include backdrop`, async ({
    page,
  }, info) => {
    await ready(page, width);
    const records: unknown[] = [];
    for (const surface of ['contents', 'search', 'image']) {
      const selector = `.${surface}-dialog`;
      const open = async () => {
        if (surface === 'contents') await page.locator(opener).click();
        else if (surface === 'search') await page.keyboard.press('Control+k');
        else await page.locator('.prose img').first().click();
        await expect(page.locator(selector)).toBeVisible();
      };
      const close = () =>
        page
          .locator(selector)
          .evaluate((n) => n.dispatchEvent(new Event('cancel', { cancelable: true })));
      await open();
      const normal = await page.locator(selector).evaluate((n) => ({
        body: getComputedStyle(n).transitionDuration,
        backdrop: getComputedStyle(n, '::backdrop').transitionDuration,
      }));
      expect(normal).toEqual({ body: '0.18s, 0.18s', backdrop: '0.18s' });
      const exit = await page.locator(selector).evaluate((n) => {
        n.dispatchEvent(new Event('cancel', { cancelable: true }));
        return n
          .getAnimations()
          .filter((a) => a.constructor.name === 'Animation')
          .map((a) => a.effect?.getTiming().duration);
      });
      expect(exit).toContain(180);
      await expect(page.locator(selector)).not.toBeVisible();
      for (const policy of ['system', 'config']) {
        if (policy === 'system') await page.emulateMedia({ reducedMotion: 'reduce' });
        else
          await page.evaluate(() => {
            document.documentElement.dataset.motion = 'false';
          });
        await open();
        const disabled = await page.locator(selector).evaluate((n) => ({
          body: getComputedStyle(n).transitionDuration,
          backdrop: getComputedStyle(n, '::backdrop').transitionDuration,
          opacity: getComputedStyle(n, '::backdrop').opacity,
          animations: document
            .getAnimations()
            .filter((a) => (a.effect as KeyframeEffect)?.target === n).length,
        }));
        expect(disabled).toEqual({ body: '0s', backdrop: '0s', opacity: '1', animations: 0 });
        await close();
        expect(await page.locator(selector).evaluate((n: HTMLDialogElement) => n.open)).toBe(false);
        records.push({ surface, policy, normal, disabled });
        if (policy === 'system') await page.emulateMedia({ reducedMotion: 'no-preference' });
        else
          await page.evaluate(() => {
            document.documentElement.dataset.motion = 'true';
          });
      }
    }
    await info.attach('modal-policy', {
      body: JSON.stringify(records),
      contentType: 'application/json',
    });
  });

test('breakpoint changes settle animation and preserve a visible focused control', async ({
  page,
}) => {
  await ready(page);
  await togglePaused(page, false);
  await page.setViewportSize({ width: 820, height: 1180 });
  await expect(page.locator(panel)).not.toHaveAttribute('data-contents-animating');
  await expect(page.locator(opener)).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.contents-close')).toBeFocused();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Escape');
  await expect(page.locator('.contents-dialog')).not.toBeVisible();
  await expect(page.locator(opener)).toBeFocused();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator(opener)).toBeFocused();
});

test('capability fallback without WAAPI/native dialog/inert remains operable (not an iOS device test)', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(Element.prototype, 'animate', { value: undefined, configurable: true });
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      value: undefined,
      configurable: true,
    });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', {
      value: undefined,
      configurable: true,
    });
    delete (HTMLElement.prototype as any).inert;
  });
  await ready(page);
  await page.locator('.reading-contents-close').click();
  await expect(page.locator(panel)).not.toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('#reading-sidebar-title')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator(opener)).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  const scroll = await page.evaluate(() => scrollY);
  await page.locator(opener).click();
  await expect(page.locator('.contents-dialog')).toBeVisible();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Escape');
  await expect(page.locator('.contents-dialog')).not.toBeVisible();
  await expect(page.locator(opener)).toBeFocused();
  expect(await page.evaluate(() => scrollY)).toBe(scroll);
});
