import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures/test';
import { admin, bianca } from '../fixtures/users';

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
    // The value comes from the matched user record, not from the raw input.
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

    // mounted() -> checkLogged() renders the authenticated view directly.
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
      // Build a real second history entry: log in again at `/`, navigate to a
      // distinct URL (a same-URL goto only *replaces* the current entry), and
      // log out there. Back then returns to the `/` document that was last
      // painted as authenticated — it must not come back that way.
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
});

test.describe('Session · storage is trusted without validation', () => {
  // Both cases document intended behaviour for a client-only demo
  // (FINDING-02 / FINDING-03). The day a real backend arrives they must be
  // rewritten to expect rejection — they are pinned here so that change is
  // deliberate and visible.

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
    // `!!logged` (App.vue:141) never checks the value against `users`.
    await homePage.seedSession('not-a-user');

    await expect(homePage.nav).toBeVisible();
    await expect(loginPage.section).toHaveCount(0);
  });
});
