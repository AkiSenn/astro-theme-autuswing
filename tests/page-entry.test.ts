import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('src/scripts/page-entry-init.js', 'utf8');

class Events {
  handlers = new Map<string, Set<(event: any) => void>>();
  addEventListener = (type: string, fn: (event: any) => void) => {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type)!.add(fn);
  };
  removeEventListener = (type: string, fn: (event: any) => void) =>
    this.handlers.get(type)?.delete(fn);
  emit(type: string, event: object = {}) {
    this.handlers.get(type)?.forEach((fn) => fn(event));
  }
  count() {
    return [...this.handlers.values()].reduce((n, set) => n + set.size, 0);
  }
}

class Attributes {
  values = new Map<string, string>();
  setAttribute = (key: string, value: string) => this.values.set(key, value);
  getAttribute = (key: string) => this.values.get(key) ?? null;
  hasAttribute = (key: string) => this.values.has(key);
  removeAttribute = (key: string) => this.values.delete(key);
}

function fixture({
  native = false,
  partial = false,
  same = true,
  legacy = false,
  enabled = true,
  reduced = false,
  hash = '',
  hidden = false,
  late = false,
  parsedMain = false,
} = {}) {
  const root = new Attributes(), script = new Attributes();
  root.setAttribute('data-motion', String(enabled));
  const events = new Events(), docEvents = new Events(), media = new Events();
  const preference: any = { matches: reduced };
  if (!legacy) {
    preference.addEventListener = media.addEventListener;
    preference.removeEventListener = media.removeEventListener;
  }
  preference.addListener = (fn: (event: any) => void) => media.addEventListener('change', fn);
  preference.removeListener = (fn: (event: any) => void) => media.removeEventListener('change', fn);
  const observers = new Set<() => void>();
  let main: object | null = parsedMain ? {} : null;
  const document: any = {
    documentElement: root, currentScript: script,
    readyState: late ? 'complete' : 'loading', hidden,
    getElementById: () => main,
    addEventListener: docEvents.addEventListener,
    removeEventListener: docEvents.removeEventListener,
  };
  if (same) document.startViewTransition = () => { throw Error('Must not start a native transition'); };
  const window: any = {};
  if (native) {
    window.onpagereveal = null;
    window.onpageswap = null;
    window.PageRevealEvent = class { get viewTransition() { return null; } };
    window.CSSViewTransitionRule = class {};
  } else if (partial) window.CSSViewTransitionRule = class {};
  const context = vm.createContext({
    window, document, location: { hash }, matchMedia: () => preference,
    addEventListener: events.addEventListener,
    removeEventListener: events.removeEventListener,
    MutationObserver: class {
      constructor(private fn: () => void) {}
      observe() { observers.add(this.fn); }
      disconnect() { observers.delete(this.fn); }
    },
  });
  const init = () => vm.runInContext(source, context);
  init();
  return {
    root, script, document, events, docEvents, media, preference, observers, init,
    armed: () => root.hasAttribute('data-page-entry'),
    changed: () => observers.forEach((fn) => fn()),
    main: () => main ?? (main = {}),
    listeners: () => events.count() + docEvents.count() + media.count() + observers.size,
  };
}

test('unsupported cross-document mode arms in head regardless of same-document API', () => {
  for (const same of [true, false]) {
    const f = fixture({ same });
    assert.equal(f.armed(), true);
    assert.equal(f.document.getElementById('main'), null);
  }
});

test('reliable pagereveal uses actual native transition, never a delayed failure fallback', () => {
  const native = fixture({ native: true });
  assert.equal(native.armed(), false);
  native.events.emit('pagereveal', { viewTransition: { ready: Promise.resolve() } });
  assert.equal(native.armed(), false);
  assert.equal(native.listeners(), 0);
  native.events.emit('pagereveal', { viewTransition: null });
  assert.equal(native.armed(), false);
  const direct = fixture({ native: true });
  direct.events.emit('pagereveal', { viewTransition: null });
  assert.equal(direct.armed(), true);
});

test('partial capabilities, late installation and already parsed content stay visible', () => {
  for (const options of [{ partial: true }, { late: true }, { parsedMain: true }]) {
    const f = fixture(options);
    assert.equal(f.armed(), false);
    assert.equal(f.listeners(), 0);
  }
});

test('initial reduced motion, disabled policy, anchors and background pages do not enter', () => {
  for (const options of [{ reduced: true }, { enabled: false }, { hash: '#heading' }, { hidden: true }]) {
    const f = fixture(options);
    assert.equal(f.armed(), false);
    assert.equal(f.listeners(), 0);
  }
});

test('matching main animation completion or cancellation disposes all owned resources', () => {
  for (const event of ['animationend', 'animationcancel']) {
    const f = fixture(), main = f.main();
    f.docEvents.emit(event, { target: {}, animationName: 'autuswing-content-enter' });
    f.docEvents.emit(event, { target: main, animationName: 'autuswing-appearance-in' });
    assert.equal(f.armed(), true);
    f.docEvents.emit(event, { target: main, animationName: 'autuswing-content-enter' });
    assert.equal(f.armed(), false);
    assert.equal(f.listeners(), 0);
  }
});

test('mid-entry reduced motion and config changes settle without replay, including legacy listeners', () => {
  for (const legacy of [true, false]) for (const policy of ['system', 'config']) {
    const f = fixture({ legacy });
    if (policy === 'system') { f.preference.matches = true; f.media.emit('change'); }
    else { f.root.setAttribute('data-motion', 'false'); f.changed(); }
    assert.equal(f.armed(), false);
    assert.equal(f.listeners(), 0);
    f.preference.matches = false;
    f.root.setAttribute('data-motion', 'true');
    f.media.emit('change'); f.changed();
    assert.equal(f.armed(), false);
  }
});

test('same-document theme capture cancels page entry and cannot restart it afterwards', () => {
  const f = fixture();
  f.root.setAttribute('data-appearance-transition', ''); f.changed();
  assert.equal(f.armed(), false);
  assert.equal(f.listeners(), 0);
  f.root.removeAttribute('data-appearance-transition'); f.changed();
  assert.equal(f.armed(), false);
});

test('outbound navigation and BFCache restoration only settle, never rearm cached content', () => {
  for (const event of ['pagehide', 'pageswap', 'pageshow']) {
    const f = fixture();
    f.events.emit(event, { persisted: true });
    assert.equal(f.armed(), false);
    assert.equal(f.listeners(), 0);
    f.events.emit('pageshow', { persisted: true });
    f.events.emit('pagereveal', { viewTransition: null });
    assert.equal(f.armed(), false);
  }
});

test('repeated inline initialization neither duplicates listeners nor restarts entry', () => {
  const f = fixture(), count = f.listeners();
  f.init(); f.init();
  assert.equal(f.listeners(), count);
  f.events.emit('pagehide'); f.init();
  assert.equal(f.armed(), false);
  assert.equal(f.listeners(), 0);
});
