import test from 'node:test';
import assert from 'node:assert/strict';
import { previousSiteEntry } from '../src/scripts/back';

const origin = 'https://akisenn.com';
const article = origin + '/post/55b0541c/';
const entry = (index: number, path: string, sameDocument = false) => ({
  key: `entry-${index}`,
  index,
  url: path.startsWith('http') ? path : origin + path,
  sameDocument,
});
test('back resolves home, archive, taxonomy and an earlier article by browser-owned entry key', () => {
  for (const path of [
    '/',
    '/archives/',
    '/tags/Hexo/',
    '/categories/网站建设/',
    '/post/4c6caf67/',
  ]) {
    const first = entry(0, path);
    assert.deepEqual(previousSiteEntry([first, entry(1, article, true)], 1, article), {
      key: first.key,
      url: new URL(first.url).href,
    });
  }
});
test('back skips article fragments and repeated visits to the same article after reload', () => {
  const list = [
    entry(0, '/archives/?year=2022#posts'),
    entry(1, article),
    entry(2, article + '?from=toc#one', true),
    entry(3, article + '#two', true),
  ];
  assert.deepEqual(previousSiteEntry(list, 3, article + '#two'), {
    key: 'entry-0',
    url: origin + '/archives/?year=2022#posts',
  });
});
test('direct entries, same-document-only history and forward entries do not invent a destination', () => {
  assert.equal(previousSiteEntry([entry(0, article, true)], 0, article), undefined);
  assert.equal(
    previousSiteEntry([entry(0, article, true), entry(1, article + '#one', true)], 1, article),
    undefined,
  );
  assert.equal(previousSiteEntry([entry(0, article, true), entry(1, '/')], 0, article), undefined);
});
test('back refuses foreign origins, missing URLs, missing entry keys and gaps', () => {
  for (const first of [
    entry(0, 'https://outside.invalid/'),
    { ...entry(0, '/'), url: undefined },
    { ...entry(0, '/'), key: '' },
  ])
    assert.equal(previousSiteEntry([first, entry(1, article, true)], 1, article), undefined);
  assert.equal(previousSiteEntry([entry(0, '/'), entry(2, article, true)], 2, article), undefined);
});
