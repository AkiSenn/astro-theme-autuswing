import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const executable = ts.transpileModule(fs.readFileSync('src/scripts/prefetch.js', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;

function fixture(
  options: {
    enabled?: boolean;
    supported?: boolean;
    missingSupports?: boolean;
    missingScript?: boolean;
    connection?: { saveData?: boolean; effectiveType?: string };
    invalidConfig?: boolean;
    brokenInjection?: boolean;
  } = {},
) {
  const nodes: any[] = [],
    warnings: unknown[] = [],
    forbidden: string[] = [];
  let supportsCalls = 0;
  const sandbox: any = {
    exports: {},
    require(name: string) {
      assert.equal(name, './helpers');
      return {
        client() {
          if (options.invalidConfig) throw new SyntaxError('invalid config');
          return { instantNav: options.enabled ?? true, root: '/' };
        },
      };
    },
    navigator: { connection: options.connection },
    document: {
      querySelector(selector: string) {
        assert.equal(selector, 'script[data-autuswing-prefetch]');
        return nodes.find((node) => 'data-autuswing-prefetch' in node.attributes) || null;
      },
      createElement(tag: string) {
        assert.equal(tag, 'script');
        return {
          type: '',
          textContent: '',
          attributes: {} as Record<string, string>,
          setAttribute(name: string, value: string) {
            this.attributes[name] = value;
          },
        };
      },
      head: {
        appendChild(node: unknown) {
          if (options.brokenInjection) throw Error('injection failed');
          nodes.push(node);
        },
      },
    },
    console: { warn: (...args: unknown[]) => warnings.push(args) },
    fetch: () => forbidden.push('fetch'),
    addEventListener: () => forbidden.push('listener'),
    setTimeout: () => forbidden.push('timer'),
  };
  if (!options.missingScript)
    sandbox.HTMLScriptElement = options.missingSupports
      ? {}
      : {
          supports(type: string) {
            assert.equal(type, 'speculationrules');
            supportsCalls++;
            return options.supported ?? true;
          },
        };
  const context = vm.createContext(sandbox);
  const evaluate = () => vm.runInContext(`(function () {\n${executable}\n})()`, context);
  evaluate();
  return {
    nodes,
    warnings,
    forbidden,
    evaluate,
    init: () => sandbox.exports.initPrefetch(),
    rules: (root: string) => JSON.parse(JSON.stringify(sandbox.exports.createPrefetchRules(root))),
    supportsCalls: () => supportsCalls,
  };
}

test('disabled configuration does not probe or inject', () => {
  const f = fixture({ enabled: false });
  assert.equal(f.nodes.length, 0);
  assert.equal(f.supportsCalls(), 0);
  assert.deepEqual(f.warnings, []);
  assert.deepEqual(f.forbidden, []);
});

test('Save-Data and both 2g network types stop prefetching', () => {
  for (const connection of [
    { saveData: true, effectiveType: '4g' },
    { effectiveType: '2g' },
    { effectiveType: 'slow-2g' },
  ]) {
    const f = fixture({ connection });
    assert.equal(f.nodes.length, 0);
    assert.deepEqual(f.warnings, []);
    assert.deepEqual(f.forbidden, []);
  }
});

test('absent or unclassified network information and 3g/4g retain capability detection', () => {
  for (const connection of [undefined, {}, { effectiveType: '3g' }, { effectiveType: '4g' }]) {
    const f = fixture({ connection });
    assert.equal(f.nodes.length, 1);
    assert.equal(f.supportsCalls(), 1);
    assert.equal(f.nodes[0].type, 'speculationrules');
    assert.deepEqual(f.warnings, []);
  }
});

test('missing constructor, missing support API and unsupported rules degrade without fetch', () => {
  for (const options of [
    { missingScript: true },
    { missingSupports: true },
    { supported: false },
  ]) {
    const f = fixture(options);
    assert.equal(f.nodes.length, 0);
    assert.deepEqual(f.warnings, []);
    assert.deepEqual(f.forbidden, []);
  }
});

test('one rule is retained across repeated initialization and module evaluation', () => {
  const f = fixture();
  const initial = f.nodes[0];
  f.init();
  f.init();
  f.evaluate();
  f.init();
  assert.deepEqual(f.nodes, [initial]);
  assert.deepEqual(f.forbidden, []);
  assert.deepEqual(f.warnings, []);
});

test('generated rules preserve prefetch/moderate, roots and existing link exclusions', () => {
  const f = fixture();
  for (const root of ['/', '/blog/']) {
    const rules = f.rules(root);
    assert.deepEqual(Object.keys(rules), ['prefetch']);
    assert.equal(rules.prefetch.length, 1);
    const rule = rules.prefetch[0];
    assert.equal(rule.source, 'document');
    assert.equal(rule.eagerness, 'moderate');
    const predicates = rule.where.and;
    assert.ok(predicates.some((p: any) => p.href_matches === root + '*'));
    assert.ok(
      predicates.some(
        (p: any) => p.not?.selector_matches === '[download], [target="_blank"], [href*="#"]',
      ),
    );
    const patterns = predicates.find((p: any) => p.not?.or).not.or.map((p: any) => p.href_matches);
    assert.deepEqual(
      patterns.sort(),
      [
        '/*.xml',
        '/*.json',
        '/*.js',
        '/*.css',
        '/*.png',
        '/*.jpg',
        '/*.webp',
        '/*.zip',
        '/*.pdf',
      ].sort(),
    );
  }
  assert.deepEqual(JSON.parse(f.nodes[0].textContent), f.rules('/'));
});

test('configuration or injection failure stays optional and issues no requests', () => {
  for (const options of [{ invalidConfig: true }, { brokenInjection: true }]) {
    const f = fixture(options);
    assert.equal(f.nodes.length, 0);
    assert.equal(f.warnings.length, 1);
    assert.deepEqual(f.forbidden, []);
  }
});
