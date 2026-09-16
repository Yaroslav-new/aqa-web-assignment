import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures/test';
import { users, admin, growdev, invalidCredentials, UNKNOWN_EMAIL } from '../fixtures/users';
import { expectLoggedOut, session } from '../fixtures/assertions';
import type { LoginPage } from '../pages/login.page';
import type { HomePage } from '../pages/home.page';

const ERROR_TEXT = 'Invalid email or password. Please try again.';
/** Long enough to prove there is no `maxlength` (App.vue has none), short enough to keep the test fast. */
const LONG_STRING_LENGTH = 1000;

/**
 * The negative-case checks that define "this submission must not
 * authenticate": the shared `expectLoggedOut` state plus the specific error
 * text. Every negative case in this file ends with this, so it lives in one
 * place instead of being retyped in each test.
 */
async function expectRejected(loginPage: LoginPage, homePage: HomePage, cleanPage: Page): Promise<void> {
  await expect(loginPage.error).toHaveText(ERROR_TEXT);
  await expectLoggedOut(loginPage, homePage, cleanPage);
}

test.describe('Login · data integrity', () => {
  test('LOGIN-DATA-01: the app authenticates against the same list as js/users.js (FINDING-07)', { tag: ['@critical'] }, async ({
    loginPage,
    cleanPage,
  }) => {
    const appUsers = await cleanPage.evaluate(() => {
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
    { id: 'LOGIN-001', user: users[0], tag: ['@smoke', '@critical'] },
    { id: 'LOGIN-002', user: users[1], tag: ['@critical'] },
    { id: 'LOGIN-003', user: users[2], tag: ['@critical'] },
  ];

  for (const { id, user, tag } of positiveCases) {
    test(`${id}: ${user.email} logs in successfully`, { tag }, async ({ loginPage, homePage, cleanPage }) => {
      await loginPage.login(user.email, user.password);

      await expect(loginPage.section).toBeHidden();
      await expect(homePage.nav).toBeVisible();
      await expect(homePage.content).toBeAttached();
      await expect.poll(() => session(cleanPage)).toBe(user.email);
    });
  }

  test('LOGIN-004: both fields are cleared after a successful login', async ({ loginPage, homePage }) => {
    await loginPage.login(admin.email, admin.password);
    await homePage.logout();

    await expect(loginPage.email).toHaveValue('');
    await expect(loginPage.password).toHaveValue('');
  });

  test('LOGIN-005: the Enter key submits the form', async ({ loginPage, homePage }) => {
    await loginPage.email.fill(admin.email);
    await loginPage.password.fill(admin.password);
    await loginPage.password.press('Enter');

    await expect(homePage.nav).toBeVisible();
  });

  test('LOGIN-006: submitting does not navigate or put credentials in the URL', async ({ loginPage, homePage, cleanPage }) => {
    await loginPage.email.fill(admin.email);
    await loginPage.password.fill(admin.password);
    await loginPage.password.press('Enter');

    await expect(homePage.nav).toBeVisible();
    await expect(cleanPage).toHaveURL('/');
  });

  /**
   * Dispatches a real `paste` ClipboardEvent (so a `@paste`-specific listener
   * would see one) and then sets the value via the native setter + fires
   * `input` (so `v-model`, which only listens for `input`, picks it up).
   * A genuine OS-level Ctrl+V doesn't reach the input in headless/sandboxed
   * Chromium — confirmed here: `navigator.clipboard.writeText` succeeds, but
   * neither `keyboard.press('Control+V')` nor `document.execCommand('paste')`
   * insert anything, because there's no real platform clipboard behind them.
   */
  async function paste(locator: import('@playwright/test').Locator, text: string): Promise<void> {
    await locator.evaluate((el, value) => {
      const input = el as HTMLInputElement;
      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text/plain', value);
      input.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dataTransfer, bubbles: true, cancelable: true }));
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
      nativeSetter.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }, text);
  }

  test('LOGIN-007: pasted credentials authenticate the same as typed ones', async ({ loginPage, homePage }) => {
    await paste(loginPage.email, admin.email);
    await expect(loginPage.email).toHaveValue(admin.email);

    await paste(loginPage.password, admin.password);
    await loginPage.submit.click();

    await expect(homePage.nav).toBeVisible();
  });

  test('LOGIN-008: login works after a previous failed attempt', async ({ loginPage, homePage }) => {
    await loginPage.login(admin.email, 'wrong');
    await expect(loginPage.error).toBeVisible();

    await loginPage.login(admin.email, admin.password);

    await expect(homePage.nav).toBeVisible();
    await expect(loginPage.error).toHaveCount(0);
  });
});

test.describe('Login · invalid credentials', () => {
  const rejectedCases: { id: string; email: string; password: string; why: string }[] = [
    { id: 'LOGIN-010', email: admin.email, password: 'wrongpass', why: 'a valid email with the wrong password' },
    { id: 'LOGIN-011', email: UNKNOWN_EMAIL, password: admin.password, why: 'an unknown email paired with a real password' },
    { id: 'LOGIN-012', email: '', password: '', why: 'an empty form' },
    { id: 'LOGIN-013', email: admin.email, password: '', why: 'an email with no password' },
    { id: 'LOGIN-014', email: '', password: admin.password, why: 'a password with no email' },
    { id: 'LOGIN-015', email: admin.email, password: growdev.password, why: 'credentials from two different accounts' },
    { id: 'LOGIN-017', email: admin.email.toUpperCase(), password: admin.password, why: 'an uppercase email (match is case sensitive, FINDING-10)' },
    { id: 'LOGIN-018', email: growdev.email, password: growdev.password.toUpperCase(), why: 'an uppercase password' },
    { id: 'LOGIN-019', email: `  ${admin.email}  `, password: admin.password, why: 'a whitespace-padded email (no trimming, FINDING-11)' },
    { id: 'LOGIN-020', email: admin.email, password: `${admin.password} `, why: 'a whitespace-padded password' },
    { id: 'LOGIN-021', email: '   ', password: '   ', why: 'whitespace-only input' },
    { id: 'LOGIN-033', email: "' OR 1=1--", password: "' OR '1'='1", why: 'a SQL-injection-style payload' },
  ];

  for (const { id, email, password, why } of rejectedCases) {
    test(`${id}: ${why} is rejected`, { tag: id === 'LOGIN-010' || id === 'LOGIN-011' || id === 'LOGIN-015' ? ['@critical'] : [] }, async ({
      loginPage,
      homePage,
      cleanPage,
    }) => {
      await loginPage.login(email, password);
      await expectRejected(loginPage, homePage, cleanPage);
    });
  }

  test('LOGIN-016: repeated failed logins leave no session key behind', { tag: ['@critical'] }, async ({
    loginPage,
    homePage,
    cleanPage,
  }) => {
    for (const attempt of invalidCredentials) {
      await test.step(`attempt: ${attempt.why}`, async () => {
        await loginPage.login(attempt.email, attempt.password);
        await expectRejected(loginPage, homePage, cleanPage);
      });
    }
    expect(await cleanPage.evaluate(() => Object.keys(localStorage))).toEqual([]);
  });

  test('LOGIN-022: a failed login keeps the user on the login view', { tag: ['@smoke', '@critical'] }, async ({
    loginPage,
    homePage,
    cleanPage,
  }) => {
    await loginPage.login(UNKNOWN_EMAIL, 'nopass');

    await expectLoggedOut(loginPage, homePage, cleanPage);
    await expect(loginPage.email).toBeVisible();
    await expect(loginPage.submit).toBeVisible();
    await expect(homePage.nav).toHaveCount(0);
    await expect(homePage.content).toHaveCount(0);
  });

  test('LOGIN-035: near-miss credentials are rejected (exact match, not partial)', async ({ loginPage, homePage, cleanPage }) => {
    const nearMisses = [
      { email: 'admin@admin.co', password: admin.password, why: 'truncated email domain' },
      { email: 'admin@admin.comm', password: admin.password, why: 'extended email domain' },
      { email: admin.email, password: '202', why: 'truncated password' },
      { email: admin.email, password: '20200', why: 'extended password' },
    ];

    for (const { email, password, why } of nearMisses) {
      await test.step(why, async () => {
        await loginPage.login(email, password);
        await expectRejected(loginPage, homePage, cleanPage);
      });
    }
  });

  test('LOGIN-036: literal "null"/"undefined" strings are rejected', async ({ loginPage, homePage, cleanPage }) => {
    const errors: string[] = [];
    cleanPage.on('pageerror', (e) => errors.push(e.message));

    for (const value of ['undefined', 'null']) {
      await test.step(`"${value}" / "${value}"`, async () => {
        await loginPage.login(value, value);
        await expectRejected(loginPage, homePage, cleanPage);
      });
    }
    expect(errors).toEqual([]);
  });
});

test.describe('Login · boundary and edge inputs', () => {
  test('LOGIN-030: a 1000+ character email is handled without crashing', async ({ loginPage, homePage, cleanPage }) => {
    const errors: string[] = [];
    cleanPage.on('pageerror', (e) => errors.push(e.message));
    const longEmail = `${'a'.repeat(LONG_STRING_LENGTH)}@example.com`;

    await loginPage.login(longEmail, admin.password);

    await expect(loginPage.email).toHaveValue(longEmail);
    await expectRejected(loginPage, homePage, cleanPage);
    expect(errors).toEqual([]);
  });

  test('LOGIN-031: a 1000+ character password is handled without crashing', async ({ loginPage, homePage, cleanPage }) => {
    const errors: string[] = [];
    cleanPage.on('pageerror', (e) => errors.push(e.message));
    const longPassword = 'a'.repeat(LONG_STRING_LENGTH);

    await loginPage.login(admin.email, longPassword);

    await expectRejected(loginPage, homePage, cleanPage);
    expect(errors).toEqual([]);
  });

  test('LOGIN-032: unicode and emoji input is accepted by the fields and rejected by auth', async ({
    loginPage,
    homePage,
    cleanPage,
  }) => {
    const homoglyphEmail = 'аdmin@admin.com';
    const emojiPassword = '2020🙂';

    await loginPage.login(homoglyphEmail, emojiPassword);

    await expect(loginPage.email).toHaveValue(homoglyphEmail);
    await expect(loginPage.password).toHaveValue(emojiPassword);
    await expectRejected(loginPage, homePage, cleanPage);
  });

  test('LOGIN-037: rapid double submit produces one session and one error at most', { tag: ['@critical'] }, async ({
    loginPage,
    homePage,
    cleanPage,
  }) => {
    await loginPage.email.fill(admin.email);
    await loginPage.password.fill(admin.password);

    await Promise.all([loginPage.submit.click(), loginPage.submit.click().catch(() => {})]);

    await expect(homePage.nav).toBeVisible();
    expect(await session(cleanPage)).toBe(admin.email);
    expect(await cleanPage.evaluate(() => Object.keys(localStorage))).toEqual(['logged']);
  });

  test('LOGIN-038: repeated failed attempts are not throttled (FINDING-01)', async ({ loginPage, cleanPage }) => {
    for (let attempt = 0; attempt < 20; attempt++) {
      await loginPage.login(UNKNOWN_EMAIL, 'wrong');
      await expect(loginPage.error).toHaveText(ERROR_TEXT);
    }
    expect(await session(cleanPage)).toBeNull();
  });
});

test.describe('Login · error handling', () => {
  test('LOGIN-040: the error text is exactly the specified message', async ({ loginPage }) => {
    await loginPage.login(UNKNOWN_EMAIL, 'wrong');
    await expect(loginPage.error).toHaveText(ERROR_TEXT);
  });

  test('LOGIN-041: no error is shown before the first submit', async ({ loginPage }) => {
    await expect(loginPage.error).toHaveCount(0);
    await loginPage.email.fill('something');
    await loginPage.password.fill('something');
    await expect(loginPage.error).toHaveCount(0);
  });

  test('LOGIN-042: typing in the email field clears the error', async ({ loginPage }) => {
    await loginPage.login(UNKNOWN_EMAIL, 'wrong');
    await expect(loginPage.error).toBeVisible();

    await loginPage.email.fill('n');
    await expect(loginPage.error).toHaveCount(0);
  });

  test('LOGIN-043: typing in the password field clears the error', async ({ loginPage }) => {
    await loginPage.login(UNKNOWN_EMAIL, 'wrong');
    await expect(loginPage.error).toBeVisible();

    await loginPage.password.fill('w');
    await expect(loginPage.error).toHaveCount(0);
  });

  test('LOGIN-044: deleting a character also clears the error', async ({ loginPage }) => {
    await loginPage.login(admin.email, 'wrong');
    await expect(loginPage.error).toBeVisible();

    await loginPage.password.press('End');
    await loginPage.password.press('Backspace');
    await expect(loginPage.error).toHaveCount(0);
  });

  test('LOGIN-045: the error persists across a second failing submit', async ({ loginPage }) => {
    await loginPage.login(UNKNOWN_EMAIL, 'wrong');
    await expect(loginPage.error).toHaveText(ERROR_TEXT);

    await loginPage.submit.click();
    await expect(loginPage.error).toHaveCount(1);
    await expect(loginPage.error).toHaveText(ERROR_TEXT);
  });

  test('LOGIN-046: the error message does not disclose which field was wrong', async ({ loginPage }) => {
    await loginPage.login(UNKNOWN_EMAIL, admin.password);
    const unknownEmailMessage = await loginPage.error.textContent();

    await loginPage.login(admin.email, 'wrongpass');
    const wrongPasswordMessage = await loginPage.error.textContent();

    expect(unknownEmailMessage).toBe(wrongPasswordMessage);
  });

  test('LOGIN-047: the error is cleared by a successful login and never appears on the logged-in view', async ({
    loginPage,
    homePage,
  }) => {
    await loginPage.login(UNKNOWN_EMAIL, 'wrong');
    await expect(loginPage.error).toBeVisible();

    await loginPage.login(admin.email, admin.password);
    await expect(homePage.nav).toBeVisible();
    await expect(loginPage.error).toHaveCount(0);

    await homePage.logout();
    await expect(loginPage.error).toHaveCount(0);
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
