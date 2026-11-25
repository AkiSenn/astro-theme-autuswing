import { search, searchExcerpt, normalize, type SearchItem } from '../lib/search';
import { client } from './helpers';
import { openDialog, closeDialog, restoreDialogFocus } from './dialogs';

let disposeSearch: (() => void) | undefined;

export function initSearch() {
  disposeSearch?.();
  const dialog = document.querySelector<HTMLDialogElement>('.search-dialog');
  if (!dialog) return;
  const subscriptions: (() => void)[] = [];
  const listen = (
    target: EventTarget,
    name: string,
    handler: EventListener,
    options?: AddEventListenerOptions | boolean,
  ) => {
    target.addEventListener(name, handler, options);
    subscriptions.push(() => target.removeEventListener(name, handler, options));
  };
  const input = dialog.querySelector<HTMLInputElement>('input')!,
    list = dialog.querySelector<HTMLUListElement>('.search-results')!,
    status = dialog.querySelector<HTMLElement>('.search-status')!,
    config = client();
  let data: SearchItem[] | undefined,
    pending: Promise<SearchItem[]> | undefined,
    selected = -1,
    timer: ReturnType<typeof setTimeout> | undefined,
    generation = 0,
    trigger: HTMLElement | null = null;
  // Search is an overlay, so its query is not encoded in the page URL. Keep
  // only this small UI snapshot on the source history entry, for a cold back
  // navigation where the browser cannot restore the document from BFCache.
  const navigation = window.navigation;
  type SearchSnapshot = { query: string; scrollTop: number; selected: number };
  function snapshot(): SearchSnapshot | undefined {
    try {
      const value = navigation?.currentEntry?.getState()?.autuswingSearch;
      if (
        typeof value?.query === 'string' &&
        Number.isFinite(value.scrollTop) &&
        Number.isInteger(value.selected)
      )
        return value;
    } catch {}
  }
  function remember(value?: SearchSnapshot) {
    try {
      if (!navigation?.currentEntry) return;
      const previous = navigation.currentEntry.getState();
      if (previous != null && (typeof previous !== 'object' || Array.isArray(previous))) return;
      if (!value && !previous?.autuswingSearch) return;
      const state = { ...previous };
      if (value) state.autuswingSearch = value;
      else delete state.autuswingSearch;
      navigation.updateCurrentEntry({ state });
    } catch {} // A restricted history API must not prevent normal navigation.
  }
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
        highlight(p, searchExcerpt(item, query, config.searchOptions.excerpt_length), terms);
        a.append(h, p);
        li.append(a);
        list.append(li);
      }
    } catch {
      if (current === generation) status.textContent = config.labels.error;
    }
  }
  const open = (el: HTMLElement | null) => {
    trigger = el?.closest('dialog')
      ? [...document.querySelectorAll<HTMLElement>('.search-open')].find(
          (node) => node.getClientRects().length,
        ) || null
      : el;
    openDialog(dialog);
    input.focus();
    if (config.searchOptions.preload) load().catch(() => {});
  };
  document
    .querySelectorAll<HTMLElement>('.search-open')
    .forEach((button) => listen(button, 'click', () => open(button)));
  const closeButton = dialog.querySelector('.search-close');
  if (closeButton) listen(closeButton, 'click', () => closeDialog(dialog));
  listen(dialog, 'click', (e) => {
    if (e.target === dialog) closeDialog(dialog);
  });
  listen(dialog, 'close', () => {
    const replaced = dialog.dataset.replaced === 'true';
    if (replaced) delete dialog.dataset.replaced;
    remember();
    if (!replaced) restoreDialogFocus(trigger);
  });
  listen(list, 'click', (event) => {
    const e = event as MouseEvent;
    const link =
      e.target instanceof Element ? e.target.closest<HTMLAnchorElement>('a[href]') : null;
    if (
      e.defaultPrevented ||
      e.button ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey ||
      !link ||
      link.origin !== location.origin
    )
      return;
    remember({ query: input.value, scrollTop: list.scrollTop, selected });
  });
  listen(input, 'input', () => {
    clearTimeout(timer);
    timer = setTimeout(run, 120);
  });
  listen(dialog, 'keydown', (event) => {
    const e = event as KeyboardEvent;
    if (e.key === 'Escape') {
      e.preventDefault();
      closeDialog(dialog);
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
  listen(document, 'keydown', (event) => {
    const e = event as KeyboardEvent;
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
  listen(window, 'pageshow', (e) => {
    const event = e as PageTransitionEvent;
    if (event.persisted || navigation?.activation?.navigationType !== 'traverse') return;
    const saved = snapshot();
    if (!saved?.query.trim() || dialog.open) return;
    input.value = saved.query;
    open(document.querySelector<HTMLElement>('.search-open:not([hidden])'));
    void run().then(() => {
      if (!dialog.open || input.value !== saved.query) return;
      list.scrollTop = saved.scrollTop;
      const links = [...list.querySelectorAll<HTMLAnchorElement>('a')];
      selected = Math.min(links.length - 1, Math.max(-1, saved.selected));
      links.forEach((link, index) => link.classList.toggle('selected', index === selected));
    });
  });
  const cleanup = () => {
    clearTimeout(timer);
    timer = undefined;
    generation++;
    subscriptions.splice(0).forEach((remove) => remove());
    if (disposeSearch === cleanup) disposeSearch = undefined;
  };
  listen(window, 'pagehide', (event) => {
    clearTimeout(timer);
    timer = undefined;
    if (!(event as PageTransitionEvent).persisted) cleanup();
  });
  disposeSearch = cleanup;
  return cleanup;
}
