import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = ts.transpileModule(fs.readFileSync('src/scripts/reading.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function fixture({ resize = true } = {}) {
  let y = 0,
    measurements = 0,
    queries = 0,
    resizeCallback = () => {};
  const events = new Map<string, (() => void)[]>(),
    frames: (() => void)[] = [];
  const on = (name: string, fn: () => void) => events.set(name, [...(events.get(name) || []), fn]);
  class Element {
    constructor(
      public id: string,
      public top = 0,
    ) {}
    matches() {
      return true;
    }
    contains() {
      return false;
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
  const back = { hidden: true, addEventListener: on },
    contents = { hidden: false };
  const tools = { hidden: false, querySelector: () => contents };
  const article = new Element('article');
  const document = {
    documentElement: { scrollHeight: 8000 },
    querySelector(selector: string) {
      queries++;
      return selector === '.back-top'
        ? back
        : selector === '.floating-tools'
          ? tools
          : selector === '.article'
            ? article
            : null;
    },
    querySelectorAll() {
      queries++;
      return links;
    },
    getElementById(id: string) {
      queries++;
      return headings.find((h) => h.id === id) || null;
    },
    addEventListener: on,
  };
  class ResizeObserver {
    constructor(cb: () => void) {
      resizeCallback = cb;
    }
    observe() {}
  }
  const exports: any = {};
  const context = {
    exports,
    document,
    Element,
    ResizeObserver,
    window: resize ? { ResizeObserver } : {},
    innerHeight: 800,
    get scrollY() {
      return y;
    },
    getComputedStyle: (el: unknown) =>
      el === document.documentElement ? { scrollPaddingTop: '90px' } : { scrollMarginTop: '30px' },
    addEventListener: on,
    requestAnimationFrame: (fn: () => void) => {
      frames.push(fn);
      return frames.length;
    },
    scrollTo: () => {},
    require: () => ({ scrollBehavior: () => 'auto' }),
  };
  vm.runInNewContext(source, context);
  exports.initReading();
  const flush = () => {
    let count = 0;
    while (frames.length) {
      assert(++count < 20);
      frames.splice(0).forEach((fn) => fn());
    }
  };
  const emit = (name: string) => events.get(name)?.forEach((fn) => fn());
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
      return frames.length;
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
