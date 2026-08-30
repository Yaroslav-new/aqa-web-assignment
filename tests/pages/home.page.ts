/**
 * Page object for the authenticated view of `src/App.vue`: the nav bar, the
 * content section and both logout affordances.
 * Exposes locators and actions only — assertions belong in the specs.
 */
import type { Locator, Page } from '@playwright/test';

export class HomePage {
  readonly header: Locator;
  readonly nav: Locator;
  readonly content: Locator;
  /** The red button in the nav bar — the primary logout path (SESSION-005). */
  readonly logoutButton: Locator;
  /**
   * The user-circle icon that toggles the Sign Out dropdown. It is a bare
   * <div> with a click handler (BUG-06), so there is no role or name to
   * target — a class selector is the only handle the DOM offers.
   */
  readonly userIcon: Locator;
  readonly signOut: Locator;

  constructor(readonly page: Page) {
    this.header = page.locator('header');
    this.nav = page.getByRole('navigation');
    this.content = page.locator('section.content');
    this.logoutButton = page.getByRole('button', { name: /logout/i });
    this.userIcon = page.locator('.user-section');
    this.signOut = page.locator('.logout');
  }

  async logout(): Promise<void> {
    await this.logoutButton.click();
  }

  /**
   * Seed a session directly in storage and reload so the app picks it up in
   * `mounted()`. Used by the cases that assert what `checkLogged()` trusts
   * (SESSION-009, SESSION-010).
   */
  async seedSession(value: string): Promise<void> {
    await this.page.evaluate((v) => localStorage.setItem('logged', v), value);
    await this.page.reload();
  }
}
