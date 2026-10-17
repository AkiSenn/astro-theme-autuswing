import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { firefox } from '@playwright/test';
import { sha256 } from '../release-integrity.mjs';
const output = path.resolve(process.argv[2]);
fs.mkdirSync(output, { recursive: false });
const html = fs.readFileSync(new URL('./linebox.html', import.meta.url));
const server = http.createServer((req, res) =>
  res
    .writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' })
    .end(html),
);
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const records = [];
try {
  for (let cold = 0; cold < 3; cold++) {
    const b = await firefox.launch({
      executablePath:
        process.env.FIREFOX_EXECUTABLE_PATH ||
        '.local-tools/firefox-recheck-20261018/browsers/firefox-1555/firefox/firefox.exe',
    });
    try {
      for (const dpr of [1, 1.25, 2]) {
        const c = await b.newContext({
            deviceScaleFactor: dpr,
            viewport: { width: 320, height: 640 },
            serviceWorkers: 'block',
            reducedMotion: 'reduce',
          }),
          p = await c.newPage();
        for (const text of ['latin', 'mixed'])
          for (const variant of [
            'original',
            'no-counter',
            'counter-same-size',
            'block-lines',
            'pixel-height',
            'explicit-consolas',
            'explicit-cascadia',
          ])
            for (const width of [320, 820, 320]) {
              await p.setViewportSize({ width, height: 640 });
              await p.goto(`${origin}/?variant=${variant}&text=${text}`);
              await p.evaluate(async () => {
                await document.fonts.ready;
                await new Promise(requestAnimationFrame);
                await new Promise(requestAnimationFrame);
              });
              const sample = () =>
                p.evaluate(() => {
                  const pre = document.querySelector('pre'),
                    code = document.querySelector('code'),
                    s = getComputedStyle(pre);
                  const rect = (n) => {
                    const r = n.getBoundingClientRect();
                    return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom };
                  };
                  return {
                    viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
                    computed: {
                      fontFamily: s.fontFamily,
                      fontSize: s.fontSize,
                      lineHeight: s.lineHeight,
                    },
                    fontStatus: document.fonts.status,
                    pre: rect(pre),
                    code: rect(code),
                    after: rect(document.querySelector('#after')),
                    lines: [...document.querySelectorAll('.line')].map((n, i) => ({
                      index: i + 1,
                      rect: rect(n),
                    })),
                  };
                });
              records.push({
                cold,
                dpr,
                width,
                text,
                variant,
                browser: b.version(),
                first: await sample(),
                second: await sample(),
              });
            }
        await c.close();
      }
    } finally {
      await b.close();
    }
    console.log(`Playwright cold process ${cold}: ${records.length} samples`);
  }
} finally {
  await new Promise((r) => server.close(r));
}
fs.writeFileSync(
  path.join(output, 'measurements.json'),
  JSON.stringify(
    {
      createdAt: new Date().toISOString(),
      fixtureSHA256: sha256(html),
      fontInspection:
        'Actual used fonts are separately inspected with InspectorUtils in the Marionette experiment. Page-world family alone is not proof of used fonts.',
      records,
    },
    null,
    2,
  ),
);
