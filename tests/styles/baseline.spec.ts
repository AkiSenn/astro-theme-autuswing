import { test, expect, type Page } from '@playwright/test';

const article = '/post/55b0541c/';
const sizes = [
  [320, 640], [375, 812], [390, 844], [430, 932],
  [768, 1024], [820, 1180], [1024, 768], [1180, 820],
  [1366, 768], [1440, 900], [1920, 1080], [2560, 1440],
] as const;
type Mode = 'light' | 'dark';

test.beforeEach(async ({ page }) => {
  // Only Date is frozen: dialog, scroll and animation clocks remain usable.
  await page.clock.setFixedTime(new Date('2026-10-17T04:00:00Z'));
  // One initializer per page: Playwright does not promise ordering between
  // multiple addInitScript calls. The query is only a local test input.
  await page.addInitScript(() => {
    const mode = new URLSearchParams(location.search).get('__visual_mode');
    if (mode === 'light' || mode === 'dark') localStorage.setItem('autuswing-appearance', mode);
  });
});

async function visit(page: Page, path: string, width: number, height: number, mode: Mode) {
  await page.setViewportSize({ width, height });
  await page.goto(`${path}?__visual_mode=${mode}`);
  await expect(page.locator('html')).toHaveAttribute('data-theme', mode);
  await page.evaluate(async () => {
    // Include lazy images in full-page baselines without changing source data.
    document.querySelectorAll<HTMLImageElement>('img').forEach((img) => img.loading = 'eager');
    await document.fonts.ready;
    await Promise.all([...document.images].map((img) => img.decode().catch(() => {})));
  });
  await expect(page.locator('main h1')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)).toBe(false);
}

async function capture(page: Page, name: string, fullPage = false, inertAvatar = false) {
  // A stationary pointer over a dismissed native dialog can leave WebKit's
  // old hover state until the next mouse event. Never baseline that accident.
  await page.mouse.move(0, 0);
  await expect(page).toHaveScreenshot(`${name}.png`, {
    fullPage,
    // Chromium can resample the tiny inert avatar differently under a native
    // modal. Reproduced with untouched CSS; unmasked shell shots cover it.
    mask: inertAvatar ? [page.locator('.avatar,.mobile-brand img,.rail-brand img')] : [],
    maskColor: '#808080',
  });
}

for (const [width, height] of sizes) {
  for (const mode of ['light', 'dark'] as const) {
    test(`shells ${width}x${height} ${mode}`, async ({ page }) => {
      for (const [name, path] of [['home', '/'], ['article', article]]) {
        await visit(page, path, width, height, mode);
        await expect(page.locator('.desktop-sidebar:visible,.tablet-sidebar:visible,.mobile-header:visible')).toHaveCount(1);
        await capture(page, `${name}-${width}x${height}-${mode}`);
      }
    });
  }
}

for (const width of [719, 720, 999, 1000, 1279, 1280, 1439]) {
  test(`breakpoint ${width}`, async ({ page }) => {
    for (const [name, path] of [['home', '/'], ['article', article]]) {
      await visit(page, path, width, 900, 'dark');
      await capture(page, `${name}-boundary-${width}`);
    }
  });
}

for (const [width, height] of [[390, 844], [820, 1180], [1920, 1080]]) {
  test(`full content and supporting pages ${width}`, async ({ page }) => {
    test.setTimeout(180000);
    for (const mode of ['light', 'dark'] as const) {
      await visit(page, article, width, height, mode);
      await capture(page, `article-full-${width}-${mode}`, true);
    }
    for (const [name, path] of [
      ['archives', '/archives/'], ['tags', '/tags/'], ['links', '/links/'],
      ['about', '/about/'], ['math', '/post/4e395565/'],
    ]) {
      await visit(page, path, width, height, 'dark');
      await capture(page, `${name}-${width}`, true);
    }
  });
}

for (const [width, height] of [[390, 844], [820, 1180], [1024, 768], [1366, 768], [1440, 900], [1920, 1080]]) {
  test(`contents open and closed ${width}`, async ({ page }) => {
    for (const mode of ['light', 'dark'] as const) {
      await visit(page, article, width, height, mode);
      if (width >= 1440) await page.locator('.reading-contents-close:visible').click();
      const trigger = page.locator('.contents-open:visible,.goto-toc:visible');
      await expect(trigger).toHaveCount(1);
      await capture(page, `contents-closed-${width}-${mode}`);
      await trigger.click();
      await capture(page, `contents-open-${width}-${mode}`);
      const close = page.locator('.reading-contents-close:visible,.contents-close:visible');
      await expect(close).toHaveCount(1);
      await close.click();
      await expect(trigger).toBeVisible();
    }
  });
}

for (const [width, height] of [[390, 844], [820, 1180], [1920, 1080]]) {
  test(`search image and focus ${width}`, async ({ page }) => {
    for (const mode of ['light', 'dark'] as const) {
      await visit(page, '/', width, height, mode);
      await page.locator('.search-open:visible').click();
      await page.locator('#search-input').fill('欧拉');
      await expect(page.locator('.search-results a')).toHaveCount(1);
      await capture(page, `search-${width}-${mode}`, false, true);
      await page.keyboard.press('Escape');
      await page.locator('.mode-toggle:visible').focus();
      await capture(page, `focus-${width}-${mode}`);
    }
    await visit(page, article, width, height, 'dark');
    await page.locator('.prose img').first().click();
    await expect(page.locator('.image-dialog')).toBeVisible();
    await capture(page, `lightbox-${width}`);
  });
}

test('print and forced colors preserve content', async ({ page }) => {
  await visit(page, article, 1366, 768, 'light');
  await page.emulateMedia({ media: 'print' });
  await capture(page, 'article-print', true);
  await page.emulateMedia({ media: 'screen', forcedColors: 'active' });
  await capture(page, 'article-forced-colors');
});

test('configuration and optional rendering keep their contracts', async ({ page }) => {
  await visit(page, article, 1920, 1080, 'dark');
  await page.evaluate(() => {
    const root = document.documentElement;
    root.style.setProperty('--autuswing-base-font', '18px');
    root.style.setProperty('--autuswing-radius', '12px');
    root.style.setProperty('--autuswing-code-font', 'monospace');
    root.style.setProperty('--accent', '#006e55');
    document.querySelector('.article')!.classList.remove('mica-card', 'mica-article');
  });
  await capture(page, 'article-custom-config-plain');
  expect(await page.locator('.prose').evaluate((node) => getComputedStyle(node).fontSize)).toBe('20px');
});

for (const width of [390, 820, 1920]) {
  test(`optional content fixture ${width}`, async ({ page }) => {
    for (const mode of ['light', 'dark'] as const) {
      await visit(page, article, width, 900, mode);
      await page.locator('.prose').evaluate((node) => {
        // Test-only DOM: no article or production template is changed.
        const code = node.querySelector('.code-block')!.outerHTML;
        node.innerHTML = `<h2>排版兼容样本</h2><p>中文与 English、<strong>重点</strong>、<code>inline_code</code> 与 <a href="#fixture">文字链接</a>。</p>
          <h3>列表与引用</h3><ul><li>第一项<ul><li>嵌套列表</li></ul></li><li>第二项</li></ul>
          <blockquote><p>保持当前引用样式与段落间距。</p></blockquote>
          <details open><summary>原生折叠内容</summary><p>键盘操作与可读性。</p></details>${code}
          <h3>旧 HTML 高亮兼容</h3><figure class="highlight"><table><tbody><tr><td class="gutter"><pre>1</pre></td><td class="code"><pre><span class="keyword">const</span> answer = <span class="number">42</span>;</pre></td></tr></tbody></table></figure>
          <pre class="hljs"><code><span class="hljs-keyword">const</span> answer = <span class="hljs-number">42</span>;</code></pre>
          <div class="table-wrap"><table><thead><tr><th>项目</th><th>说明</th></tr></thead><tbody><tr><td>表格</td><td>当前单列阅读布局</td></tr><tr><td>第二行</td><td>交替背景</td></tr></tbody></table></div>
          <figure><img src="/img/posts/hexo-yelee/01-workflow.png" width="1200" height="720" alt="构建流程"><figcaption>图片说明</figcaption></figure>
          <h4>补充内容</h4><hr><p>末段。</p>`;
        const extra = document.createElement('div');
        extra.innerHTML = `<section class="comments"><button class="comment-bar load-comments" aria-expanded="true">评论</button><div class="comment-panel"><div class="comment-heading"><h2>评论</h2><button class="comment-collapse">收起</button></div><p class="comment-status">测试状态</p><button class="comment-retry">重试</button></div></section><nav class="pagination"><a href="#fixture">1</a><a href="#fixture" aria-current="page">2</a></nav>`;
        node.after(extra);
      });
      await page.evaluate(async () => {
        await Promise.all([...document.images].map((img) => img.decode().catch(() => {})));
      });
      await capture(page, `optional-content-${width}-${mode}`, true);
    }
  });
}

test('optional wallpaper surface', async ({ page }) => {
  for (const mode of ['light', 'dark'] as const) {
    await visit(page, '/', 1366, 768, mode);
    await page.evaluate(() => {
      const background = document.createElement('div');
      background.className = 'site-background';
      background.innerHTML = '<img src="/img/posts/hexo-yelee/01-workflow.png" alt=""><span></span>';
      document.body.prepend(background);
      const card = document.querySelector('.post-card')!;
      const wallpaper = document.createElement('img');
      wallpaper.className = 'surface-wallpaper';
      wallpaper.src = '/img/posts/hexo-yelee/01-workflow.png';
      wallpaper.alt = '';
      card.prepend(wallpaper);
    });
    await page.evaluate(async () => { await Promise.all([...document.images].map((img) => img.decode().catch(() => {}))); });
    await capture(page, `wallpaper-${mode}`);
  }
});

for (const width of [390, 1920]) {
  test(`no JavaScript ${width}`, async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width, height: 900 }, colorScheme: 'dark', reducedMotion: 'reduce', locale: 'zh-CN' });
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4322' + article);
    await page.evaluate(() => document.fonts.ready);
    await capture(page, `no-js-${width}`);
    await context.close();
  });
}

for (const width of [820, 1920]) {
  test(`full content cards ${width}`, async ({ page }) => {
    await visit(page, '/', width, 1080, 'dark');
    await page.locator('.card-body > p').first().evaluate((node) => {
      const prose = document.createElement('div');
      prose.className = 'prose';
      prose.innerHTML = '<h2>全文卡片样本</h2><p>第一段中文与 English：保留正文在卡片中的段落间距。</p><p>第二段继续阅读。<a href="#sample">文字链接</a>和 <code>inline_code</code>。</p><blockquote><p>引用段落不应采用摘要截断。</p></blockquote>';
      node.replaceWith(prose);
    });
    await capture(page, `full-content-cards-${width}`, true);
  });
}
