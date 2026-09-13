/**
 * Page object for the logged-out login view (`section.login` in `src/App.vue`).
 * Exposes locators and actions only — assertions belong in the specs.
 */
import type { Locator, Page } from '@playwright/test';

export class LoginPage {
  readonly section: Locator;
  readonly email: Locator;
  readonly password: Locator;
  readonly submit: Locator;
  readonly error: Locator;
  /**
   * Nodes that would only exist if the entered text had been parsed as HTML
   * instead of escaped — used by the XSS case (LOGIN-034).
   */
  readonly injectedNodes: Locator;

  constructor(readonly page: Page) {
    this.section = page.locator('section.login');
    this.email = page.getByPlaceholder('E-mail address');
    this.password = page.getByLabel('Password');
    this.submit = page.getByRole('button', { name: 'LOGIN' });
    this.error = page.locator('.error-message');
    this.injectedNodes = page.locator('.error-message script, .error-message img[src="x"]');
  }

  /** Fill both fields and submit by clicking the LOGIN button. */
  async login(email: string, password: string): Promise<void> {
    await this.email.fill(email);
    await this.password.fill(password);
    await this.submit.click();
  }
}
