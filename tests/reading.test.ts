import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = ts.transpileModule(fs.readFileSync('src/scripts/reading.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function fixture({ resize = true, root = 'article', toc = true } = {}) {
  let y = 0,
    measurements = 0,
    queries = 0,
    resizeCallback = () => {};
  const events = new Map<string, ((event?: any) => void)[]>(),
    frames = new Map<number, () => void>(),
    children = new Set<unknown>(),
    observers: ResizeObserver[] = [],
    fontCallbacks: (() => void)[] = [];
  let frameId = 0;
  const on = (name: string, fn: (event?: any) => void) =>
    events.set(name, [...(events.get(name) || []), fn]);
  const off = (name: string, fn: (event?: any) => void) =>
    events.set(
      name,
      (events.get(name) || []).filter((current) => current !== fn),
    );
  class Element {
    constructor(
      public id: string,
      public top = 0,
    ) {}
    matches() {
      return true;
    }
    contains(node: unknown) {
      return this === article && (node === this || children.has(node));
    }
    getBoundingClientRect() {
      measurements++;
      return { top: this.top - y };
    }
  }
  const headings = [
    new Element('first', 1000),
    new Element('second', 3000),
    new Element('中文章', 5000),
  ];
  const links = [
    '#first',
    '#second',
    '#%E4%B8%AD%E6%96%87%E7%AB%A0',
    '#second',
    '#missing',
    '#%zz',
  ].map((hash) => {
    const attrs = new Map<string, string>();
    const link = {
      hash,
      active: false,
      attrs,
      classList: { toggle(_name: string, _active: boolean) {} },
      setAttribute(name: string, value: string) {
        attrs.set(name, value);
      },
      removeAttribute(name: string) {
        attrs.delete(name);
      },
    };
    link.classList.toggle = (_name, active) => {
      link.active = active;
    };
    return link;
  });
  const back = { hidden: true, addEventListener: on, removeEventListener: off },
    contents = { hidden: false };
  const tools = { hidden: false, querySelector: () => contents };
  const article = new Element('article');
  const image = new Element('image'),
    details = new Element('details'),
    outside = new Element('outside');
  [...headings, image, details].forEach((node) => children.add(node));
  const document = {
    documentElement: { scrollHeight: 8000 },
    querySelector(selector: string) {
      queries++;
      return selector === '.back-top'
        ? back
        : selector === '.floating-tools'
          ? tools
          : selector === '.article, .standalone-page' ||
              (selector === '.article' && root === 'article')
            ? article
            : null;
    },
    querySelectorAll() {
      queries++;
      return toc ? links : [];
    },
    getElementById(id: string) {
      queries++;
      return headings.find((h) => h.id === id) || null;
    },
    addEventListener: on,
    removeEventListener: off,
    fonts: {
      ready: { then: (fn: () => void) => fontCallbacks.push(fn) },
      addEventListener: on,
      removeEventListener: off,
    },
  };
  class ResizeObserver {
    connected = false;
    target: unknown;
    disconnects = 0;
    constructor(cb: () => void) {
      resizeCallback = cb;
      observers.push(this);
    }
    observe(target: unknown) {
      this.target = target;
      this.connected = true;
    }
    disconnect() {
      this.connected = false;
      this.disconnects++;
    }
  }
  const exports: any = {};
  const context = {
    exports,
    document,
    Element,
    ResizeObserver,
    window: {
      ...(resize ? { ResizeObserver } : {}),
      addEventListener: on,
      removeEventListener: off,
    },
    innerHeight: 800,
    get scrollY() {
      return y;
    },
    getComputedStyle: (el: unknown) =>
      el === document.documentElement ? { scrollPaddingTop: '90px' } : { scrollMarginTop: '30px' },
    addEventListener: on,
    removeEventListener: off,
    requestAnimationFrame: (fn: () => void) => {
      frames.set(++frameId, fn);
      return frameId;
    },
    cancelAnimationFrame: (id: number) => frames.delete(id),
    scrollTo: () => {},
    require: () => ({ scrollBehavior: () => 'auto' }),
  };
  vm.runInNewContext(source, context);
  let dispose = exports.initReading();
  const flush = () => {
    let count = 0;
    while (frames.size) {
      assert(++count < 20);
      const callbacks = [...frames.values()];
      frames.clear();
      callbacks.forEach((fn) => fn());
    }
  };
  const emit = (name: string, event: object = {}) =>
    [...(events.get(name) || [])].forEach((fn) => fn(event));
  flush();
  return {
    exports,
    headings,
    links,
    document,
    back,
    contents,
    tools,
    flush,
    emit,
    article,
    image,
    details,
    outside,
    observers,
    listenerCount: () => [...events.values()].reduce((sum, listeners) => sum + listeners.length, 0),
    listeners: (name: string) => (events.get(name) || []).length,
    fontReady: () => fontCallbacks.forEach((fn) => fn()),
    reinitialize() {
      dispose = exports.initReading();
    },
    dispose: () => dispose(),
    scroll(value: number) {
      y = value;
      emit('scroll');
    },
    resize: () => resizeCallback(),
    get reads() {
      return measurements;
    },
    get queries() {
      return queries;
    },
    get queued() {
      return frames.size;
    },
    active: () => links.filter((l) => l.active).map((l) => l.hash),
  };
}

test('chapter boundaries include exact positions and handle empty lists', () => {
  const {
    exports: { chapterAt },
  } = fixture();
  assert.equal(chapterAt([], 100), -1);
  assert.equal(chapterAt([100, 300, 500], 99), -1);
  assert.equal(chapterAt([100, 300, 500], 100), 0);
  assert.equal(chapterAt([100, 300, 500], 499), 1);
  assert.equal(chapterAt([100, 300, 500], 900), 2);
});
test('long sections select the reading chapter in both scroll directions without observer entries', () => {
  const f = fixture();
  f.scroll(3500);
  f.flush();
  assert.deepEqual(f.active(), ['#second', '#second']);
  f.scroll(1800);
  f.flush();
  assert.deepEqual(f.active(), ['#first']);
  assert.equal(f.links[0].attrs.get('aria-current'), 'location');
  assert(!f.links[1].attrs.has('aria-current'));
});
test('actual TOC targets are deduplicated, decoded and missing/malformed links ignored', () => {
  const f = fixture();
  assert.equal(f.reads, 3);
  f.scroll(5200);
  f.flush();
  assert.deepEqual(f.active(), ['#%E4%B8%AD%E6%96%87%E7%AB%A0']);
});
test('scroll events share one frame and do not repeat heading measurements or DOM queries', () => {
  const f = fixture(),
    reads = f.reads,
    queries = f.queries;
  for (let i = 0; i < 60; i++) f.scroll(1500 + i);
  assert.equal(f.queued, 1);
  f.flush();
  assert.equal(f.reads, reads);
  assert.equal(f.queries, queries);
});
test('layout changes invalidate cached positions without moving the document', () => {
  const f = fixture();
  f.scroll(3500);
  f.flush();
  f.headings[1].top += 1000;
  f.headings[2].top += 1000;
  const reads = f.reads;
  f.resize();
  f.flush();
  assert.equal(f.reads, reads + 3);
  assert.deepEqual(f.active(), ['#first']);
});
test('pageshow and resize restore the correct selection after positions change', () => {
  const f = fixture();
  f.scroll(3500);
  f.flush();
  f.headings[1].top += 1000;
  f.emit('pageshow');
  f.flush();
  assert.deepEqual(f.active(), ['#first']);
  f.headings[1].top -= 1000;
  f.emit('resize');
  f.flush();
  assert.deepEqual(f.active(), ['#second', '#second']);
});
test('bottom selects a final short section, while the intro clears the selection', () => {
  const f = fixture();
  f.headings[2].top = 7800;
  f.resize();
  f.scroll(7200);
  f.flush();
  assert.equal(f.active()[0], '#%E4%B8%AD%E6%96%87%E7%AB%A0');
  f.scroll(0);
  f.flush();
  assert.deepEqual(f.active(), []);
});
test('no ResizeObserver still supports scroll, hash navigation and explicit resize', () => {
  const f = fixture({ resize: false });
  f.scroll(3500);
  f.emit('hashchange');
  f.flush();
  assert.deepEqual(f.active(), ['#second', '#second']);
  f.headings[1].top += 1000;
  f.emit('resize');
  f.flush();
  assert.deepEqual(f.active(), ['#first']);
});
test('back-to-top threshold and the visible contents opener keep their existing behavior', () => {
  const f = fixture();
  assert.equal(f.tools.hidden, false);
  assert.equal(f.back.hidden, true);
  f.scroll(250);
  f.flush();
  assert.equal(f.back.hidden, false);
  f.contents.hidden = true;
  f.scroll(249);
  f.flush();
  assert.equal(f.back.hidden, true);
  assert.equal(f.tools.hidden, true);
});

test('contents visibility changes reveal the opener before synchronous focus restoration', () => {
  const f = fixture();
  f.contents.hidden = true;
  f.scroll(0);
  f.flush();
  assert.equal(f.tools.hidden, true);
  f.contents.hidden = false;
  f.emit('reading-contents-change');
  assert.equal(f.tools.hidden, false);
});

test('ordinary content root invalidates actual chapter positions through ResizeObserver', () => {
  const f = fixture({ root: 'standalone' });
  f.scroll(3500);
  f.flush();
  f.headings[1].top += 1000;
  f.headings[2].top += 1000;
  f.resize();
  f.flush();
  assert.deepEqual(f.active(), ['#first']);
  assert.equal(f.observers.filter((o) => o.connected).length, 1);
  assert.equal(f.observers[0].target, f.article);
});

test('ordinary content load and toggle fallback update positions but ignore unrelated events', () => {
  const f = fixture({ root: 'standalone', resize: false });
  f.scroll(3500);
  f.flush();
  const reads = f.reads;
  f.emit('load', { target: f.outside });
  f.flush();
  assert.equal(f.reads, reads);
  f.headings[1].top += 1000;
  f.emit('load', { target: f.image });
  f.flush();
  assert.deepEqual(f.active(), ['#first']);
  f.headings[1].top -= 1000;
  f.emit('toggle', { target: f.details });
  f.flush();
  assert.deepEqual(f.active(), ['#second', '#second']);
});

test('layout bursts coalesce and steady scrolling keeps cached measurements', () => {
  const f = fixture({ root: 'standalone' });
  f.scroll(3500);
  f.flush();
  const reads = f.reads,
    queries = f.queries;
  f.headings[1].top += 1000;
  for (let i = 0; i < 20; i++) {
    f.resize();
    f.emit('toggle', { target: f.details });
    f.emit('load', { target: f.image });
  }
  assert.equal(f.queued, 1);
  f.flush();
  assert.equal(f.reads, reads + 3);
  assert.deepEqual(f.active(), ['#first']);
  for (let i = 0; i < 20; i++) {
    f.scroll(3500 + i);
    f.flush();
  }
  assert.equal(f.reads, reads + 3);
  assert.equal(f.queries, queries);
  assert.equal(f.observers.length, 1);
});

test('repeat initialization releases the previous owner and clears stale initial highlights', () => {
  const f = fixture({ root: 'standalone' });
  const listeners = f.listenerCount();
  f.scroll(3500);
  f.flush();
  for (let i = 0; i < 5; i++) {
    f.reinitialize();
    f.flush();
    assert.equal(f.listenerCount(), listeners);
    assert.equal(f.observers.filter((o) => o.connected).length, 1);
    assert.deepEqual(f.active(), ['#second', '#second']);
  }
  f.scroll(0);
  f.reinitialize();
  f.flush();
  assert.deepEqual(f.active(), []);
  assert(f.observers.slice(0, -1).every((o) => o.disconnects === 1));
  f.fontReady();
  assert.equal(f.queued, 1);
  f.flush();
});

test('disposal removes subscriptions and queued work including late font completion', () => {
  const f = fixture({ root: 'standalone' });
  f.scroll(3500);
  const reads = f.reads;
  f.dispose();
  f.dispose();
  assert.equal(f.queued, 0);
  assert.equal(f.listenerCount(), 0);
  assert.equal(f.observers[0].disconnects, 1);
  f.resize();
  f.fontReady();
  f.emit('pageshow');
  f.emit('loadingdone');
  f.flush();
  assert.equal(f.reads, reads);
  assert.equal(f.queued, 0);
});

test('BFCache pagehide retains its owner and final departure releases it', () => {
  const f = fixture({ root: 'standalone' });
  f.scroll(3500);
  f.flush();
  f.emit('pagehide', { persisted: true });
  assert.equal(f.observers.filter((o) => o.connected).length, 1);
  f.headings[1].top += 1000;
  f.emit('pageshow', { persisted: true });
  f.flush();
  assert.deepEqual(f.active(), ['#first']);
  f.emit('pagehide', { persisted: false });
  assert.equal(f.listenerCount(), 0);
  assert.equal(f.observers.filter((o) => o.connected).length, 0);
});

test('TOC disabled creates no content observer and retains the tools behavior', () => {
  const f = fixture({ toc: false });
  assert.equal(f.observers.length, 0);
  assert.equal(f.listeners('load'), 0);
  f.reinitialize();
  f.flush();
  assert.equal(f.listeners('scroll'), 1);
  f.scroll(300);
  f.flush();
  assert.equal(f.back.hidden, false);
});
