import { defineConfig } from 'vitest/config';

/**
 * End-to-end suites: long running, measured, and kept out of the fast unit run.
 *   npm run test:e2e:crdt
 */
export default defineConfig({
  test: {
    include: ['packages/**/__e2e__/**/*.spec.ts'],
    environment: 'node',
    testTimeout: 300000,
    hookTimeout: 120000,
  },
});
