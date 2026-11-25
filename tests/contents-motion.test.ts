import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = ts.transpileModule(fs.readFileSync('src/scripts/contents-motion.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;

function fixture({ enabled = true, api = true } = {}) {
  const handlers = new Map<string, (() => void)[]>();
  const on = (name: string, fn: () => void) =>
    handlers.set(name, [...(handlers.get(name) || []), fn]);
  const emit = (name: string) => handlers.get(name)?.forEach((fn) => fn());
  const attrs = new Map<string, string>();
  const link = {
    getAttribute: (key: string) => attrs.get(key) ?? null,
    setAttribute: (key: string, value: string) => attrs.set(key, value),
    removeAttribute: (key: string) => attrs.delete(key),
    set tabIndex(value: number) {
      attrs.set('tabindex', String(value));
    },
  };
  const animations: any[] = [];
  let observer: () => void = () => {};
  let restored = 0;
  const panel = {
    dataset: {} as Record<string, string>,
    style: { opacity: '1', transform: 'none' },
    setAttribute: (key: string, value: string) => attrs.set('panel:' + key, value),
    toggleAttribute: (key: string, value: boolean) =>
      value ? attrs.set('panel:' + key, '') : attrs.delete('panel:' + key),
    querySelectorAll: () => [link],
    addEventListener: on,
    animate: api
      ? (frames: unknown, options: unknown) => {
          let finish!: () => void;
          const animation = {
            frames,
            options,
            canceled: false,
            finished: new Promise<void>((resolve) => {
              finish = resolve;
            }),
            cancel() {
              this.canceled = true;
            },
            finish: () => finish(),
          };
          animations.push(animation);
          return animation;
        }
      : undefined,
  };
  const module = { exports: {} as any };
  vm.runInNewContext(source, {
    exports: module.exports,
    require: () => ({ motionEnabled: () => enabled, reduced: { addEventListener: on } }),
    document: { documentElement: {} },
    MutationObserver: class {
      constructor(fn: () => void) {
        observer = fn;
      }
      observe() {}
    },
    addEventListener: on,
    getComputedStyle: () => ({
      ...panel.style,
      getPropertyValue: (name: string) => (name === '--motion-normal' ? '180ms' : 'ease-out'),
    }),
  });
  const update = module.exports.contentsMotion(panel, () => restored++);
  return {
    panel,
    link,
    attrs,
    animations,
    update,
    emit,
    disable: (kind: 'system' | 'config') => {
      enabled = false;
      kind === 'system' ? emit('change') : observer();
    },
    restored: () => restored,
  };
}

test('initial render is immediate; open and close use only opacity and 4px/180ms motion', async () => {
  const f = fixture();
  f.update(false);
  assert.equal(f.animations.length, 0);
  f.update(true, true);
  assert.deepEqual(JSON.parse(JSON.stringify(f.animations[0].frames)), [
    { opacity: '0', transform: 'translateY(4px)' },
    { opacity: '1', transform: 'none' },
  ]);
  assert.equal(f.animations[0].options.duration, 180);
  f.animations[0].finish();
  await Promise.resolve();
  assert.equal(f.panel.dataset.contentsAnimating, undefined);
  f.update(false, true);
  assert.equal(f.animations[1].frames[1].transform, 'translateY(4px)');
  f.animations[1].finish();
  await Promise.resolve();
  assert.equal(f.panel.dataset.contentsAnimating, undefined);
});

test('reversal continues from current rendering; stale completion cannot finish the new animation', async () => {
  const f = fixture();
  f.update(false);
  f.update(true, true);
  f.panel.style = { opacity: '0.4', transform: 'matrix(1, 0, 0, 1, 0, 2.4)' };
  f.update(false, true);
  assert.equal(f.animations[0].canceled, true);
  assert.equal(f.animations[1].frames[0].opacity, '0.4');
  f.animations[0].finish();
  await Promise.resolve();
  assert.equal(f.panel.dataset.contentsAnimating, '');
  f.animations[1].finish();
  await Promise.resolve();
  assert.equal(f.panel.dataset.contentsAnimating, undefined);
});

test('closing immediately removes interaction/tab stops and restores original tabindex on reopening', () => {
  const f = fixture();
  f.link.setAttribute('tabindex', '2');
  f.update(true);
  f.update(false, true);
  assert.equal(f.attrs.get('panel:aria-hidden'), 'true');
  assert.equal(f.attrs.has('panel:inert'), true);
  assert.equal(f.link.getAttribute('tabindex'), '-1');
  f.emit('focusin');
  assert.equal(f.restored(), 1);
  f.update(true, true);
  assert.equal(f.link.getAttribute('tabindex'), '2');
  assert.equal(f.attrs.has('panel:inert'), false);
});

for (const kind of ['system', 'config'] as const)
  test(`${kind} motion switch finishes in-flight animation immediately`, () => {
    const f = fixture();
    f.update(true);
    f.update(false, true);
    f.disable(kind);
    assert.equal(f.animations[0].canceled, true);
    assert.equal(f.panel.dataset.contentsAnimating, undefined);
    assert.equal(f.attrs.get('panel:aria-hidden'), 'true');
    f.update(true, true);
    assert.equal(f.animations.length, 1);
    assert.equal(f.attrs.get('panel:aria-hidden'), 'false');
  });

test('missing animation API and initial disabled policy keep controls immediately usable', () => {
  for (const options of [{ api: false }, { enabled: false }]) {
    const f = fixture(options);
    f.update(false);
    f.update(true, true);
    assert.equal(f.animations.length, 0);
    assert.equal(f.link.getAttribute('tabindex'), null);
    f.update(false, true);
    assert.equal(f.attrs.get('panel:aria-hidden'), 'true');
  }
});

test('layout settling/pagehide cancel motion without changing the requested state', () => {
  const f = fixture();
  f.update(false);
  f.update(true, true);
  f.update(true, false);
  assert.equal(f.animations[0].canceled, true);
  f.update(false, true);
  f.emit('pagehide');
  assert.equal(f.animations[1].canceled, true);
  assert.equal(f.panel.dataset.contentsAnimating, undefined);
  assert.equal(f.attrs.get('panel:aria-hidden'), 'true');
});
