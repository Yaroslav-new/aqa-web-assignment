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
  readonly homeLink: Locator;
  readonly productsLink: Locator;
  readonly contactLink: Locator;
  /** Present outside every `v-if`, so valid to query regardless of login state. */
  readonly footer: Locator;
  /** The red button in the nav bar — the primary logout path (SESSION-005). */
  readonly logoutButton: Locator;
  /**
   * The user-circle icon that toggles the Sign Out dropdown. It is a bare
   * <div> with a click handler (BUG-06), so there is no role or name to
   * target — a class selector is the only handle the DOM offers. It also has
   * zero rendered size (BUG-08), so tests that click it must use
   * `{ force: true }` — a real `.click()` will wait up to the test timeout
   * for it to become actionable and never will.
   */
  readonly userIcon: Locator;
  readonly signOut: Locator;

  constructor(readonly page: Page) {
    this.header = page.locator('header');
    this.nav = page.getByRole('navigation');
    this.content = page.locator('section.content');
    this.homeLink = page.getByText('Home', { exact: true });
    this.productsLink = page.getByText('Products', { exact: true });
    this.contactLink = page.getByText('Contact', { exact: true });
    this.footer = page.getByText('Thank you for participating!');
    this.logoutButton = page.getByRole('button', { name: /logout/i });
    this.userIcon = page.locator('.user-section');
    this.signOut = page.locator('.logout');
  }

  async logout(): Promise<void> {
    await this.logoutButton.click();
  }

  /**
   * Open/close the dropdown by dispatching a `click` event directly rather
   * than a real simulated mouse click — see the `userIcon` doc comment.
   * `{ force: true }` still tries to compute real viewport coordinates for a
   * 0x0 element and can throw "Element is outside of the viewport";
   * `dispatchEvent` fires the same event the `@click` handler listens for
   * without depending on the element having a physical hit area at all.
   */
  async openUserMenu(): Promise<void> {
    await this.userIcon.dispatchEvent('click');
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
