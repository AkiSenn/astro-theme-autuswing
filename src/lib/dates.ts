export function parseDate(value: unknown): string {
  if (value instanceof Date)
    throw new Error('Use the original YAML date string, not an implicitly coerced Date');
  const raw = String(value ?? '').trim();
  const local = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2})(\.\d{1,3})?)?)?$/,
  );
  const explicit =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/i.test(raw);
  if (!local && !explicit) throw new Error(`Unsupported or missing date: ${raw}`);
  // Date normalizes February 30 and 24:00 instead of rejecting them. Validate
  // the author's calendar components before parsing either local or zoned ISO.
  const [year, month, day, hour = '0', minute = '0', second = '0'] = raw.match(/\d+/g)!;
  const y = Number(year),
    m = Number(month),
    d = Number(day);
  const days = [
    31,
    y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  const offset = raw.match(/[+-](\d{2}):(\d{2})$/);
  if (
    m < 1 ||
    m > 12 ||
    d < 1 ||
    d > days[m - 1] ||
    Number(hour) > 23 ||
    Number(minute) > 59 ||
    Number(second) > 59 ||
    (offset && (Number(offset[1]) > 23 || Number(offset[2]) > 59))
  )
    throw new Error(`Invalid calendar date: ${raw}`);
  const input = local
    ? `${local[1]}-${local[2]}-${local[3]}T${local[4] || '00'}:${local[5] || '00'}:${local[6] || '00'}${local[7] || ''}+08:00`
    : raw;
  const date = new Date(input);
  if (!Number.isFinite(date.getTime())) throw new Error(`Invalid date: ${raw}`);
  if (local && formatDate(date.toISOString(), '-') !== `${local[1]}-${local[2]}-${local[3]}`)
    throw new Error(`Invalid calendar date: ${raw}`);
  return date.toISOString();
}
export function formatDate(value: string, separator = '.') {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(new Date(value))
    .replaceAll('-', separator);
}
