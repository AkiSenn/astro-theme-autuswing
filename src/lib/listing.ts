import type { PaginateFunction } from 'astro';

export function listingRoutes<T>(
  paginate: PaginateFunction,
  base: string,
  title: string,
  selected: T[],
  kind: 'home' | 'archive',
  perPage: number,
) {
  return paginate(selected, {
    pageSize: perPage > 0 ? perPage : Number.POSITIVE_INFINITY,
  }).map(({ props: { page } }) => {
    // Astro's URLs already include its deployment base; route keys must stay logical.
    const number = page.currentPage;
    if (!Number.isSafeInteger(number) || number < 1 || number > page.lastPage)
      throw new Error(`Invalid pagination page for ${base}: ${number}`);
    return {
      path: number === 1 ? base : `${base}page/${number}/`,
      title,
      kind,
      posts: page.data as T[],
      totalItems: page.total,
      page: number,
      totalPages: page.lastPage,
      base,
    };
  });
}
