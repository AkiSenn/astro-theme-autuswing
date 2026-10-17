import { defineConfig } from '@playwright/test';

// All tests own their loopback origin; no Nginx or production configuration.
export default defineConfig({
  testDir: './tests/deployment',
  testMatch: ['pwa-updates.spec.ts', 'pwa-network.spec.ts'],
  timeout: 60000,
  workers: 1,
  outputDir: process.env.PLAYWRIGHT_OUTPUT_DIR || 'test-results/pwa',
  reporter: [
    ['list'],
    ['json', { outputFile: process.env.PLAYWRIGHT_REPORT_FILE || 'test-results/pwa/report.json' }],
  ],
  use: { trace: 'retain-on-failure' },
  projects: [
    { name: 'edge', use: { browserName: 'chromium', channel: 'msedge' } },
    {
      name: 'firefox',
      use: {
        browserName: 'firefox',
        launchOptions: process.env.FIREFOX_EXECUTABLE_PATH
          ? { executablePath: process.env.FIREFOX_EXECUTABLE_PATH }
          : {},
      },
    },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
});
