import { defineConfig } from 'tsup';
export default defineConfig({
  entry: ['src/server.ts', 'src/worker.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  noExternal: [/^@abhaya\//],
  clean: true,
  sourcemap: true,
});
