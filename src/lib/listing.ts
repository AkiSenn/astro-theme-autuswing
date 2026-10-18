import type { PaginateFunction } from 'astro';

// Keep Astro's existing slicing, page size, sort order and URL formatting.
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
    format: (url) => {
      const number = url === '/' ? 1 : Number(url.replaceAll('/', ''));
      return number === 1 ? base : `${base}page/${number}/`;
    },
  }).map(({ props: { page } }) => ({
    path: page.url.current,
    title,
    kind,
    posts: page.data as T[],
    totalItems: page.total,
    page: page.currentPage,
    totalPages: page.lastPage,
    base,
  }));
}
