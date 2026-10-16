import { search, normalize, type SearchItem } from '../lib/search';
import { client } from './helpers';
export function initSearch() {
  const dialog = document.querySelector<HTMLDialogElement>('.search-dialog');
  if (!dialog) return;
  const input = dialog.querySelector<HTMLInputElement>('input')!,
    list = dialog.querySelector<HTMLUListElement>('.search-results')!,
    status = dialog.querySelector<HTMLElement>('.search-status')!,
    config = client();
  let data: SearchItem[] | undefined,
    pending: Promise<SearchItem[]> | undefined,
    selected = -1,
    timer: ReturnType<typeof setTimeout>,
    generation = 0,
    trigger: HTMLElement | null = null;
  function load() {
    return data
      ? Promise.resolve(data)
      : (pending ??= fetch(config.search)
          .then((res) => {
            if (!res.ok) throw new Error(String(res.status));
            return res.json();
          })
          .then((items) => (data = items))
          .catch((error) => {
            pending = undefined;
            throw error;
          }));
  }
  function highlight(node: HTMLElement, value: string, terms: string[]) {
    // Map normalized code points back to original character spans (NFKC can
    // expand a single glyph). Never interpret search content as HTML.
    let normal = '',
      offset = 0;
    const spans: { start: number; end: number }[] = [];
    for (const character of value) {
      const normalized = normalize(character);
      for (let i = 0; i < normalized.length; i++)
        spans.push({ start: offset, end: offset + character.length });
      normal += normalized;
      offset += character.length;
    }
    const ranges: { start: number; end: number }[] = [];
    for (const term of terms) {
      let i = normal.indexOf(term);
      while (i >= 0) {
        ranges.push({
          start: spans[i]?.start ?? 0,
          end: spans[i + term.length - 1]?.end ?? value.length,
        });
        i = normal.indexOf(term, i + Math.max(1, term.length));
      }
    }
    ranges.sort((a, b) => a.start - b.start);
    let cursor = 0;
    for (const r of ranges) {
      if (r.start < cursor) continue;
      node.append(document.createTextNode(value.slice(cursor, r.start)));
      const mark = document.createElement('mark');
      mark.textContent = value.slice(r.start, r.end);
      node.append(mark);
      cursor = r.end;
    }
    node.append(document.createTextNode(value.slice(cursor)));
  }
  async function run() {
    const current = ++generation,
      query = input.value.trim(),
      terms = normalize(query).split(/\s+/).filter(Boolean);
    selected = -1;
    list.replaceChildren();
    if (!terms.length) {
      status.textContent = config.labels.search_hint;
      return;
    }
    status.textContent = config.labels.loading;
    try {
      const items = await load();
      if (current !== generation) return;
      const results = search(items, query, config.searchLimit);
      status.textContent = results.length
        ? config.labels.search_results.replace('{n}', String(results.length))
        : config.labels.empty;
      for (const item of results) {
        const li = document.createElement('li'),
          a = document.createElement('a'),
          h = document.createElement('h3'),
          p = document.createElement('p');
        a.href = item.url;
        highlight(h, item.title, terms);
        highlight(
          p,
          item.excerpt || item.content.slice(0, config.searchOptions.excerpt_length),
          terms,
        );
        a.append(h, p);
        li.append(a);
        list.append(li);
      }
    } catch {
      if (current === generation) status.textContent = config.labels.error;
    }
  }
  const open = (el: HTMLElement | null) => {
    trigger = el;
    if (!dialog.open) dialog.showModal();
    input.focus();
    if (config.searchOptions.preload) load().catch(() => {});
  };
  document
    .querySelectorAll<HTMLElement>('.search-open')
    .forEach((button) => button.addEventListener('click', () => open(button)));
  dialog.querySelector('.search-close')?.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => trigger?.focus());
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(run, 120);
  });
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      dialog.close();
      return;
    }
    const links = [...list.querySelectorAll<HTMLAnchorElement>('a')];
    if (['ArrowDown', 'ArrowUp'].includes(e.key) && links.length) {
      e.preventDefault();
      selected = (selected + (e.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length;
      links.forEach((a, i) => a.classList.toggle('selected', i === selected));
      links[selected].scrollIntoView({ block: 'nearest' });
    }
    if (e.key === 'Enter' && selected >= 0) {
      e.preventDefault();
      links[selected]?.click();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (
      !config.searchOptions.shortcut ||
      e.altKey ||
      (e.target instanceof HTMLElement &&
        (e.target.matches('input,textarea,select') || e.target.isContentEditable))
    )
      return;
    if ((e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey)) || e.key === '/') {
      e.preventDefault();
      open(document.activeElement as HTMLElement);
    }
  });
}
