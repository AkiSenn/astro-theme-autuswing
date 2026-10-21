import { test as base, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { randomUUID } from 'node:crypto';
import ts from 'typescript';
import { evidenceDirectory } from '../../scripts/test-evidence.mjs';
import { createPrefetchTLS } from './helpers/prefetch-tls';

const evidence = evidenceDirectory('prefetch');
fs.mkdirSync(evidence, { recursive: true });
const test = base.extend<{}, { prefetchTLS: ReturnType<typeof createPrefetchTLS> }>({
  prefetchTLS: [
    async ({}, use) => {
      await use(createPrefetchTLS(path.join(evidence, 'tls')));
    },
    { scope: 'worker' },
  ],
  browser: [
    async ({ browserName, playwright, launchOptions, headless, channel, prefetchTLS }, use) => {
      if (browserName !== 'chromium') {
        const browser = await playwright[browserName].launch({ ...launchOptions, headless });
        try {
          await use(browser);
        } finally {
          await browser.close();
        }
        return;
      }
      if (
        (launchOptions.args || []).some((arg) =>
          /^--(ignore-certificate-errors|ignore-certificate-errors-spki-list|allow-insecure-localhost)(=|$)/.test(
            arg,
          ),
        )
      )
        throw new Error('Prefetch TLS tests must not bypass certificate validation');
      const context = await playwright.chromium.launchPersistentContext(
        prefetchTLS.createChromiumProfile(),
        { ...launchOptions, headless, channel, ignoreHTTPSErrors: false },
      );
      try {
        await use(context.browser()!);
      } finally {
        await context.close();
      }
    },
    { scope: 'worker' },
  ],
});
const extensions = ['xml', 'json', 'js', 'css', 'png', 'jpg', 'webp', 'zip', 'pdf'];
type RequestRecord = { url: string; purpose: string; destination: string; mode: string };
let server: https.Server, origin: string;
const requests: RequestRecord[] = [];
const isPrefetch = (record: RequestRecord) => /prefetch/i.test(record.purpose);
function save(name: string, data: unknown) {
  fs.writeFileSync(path.join(evidence, name + '.json'), JSON.stringify(data, null, 2), {
    flag: 'wx',
  });
}

// Edge 使用 profile 内独立 CA 正常验链；本轮不改变其他引擎原有夹具行为。
test.use({ ignoreHTTPSErrors: async ({ browserName }, use) => use(browserName !== 'chromium') });

test.beforeAll(async ({ prefetchTLS }) => {
  const source = fs.readFileSync('src/scripts/prefetch.js', 'utf8');
  const helpers = ts.transpileModule(fs.readFileSync('src/scripts/helpers.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  server = https.createServer(
    {
      key: prefetchTLS.key,
      cert: prefetchTLS.cert,
    },
    (req, res) => {
      const url = new URL(req.url!, origin);
      requests.push({
        url: url.href,
        purpose: String(req.headers['sec-purpose'] || req.headers.purpose || ''),
        destination: String(req.headers['sec-fetch-dest'] || ''),
        mode: String(req.headers['sec-fetch-mode'] || ''),
      });
      if (url.pathname === '/prefetch.js' || url.pathname === '/helpers') {
        res.setHeader('Content-Type', 'text/javascript');
        res.end(url.pathname === '/prefetch.js' ? source : helpers);
        return;
      }
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=60');
      if (url.pathname === '/probe/') {
        const token = url.searchParams.get('probe') || 'none';
        const links = [
          ['article', '/post/normal/', ''],
          ['archive', '/archives/', ''],
          ['category', '/categories/demo/', ''],
          ...extensions.map((ext) => [
            ext,
            ext === 'json' ? '/search.json' : ext === 'xml' ? '/atom.xml' : '/a.' + ext,
            '',
          ]),
          ['nested', '/nested/deep/file.json', ''],
          ['download', '/download/', 'download'],
          ['blank', '/blank/', 'target="_blank"'],
          ['hash', '/post/anchor/', ''],
        ];
        res.end(`<!doctype html><html><head><title>Prefetch probe</title>
        <style>a{display:block;padding:4px;font:14px/20px sans-serif}section{height:600px}</style>
        <script id="autuswing-config" type="application/json">${JSON.stringify({ instantNav: url.searchParams.get('disabled') !== '1', root: '/' })}</script>
        <script type="module" src="/prefetch.js"></script></head><body>
        ${links.map(([id, href, attributes]) => `<a id="${id}" ${attributes} href="${href}?probe=${token}${id === 'nested' ? '&q=1' : ''}${id === 'hash' ? '#heading' : ''}">${id}</a>`).join('')}
        </body></html>`);
      } else {
        // 资源路径也返回无脚本 HTML，避免 MIME 类型拒绝掩盖错误的规则匹配。
        res.end(
          '<!doctype html><html><head><title>Target</title></head><body><section></section><h1 id="heading">Target heading</h1></body></html>',
        );
      }
    },
  );
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `https://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}`;
});
test.afterAll(async () => {
  if (server)
    await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
});

test('isolated TLS trust rejects unknown issuer and wrong hostname', async ({
  page,
  browserName,
  prefetchTLS,
}) => {
  test.skip(browserName !== 'chromium', 'This change verifies Chromium profile-scoped trust only.');
  expect((await page.goto(origin + '/probe/?disabled=1'))?.status()).toBe(200);
  const results = [];
  for (const [name, pair, expected] of [
    ['untrusted', prefetchTLS.untrusted, /ERR_CERT_AUTHORITY_INVALID/],
    ['wrong-host', prefetchTLS.wrongHost, /ERR_CERT_COMMON_NAME_INVALID/],
  ] as const) {
    let received = 0;
    const invalid = https.createServer(pair, (_req, res) => {
      received++;
      res.end('Unexpected');
    });
    await new Promise<void>((resolve) => invalid.listen(0, '127.0.0.1', resolve));
    try {
      const target =
        'https://127.0.0.1:' + (invalid.address() as import('node:net').AddressInfo).port + '/';
      let failure = '';
      await expect(
        page.goto(target).catch((error) => {
          failure = error.message;
          throw error;
        }),
      ).rejects.toThrow(expected);
      expect(received).toBe(0);
      results.push({ name, failure, received });
    } finally {
      await new Promise<void>((resolve) => invalid.close(() => resolve()));
    }
  }
  save('tls-validation', { ignoreHTTPSErrors: false, profileScopedTrust: true, results });
});

test('native capability, one installation and repeated module execution', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(origin + '/probe/');
  const supported = await page.evaluate(
    () =>
      typeof HTMLScriptElement.supports === 'function' &&
      HTMLScriptElement.supports('speculationrules'),
  );
  await page.evaluate(async () => {
    const moduleURL = '/prefetch.js';
    const module = await import(moduleURL);
    module.initPrefetch();
    module.initPrefetch();
    await import(moduleURL + '?second-instance');
  });
  await expect(page.locator('script[type="speculationrules"]')).toHaveCount(supported ? 1 : 0);
  expect(errors).toEqual([]);
  save('capability', {
    supported,
    errors,
    injected: await page.locator('script[type="speculationrules"]').count(),
    browser: test.info().project.name,
  });
});

test('native URLPattern matrix preserves exact resource and link boundaries', async ({ page }) => {
  await page.goto(origin + '/probe/?disabled=1');
  const result = await page.evaluate(async () => {
    const moduleURL = '/prefetch.js';
    const module = await import(moduleURL);
    const base = 'https://example.test/';
    const cases: { href: string; expected: boolean; attributes?: Record<string, string> }[] = [
      { href: '/post/normal/', expected: true },
      { href: '/archives/', expected: true },
      { href: '/categories/demo/', expected: true },
      { href: '/nested/article/?q=1', expected: true },
      { href: '/page/?file=a.json', expected: true },
      { href: '/a.jpeg', expected: true },
      { href: '/a.svg', expected: true },
      { href: '/a.txt', expected: true },
      { href: '/a.JSON', expected: true },
      { href: '/directory.json/', expected: true },
      { href: '/post/normal/#heading', expected: false },
      { href: '/post/normal/', attributes: { download: '' }, expected: false },
      { href: '/post/normal/', attributes: { target: '_blank' }, expected: false },
      { href: '/post/normal/', attributes: { target: '_self' }, expected: true },
      { href: 'https://elsewhere.test/post/', expected: false },
    ];
    for (const ext of ['xml', 'json', 'js', 'css', 'png', 'jpg', 'webp', 'zip', 'pdf']) {
      cases.push(
        { href: '/a.' + ext, expected: false },
        { href: '/nested/deep/a.' + ext, expected: false },
        { href: '/nested/a.' + ext + '?q=1', expected: false },
      );
    }
    cases.push({ href: '/search.json', expected: false }, { href: '/atom.xml', expected: false });
    function matches(predicate: any, anchor: HTMLAnchorElement): boolean {
      if (predicate.and) return predicate.and.every((p: any) => matches(p, anchor));
      if (predicate.or) return predicate.or.some((p: any) => matches(p, anchor));
      if (predicate.not) return !matches(predicate.not, anchor);
      if (predicate.selector_matches) return anchor.matches(predicate.selector_matches);
      const input = predicate.href_matches;
      const pattern =
        typeof input === 'string'
          ? new URLPattern(input, base)
          : new URLPattern({ ...input, baseURL: base });
      return pattern.test(anchor.href);
    }
    const rows = [];
    for (const root of ['/', '/blog/']) {
      const rule = module.createPrefetchRules(root).prefetch[0];
      for (const item of cases) {
        const anchor = document.createElement('a');
        const href =
          root === '/blog/' && item.href.startsWith('/') ? '/blog' + item.href : item.href;
        anchor.setAttribute('href', new URL(href, base).href);
        for (const [name, value] of Object.entries(item.attributes || {}))
          anchor.setAttribute(name, value);
        rows.push({
          root,
          href,
          attributes: item.attributes || {},
          expected: item.expected,
          actual: matches(rule.where, anchor),
        });
      }
      if (root === '/blog/') {
        const anchor = document.createElement('a');
        anchor.href = base + 'outside/';
        rows.push({
          root,
          href: anchor.href,
          attributes: {},
          expected: false,
          actual: matches(rule.where, anchor),
        });
      }
    }
    return { rows, failures: rows.filter((row) => row.expected !== row.actual) };
  });
  save('urlpattern-matrix', result);
  expect(result.failures).toEqual([]);
});

test('native network prefetch respects resource and link exclusions', async ({
  page,
  browserName,
}) => {
  const token = randomUUID();
  const native: { method: string; params: any }[] = [];
  const cdp = browserName === 'chromium' ? await page.context().newCDPSession(page) : undefined;
  if (cdp) {
    for (const method of [
      'Preload.prefetchStatusUpdated',
      'Preload.preloadEnabledStateUpdated',
      'Network.loadingFailed',
      'Network.responseReceived',
    ] as const)
      cdp.on(method, (params) => native.push({ method, params }));
    await cdp.send('Network.enable');
    await cdp.send('Preload.enable');
  }
  await page.goto(origin + '/probe/?probe=' + token);
  const supported = await page.evaluate(
    () =>
      typeof HTMLScriptElement.supports === 'function' &&
      HTMLScriptElement.supports('speculationrules'),
  );
  if (!supported) {
    save('network', { status: 'native-api-unsupported', supported, browserName, requests: [] });
    test.skip(
      true,
      'Native Speculation Rules unavailable; fallback is tested separately, no simulated native pass.',
    );
  }
  const own = () =>
    requests.filter((record) => new URL(record.url).searchParams.get('probe') === token);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  async function intent(id: string, observe: () => Promise<void>) {
    await page.locator('#' + id).hover();
    // Chromium 已验证悬停触发；只为其他引擎补真实按下，不额外点击 Chromium 链接。
    if (browserName === 'chromium') {
      await observe();
      return;
    }
    // WebKit 的 moderate 实际响应 pointerdown；保持真实按下但不松手点击导航。
    await page.mouse.down();
    try {
      await observe();
    } finally {
      // 仅在夹具里取消此次 click；先松手再移动，避免取消导航的手势变成拖拽。
      await page.evaluate(() =>
        document.addEventListener('click', (event) => event.preventDefault(), {
          once: true,
          capture: true,
        }),
      );
      await page.mouse.up();
      await page.mouse.move(0, 0);
    }
  }
  // 正向控制必须真正收到带预取标头的请求，不能以 supports=true 代替网络验收。
  try {
    await intent('article', async () => {
      await expect
        .poll(
          () =>
            own().filter((r) => new URL(r.url).pathname === '/post/normal/' && isPrefetch(r))
              .length,
        )
        .toBe(1);
    });
    const excluded = [...extensions, 'nested', 'download', 'blank', 'hash'];
    const observations = [];
    for (const id of excluded) {
      const href = await page.locator('#' + id).getAttribute('href');
      // hover + pointerdown 后观察800ms；前后均有真实请求正向控制。
      await intent(id, async () => {
        await page.waitForTimeout(800);
      });
      const pathname = new URL(href!, origin).pathname;
      const seen = own().filter((record) => new URL(record.url).pathname === pathname);
      observations.push({ id, href, windowMs: 800, requests: seen });
      expect(seen, id).toEqual([]);
    }
    await intent('archive', async () => {
      await expect
        .poll(
          () =>
            own().filter((r) => new URL(r.url).pathname === '/archives/' && isPrefetch(r)).length,
        )
        .toBe(1);
    });
    if (cdp) {
      for (const pathname of ['/post/normal/', '/archives/'])
        await expect
          .poll(() =>
            native.some(
              (event) =>
                event.method === 'Preload.prefetchStatusUpdated' &&
                event.params.status === 'Ready' &&
                new URL(event.params.prefetchUrl).pathname === pathname,
            ),
          )
          .toBe(true);
      expect(native.filter((event) => event.method === 'Network.loadingFailed')).toEqual([]);
      expect(
        native
          .filter(
            (event) =>
              event.method === 'Network.responseReceived' && event.params.type === 'Prefetch',
          )
          .map((event) => event.params.response.securityState),
      ).toEqual(['secure', 'secure']);
    }
    expect(new URL(page.url()).pathname).toBe('/probe/');
    expect(errors).toEqual([]);
    save('network', {
      status: 'observed',
      supported,
      browserName,
      observations,
      requests: own(),
      errors,
      native,
    });
  } catch (error) {
    save('network', {
      status: 'not-fully-verified',
      supported,
      browserName,
      requests: own(),
      errors,
      native,
    });
    throw error;
  }
});

test('normal document requests, anchors and history remain distinct from prefetch', async ({
  page,
}) => {
  const token = randomUUID();
  await page.goto(origin + '/probe/?probe=' + token);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.locator('#hash').click();
  await expect(page).toHaveURL(/\/post\/anchor\/\?probe=.*#heading$/);
  const own = () =>
    requests.filter((record) => new URL(record.url).searchParams.get('probe') === token);
  expect(
    own().some(
      (record) =>
        new URL(record.url).pathname === '/post/anchor/' &&
        record.destination === 'document' &&
        !isPrefetch(record),
    ),
  ).toBe(true);
  await page.goBack();
  await expect(page).toHaveURL(/\/probe\//);
  await page.goForward();
  await expect(page).toHaveURL(/#heading$/);
  expect(errors).toEqual([]);
  save('document-navigation', { requests: own(), errors });
});

for (const width of [1440, 390]) {
  test(`built MPA navigation, anchors and history ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/');
    const supported = await page.evaluate(
      () =>
        typeof HTMLScriptElement.supports === 'function' &&
        HTMLScriptElement.supports('speculationrules'),
    );
    await expect(page.locator('script[data-autuswing-prefetch]')).toHaveCount(supported ? 1 : 0);
    await page.locator('nav:visible a[href="/archives/"]').click();
    await expect(page).toHaveURL(/\/archives\/$/);
    await page.locator('#main a[href^="/post/"]').first().click();
    await expect(page).toHaveURL(/\/post\/[^/]+\/$/);
    const article = page.url();
    const link = page.locator('.toc-link:visible').first();
    if (!(await link.isVisible()))
      await page.locator('button[aria-controls="reading-contents"]:visible').click();
    const hash = await page.locator('.toc-link:visible').first().getAttribute('href');
    const expectedHash = new URL(hash!, article).hash;
    await page.locator('.toc-link:visible').first().click();
    await expect.poll(() => new URL(page.url()).hash).toBe(expectedHash);
    await page.goBack();
    await expect(page).toHaveURL(article);
    await page.goForward();
    await expect.poll(() => new URL(page.url()).hash).toBe(expectedHash);
    await expect(page.locator('script[data-autuswing-prefetch]')).toHaveCount(supported ? 1 : 0);
    expect(errors).toEqual([]);
    save('built-' + width, { supported, article, hash, errors });
  });
}
