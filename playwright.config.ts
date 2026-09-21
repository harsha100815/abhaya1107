import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/e2e',
  workers: 1,
  timeout: 60000,
  expect: { timeout: 15000 },
  retries: 0,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['json', { outputFile: '.cache/e2e-results.json' }],
  ],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
        ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
        : {}),
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    },
  },
});
