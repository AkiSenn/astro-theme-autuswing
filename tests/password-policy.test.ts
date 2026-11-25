import test from 'node:test';
import assert from 'node:assert/strict';
import { contentSchema, isPublished } from '../src/lib/content-schema';
import { frontmatter } from '../src/lib/frontmatter.mjs';
import { buildMode } from '../src/lib/build-mode.mjs';

const ordinary = { title: '配置校验夹具', date: '2026-10-01', id: 'policyqa' };

test('普通文章保持公开，缺省和旧空 password 不改变数据', () => {
  for (const extra of [{}, { password: '' }]) {
    const input = { ...ordinary, ...extra };
    const parsed = contentSchema.parse(input);
    assert.deepEqual(parsed, input);
    assert.equal(isPublished(parsed), true);
  }
});

test('草稿和 published false 继续隔离，noindex 不能代替未发布状态', () => {
  for (const extra of [{ draft: true }, { published: false }, { draft: true, published: true }])
    assert.equal(isPublished(contentSchema.parse({ ...ordinary, ...extra })), false);
  const parsed = contentSchema.parse({ ...ordinary, noindex: true });
  assert.equal(isPublished(parsed), true);
  assert.equal(parsed.noindex, true);
});

test('非空 password 包含纯空白时也拒绝，错误不回显输入值', () => {
  for (const value of ['qa-secret-sentinel-ONLY', ' ', '\t']) {
    const result = contentSchema.safeParse({ ...ordinary, password: value });
    assert.equal(result.success, false);
    if (result.success) continue;
    const issue = result.error.issues.find((entry) => entry.path.join('.') === 'password');
    assert.ok(issue);
    assert.match(issue.message, /不提供加密或访问保护/);
    assert.match(issue.message, /noindex: true/);
    assert.equal(issue.message.includes('qa-secret-sentinel-ONLY'), false);
  }
});

test('历史标识及旧路径不能绕过校验，失败不修改元数据', () => {
  const raw =
    '---\ntitle: 历史校验夹具\ndate: 2020-01-01\nabbrlink: 000123\npassword: qa-legacy-sentinel-ONLY\nnoindex: true\n---\n正文';
  const { data, body } = frontmatter(raw);
  const before = JSON.stringify(data);
  assert.equal(contentSchema.safeParse(data).success, false);
  assert.equal(JSON.stringify(data), before);
  assert.equal(data.abbrlink, '000123');
  assert.equal(data.noindex, true);
  assert.equal(body, '正文');
});

test('noindex 或草稿不能让误用 password 静默通过', () => {
  for (const extra of [{ noindex: true }, { draft: true }, { published: false }])
    assert.equal(
      contentSchema.safeParse({ ...ordinary, ...extra, password: 'qa-only' }).success,
      false,
    );
});

test('显式 noindex 与空字段兼容，URL 日期和未发布标记均不改写', () => {
  const input = {
    ...ordinary,
    password: '',
    noindex: true,
    draft: true,
    permalink: '/fixed-path/',
    updated: '2026-10-02',
  };
  assert.deepEqual(contentSchema.parse(input), input);
});

test('索引环境仍由显式 production 决定，未知模式拒绝', () => {
  assert.equal(buildMode(undefined, false), 'preview');
  assert.equal(buildMode(undefined, true), 'development');
  assert.equal(buildMode('production'), 'production');
  assert.throws(() => buildMode('prod'));
});
