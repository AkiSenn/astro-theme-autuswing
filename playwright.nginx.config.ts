import { defineConfig } from '@playwright/test';
import { prepareTestEvidence, protectedReporters } from './scripts/test-evidence.mjs';
const run = prepareTestEvidence();
export default defineConfig({
  testDir: './tests/deployment',
  timeout: 60000,
  workers: 1,
  outputDir: run.output,
  reporter: protectedReporters(run),
  use: {
    baseURL: process.env.NGINX_BASE_URL || 'http://127.0.0.1:8788',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'edge', use: { browserName: 'chromium', channel: 'msedge' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
});
