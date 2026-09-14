import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures/test';
import { admin, bianca } from '../fixtures/users';
import { LoginPage } from '../pages/login.page';
import { HomePage } from '../pages/home.page';

const session = (page: Page) => page.evaluate(() => localStorage.getItem('logged'));

const dumpStorage = (page: Page) =>
  page.evaluate(() => ({
    local: Object.fromEntries(Object.entries(localStorage)),
    sessionStore: Object.fromEntries(Object.entries(sessionStorage)),
  }));

test.describe('Session · storage contract', () => {
  test('SESSION-001: a successful login stores the user’s email under `logged`', { tag: ['@critical'] }, async ({
    loginPage,
    cleanPage,
  }) => {
    await loginPage.login(bianca.email, bianca.password);

    await expect.poll(() => session(cleanPage)).toBe(bianca.email);
    expect(await cleanPage.evaluate(() => Object.keys(localStorage))).toEqual(['logged']);
  });

  test('SESSION-002: a failed login writes nothing to storage', { tag: ['@critical'] }, async ({ loginPage, cleanPage }) => {
    await loginPage.login(admin.email, 'wrongpass');

    await expect(loginPage.error).toBeVisible();
    const storage = await dumpStorage(cleanPage);
    expect(storage.local, 'the failure branch must have no side effects').toEqual({});
    expect(storage.sessionStore).toEqual({});
  });

  test('SESSION-003: the password is never persisted anywhere', { tag: ['@critical'] }, async ({ loginPage, cleanPage }) => {
    await loginPage.login(admin.email, admin.password);
    await expect.poll(() => session(cleanPage)).toBe(admin.email);

    const storage = await dumpStorage(cleanPage);
    const cookies = await cleanPage.context().cookies();
    const haystack = JSON.stringify({ ...storage, cookies });

    expect(storage.local).toEqual({ logged: admin.email });
    expect(storage.sessionStore).toEqual({});
    expect(haystack, 'the secret leaked into a client-side store').not.toContain(admin.password);
  });

  test('SESSION-016: only the `logged` key is ever used', { tag: ['@critical'] }, async ({ loginPage, homePage, cleanPage }) => {
    await loginPage.login(admin.email, admin.password);
    expect(await cleanPage.evaluate(() => Object.keys(localStorage))).toEqual(['logged']);

    await homePage.logout();
    expect(await cleanPage.evaluate(() => Object.keys(localStorage))).toEqual([]);

    await loginPage.login(admin.email, 'wrong');
    expect(await cleanPage.evaluate(() => Object.keys(localStorage))).toEqual([]);
  });
});

test.describe('Session · lifecycle', () => {
  test('SESSION-004: the session survives a full page reload', { tag: ['@smoke', '@critical'] }, async ({
    loginPage,
    homePage,
    cleanPage,
  }) => {
    await loginPage.login(admin.email, admin.password);
    await expect(homePage.nav).toBeVisible();

    await cleanPage.reload();

    await expect(homePage.nav).toBeVisible();
    await expect(loginPage.section).toHaveCount(0);
    expect(await session(cleanPage)).toBe(admin.email);
  });

  test('SESSION-005: the red Logout button ends the session', { tag: ['@smoke', '@critical'] }, async ({
    loginPage,
    homePage,
    cleanPage,
  }) => {
    await loginPage.login(admin.email, admin.password);
    await expect(homePage.logoutButton).toBeVisible();

    await homePage.logout();

    await expect(loginPage.section).toBeVisible();
    await expect(homePage.header).toHaveCount(0);
    await expect(homePage.content).toHaveCount(0);
    await expect.poll(() => session(cleanPage)).toBeNull();
  });

  test('SESSION-006: logout via the user-icon dropdown `Sign Out` ends the session', async ({
    loginPage,
    homePage,
    cleanPage,
  }) => {
    test.fail(true, 'BUG-02: .logout stays display:none, so Sign Out is never reachable');

    await loginPage.login(admin.email, admin.password);
    await homePage.openUserMenu();
    await expect(homePage.signOut).toBeVisible();

    await homePage.signOut.click();
    await expect(loginPage.section).toBeVisible();
    expect(await session(cleanPage)).toBeNull();
  });

  test('SESSION-007: after logout, neither reload nor Back restores the session', { tag: ['@critical'] }, async ({
    loginPage,
    homePage,
    cleanPage,
  }) => {
    await loginPage.login(admin.email, admin.password);
    await homePage.logout();
    await expect(loginPage.section).toBeVisible();

    await test.step('reload', async () => {
      await cleanPage.reload();
      await expect(loginPage.section).toBeVisible();
      await expect(homePage.header).toHaveCount(0);
      expect(await session(cleanPage)).toBeNull();
    });

    await test.step('browser Back onto a page that was rendered logged in', async () => {
      await loginPage.login(admin.email, admin.password);
      await expect(homePage.nav).toBeVisible();

      await cleanPage.goto('/?returning=1');
      await homePage.logout();
      await expect(loginPage.section).toBeVisible();

      await cleanPage.goBack();
      await expect(cleanPage).toHaveURL('/');
      await expect(loginPage.section).toBeVisible();
      await expect(homePage.header).toHaveCount(0);
      expect(await session(cleanPage)).toBeNull();
    });
  });

  test('SESSION-008: logout resets the visible form state', async ({ loginPage, homePage }) => {
    await loginPage.login(admin.email, admin.password);
    await homePage.logout();

    await expect(loginPage.section).toBeVisible();
    await expect(loginPage.email).toHaveValue('');
    await expect(loginPage.password).toHaveValue('');
    await expect(loginPage.error).toHaveCount(0);
  });
});

test.describe('Session · storage is trusted without validation', () => {
  test('SESSION-009: a pre-seeded `logged` value grants access without logging in', { tag: ['@critical'] }, async ({
    loginPage,
    homePage,
  }) => {
    await homePage.seedSession(admin.email);

    await expect(homePage.nav).toBeVisible();
    await expect(loginPage.section).toHaveCount(0);
  });

  test('SESSION-010: any non-empty `logged` value is treated as a session', { tag: ['@critical'] }, async ({
    loginPage,
    homePage,
  }) => {
    await homePage.seedSession('not-a-user');

    await expect(homePage.nav).toBeVisible();
    await expect(loginPage.section).toHaveCount(0);
  });

  test('SESSION-011: an empty-string `logged` is treated as logged out', async ({ loginPage, homePage }) => {
    await homePage.seedSession('');

    await expect(loginPage.section).toBeVisible();
    await expect(homePage.nav).toHaveCount(0);
  });

  test('SESSION-012: removing `logged` externally does not log out the open tab until reload', async ({
    loginPage,
    homePage,
    cleanPage,
  }) => {
    await loginPage.login(admin.email, admin.password);
    await expect(homePage.nav).toBeVisible();

    await cleanPage.evaluate(() => localStorage.removeItem('logged'));
    await expect(homePage.nav).toBeVisible();

    await cleanPage.reload();
    await expect(loginPage.section).toBeVisible();
  });
});

test.describe('Session · cross-tab and cross-context isolation', () => {
  test('SESSION-013: logging out in tab A does not update tab B until it reloads', { tag: ['@critical'] }, async ({
    loginPage,
    homePage,
    cleanPage,
  }) => {
    await loginPage.login(admin.email, admin.password);

    const tabB = await cleanPage.context().newPage();
    await tabB.goto('/');
    const homeB = new HomePage(tabB);
    const loginB = new LoginPage(tabB);
    await expect(homeB.nav).toBeVisible();

    await homePage.logout();
    await expect(loginPage.section).toBeVisible();

    await expect(homeB.nav).toBeVisible();
    await tabB.reload();
    await expect(loginB.section).toBeVisible();
    await expect(homeB.nav).toHaveCount(0);

    await tabB.close();
  });

  test('SESSION-014: logging in in tab A does not log in tab B until it reloads', async ({ loginPage, homePage, cleanPage }) => {
    const tabB = await cleanPage.context().newPage();
    await tabB.goto('/');
    const homeB = new HomePage(tabB);
    const loginB = new LoginPage(tabB);
    await expect(loginB.section).toBeVisible();

    await loginPage.login(admin.email, admin.password);
    await expect(homePage.nav).toBeVisible();

    await expect(loginB.section).toBeVisible();
    await tabB.reload();
    await expect(homeB.nav).toBeVisible();

    await tabB.close();
  });

  test('SESSION-015: a fresh browser context starts logged out', async ({ loginPage, cleanPage }) => {
    await loginPage.login(admin.email, admin.password);

    const freshContext = await cleanPage.context().browser()!.newContext();
    const freshPage = await freshContext.newPage();
    await freshPage.goto('/');

    const freshLogin = new LoginPage(freshPage);
    await expect(freshLogin.section).toBeVisible();
    expect(await freshPage.evaluate(() => localStorage.getItem('logged'))).toBeNull();

    await freshContext.close();
  });
});
