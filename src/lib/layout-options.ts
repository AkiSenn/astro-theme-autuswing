const dimensions = {
  home_sidebar_width: { default: 272, min: 240, max: 320 },
  article_sidebar_width: { default: 72, min: 68, max: 104 },
  toc_width: { default: 260, min: 180, max: 320 },
  content_max_width: { default: 860, min: 640, max: 1120 },
  desktop_gutter: { default: 24, min: 16, max: 40 },
  mobile_gutter: { default: 16, min: 8, max: 32 },
} as const;

const densityScales = { compact: 0.8, comfortable: 1, spacious: 1.25 } as const;

type LayoutDimension = keyof typeof dimensions;
export type LayoutDensity = keyof typeof densityScales;
export type LayoutPreset = 'classic' | 'editorial' | 'compact' | 'custom';
type ResolvedLayout = Record<LayoutDimension, number> & { density: LayoutDensity };
export type LayoutOptions = Partial<ResolvedLayout & { preset: LayoutPreset }>;

const presets: Record<LayoutPreset, Partial<ResolvedLayout>> = {
  // 经典和自定义沿用既有默认值，包括旧侧栏宽度的回退。
  classic: {},
  editorial: {
    home_sidebar_width: 300,
    article_sidebar_width: 88,
    toc_width: 288,
    content_max_width: 980,
    desktop_gutter: 32,
    mobile_gutter: 20,
    density: 'spacious',
  },
  compact: { density: 'compact' },
  custom: {},
};

export function normalizeLayout(input: unknown, legacySidebarWidth?: unknown): ResolvedLayout {
  const data = input === undefined ? {} : input;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new TypeError('layout: 必须是配置对象');
  }
  const options = data as Record<string, unknown>;
  for (const key of Object.keys(options)) {
    if (key !== 'preset' && key !== 'density' && !Object.hasOwn(dimensions, key)) {
      throw new TypeError(`layout.${key}: 未知配置字段`);
    }
  }

  const name = options.preset === undefined ? 'classic' : options.preset;
  if (typeof name !== 'string' || !Object.hasOwn(presets, name)) {
    throw new TypeError('layout.preset: 使用 classic、editorial、compact 或 custom');
  }
  const preset = presets[name as LayoutPreset];
  const sizes = Object.fromEntries(
    (Object.keys(dimensions) as LayoutDimension[]).map((key) => {
      const bounds = dimensions[key];
      let value = options[key] === undefined ? preset[key] : options[key];
      if (value === undefined) {
        // 只有省略新字段时，才沿用旧侧栏宽度及原有的限幅。
        value =
          key === 'home_sidebar_width' &&
          typeof legacySidebarWidth === 'number' &&
          Number.isFinite(legacySidebarWidth)
            ? Math.max(240, Math.min(300, legacySidebarWidth))
            : bounds.default;
      }
      if (
        typeof value !== 'number' ||
        !Number.isFinite(value) ||
        value < bounds.min ||
        value > bounds.max
      ) {
        throw new TypeError(`layout.${key}: 使用 ${bounds.min}–${bounds.max} 的有限数字，单位 px`);
      }
      return [key, value];
    }),
  ) as Record<LayoutDimension, number>;

  const density =
    options.density === undefined ? (preset.density ?? 'comfortable') : options.density;
  if (typeof density !== 'string' || !Object.hasOwn(densityScales, density)) {
    throw new TypeError('layout.density: 使用 compact、comfortable 或 spacious');
  }
  return { ...sizes, density: density as LayoutDensity };
}

export function layoutVariables({ density, ...sizes }: ResolvedLayout): string {
  const lengths = Object.entries(sizes).map(
    ([key, value]) => `--aw-${key.replaceAll('_', '-')}:${value}px`,
  );
  return [...lengths, `--aw-density-scale:${densityScales[density]}`].join(';') + ';';
}
