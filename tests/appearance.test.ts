import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const executable = ts.transpileModule(fs.readFileSync('src/scripts/appearance.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const initializer = fs.readFileSync('src/scripts/appearance-init.js', 'utf8');
const labels = { mode: '切换外观', mode_auto: '跟随系统', mode_light: '日间', mode_dark: '夜间' };

class Events extends EventTarget {
  handlers = new Map<string, Set<EventListenerOrEventListenerObject>>();
  addEventListener(type: string, handler: EventListenerOrEventListenerObject | null) {
    super.addEventListener(type, handler);
    if (handler) {
      if (!this.handlers.has(type)) this.handlers.set(type, new Set());
      this.handlers.get(type)!.add(handler);
    }
  }
  removeEventListener(type: string, handler: EventListenerOrEventListenerObject | null) {
    super.removeEventListener(type, handler);
    if (handler) this.handlers.get(type)?.delete(handler);
  }
  emit(type: string, values = {}) {
    this.dispatchEvent(Object.assign(new Event(type), values));
  }
  count(type: string) {
    return this.handlers.get(type)?.size || 0;
  }
}

function environment(
  options: {
    mode?: string;
    current?: string;
    legacy?: string;
    dark?: boolean;
    legacyMedia?: boolean;
    denied?: boolean;
  } = {},
) {
  const root = {
    dataset: { mode: options.mode || 'auto', theme: '' } as Record<string, string>,
    getAttribute(name: string) {
      return this.dataset[name.replace('data-', '')] || null;
    },
    setAttribute(name: string, value: string) {
      this.dataset[name.replace('data-', '')] = value;
    },
  };
  const buttons = Array.from({ length: 3 }, () =>
    Object.assign(new Events(), {
      dataset: {} as Record<string, string>,
      title: '',
      attributes: {} as Record<string, string>,
      setAttribute(name: string, value: string) {
        this.attributes[name] = value;
      },
    }),
  );
  const mediaEvents = new Events(),
    windowEvents = new Events(),
    messages: string[] = [];
  const storage = new Map<string, string>();
  if (options.current) storage.set('autuswing-appearance', options.current);
  if (options.legacy) storage.set('sunna-appearance', options.legacy);
  const scheme = {
    matches: options.dark || false,
    addEventListener: options.legacyMedia
      ? undefined
      : mediaEvents.addEventListener.bind(mediaEvents),
    removeEventListener: options.legacyMedia
      ? undefined
      : mediaEvents.removeEventListener.bind(mediaEvents),
    addListener: (fn: EventListener) => mediaEvents.addEventListener('change', fn),
    removeListener: (fn: EventListener) => mediaEvents.removeEventListener('change', fn),
  };
  const meta = { content: '' };
  const sandbox = {
    exports: {} as { initAppearance: () => void },
    require(name: string) {
      assert.equal(name, './helpers');
      return {
        client: () => ({ mode: options.mode || 'auto', labels }),
        toast: (text: string) => messages.push(text),
      };
    },
    document: {
      documentElement: root,
      querySelectorAll(selector: string) {
        if (selector === '.mode-toggle') return buttons;
        assert.equal(selector, 'meta[name="theme-color"]');
        return [meta];
      },
    },
    localStorage: {
      getItem(key: string) {
        if (options.denied) throw Error('denied');
        return storage.get(key) || null;
      },
      setItem(key: string, value: string) {
        if (options.denied) throw Error('denied');
        storage.set(key, value);
      },
    },
    matchMedia: () => scheme,
    getComputedStyle: () => ({
      getPropertyValue: () => (root.dataset.theme === 'dark' ? '#111' : '#fff'),
    }),
    CustomEvent: class extends Event {
      detail: unknown;
      constructor(type: string, init: { detail: unknown }) {
        super(type);
        this.detail = init.detail;
      }
    },
    window: windowEvents,
    addEventListener: windowEvents.addEventListener.bind(windowEvents),
    removeEventListener: windowEvents.removeEventListener.bind(windowEvents),
    dispatchEvent: windowEvents.dispatchEvent.bind(windowEvents),
  };
  vm.runInNewContext(initializer, sandbox);
  vm.runInNewContext(executable, sandbox);
  const init = () => sandbox.exports.initAppearance();
  return { init, root, buttons, storage, scheme, windowEvents, mediaEvents, messages, meta };
}

test('initial current mode, resolved scheme, all button labels and theme-color agree', () => {
  for (const mode of ['auto', 'light', 'dark'])
    for (const dark of [false, true]) {
      const e = environment({ current: mode, dark });
      e.init();
      const theme = mode === 'auto' ? (dark ? 'dark' : 'light') : mode;
      assert.equal(e.root.dataset.theme, theme);
      for (const button of e.buttons) {
        assert.equal(button.dataset.mode, mode);
        assert.equal(button.dataset.theme, theme);
        assert.ok(
          button.attributes['aria-label'].includes(labels[`mode_${mode}` as keyof typeof labels]),
        );
        assert.equal(button.title, button.attributes['aria-label']);
        if (mode === 'auto')
          assert.ok(button.title.includes(labels[`mode_${theme}` as keyof typeof labels]));
      }
      assert.equal(e.meta.content, theme === 'dark' ? '#111' : '#fff');
    }
});

test('legacy storage and current-key precedence survive without changing the initializer', () => {
  const legacy = environment({ legacy: 'dark' });
  legacy.init();
  assert.equal(legacy.root.dataset.mode, 'dark');
  assert.equal(legacy.storage.get('autuswing-appearance'), 'dark');
  const current = environment({ current: 'light', legacy: 'dark' });
  current.init();
  assert.equal(current.root.dataset.mode, 'light');
  assert.equal(current.storage.get('sunna-appearance'), 'dark');
});

test('repeat initialization binds one click, media listener and lifecycle handler', () => {
  const e = environment();
  e.init();
  e.init();
  e.init();
  e.buttons[0].emit('click');
  assert.equal(e.root.dataset.mode, 'light');
  assert.equal(e.messages.length, 1);
  assert.equal(e.mediaEvents.count('change'), 1);
  for (const name of ['storage', 'pageshow', 'pagehide'])
    assert.equal(e.windowEvents.count(name), 1);
  for (const button of e.buttons) assert.equal(button.count('click'), 1);
  e.windowEvents.emit('pagehide', { persisted: true });
  assert.equal(e.mediaEvents.count('change'), 1);
  e.windowEvents.emit('pagehide', { persisted: false });
  assert.equal(e.mediaEvents.count('change'), 0);
  for (const button of e.buttons) assert.equal(button.count('click'), 0);
});

test('the existing auto-light-dark cycle persists once; automatic scheme follows the OS', () => {
  const e = environment();
  e.init();
  e.scheme.matches = true;
  e.mediaEvents.emit('change');
  assert.equal(e.root.dataset.theme, 'dark');
  e.scheme.matches = false;
  e.mediaEvents.emit('change');
  assert.equal(e.root.dataset.theme, 'light');
  for (const mode of ['light', 'dark', 'auto']) {
    e.buttons[0].emit('click');
    assert.equal(e.root.dataset.mode, mode);
    assert.equal(e.storage.get('autuswing-appearance'), mode);
  }
  e.buttons[0].emit('click');
  e.scheme.matches = true;
  e.mediaEvents.emit('change');
  assert.equal(e.root.dataset.theme, 'light');
});

test('cross-tab storage updates and clear synchronize without inventing legacy migrations', () => {
  const e = environment();
  e.init();
  e.windowEvents.emit('storage', { key: 'autuswing-appearance', newValue: 'dark' });
  assert.equal(e.root.dataset.theme, 'dark');
  e.windowEvents.emit('storage', { key: 'unrelated', newValue: 'light' });
  assert.equal(e.root.dataset.theme, 'dark');
  e.windowEvents.emit('storage', { key: null, newValue: null });
  assert.equal(e.root.dataset.mode, 'auto');
  e.windowEvents.emit('storage', { key: 'autuswing-appearance', newValue: 'invalid' });
  assert.equal(e.root.dataset.mode, 'auto');
});

test('bfcache restoration reads the latest saved mode and actual automatic scheme', () => {
  const e = environment({ current: 'dark' });
  e.init();
  e.storage.set('autuswing-appearance', 'auto');
  e.scheme.matches = false;
  e.windowEvents.emit('pageshow', { persisted: true });
  assert.equal(e.root.dataset.mode, 'auto');
  assert.equal(e.root.dataset.theme, 'light');
  e.storage.set('autuswing-appearance', 'dark');
  e.windowEvents.emit('pageshow', { persisted: true });
  assert.equal(e.root.dataset.theme, 'dark');
});

test('legacy MediaQueryList listeners work and are removed on reinitialization', () => {
  const e = environment({ legacyMedia: true });
  e.init();
  e.init();
  assert.equal(e.mediaEvents.count('change'), 1);
  e.scheme.matches = true;
  e.mediaEvents.emit('change');
  assert.equal(e.root.dataset.theme, 'dark');
  e.windowEvents.emit('pagehide', { persisted: false });
  assert.equal(e.mediaEvents.count('change'), 0);
});

test('blocked storage does not prevent switching or bfcache restoration', () => {
  const e = environment({ denied: true });
  e.init();
  e.buttons[0].emit('click');
  e.buttons[0].emit('click');
  assert.equal(e.root.dataset.mode, 'dark');
  e.windowEvents.emit('pageshow', { persisted: true });
  assert.equal(e.root.dataset.mode, 'dark');
});
