export const cacheFixturePaths = {
  ordinary: '/__qa__/reading-cache/',
  disabled: '/__qa__/reading-cache-off/',
  article: '/qac001/',
};

const paragraphs = (count) =>
  Array.from(
    { length: count },
    (_, i) =>
      `<p>QA 段落 ${i + 1}：${'内容变化后，目录应按真实阅读位置更新；稳定滚动不应反复测量标题。'.repeat(6)}</p>`,
  ).join('\n');

const body = `<p data-reading-cache-fixture="v1">只用于本地目录缓存验收，不得发布。</p>

## Cache A

${paragraphs(16)}

<details id="cache-details"><summary>展开本地测试内容</summary>${paragraphs(14)}</details>

<img id="cache-image" alt="手动加载的本地测试图" />

## Cache B

${paragraphs(16)}

### Cache C

${paragraphs(12)}

#### Cache D

${paragraphs(12)}

##### Cache E

${paragraphs(12)}

###### Cache F

${paragraphs(16)}
`;

export const cacheFixtureFiles = [
  ['content/legacy/pages/qa-reading-cache/index.md', cacheFixturePaths.ordinary, true],
  ['content/legacy/pages/qa-reading-cache-off/index.md', cacheFixturePaths.disabled, false],
  ['content/posts/qa-reading-cache.md', cacheFixturePaths.article, true],
].map(([file, permalink, toc]) => ({
  file,
  content: `---\ntitle: QA reading cache\ndate: 2026-01-01T08:00:00+08:00\n${file.startsWith('content/posts/') ? 'id: qac001\n' : ''}permalink: ${permalink}\ntoc: ${toc}\nnoindex: true\nsearch: false\nfeed: false\n---\n\n${body}`,
}));

export const cacheFixtureImage =
  '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="2300"><rect width="900" height="2300" fill="#71846b"/></svg>';
