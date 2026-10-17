import { type Browser, type Page } from '@playwright/test';
import { firefoxLayoutReady } from './layout-ready';

// A steady viewport reference must start at that viewport. Resizing a reused
// Firefox document produced different inline code line-box metrics even after
// fonts/images completed. Isolation alone did not resolve every difference;
// the reference loader therefore requires a validated repeatability marker.
// Resize interactions are exercised by responsive.spec.
export async function referencePage(
  browser: Browser,
  original: Page,
  browserName: string,
  sample: { width: number; height: number; path: string },
  check: (page: Page) => Promise<void>,
) {
  const context =
    browserName === 'firefox'
      ? await browser.newContext({
          viewport: { width: sample.width, height: sample.height },
          baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:4322',
          colorScheme: 'dark',
          reducedMotion: 'reduce',
          serviceWorkers: 'block',
        })
      : undefined;
  try {
    const page = context ? await context.newPage() : original;
    if (!context) await page.setViewportSize({ width: sample.width, height: sample.height });
    await page.goto(sample.path);
    await page.evaluate(() => document.fonts.ready);
    if (browserName === 'firefox') await firefoxLayoutReady(page);
    await check(page);
  } finally {
    await context?.close();
  }
}
