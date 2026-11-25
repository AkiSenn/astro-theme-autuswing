export type SeriesPost = {
  path: string;
  title: string;
  date: string;
  data: {
    series?: string;
    series_order?: number;
    draft?: boolean;
    published?: boolean;
    noindex?: boolean;
    password?: string;
  };
};

function isIndexableEntry(data: SeriesPost['data']) {
  return !data.password && data.noindex !== true && data.published !== false && data.draft !== true;
}

export function seriesGroup<T extends SeriesPost>(all: readonly T[], current: T) {
  const name = current.data.series?.trim();
  if (!name) return undefined;
  const items = all
    .filter(
      (p) => p.data.series?.trim() === name && (p.path === current.path || isIndexableEntry(p.data)),
    )
    .sort((a, b) => {
      const ao = a.data.series_order ?? Number.MAX_SAFE_INTEGER;
      const bo = b.data.series_order ?? Number.MAX_SAFE_INTEGER;
      return ao - bo || a.date.localeCompare(b.date) || a.path.localeCompare(b.path);
    });
  const index = items.findIndex((p) => p.path === current.path);
  if (index < 0) return undefined;
  return {
    name,
    items,
    index,
    previous: items[index - 1],
    next: items[index + 1],
  };
}
