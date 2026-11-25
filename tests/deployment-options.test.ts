import assert from 'node:assert/strict';
import test from 'node:test';
import { deploymentUrl, mountPath, resolveDeployment, unmountPath, mountReference } from '../src/lib/deployment.mjs';

const settings = {
  preview: { origin: 'https://preview.example/' },
  production: { origin: 'https://WWW.Example:443', basePath: '/blog' },
};

test('deployment selects preview by default and normalizes only the chosen profile', () => {
  assert.deepEqual(resolveDeployment(settings, undefined), {
    mode: 'preview', origin: 'https://preview.example', basePath: '/',
  });
  assert.deepEqual(resolveDeployment(settings, 'production'), {
    mode: 'production', origin: 'https://www.example', basePath: '/blog/',
  });
  assert.deepEqual(resolveDeployment({}, undefined, 'dev'), {
    mode: 'development', origin: 'http://127.0.0.1:4322', basePath: '/',
  });
  assert.throws(() => resolveDeployment(settings, 'production', 'dev'), /SITE_ENV/);
  assert.throws(() => resolveDeployment(settings, 'development'), /SITE_ENV/);
  assert.throws(() => resolveDeployment(settings, 'prod'), /SITE_ENV/);
  assert.throws(() => resolveDeployment(settings, ''), /SITE_ENV/);
});

test('production never falls back to preview or to an invalid origin', () => {
  assert.throws(() => resolveDeployment({ preview: settings.preview }, 'production'), /production\.origin/);
  for (const origin of [
    'http://www.example', 'https://', 'https://user:secret@www.example',
    'https://www.example/a/..', 'https://www.example/?', 'https://www.example/#',
    'https://localhost', 'https://127.0.0.1', 'https://www.example:99999', 'https://invalid_host.example',
    'https://preview.example',
  ]) {
    assert.throws(() => resolveDeployment({ ...settings, production: { origin } }, 'production'), /production\.origin/);
  }
});

test('invalid mount paths fail explicitly without URL parser normalization', () => {
  for (const basePath of ['', null, 'blog', '//blog', '/blog//a', '/a/../blog', '/blog%2f', '/a?q', '/a#b', '/a\\b']) {
    assert.throws(() => resolveDeployment({ ...settings, preview: { ...settings.preview, basePath } }, 'preview'), /preview\.basePath/);
  }
  assert.equal(resolveDeployment({ preview: { ...settings.preview, basePath: '/test/v2' } }, 'preview').basePath, '/test/v2/');
});

test('public page URLs are derived without changing logical paths or external URLs', () => {
  const production = resolveDeployment(settings, 'production');
  assert.equal(deploymentUrl('/', production), 'https://www.example/blog/');
  assert.equal(deploymentUrl('/post/abc/?q=1#toc', production), 'https://www.example/blog/post/abc/?q=1#toc');
  assert.equal(deploymentUrl('https://elsewhere.example/a', production), 'https://elsewhere.example/a');
});

test('public paths preserve URL boundaries, suffixes and already mounted references', () => {
  const deployment = resolveDeployment(settings, 'production');
  for (const value of ['#intro', '?query=1', './image.png', '../sibling/', 'mailto:me@example.org', 'tel:123', '//cdn.example/img.png', 'https://cdn.example/img.png'])
    assert.equal(mountReference(value, deployment), value);
  assert.equal(mountReference('/blogger/img.png?x=%20#crop', deployment), '/blog/blogger/img.png?x=%20#crop');
  assert.equal(mountReference('https://www.example/?a=1#toc', deployment), 'https://www.example/blog/?a=1#toc');
  assert.equal(mountReference('/blog/img.png?size=1#crop', deployment, 'mounted'), '/blog/img.png?size=1#crop');
  assert.equal(mountReference('/blog/img.png?size=1#crop', deployment), '/blog/blog/img.png?size=1#crop');
  assert.equal(mountReference('https://www.example/blog/p/', deployment, 'mounted'), 'https://www.example/blog/p/');
  assert.equal(mountPath('/blog/', deployment), '/blog/blog/');
  assert.equal(unmountPath('/blog/blog/', deployment), '/blog/');
  assert.equal(unmountPath('/blogger/', deployment), undefined);
});
