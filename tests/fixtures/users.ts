/**
 * Test data — single source of truth.
 *
 * Credentials are re-exported from `js/users.js`; they are never retyped in a
 * spec. See FINDING-07: `src/App.vue` keeps its own hard-coded copy of this
 * list instead of importing it, so the two can silently diverge. LOGIN-DATA-01
 * in `login.spec.ts` asserts they are identical — without it the whole suite
 * could pass against data the application never reads.
 */
import { users } from '../../js/users.js';

/** A credential pair exactly as `js/users.js` stores it. */
export type User = { email: string; password: string };

export { users };

export const admin: User = users[0];
export const bianca: User = users[1];
export const growdev: User = users[2];

/** An email address that does not belong to any account in `users`. */
export const UNKNOWN_EMAIL = 'nobody@example.com';

/** Credential pairs that must never authenticate. */
export type InvalidAttempt = User & { why: string };

export const invalidCredentials: InvalidAttempt[] = [
  { email: admin.email, password: 'wrongpass', why: 'valid email, wrong password' },
  { email: UNKNOWN_EMAIL, password: admin.password, why: 'unknown email, real password' },
  { email: '', password: '', why: 'empty form' },
];
