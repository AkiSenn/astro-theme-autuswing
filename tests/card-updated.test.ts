import test from 'node:test';
import assert from 'node:assert/strict';
import { cardUpdated } from '../src/lib/card-updated';

const now = Date.parse('2026-10-29T12:00:00+08:00');
const published = { date: '2022-01-20 13:23:24' };

test('显式更新时间使用 UTC+8 日期及标准 datetime', () => {
  assert.deepEqual(cardUpdated({ ...published, updated: '2026-10-05' }, now), {
    datetime: '2026-10-04T16:00:00.000Z',
    label: '2026-10-05',
  });
});

test('不读取已准备文章的历史回退时间，也不修改输入', () => {
  const data = { ...published };
  const post = { data, updated: '2026-10-05T08:34:23.065Z' };
  assert.equal(cardUpdated(post.data, now), undefined);
  assert.deepEqual(data, published);
});

test('没有更新、空值、相等时间和早于发布均不显示', () => {
  for (const updated of [undefined, '', '2022-01-20 13:23:24', '2022-01-19'])
    assert.equal(cardUpdated({ ...published, updated }, now), undefined);
});

test('同一 UTC+8 日历日的更新不显示，即使 UTC 日期不同', () => {
  for (const [date, updated] of [
    ['2026-10-05 01:00:00', '2026-10-05 23:00:00'],
    ['2026-10-04T17:00:00Z', '2026-10-05T12:00:00Z'],
  ])
    assert.equal(cardUpdated({ date, updated }, now), undefined);
});

test('跨 UTC+8 日期的等价时区输入显示同一结果', () => {
  for (const updated of ['2026-10-05', '2026-10-04T16:00:00Z', '2026-10-04T12:00:00-04:00'])
    assert.deepEqual(cardUpdated({ date: '2026-10-04 23:59:59', updated }, now), {
      datetime: '2026-10-04T16:00:00.000Z',
      label: '2026-10-05',
    });
});

test('未来更新时间排除，构建时刻相等允许，不仅比较日期', () => {
  assert.equal(
    cardUpdated({ ...published, updated: '2026-10-29T12:00:00.001+08:00' }, now),
    undefined,
  );
  assert.ok(cardUpdated({ ...published, updated: '2026-10-29T12:00:00+08:00' }, now));
  assert.equal(cardUpdated({ ...published, updated: '2026-10-30' }, now), undefined);
});

test('无效日期不产生提示，内容 schema 的构建错误策略保持原样', () => {
  for (const updated of ['not-a-date', '2026-02-30', '2026-10-05T25:00:00Z'])
    assert.equal(cardUpdated({ ...published, updated }, now), undefined);
  assert.equal(cardUpdated({ date: 'invalid', updated: '2026-10-05' }, now), undefined);
});

test('草稿、未发布、不允许索引和非空旧 password 均不生成提示', () => {
  const data = { ...published, updated: '2026-10-05' };
  for (const restriction of [
    { draft: true },
    { published: false },
    { noindex: true },
    { password: 'test' },
  ])
    assert.equal(cardUpdated({ ...data, ...restriction }, now), undefined);
  assert.ok(
    cardUpdated({ ...data, draft: false, published: true, noindex: false, password: '' }, now),
  );
});

test('最终 updated 是唯一更新依据；无效构建时刻不显示', () => {
  assert.equal(cardUpdated({ ...published, updated: '2026-10-06' }, now)?.label, '2026-10-06');
  assert.equal(cardUpdated({ ...published, updated: '2026-10-05' }, NaN), undefined);
});
