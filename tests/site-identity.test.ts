import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSiteIdentity } from '../src/lib/site-identity.mjs';

const required = {
  title: 'Nova Lab',
  description: 'Technical notes',
  author: 'Alex',
  language: 'en',
  menu: { Home: '/', Notes: { url: '/archives/', icon: 'book', new_tab: true } },
};

test('identity requires one non-empty site author and the other required fields', () => {
  for (const field of Object.keys(required)) {
    assert.throws(() => normalizeSiteIdentity({ ...required, [field]: undefined }),
      new RegExp(`src/config/site.yml: ${field} must`));
  }
  assert.throws(() => normalizeSiteIdentity({ ...required, author: '  ' }), /author must/);
});

test('missing optional identity fields do not create placeholder links or registrations', () => {
  const identity = normalizeSiteIdentity(required);
  assert.equal(identity.profile.avatar, undefined);
  assert.equal(identity.profile.homepage, undefined);
  assert.equal(identity.pwa.short_name, required.title);
  assert.equal(identity.footer.copyright.holder, required.author);
  assert.deepEqual(identity.footer.registrations, []);
  assert.deepEqual(identity.social, []);
  assert.deepEqual(identity.favicon, []);
  assert.deepEqual(identity.menu.Notes, { path: '/archives/', icon: 'book', new_tab: true });
});

test('social links keep explicit order and labels, with no empty or disabled anchors', () => {
  const identity = normalizeSiteIdentity({
    ...required,
    social: [
      { name: 'Lab', url: 'https://lab.example', icon: 'globe', label: 'Visit Lab' },
      { name: 'Email', url: 'mailto:alex@example.com' },
      { name: 'Disabled', url: 'https://disabled.example', enabled: false },
      { name: 'Empty', url: '  ' },
      { name: 'Missing' },
    ],
  });
  assert.deepEqual(identity.social, [
    { name: 'Lab', url: 'https://lab.example', icon: 'globe', label: 'Visit Lab' },
    { name: 'Email', url: 'mailto:alex@example.com', icon: 'Email', label: 'Email' },
  ]);
});

test('invalid or duplicate enabled social links name the exact list item', () => {
  for (const url of ['javascript:alert(1)', '//example.test', 'https://user:pass@example.test', 'not a url']) {
    assert.throws(() => normalizeSiteIdentity({ ...required, social: [{ name: 'Lab', url }] }),
      /social\[0\]\.url/);
  }
  for (const next of [
    { name: 'LAB', url: 'https://other.example' },
    { name: 'Other', url: 'https://lab.example' },
  ]) {
    assert.throws(() => normalizeSiteIdentity({
      ...required, social: [{ name: 'Lab', url: 'https://lab.example' }, next],
    }), /social\[1\] duplicates/);
  }
});

test('avatar paths are public assets or valid external URLs', () => {
  for (const avatar of ['/missing-avatar-example.svg', '/img/%2e%2e/package.json', 'data:image/svg+xml,bad']) {
    assert.throws(() => normalizeSiteIdentity({ ...required, profile: { avatar } }),
      /profile\.avatar/);
  }
  assert.equal(normalizeSiteIdentity({
    ...required, profile: { avatar: 'https://images.example/avatar.svg' },
  }).profile.avatar, 'https://images.example/avatar.svg');
});

test('registration entries, contact types and nested fields validate at their location', () => {
  const identity = normalizeSiteIdentity({
    ...required, footer: { registrations: [{ label: 'Example register' }] },
  });
  assert.equal(identity.footer.registrations[0].url, undefined);
  assert.throws(() => normalizeSiteIdentity({
    ...required, footer: { registrations: [{ label: '', url: 'https://example.test' }] },
  }), /footer\.registrations\[0\]\.label/);
  assert.throws(() => normalizeSiteIdentity({
    ...required, social: [{ name: 'Email', enabled: 'false' }],
  }), /social\[0\]\.enabled must be a boolean/);
  assert.throws(() => normalizeSiteIdentity({ ...required, description: 123 }), /description must/);
});
