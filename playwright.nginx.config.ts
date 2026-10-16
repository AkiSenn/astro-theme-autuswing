import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/deployment',
  timeout: 60000,
  workers: 1,
  use: {
    baseURL: process.env.NGINX_BASE_URL || 'http://127.0.0.1:8788',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'edge', use: { browserName: 'chromium', channel: 'msedge' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
});
