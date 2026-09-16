import { test, expect } from '../fixtures/test';
import { admin, UNKNOWN_EMAIL } from '../fixtures/users';

test.describe('UI · logged-out view', () => {
  test('UI-001: the logged-out view shows the login section only', async ({ loginPage, homePage }) => {
    await expect(loginPage.section).toBeVisible();
    await expect(homePage.header).toHaveCount(0);
    await expect(homePage.nav).toHaveCount(0);
    await expect(homePage.content).toHaveCount(0);
    await expect(homePage.footer).toBeVisible();
  });

  test('UI-003: the password input masks its value', async ({ loginPage }) => {
    await loginPage.password.fill('secret');
    await expect(loginPage.password).toHaveAttribute('type', 'password');
  });

  test('UI-004: the email input is type="text", so no native validation runs', async ({ loginPage }) => {
    await expect(loginPage.email).toHaveAttribute('type', 'text');

    await loginPage.login('not-an-email', admin.password);

    await expect(loginPage.error).toBeVisible();
  });

  test('UI-005: the email field is focused on load', async ({ loginPage, cleanPage }) => {
    await expect(loginPage.email).toBeFocused();
    await cleanPage.keyboard.type(admin.email);
    await expect(loginPage.email).toHaveValue(admin.email);
  });

  test('UI-006: field labels and placeholder are correct', async ({ loginPage }) => {
    await expect(loginPage.emailByLabel).toHaveCount(1);
    await expect(loginPage.email).toHaveAttribute('placeholder', 'E-mail address');
    await expect(loginPage.password).toHaveCount(1);
    await expect(loginPage.submit).toHaveAttribute('value', 'LOGIN');
  });

  test('UI-007: heading text renders as specified', async ({ loginPage }) => {
    await expect(loginPage.heading).toHaveText("Automation doesn't stop at testing, it's just a beginning!");
    await expect(loginPage.heading).toHaveCSS('background-color', 'rgb(85, 107, 47)');
  });

  test('UI-013: the login form is fully usable at 320px width', async ({ loginPage, homePage, cleanPage }) => {
    await cleanPage.setViewportSize({ width: 320, height: 640 });

    await expect(loginPage.heading).toBeVisible();
    await expect(loginPage.email).toBeVisible();
    await expect(loginPage.password).toBeVisible();
    await expect(loginPage.submit).toBeVisible();

    const hasHorizontalScroll = await cleanPage.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalScroll, 'the page body scrolled horizontally at 320px').toBe(false);

    await loginPage.login(admin.email, admin.password);
    await expect(homePage.nav).toBeVisible();
  });

  test('UI-015: background images load on both views', async ({ loginPage, homePage, cleanPage }) => {
    const failed: string[] = [];
    cleanPage.on('response', (response) => {
      if (/bg1\.jpg|bg2\.jpg/.test(response.url()) && !response.ok()) {
        failed.push(`${response.url()} -> ${response.status()}`);
      }
    });

    await loginPage.login(admin.email, admin.password);
    await expect(homePage.content).toBeAttached();

    expect(failed, 'a background image failed to load').toEqual([]);
  });

  test('UI-016: no console errors or unhandled rejections during a full login/logout cycle', async ({
    loginPage,
    homePage,
    cleanPage,
  }) => {
    const errors: string[] = [];
    cleanPage.on('pageerror', (e) => errors.push(e.message));
    cleanPage.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await loginPage.login(admin.email, admin.password);
    await expect(homePage.nav).toBeVisible();
    await homePage.logout();
    await loginPage.login(UNKNOWN_EMAIL, 'wrong');
    await expect(loginPage.error).toBeVisible();

    expect(errors).toEqual([]);
  });
});

test.describe('UI · logged-in view', () => {
  test('UI-002: the logged-in view shows nav, content and footer, and no login form', async ({
    loginPage,
    homePage,
    loggedInPage,
  }) => {
    test.fail(true, 'BUG-01: .content is display:none in css/style.css, so it never becomes visible');

    await expect(homePage.nav).toBeVisible();
    await expect(homePage.homeLink).toBeVisible();
    await expect(homePage.productsLink).toBeVisible();
    await expect(homePage.contactLink).toBeVisible();
    await expect(homePage.logoutButton).toBeVisible();
    await expect(loginPage.section).toHaveCount(0);
    await expect(homePage.content).toBeVisible();
  });

  test('UI-008: clicking the user icon opens the dropdown', async ({ homePage, loggedInPage }) => {
    test.fail(true, 'BUG-02: .logout stays display:none — the dropdown mounts but is never visible');

    await homePage.openUserMenu();

    await expect(homePage.signOut).toBeVisible();
  });

  test('UI-009: clicking the user icon again closes the dropdown', async ({ homePage, loggedInPage }) => {
    await homePage.openUserMenu();
    await expect(homePage.signOut).toBeAttached();

    await homePage.openUserMenu();
    await expect(homePage.signOut).toHaveCount(0);
  });

  test('UI-010: clicking outside the dropdown does not close it', async ({ homePage, loggedInPage }) => {
    await homePage.openUserMenu();
    await expect(homePage.signOut).toBeAttached();

    await homePage.homeLink.click();
    await expect(homePage.signOut).toBeAttached();
  });

  /**
   * Both halves of designed case UI-011 ("both logout controls are present
   * and reachable"), split into two tests: the button half passes, the
   * user-icon half hits BUG-08. `test.fail()` requires the *whole* test to
   * fail, so a passing and a failing assertion can't share one test body —
   * splitting is what lets the button half stay a real regression guard
   * instead of being swallowed by the icon half's expected failure.
   */
  test('UI-011a: the Logout button is present, enabled and reachable when logged in', { tag: ['@critical'] }, async ({
    homePage,
    loggedInPage,
  }) => {
    await expect(homePage.logoutButton).toBeVisible();
    await expect(homePage.logoutButton).toBeEnabled();
  });

  test('UI-011b: the user-icon trigger mounts but has no reachable hit area (BUG-08)', async ({ homePage, loggedInPage }) => {
    test.fail(true, 'BUG-08: .user-section has zero rendered size because the Font Awesome kit 403s');

    await expect(homePage.userIcon).toBeAttached();
    await expect(homePage.userIcon).toBeVisible();
  });

  test('UI-012: the footer is present in both states', async ({ loginPage, homePage }) => {
    await expect(homePage.footer).toBeVisible();

    await loginPage.login(admin.email, admin.password);
    await expect(homePage.footer).toBeVisible();
  });
});
