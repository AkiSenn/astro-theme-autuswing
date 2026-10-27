import { test, expect, type Page } from '@playwright/test';
import { load } from 'cheerio';

const sample = '/__test__/reading/';
const headings = [1, 2, 3, 4].flatMap((chapter) =>
  [2, 3, 4, ...(chapter === 4 ? [5, 6] : [])].map((depth) => ({
    id: `section-${chapter}-${depth}`,
    depth,
  })),
);
const paragraph = '<p>' + '长文章反向阅读时，当前章节应由实际阅读位置确定。'.repeat(12) + '</p>';

async function fixture(page: Page, min = 2, max = 4) {
  const selected = headings.filter((h) => h.depth >= min && h.depth <= max);
  await page.route('**' + sample, async (route) => {
    const response = await route.fetch({
      url: new URL('/post/55b0541c/', route.request().url()).href,
    });
    const $ = load(await response.text());
    $('.article .prose').html(
      headings
        .map((h) => `<h${h.depth} id="${h.id}">${h.id}</h${h.depth}>${paragraph.repeat(15)}`)
        .join(''),
    );
    $('.toc').each((_, node) => {
      $(node).html(
        selected
          .map(
            (h) =>
              `<li class="toc-item toc-level-${h.depth}" style="--depth:${h.depth - min}"><a class="toc-link" href="#${h.id}"><span class="toc-text">${h.id}</span></a></li>`,
          )
          .join(''),
      );
    });
    $('.contents-count').text(selected.length);
    $('link[rel=canonical]').attr('href', 'https://akisenn.com' + sample);
    await route.fulfill({
      response,
      body: $.html(),
      headers: { ...response.headers(), 'x-robots-tag': 'noindex, nofollow' },
    });
  });
  return selected;
}
async function settled(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve))),
      ),
  );
}
async function chapter(page: Page, id: string) {
  await expect(page.locator('.reading-sidebar .toc-link.active')).toHaveAttribute('href', '#' + id);
  await expect(page.locator('.contents-dialog .toc-link.active')).toHaveAttribute('href', '#' + id);
  await expect(page.locator(`.toc-link[href="#${id}"]`).first()).toHaveAttribute(
    'aria-current',
    'location',
  );
}
async function middle(page: Page, id: string) {
  await page
    .locator('#' + id)
    .evaluate((node) =>
      scrollTo({ top: node.getBoundingClientRect().top + scrollY + 500, behavior: 'instant' }),
    );
  await chapter(page, id);
}

test.use({ reducedMotion: 'reduce', viewport: { width: 1440, height: 1000 } });
for (const width of [1440, 820, 390]) {
  test(`TOC long sections, reverse scroll and existing controls at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    const selected = await fixture(page);
    await page.goto(sample);
    await settled(page);
    const x = await page.locator('.article').evaluate((node) => node.getBoundingClientRect().x);
    for (const h of selected) await middle(page, h.id);
    await page.evaluate(() =>
      scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }),
    );
    await chapter(page, selected.at(-1)!.id);
    for (const h of [...selected].reverse()) await middle(page, h.id);
    await middle(page, 'section-3-2');
    for (let i = 0; i < 12; i++) {
      await page.mouse.wheel(0, -600);
      await settled(page);
    }
    const actualY = await page.evaluate(() => scrollY);
    expect(actualY).toBeGreaterThan(0);
    if (width === 1440) {
      await page.locator('.reading-contents-close:visible').click();
      await page.locator('.contents-open:visible').first().click();
      await page.locator('.reading-sidebar .toc-link[href="#section-2-3"]').click();
    } else {
      const opener = page.locator('.contents-open:visible,.goto-toc:visible').first();
      await opener.click();
      await expect(page.locator('.contents-dialog')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(opener).toBeFocused();
      await opener.click();
      await page.locator('.contents-dialog .toc-link[href="#section-2-3"]').click();
      await expect(page.locator('.contents-dialog')).not.toBeVisible();
    }
    await chapter(page, 'section-2-3');
    expect(await page.locator('.article').evaluate((node) => node.getBoundingClientRect().x)).toBe(
      x,
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
    const before = await page.evaluate(() => scrollY);
    await page.goto('/archives/');
    await page.goBack();
    await chapter(page, 'section-2-3');
    expect(await page.evaluate(() => scrollY)).toBe(before);
  });
}

for (const [min, max] of [
  [2, 2],
  [3, 4],
  [2, 6],
]) {
  test(`TOC follows the rendered depth ${min}–${max}`, async ({ page }) => {
    const selected = await fixture(page, min, max);
    await page.goto(sample);
    await settled(page);
    for (const h of selected) await middle(page, h.id);
    for (const h of [...selected].reverse()) await middle(page, h.id);
  });
}

test('hash direct visit, same-document history and cache invalidation after layout changes', async ({
  page,
}) => {
  await fixture(page);
  await page.goto(sample + '#section-3-2');
  await chapter(page, 'section-3-2');
  await page.locator('.reading-sidebar .toc-link[href="#section-2-2"]').click();
  await chapter(page, 'section-2-2');
  await page.goBack();
  await chapter(page, 'section-3-2');
  await page.goForward();
  await chapter(page, 'section-2-2');
  await middle(page, 'section-2-2');
  const y = await page.evaluate(() => scrollY);
  await page.locator('#section-2-2').evaluate((node) => {
    const space = document.createElement('div');
    space.style.height = '2200px';
    space.id = 'late-layout';
    node.before(space);
  });
  await settled(page);
  await page.evaluate((y) => scrollTo({ top: y, behavior: 'instant' }), y);
  await chapter(page, 'section-1-4');
  await page.locator('#late-layout').evaluate((node) => node.remove());
  await chapter(page, 'section-2-2');
});

test('steady scrolling uses cached heading positions and preserves other reading controls', async ({
  page,
}, info) => {
  await page.addInitScript(() => {
    (window as any).__readingMeasures = { headings: 0, queries: 0 };
    const rect = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function () {
      if (this.matches('.prose :is(h2,h3,h4,h5,h6)')) (window as any).__readingMeasures.headings++;
      return rect.call(this);
    };
    const query = document.querySelectorAll.bind(document);
    document.querySelectorAll = ((selector: string) => {
      if (selector === '.toc-link') (window as any).__readingMeasures.queries++;
      return query(selector);
    }) as typeof document.querySelectorAll;
  });
  await fixture(page);
  await page.goto(sample);
  await settled(page);
  await middle(page, 'section-2-2');
  await settled(page);
  const before = await page.evaluate(() => ({ ...(window as any).__readingMeasures }));
  const samples = await page.evaluate(async () => {
    const samples: number[] = [];
    for (let i = 0; i < 20; i++) {
      const start = performance.now();
      scrollBy({ top: 5, behavior: 'instant' });
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      samples.push(performance.now() - start);
    }
    return samples;
  });
  const after = await page.evaluate(() => ({ ...(window as any).__readingMeasures }));
  expect(after.headings - before.headings).toBe(0);
  expect(after.queries - before.queries).toBe(0);
  await expect(page.locator('.back-top')).toBeVisible();
  await page.locator('.back-top').click();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  await info.attach('scroll-cache-measurements', {
    body: JSON.stringify({ before, after, framePairMs: samples }),
    contentType: 'application/json',
  });
});

test('scrolling works without IntersectionObserver and without ResizeObserver', async ({
  page,
}) => {
  await page.addInitScript(() => {
    delete (window as any).IntersectionObserver;
    delete (window as any).ResizeObserver;
  });
  await fixture(page);
  await page.goto(sample);
  await middle(page, 'section-3-2');
  await middle(page, 'section-2-2');
  await page.setViewportSize({ width: 820, height: 1000 });
  await settled(page);
  await middle(page, 'section-2-2');
});

test('legacy dialog capability model preserves the reading chapter and scroll restoration', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', {
      configurable: true,
      value: undefined,
    });
  });
  await fixture(page);
  await page.goto(sample);
  await middle(page, 'section-2-2');
  const y = await page.evaluate(() => scrollY);
  const opener = page.locator('.goto-toc:visible');
  await opener.click();
  await expect(page.locator('.contents-dialog')).toBeVisible();
  await chapter(page, 'section-2-2');
  await page.keyboard.press('Escape');
  await expect(opener).toBeFocused();
  expect(await page.evaluate(() => scrollY)).toBe(y);
  await opener.click();
  await page.locator('.contents-dialog .toc-link[href="#section-3-2"]').click();
  await expect(page.locator('.contents-dialog')).not.toBeVisible();
  await chapter(page, 'section-3-2');
});

test.describe('normal page motion', () => {
  test.use({ reducedMotion: 'no-preference' });
  test('entry animation and the theme motion switch leave chapter coordinates correct', async ({
    page,
  }) => {
    await fixture(page);
    await page.goto(sample + '#section-3-2');
    await page.locator('#main').evaluate(async (node) => {
      await Promise.all(
        node.getAnimations().map((animation) => animation.finished.catch(() => {})),
      );
    });
    await chapter(page, 'section-3-2');
    await middle(page, 'section-2-2');
    await page.evaluate(() => {
      document.documentElement.dataset.motion = 'false';
    });
    await middle(page, 'section-3-2');
    await middle(page, 'section-2-2');
  });
});
