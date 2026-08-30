/**
 * Vitest configuration — owned by the test framework, kept out of the app's
 * `vite.config.js` (application source is the system under test).
 *
 * Vitest reads this file with priority over `vite.config.js`. The scoping is
 * load-bearing: without the `tests/**` exclusion Vitest collects the
 * Playwright specs and crashes on `test.describe`.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['js/**/*.test.ts', 'src/**/*.test.ts'],
    exclude: ['node_modules/**', 'tests/**'],
  },
});
