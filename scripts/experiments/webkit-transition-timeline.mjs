// Diagnostic only. Never writes the sealed site. Explicit response controls are
// recorded separately from unchanged-artifact navigation measurements.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { webkit, expect } from '@playwright/test';
import { pwaServer } from '../../tests/support/pwa-server.ts';
import { verifyRelease } from '../release-integrity.mjs';
import policy from '../../deployment/release-policy.json' with { type: 'json' };
const output = path.resolve(process.argv[2]);
fs.mkdirSync(output, { recursive: false });
const candidate = path.resolve(
  process.env.PWA_ARTIFACT_ROOT || '.local-tools/releases/autuswing-20261018-r4',
);
verifyRelease(candidate, policy);
const server = await pwaServer(path.join(candidate, 'site'));
const browser = await webkit.launch();
const results = [];
const settled = (page) =>
  page.evaluate(async () => {
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    await Promise.all(
      document
        .getAnimations()
        .filter((a) => ['autuswing-page-in', 'autuswing-page-out'].includes(a.animationName))
        .map((a) => a.finished.catch(() => {})),
    );
  });
try {
  for (const instrumentation of (process.env.TRANSITION_GROUPS || 'legacy,timeline').split(','))
    for (let run = 0; run < Number(process.env.TRANSITION_RUNS || 12); run++) {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        colorScheme: 'dark',
        reducedMotion: 'no-preference',
        serviceWorkers: 'block',
      });
      const page = await context.newPage(),
        events = [],
        timeline = [],
        errors = [],
        steps = [],
        network = [];
      page.on('request', (r) => network.push({ event: 'request', url: r.url(), time: Date.now() }));
      page.on('requestfinished', (r) =>
        network.push({ event: 'finished', url: r.url(), time: Date.now() }),
      );
      const control =
        process.env.TRANSITION_RENDER_CONTROL === 'paired-styles'
          ? run % 2
            ? 'inline-styles'
            : 'raw-document'
          : process.env.TRANSITION_RENDER_CONTROL || 'none';
      if (control !== 'none')
        await page.route('**/*', async (route) => {
          if (control === 'no-modules' && route.request().resourceType() === 'script') {
            await route.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
            return;
          }
          if (
            ['inline-styles', 'raw-document'].includes(control) &&
            route.request().resourceType() === 'document'
          ) {
            const pathname = new URL(route.request().url()).pathname;
            let html = fs.readFileSync(
              path.join(candidate, 'site', pathname, 'index.html'),
              'utf8',
            );
            if (control === 'inline-styles')
              html = html.replace(
                /<link rel="stylesheet" href="(\/_astro\/[^"<>]+\.css)">/g,
                (_, url) =>
                  `<style>${fs.readFileSync(path.join(candidate, 'site', url), 'utf8')}</style>`,
              );
            await route.fulfill({
              status: 200,
              contentType: 'text/html; charset=utf-8',
              headers: { 'Cache-Control': 'no-store' },
              body: html,
            });
            return;
          }
          await route.continue();
        });
      await page.exposeFunction('recordMotion', (event) => events.push(event));
      const storageReports = [];
      if (process.env.TRANSITION_STORAGE_TRACE === '1') {
        await page.exposeFunction('recordStorageReport', (r) => storageReports.push(r));
        await page.addInitScript(() => {
          const calls = [];
          for (const name of ['localStorage', 'sessionStorage']) {
            const descriptor = Object.getOwnPropertyDescriptor(window, name);
            if (descriptor?.get && descriptor.configurable)
              Object.defineProperty(window, name, {
                ...descriptor,
                get() {
                  const t = performance.now();
                  try {
                    return descriptor.get.call(this);
                  } finally {
                    calls.push({
                      api: name,
                      duration: performance.now() - t,
                      time: performance.timeOrigin + t,
                    });
                  }
                },
              });
          }
          for (const name of ['getItem', 'setItem']) {
            const original = Storage.prototype[name];
            Storage.prototype[name] = function (...args) {
              const t = performance.now();
              try {
                return original.apply(this, args);
              } finally {
                calls.push({
                  api: name,
                  key: args[0],
                  duration: performance.now() - t,
                  time: performance.timeOrigin + t,
                });
              }
            };
          }
          const original = window.matchMedia;
          window.matchMedia = function (...args) {
            const t = performance.now();
            try {
              return original.apply(this, args);
            } finally {
              calls.push({
                api: 'matchMedia',
                query: args[0],
                duration: performance.now() - t,
                time: performance.timeOrigin + t,
              });
            }
          };
          addEventListener('DOMContentLoaded', () =>
            window.recordStorageReport({
              path: location.pathname,
              calls,
              navigation: performance.getEntriesByType('navigation').map((e) => e.toJSON()),
            }),
          );
        });
      }
      // Same ordering and awaits as the current observe() helper.
      await page.addInitScript(() => {
        window.__documentId = Math.random().toString(36);
        addEventListener('pagereveal', async (event) => {
          const record = { path: location.pathname, transition: !!event.viewTransition };
          if (event.viewTransition)
            try {
              await event.viewTransition.ready;
              record.contentName = getComputedStyle(
                document.querySelector('#main'),
              ).viewTransitionName;
              record.rootName = getComputedStyle(document.documentElement).viewTransitionName;
              record.animations = document.getAnimations().map((a) => ({
                name: a.animationName,
                duration: a.effect?.getTiming().duration,
                frames: a.effect?.getKeyframes(),
              }));
            } catch (e) {
              record.skipped = String(e);
            }
          window.recordMotion(record);
        });
      });
      if (instrumentation === 'timeline') {
        await page.exposeFunction('recordTimeline', (event) => timeline.push(event));
        await page.addInitScript(() => {
          const id = Math.random().toString(36),
            key = '__diagnostic_timeline';
          const log = (type, extra = {}) => {
            const item = {
              id,
              type,
              path: location.pathname,
              time: performance.timeOrigin + performance.now(),
              readyState: document.readyState,
              visibility: document.visibilityState,
              ...extra,
            };
            const list = JSON.parse(sessionStorage.getItem(key) || '[]');
            list.push(item);
            sessionStorage.setItem(key, JSON.stringify(list));
            window.recordTimeline(item).catch(() => {});
          };
          window.__diagnosticRevealed = false;
          window.__diagnosticFinished = false;
          log('init');
          for (const type of [
            'DOMContentLoaded',
            'load',
            'pageshow',
            'pagehide',
            'visibilitychange',
          ])
            addEventListener(type, (e) => log(type, { persisted: e.persisted }));
          addEventListener('DOMContentLoaded', () =>
            log('performance', {
              navigation: performance.getEntriesByType('navigation').map((e) => e.toJSON()),
              resources: performance.getEntriesByType('resource').map((e) => e.toJSON()),
            }),
          );
          addEventListener('pageswap', (e) => {
            log('pageswap', { transition: !!e.viewTransition });
            e.viewTransition?.ready.catch((e) => log('out-ready-rejected', { error: String(e) }));
          });
          addEventListener('pagereveal', (e) => {
            window.__diagnosticRevealed = true;
            log('pagereveal', { transition: !!e.viewTransition });
            if (!e.viewTransition) {
              window.__diagnosticFinished = true;
              return;
            }
            e.viewTransition.ready.then(
              () =>
                log('ready', {
                  animations: document.getAnimations().map((a) => ({
                    name: a.animationName,
                    duration: a.effect?.getTiming().duration,
                  })),
                }),
              (e) => log('ready-rejected', { error: String(e) }),
            );
            e.viewTransition.finished.then(
              () => {
                window.__diagnosticFinished = true;
                log('finished');
              },
              (e) => log('finished-rejected', { error: String(e) }),
            );
          });
          requestAnimationFrame(() => {
            log('raf-1');
            requestAnimationFrame(() => log('raf-2'));
          });
          addEventListener(
            'click',
            (e) => {
              const a = e.target.closest?.('a');
              if (a)
                log('click', {
                  href: a.getAttribute('href'),
                  revealed: window.__diagnosticRevealed,
                  finished: window.__diagnosticFinished,
                });
            },
            true,
          );
        });
      }
      page.on('pageerror', (e) => errors.push(String(e)));
      try {
        await page.goto(server.origin + '/');
        steps.push({
          stage: 'initial',
          path: new URL(page.url()).pathname,
          events: structuredClone(events),
        });
        await page.locator('.post-card-title a').first().click();
        await expect(page).toHaveURL(/\/post\/55b0541c\/$/);
        await settled(page);
        await expect(page.locator('.reading-rail')).toBeVisible();
        steps.push({
          stage: 'article-1',
          path: new URL(page.url()).pathname,
          events: structuredClone(events),
        });
        await page.locator('.post-navigation a').first().click();
        await settled(page);
        await expect(page.locator('.reading-rail')).toBeVisible();
        steps.push({
          stage: 'article-2',
          path: new URL(page.url()).pathname,
          events: structuredClone(events),
        });
        await page.locator('.reading-rail a[href="/about/"]').click();
        await expect(page).toHaveURL(/\/about\/$/);
        await settled(page);
        await expect(page.locator('.desktop-sidebar')).toBeVisible();
        let assertionError;
        try {
          await expect.poll(() => events.filter((e) => e.transition).length).toBe(3);
        } catch (e) {
          assertionError = String(e);
        }
        const persisted =
          instrumentation === 'timeline'
            ? await page.evaluate(() =>
                JSON.parse(sessionStorage.getItem('__diagnostic_timeline') || '[]'),
              )
            : [];
        const performanceEntries = await page.evaluate(() => ({
          navigation: performance.getEntriesByType('navigation').map((e) => e.toJSON()),
          resources: performance.getEntriesByType('resource').map((e) => e.toJSON()),
        }));
        results.push({
          instrumentation,
          control,
          run,
          steps,
          events,
          timeline,
          persisted,
          errors,
          network,
          performanceEntries,
          storageReports,
          assertionError,
          passed: !assertionError,
        });
      } catch (error) {
        results.push({
          instrumentation,
          run,
          steps,
          events,
          timeline,
          errors,
          error: String(error),
          passed: false,
        });
      } finally {
        await context.close();
      }
      fs.writeFileSync(
        path.join(output, 'timeline.json'),
        JSON.stringify({ browser: browser.version(), candidate, results }, null, 2),
      );
      console.log(
        `${instrumentation} ${run}: ${results.at(-1).passed ? '3 transitions' : 'FAILED'} ${events
          .filter((e) => e.transition)
          .map((e) => e.path)
          .join(',')}`,
      );
    }
} finally {
  await browser.close();
  await server.close();
  verifyRelease(candidate, policy);
}
console.log(`Evidence: ${output}`);
if (results.some((r) => !r.passed)) process.exitCode = 1;
