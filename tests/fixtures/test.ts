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
import { admin } from './users';

type Fixtures = {
  /** The raw Playwright page, already navigated to `/` with storage wiped. */
  cleanPage: Page;
  loginPage: LoginPage;
  homePage: HomePage;
  /**
   * `cleanPage`, already authenticated as `admin`. For cases whose
   * precondition is simply "already logged in" rather than the login flow
   * itself — it replaces the `loginPage.login(admin.email, admin.password)`
   * call and the follow-up "nav is visible" sanity check that used to be
   * retyped at the top of most session/UI/a11y tests. Don't use it in a test
   * that needs to observe the moment of login (attaches a listener first,
   * asserts the exact instant a session key appears, etc.) or that needs the
   * logged-out view before logging in — those still call `loginPage.login`
   * directly.
   */
  loggedInPage: Page;
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

  loggedInPage: async ({ cleanPage, loginPage, homePage }, use) => {
    await loginPage.login(admin.email, admin.password);
    await homePage.nav.waitFor();
    await use(cleanPage);
  },
});

export { expect } from '@playwright/test';
