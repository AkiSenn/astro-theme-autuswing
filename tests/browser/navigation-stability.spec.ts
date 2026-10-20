import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { evidenceDirectory } from '../../scripts/test-evidence.mjs';

const evidence = evidenceDirectory('navigation-stability');
fs.mkdirSync(evidence, { recursive: true });
const viewports = [
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 1920, height: 1080 },
  { width: 1000, height: 640 },
  { width: 999, height: 768 },
  { width: 820, height: 1180 },
  { width: 720, height: 900 },
  { width: 719, height: 900 },
  { width: 390, height: 844 },
  { width: 320, height: 640 },
];
const shellFor = (width: number) =>
  width >= 1000 ? '.desktop-sidebar' : width >= 720 ? '.tablet-sidebar' : '.mobile-header';

async function ready(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      [
        ...document.querySelectorAll<HTMLImageElement>(
          '.sidebar img,.tablet-sidebar img,.mobile-header img',
        ),
      ].map((image) => image.decode()),
    );
    await Promise.all(
      document.getAnimations().map((animation) => animation.finished.catch(() => {})),
    );
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });
}

async function snapshot(page: Page, shell: string) {
  return page.locator(shell).evaluate((root) => {
    const box = (element: Element) => {
      const r = element.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    };
    const rows = (selector: string) => [...root.querySelectorAll(selector)].map(box);
    return {
      viewport: {
        width: innerWidth,
        height: innerHeight,
        scale: visualViewport?.scale,
        dpr: devicePixelRatio,
      },
      scrollY,
      shell: box(root),
      profile: rows('.profile,.rail-brand,.mobile-brand-row'),
      nav: rows('nav'),
      links: rows('nav a'),
      tools: rows('.site-tools'),
      buttons: rows('.site-tools button'),
      bottom: rows('.sidebar-bottom,.rail-tools'),
    };
  });
}

type NavigationSample = Awaited<ReturnType<typeof snapshot>> & { step: number; target: string };
type FrameState = {
  frames: { links: { y: number; height: number }[]; buttons: { y: number; height: number }[] }[];
  events: { type: string; transition: boolean }[];
  done: boolean;
};

for (const viewport of viewports) {
  for (const mode of ['light', 'dark'] as const) {
    const smoke = mode === 'light' && [1440, 820, 390].includes(viewport.width) ? ' @smoke' : '';
    test(`navigation stable ${viewport.width}x${viewport.height} ${mode}${smoke}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ colorScheme: mode, reducedMotion: 'reduce' });
      const shell = shellFor(viewport.width),
        errors: string[] = [],
        samples: NavigationSample[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      for (let step = 0; step < 5; step++) {
        const target = step % 2 ? '/archives/' : '/';
        if (step === 0) await page.goto('/');
        else
          await Promise.all([
            page.waitForURL((url) => url.pathname === target),
            page.locator(`${shell} nav a[href="${target}"]`).click(),
          ]);
        await page.mouse.move(0, 0);
        await ready(page);
        await expect(
          page.locator('.desktop-sidebar:visible,.tablet-sidebar:visible,.mobile-header:visible'),
        ).toHaveCount(1);
        await expect(page.locator(`${shell} nav [aria-current="page"]`)).toHaveAttribute(
          'href',
          target,
        );
        const current = await snapshot(page, shell);
        expect(current.scrollY).toBe(0);
        expect(current.viewport.scale).toBe(1);
        samples.push({ step, target, ...current });
      }
      const prefix = `${viewport.width}x${viewport.height}-${mode}`;
      fs.writeFileSync(
        path.join(evidence, `${prefix}.json`),
        JSON.stringify({ samples, errors }, null, 2),
        { flag: 'wx' },
      );
      await page
        .locator(shell)
        .screenshot({ path: path.join(evidence, `${prefix}.png`), animations: 'disabled' });
      const vertical = (sample: (typeof samples)[number]) => ({
        shell: { y: sample.shell.y, height: sample.shell.height },
        profile: sample.profile.map(({ y, height }) => ({ y, height })),
        nav: sample.nav.map(({ y, height }) => ({ y, height })),
        links: sample.links.map(({ y, height }) => ({ y, height })),
        tools: sample.tools.map(({ y, height }) => ({ y, height })),
        buttons: sample.buttons.map(({ y, height }) => ({ y, height })),
        bottom: sample.bottom.map(({ y, height }) => ({ y, height })),
      });
      for (const sample of samples.slice(1))
        expect(vertical(sample), `${prefix} step ${sample.step}`).toEqual(vertical(samples[0]));
      expect(errors).toEqual([]);
      if (viewport.width === 1440 && mode === 'light') {
        const search = page.locator(`${shell} .search-open`),
          appearance = page.locator(`${shell} .mode-toggle`);
        await search.focus();
        await page.keyboard.press('Enter');
        await expect(page.locator('#site-search')).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(search).toBeFocused();
        await appearance.focus();
        for (const next of ['light', 'dark', 'auto']) {
          await page.keyboard.press('Enter');
          await expect(page.locator('html')).toHaveAttribute('data-mode', next);
        }
        expect(vertical({ ...samples[0], ...(await snapshot(page, shell)) })).toEqual(
          vertical(samples[0]),
        );
      }
    });
  }
}

for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  test(`navigation frames ${reducedMotion}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion, colorScheme: 'light' });
    await page.addInitScript(() => {
      const state: FrameState = ((window as any).__navigationFrames = { frames: [], events: [], done: false });
      for (const name of ['pagereveal', 'pageswap'])
        addEventListener(name, (event: any) => {
          state.events.push({ type: name, transition: !!event.viewTransition });
        });
      addEventListener('DOMContentLoaded', () => {
        const start = performance.now();
        const tick = () => {
          const values = (selector: string) =>
            [...document.querySelectorAll(selector)].map((element) => {
              const r = element.getBoundingClientRect();
              return { y: r.y, height: r.height };
            });
          state.frames.push({
            links: values('.desktop-sidebar .site-nav a'),
            buttons: values('.desktop-sidebar .site-tools button'),
          });
          if (performance.now() - start < 800) requestAnimationFrame(tick);
          else state.done = true;
        };
        requestAnimationFrame(tick);
      });
    });
    const samples = [];
    for (let step = 0; step < 3; step++) {
      const target = step % 2 ? '/archives/' : '/';
      if (step === 0) await page.goto('/');
      else
        await Promise.all([
          page.waitForURL((url) => url.pathname === target),
          page.locator(`.desktop-sidebar .site-nav a[href="${target}"]`).click(),
        ]);
      await page.waitForFunction(() => (window as any).__navigationFrames?.done);
      samples.push(await page.evaluate(() => (window as any).__navigationFrames));
    }
    fs.writeFileSync(
      path.join(evidence, `frames-${reducedMotion}.json`),
      JSON.stringify(samples, null, 2),
      { flag: 'wx' },
    );
    const reference = samples[0].frames[0];
    for (const sample of samples) {
      expect(sample.frames.length).toBeGreaterThan(1);
      for (const frame of sample.frames) expect(frame).toEqual(reference);
    }
  });
}
