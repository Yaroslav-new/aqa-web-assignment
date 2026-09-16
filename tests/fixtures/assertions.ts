/**
 * Assertion helpers shared across spec files.
 *
 * Page objects hold no assertions (see CLAUDE.md) — that rule isn't relaxed
 * here, these functions still live at the spec layer. They're just factored
 * out once instead of being retyped, slightly differently, in every file
 * that needs the same check.
 */
import { expect, type Page } from '@playwright/test';
import type { LoginPage } from '../pages/login.page';
import type { HomePage } from '../pages/home.page';

/** Read `localStorage.logged` as the browser currently sees it. */
export const session = (page: Page): Promise<string | null> =>
  page.evaluate(() => localStorage.getItem('logged'));

/**
 * The state every "session ended / never started" case converges on: back on
 * the login view, no authenticated header rendered, no session key left in
 * storage. Used by the login, session and UI specs instead of retyping the
 * same three checks in each of them.
 */
export async function expectLoggedOut(loginPage: LoginPage, homePage: HomePage, page: Page): Promise<void> {
  await expect(loginPage.section).toBeVisible();
  await expect(homePage.header).toHaveCount(0);
  expect(await session(page)).toBeNull();
}
