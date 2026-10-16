import { defineConfig } from '@playwright/test';
import base from './playwright.config';
const sharedUse = { ...base.use };
delete sharedUse.channel;

// Historic pixel measurements were captured in Windows Edge. The portable
// desktop checks below cover the same layout contract in both other engines.
export default defineConfig({
  ...base,
  use: sharedUse,
  testIgnore: ['**/desktop-reading.spec.ts'],
  projects: [
    { name: 'firefox', use: { browserName: 'firefox', channel: undefined } },
    { name: 'webkit', use: { browserName: 'webkit', channel: undefined } },
  ],
});
