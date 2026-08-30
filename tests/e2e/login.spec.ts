import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures/test';
import { users, admin, growdev, invalidCredentials } from '../fixtures/users';

const ERROR_TEXT = 'Invalid email or password. Please try again.';

/** Read `localStorage.logged` as the browser currently sees it. */
const session = (page: Page) => page.evaluate(() => localStorage.getItem('logged'));

test.describe('Login · data integrity', () => {
  test('LOGIN-DATA-01: the app authenticates against the same list as js/users.js (FINDING-07)', { tag: ['@critical'] }, async ({
    loginPage,
    cleanPage,
  }) => {
    const appUsers = await cleanPage.evaluate(() => {
      // `__vue_app__` is a Vue-internal handle with no public typing.
      const root = document.querySelector('#app') as { __vue_app__?: any } | null;
      return root?.__vue_app__?._instance?.data?.users ?? null;
    });

    expect(appUsers, 'could not read the running app’s user list').not.toBeNull();
    expect(appUsers).toEqual(users);
    await expect(loginPage.section).toBeVisible();
  });
});

test.describe('Login · valid credentials', () => {
  const positiveCases = [
    // LOGIN-001 is the smoke case: if this one fails, nothing else is worth running.
    { id: 'LOGIN-001', user: users[0], tag: ['@smoke', '@critical'] },
    { id: 'LOGIN-002', user: users[1], tag: ['@critical'] },
    { id: 'LOGIN-003', user: users[2], tag: ['@critical'] },
  ];

  for (const { id, user, tag } of positiveCases) {
    test(`${id}: ${user.email} logs in successfully`, { tag }, async ({ loginPage, homePage, cleanPage }) => {
      await loginPage.login(user.email, user.password);

      await expect(loginPage.section).toBeHidden(); // v-if removes the form
      await expect(homePage.nav).toBeVisible();
      // The content section is mounted by v-if but painted nowhere: BUG-01
      // keeps `.content { display: none }`. Presence is what this case owns;
      // visibility is asserted by UI-002, which is expected to fail.
      await expect(homePage.content).toBeAttached();
      await expect.poll(() => session(cleanPage)).toBe(user.email);
    });
  }
});

test.describe('Login · invalid credentials', () => {
  test('LOGIN-010: a valid email with the wrong password is rejected', { tag: ['@critical'] }, async ({
    loginPage,
    homePage,
    cleanPage,
  }) => {
    await loginPage.login(admin.email, 'wrongpass');
    await expect(loginPage.error).toHaveText(ERROR_TEXT);
    await expect(loginPage.section).toBeVisible();
    await expect(homePage.header).toBeHidden();
    expect(await session(cleanPage)).toBeNull();
  });

  test('LOGIN-011: an unknown email paired with a real password is rejected', { tag: ['@critical'] }, async ({
    loginPage,
    homePage,
    cleanPage,
  }) => {
    await loginPage.login('nobody@example.com', admin.password);
    await expect(loginPage.error).toHaveText(ERROR_TEXT);
    await expect(homePage.header).toBeHidden();
    expect(await session(cleanPage)).toBeNull();
  });

  test('LOGIN-015: credentials from two different accounts do not combine', { tag: ['@critical'] }, async ({
    loginPage,
    homePage,
    cleanPage,
  }) => {
    // Email of user 1 with the password of user 3: `find` must test both
    // fields of the *same* record.
    await loginPage.login(admin.email, growdev.password);
    await expect(loginPage.error).toHaveText(ERROR_TEXT);
    await expect(homePage.header).toBeHidden();
    expect(await session(cleanPage)).toBeNull();
  });

  test('LOGIN-016: repeated failed logins leave no session key behind', { tag: ['@critical'] }, async ({
    loginPage,
    homePage,
    cleanPage,
  }) => {
    for (const attempt of invalidCredentials) {
      await test.step(`attempt: ${attempt.why}`, async () => {
        await loginPage.login(attempt.email, attempt.password);
        await expect(loginPage.error).toHaveText(ERROR_TEXT);
        await expect(homePage.header).toBeHidden();
        expect(await session(cleanPage)).toBeNull();
      });
    }
    expect(await cleanPage.evaluate(() => Object.keys(localStorage))).toEqual([]);
  });

  test('LOGIN-022: a failed login keeps the user on the login view', { tag: ['@smoke', '@critical'] }, async ({
    loginPage,
    homePage,
    cleanPage,
  }) => {
    await loginPage.login('nobody@example.com', 'nopass');

    await expect(loginPage.section).toBeVisible();
    await expect(loginPage.email).toBeVisible();
    await expect(loginPage.submit).toBeVisible();
    await expect(homePage.header).toHaveCount(0);
    await expect(homePage.nav).toHaveCount(0);
    await expect(homePage.content).toHaveCount(0);
    expect(await session(cleanPage)).toBeNull();
  });
});

test.describe('Login · input safety', () => {
  test('LOGIN-034: an XSS payload is neither executed nor rendered as HTML', { tag: ['@critical'] }, async ({
    loginPage,
    cleanPage,
  }) => {
    const dialogs: string[] = [];
    cleanPage.on('dialog', async (dialog) => {
      dialogs.push(dialog.message());
      await dialog.dismiss();
    });

    await loginPage.login('<script>alert(1)</script>', '<img src=x onerror=alert(1)>');
    await expect(loginPage.error).toHaveText(ERROR_TEXT);
    expect(dialogs, 'a dialog was raised by the injected payload').toEqual([]);
    await expect(loginPage.injectedNodes).toHaveCount(0);
    expect(await session(cleanPage)).toBeNull();
    await expect(loginPage.email).toHaveValue('<script>alert(1)</script>');
  });
});
