import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = ts.transpileModule(fs.readFileSync('src/scripts/appearance.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;

class Events {
  handlers = new Map<string, Set<(event: any) => void>>();
  matches = false;
  addEventListener = (type: string, callback: (event: any) => void) => {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type)!.add(callback);
  };
  removeEventListener = (type: string, callback: (event: any) => void) =>
    this.handlers.get(type)?.delete(callback);
  emit(type: string, fields: object = {}) {
    this.handlers.get(type)?.forEach((fn) => fn(fields));
  }
}

function fixture({
  api = true,
  enabled = true,
  busy = false,
  denied = false,
  throws = false,
} = {}) {
  const root = {
    dataset: { mode: 'light', theme: 'light', motion: String(enabled) } as Record<string, string>,
    matches: () => busy,
  };
  const scheme = new Events(),
    reduced = new Events(),
    events = new Events();
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
  const storage = new Map<string, string>(),
    messages: string[] = [],
    jobs: any[] = [];
  const meta = { content: '' };
  const observers = new Set<() => void>();
  const doc: any = {
    documentElement: root,
    activeViewTransition: null,
    querySelectorAll: (selector: string) => (selector === '.mode-toggle' ? buttons : [meta]),
  };
  if (api)
    doc.startViewTransition = (callback: () => void) => {
      if (throws) throw Error('native start failed');
      let ready!: () => void, reject!: (error: Error) => void, finish!: () => void;
      const job = {
        skipped: false,
        applied: false,
        ready: new Promise<void>((resolve, no) => {
          ready = resolve;
          reject = no;
        }),
        finished: new Promise<void>((resolve) => {
          finish = resolve;
        }),
        run() {
          if (this.applied) return;
          this.applied = true;
          callback();
          if (this.skipped) {
            reject(Error('skipped'));
            finish();
          } else ready();
        },
        skipTransition() {
          this.skipped = true;
          if (this.applied) finish();
        },
        finish() {
          finish();
        },
      };
      doc.activeViewTransition = job;
      job.finished.then(() => {
        if (doc.activeViewTransition === job) doc.activeViewTransition = null;
      });
      jobs.push(job);
      return job;
    };
  const module = { exports: {} as any };
  vm.runInNewContext(source, {
    exports: module.exports,
    require: () => ({
      client: () => ({
        mode: 'auto',
        labels: { mode: '外观', mode_light: '浅色', mode_dark: '深色', mode_auto: '自动' },
      }),
      toast: (s: string) => messages.push(s),
      reduced,
      motionEnabled: () => !reduced.matches && root.dataset.motion !== 'false',
    }),
    document: doc,
    matchMedia: () => scheme,
    getComputedStyle: () => ({
      getPropertyValue: () => (root.dataset.theme === 'dark' ? '#111' : '#fff'),
    }),
    localStorage: {
      getItem: (key: string) => storage.get(key),
      setItem: (key: string, value: string) => {
        if (denied) throw Error('denied');
        storage.set(key, value);
      },
    },
    CustomEvent: class {
      constructor(
        public type: string,
        public init: object,
      ) {}
    },
    dispatchEvent: () => {},
    addEventListener: events.addEventListener,
    removeEventListener: events.removeEventListener,
    MutationObserver: class {
      constructor(private callback: () => void) {}
      observe() {
        observers.add(this.callback);
      }
      disconnect() {
        observers.delete(this.callback);
      }
    },
  });
  const init = () => module.exports.initAppearance();
  init();
  return {
    root,
    buttons,
    storage,
    messages,
    jobs,
    scheme,
    reduced,
    events,
    observers,
    meta,
    init,
    configChange: () => observers.forEach((fn) => fn()),
  };
}

test('native callback atomically updates theme, icon state, ARIA, storage and theme-color once', async () => {
  const f = fixture();
  f.buttons[0].emit('click');
  assert.equal(f.jobs.length, 1);
  assert.equal(f.root.dataset.theme, 'light');
  assert.equal(f.storage.has('autuswing-appearance'), false);
  assert.equal(f.root.dataset.appearanceTransition, '');
  f.jobs[0].run();
  assert.equal(f.root.dataset.theme, 'dark');
  assert.equal(f.storage.get('autuswing-appearance'), 'dark');
  assert.equal(f.meta.content, '#111');
  for (const b of f.buttons) {
    assert.equal(b.dataset.theme, 'dark');
    assert.match(b.attributes['aria-label'], /深色/);
    assert.equal(b.title, b.attributes['aria-label']);
  }
  f.jobs[0].run();
  assert.equal(f.messages.length, 1);
  f.jobs[0].finish();
  await Promise.resolve();
  assert.equal(f.root.dataset.appearanceTransition, undefined);
});

test('rapid requests use logical mode and stale callbacks cannot overwrite newer state', async () => {
  const f = fixture();
  for (let i = 0; i < 4; i++) f.buttons[0].emit('click');
  assert.equal(f.jobs.length, 1);
  assert.equal(f.jobs[0].skipped, true);
  assert.equal(f.root.dataset.mode, 'dark');
  assert.equal(f.storage.get('autuswing-appearance'), 'dark');
  f.jobs[0].run();
  await Promise.resolve();
  assert.equal(f.root.dataset.theme, 'dark');
  assert.equal(f.root.dataset.appearanceTransition, undefined);
  assert.equal(f.messages.length, 3);
});

for (const policy of ['system', 'config'])
  test(`${policy} disabling during capture commits the last requested state and skips native animation`, async () => {
    const f = fixture();
    f.buttons[0].emit('click');
    if (policy === 'system') {
      f.reduced.matches = true;
      f.reduced.emit('change');
    } else {
      f.root.dataset.motion = 'false';
      f.configChange();
    }
    assert.equal(f.root.dataset.theme, 'dark');
    assert.equal(f.storage.get('autuswing-appearance'), 'dark');
    assert.equal(f.jobs[0].skipped, true);
    assert.equal(f.root.dataset.appearanceTransition, undefined);
    f.jobs[0].run();
    await Promise.resolve();
    assert.equal(f.messages.length, 1);
  });

test('absent API, disabled motion, native conflict and synchronous API failure keep direct updates', () => {
  for (const options of [{ api: false }, { enabled: false }, { busy: true }, { throws: true }]) {
    const f = fixture(options);
    f.buttons[0].emit('click');
    assert.equal(f.root.dataset.theme, 'dark');
    assert.equal(f.storage.get('autuswing-appearance'), 'dark');
    assert.equal(f.root.dataset.appearanceTransition, undefined);
    assert.equal(f.jobs.length, 0);
  }
});

test('same effective palette, OS and cross-tab changes do not start a redundant transition', async () => {
  const f = fixture();
  f.buttons[0].emit('click'); // dark
  f.jobs[0].run();
  f.jobs[0].finish();
  await Promise.resolve();
  f.buttons[0].emit('click'); // auto/light
  f.jobs[1].run();
  f.jobs[1].finish();
  await Promise.resolve();
  f.scheme.matches = true;
  f.scheme.emit('change');
  assert.equal(f.root.dataset.theme, 'dark');
  f.events.emit('storage', { key: 'autuswing-appearance', newValue: 'light' });
  assert.equal(f.root.dataset.theme, 'light');
  f.events.emit('storage', { key: 'autuswing-appearance', newValue: 'auto' });
  f.scheme.matches = false;
  f.scheme.emit('change');
  f.buttons[0].emit('click'); // auto/light -> light/light
  assert.equal(f.jobs.length, 2);
  assert.equal(f.root.dataset.mode, 'light');
});

test('pageswap/BFCache settle pending update; repeated initialization releases owned listeners', async () => {
  const f = fixture();
  f.buttons[0].emit('click');
  f.events.emit('pageswap');
  assert.equal(f.root.dataset.theme, 'dark');
  assert.equal(f.root.dataset.appearanceTransition, undefined);
  f.jobs[0].run();
  await Promise.resolve();
  f.events.emit('pagehide', { persisted: true });
  f.storage.set('autuswing-appearance', 'auto');
  f.events.emit('pageshow', { persisted: true });
  assert.equal(f.root.dataset.theme, 'light');
  f.init();
  f.init();
  assert.equal(f.observers.size, 1);
  for (const b of f.buttons) assert.equal(b.handlers.get('click')?.size, 1);
  assert.equal(f.reduced.handlers.get('change')?.size, 1);
  assert.equal(f.events.handlers.get('pageswap')?.size, 1);
  f.events.emit('pagehide', { persisted: false });
  assert.equal(f.observers.size, 0);
});

test('storage denial leaves native update and mode cycle functional', () => {
  const f = fixture({ denied: true });
  f.buttons[0].emit('click');
  f.jobs[0].run();
  assert.equal(f.root.dataset.theme, 'dark');
  assert.equal(f.buttons[0].dataset.theme, 'dark');
});
