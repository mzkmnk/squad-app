import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './specs',
  outputDir: './test-results',
  timeout: 30_000,
  retries: 0,
  workers: 1,
  reporter: 'list',
});
