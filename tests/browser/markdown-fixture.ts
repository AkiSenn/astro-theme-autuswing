import fs from 'node:fs';
import { load } from 'cheerio';
import type { Page } from '@playwright/test';
import { markdownProcessor } from '../../src/lib/markdown.mjs';
import { frontmatter } from '../../src/lib/frontmatter.mjs';

export const samplePath = '/__test__/markdown/';
async function renderFixture() {
  const { body, data } = frontmatter(fs.readFileSync('tests/fixtures/markdown/reading.md', 'utf8'));
  const renderer = await markdownProcessor().createRenderer({
    syntaxHighlight: 'shiki',
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
      defaultColor: false,
    },
  });
  return renderer.render(body, { frontmatter: data });
}
let rendered: ReturnType<typeof renderFixture> | undefined;

// Test-only HTTP interception; neither a production route nor a content collection.
export async function installMarkdownFixture(page: Page) {
  rendered ||= renderFixture();
  const result = await rendered;
  await page.route('**' + samplePath, async (route) => {
    // The existing math article supplies the real scripts, styles and layout.
    const response = await route.fetch({
      url: new URL('/post/4e395565/', route.request().url()).href,
    });
    const $ = load(await response.text());
    $('.article .prose').html(result.code);
    $('.article-header h1').text('Markdown 阅读测试样本');
    $('meta[name=robots]').attr('content', 'noindex, nofollow');
    $('link[rel=canonical]').attr('href', 'https://akisenn.com' + samplePath);
    const headings = result.metadata.headings.filter(
      (heading) => heading.depth >= 2 && heading.depth <= 4 && heading.slug !== 'footnote-label',
    );
    $('.toc').each((_, node) => {
      const list = $(node).empty();
      for (const heading of headings) {
        const item = $('<li>')
          .attr('class', `toc-item toc-level-${heading.depth}`)
          .attr('style', `--depth:${heading.depth - 2}`);
        item.append(
          $('<a>')
            .addClass('toc-link')
            .attr('href', '#' + heading.slug)
            .append($('<span>').addClass('toc-text').text(heading.text)),
        );
        list.append(item);
      }
    });
    $('.contents-count').text(String(headings.length));
    await route.fulfill({
      response,
      body: $.html(),
      headers: { ...response.headers(), 'x-robots-tag': 'noindex, nofollow' },
    });
  });
}
