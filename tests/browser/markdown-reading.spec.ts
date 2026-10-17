import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { installMarkdownFixture, samplePath } from './markdown-fixture';

const evidence = process.env.VISUAL_EVIDENCE_DIR || 'docs/evidence/writing-reading/browser';
const sizes = [
  [320, 740],
  [390, 844],
  [430, 932],
  [768, 1024],
  [820, 1180],
  [1180, 820],
  [1366, 768],
  [1440, 900],
  [1920, 1080],
  [2560, 1440],
];

for (const [width, height] of sizes)
  test(`Markdown sample ${width}x${height}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height });
    await installMarkdownFixture(page);
    await page.addInitScript(() =>
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async (text: string) => {
            (window as any).__copied = text;
          },
        },
      }),
    );
    await page.goto(samplePath);
    await expect(page.locator('.article-header h1')).toHaveText('Markdown 阅读测试样本');
    await expect(page.locator('.code-filename').first()).toHaveText('src/examples/reading-demo.ts');
    await expect(page.locator('.code-block').first().locator('.code-line-add')).toHaveCount(1);
    const block = page.locator('.code-block').first(),
      pre = block.locator('pre');
    await block.scrollIntoViewIfNeeded();
    const raw = await block.locator('code').textContent();
    const before = await block.locator('.copy-code').boundingBox();
    expect(await pre.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true);
    await pre.evaluate((node) => {
      node.scrollLeft = node.scrollWidth;
    });
    const after = await block.locator('.copy-code').boundingBox();
    expect(Math.abs(before!.x - after!.x)).toBeLessThan(1);
    await block.locator('.copy-code').click();
    expect(await page.evaluate(() => (window as any).__copied)).toBe(raw);
    for (const wrapper of await page.locator('.table-wrap').all()) {
      expect(
        await wrapper.evaluate((node) => node.clientWidth <= node.parentElement!.clientWidth),
      ).toBe(true);
      await wrapper.evaluate((node) => {
        node.scrollLeft = node.scrollWidth;
      });
    }
    await expect(page.locator('.admonition')).toHaveCount(2);
    await expect(page.locator('.prose [data-footnotes]')).toHaveCount(1);
    await expect(page.locator('.prose math')).toHaveCount(4);
    const heading = page.getByRole('heading', { name: '代码与文件名', exact: true });
    const anchor = heading.getByRole('button');
    await anchor.focus();
    await anchor.click();
    expect(await page.evaluate(() => (window as any).__copied)).toBe(
      'https://akisenn.com' + samplePath + '#' + encodeURIComponent('代码与文件名'),
    );
    const img = page.locator('.prose img').first();
    await expect(img).toHaveAttribute('width', '1440');
    await expect(img).toHaveAttribute('height', '840');
    await img.scrollIntoViewIfNeeded();
    await img.evaluate((node: HTMLImageElement) => node.decode());
    await img.click();
    await expect(page.locator('.image-dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.image-dialog')).not.toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    const engine = info.project.name || 'edge';
    fs.mkdirSync(path.join(evidence, engine), { recursive: true });
    await pre.evaluate((node) => {
      node.scrollLeft = 0;
    });
    for (const wrapper of await page.locator('.table-wrap').all())
      await wrapper.evaluate((node) => {
        node.scrollLeft = 0;
      });
    await expect(page.locator('.toast')).not.toHaveClass(/visible/);
    await block.scrollIntoViewIfNeeded();
    await page.mouse.move(0, 0);
    await page.screenshot({ path: path.join(evidence, engine, `markdown-code-${width}.png`) });
    await page
      .getByRole('heading', { name: '长表格与合并单元格', exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(evidence, engine, `markdown-table-${width}.png`) });
  });

test('native document navigation initializes sample copy, image and TOC once per visit', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await installMarkdownFixture(page);
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          (window as any).__copied = text;
        },
      },
    }),
  );
  await page.goto('/');
  await page.evaluate((href) => {
    const link = document.createElement('a');
    link.href = href;
    link.textContent = 'Test sample';
    document.querySelector('main')!.prepend(link);
  }, samplePath);
  await page.getByRole('link', { name: 'Test sample' }).click();
  await expect(page).toHaveURL(new RegExp(samplePath + '$'));
  await expect(page.locator('.code-block')).toHaveCount(4);
  await expect(page.locator('.code-block .copy-code')).toHaveCount(4);
  const code = page.locator('.code-block').first();
  await code.locator('.copy-code').click();
  expect(await page.evaluate(() => (window as any).__copied)).toBe(
    await code.locator('code').textContent(),
  );
  const toc = page.locator('.reading-sidebar .toc-link').filter({ hasText: '图片与说明' });
  await toc.click();
  await expect(toc).toHaveClass(/active/);
  await page.locator('.prose img').first().click();
  await expect(page.locator('.image-dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.goBack();
  if (new URL(page.url()).pathname !== '/') await page.goBack();
  expect(new URL(page.url()).pathname).toBe('/');
  await page.goForward();
  await expect(page.locator('.code-block .copy-code')).toHaveCount(4);
  await expect(page.locator('.reading-sidebar .toc-link')).not.toHaveCount(0);
});

test('test sample has no physical route or discovery artifacts', async ({ request }) => {
  expect((await request.get(samplePath)).status()).toBe(404);
  for (const name of ['search.json', 'rss.xml', 'atom.xml', 'sitemap-0.xml'])
    expect(await (await request.get('/' + name)).text()).not.toContain(
      'AUTUSWING_MARKDOWN_TEST_ONLY',
    );
});

test('lightbox uses the complete responsive source only when opened', async ({ page }) => {
  await installMarkdownFixture(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(samplePath);
  const img = page.locator('.prose img').first();
  const full = await img.evaluate((node: HTMLImageElement) => {
    const thumbnail = new URL(node.src);
    thumbnail.searchParams.set('test-thumbnail', '1');
    node.srcset = thumbnail.href + ' 1x';
    return node.src;
  });
  await img.evaluate((node: HTMLImageElement) => node.decode());
  await expect.poll(() => img.evaluate((node: HTMLImageElement) => node.currentSrc)).not.toBe(full);
  await img.click();
  await expect(page.locator('.image-dialog img')).toHaveAttribute('src', full);
  await page.keyboard.press('Escape');
  await img.evaluate((node: HTMLImageElement) => {
    node.dataset.fullsize = node.src + '#fullsize';
  });
  await img.click();
  await expect(page.locator('.image-dialog img')).toHaveAttribute('src', full + '#fullsize');
});
