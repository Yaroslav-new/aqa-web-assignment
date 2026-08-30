import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for the Vue 3 SPA under test.
 *
 * Only the `chromium` project is enabled for now: it is the single browser
 * binary installed in this environment. Firefox / WebKit / mobile are
 * deliberately deferred — add `npx playwright install firefox webkit` first,
 * then re-enable the corresponding entries in `projects`.
 *
 * `webServer` is what makes the suite runnable from a clean clone. The Vite
 * config sets `server.open: true`, which would launch a browser window on every
 * run, so the command overrides it with `--open=false`.
 */
export default defineConfig({
  // Covers both tests/e2e (functional) and tests/a11y (accessibility).
  // Only *.spec.ts is collected, so pages/, fixtures/ and plans/ are ignored.
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Demo pacing for watching a headed run (`npm run test:e2e:slow`).
    // SLOWMO is unset in normal runs and CI, so this is a no-op there —
    // the "no waits in test code" convention is untouched.
    launchOptions: { slowMo: Number(process.env.SLOWMO) || 0 },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // Deferred until the browser binaries are installed:
    // { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    // { name: 'webkit',  use: { ...devices['Desktop Safari'] } },
    // { name: 'mobile',  use: { ...devices['iPhone 13'] } },
  ],
  webServer: {
    command: 'npm run dev -- --open=false',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
