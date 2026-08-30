/**
 * Clean-state fixtures.
 *
 * Every test starts logged out: the page navigates to the origin, wipes
 * storage and reloads, so no test depends on another's state or on execution
 * order. `localStorage` can only be cleared after a navigation to the origin —
 * clearing before `goto` throws a SecurityError.
 */
import { test as base, type Page } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { HomePage } from '../pages/home.page';

type Fixtures = {
  /** The raw Playwright page, already navigated to `/` with storage wiped. */
  cleanPage: Page;
  loginPage: LoginPage;
  homePage: HomePage;
};

export const test = base.extend<Fixtures>({
  cleanPage: async ({ page }, use) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();
    await use(page);
  },

  loginPage: async ({ cleanPage }, use) => {
    await use(new LoginPage(cleanPage));
  },

  homePage: async ({ cleanPage }, use) => {
    await use(new HomePage(cleanPage));
  },
});

export { expect } from '@playwright/test';
