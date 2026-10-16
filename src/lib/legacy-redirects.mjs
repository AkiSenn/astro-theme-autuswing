import legacy from '../../migration/effective-metadata.json' with { type: 'json' };
export function redirects() {
  const rules = [];
  for (const p of legacy) {
    const date = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .format(new Date(p.date))
      .replaceAll('-', '/');
    for (const from of [`/post/${p.abbrlink}.html`, `/p/${p.abbrlink}/`, `/${date}/${p.slug}/`]) {
      rules.push({ from, to: p.path, status: 301 });
      if (from.endsWith('/')) {
        rules.push(
          { from: from + 'index.html', to: p.path, status: 301 },
          { from: from.slice(0, -1), to: p.path, status: 301 },
        );
      }
    }
  }
  return rules;
}
