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
