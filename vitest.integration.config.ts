import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['apps/api/tests/**/*.integration.test.ts'],
    fileParallelism: false,
    setupFiles: ['apps/api/tests/setup.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    reporters: ['default', 'json'],
    outputFile: { json: '.cache/integration-results.json' },
  },
});
