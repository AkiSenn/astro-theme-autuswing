import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { load } from 'cheerio';
import fs from 'node:fs';
import { markdownProcessor } from '../../src/lib/markdown.mjs';
const evidenceDir = process.env.VISUAL_EVIDENCE_DIR || 'docs/evidence/phase4';

async function typographyFixture(page: Page) {
  const markdown = [
    '浏览器排版样张：本内容只用于视觉检查，不写入历史文章。',
    '## 行内公式',
    '中文段落与 Astro、TypeScript 混排，应该有清晰而克制的阅读节奏。行内公式 $A=\\pi r^2$、**重点文字**和 `inline_code` 都应自然融入正文。[文字链接](https://example.com/notes)保留下划线，颜色不是唯一提示。',
    '> 留白让句子有呼吸的空间，引用应保持清晰的文字对比。\n>\n> 这是一段跨行引用，用来检查中文换行与段落间距。',
    '- 第一项：文字与标点自然换行。\n- 第二项包含 `code` 和 English。\n  - 嵌套列表保持可读缩进。',
    '## 独立公式',
    '$$\\sum_{k=1}^{n}k=\\frac{n(n+1)}{2}$$',
    '```ts\nconst greeting: string = "AutuSwing";\nconst longLine = "' +
      'long_code_content_'.repeat(18) +
      '";\nconsole.log(greeting);\n```',
    '## 公式配置',
    '| 项目 | 说明 | 状态 | 版本 | 备注 |\n| :--- | :--- | :--- | :--- | :--- |\n| 阅读 | 单列内容区域 | 已设置 | v1 | 宽表仅在自身滚动 |\n| 路径 | LongUnbrokenTableColumn | 保留 | v2 | 中文与英文混排 |',
    '### 补充说明',
    '长链接也应该可以断行：[https://example.com/' +
      'long-path-'.repeat(18) +
      '](https://example.com/notes)。',
    '## 公式之外仍是普通 Markdown',
    '<figure><img src="/img/posts/hexo-yelee/01-workflow.png" alt="博客构建流程示意图" width="1200" height="720"><figcaption>图片与说明保持在正文宽度内。</figcaption></figure>',
    '<details><summary>展开补充内容</summary><p>原生折叠内容可通过键盘打开。</p></details>',
  ].join('\n\n');
  const renderer = await markdownProcessor().createRenderer({ syntaxHighlight: 'shiki' });
  const result = await renderer.render(markdown);
  await page.route('**/post/4e395565/', async (route) => {
    const response = await route.fetch();
    const $ = load(await response.text());
    $('.article .prose').html(result.code);
    await route.fulfill({ response, body: $.html() });
  });
}

test('typography hierarchy is legible and native theme/font options still apply', async ({
  page,
}) => {
  const fonts: string[] = [];
  page.on('request', (req) => {
    if (req.resourceType() === 'font') fonts.push(req.url());
  });
  await page.goto('/');
  await expect(page.locator('.post-card h2.post-card-title')).toHaveCount(3);
  const hierarchy = await page
    .locator('.post-card')
    .first()
    .evaluate((card) => {
      const font = (selector: string) =>
        parseFloat(getComputedStyle(card.querySelector(selector)!).fontSize);
      return {
        title: font('.post-card-title'),
        summary: font('p'),
        meta: font('.post-meta'),
        date: font('.card-date span'),
      };
    });
  expect(hierarchy.title).toBeGreaterThanOrEqual(22);
  expect(hierarchy.summary).toBeGreaterThanOrEqual(15);
  expect(hierarchy.meta).toBeGreaterThanOrEqual(12);
  expect(hierarchy.date).toBeGreaterThan(hierarchy.title);
  await page.goto('/post/4e395565/');
  expect(
    await page.locator('.prose').evaluate((node) => parseFloat(getComputedStyle(node).fontSize)),
  ).toBe(17);
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--autuswing-base-font', '18px');
    document.documentElement.style.setProperty('--autuswing-code-font', 'monospace');
    document.documentElement.style.setProperty('--accent', '#006e55');
  });
  expect(
    await page.locator('.prose').evaluate((node) => parseFloat(getComputedStyle(node).fontSize)),
  ).toBe(19);
  expect(
    await page
      .locator('.prose code')
      .first()
      .evaluate((node) => getComputedStyle(node).fontFamily),
  ).toBe('monospace');
  expect(
    await page
      .locator('html')
      .evaluate((node) => getComputedStyle(node).getPropertyValue('--green').trim()),
  ).toBe('#006e55');
  expect(fonts.every((url) => url.startsWith('http://127.0.0.1:4322/assets/vendor/katex/'))).toBe(
    true,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/post/4e395565/');
  expect(
    await page.locator('.prose').evaluate((node) => parseFloat(getComputedStyle(node).fontSize)),
  ).toBe(16);
});

test('code scroll does not move its accessible copy toolbar or contaminate copied text', async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          (window as any).__copied = value;
        },
      },
    }),
  );
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/post/55b0541c/');
  const block = page.locator('.code-block').first();
  const expected = 'const longLine = "' + 'very_long_code_'.repeat(90) + '";';
  await block.locator('code').evaluate((code, text) => (code.textContent = text), expected);
  await block.scrollIntoViewIfNeeded();
  const before = await block.locator('.copy-code').boundingBox();
  await block.locator('pre').evaluate((pre) => (pre.scrollLeft = pre.scrollWidth));
  const after = await block.locator('.copy-code').boundingBox();
  expect(Math.abs(before!.x - after!.x)).toBeLessThan(1);
  expect(after!.height).toBeGreaterThanOrEqual(44);
  await block.locator('.copy-code').click();
  expect(await page.evaluate(() => (window as any).__copied)).toBe(expected);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    ),
  ).toBe(true);
});

test('reading samples cover quotes lists tables images code and both appearances in all layouts', async ({
  page,
}) => {
  test.setTimeout(120000);
  await typographyFixture(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/post/4e395565/');
  const results: object[] = [];
  for (const width of [390, 820, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const mode of ['light', 'dark']) {
      await page.evaluate((mode) => localStorage.setItem('autuswing-appearance', mode), mode);
      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('data-theme', mode);
      await expect(page.locator('.code-toolbar .copy-code')).toBeVisible();
      const axe = await new AxeBuilder({ page }).analyze();
      const failures = axe.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious',
      );
      expect(failures.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }))).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
        ),
      ).toBe(true);
      await page.locator('.prose img').scrollIntoViewIfNeeded();
      await expect(page.locator('.prose img')).toBeVisible();
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({
        path: `${evidenceDir}/sample-${mode}-${width}.png`,
        fullPage: true,
        animations: 'disabled',
      });
      results.push({ width, mode, criticalOrSerious: failures.length });
    }
  }
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.writeFileSync(
    `${evidenceDir}/reading-sample-check.json`,
    JSON.stringify(
      { checkedAt: new Date().toISOString(), fixtureOnly: true, checks: results },
      null,
      2,
    ) + '\n',
  );
});

test('article content is immediately visible and motion respects user preferences', async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as any).__motion = [];
    const original = Element.prototype.animate;
    Element.prototype.animate = function (frames, options) {
      (window as any).__motion.push({ frames, options });
      return original.call(this, frames, options);
    };
  });
  await page.goto('/post/55b0541c/');
  const motion = await page.evaluate(() => (window as any).__motion);
  expect(motion.length).toBeGreaterThan(0);
  expect(
    motion.every(
      (m: any) => m.options.duration <= 200 && !JSON.stringify(m.frames).includes('opacity'),
    ),
  ).toBe(true);
  expect(
    await page
      .locator('.prose > p')
      .evaluateAll((nodes) => nodes.every((node) => getComputedStyle(node).opacity === '1')),
  ).toBe(true);
  await expect(page.locator('.reveal-pending,.reveal-visible')).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  expect(await page.evaluate(() => (window as any).__motion.length)).toBe(0);
  await page.locator('.post-card').first().hover();
  expect(
    await page
      .locator('.post-card')
      .first()
      .evaluate((node) => getComputedStyle(node).transform),
  ).toBe('none');
});

test('theme-disabled motion and plain article/card surfaces remain usable', async ({ page }) => {
  await page.route('http://127.0.0.1:4322/', async (route) => {
    const response = await route.fetch(),
      $ = load(await response.text());
    $('html').attr('data-animate', 'false');
    const config = JSON.parse($('#autuswing-config').text());
    config.animations.enable = false;
    $('#autuswing-config').text(JSON.stringify(config));
    $('.post-card').removeClass('mica-card');
    await route.fulfill({ response, body: $.html() });
  });
  await page.goto('/');
  const card = page.locator('.post-card').first();
  await card.hover();
  expect(await card.evaluate((node) => getComputedStyle(node).transform)).toBe('none');
  await expect(page.locator('.post-card-title').first()).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    ),
  ).toBe(true);
  // Test the configured animation flag with the enhanced surface, too.
  await card.evaluate((node) => node.classList.add('mica-card'));
  await card.hover();
  expect(await card.evaluate((node) => getComputedStyle(node).transform)).toBe('none');
});

test('print forced-colors and no-JavaScript code keep content readable', async ({
  browser,
  page,
}) => {
  await page.goto('/post/4e395565/');
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.code-toolbar')).not.toBeVisible();
  await expect(page.locator('.desktop-sidebar')).not.toBeVisible();
  expect(
    await page.locator('.prose pre').evaluate((node) => getComputedStyle(node).whiteSpace),
  ).toBe('pre-wrap');
  await page.emulateMedia({ media: 'screen', forcedColors: 'active' });
  await expect(page.locator('.copy-code')).toBeVisible();
  expect(
    await page
      .locator('.code-block')
      .evaluate((node) => parseFloat(getComputedStyle(node).borderTopWidth)),
  ).toBeGreaterThanOrEqual(1);
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 320, height: 900 },
  });
  const native = await context.newPage();
  await native.goto('http://127.0.0.1:4322/post/55b0541c/');
  await expect(native.locator('.code-toolbar')).toHaveCount(0);
  expect(
    await native
      .locator('.prose pre')
      .first()
      .evaluate((node) => getComputedStyle(node).overflowX),
  ).toBe('auto');
  expect(await native.locator('.prose pre').first().textContent()).not.toBe('');
  await context.close();
});
