import { test, expect, type Page } from '@playwright/test';
import { load } from 'cheerio';

const article = '/post/55b0541c/';
const modeButton = (page: Page) => page.locator('.mode-toggle:visible');

async function observe(page: Page) {
  const events: any[] = [];
  await page.exposeFunction('recordNativeTransition', (record: unknown) => events.push(record));
  await page.addInitScript(() => {
    const send = (data: any) =>
      (window as any).recordNativeTransition({ path: location.pathname, ...data });
    const animations = () =>
      document.getAnimations().map((a: any) => ({
        name: a.animationName || null,
        property: a.transitionProperty || null,
        pseudo: a.effect?.pseudoElement || null,
        duration: a.effect?.getTiming().duration,
      }));
    (window as any).__nativeCalls = [];
    (window as any).__documentToken = Math.random();
    if (typeof document.startViewTransition === 'function') {
      const native = document.startViewTransition.bind(document);
      document.startViewTransition = ((update: () => void) => {
        const call: any = {
          id: (window as any).__nativeCalls.length,
          kind: 'same',
          phase: 'start',
        };
        (window as any).__nativeCalls.push(call);
        send(call);
        const transition = native(update);
        (window as any).__lastNative = transition;
        transition.ready.then(
          () => {
            send({
              ...call,
              phase: 'ready',
              root: getComputedStyle(document.documentElement).viewTransitionName,
              main: getComputedStyle(document.querySelector('#main')!).viewTransitionName,
              animations: animations(),
            });
          },
          (error) => send({ ...call, phase: 'skipped', error: String(error) }),
        );
        transition.finished.then(
          () => send({ ...call, phase: 'finished' }),
          (error) => send({ ...call, phase: 'failed', error: String(error) }),
        );
        return transition;
      }) as typeof document.startViewTransition;
    }
    for (const type of ['pageswap', 'pagereveal'])
      addEventListener(type, (event: any) => {
        send({ kind: 'cross', phase: type, native: !!event.viewTransition });
        event.viewTransition?.ready.then(
          () =>
            send({
              kind: 'cross',
              phase: 'ready',
              animations: animations(),
              root: getComputedStyle(document.documentElement).viewTransitionName,
              main: getComputedStyle(document.querySelector('#main')!).viewTransitionName,
            }),
          (error: unknown) => send({ kind: 'cross', phase: 'skipped', error: String(error) }),
        );
      });
  });
  return events;
}

async function settled(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    await document.activeViewTransition?.finished.catch(() => {});
    await Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {})));
  });
  await expect(page.locator('html')).not.toHaveAttribute('data-appearance-transition');
}

async function state(page: Page, mode: string, theme: string) {
  await expect(page.locator('html')).toHaveAttribute('data-mode', mode);
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  await expect(modeButton(page)).toHaveAttribute('data-mode', mode);
  await expect(modeButton(page)).toHaveAttribute('data-theme', theme);
  await expect(modeButton(page)).toHaveAccessibleName(
    new RegExp(mode === 'auto' ? '跟随系统' : theme === 'dark' ? '夜间' : '日间'),
  );
  expect(
    await modeButton(page)
      .locator('use')
      .evaluateAll((nodes) =>
        nodes
          .filter((n) => getComputedStyle(n).display !== 'none')
          .map((n) => n.getAttribute('href')),
      ),
  ).toEqual([`#i-${theme === 'dark' ? 'moon' : 'sun'}`]);
  expect(await page.evaluate(() => localStorage.getItem('autuswing-appearance'))).toBe(mode);
}

async function start(page: Page, width = 1440) {
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ reducedMotion: 'no-preference', colorScheme: 'light' });
  await page.addInitScript(() => {
    if (!localStorage.getItem('autuswing-appearance'))
      localStorage.setItem('autuswing-appearance', 'light');
  });
  await page.goto(article);
  await settled(page);
}

async function geometry(page: Page) {
  return page.evaluate(() => {
    const rect = (selector: string) => {
      const box = document.querySelector(selector)!.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height };
    };
    return {
      main: rect('#main'),
      button: rect(
        [...document.querySelectorAll<HTMLElement>('.mode-toggle')]
          .find((n) => n.getClientRects().length)!
          .closest('.mobile-header')
          ? '.mobile-header .mode-toggle'
          : '.reading-rail .mode-toggle',
      ),
      x: scrollX,
      y: scrollY,
    };
  });
}

for (const width of [1440, 820, 390])
  test(`theme ${width}: native same-document ready, isolated names, geometry, focus and persistence`, async ({
    page,
  }, info) => {
    const events = await observe(page);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await start(page, width);
    expect(await page.evaluate(() => typeof document.startViewTransition)).toBe('function');
    await page.evaluate(() => scrollTo({ top: 1200, behavior: 'instant' }));
    await modeButton(page).focus();
    const before = await geometry(page);
    const token = await page.evaluate(() => (window as any).__documentToken);
    await page.keyboard.press('Enter');
    await state(page, 'dark', 'dark');
    await settled(page);
    expect(await page.evaluate(() => (window as any).__documentToken)).toBe(token);
    expect(await geometry(page)).toEqual(before);
    await expect(modeButton(page)).toBeFocused();
    await expect
      .poll(() => events.filter((e) => e.kind === 'same' && e.phase === 'ready').length)
      .toBe(1);
    const ready = events.find((e) => e.kind === 'same' && e.phase === 'ready');
    expect(ready.root).toBe('appearance-theme');
    expect(ready.main).toBe('none');
    expect(
      ready.animations
        .filter((a: any) => a.name === 'autuswing-appearance-in')
        .map((a: any) => a.duration),
    ).toEqual([180]);
    expect(ready.animations.some((a: any) => /^autuswing-page-/.test(a.name))).toBe(false);
    expect(events.filter((e) => e.kind === 'same' && e.phase === 'start')).toHaveLength(1);
    await page.reload();
    await settled(page);
    await state(page, 'dark', 'dark');
    expect(await page.evaluate(() => (window as any).__nativeCalls.length)).toBe(0);
    expect(errors).toEqual([]);
    await info.attach('native-theme', {
      body: JSON.stringify({ events, before, after: await geometry(page), errors }),
      contentType: 'application/json',
    });
  });

test('rapid requests coalesce, preserve last intent and do not duplicate native animations', async ({
  page,
}, info) => {
  const events = await observe(page);
  await start(page);
  await page.evaluate(() => {
    const button = [...document.querySelectorAll<HTMLButtonElement>('.mode-toggle')].find(
      (n) => n.getClientRects().length,
    )!;
    for (let i = 0; i < 5; i++) button.click();
  });
  await settled(page);
  await state(page, 'auto', 'light');
  expect(await page.evaluate(() => (window as any).__nativeCalls.length)).toBe(1);
  // 相同有效色板 auto/light -> light/light 只更新模式，不多拍一组截图。
  await modeButton(page).click();
  await state(page, 'light', 'light');
  expect(await page.evaluate(() => (window as any).__nativeCalls.length)).toBe(1);
  await modeButton(page).click();
  await state(page, 'dark', 'dark');
  await settled(page);
  await expect
    .poll(() => events.filter((e) => e.kind === 'same' && e.phase === 'ready').length)
    .toBe(1);
  await info.attach('rapid-native', {
    body: JSON.stringify(events),
    contentType: 'application/json',
  });
});

for (const policy of ['system', 'config'])
  test(`${policy}: disabled fallback and mid-transition stop keep state synchronized`, async ({
    page,
  }, info) => {
    const events = await observe(page);
    await start(page);
    // 先建立键盘焦点；Safari 的鼠标点击本身不保证聚焦按钮。
    await modeButton(page).focus();
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
    await page.keyboard.press('Enter');
    await state(page, 'dark', 'dark');
    await expect(modeButton(page)).toBeFocused();
    expect(await page.evaluate(() => (window as any).__nativeCalls.length)).toBe(0);
    await enable();
    // auto 跟随浅色系统，发生真实色板变化；ready 时暂停实际伪元素动画。
    await page.evaluate(() => {
      const button = [...document.querySelectorAll<HTMLButtonElement>('.mode-toggle')].find(
        (n) => n.getClientRects().length,
      )!;
      button.click();
      (window as any).__lastNative.ready.then(() =>
        document
          .getAnimations()
          .filter((a: any) => a.animationName === 'autuswing-appearance-in')
          .forEach((a) => {
            a.pause();
            a.currentTime = 60;
          }),
      );
    });
    await state(page, 'auto', 'light');
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document
              .getAnimations()
              .filter(
                (a: any) =>
                  a.animationName === 'autuswing-appearance-in' && a.playState === 'paused',
              ).length,
        ),
      )
      .toBe(1);
    await disable();
    await expect(page.locator('html')).not.toHaveAttribute('data-appearance-transition');
    expect(
      await page.evaluate(
        () =>
          document.getAnimations().filter((a: any) => a.animationName === 'autuswing-appearance-in')
            .length,
      ),
    ).toBe(0);
    await state(page, 'auto', 'light');
    await expect(modeButton(page)).toBeFocused();
    await page.keyboard.press('Enter');
    await state(page, 'light', 'light');
    await expect(modeButton(page)).toBeFocused();
    await info.attach('motion-policy', {
      body: JSON.stringify(events),
      contentType: 'application/json',
    });
  });

test('ordinary links, history and same-document palette transitions coexist without page animation pollution', async ({
  page,
}, info) => {
  const events = await observe(page);
  await start(page);
  const capabilities = await page.evaluate(() => ({
    same: typeof document.startViewTransition === 'function',
    cross: 'onpagereveal' in window && 'onpageswap' in window && 'CSSViewTransitionRule' in window,
  }));
  await modeButton(page).click();
  await settled(page);
  await state(page, 'dark', 'dark');
  await page.locator('nav:visible a[href="/"]').click();
  await settled(page);
  await page.locator('nav:visible a[href="/archives/"]').click();
  await settled(page);
  await expect(page).toHaveURL(/\/archives\/$/);
  await page.locator('#main a[href="/post/55b0541c/"]').first().click();
  await settled(page);
  await expect(page).toHaveURL(new RegExp(article));
  await page.goBack();
  await settled(page);
  await expect(page).toHaveURL(/\/archives\/$/);
  await page.goBack();
  await settled(page);
  expect(new URL(page.url()).pathname).toBe('/');
  await page.goForward();
  await settled(page);
  await expect(page).toHaveURL(/\/archives\/$/);
  await state(page, 'dark', 'dark');
  const nativeCross = events.filter((e) => e.kind === 'cross' && e.phase === 'ready');
  if (capabilities.cross) {
    expect(nativeCross.length).toBeGreaterThanOrEqual(6);
    for (const event of nativeCross) {
      expect(event.root).toBe('none');
      expect(event.main).toBe('main-content');
      expect(
        event.animations
          .filter((a: any) => /^autuswing-page-/.test(a.name))
          .map((a: any) => a.duration)
          .sort((a: number, b: number) => a - b),
      ).toEqual([160, 360]);
      expect(event.animations.some((a: any) => a.name === 'autuswing-appearance-in')).toBe(false);
    }
  } else {
    expect(nativeCross).toHaveLength(0);
    expect(
      await page.evaluate(
        () =>
          document.getAnimations().filter((a: any) => /^autuswing-page-/.test(a.animationName))
            .length,
      ),
    ).toBe(0);
  }
  expect(events.filter((e) => e.kind === 'same' && e.phase === 'start')).toHaveLength(1);
  await info.attach('cross-document-history', {
    body: JSON.stringify({ capabilities, events }),
    contentType: 'application/json',
  });
});

test('incoming navigation and immediate theme input do not start overlapping native transitions', async ({
  page,
}, info) => {
  const events = await observe(page);
  await page.addInitScript(() => {
    let initialized = false,
      incoming: ViewTransition | undefined,
      attempted = false;
    const activate = () => {
      if (!initialized || !incoming || attempted) return;
      attempted = true;
      const button = [...document.querySelectorAll<HTMLButtonElement>('.mode-toggle')].find(
        (n) => n.getClientRects().length,
      )!;
      (window as any).__navigationInput = {
        active: !!document.activeViewTransition,
        before: document.documentElement.dataset.theme,
      };
      button.click();
      (window as any).__navigationInput.after = document.documentElement.dataset.theme;
      document
        .getAnimations()
        .filter((a: any) => /^autuswing-page-/.test(a.animationName))
        .forEach((a) => a.finish());
    };
    // 首次 apply 的事件早于按钮绑定；微任务保证点击发生在初始化完成之后。
    addEventListener(
      'autuswing:appearance',
      () =>
        queueMicrotask(() => {
          initialized = true;
          activate();
        }),
      { once: true },
    );
    addEventListener('pagereveal', (event: any) => {
      event.viewTransition?.ready.then(() => {
        incoming = event.viewTransition;
        document
          .getAnimations()
          .filter((a: any) => /^autuswing-page-/.test(a.animationName))
          .forEach((a) => {
            a.pause();
            a.currentTime = 60;
          });
        activate();
      });
    });
  });
  await start(page);
  await page.locator('nav:visible a[href="/archives/"]').click();
  await settled(page);
  const cross = events.some((e) => e.kind === 'cross' && e.native);
  if (cross) {
    expect(await page.evaluate(() => (window as any).__navigationInput)).toEqual({
      active: true,
      before: 'light',
      after: 'dark',
    });
    await state(page, 'dark', 'dark');
    expect(events.filter((e) => e.kind === 'same' && e.phase === 'start')).toHaveLength(0);
  }
  await expect(page.locator('html')).not.toHaveAttribute('data-appearance-transition');
  await info.attach('navigation-overlap', {
    body: JSON.stringify(events),
    contentType: 'application/json',
  });
});

test('missing native API retains immediate theme, keyboard, directory, search and ordinary history', async ({
  page,
}) => {
  // 能力模型：同时移除跨文档 opt-in；不冒充旧 Safari 真机或原生实现。
  await page.route('**/*', async (route) => {
    if (route.request().resourceType() !== 'document') return route.continue();
    const response = await route.fetch();
    const html = load(await response.text());
    html('#autuswing-page-motion').remove();
    await route.fulfill({ response, body: html.html() });
  });
  await page.addInitScript(() =>
    Object.defineProperty(document, 'startViewTransition', {
      value: undefined,
      configurable: true,
    }),
  );
  await start(page, 390);
  await modeButton(page).focus();
  await page.keyboard.press('Space');
  await state(page, 'dark', 'dark');
  await expect(page.locator('html')).not.toHaveAttribute('data-appearance-transition');
  await page.locator('.goto-toc').click();
  await expect(page.locator('.contents-dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.goto-toc')).toBeFocused();
  await page.keyboard.press('Control+k');
  await expect(page.locator('#search-input')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('.search-dialog')).not.toBeVisible();
  await page.locator('nav:visible a[href="/archives/"]').click();
  await settled(page);
  await state(page, 'dark', 'dark');
  await page.goBack();
  await settled(page);
  await expect(page).toHaveURL(new RegExp(article));
});

test('automatic system theme remains synchronized without adding an unsolicited native transition', async ({
  page,
}) => {
  await observe(page);
  await start(page);
  await modeButton(page).click(); // light -> dark (native)
  await settled(page);
  await modeButton(page).click(); // dark -> auto/light (native)
  await settled(page);
  const calls = await page.evaluate(() => (window as any).__nativeCalls?.length || 0);
  await page.emulateMedia({ colorScheme: 'dark' });
  await state(page, 'auto', 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await state(page, 'auto', 'light');
  expect(await page.evaluate(() => (window as any).__nativeCalls?.length || 0)).toBe(calls);
});

test('reduced motion retains ordinary MPA navigation without native or CSS page entry', async ({
  page,
}, info) => {
  const events = await observe(page);
  await start(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await modeButton(page).click();
  await state(page, 'dark', 'dark');
  await page.locator('nav:visible a[href="/"]').click();
  await settled(page);
  await page.locator('nav:visible a[href="/archives/"]').click();
  await settled(page);
  await page.goBack();
  await settled(page);
  expect(new URL(page.url()).pathname).toBe('/');
  expect(events.filter((e) => e.kind === 'same' && e.phase === 'start')).toHaveLength(0);
  expect(
    events.filter((e) => e.kind === 'cross' && (e.native || e.phase === 'ready')),
  ).toHaveLength(0);
  expect(
    await page.locator('#main').evaluate((n) => ({
      opacity: getComputedStyle(n).opacity,
      transform: getComputedStyle(n).transform,
      animations: n.getAnimations().length,
    })),
  ).toEqual({ opacity: '1', transform: 'none', animations: 0 });
  await info.attach('reduced-navigation', {
    body: JSON.stringify(events),
    contentType: 'application/json',
  });
});

test('theme transition leaves desktop directory 180ms and modal focus/animation contracts intact', async ({
  page,
}) => {
  await observe(page);
  await start(page);
  await modeButton(page).click();
  await settled(page);
  const before = await geometry(page);
  const duration = await page
    .locator('.reading-contents-close')
    .evaluate((node: HTMLButtonElement) => {
      node.click();
      return document
        .querySelector('.reading-sidebar')!
        .getAnimations()
        .map((a) => a.effect?.getTiming().duration);
    });
  expect(duration).toEqual([180]);
  await expect(page.locator('.reading-sidebar')).not.toBeVisible();
  const after = await geometry(page);
  expect(after.main).toEqual(before.main);
  expect(after.x).toBe(before.x);
  expect(after.y).toBe(before.y);
  await page.setViewportSize({ width: 820, height: 900 });
  await page.locator('.contents-open:visible').click();
  await expect(page.locator('.contents-close')).toBeFocused();
  expect(
    await page
      .locator('.contents-dialog')
      .evaluate((n) => getComputedStyle(n, '::backdrop').transitionDuration),
  ).toBe('0.24s');
  await page.keyboard.press('Escape');
  await expect(page.locator('.contents-dialog')).not.toBeVisible();
  await expect(page.locator('.contents-open:visible')).toBeFocused();
  await page.keyboard.press('Control+k');
  await expect(page.locator('#search-input')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('.search-dialog')).not.toBeVisible();
});

test('article scroll survives native history after a local theme transition', async ({
  page,
}, info) => {
  const events = await observe(page);
  await start(page);
  await page.evaluate(() => scrollTo({ top: 1200, behavior: 'instant' }));
  const before = await geometry(page);
  expect(before.y).toBe(1200);
  await modeButton(page).click();
  await settled(page);
  expect(await geometry(page)).toEqual(before);
  await page.locator('nav:visible a[href="/"]').click();
  await settled(page);
  expect(new URL(page.url()).pathname).toBe('/');
  await page.goBack();
  await settled(page);
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(1200);
  expect(await geometry(page)).toEqual(before);
  await state(page, 'dark', 'dark');
  await page.goForward();
  await settled(page);
  expect(new URL(page.url()).pathname).toBe('/');
  await modeButton(page).click();
  await settled(page);
  await state(page, 'auto', 'light');
  await info.attach('history-scroll', {
    body: JSON.stringify({ before, events }),
    contentType: 'application/json',
  });
});
