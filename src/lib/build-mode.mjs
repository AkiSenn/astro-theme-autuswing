export function buildMode(value, development = false) {
  const mode = value || (development ? 'development' : 'preview');
  if (!['development', 'preview', 'production'].includes(mode))
    throw new Error(`Unknown SITE_ENV: ${mode}`);
  return mode;
}

export function assertProductionUrl(actual, expected) {
  const url = new URL(actual);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/' ||
    url.origin !== expected
  )
    throw new Error(`Production site URL must be ${expected}; received ${actual}`);
}
