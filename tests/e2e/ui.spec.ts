import { test, expect } from '../fixtures/test';
import { admin } from '../fixtures/users';

test.describe('UI · logged-in controls', () => {
  test('UI-011: both logout controls are present and reachable when logged in', async ({
    loginPage,
    homePage,
  }) => {
    await loginPage.login(admin.email, admin.password);
    await expect(homePage.nav).toBeVisible();

    // (behaviour: SESSION-005).
    await expect(homePage.logoutButton).toBeVisible();
    await expect(homePage.logoutButton).toBeEnabled();

    // (behaviour: SESSION-006, currently blocked by BUG-02, but the trigger itself must still render).
    await expect(homePage.userIcon).toBeVisible();
  });
});
