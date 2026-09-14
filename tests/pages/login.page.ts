/**
 * Page object for the logged-out login view (`section.login` in `src/App.vue`).
 * Exposes locators and actions only — assertions belong in the specs.
 */
import type { Locator, Page } from '@playwright/test';

export class LoginPage {
  readonly section: Locator;
  readonly heading: Locator;
  readonly email: Locator;
  /** Resolves `#email` by its `<label>` text ("User") rather than by placeholder — used by A11Y-005 to prove the label/for association, independently of the placeholder-based `email` locator used everywhere else. */
  readonly emailByLabel: Locator;
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
    this.heading = page.getByRole('heading', { level: 1 });
    this.email = page.getByPlaceholder('E-mail address');
    this.emailByLabel = page.getByLabel('User');
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
