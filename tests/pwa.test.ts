import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { serviceWorker } from '../src/lib/service-worker.mjs';
import { pwaIcons } from '../src/lib/pwa-icons.mjs';
import { imageMetadata } from 'astro/assets/utils';

function runtime(
  html: string,
  network: { html: string; offline?: boolean },
  stores = new Map<string, Map<string, Response>>(),
  enabled = true,
) {
  const handlers = new Map<string, Function>();
  const caches = {
    keys: async () => [...stores.keys()],
    delete: async (key: string) => stores.delete(key),
    open: async (key: string) => {
      if (!stores.has(key)) stores.set(key, new Map());
      return {
        put: async (url: string, response: Response) => stores.get(key)!.set(url, response.clone()),
        match: async (url: string) => stores.get(key)!.get(url)?.clone(),
      };
    },
  };
  class LocalRequest extends Request {
    constructor(input: string, init?: RequestInit) {
      super(new URL(input, 'https://example.test'), init);
    }
  }
  vm.runInNewContext(serviceWorker(html, enabled), {
    self: {
      location: { origin: 'https://example.test' },
      addEventListener: (event: string, handler: Function) => handlers.set(event, handler),
      skipWaiting: async () => {},
      clients: { claim: async () => {} },
    },
    caches,
    crypto: webcrypto,
    Request: LocalRequest,
    Response,
    URL,
    fetch: async () => {
      if (network.offline) throw new Error('offline');
      return new Response(network.html);
    },
  });
  return {
    stores,
    dispatch: async (event: string) => {
      let operation: Promise<any> | undefined;
      handlers.get(event)!({
        waitUntil: (value: Promise<any>) => (operation = value),
        respondWith: (value: Promise<any>) => (operation = value),
        request: { method: 'GET', mode: 'navigate', url: 'https://example.test/article/' },
      });
      return operation;
    },
  };
}

test('worker changes exactly when offline shell content/enabled state changes', () => {
  assert.equal(serviceWorker('shell A'), serviceWorker('shell A'));
  assert.notEqual(serviceWorker('shell A'), serviceWorker('shell B'));
  assert.notEqual(serviceWorker('shell A'), serviceWorker('shell A', false));
  assert.ok(!serviceWorker('shell A').includes('location.reload'));
});

test('offline shell updates and removes only owned historical caches', async () => {
  const network = { html: 'shell A', offline: false };
  const first = runtime('shell A', network);
  await first.dispatch('install');
  await first.dispatch('activate');
  first.stores.set('autuswing-search-cache', new Map());
  first.stores.set('sunna-preferences', new Map());
  first.stores.set('autuswing-6e4cba15ed6f', new Map());
  first.stores.set('autuswing-astro-shell-v2', new Map());
  network.html = 'shell B';
  const second = runtime('shell B', network, first.stores);
  await second.dispatch('install');
  await second.dispatch('activate');
  assert.ok(second.stores.has('autuswing-search-cache'));
  assert.ok(second.stores.has('sunna-preferences'));
  assert.ok(!second.stores.has('autuswing-6e4cba15ed6f'));
  assert.ok(!second.stores.has('autuswing-astro-shell-v2'));
  assert.equal(
    [...second.stores.keys()].filter((k) => k.startsWith('autuswing-astro-shell-')).length,
    1,
  );
  network.offline = true;
  assert.equal(await (await second.dispatch('fetch')).text(), 'shell B');
  network.offline = false;
  network.html = 'online page';
  assert.equal(await (await second.dispatch('fetch')).text(), 'online page');
});

test('mismatched CDN offline bytes reject installation and preserve the working cache', async () => {
  const network = { html: 'shell A' };
  const first = runtime('shell A', network);
  await first.dispatch('install');
  await first.dispatch('activate');
  const before = [...first.stores.keys()];
  const next = runtime('shell B', network, first.stores);
  await assert.rejects(next.dispatch('install'), /versions differ/);
  assert.deepEqual([...next.stores.keys()], before);
});

test('disabling PWA cleans only its own shell and does not intercept fetch', async () => {
  const stores = new Map([
    ['autuswing-astro-shell-v2', new Map()],
    ['unrelated-feature', new Map()],
  ]);
  const worker = runtime('shell', { html: '' }, stores, false);
  await worker.dispatch('install');
  await worker.dispatch('activate');
  assert.deepEqual([...stores.keys()], ['unrelated-feature']);
  assert.equal(await worker.dispatch('fetch'), undefined);
});

test('manifest icons reuse the original artwork at exact sizes with a compact safe maskable asset', async () => {
  const icons = await pwaIcons('/img/avatar.png');
  assert.equal(icons.length, 3);
  for (const icon of icons) {
    const meta = await imageMetadata(Buffer.from(icon.data), icon.src);
    assert.equal(`${meta.width}x${meta.height}`, icon.sizes);
    assert.equal(meta.format, 'webp');
    assert.match(icon.src, /^\/pwa\/(?:icon-(?:192|512)|maskable-512)\.[a-f0-9]{16}\.webp$/);
    assert.ok(icon.data.length < 64 * 1024, `${icon.src} exceeds the icon budget`);
  }
  assert.equal(icons.filter((i) => i.purpose === 'maskable').length, 1);
  assert.ok(icons.every((i) => i.src !== '/img/avatar.png'));
});
