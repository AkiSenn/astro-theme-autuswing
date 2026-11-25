import { load, JSON_SCHEMA } from 'js-yaml';
export function frontmatter(raw) {
  const match = raw.match(/^\uFEFF?---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) throw new Error('Markdown must start with YAML front matter');
  const data = load(match[1], { schema: JSON_SCHEMA }) || {};
  // YAML numeric coercion must never erase a public identifier's leading zeros.
  for (const key of ['id', 'abbrlink']) {
    const scalar = match[1].match(
      new RegExp('^' + key + ':\\s*([A-Za-z0-9_-]+)\\s*(?:#.*)?$', 'm'),
    );
    if (scalar) data[key] = scalar[1];
  }
  return { data, body: raw.slice(match[0].length), rawFrontmatter: match[1] };
}
