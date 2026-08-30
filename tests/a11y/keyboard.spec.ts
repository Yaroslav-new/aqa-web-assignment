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
});
