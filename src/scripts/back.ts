type Entry = Pick<NavigationHistoryEntry, 'key' | 'url' | 'index' | 'sameDocument'>;

// The browser owns this list, including reloads and forward/back traversal.
// Never infer a safe destination from history.length or a stale referrer.
export function previousSiteEntry(entries: readonly Entry[], index: number, href: string) {
  const current = new URL(href);
  for (let i = index - 1; i >= 0; i--) {
    const entry = entries.find((candidate) => candidate.index === i);
    if (!entry?.url || !entry.key) return;
    const target = new URL(entry.url);
    if (target.origin !== current.origin || !/^https?:$/.test(target.protocol)) return;
    // TOC/fragment entries and repeated visits to this article are not a
    // useful way back to the page from which the reader entered it.
    if (entry.sameDocument || target.pathname === current.pathname) continue;
    return { key: entry.key, url: target.href };
  }
}

export function initBack() {
  const link = document.querySelector<HTMLAnchorElement>('[data-article-back]');
  if (!link) return;
  const fallback = link.href;
  const navigation = window.navigation;
  let pending = false;
  const target = () => {
    try {
      if (!navigation?.canGoBack || !navigation.currentEntry || !navigation.traverseTo) return;
      return previousSiteEntry(navigation.entries(), navigation.currentEntry.index, location.href);
    } catch {
      return;
    }
  };
  const sync = () => {
    link.href = target()?.url || fallback;
  };
  sync();
  navigation?.addEventListener('currententrychange', sync);
  addEventListener('pageshow', () => {
    pending = false;
    sync();
  });
  link.addEventListener('click', (event) => {
    if (
      event.defaultPrevented ||
      event.button ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    const destination = target();
    if (!destination) {
      link.href = fallback;
      return;
    }
    event.preventDefault();
    if (pending) return;
    pending = true;
    const failed = (error: unknown) => {
      pending = false;
      // An interrupted navigation belongs to the user's next action. Do not
      // replace it with a delayed fallback from this earlier click.
      if (!(error instanceof DOMException && error.name === 'AbortError'))
        location.assign(fallback);
    };
    try {
      const result = navigation.traverseTo(destination.key);
      if (!result.committed) {
        location.assign(fallback);
        return;
      }
      void result.committed.catch(failed);
      void result.finished?.catch(() => {});
    } catch (error) {
      failed(error);
    }
  });
}
