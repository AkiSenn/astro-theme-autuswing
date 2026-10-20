import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// 只替换模块依赖边界，执行真实脚本；虚拟时钟直接观察调度，不等待真实秒数。
const executable = ts.transpileModule(fs.readFileSync('src/scripts/runtime.js', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const zh = { runtime: '已运行', runtime_format: '{d} 天 {h} 小时 {m} 分 {s} 秒' };
const start = Date.parse('2020-01-01T00:00:00+08:00');

class Events extends EventTarget {
  registered = new Map<string, Set<EventListenerOrEventListenerObject>>();
  addEventListener(type: string, fn: EventListenerOrEventListenerObject | null) {
    super.addEventListener(type, fn);
    if (fn) {
      if (!this.registered.has(type)) this.registered.set(type, new Set());
      this.registered.get(type)!.add(fn);
    }
  }
  removeEventListener(type: string, fn: EventListenerOrEventListenerObject | null) {
    super.removeEventListener(type, fn);
    if (fn) this.registered.get(type)?.delete(fn);
  }
  count(type: string) {
    return this.registered.get(type)?.size || 0;
  }
  emit(type: string, values: object = {}) {
    this.dispatchEvent(Object.assign(new Event(type), values));
  }
}

function environment(
  options: {
    since?: string;
    now?: number;
    prefix?: string;
    labels?: typeof zh;
    observer?: boolean;
    missing?: boolean;
    hidden?: boolean;
  } = {},
) {
  let now = options.now ?? start;
  let sequence = 0;
  const tasks = new Map<number, { due: number; callback: () => void }>();
  const warnings: unknown[][] = [];
  const node = {
    dataset: { since: options.since ?? '2020-01-01', prefix: options.prefix ?? '' },
    hidden: false,
    isConnected: true,
    textContent: 'server text',
  };
  let current: typeof node | null = options.missing ? null : node;
  const doc = Object.assign(new Events(), {
    hidden: options.hidden ?? false,
    querySelector(selector: string) {
      assert.equal(selector, '.site-runtime');
      return current;
    },
  });
  const win = Object.assign(new Events(), {
    setTimeout(callback: () => void, delay: number) {
      assert.equal(delay, 1000);
      const id = ++sequence;
      tasks.set(id, { due: now + delay, callback });
      return id;
    },
    clearTimeout(id: number) {
      tasks.delete(id);
    },
  });
  const observers: Observer[] = [];
  class Observer {
    closed = false;
    target: typeof node | undefined;
    constructor(
      public callback: (entries: { target: typeof node; isIntersecting: boolean }[]) => void,
    ) {
      observers.push(this);
    }
    observe(target: typeof node) {
      this.target = target;
    }
    disconnect() {
      this.closed = true;
    }
  }
  if (options.observer !== false) Object.assign(win, { IntersectionObserver: Observer });
  class Clock extends Date {
    static now() {
      return now;
    }
  }
  function initialize() {
    vm.runInNewContext(
      executable,
      {
        exports: {},
        document: doc,
        window: win,
        Date: Clock,
        console: { warn: (...args: unknown[]) => warnings.push(args) },
        require(name: string) {
          assert.equal(name, './helpers');
          return { client: () => ({ labels: options.labels ?? zh }) };
        },
      },
      { filename: 'runtime.js' },
    );
  }
  function advance(milliseconds: number) {
    const target = now + milliseconds;
    for (;;) {
      const first = [...tasks].sort((a, b) => a[1].due - b[1].due)[0];
      if (!first || first[1].due > target) break;
      now = first[1].due;
      tasks.delete(first[0]);
      first[1].callback();
    }
    now = target;
  }
  function intersect(visible: boolean) {
    for (const observer of observers.filter((o) => !o.closed))
      observer.callback([{ target: observer.target!, isIntersecting: visible }]);
  }
  initialize();
  return {
    doc,
    win,
    node,
    tasks,
    observers,
    warnings,
    initialize,
    advance,
    intersect,
    jump(milliseconds: number) {
      now += milliseconds;
    },
    replaceNode() {
      node.isConnected = false;
      current = { ...node, isConnected: true };
      return current;
    },
    removeNode() {
      if (current) current.isConnected = false;
      current = null;
    },
  };
}

test('date-only input is UTC+8 across host zones; explicit ISO offsets remain effective', () => {
  const previous = process.env.TZ;
  try {
    for (const zone of ['UTC', 'Asia/Shanghai', 'America/Los_Angeles']) {
      process.env.TZ = zone;
      for (const since of ['2020-01-01', '2020-01-01T00:00:00+08:00', '2019-12-31T16:00:00Z'])
        assert.equal(
          environment({ since, now: start + 90061000 }).node.textContent,
          '已运行 1 天 1 小时 1 分 1 秒',
        );
    }
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});

test('missing element and invalid/empty dates register no tasks, listeners or observers', () => {
  for (const options of [
    { missing: true },
    ...['', 'not-a-date', '2020-99-99', '2020-01-01Txx'].map((since) => ({ since })),
  ]) {
    const env = environment(options);
    assert.equal(env.tasks.size, 0);
    assert.equal(env.doc.count('visibilitychange'), 0);
    assert.equal(env.win.count('pageshow'), 0);
    assert.equal(env.observers.length, 0);
    if (!('missing' in options)) assert.equal(env.node.hidden, true);
  }
});

for (const [seconds, expected] of [
  [0, '0 天 0 小时 0 分 0 秒'],
  [59, '0 天 0 小时 0 分 59 秒'],
  [60, '0 天 0 小时 1 分 0 秒'],
  [3599, '0 天 0 小时 59 分 59 秒'],
  [3600, '0 天 1 小时 0 分 0 秒'],
  [86399, '0 天 23 小时 59 分 59 秒'],
  [86400, '1 天 0 小时 0 分 0 秒'],
  [172861, '2 天 0 小时 1 分 1 秒'],
] as const)
  test(`elapsed boundary ${seconds} seconds`, () => {
    assert.equal(
      environment({ now: start + seconds * 1000 + 999 }).node.textContent,
      `已运行 ${expected}`,
    );
  });

test('future start stays zero until elapsed time becomes positive', () => {
  const env = environment({ now: start - 1000 });
  assert.equal(env.node.textContent, '已运行 0 天 0 小时 0 分 0 秒');
  env.advance(1000);
  assert.equal(env.node.textContent, '已运行 0 天 0 小时 0 分 0 秒');
  env.advance(1000);
  assert.equal(env.node.textContent, '已运行 0 天 0 小时 0 分 1 秒');
});

test('Chinese/English formats, custom/empty prefix and repeated tokens are preserved', () => {
  const en = { runtime: 'Online for', runtime_format: '{d} days {h} hours {m} min {s} sec' };
  assert.equal(
    environment({ now: start + 93784000, labels: en }).node.textContent,
    'Online for 1 days 2 hours 3 min 4 sec',
  );
  assert.equal(
    environment({ prefix: '自定义', now: start + 61000 }).node.textContent,
    '自定义 0 天 0 小时 1 分 1 秒',
  );
  assert.equal(
    environment({ labels: { runtime: '', runtime_format: '{s}/{s} {unknown}' }, now: start + 2000 })
      .node.textContent,
    ' 2/2 {unknown}',
  );
});

test('background suspends updates and foreground recomputes actual elapsed time', () => {
  const env = environment();
  env.doc.hidden = true;
  env.doc.emit('visibilitychange');
  assert.equal(env.tasks.size, 0);
  env.advance(90061000);
  assert.equal(env.node.textContent, '已运行 0 天 0 小时 0 分 0 秒');
  env.doc.hidden = false;
  env.doc.emit('visibilitychange');
  assert.equal(env.node.textContent, '已运行 1 天 1 小时 1 分 1 秒');
  assert.equal(env.tasks.size, 1);
});

test('initially hidden document starts no timer until foreground', () => {
  const env = environment({ hidden: true });
  assert.equal(env.tasks.size, 0);
  env.advance(2000);
  env.doc.hidden = false;
  env.doc.emit('visibilitychange');
  assert.equal(env.node.textContent, '已运行 0 天 0 小时 0 分 2 秒');
  assert.equal(env.tasks.size, 1);
});

test('viewport and document visibility both gate scheduling', () => {
  const env = environment();
  env.intersect(false);
  assert.equal(env.tasks.size, 0);
  env.advance(61000);
  env.doc.emit('visibilitychange');
  assert.equal(env.tasks.size, 0);
  env.doc.hidden = true;
  env.intersect(true);
  assert.equal(env.tasks.size, 0);
  env.doc.hidden = false;
  env.doc.emit('visibilitychange');
  assert.equal(env.node.textContent, '已运行 0 天 0 小时 1 分 1 秒');
  assert.equal(env.tasks.size, 1);
});

test('without IntersectionObserver only document visibility pauses the timer', () => {
  const env = environment({ observer: false });
  env.advance(2000);
  assert.equal(env.node.textContent, '已运行 0 天 0 小时 0 分 2 秒');
  env.doc.hidden = true;
  env.doc.emit('visibilitychange');
  assert.equal(env.tasks.size, 0);
  env.advance(60000);
  env.doc.hidden = false;
  env.doc.emit('visibilitychange');
  assert.equal(env.node.textContent, '已运行 0 天 0 小时 1 分 2 秒');
  assert.equal(env.tasks.size, 1);
});

test('timer uses wall time rather than accumulating one-second ticks', () => {
  const env = environment();
  env.jump(90060000);
  env.doc.emit('visibilitychange');
  assert.equal(env.node.textContent, '已运行 1 天 1 小时 1 分 0 秒');
  assert.equal(env.tasks.size, 1);
});

test('repeated initialization and visibility events retain one timer, listener set and observer', () => {
  const env = environment();
  for (let i = 0; i < 6; i++) {
    env.initialize();
    env.intersect(true);
    env.doc.emit('visibilitychange');
    env.win.emit('pageshow');
    assert.equal(env.tasks.size, 1);
    assert.equal(env.doc.count('visibilitychange'), 1);
    assert.equal(env.win.count('pagehide'), 1);
    assert.equal(env.win.count('pageshow'), 1);
    assert.equal(env.observers.filter((o) => !o.closed).length, 1);
  }
  env.advance(1000);
  assert.equal(env.node.textContent, '已运行 0 天 0 小时 0 分 1 秒');
});

test('cached-page hide pauses, restore resumes, normal navigation disposes', () => {
  const env = environment();
  env.win.emit('pagehide', { persisted: true });
  assert.equal(env.tasks.size, 0);
  env.advance(61000);
  env.doc.emit('visibilitychange');
  assert.equal(env.tasks.size, 0);
  env.win.emit('pageshow', { persisted: true });
  assert.equal(env.node.textContent, '已运行 0 天 0 小时 1 分 1 秒');
  assert.equal(env.tasks.size, 1);
  env.win.emit('pagehide', { persisted: false });
  assert.equal(env.tasks.size, 0);
  assert.equal(env.doc.count('visibilitychange'), 0);
  assert.equal(env.win.count('pagehide'), 0);
  assert.equal(env.win.count('pageshow'), 0);
  assert.ok(env.observers.every((o) => o.closed));
  env.win.emit('pageshow');
  assert.equal(env.tasks.size, 0);
});

test('replacement, missing or invalid element releases old state on reinitialization', () => {
  const env = environment();
  const replacement = env.replaceNode();
  env.initialize();
  env.advance(1000);
  assert.equal(replacement.textContent, '已运行 0 天 0 小时 0 分 1 秒');
  assert.equal(env.node.textContent, '已运行 0 天 0 小时 0 分 0 秒');
  replacement.dataset.since = 'invalid';
  env.initialize();
  assert.equal(env.tasks.size, 0);
  assert.equal(env.doc.count('visibilitychange'), 0);
  assert.equal(replacement.hidden, true);
  replacement.dataset.since = '2020-01-01';
  env.initialize();
  assert.equal(replacement.hidden, false);
  assert.equal(env.tasks.size, 1);
  env.removeNode();
  env.initialize();
  assert.equal(env.tasks.size, 0);
  assert.ok(env.observers.every((o) => o.closed));
});

test('detached node stops its controller on the next scheduled update', () => {
  const env = environment();
  env.removeNode();
  env.advance(1000);
  assert.equal(env.tasks.size, 0);
  assert.equal(env.doc.count('visibilitychange'), 0);
  assert.ok(env.observers.every((o) => o.closed));
});

test('prefix attribute remains effective on subsequent updates and falls back when empty', () => {
  const env = environment();
  env.node.dataset.prefix = '新前缀';
  env.advance(1000);
  assert.equal(env.node.textContent, '新前缀 0 天 0 小时 0 分 1 秒');
  env.node.dataset.prefix = '';
  env.advance(1000);
  assert.equal(env.node.textContent, '已运行 0 天 0 小时 0 分 2 秒');
});

test('failed optional initialization releases resources and does not throw into other modules', () => {
  const env = environment({
    labels: { runtime: 'label', runtime_format: null as unknown as string },
  });
  assert.equal(env.warnings.length, 1);
  assert.equal(env.tasks.size, 0);
  assert.equal(env.doc.count('visibilitychange'), 0);
  assert.equal(env.win.count('pageshow'), 0);
  assert.ok(env.observers.every((o) => o.closed));
});
