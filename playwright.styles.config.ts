import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// Baselines are engine-specific. Update deliberately on the documented Windows
// environment; ordinary test runs can never accept a changed screenshot.
export default defineConfig({
  ...base,
  testDir: './tests/styles',
  snapshotPathTemplate: '{testDir}/snapshots/{projectName}/{arg}{ext}',
  outputDir: 'test-results/styles',
  reporter: [
    ['list'],
    ['json', { outputFile: process.env.STYLE_REPORT || 'test-results/styles/report.json' }],
  ],
  updateSnapshots: 'none',
  expect: { timeout: 20000, toHaveScreenshot: { timeout: 20000, animations: 'disabled', caret: 'hide', threshold: 0, maxDiffPixels: 0 } },
  use: {
    ...base.use,
    channel: undefined,
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
    colorScheme: 'dark',
  },
  projects: [
    { name: 'edge-windows', use: { browserName: 'chromium', channel: 'msedge' } },
    { name: 'webkit-windows', use: { browserName: 'webkit', channel: undefined } },
  ],
});
