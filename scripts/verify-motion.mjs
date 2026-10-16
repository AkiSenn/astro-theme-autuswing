import fs from 'node:fs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { load } from 'cheerio';

// Run separately from browser suites: every build replaces dist. Never touch
// posts or the original Hexo repository; restore this project's config exactly.
const file = 'src/config/theme.json';
const original = fs.readFileSync(file);
const results = [];
const build = () =>
  execFileSync(process.execPath, ['node_modules/astro/bin/astro.mjs', 'build'], {
    stdio: 'pipe',
    env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1', SITE_ENV: 'preview' },
  });
try {
  for (const motion of [
    { enable: false, page: true },
    { enable: true, page: false },
  ]) {
    const config = JSON.parse(original);
    config.motion = motion;
    fs.writeFileSync(file, JSON.stringify(config, null, 2) + '\n');
    build();
    for (const path of ['index.html', 'post/55b0541c/index.html']) {
      const $ = load(fs.readFileSync('dist/' + path, 'utf8'));
      assert.equal($('html').attr('data-motion'), String(motion.enable));
      assert.equal($('#autuswing-page-motion').length, 0);
      assert.equal($('.avatar-enter,.avatar-shake,.card-lift').length, 0);
      assert.equal(JSON.parse($('#autuswing-config').text()).animations, undefined);
      results.push({ motion, path, passed: true });
    }
  }
} finally {
  fs.writeFileSync(file, original);
  build();
}
assert.deepEqual(fs.readFileSync(file), original);
const restored = load(fs.readFileSync('dist/index.html', 'utf8'));
const config = JSON.parse(original);
assert.equal(
  restored('#autuswing-page-motion').length,
  Number(config.motion.enable && config.motion.page),
);
fs.mkdirSync('docs/evidence/motion-system', { recursive: true });
fs.writeFileSync(
  'docs/evidence/motion-system/configuration.json',
  JSON.stringify({ results, originalRestored: true }, null, 2) + '\n',
);
console.log({ verifiedConfigurations: results.length, originalRestored: true });
