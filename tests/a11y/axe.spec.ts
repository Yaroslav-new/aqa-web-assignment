/**
 * Accessibility — automated axe-core scans (A11Y-001..004).
 *
 * Four distinct renderings of the app, each scanned against WCAG 2.1 A/AA:
 * the login form, the form with an error shown, the logged-in view and the
 * open user dropdown. Automated scanning catches roughly a third of real
 * issues — it is the floor of the a11y suite, not the ceiling; the keyboard
 * and screen-reader cases live in `keyboard.spec.ts` and the manual set.
 *
 * Scans that hit a documented defect (BUG-03: .btn-logout contrast) are
 * marked `test.fixme` with the bug id rather than weakened — the assertion
 * states the correct behaviour and must start passing the day the bug is
 * fixed, at which point the fixme is removed.
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

// Untagged by choice: axe scans are regression depth (P1/P2 in the plan) —
// the a11y case on the critical path is A11Y-006 in keyboard.spec.ts.
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
    // The error state is a distinct rendering most scans never reach — and
    // exactly the state a struggling user is stuck in.
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
    // Confirmed at runtime by axe: color-contrast (serious) on .btn-logout —
    // white on #d9534f is ≈3.96:1, below the 4.5:1 AA threshold.
    test.fixme(true, 'BUG-03: .btn-logout fails WCAG 1.4.3 contrast (≈3.96:1)');
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
    // Same color-contrast violation as A11Y-003 — the scan covers the whole
    // page and the Logout button is present in this state too.
    test.fixme(true, 'BUG-03: .btn-logout fails WCAG 1.4.3 contrast (≈3.96:1)');
    await loginPage.login(admin.email, admin.password);
    await expect(homePage.nav).toBeVisible();

    // BUG-02 keeps the dropdown visually hidden, but toggling still mounts it,
    // so axe scans the markup that a fixed build would show.
    await homePage.userIcon.click();
    await expect(homePage.signOut).toBeAttached();

    const results = await scan(cleanPage);

    expect(results.violations, formatViolations(results.violations)).toEqual([]);
  });
});
