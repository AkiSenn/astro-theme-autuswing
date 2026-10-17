import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { webkit } from '@playwright/test';
const out = path.resolve(process.argv[2]);
fs.mkdirSync(out, { recursive: false });
const css = fs.readFileSync('src/styles/motion.css', 'utf8');
const styles = `@view-transition{navigation:auto}:root{--motion-page:320ms;--motion-exit:120ms;--motion-rise:14px;--motion-ease:ease-out}${css}`;
const external = process.env.MINIMAL_CSS_EXTERNAL === '1';
const noBridge = process.env.MINIMAL_NO_BRIDGE === '1';
const runsPerMode = Number(process.env.MINIMAL_RUNS || 6);
const server = http.createServer((req, res) => {
  if (req.url === '/motion.css') {
    res.writeHead(200, { 'Content-Type': 'text/css', 'Cache-Control': 'no-store' }).end(styles);
    return;
  }
  const n = Number(req.url.replaceAll('/', '')) || 0;
  res
    .writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' })
    .end(
      `<!doctype html><html data-motion="true">${external ? '<link rel="stylesheet" href="/motion.css">' : `<style>${styles}</style>`}<main id="main"><h1>Minimal document ${n}</h1><a href="/${n + 1}/">Next</a></main></html>`,
    );
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const results = [];
let browser;
try {
  for (const reuse of [true, false])
    for (let run = 0; run < runsPerMode; run++) {
      if (!browser) browser = await webkit.launch();
      const context = await browser.newContext({
          viewport: { width: 1440, height: 900 },
          reducedMotion: 'no-preference',
          serviceWorkers: 'block',
        }),
        page = await context.newPage(),
        events = [];
      if (!noBridge) await page.exposeFunction('probe', (e) => events.push(e));
      await page.addInitScript(() => {
        const record = (type, details = {}) => {
          const e = {
            type,
            path: location.pathname,
            time: performance.timeOrigin + performance.now(),
            ...details,
          };
          const all = JSON.parse(sessionStorage.probe || '[]');
          all.push(e);
          sessionStorage.probe = JSON.stringify(all);
          window.probe?.(e)?.catch(() => {});
        };
        record('init');
        window.__finished = false;
        window.__revealed = false;
        for (const name of ['DOMContentLoaded', 'load', 'pageshow'])
          addEventListener(name, () => record(name));
        addEventListener('pageswap', (e) => {
          record('pageswap', { transition: !!e.viewTransition });
          e.viewTransition?.ready.then(
            () => record('out-ready'),
            (e) => record('out-ready-rejected', { error: String(e) }),
          );
        });
        addEventListener('pagereveal', (e) => {
          window.__revealed = true;
          record('pagereveal', { transition: !!e.viewTransition });
          if (!e.viewTransition) {
            window.__finished = true;
            return;
          }
          e.viewTransition.ready.then(
            () => record('ready', { names: document.getAnimations().map((a) => a.animationName) }),
            (e) => record('ready-rejected', { error: String(e) }),
          );
          e.viewTransition.finished.then(() => {
            window.__finished = true;
            record('finished');
          });
        });
        requestAnimationFrame(() => {
          record('raf1');
          requestAnimationFrame(() => record('raf2'));
        });
        addEventListener('click', () =>
          record('click', { revealed: window.__revealed, finished: window.__finished }),
        );
      });
      await page.goto(origin + '/0/');
      for (let hop = 0; hop < 3; hop++) {
        await page.locator('a').click();
        await page.evaluate(async () => {
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          await Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {})));
        });
      }
      const persisted = await page.evaluate(() => JSON.parse(sessionStorage.probe || '[]'));
      results.push({ reuse, run, events, persisted });
      console.log(
        `minimal reuse=${reuse} run=${run}: ${persisted.filter((e) => e.type === 'pagereveal' && e.transition).length}/3`,
      );
      await context.close();
      if (!reuse || run === runsPerMode - 1) {
        await browser.close();
        browser = undefined;
      }
      fs.writeFileSync(
        path.join(out, 'minimal.json'),
        JSON.stringify({ origin, externalCSS: external, noBridge, runsPerMode, results }, null, 2),
      );
    }
} finally {
  await browser?.close();
  await new Promise((r) => server.close(r));
}
if (
  results.some(
    (r) => r.persisted.filter((e) => e.type === 'pagereveal' && e.transition).length !== 3,
  )
)
  process.exitCode = 1;
