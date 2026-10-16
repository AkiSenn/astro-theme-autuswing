import { test, expect } from '@playwright/test';
import fs from 'node:fs';
// Load the real bundled adapter with its shared motion dependency. Injecting
// raw module text bypasses Vite's import resolution and cannot test this path.
const entry = fs.readdirSync('dist/_astro').find((name) => /^comments\..+\.js$/.test(name));
if (!entry) throw new Error('Build the site before running comment adapter checks');
const source = `/_astro/${entry}`;
const labels = {
  comments_loading: '加载中',
  comments_failed: '加载失败',
  comments_retry: '重试',
  comments_collapse: '收起',
  comments_expand: '展开',
};
const configs: Record<string, Record<string, unknown>> = {
  giscus: {
    repo: 'test/repo',
    repo_id: 'repo-id',
    category_id: 'category-id',
    mapping: 'pathname',
    src: 'http://127.0.0.1:4322/__mock/giscus.js',
  },
  utterances: {
    repo: 'test/repo',
    issue_term: 'pathname',
    src: 'http://127.0.0.1:4322/__mock/utterances.js',
  },
  disqus: { shortname: 'test-site' },
  waline: { serverURL: 'https://comments.invalid', cdn: 'http://127.0.0.1:4322/__mock/waline.mjs' },
  twikoo: { envId: 'test-env', cdn: 'http://127.0.0.1:4322/__mock/twikoo.js' },
  valine: { appid: 'test-id', appkey: 'test-key', cdn: 'http://127.0.0.1:4322/__mock/valine.js' },
};
for (const [provider, config] of Object.entries(configs))
  test(`${provider}: stable identity, loading, collapse, appearance`, async ({ page }) => {
    await page.route('**/__mock/**', (route) => {
      const name = new URL(route.request().url()).pathname;
      const body = name.endsWith('waline.mjs')
        ? 'export function init(options){window.__commentOptions=options;return {update:options=>window.__commentUpdate=options,destroy(){}};}'
        : name.endsWith('twikoo.js')
          ? 'window.twikoo={init:async options=>{window.__commentOptions=options;}};'
          : name.endsWith('valine.js')
            ? 'window.Valine=function(options){window.__commentOptions=options;};'
            : 'window.__commentOptions=Object.fromEntries([...document.currentScript.attributes].map(a=>[a.name,a.value]));';
      return route.fulfill({
        contentType: 'application/javascript',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body,
      });
    });
    await page.route('https://test-site.disqus.com/embed.js', (route) =>
      route.fulfill({
        contentType: 'application/javascript',
        body: 'const data={page:{}};window.disqus_config.call(data);window.__commentOptions=data.page;',
      }),
    );
    await page.goto('/');
    const settings = {
      ...config,
      provider,
      lazyload: false,
      collapsible: true,
      timeout: 1500,
      canonical: 'https://akisenn.com/post/4c6caf67/',
      identifier: 'legacy-comment-id',
      title: '网站笔记',
    };
    await page.setContent(
      `<html lang="zh-CN" data-theme="light"><script id="autuswing-config" type="application/json">${JSON.stringify({ labels })}</script><section id="comments" data-state="idle"><button class="comment-bar" aria-expanded="false"><span>评论</span><span>展开</span></button><div class="comment-panel" hidden><button class="comment-collapse">收起</button><p class="comment-status"></p><button class="comment-retry" hidden>重试</button><div class="comments-container" id="${provider === 'disqus' ? 'disqus_thread' : 'comments-mount'}"></div></div></section></html>`,
    );
    await page
      .locator('#comments')
      .evaluate(
        (el, settings) => el.setAttribute('data-comments-config', JSON.stringify(settings)),
        settings,
      );
    await page.addScriptTag({ type: 'module', url: source });
    await page.locator('.comment-bar').click();
    await expect(page.locator('#comments')).toHaveAttribute('data-state', 'ready');
    const options = await page.evaluate(() => (window as any).__commentOptions);
    if (provider === 'giscus') {
      expect(options['data-mapping']).toBe('specific');
      expect(options['data-term']).toBe('/post/4c6caf67/');
    } else if (provider === 'utterances') expect(options['issue-term']).toBe('/post/4c6caf67/');
    else if (provider === 'disqus') {
      expect(options.identifier).toBe('legacy-comment-id');
      expect(options.url).toBe(settings.canonical);
    } else expect(options.path).toBe('legacy-comment-id');
    await page.evaluate(() => {
      document.documentElement.dataset.theme = 'dark';
      dispatchEvent(new CustomEvent('autuswing:appearance'));
    });
    if (provider === 'waline')
      expect(await page.evaluate(() => (window as any).__commentUpdate.dark)).toBe(
        'html[data-theme="dark"]',
      );
    await page.locator('.comment-collapse').click();
    await expect(page.locator('.comment-panel')).toBeHidden();
    await expect(page.locator('.comment-bar')).toBeFocused();
  });
test('comment SDK failure exposes retry and recovers using a controlled SDK', async ({ page }) => {
  let failed = true;
  await page.route('**/__mock/retry.js', (route) =>
    failed
      ? route.abort()
      : route.fulfill({
          contentType: 'application/javascript',
          body: 'window.Valine=function(){};',
        }),
  );
  await page.goto('/');
  await page.setContent(
    `<html><script id="autuswing-config" type="application/json">${JSON.stringify({ labels })}</script><section id="comments" data-state="idle"><button class="comment-bar"><span>评论</span><span>展开</span></button><div class="comment-panel" hidden><p class="comment-status"></p><button class="comment-retry" hidden>重试</button><div class="comments-container" id="comments-mount"></div></div></section></html>`,
  );
  await page.locator('#comments').evaluate((el) =>
    el.setAttribute(
      'data-comments-config',
      JSON.stringify({
        provider: 'valine',
        appid: 'test',
        appkey: 'test',
        cdn: 'http://127.0.0.1:4322/__mock/retry.js',
        lazyload: false,
        timeout: 1000,
      }),
    ),
  );
  await page.addScriptTag({ type: 'module', url: source });
  await page.locator('.comment-bar').click();
  await expect(page.locator('#comments')).toHaveAttribute('data-state', 'error');
  await expect(page.locator('.comment-retry')).toBeVisible();
  failed = false;
  await page.locator('.comment-retry').click();
  await expect(page.locator('#comments')).toHaveAttribute('data-state', 'ready');
});
