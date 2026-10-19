import { defineConfig } from '@playwright/test';
import { prepareTestEvidence, protectedReporters } from './scripts/test-evidence.mjs';
const run = prepareTestEvidence();

// All tests own their loopback origin; no Nginx or production configuration.
export default defineConfig({
  testDir: './tests/deployment',
  testMatch: ['pwa-updates.spec.ts', 'pwa-network.spec.ts'],
  timeout: 60000,
  workers: 1,
  outputDir: run.output,
  reporter: protectedReporters(run),
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
