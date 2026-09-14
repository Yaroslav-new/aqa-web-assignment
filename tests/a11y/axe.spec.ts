/**
 * Accessibility — automated axe-core scans (A11Y-001..004, A11Y-021).
 *
 * Four distinct renderings of the app, each scanned against WCAG 2.1 A/AA:
 * the login form, the form with an error shown, the logged-in view and the
 * open user dropdown. Automated scanning catches roughly a third of real
 * issues — it is the floor of the a11y suite, not the ceiling; the keyboard
 * and screen-reader cases live in `keyboard.spec.ts` and the manual set.
 *
 * Cases that hit a documented defect (BUG-03: .btn-logout contrast; BUG-07:
 * undecorated icons) use `test.fail(true, 'BUG-xx: ...')`, not
 * `test.fixme()`. `test.fixme()` aborts the test body at the point it's
 * called — the login/scan/assert below it never runs, so it proves nothing
 * and never turns red when the bug is fixed. `test.fail()` still runs the
 * test and requires it to fail; the day BUG-03/BUG-07 is fixed, the
 * assertion starts passing, Playwright reports "expected to fail, but
 * passed", and CI forces someone to remove the annotation — that's what
 * makes this a permanent regression guard instead of a silent skip.
 */
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import type { Result } from 'axe-core';
import { test, expect } from '../fixtures/test';
import { admin } from '../fixtures/users';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/**
 * Run the standard scan. Font Awesome's <i> icons are third-party markup
 * (A11Y-021 owns their aria-hidden handling separately), so they are excluded
 * from the generic scans per the plan.
 */
const scan = (page: Page) =>
  new AxeBuilder({ page }).withTags(WCAG_TAGS).exclude('i.fas').analyze();

/**
 * Failure output per the accessibility skill: rule id, impact, helpUrl and the
 * offending element's target + html — actionable without re-running the scan.
 */
function formatViolations(violations: Result[]): string {
  if (violations.length === 0) return '';
  return `Found ${violations.length} accessibility violation(s):\n\n` + violations
    .map((v) => {
      const nodes = v.nodes
        .map((n) => `    ${n.target.join(' ')}\n      ${n.html}`)
        .join('\n');
      return `  [${v.id}] ${v.impact}: ${v.help}\n    ${v.helpUrl}\n${nodes}`;
    })
    .join('\n\n');
}

test.describe('Accessibility · axe scans', () => {
  test('A11Y-001: the logged-out login page has no WCAG A/AA violations', async ({
    loginPage,
    cleanPage,
  }) => {
    await expect(loginPage.section).toBeVisible();

    const results = await scan(cleanPage);

    expect(results.violations, formatViolations(results.violations)).toEqual([]);
  });

  test('A11Y-002: the login page with an error displayed has no violations', async ({
    loginPage,
    cleanPage,
  }) => {
    await loginPage.login(admin.email, 'wrongpass');
    await expect(loginPage.error).toBeVisible();

    const results = await scan(cleanPage);

    expect(results.violations, formatViolations(results.violations)).toEqual([]);
  });

  test('A11Y-003: the logged-in page has no violations', async ({
    loginPage,
    homePage,
    cleanPage,
  }) => {
    test.fail(true, 'BUG-03: .btn-logout fails WCAG 1.4.3 contrast (≈3.96:1)');
    await loginPage.login(admin.email, admin.password);
    await expect(homePage.nav).toBeVisible();

    const results = await scan(cleanPage);

    expect(results.violations, formatViolations(results.violations)).toEqual([]);
  });

  test('A11Y-004: the open user dropdown has no violations', async ({
    loginPage,
    homePage,
    cleanPage,
  }) => {
    test.fail(true, 'BUG-03: .btn-logout fails WCAG 1.4.3 contrast (≈3.96:1)');
    await loginPage.login(admin.email, admin.password);
    await expect(homePage.nav).toBeVisible();

    await homePage.openUserMenu();
    await expect(homePage.signOut).toBeAttached();

    const results = await scan(cleanPage);

    expect(results.violations, formatViolations(results.violations)).toEqual([]);
  });
});

test.describe('Accessibility · decorative icons', () => {
  test('A11Y-021: decorative icons are hidden from assistive tech', async ({
    loginPage,
    homePage,
    cleanPage,
  }) => {
    test.fail(true, 'BUG-07: nav/dropdown icons have no aria-hidden (App.vue:7,11,15,21,24,29)');

    await loginPage.login(admin.email, admin.password);
    await expect(homePage.nav).toBeVisible();

    const icons = cleanPage.locator('header i.fas');
    const count = await icons.count();
    expect(count, 'expected the nav bar to render its Font Awesome icons').toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      await expect(icons.nth(i)).toHaveAttribute('aria-hidden', 'true');
    }
  });
});

test.describe('Accessibility · names and labels', () => {
  test('A11Y-005: both inputs have a programmatic accessible name', async ({ loginPage }) => {
    await expect(loginPage.emailByLabel).toHaveCount(1);
    await expect(loginPage.password).toHaveCount(1);
  });
});

test.describe('Accessibility · screen-reader semantics', () => {
  test('A11Y-008: the error message is announced to screen readers', async ({ loginPage }) => {
    test.fail(true, 'BUG-05: .error-message is a plain div with no role="alert"/aria-live');

    await loginPage.login('nobody@example.com', 'nopass');
    await expect(loginPage.error).toHaveAttribute('role', 'alert');
  });

  test('A11Y-010: the user-icon dropdown trigger is keyboard operable and correctly exposed', async ({
    loginPage,
    homePage,
  }) => {
    test.fail(true, 'BUG-06: .user-section is a bare div with @click only — no role, name or keyboard handler');

    await loginPage.login(admin.email, admin.password);
    await expect(homePage.userIcon).toHaveAttribute('role', 'button');
    await expect(homePage.userIcon).toHaveAttribute('tabindex', '0');
  });
});

test.describe('Accessibility · contrast', () => {
  test('A11Y-011: heading contrast meets AA', async ({ loginPage }) => {
    await expect(loginPage.heading).toHaveCSS('color', 'rgb(255, 255, 255)');
    await expect(loginPage.heading).toHaveCSS('background-color', 'rgb(85, 107, 47)');
  });

  test('A11Y-012: logout button contrast meets AA', async ({ loginPage, homePage }) => {
    test.fail(true, 'BUG-03: white on #d9534f is ≈3.96:1, below the 4.5:1 AA threshold');

    await loginPage.login(admin.email, admin.password);

    const ratio = await homePage.logoutButton.evaluate((el) => {
      const parse = (c: string) => c.match(/\d+/g)!.map(Number);
      const relativeLuminance = ([r, g, b]: number[]) => {
        const [rl, gl, bl] = [r, g, b].map((v) => {
          const s = v / 255;
          return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
      };
      const cs = getComputedStyle(el);
      const l1 = relativeLuminance(parse(cs.color)) + 0.05;
      const l2 = relativeLuminance(parse(cs.backgroundColor)) + 0.05;
      return l1 > l2 ? l1 / l2 : l2 / l1;
    });

    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
});

test.describe('Accessibility · attributes and structure', () => {
  test('A11Y-017: inputs declare their purpose for autofill', async ({ loginPage }) => {
    test.fail(true, 'FINDING-14: neither autocomplete attribute exists');

    await expect(loginPage.email).toHaveAttribute('autocomplete', 'username');
    await expect(loginPage.password).toHaveAttribute('autocomplete', 'current-password');
  });

  test('A11Y-018: the page title describes the page', async ({ cleanPage }) => {
    test.fail(true, 'FINDING-17: index.html title is the generic "Single Page Application"');

    expect(await cleanPage.title()).not.toBe('Single Page Application');
  });

  test('A11Y-019: document structure basics', async ({ loginPage, homePage, cleanPage }) => {
    await expect(cleanPage.locator('html')).toHaveAttribute('lang', 'en');
    await expect(cleanPage.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(cleanPage.locator('main')).toBeVisible();
    await expect(homePage.footer).toBeVisible();

    await loginPage.login(admin.email, admin.password);
    await expect(cleanPage.locator('header')).toBeVisible();
    await expect(homePage.nav).toBeVisible();
  });
});

test.describe('Accessibility · reflow', () => {
  test('A11Y-022: reflow at 320px and at 200% zoom', async ({ loginPage, cleanPage }) => {
    await test.step('320x640 viewport', async () => {
      await cleanPage.setViewportSize({ width: 320, height: 640 });
      await expect(loginPage.email).toBeVisible();
      await expect(loginPage.password).toBeVisible();
      await expect(loginPage.submit).toBeVisible();
      const scrolls = await cleanPage.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(scrolls, 'horizontal scroll appeared at 320px').toBe(false);
    });

    await test.step('200% zoom, approximated as a half-size 1280x720 viewport', async () => {
      await cleanPage.setViewportSize({ width: 640, height: 360 });
      await expect(loginPage.email).toBeVisible();
      await expect(loginPage.password).toBeVisible();
      await expect(loginPage.submit).toBeVisible();
      await loginPage.login(admin.email, admin.password);
      const scrolls = await cleanPage.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(scrolls, 'horizontal scroll appeared at 200% zoom').toBe(false);
    });
  });
});
