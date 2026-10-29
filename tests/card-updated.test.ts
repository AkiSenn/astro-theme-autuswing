import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
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

test('历史夏令时期间按固定 UTC+8 跨日，不漏掉午夜更新', () => {
  assert.deepEqual(
    cardUpdated({ date: '1988-06-04T15:00:00Z', updated: '1988-06-04T16:00:00Z' }, now),
    { datetime: '1988-06-04T16:00:00.000Z', label: '1988-06-05' },
  );
});

test('历史夏令时期间按固定 UTC+8 同日，不错误提示更新', () => {
  assert.equal(
    cardUpdated({ date: '1988-06-04T14:30:00Z', updated: '1988-06-04T15:30:00Z' }, now),
    undefined,
  );
});

test('固定 UTC+8 午夜前后 1ms 的日历边界', () => {
  for (const day of ['1988-06-04', '2026-10-04']) {
    const date = `${day}T15:59:59.998Z`;
    assert.equal(cardUpdated({ date, updated: `${day}T15:59:59.999Z` }, now), undefined);
    assert.deepEqual(cardUpdated({ date, updated: `${day}T16:00:00.000Z` }, now), {
      datetime: `${day}T16:00:00.000Z`,
      label: day === '1988-06-04' ? '1988-06-05' : '2026-10-05',
    });
  }
});

test('固定 UTC+8 前一日、相等瞬间及同日较早时刻均不显示', () => {
  const date = '1988-06-04T16:00:00Z';
  for (const updated of ['1988-06-04T15:59:59.999Z', date, '1988-06-04T23:00:00Z'])
    assert.equal(cardUpdated({ date, updated }, now), undefined);
  assert.equal(
    cardUpdated({ date: '1988-06-05T10:00:00Z', updated: '1988-06-05T09:00:00Z' }, now),
    undefined,
  );
});

test('固定 UTC+8 跨日后仍严格检查构建时刻，未来 1ms 不显示', () => {
  const data = { date: '1988-06-04T15:00:00Z', updated: '1988-06-04T16:00:00Z' };
  assert.equal(cardUpdated(data, Date.parse('1988-06-04T15:59:59.999Z')), undefined);
  assert.equal(cardUpdated(data, Date.parse('1988-06-04T16:00:00.000Z'))?.label, '1988-06-05');
});

test('历史日期的 Z、正负偏移等价输入保持同一 UTC+8 结果', () => {
  for (const updated of [
    '1988-06-04T16:00:00Z',
    '1988-06-05T00:00:00+08:00',
    '1988-06-05T01:00:00+09:00',
    '1988-06-04T12:00:00-04:00',
  ])
    assert.deepEqual(cardUpdated({ date: '1988-06-04T15:59:59Z', updated }, now), {
      datetime: '1988-06-04T16:00:00.000Z',
      label: '1988-06-05',
    });
});

test('固定 UTC+8 跨月、跨年和闰日日界', () => {
  for (const [date, updated, label] of [
    ['1988-05-31T15:59:59Z', '1988-05-31T16:00:00Z', '1988-06-01'],
    ['2025-12-31T15:59:59Z', '2025-12-31T16:00:00Z', '2026-01-01'],
    ['2024-02-28T15:59:59Z', '2024-02-28T16:00:00Z', '2024-02-29'],
  ])
    assert.equal(cardUpdated({ date, updated }, now)?.label, label);
});

test('UTC、上海、洛杉矶及奥克兰独立进程给出相同固定 UTC+8 结果', () => {
  const url = new URL('../src/lib/card-updated.ts', import.meta.url).href;
  const script = `
    import { cardUpdated } from ${JSON.stringify(url)};
    const now = Date.parse('2026-10-29T12:00:00+08:00');
    console.log(JSON.stringify({
      offset: new Date('1988-06-04T16:00:00Z').getTimezoneOffset(),
      cross: cardUpdated({ date: '1988-06-04T15:00:00Z', updated: '1988-06-04T16:00:00Z' }, now),
      same: cardUpdated({ date: '1988-06-04T14:30:00Z', updated: '1988-06-04T15:30:00Z' }, now) ?? null,
      modern: cardUpdated({ date: '2026-10-04 23:59:59', updated: '2026-10-05' }, now),
      earlier: cardUpdated({ date: '1988-06-04T16:00:00Z', updated: '1988-06-04T15:59:59Z' }, now) ?? null,
      future: cardUpdated({ date: '2026-10-28', updated: '2026-10-30' }, now) ?? null
    }));
  `;
  const offsets = new Set<number>();
  for (const TZ of ['UTC', 'Asia/Shanghai', 'America/Los_Angeles', 'Pacific/Auckland']) {
    const { offset, ...result } = JSON.parse(
      execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '--eval', script], {
        env: { ...process.env, TZ },
        encoding: 'utf8',
      }),
    );
    offsets.add(offset);
    assert.deepEqual(
      result,
      {
        cross: { datetime: '1988-06-04T16:00:00.000Z', label: '1988-06-05' },
        same: null,
        modern: { datetime: '2026-10-04T16:00:00.000Z', label: '2026-10-05' },
        earlier: null,
        future: null,
      },
      TZ,
    );
  }
  assert.equal(offsets.size, 4, '确认环境时区实际变化，而非仅设置变量');
});
