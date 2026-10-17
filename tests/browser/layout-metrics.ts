// These fixtures use gap only in flex/grid, with no multicolumn flows. Removing
// an inert block-flow gap must not fail an otherwise exact visual comparison.
export function activeLayoutMetrics<T extends { display: string; gap: string }>(items: T[]): T[] {
  return items.map((item) =>
    /flex|grid/.test(item.display) ? item : { ...item, gap: '(inactive)' },
  );
}
