import { test, expect } from '@playwright/test';
import postcss from 'postcss';
import { assertLegacyMediaQuery } from '../../scripts/css-media-compat.mjs';

// This is a syntax fault model, NOT an iOS emulator. Real iOS 14.8/16.0
// acceptance remains a separate device check. No UA or device detection.
test('MQ3 predicates retain exact range semantics at fractional breakpoints and in print', async ({
  page,
}) => {
  await page.goto('/');
  const definitions = [
    { range: '(width < 720px)', legacy: ['not all and (min-width:720px)'] },
    {
      range: '(720px <= width < 1000px)',
      legacy: ['(min-width:720px)', 'not all and (min-width:1000px)'],
    },
    { range: '(width < 1000px)', legacy: ['not all and (min-width:1000px)'] },
    { range: 'screen and (width < 1280px)', legacy: ['screen', 'not all and (min-width:1280px)'] },
    {
      range: 'screen and (1280px <= width < 1440px)',
      legacy: ['screen', '(min-width:1280px)', 'not all and (min-width:1440px)'],
    },
    { range: '(width <= 450px)', legacy: ['(max-width:450px)'] },
    { range: '(width <= 760px)', legacy: ['(max-width:760px)'] },
  ];
  const css = definitions
    .map(({ range, legacy }, i) => {
      const nested = legacy.reduceRight(
        (inner, query) => `@media ${query}{${inner}}`,
        `#probe{--legacy-${i}:1}`,
      );
      return `@media ${range}{#probe{--range-${i}:1}}${nested}`;
    })
    .join('\n');
  await page.evaluate((css) => {
    const frame = document.createElement('iframe');
    frame.id = 'breakpoint-probe';
    frame.style.cssText = 'border:0;height:100px;max-width:none';
    document.body.append(frame);
    frame.contentDocument!.open();
    frame.contentDocument!.write(`<style>${css}</style><div id="probe"></div>`);
    frame.contentDocument!.close();
  }, css);
  for (const media of ['screen', 'print'] as const) {
    await page.emulateMedia({ media });
    for (const width of [
      320, 449.5, 450, 450.5, 719.5, 719.984375, 720, 759.5, 760, 760.5, 999.5, 999.984375, 1000,
      1279.5, 1280, 1439.5, 1440, 1920,
    ]) {
      const results = await page.evaluate(
        async ({ width, count }) => {
          const frame = document.querySelector<HTMLIFrameElement>('#breakpoint-probe')!;
          frame.style.width = `${width}px`;
          // WebKit invalidates an iframe's media styles asynchronously when
          // its viewport or emulated print medium changes.
          frame.getBoundingClientRect();
          await new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          );
          const style = frame.contentWindow!.getComputedStyle(
            frame.contentDocument!.querySelector('#probe')!,
          );
          return Array.from({ length: count }, (_, i) => [
            style.getPropertyValue(`--range-${i}`),
            style.getPropertyValue(`--legacy-${i}`),
          ]);
        },
        { width, count: definitions.length },
      );
      const expected = [
        width < 720,
        width >= 720 && width < 1000,
        width < 1000,
        media === 'screen' && width < 1280,
        media === 'screen' && width >= 1280 && width < 1440,
        width <= 450,
        width <= 760,
      ];
      results.forEach(([range, legacy], i) => {
        // Engines may quantize an iframe's fractional viewport. Compare both
        // predicates in that same viewport; integer widths also have an
        // independent expected result.
        const label = `${media} ${width} ${definitions[i].range}`;
        if (Number.isInteger(width)) expect(legacy.trim(), label).toBe(expected[i] ? '1' : '');
        expect(legacy, label).toBe(range);
      });
    }
  }
});

test('unsupported-media fault model keeps home and article shells responsive without JavaScript', async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(120000);
  const context = await browser.newContext({ javaScriptEnabled: false });
  let discarded = 0;
  const model = (css: string) => {
    const root = postcss.parse(css);
    root.walkAtRules('media', (rule) => {
      try {
        assertLegacyMediaQuery(rule.params);
      } catch {
        rule.remove();
        discarded++;
      }
    });
    return root.toString();
  };
  await context.route('**/*', async (route) => {
    const response = await route.fetch();
    const type = response.headers()['content-type'] || '';
    if (type.includes('text/css'))
      await route.fulfill({ response, body: model(await response.text()) });
    else if (type.includes('text/html')) {
      const html = (await response.text()).replace(
        /(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi,
        (_, start, css, end) => start + model(css) + end,
      );
      await route.fulfill({ response, body: html });
    } else await route.fulfill({ response });
  });
  try {
    const page = await context.newPage();
    for (const width of [
      320, 375, 390, 430, 719, 720, 768, 820, 999, 1000, 1024, 1279, 1280, 1366, 1439, 1440, 1920,
      2560,
    ]) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of ['/', '/post/55b0541c/']) {
        await page.goto(new URL(path, baseURL).href);
        await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
          'content',
          'width=device-width, initial-scale=1',
        );
        const active =
          width < 720
            ? '.mobile-header'
            : width < 1000 || path !== '/'
              ? '.tablet-sidebar'
              : '.desktop-sidebar';
        await expect(page.locator(active)).toBeVisible();
        await expect(
          page.locator('.desktop-sidebar:visible,.tablet-sidebar:visible,.mobile-header:visible'),
        ).toHaveCount(1);
        const metrics = await page.evaluate(() => ({
          margin: getComputedStyle(document.querySelector('.main-shell')!).marginLeft,
          width: window.innerWidth,
          client: document.documentElement.clientWidth,
          scroll: document.documentElement.scrollWidth,
        }));
        expect(metrics.width).toBe(width);
        expect(metrics.scroll).toBeLessThanOrEqual(metrics.client + 1);
        if (width < 720) expect(metrics.margin).toBe('0px');
        if (path !== '/' && [1279, 1280, 1439, 1440].includes(width)) {
          if (width >= 1280) await expect(page.locator('.reading-sidebar')).toBeVisible();
          else await expect(page.locator('.reading-sidebar')).not.toBeVisible();
        }
      }
    }
    // Fixed output should require no syntax stripping at all.
    expect(discarded).toBe(0);
  } finally {
    await context.close();
  }
});
