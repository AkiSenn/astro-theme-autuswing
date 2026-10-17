import { expect, type Page } from '@playwright/test';

// Firefox references measure the fully rendered article, including images
// below the fold. Otherwise lazy image completion changes footer/flow height
// between captures. Do not alter CSS or normalize away measured geometry.
export async function firefoxLayoutReady(page: Page) {
  const failed = await page.evaluate(async () => {
    const images = [...document.images].filter((img) => !!img.getAttribute('src'));
    images.forEach((img) => {
      img.loading = 'eager';
    });
    await document.fonts.ready;
    const failures = await Promise.all(
      images.map(async (img) => {
        try {
          await img.decode();
          return null;
        } catch {
          return img.src;
        }
      }),
    );
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    return failures.filter(Boolean);
  });
  expect(failed, 'Layout reference requires decoded images, not a partially loaded page').toEqual(
    [],
  );
}
