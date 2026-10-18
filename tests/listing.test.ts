import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { listingRoutes } from '../src/lib/listing';

// Exercise the pinned Astro paginator, rather than duplicating its behavior in
// a fake. Import its internal file relative to the installed package location.
const require = createRequire(import.meta.url);
const { generatePaginateFunction } = await import(
  pathToFileURL(
    path.join(path.dirname(require.resolve('astro/package.json')), 'dist/core/render/paginate.js'),
  ).href
);
const paginate = generatePaginateFunction(
  { params: ['...page'], segments: [[{ content: '...page', dynamic: true, spread: true }]] },
  '/',
  'always',
);

for (const count of [0, 1, 10, 11, 25])
  test(`listing total remains ${count} on every page without changing order or URLs`, () => {
    const selected = Array.from({ length: count }, (_, i) => ({ id: `post-${i}` }));
    const original = structuredClone(selected);
    const pages = listingRoutes(paginate, '/archives/', '归档', selected, 'archive', 10);
    assert.equal(pages.length, Math.max(1, Math.ceil(count / 10)));
    assert.deepEqual(
      pages.flatMap((p) => p.posts),
      selected,
    );
    assert.deepEqual(selected, original);
    pages.forEach((page, i) => {
      assert.equal(page.totalItems, count);
      assert.equal(page.posts.length, Math.min(10, Math.max(0, count - i * 10)));
      assert.equal(page.path, i === 0 ? '/archives/' : `/archives/page/${i + 1}/`);
      assert.equal(page.page, i + 1);
      assert.equal(page.totalPages, pages.length);
    });
  });

test('tag and hierarchical category collections keep their own totals and membership', () => {
  const fixtures = [
    ['/tags/甲/', 25],
    ['/tags/乙/', 11],
    ['/categories/父/', 10],
    ['/categories/父/子/', 1],
    ['/categories/其他/', 0],
  ] as const;
  const all = fixtures.flatMap(([base, count]) =>
    listingRoutes(
      paginate,
      base,
      base,
      Array.from({ length: count }, (_, id) => ({ id, owner: base })),
      'archive',
      10,
    ),
  );
  for (const [base, count] of fixtures) {
    const pages = all.filter((p) => p.base === base);
    assert.equal(pages.length, Math.max(1, Math.ceil(count / 10)));
    for (const p of pages) {
      assert.equal(p.totalItems, count);
      assert.ok(p.posts.every((post) => post.owner === base));
      assert.equal(p.path, p.page === 1 ? base : `${base}page/${p.page}/`);
    }
  }
});

test('disabled pagination still exposes one complete collection', () => {
  const posts = Array.from({ length: 25 }, (_, i) => i);
  const pages = listingRoutes(paginate, '/archives/', '归档', posts, 'archive', 0);
  assert.equal(pages.length, 1);
  assert.equal(pages[0].totalItems, 25);
  assert.deepEqual(pages[0].posts, posts);
});
