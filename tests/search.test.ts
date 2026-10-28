import test from 'node:test';
import assert from 'node:assert/strict';
import { search, searchExcerpt, normalize, type SearchItem } from '../src/lib/search';
import { searchText } from '../src/lib/search-index.mjs';

const item = (extra: Partial<SearchItem> = {}): SearchItem => ({
  title: '普通文章',
  url: '/searchqa/',
  tags: [],
  categories: [],
  excerpt: '开头简介',
  content: '',
  ...extra,
});

test('全文保留两万字以后的正文与代码块，不改变行内代码', () => {
  const text = searchText(
    '<p>开始 <code>inlineOnly</code></p><pre><code><span>npm</span> <span>ci</span> --prefix themes/autuswing</code></pre><p>' +
      '中文长文章正文'.repeat(4000) +
      '终章唯一词</p>',
  );
  assert.ok(text.indexOf('终章唯一词') > 20000);
  const data = item({ content: text });
  for (const query of ['终章唯一词', 'npm ci', '--prefix', 'inlineOnly'])
    assert.deepEqual(search([data], query), [data]);
});

test('代码相邻 token 不被拆开，块边界不拼成伪关键词', () => {
  const text = searchText(
    '<p>前文</p><pre><code><span>config</span><span>_field</span></code></pre><p>后文</p>',
  );
  assert.equal(text, '前文 config_field 后文');
  assert.equal(search([item({ content: text })], '前文config_field').length, 0);
});

test('排除可执行文本、样式与旧行号，公式只提取原式一次', () => {
  const text = searchText(
    '<script>scriptSecret</script><style>styleSecret</style><template>templateSecret</template><figure><table><tr><td class="gutter">1 2 3</td><td><pre>git status</pre></td></tr></table></figure><span data-math-source="x^2"><span>visualNoise</span><math>mathNoise</math></span>',
  );
  assert.equal(text, 'git status x^2');
});

test('保留中文、NFKC、英文大小写、多词 AND 和原有权重', () => {
  const data = [
    item({ title: 'Ａｓｔｒｏ 中文', url: '/title/', content: '迁移' }),
    item({ title: '其他', url: '/tag/', tags: ['Astro'], content: '中文 迁移' }),
    item({ url: '/body/', content: 'astro 中文 迁移' }),
  ];
  assert.deepEqual(
    search(data, 'astro 中文').map((i) => i.url),
    ['/title/', '/tag/', '/body/'],
  );
  assert.equal(search(data, 'astro 没有此词').length, 0);
  assert.equal(search(data, '  ').length, 0);
});

test('标题、正文、代码重复命中仅返回一次，限制结果数量', () => {
  const data = item({ title: 'shared', content: 'shared shared shared' });
  assert.equal(search([data], 'shared shared').length, 1);
  assert.equal(search([data, item({ url: '/second/', content: 'shared' })], 'shared', 1).length, 1);
});

test('长文章摘要定位实际命中，不再回到开头简介', () => {
  const data = item({
    content: '普通中文正文。'.repeat(4000) + '目标命令 needle --save-dev 应在本窗口中显示。',
  });
  const excerpt = searchExcerpt(data, 'needle --save-dev', 140);
  assert.ok(excerpt.startsWith('…'));
  assert.ok(excerpt.includes('needle --save-dev'));
  assert.ok(excerpt.length <= 142);
});

test('上下文优先包含多个不同查询词，而不是只有开头单词', () => {
  const data = item({ content: 'first ' + '前文'.repeat(200) + 'first second 共同出现。' });
  assert.ok(searchExcerpt(data, 'first second', 100).includes('second'));
});

test('只有标题或标签命中时使用有界的文章简介', () => {
  const data = item({
    title: 'titleOnly',
    tags: ['tagOnly'],
    excerpt: '简介'.repeat(100),
    content: '无匹配正文',
  });
  assert.equal(searchExcerpt(data, 'titleOnly', 20), data.excerpt.slice(0, 20));
  assert.equal(searchExcerpt(data, 'tagOnly', 20), data.excerpt.slice(0, 20));
});

test('特殊字符按字面匹配，不当作正则或 HTML 执行', () => {
  const text = searchText(
    '<pre>&lt;img src=x onerror="window.searchXSS=1"&gt; [a+b].* config.json --save-dev</pre>',
  );
  const data = item({ content: text });
  for (const query of ['<img', '[a+b].*', 'config.json', '--save-dev', 'window.searchXSS=1'])
    assert.equal(search([data], query).length, 1);
  assert.ok(searchExcerpt(data, '<img', 140).includes('<img'));
});

test('连字展开后的命中上下文保留原文，避免截断 emoji 代理对', () => {
  const data = item({ content: 'ﬃ'.repeat(300) + '😀 Ａｓｔｒｏ 终章' });
  const excerpt = searchExcerpt(data, 'astro', 40);
  assert.ok(normalize(excerpt).includes('astro'));
  assert.equal(/^[\uDC00-\uDFFF]|[\uD800-\uDBFF]$/.test(excerpt.replace(/^…|…$/g, '')), false);
});
