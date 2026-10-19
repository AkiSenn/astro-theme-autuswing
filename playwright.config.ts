import { defineConfig } from '@playwright/test';
import { prepareTestEvidence, protectedReporters } from './scripts/test-evidence.mjs';
// 配置加载早于 Playwright 清理；此处校验并独占新路径，全局 setup 已经太晚。
const run = prepareTestEvidence();
export default defineConfig({
  testDir: './tests/browser',
  timeout: 30000,
  fullyParallel: false,
  workers: 1,
  outputDir: run.output,
  reporter: protectedReporters(run),
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:4322',
    browserName: 'chromium',
    channel: 'msedge',
    trace: 'retain-on-failure',
    serviceWorkers: 'block',
  },
  webServer: {
    command: 'node scripts/preview.mjs',
    url: 'http://127.0.0.1:4322',
    reuseExistingServer: true,
  },
});
