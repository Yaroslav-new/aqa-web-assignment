/**
 * Accessibility — keyboard operability of the login.
 */
import { test, expect } from '../fixtures/test';
import { admin } from '../fixtures/users';

test.describe('Accessibility · keyboard', () => {
  test('A11Y-006: the login can be completed with the keyboard only', { tag: ['@critical'] }, async ({
    loginPage,
    homePage,
    cleanPage,
  }) => {
    await test.step('type the email', async () => {
      await loginPage.email.focus();
      await expect(loginPage.email).toBeFocused();
      await cleanPage.keyboard.type(admin.email);
      await expect(loginPage.email).toHaveValue(admin.email);
    });

    await test.step('Tab to the password field', async () => {
      await cleanPage.keyboard.press('Tab');
      await expect(loginPage.password).toBeFocused(); 
      await cleanPage.keyboard.type(admin.password);
      await expect(loginPage.password).toHaveValue(admin.password);
    });

    await test.step('Tab reaches the submit button, Enter submits', async () => {
      await cleanPage.keyboard.press('Tab');
      await expect(loginPage.submit).toBeFocused();
      await cleanPage.keyboard.press('Enter');
    });

    await expect(homePage.nav).toBeVisible();
    await expect(loginPage.section).toHaveCount(0);
    await expect.poll(() => cleanPage.evaluate(() => localStorage.getItem('logged'))).toBe(
      admin.email,
    );
  });

  test('A11Y-007: every interactive control shows a visible focus indicator', async ({ loginPage }) => {
    test.fail(true, 'BUG-04: outline:none on .btn-login with no compensating focus style (css/style.css:60)');

    await loginPage.submit.focus();
    await expect(loginPage.submit).not.toHaveCSS('outline-style', 'none');
  });

  test('A11Y-014: tab order is logical', async ({ loginPage, cleanPage }) => {
    await expect(loginPage.email).toBeFocused();

    await cleanPage.keyboard.press('Tab');
    await expect(loginPage.password).toBeFocused();

    await cleanPage.keyboard.press('Tab');
    await expect(loginPage.submit).toBeFocused();
  });

  test('A11Y-015: no keyboard trap in either state', { tag: ['@critical'] }, async ({ loginPage, homePage, cleanPage }) => {
    await test.step('logged out', async () => {
      await expect(loginPage.email).toBeFocused();
      await cleanPage.keyboard.press('Tab');
      await cleanPage.keyboard.press('Tab');
      await expect(loginPage.submit).toBeFocused();

      await cleanPage.keyboard.press('Tab');
      await expect(loginPage.submit).not.toBeFocused();

      await cleanPage.keyboard.press('Shift+Tab');
      await expect(loginPage.submit).toBeFocused();
    });

    await test.step('logged in', async () => {
      await loginPage.login(admin.email, admin.password);
      await expect(homePage.nav).toBeVisible();

      await cleanPage.keyboard.press('Tab');
      await expect(homePage.logoutButton).toBeFocused();
    });
  });
});
