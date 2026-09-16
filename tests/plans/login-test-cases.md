# Login - Test Design

**Feature:** client-side login of the Vue 3 SPA (`src/App.vue`)
**Author:** QA-Analyst · **Date:** 2026-08-28
**Status:** implemented — all 87 `[auto]`/`[both]` cases are automated (89 executable
tests across `tests/e2e/` and `tests/a11y/`, `npm test` green); only the 8 `[manual]`
cases (§12) remain unautomated by design, needing a real screen reader or human
visual judgement. Updated 2026-09-16.

---

## 1. Sources read (expectations derived from code, not assumption)

| File | What it defines |
|---|---|
| `README.md` | The assignment: automated login tests, good coverage, edge cases, documented cases, clean code; optional CI + a11y |
| `README-Vue.md` | Run commands (`npm run dev`, port 5173), the three demo users, feature list |
| `src/App.vue` | The whole UI under test: login form, `logIn/logOut/toggleLogout/clearError/checkLogged`, error message, nav bar, user dropdown |
| `js/users.js` | The three credential pairs (source of truth for test data) |
| `js/index.js` | The original non-Vue implementation - used to infer *intended* behaviour where the Vue port is silent |
| `css/style.css` | Layout, colours, focus handling, responsive behaviour |
| `index.html`, `index-vue.html`, `vite.config.js`, `package.json` | Entry points, dev server on port 5173 with `open: true` |
| `.claude/skills/accessibility/SKILL.md` | WCAG 2.1 AA target and the manual checks axe cannot do |

**Behavioural contract extracted from `src/App.vue`:**

- `logIn()` (L116–127): strict `===` match of **both** `email` and `password` against an inline array (L108–112). On match → `localStorage.setItem('logged', user.email)`, clear both fields, clear error, `checkLogged()`. On no match → `errorMessage = 'Invalid email or password. Please try again.'` and nothing else changes.
- `checkLogged()` (L139–145): `isLoggedIn = !!localStorage.getItem('logged')` - **any non-empty string** counts as a session. Also `console.log` of the logged email (L143).
- `logOut()` (L128–132): `removeItem('logged')`, close dropdown, re-check.
- `clearError()` (L136–138): bound to `@input` on **both** fields (L51, L59).
- `mounted()` (L147–149): session check on load - so a session survives reload.
- Form uses `@submit.prevent` (L39) with `<input type="submit">` (L62) → Enter and click both submit, no navigation.
- Email input is `type="text"` (L46), no `required`, no `maxlength`, no `autocomplete`, has `autofocus`.

## 2. How this design serves the assignment (`README.md`)

| Reviewer expectation | How this design meets it |
|---|---|
| *Automated tests for login - all aspects* | 95 cases spanning positive auth (all 3 accounts), negative auth, submit mechanics, error handling, session/localStorage, UI and a11y. 87 are tagged `[auto]`/`[both]` and are directly implementable in Playwright. |
| *Good test coverage* | Every branch of `logIn`, `logOut`, `toggleLogout`, `clearError`, `checkLogged` has at least one case; both the true and false path of each `v-if`; both logout entry points. Coverage table in §9. |
| *Edge cases* | §5.3 - 1000+ char input, unicode/emoji, whitespace padding, case sensitivity, SQL/XSS payloads, near-miss strings, paste vs typing, rapid double submit, Enter vs click, storage tampering, blocked storage. |
| *Detailed comments and descriptions* | Every case carries preconditions, numbered steps, an exact expected result and a **Why it matters** line, so the spec header comments write themselves. |
| *Clean and maintainable test code* | Stable ids let each `test()` title reference one case (`LOGIN-003: …`); cases are grouped by area so they map 1:1 onto `login.spec.ts` / `session.spec.ts` / the `a11y/` specs; test data is pinned to `js/users.js`, never retyped. |
| *Pipeline (optional)* | Cases state their own preconditions and none depends on another's state, so the suite is order-independent and safe to shard in CI. `[manual]` cases are explicitly excluded from the CI-runnable set (§9). |
| *Accessibility (optional)* | A dedicated §8 with 22 cases: axe scans of all four distinct states, keyboard-only login, focus visibility, error announcement, contrast (computed by hand below), reflow at 320px. |

## 3. Environment

- App: `npm ci && npm run dev` → `http://localhost:5173` (`vite.config.js`). Automation must start its own server; do not assume one is up.
- Browsers: Chromium (primary), Firefox, WebKit. Viewports: 1280×720 desktop, 375×667 mobile, 320×640 for reflow.
- Every case starts from **logged out**: `localStorage.clear()` before navigation.

**Test data - from `js/users.js`, never retyped:**

| # | Email | Password |
|---|---|---|
| 1 | `admin@admin.com` | `2020` |
| 2 | `biancunha@gmail.com` | `123456` |
| 3 | `growdev@growdev.com.br` | `growdev123` |

## 4. Conventions

- **Ids** are stable: `LOGIN-###` (authentication + form behaviour), `SESSION-###` (localStorage/session), `UI-###` (visual/interaction), `A11Y-###` (accessibility).
- **Priority:** `P0` auth bypass / data loss / blocker · `P1` main flow, common negative · `P2` edge, cosmetic.
- **Tag:** `[auto]` automatable · `[manual]` needs a human · `[both]`.
- **(assumption)** - the code does not define this behaviour; the expected result is a documented choice and the assumption is stated in the case. If product disagrees, the case changes, not the code.
- **(expected fail)** - the case documents correct behaviour that the current build does **not** exhibit; it is cross-referenced to a defect in §7. These should be written and left failing (or `test.fixme` with the bug id) rather than weakened to match the bug.

---

## 5. Authentication

### 5.0 Data integrity

### LOGIN-DATA-01 - The app authenticates against the same user list as `js/users.js` [P0] [auto]
Preconditions: app at `/`, `localStorage` empty
Steps:
  1. Read `users` off the live Vue instance (`document.querySelector('#app').__vue_app__._instance.data.users`)
  2. Compare it to the list imported from `js/users.js`
Expected: the two lists are deeply equal
Why it matters: `App.vue` hard-codes its own copy of the three accounts instead of importing `js/users.js` (FINDING-07). Without this case, every other login test could stay green forever using retyped credentials while the app's own copy silently drifts - the suite would be testing data the running app never actually reads.

### 5.1 Positive authentication

### LOGIN-001 - Admin account logs in successfully [P0] [auto]
Preconditions: app at `/`, `localStorage` empty, login form visible
Steps:
  1. Type `admin@admin.com` into `#email`
  2. Type `2020` into `#password`
  3. Click `LOGIN`
Expected: login section is removed from the DOM; the nav bar (`header` → `nav.navigation`) and the content section render; `localStorage.logged === 'admin@admin.com'`
Why it matters: the single most important path in the app - if this breaks, nothing else can be tested.

### LOGIN-002 - Second account (`biancunha@gmail.com`) logs in successfully [P0] [auto]
Preconditions: as LOGIN-001
Steps:
  1. Type `biancunha@gmail.com` into `#email`
  2. Type `123456` into `#password`
  3. Submit
Expected: logged-in view; `localStorage.logged === 'biancunha@gmail.com'`
Why it matters: the match is `Array.find` over three entries - a wrong index or an early `return` would let only the first user in.

### LOGIN-003 - Third account (`growdev@growdev.com.br`) logs in successfully [P0] [auto]
Preconditions: as LOGIN-001
Steps:
  1. Type `growdev@growdev.com.br` into `#email`
  2. Type `growdev123` into `#password`
  3. Submit
Expected: logged-in view; `localStorage.logged === 'growdev@growdev.com.br'`
Why it matters: last element of the array and the only alphanumeric password - covers the tail of the loop and a non-numeric secret.

### LOGIN-004 - Both fields are cleared after a successful login [P2] [auto]
Preconditions: logged out
Steps:
  1. Log in as any valid user
  2. Log out (`.btn-logout`)
Expected: `#email` and `#password` are both empty on the returned login form (`App.vue:120–121` resets them on success)
Why it matters: leftover credentials in the DOM after logout are a shoulder-surfing and shared-machine leak.

### LOGIN-005 - Enter key submits the form [P1] [auto]
Preconditions: logged out
Steps:
  1. Focus `#email`, type `admin@admin.com`
  2. Press `Tab`, type `2020`
  3. Press `Enter`
Expected: user is logged in - identical outcome to clicking `LOGIN`
Why it matters: implicit form submission is how most people finish a login; it is easy to break by replacing the form with div+click handler.

### LOGIN-006 - Submitting does not navigate or put credentials in the URL [P1] [auto]
Preconditions: logged out
Steps:
  1. Enter valid credentials
  2. Press `Enter`
Expected: URL stays `http://localhost:5173/` - no `?email=…&password=…`, no page reload (`@submit.prevent`, `App.vue:39`)
Why it matters: a missing `.prevent` would leak the password into the address bar, browser history and any referrer header.

### LOGIN-007 - Pasted credentials authenticate the same as typed ones [P2] [auto]
Preconditions: logged out; valid credentials on the clipboard
Steps:
  1. Focus `#email`, paste the email
  2. Focus `#password`, paste the password
  3. Submit
Expected: successful login (paste fires `input`, so `v-model` is in sync)
Why it matters: `v-model` bound only to `keyup` - a common refactor mistake - would leave the model empty after a paste, so real users with a password manager could never log in.

### LOGIN-008 - Login works after a previous failed attempt [P1] [auto]
Preconditions: logged out
Steps:
  1. Submit `admin@admin.com` / `wrong`
  2. Observe the error message
  3. Correct the password to `2020`
  4. Submit
Expected: login succeeds; error message is gone; `localStorage.logged` is set
Why it matters: the realistic path is *typo then retry*; the error state must not block a subsequent valid attempt.

### 5.2 Negative authentication

### LOGIN-010 - Valid email with wrong password is rejected [P0] [auto]
Preconditions: logged out
Steps:
  1. Enter `admin@admin.com` / `wrongpass`
  2. Submit
Expected: error `Invalid email or password. Please try again.`; login form still visible; `localStorage.logged` is absent
Why it matters: the primary auth-bypass guard - the `&&` in `App.vue:117` must require both halves.

### LOGIN-011 - Unknown email is rejected [P0] [auto]
Preconditions: logged out
Steps:
  1. Enter `nobody@example.com` / `2020`
  2. Submit
Expected: same generic error; no session key
Why it matters: a real password paired with an unregistered account must not authenticate.

### LOGIN-012 - Empty form submission is rejected [P1] [auto]
Preconditions: logged out, both fields empty
Steps:
  1. Click `LOGIN` without typing anything
Expected: error message shown, no session created, focus/page unchanged
Why it matters: no `required` attribute exists (`App.vue:45–60`), so the empty submit reaches `logIn()` and must be handled there. `''` must never match a user.

### LOGIN-013 - Email only, no password, is rejected [P1] [auto]
Preconditions: logged out
Steps:
  1. Type `admin@admin.com` into `#email`, leave `#password` empty
  2. Submit
Expected: error message, no session
Why it matters: the password half of the condition must be evaluated, not short-circuited away.

### LOGIN-014 - Password only, no email, is rejected [P1] [auto]
Preconditions: logged out
Steps:
  1. Leave `#email` empty, type `2020` into `#password`
  2. Submit
Expected: error message, no session
Why it matters: mirror of LOGIN-013 for the email half.

### LOGIN-015 - Credentials from different accounts do not combine [P0] [auto]
Preconditions: logged out
Steps:
  1. Enter `admin@admin.com` / `growdev123`
  2. Submit
Expected: rejected with the generic error, no session
Why it matters: the classic "match email in one record, password in another" bug - `find` must test both fields of the *same* object.

### LOGIN-016 - Failed login leaves no session key behind (assumption-free auth guard) [P0] [auto]
Preconditions: logged out, `localStorage` empty
Steps:
  1. Submit three different invalid combinations in a row
Expected: after each attempt `localStorage.getItem('logged')` is `null` and `header`/`nav` are absent from the DOM
Why it matters: partial writes on the failure path would grant a session to an unauthenticated visitor - the highest-severity failure this app can have.

### LOGIN-017 - Email match is case sensitive (assumption) [P1] [auto]
Preconditions: logged out
Steps:
  1. Enter `ADMIN@ADMIN.COM` / `2020`
  2. Submit
Expected: rejected
Assumption: the code uses strict `===` (`App.vue:117`) so uppercase fails. Real-world email local parts are case-insensitive in practice, so **this may be a product defect rather than intended behaviour**; the case pins current behaviour and flags it (see FINDING-10). If product decides emails are case-insensitive, this case inverts.
Why it matters: users type their address however their keyboard/autocapitalise leaves it; silently failing an otherwise correct login is a top support-ticket generator on mobile.

### LOGIN-018 - Password match is case sensitive [P1] [auto]
Preconditions: logged out
Steps:
  1. Enter `growdev@growdev.com.br` / `GROWDEV123`
  2. Submit
Expected: rejected
Why it matters: passwords *must* be case sensitive - the inverse of LOGIN-017. Any normalisation applied to email must never be applied to the secret.

### LOGIN-019 - Whitespace-padded email is rejected (assumption) [P1] [auto]
Preconditions: logged out
Steps:
  1. Enter `"  admin@admin.com  "` (leading and trailing spaces) / `2020`
  2. Submit
Expected: rejected - no `.trim()` anywhere in `App.vue`
Assumption: current behaviour is "no trimming". Most login forms trim the identifier; recorded as FINDING-11 (UX), not as a code bug, because the code is unambiguous.
Why it matters: copy-pasting an address from an email client very often carries a trailing space; the user sees a correct address and an "invalid credentials" error, which reads as a broken product.

### LOGIN-020 - Whitespace-padded password is rejected [P2] [auto]
Preconditions: logged out
Steps:
  1. Enter `admin@admin.com` / `"2020 "` (trailing space)
  2. Submit
Expected: rejected
Why it matters: unlike the email, a password must **not** be trimmed - whitespace can be part of a secret. This case guards against a well-meaning `.trim()` being added to both fields at once.

### LOGIN-021 - Whitespace-only input is rejected [P2] [auto]
Preconditions: logged out
Steps:
  1. Enter `"   "` / `"   "`
  2. Submit
Expected: rejected, generic error
Why it matters: distinguishes "empty" from "blank" - a trim-then-check implementation must not treat spaces as a match against anything.

### LOGIN-022 - Failed login keeps the user on the login view [P0] [auto]
Preconditions: logged out
Steps:
  1. Submit invalid credentials
Expected: `section.login` still present; `header`, `nav.navigation` and `section.content` absent from the DOM (`v-if="isLoggedIn"` stays false)
Why it matters: the rendered nav is the only visible signal of an authenticated state - showing it after a failure would be an auth-bypass in appearance, and in this app appearance is the authorisation.

### 5.3 Boundary and edge inputs

### LOGIN-030 - 1000+ character email is handled without crashing [P2] [auto]
Preconditions: logged out
Steps:
  1. Type/fill a 1000-character string into `#email`
  2. Enter `2020` into `#password`, submit
Expected: rejected with the generic error; no layout break; no console exception; field accepts the whole string (no `maxlength` in `App.vue:45–52`)
Why it matters: unbounded input reaching a comparison is where clients usually freeze or overflow their container; also proves no length-based truncation quietly matches a prefix.

### LOGIN-031 - 1000+ character password is handled without crashing [P2] [auto]
Preconditions: logged out
Steps:
  1. Enter `admin@admin.com`, then a 1000-character password
  2. Submit
Expected: rejected, no crash, no visual overflow of the fieldset
Why it matters: same as LOGIN-030 for the masked field, where overflow is harder for a user to notice.

### LOGIN-032 - Unicode and emoji input is accepted by the fields and rejected by auth [P2] [auto]
Preconditions: logged out
Steps:
  1. Enter `admin@admin.com` (with Cyrillic `а` in place of ASCII `a`) / `2020🙂`
  2. Submit
Expected: rejected; the typed characters render correctly in the field; no encoding artefacts, no exception
Why it matters: visually identical homoglyphs must not authenticate, and multi-byte characters must survive `v-model` round-tripping intact.

### LOGIN-033 - SQL-injection-style payload does not authenticate [P1] [auto]
Preconditions: logged out
Steps:
  1. Enter `' OR 1=1--` into `#email` and `' OR '1'='1` into `#password`
  2. Submit
Expected: rejected with the generic error; no session
Why it matters: proves the comparison is a string equality over a fixed list and never string-interpolated into a query - and it stays true if a backend is added later.

### LOGIN-034 - XSS payload is not executed and never rendered as HTML [P0] [auto]
Preconditions: logged out
Steps:
  1. Enter `<script>alert(1)</script>` into `#email` and `<img src=x onerror=alert(1)>` into `#password`
  2. Submit
  3. Inspect the error region and the whole document
Expected: rejected; no dialog appears; no `<script>`/`<img>` node created from the input; the error text remains the fixed literal string (`App.vue:41–43` renders only `errorMessage` via mustache interpolation, which escapes)
Why it matters: the only place user input could reach the DOM is the error region; if a future change echoes the entered email into the message with `v-html`, this case fails immediately.

### LOGIN-035 - Near-miss credentials are rejected (exact match, not partial) [P1] [auto]
Preconditions: logged out
Steps:
  1. Submit `admin@admin.co` / `2020`
  2. Submit `admin@admin.comm` / `2020`
  3. Submit `admin@admin.com` / `202`
  4. Submit `admin@admin.com` / `20200`
Expected: all four rejected
Why it matters: guards against `includes()`/`startsWith()` creeping in where `===` is required - a substring match on the password would collapse the keyspace.

### LOGIN-036 - Literal `"null"` / `"undefined"` strings are rejected [P2] [auto]
Preconditions: logged out
Steps:
  1. Submit `undefined` / `undefined`, then `null` / `null`
Expected: both rejected, no console exception
Why it matters: cheap guard against a coercion bug where an unset model value stringifies and accidentally equals a stored value.

### LOGIN-037 - Rapid double submit produces one session and one error at most [P2] [auto]
Preconditions: logged out
Steps:
  1. Enter valid credentials
  2. Click `LOGIN` twice in immediate succession
Expected: exactly one login; the second click lands on a view where the form no longer exists; no duplicate keys in `localStorage`; no console error
Why it matters: the button is never disabled during submit (`App.vue:62`) - double-click is the normal impatient-user behaviour and must not produce a broken intermediate state.

### LOGIN-038 - Repeated failed attempts are not throttled (documented, not a failure) [P2] [auto]
Preconditions: logged out
Steps:
  1. Submit wrong credentials 20 times in a row
Expected: each attempt shows the same error; the app stays responsive; no lockout, no delay
Assumption: no rate limiting exists by design in a client-only demo (FINDING-01). The case pins the behaviour so that adding throttling later is a deliberate, visible change.
Why it matters: documents a known security limitation as a test rather than leaving it implicit, and proves 20 rapid renders don't degrade the app.

### LOGIN-039 - Browser autofill populates the model correctly [P2] [manual]
Preconditions: credentials saved in the browser's password manager for `localhost:5173`
Steps:
  1. Open `/`, accept the browser's autofill suggestion
  2. Submit
Expected: login succeeds
Why it matters: autofill does not always dispatch the events a framework listens to; combined with the missing `autocomplete` attributes (A11Y-020 / FINDING-14), this is the most likely real-world break that no unit test would catch. Manual because password-manager UI is outside the automation boundary.

### 5.4 Error handling

### LOGIN-040 - Error text is exactly the specified message [P1] [auto]
Preconditions: logged out
Steps:
  1. Submit invalid credentials
Expected: `.error-message` contains exactly `Invalid email or password. Please try again.` (`App.vue:125`)
Why it matters: the wording is the contract with the user; asserting the literal catches accidental edits and untranslated strings.

### LOGIN-041 - No error is shown before the first submit [P1] [auto]
Preconditions: fresh load, logged out
Steps:
  1. Observe the form
  2. Type into both fields without submitting
Expected: `.error-message` is not in the DOM at any point (`v-if="errorMessage"`, `App.vue:41`)
Why it matters: an error greeting a user who has done nothing wrong destroys trust in every later error.

### LOGIN-042 - Typing in the email field clears the error [P1] [auto]
Preconditions: an error is displayed after a failed submit
Steps:
  1. Type one character into `#email`
Expected: `.error-message` is removed from the DOM immediately (`@input="clearError"`, `App.vue:51`)
Why it matters: a stale error next to freshly corrected input tells the user their new attempt already failed.

### LOGIN-043 - Typing in the password field clears the error [P1] [auto]
Preconditions: an error is displayed after a failed submit
Steps:
  1. Type one character into `#password`
Expected: `.error-message` is removed from the DOM
Why it matters: `clearError` is wired to both fields (`App.vue:59`) - users usually retype the password, not the email.

### LOGIN-044 - Deleting a character also clears the error [P2] [auto]
Preconditions: an error is displayed, `#password` non-empty
Steps:
  1. Press `Backspace` in `#password` until it is empty
Expected: error is cleared on the first keystroke
Why it matters: `input` fires on deletion too; a `keypress`-based implementation would miss it.

### LOGIN-045 - Error persists across a second failing submit [P2] [auto]
Preconditions: logged out
Steps:
  1. Submit invalid credentials
  2. Without touching the fields, click `LOGIN` again
Expected: exactly one `.error-message` element is present, with the same text - it does not disappear, duplicate, or stack
Why it matters: re-submitting identical input is common; the feedback must stay stable rather than flicker or accumulate.

### LOGIN-046 - Error message does not disclose which field was wrong [P1] [auto]
Preconditions: logged out
Steps:
  1. Submit an unknown email with any password; record the message
  2. Submit a known email with a wrong password; record the message
Expected: byte-identical messages in both cases
Why it matters: a differentiated message ("no such user" vs "wrong password") turns the login form into an account-enumeration oracle.

### LOGIN-047 - Error is cleared by a successful login and never appears on the logged-in view [P2] [auto]
Preconditions: logged out
Steps:
  1. Submit invalid credentials (error appears)
  2. Correct them and submit successfully
  3. Log out
Expected: no `.error-message` on the logged-in view; and none on the login form after logout (`errorMessage` reset at `App.vue:122`)
Why it matters: state left over from a previous session is the classic SPA leak - the returning user must get a clean form.

### LOGIN-048 - Error appearing does not push the form out of view [P2] [manual]
Preconditions: logged out, 375×667 viewport
Steps:
  1. Submit invalid credentials
  2. Observe the fieldset
Expected: the error appears above the `User` label inside the fieldset; both inputs and the `LOGIN` button remain visible without scrolling
Why it matters: an error the user must scroll to reach, or one that pushes the button off-screen, blocks recovery on the smallest devices.

---

## 6. Session and localStorage

### SESSION-001 - Successful login stores the user's email under `logged` [P0] [auto]
Preconditions: `localStorage` empty
Steps:
  1. Log in as `biancunha@gmail.com`
  2. Read `localStorage.getItem('logged')`
Expected: exactly `biancunha@gmail.com` - the value from the user record, not the raw input (`App.vue:119`)
Why it matters: the key is the entire session; the stored value is what a later "who am I" feature would read.

### SESSION-002 - Failed login writes nothing to storage [P0] [auto]
Preconditions: `localStorage` empty
Steps:
  1. Submit invalid credentials
  2. Enumerate all `localStorage` keys
Expected: storage is still completely empty - no `logged`, no partial or draft key
Why it matters: the failure branch (`App.vue:124–126`) must have no side effects at all; anything written there is a potential bypass.

### SESSION-003 - Password is never persisted anywhere [P0] [auto]
Preconditions: logged out
Steps:
  1. Log in as any user
  2. Dump every key/value in `localStorage` and `sessionStorage`, and all cookies
Expected: the only entry is `logged` → the email; the password string appears nowhere
Why it matters: a secret written to storage survives the tab, is readable by any script on the origin, and would be the most serious defect this app could have.

### SESSION-004 - Session survives a full page reload [P0] [auto]
Preconditions: logged in
Steps:
  1. Reload the page (F5)
Expected: the logged-in view renders directly; the login form is never shown; `logged` is unchanged (`mounted()` → `checkLogged()`, `App.vue:147–149`)
Why it matters: this is the entire point of persisting the session; a regression here logs everyone out on every refresh.

### SESSION-005 - Logout via the red `Logout` button ends the session [P0] [auto]
Preconditions: logged in
Steps:
  1. Click `button.btn-logout`
Expected: `logged` removed from `localStorage`; login form visible; nav and content gone (`App.vue:28`, `128–132`)
Why it matters: on a shared machine, an ineffective logout is a direct account handover.

### SESSION-006 - Logout via the user-icon dropdown `Sign Out` ends the session [P1] [auto]
Preconditions: logged in
Steps:
  1. Click the user icon (`.user-section`) to open the dropdown
  2. Click `Sign Out`
Expected: session removed, login form shown, dropdown closed (`showLogoutMenu` reset at `App.vue:130`)
Why it matters: two independent logout paths exist and only one is commonly tested; `@click.stop` (`App.vue:22`) must let the sign-out through while suppressing the parent toggle. **Blocked by BUG-02** - the dropdown is present in the DOM but invisible, so a real user cannot reach this control.

### SESSION-007 - After logout, reload does not restore the session [P0] [auto]
Preconditions: logged in
Steps:
  1. Log out
  2. Reload the page
  3. Navigate back with the browser Back button
Expected: login form each time; `logged` stays absent
Why it matters: a session restored from cache or history after an explicit logout defeats the logout entirely.

### SESSION-008 - Logout resets the visible form state [P1] [auto]
Preconditions: logged out
Steps:
  1. Log in as `admin@admin.com`
  2. Log out
Expected: form visible with both fields empty, no error message, focus/layout as on first load
Why it matters: the next person at the machine must not see any trace of the previous user.

### SESSION-009 - A pre-seeded `logged` value grants access without logging in [P0] [auto]
Preconditions: browser at the origin, app not yet loaded
Steps:
  1. Set `localStorage.logged = 'admin@admin.com'` before navigation
  2. Open `/`
Expected: the logged-in view renders; the login form is never shown
Assumption: this is *intended* behaviour for a client-only demo - `checkLogged` trusts storage (`App.vue:139–145`). The case pins it deliberately so the day a real backend arrives, this test flips to "must be rejected". See FINDING-02.
Why it matters: it documents in an executable way that the client is the only authority here; it also gives the automation a fast login shortcut for non-auth tests.

### SESSION-010 - Any non-empty `logged` value is treated as a session (assumption) [P0] [auto]
Preconditions: app not loaded
Steps:
  1. Set `localStorage.logged = 'not-a-user'`
  2. Open `/`
Expected: logged-in view renders - `!!logged` (`App.vue:141`) does not validate the value against `users`
Assumption: the code makes no claim about validating the stored value; the current behaviour is "any truthy string works". Recorded as FINDING-03 because an arbitrary or attacker-chosen value becomes the identity the app prints (`App.vue:143`).
Why it matters: makes an invisible weakness visible and regression-locked; if validation is added, this case is the one that must change.

### SESSION-011 - Empty-string `logged` is treated as logged out [P1] [auto]
Preconditions: app not loaded
Steps:
  1. Set `localStorage.logged = ''`
  2. Open `/`
Expected: login form is shown (`!!''` is false)
Why it matters: the boundary of the `!!` coercion - the one falsy string that must not create a phantom session.

### SESSION-012 - Removing `logged` externally does not log out the open tab until reload (assumption) [P1] [auto]
Preconditions: logged in, tab open
Steps:
  1. From the console/another context, `localStorage.removeItem('logged')`
  2. Observe the open tab
  3. Reload
Expected: the tab still shows the logged-in view (no `storage` listener exists in `App.vue`); after reload the login form is shown
Assumption: cross-context synchronisation is undefined in the code. Behaviour is pinned as-is and reported as FINDING-04.
Why it matters: users do log out in one place and expect it everywhere; the gap is worth knowing before someone reports it as a security issue.

### SESSION-013 - Two tabs: logging out in tab A does not update tab B until it reloads [P1] [both]
Preconditions: logged in, same origin open in two tabs
Steps:
  1. In tab A click `Logout`
  2. Switch to tab B without reloading
  3. Reload tab B
Expected: tab B still shows the logged-in view in step 2; shows the login form after step 3
Why it matters: the practical form of SESSION-012 - the stale tab still exposes the content area to whoever sits down next.

### SESSION-014 - Two tabs: logging in in tab A does not log in tab B until it reloads [P2] [both]
Preconditions: both tabs logged out
Steps:
  1. Log in in tab A
  2. Observe tab B, then reload it
Expected: tab B shows the form until reloaded, then the logged-in view
Why it matters: the symmetric case; confirms the desync is a missing listener, not a one-directional bug.

### SESSION-015 - A fresh browser context starts logged out [P1] [auto]
Preconditions: a previous context logged in
Steps:
  1. Open the app in a new incognito/isolated browser context
Expected: login form; `logged` absent
Why it matters: proves the session is per-origin-per-profile and gives the automation its isolation guarantee - every spec can rely on a clean slate.

### SESSION-016 - Only the `logged` key is used [P2] [auto]
Preconditions: `localStorage` empty
Steps:
  1. Complete a login, a failed login and a logout
  2. Enumerate storage keys after each
Expected: at most one key, `logged`; nothing else is created or orphaned
Why it matters: stray keys accumulate across releases and quietly become undocumented state that breaks upgrades.

### SESSION-017 - Behaviour when `localStorage` is unavailable (assumption) [P2] [manual]
Preconditions: browser configured to block site data for the origin
Steps:
  1. Open `/`
  2. Submit valid credentials
Expected (assumed): `setItem` throws, the exception is unhandled, and the form appears to do nothing - no error message, no login
Assumption: the code never guards storage access (`App.vue:119`, `129`, `140`); the failure mode is inferred, not specified. Recorded as FINDING-05.
Why it matters: for users with hardened privacy settings the product is silently broken with zero feedback, which is indistinguishable from "wrong password".

---

## 7. UI / UX

### UI-001 - Logged-out view shows the login section only [P1] [auto]
Preconditions: logged out
Steps:
  1. Open `/`
Expected: `section.login` visible; `header`/`nav.navigation` and `section.content` are absent from the DOM (`v-if`, `App.vue:3`, `67`); footer visible
Why it matters: the nav is the app's only authorisation surface - it must not exist for an anonymous visitor, not merely be hidden.

### UI-002 - Logged-in view shows nav, content and footer, and no login form [P1] [auto]
Preconditions: logged in
Steps:
  1. Observe the page
Expected: nav with `Home`, `Products`, `Contact`, the user icon and the `Logout` button; the content section **visible** with its three paragraphs; no login form
Why it matters: this is the post-login destination; if it renders empty the login appears to have failed. **(expected fail - BUG-01: `.content` is `display:none` in `css/style.css:128` and nothing ever unsets it.)**

### UI-003 - Password input masks its value [P1] [auto]
Preconditions: logged out
Steps:
  1. Type `secret` into `#password`
Expected: `type="password"`; the characters are not rendered as plain text
Why it matters: prevents shoulder-surfing and leakage into screenshots, screen shares and session recordings.

### UI-004 - Email input is `type="text"`, so no native validation runs (assumption) [P2] [auto]
Preconditions: logged out
Steps:
  1. Enter `not-an-email` / `2020`
  2. Submit
Expected: no browser validation bubble; the submit reaches `logIn()` and is rejected with the app's own error message
Assumption: `type="text"` (`App.vue:46`) is deliberate - it keeps the app's error message the single source of feedback. Flagged as FINDING-12 because `type="email"` would improve the mobile keyboard and add a free format check.
Why it matters: whichever choice is made, the automation must know which error surface to assert on; a silent switch to `type="email"` would break every negative case that expects the in-page message.

### UI-005 - The email field is focused on load [P2] [both]
Preconditions: fresh load, logged out
Steps:
  1. Open `/` and, without clicking, start typing
Expected: the characters land in `#email` (`autofocus`, `App.vue:50`)
Assumption: `autofocus` on an element inserted by Vue after mount is honoured inconsistently across browsers - treat as a known flake source, verify per browser rather than asserting it in a single shared test. See FINDING-13.
Why it matters: it saves every user a click, and the a11y keyboard flow (A11Y-006) assumes the starting focus position.

### UI-006 - Field labels and placeholder are correct [P2] [auto]
Preconditions: logged out
Steps:
  1. Inspect the form
Expected: label `User` bound to `#email`, label `Password` bound to `#password`, placeholder `E-mail address` on the email field only, submit button value `LOGIN`
Why it matters: these strings are the locators the whole suite will use (`getByLabel`, `getByRole`); pinning them makes a wording change fail one obvious case instead of fifty obscure ones. Note the `User`/`E-mail address` mismatch (FINDING-16).

### UI-007 - Heading text renders as specified [P2] [auto]
Preconditions: logged out
Steps:
  1. Read the `h1`
Expected: `Automation doesn't stop at testing, it's just a beginning!` on a `darkolivegreen` background
Why it matters: cheap smoke assertion that the page rendered at all and that the apostrophes survived encoding.

### UI-008 - Clicking the user icon opens the dropdown [P1] [auto]
Preconditions: logged in, dropdown closed
Steps:
  1. Click `.user-section`
Expected: the `Sign Out` dropdown is **visible** to the user
Why it matters: it is one of the two logout affordances. **(expected fail - BUG-02: `App.vue:22` toggles `v-if` but `css/style.css:161` sets `.logout { display: none }` and only `.logout.active` (L166) makes it `flex`; the `active` class is never applied, so the element mounts invisible.)**

### UI-009 - Clicking the user icon again closes the dropdown [P2] [auto]
Preconditions: logged in, dropdown open
Steps:
  1. Click `.user-section` a second time
Expected: the dropdown is removed from the DOM (`toggleLogout`, `App.vue:133–135`)
Why it matters: a toggle that only opens traps the menu over the page; verifiable in the DOM even while BUG-02 hides it visually.

### UI-010 - Clicking outside the dropdown does not close it (assumption) [P2] [auto]
Preconditions: logged in, dropdown open
Steps:
  1. Click on the content area
Expected: the dropdown stays open - no outside-click handler exists in `App.vue`
Assumption: dismiss-on-outside-click is undefined by the code. Standard menu behaviour would close it; recorded as FINDING-15 (minor UX) rather than a bug.
Why it matters: pins current behaviour so that adding a document listener later is a deliberate change with a failing test to prove it.

### UI-011 - Both logout controls are present and reachable when logged in [P1] [auto]
Preconditions: logged in
Steps:
  1. Locate `button.btn-logout` and `.user-section`
Expected: both rendered inside `section.user`; the button is enabled and clickable at the default viewport
Why it matters: SESSION-005 and SESSION-006 both depend on these controls existing; separating presence from behaviour makes a failure diagnosable in one step.
Implemented as two tests, `UI-011a` (button) and `UI-011b` (icon): the icon half hits BUG-08 and is written `test.fail()`, which requires the whole test to fail - it can't share a body with the button half, which is expected to pass. Splitting keeps the passing half a real regression guard instead of having it swallowed by the icon half's expected failure.

### UI-012 - Footer is present in both states [P2] [auto]
Preconditions: none
Steps:
  1. Check the footer logged out, then logged in
Expected: `Thank you for participating!` visible in both (it sits outside every `v-if`)
Why it matters: confirms the `v-if` boundaries are where they are supposed to be and that the flex layout keeps the footer on screen in both states.

### UI-013 - Login form is fully usable at 320px width [P1] [both]
Preconditions: logged out, viewport 320×640
Steps:
  1. Open `/`
  2. Fill both fields and submit valid credentials
Expected: heading, both inputs and the `LOGIN` button all visible without horizontal scrolling of the page body; login succeeds
Why it matters: the fieldset is a fixed `width: 320px` (`css/style.css:44`) - at the narrowest supported viewport it is exactly at the limit, so any added padding or border starts a horizontal scrollbar.

### UI-014 - Nav bar is usable at 375px width [P2] [manual]
Preconditions: logged in, viewport 375×667
Steps:
  1. Observe the nav
Expected: menu items and the user section do not overlap; the `Logout` button is fully visible and tappable
Why it matters: `.menu { width: 45vh }` (`css/style.css:113`) sizes a horizontal element in *viewport-height* units - on a tall narrow phone that is a nonsense width and is the most likely responsive break in the app.

### UI-015 - Background images load on both views [P2] [both]
Preconditions: none
Steps:
  1. Check the login view and the logged-in view
Expected: `img/bg1.jpg` and `img/bg2.jpg` load (no 404 in the network log); text stays legible over them
Why it matters: a broken background leaves white-on-white text on the login form, which reads as a blank page.

### UI-016 - No console errors or unhandled rejections during a full login/logout cycle [P2] [auto]
Preconditions: logged out
Steps:
  1. Capture console output
  2. Log in, log out, submit an invalid attempt
Expected: no `error`-level messages and no unhandled promise rejections. Note: one `log`-level line `User logged: <email>` per session check is expected (`App.vue:143`) - see FINDING-08
Why it matters: a silent console error is usually the first symptom of a partially broken render; this is the cheapest broad regression net in the suite.

---

## 8. Accessibility (target: WCAG 2.1 AA)

### A11Y-001 - Logged-out login page has no detectable WCAG A/AA violations [P1] [auto]
Preconditions: logged out, fresh load
Steps:
  1. Run an axe scan with tags `wcag2a, wcag2aa, wcag21a, wcag21aa`
Expected: zero violations; failures reported with rule id, impact, `helpUrl` and the offending element's HTML
Why it matters: the default state of the app's only interactive feature - automated scanning catches roughly a third of real issues and is the floor, not the ceiling.

### A11Y-002 - Login page with an error displayed has no violations [P1] [auto]
Preconditions: an invalid submit has produced `.error-message`
Steps:
  1. Run the same axe scan
Expected: zero violations (contrast of `#721c24` on `#f8d7da` computes to ≈8.2:1, comfortably AA)
Why it matters: the error state is a distinct rendering that most scans never reach, and it is exactly the state a struggling user is stuck in.

### A11Y-003 - Logged-in page has no violations [P1] [auto]
Preconditions: logged in
Steps:
  1. Run the axe scan, excluding third-party Font Awesome markup
Expected: zero violations
Why it matters: the destination of the feature under test; the nav introduces new interactive elements not present on the form.

### A11Y-004 - Open user dropdown has no violations [P2] [auto]
Preconditions: logged in, dropdown toggled open
Steps:
  1. Run the axe scan
Expected: zero violations
Why it matters: the fourth distinct state; a menu is where role/name/state defects concentrate (see A11Y-010).

### A11Y-005 - Both inputs have a programmatic accessible name [P1] [auto]
Preconditions: logged out
Steps:
  1. Resolve the fields by their labels: `User` and `Password`
Expected: each resolves to exactly one input - `<label for>` ↔ `id` association (`App.vue:44/47`, `54/57`) is correct
Why it matters: a field a screen reader announces as "edit text, blank" is unusable; a label-based locator passing is the proof, and it doubles as the suite's preferred locator strategy.

### A11Y-006 - Complete login using the keyboard only [P0] [auto]
Preconditions: logged out, mouse unused
Steps:
  1. `Tab` to `#email`, type the email
  2. `Tab` to `#password`, type the password
  3. Press `Enter`
Expected: logged-in view renders; no keyboard trap at any step
Why it matters: keyboard operability of the login is a hard blocker - a user who cannot log in cannot use any part of the product (WCAG 2.1.1).

### A11Y-007 - Every interactive control shows a visible focus indicator [P1] [both]
Preconditions: logged out
Steps:
  1. `Tab` through `#email`, `#password`, `LOGIN`
  2. Log in and `Tab` through the nav controls
Expected: a clearly visible focus indicator on each control at each step
Why it matters: **(expected fail - BUG-04: `css/style.css:60` applies `outline: none` to `#email`, `#password` and `.btn-login`.)** The inputs get a background change on focus (L81–83), but the `LOGIN` button gets nothing - a sighted keyboard user cannot tell whether pressing Enter will submit. WCAG 2.4.7.

### A11Y-008 - The error message is announced to screen readers [P1] [both]
Preconditions: logged out
Steps:
  1. With a screen reader running, submit invalid credentials
Expected: the error text is announced without moving focus - requires `role="alert"` or `aria-live="polite"` on `.error-message`
Why it matters: **(expected fail - BUG-05: `App.vue:41–43` renders a plain `div`.)** A blind user submits, hears nothing, and has no way to know the attempt failed. WCAG 4.1.3 Status Messages.

### A11Y-009 - The error is programmatically associated with the fields it explains [P2] [manual]
Preconditions: an error is displayed
Steps:
  1. Inspect `#email` and `#password`
Expected: `aria-describedby` pointing at the error element and `aria-invalid="true"` while the error is shown
Why it matters: **(expected fail)** without the association, a user navigating field-by-field never encounters the explanation of why their login failed. WCAG 3.3.1.

### A11Y-010 - The user-icon dropdown is keyboard operable and correctly exposed [P1] [both]
Preconditions: logged in
Steps:
  1. `Tab` to the user icon
  2. Press `Enter` (then `Space`) to open the menu
  3. Press `Escape`
Expected: the icon is focusable and announced as a button with an accessible name; `aria-expanded` reflects state; Enter/Space open it; Escape closes it
Why it matters: **(expected fail - BUG-06: `App.vue:20` is a `div` with `@click` only - not focusable, no role, no name, no keyboard handler.)** One of the two logout paths is entirely unavailable to keyboard and screen-reader users. WCAG 2.1.1 and 4.1.2.

### A11Y-011 - Heading contrast meets AA [P2] [auto]
Preconditions: logged out
Steps:
  1. Measure white text on `darkolivegreen` (`#556B2F`), 30px `h1` (`App.vue:38`)
Expected: **pass** - computed ≈5.9:1, above 4.5:1 for normal text and 3:1 for large
Why it matters: the heading is the one hand-written colour in the markup and the most likely to be changed on a whim; the case locks in a currently-passing value so a "nicer green" cannot silently break AA.

### A11Y-012 - Logout button contrast meets AA [P1] [auto]
Preconditions: logged in
Steps:
  1. Measure white text on `#d9534f` (`css/style.css:171`) at `font-size: 0.95rem` (≈15px, normal weight)
Expected: ≥4.5:1
Why it matters: **(expected fail - BUG-03: computed ≈3.96:1.)** The primary session-ending control is the least legible text in the app for users with low vision. WCAG 1.4.3.

### A11Y-013 - Input and placeholder text is legible over the background image [P2] [manual]
Preconditions: logged out
Steps:
  1. Inspect `#email` (unfocused) and its placeholder against `img/bg1.jpg`
Expected: input text and placeholder both meet 4.5:1 against what is actually painted behind them
Why it matters: the field background is `rgba(800, 800, 800, .6)` (`css/style.css:78` - invalid channel values that clamp to white, FINDING-09) layered over a photo, so the effective contrast varies per pixel. axe skips text over background images, so only a human can settle this.

### A11Y-014 - Tab order is logical [P1] [auto]
Preconditions: logged out
Steps:
  1. From the top of the page, `Tab` repeatedly and record the focus sequence
Expected: `#email` → `#password` → `LOGIN`, matching visual order; no positive `tabindex` anywhere
Why it matters: a focus order that disagrees with the visual layout makes a three-field form feel like a maze. WCAG 2.4.3.

### A11Y-015 - No keyboard trap in either state [P2] [auto]
Preconditions: logged out, then logged in
Steps:
  1. `Tab` past the last control in each state and `Shift+Tab` back
Expected: focus leaves the form/nav and returns; nothing captures focus
Why it matters: a trap makes the whole page unusable, not just the component. WCAG 2.1.2.

### A11Y-016 - Focus lands somewhere sensible after login and after logout [P2] [manual]
Preconditions: logged out
Steps:
  1. Log in with the keyboard, note where focus goes
  2. Log out with the keyboard, note where focus goes
Expected: focus moves to a meaningful element in the new view rather than being dropped on `<body>`
Why it matters: the submit button is destroyed by the `v-if` swap, so focus is orphaned; a screen-reader user is left with no announcement that the view changed. Not covered by axe.

### A11Y-017 - Inputs declare their purpose for autofill [P2] [auto]
Preconditions: logged out
Steps:
  1. Inspect the two inputs
Expected: `autocomplete="username"` and `autocomplete="current-password"`
Why it matters: **(expected fail - FINDING-14, neither attribute exists.)** Password managers and users with cognitive or motor impairments rely on them. WCAG 1.3.5 Identify Input Purpose (AA).

### A11Y-018 - Page title describes the page [P2] [auto]
Preconditions: any
Steps:
  1. Read `document.title`
Expected: a title that identifies the app and state
Why it matters: **(expected fail - FINDING-17: `index.html:6` is `Single Page Application`.)** Screen-reader users identify tabs by title; a generic one is indistinguishable from every other tab. WCAG 2.4.2.

### A11Y-019 - Document structure basics [P2] [auto]
Preconditions: both states
Steps:
  1. Check `<html lang>`, heading count, landmarks
Expected: `lang="en"` present (pass, `index.html:2`); exactly one `h1` on the login view; `header`/`nav`/`main`/`footer` landmarks present (pass)
Why it matters: landmark navigation is how screen-reader users skip straight to the form; the app already gets this right and a regression would be invisible to sighted testers.

### A11Y-020 - Nav menu items are either interactive or not presented as clickable [P2] [manual]
Preconditions: logged in
Steps:
  1. `Tab` through the nav
Expected: `Home`, `Products` and `Contact` are reachable and announced as links/buttons - or, if inert, not styled with `cursor: pointer`
Why it matters: **(expected fail)** they are plain `div`s (`App.vue:6–17`) styled as clickable (`css/style.css:120–122`) - they advertise an affordance they do not have, for everyone, and are invisible to keyboard users. Out of the login critical path, hence P2.

### A11Y-021 - Decorative icons are hidden from assistive tech [P2] [auto]
Preconditions: both states
Steps:
  1. Inspect the Font Awesome `<i>` elements
Expected: `aria-hidden="true"` on purely decorative icons; the user-icon control has a text alternative
Why it matters: unlabelled icon fonts are announced as meaningless characters, and the user icon is a control whose only content is an icon (see A11Y-010).

### A11Y-022 - Reflow at 320px and at 200% zoom [P1] [both]
Preconditions: logged out; viewport 320×640, then 1280×720 at 200% zoom
Steps:
  1. Open `/` in each configuration
  2. Attempt to log in
Expected: no loss of content or functionality; no scrolling in two dimensions
Why it matters: WCAG 1.4.10 Reflow. The fixed 320px fieldset (`css/style.css:44`) and the `45vh`-wide nav menu (L113) are the two places where this most plausibly fails.

---

## 9. Defects and risky behaviour found while reading the source

Ordered by impact. BUG-* are reproducible defects; FINDING-* are risks, limitations and design observations that are not worth failing a test over (per the "security-flavoured observations are findings, not failing tests" rule).

> Note on evidence: this environment has no browser tooling installed, so the four BUG entries below are derived from static reading of the markup and CSS together. Each names the exact file:line so the AQA-engineer can confirm at runtime in the first test run and attach a screenshot/trace.

### BUG-01 - Logged-in content area never becomes visible
```
Title: After a successful login the content section renders empty - .content is display:none and nothing ever unsets it
Severity: major
Environment: Vue build (src/App.vue), any browser/viewport, commit 22b9d35
Steps to reproduce:
  1. Open http://localhost:5173 with empty localStorage
  2. Log in as admin@admin.com / 2020
  3. Observe the area between the nav bar and the footer
Actual: nav bar and footer render; the lorem-ipsum content section is in the DOM but not painted - the page body is empty
Expected: the content section is visible, centred, over img/bg2.jpg
Evidence: to be captured on the first run (screenshot + DOM snapshot of section.content)
Notes: css/style.css:128 sets `.content { display: none }`. The original implementation set it back explicitly (`content.style.display = 'flex'`, js/index.js:39); the Vue port replaced that with `v-if` (src/App.vue:67) and never removed the CSS rule, so v-if now mounts an element that CSS keeps hidden. Fix: delete `display: none` from the `.content` rule (it also declares `align-items`/`justify-content`, which imply flex).
```

### BUG-02 - User dropdown "Sign Out" is unreachable
```
Title: Clicking the user icon mounts the Sign Out dropdown but CSS keeps it hidden, so one of the two logout paths is unusable
Severity: major
Environment: Vue build, any browser/viewport, commit 22b9d35
Steps to reproduce:
  1. Log in as any user
  2. Click the user-circle icon in the nav bar
Actual: nothing appears; the div.logout exists in the DOM with computed display:none
Expected: a Sign Out menu appears under the icon
Evidence: DOM snapshot showing div.logout present with computed style display:none
Notes: same root cause class as BUG-01 - css/style.css:161 declares `.logout { display: none }` and only `.logout.active` (L166–168) makes it flex. The Vue template (src/App.vue:22) toggles `v-if="showLogoutMenu"` and never adds the `active` class. Fix: either drop `display: none` from `.logout`, or bind `:class="{ active: showLogoutMenu }"` and render it unconditionally.
```

### BUG-03 - Logout button text fails AA contrast
```
Title: White text on #d9534f in .btn-logout gives ~3.96:1, below the 4.5:1 required for normal-size text
Severity: minor (accessibility: serious - WCAG 1.4.3 Contrast Minimum, AA)
Environment: all browsers, logged-in view, commit 22b9d35
Steps to reproduce:
  1. Log in
  2. Measure the contrast of the Logout button label against its background
Actual: ≈3.96:1 at font-size 0.95rem (~15px, normal weight)
Expected: ≥4.5:1
Evidence: computed from css/style.css:171 (#d9534f) and :172 (white)
Notes: darkening to about #c9302c (already the hover colour, L185) reaches ~4.9:1, or keep the colour and raise the label to ≥19px bold to qualify as large text. Cross-ref A11Y-012.
```

### BUG-04 - Focus indicator removed from all login controls
```
Title: `outline: none` strips the focus ring from #email, #password and .btn-login; the submit button has no focus styling at all
Severity: major (accessibility: serious - WCAG 2.4.7 Focus Visible, AA)
Environment: all browsers, login view, commit 22b9d35
Steps to reproduce:
  1. Open / logged out
  2. Press Tab three times, watching for a focus indicator
Actual: no visible indicator on the LOGIN button; the inputs only change background colour
Expected: a clearly visible focus indicator on each of the three controls
Evidence: css/style.css:54–63 (`outline: none` at L60), with a focus style defined only for the inputs at L81–83
Notes: replace with `:focus-visible { outline: 2px solid …; outline-offset: 2px }`. This blocks sighted keyboard users from knowing whether Enter will submit. Cross-ref A11Y-007.
```

### BUG-05 - Error message is not announced to screen readers
```
Title: .error-message appears silently - no role="alert" / aria-live, so a failed login is inaudible
Severity: major (accessibility: serious - WCAG 4.1.3 Status Messages, AA)
Environment: any screen reader, login view, commit 22b9d35
Steps to reproduce:
  1. Start a screen reader, open / logged out
  2. Submit wrong credentials
Actual: nothing is announced; focus stays in the form with no indication of failure
Expected: "Invalid email or password. Please try again." is announced without a focus change
Evidence: src/App.vue:41–43 - a bare <div class="error-message">
Notes: add role="alert" (and ideally aria-describedby from both inputs plus aria-invalid while shown). Cross-ref A11Y-008, A11Y-009.
```

### BUG-06 - User dropdown control is not keyboard accessible
```
Title: The user-icon menu trigger is a <div> with a click handler - not focusable, no role, no accessible name, no keyboard activation
Severity: major (accessibility: serious - WCAG 2.1.1 Keyboard, 4.1.2 Name Role Value, A)
Environment: all browsers, logged-in view, commit 22b9d35
Steps to reproduce:
  1. Log in
  2. Tab through the nav bar
Actual: focus never reaches the user icon; the menu cannot be opened without a mouse
Expected: focusable, announced as a button with a name, opened with Enter/Space, closed with Escape, aria-expanded reflecting state
Evidence: src/App.vue:20–27
Notes: use a real <button> (or role="button" + tabindex="0" + @keydown.enter/space + @keydown.esc + :aria-expanded). Note this control is also invisible today (BUG-02), so the two fixes should land together. Cross-ref A11Y-010.
```

### BUG-07 - Decorative icons are not hidden from assistive tech
```
Title: Font Awesome <i class="fas ..."> icons in the nav bar and dropdown carry no aria-hidden, so some screen readers announce raw glyph codepoints instead of nothing
Severity: minor (accessibility: moderate - WCAG 1.1.1 Non-text Content / 4.1.2, best-practice for icon fonts)
Environment: any screen reader, logged-in view, commit 22b9d35
Steps to reproduce:
  1. Log in
  2. Inspect the six <i class="fas ..."> elements in header/nav (src/App.vue:7,11,15,21,24,29)
Actual: none of them declare aria-hidden="true"
Expected: purely decorative icons are aria-hidden="true"; the user-icon control (src/App.vue:20-21) additionally needs its own accessible name on the control itself (tracked as BUG-06), since hiding the icon alone would leave that control unnamed
Evidence: src/App.vue:7,11,15,21,24,29 - no aria-hidden attribute on any <i> element
Notes: add aria-hidden="true" to every decorative <i class="fas ...">. Land together with the BUG-06 fix so `.user-section` gets both a real accessible name and an aria-hidden icon. Cross-ref A11Y-021.
```

### BUG-08 - The Font Awesome kit script 403s, so no icon ever renders and the user-icon dropdown trigger has zero size
```
Title: index.html loads icons from a personal Font Awesome Kit (https://kit.fontawesome.com/372ad6816f.js); that request returns HTTP 403, the script never runs its <i> → <svg> replacement, and every icon-only element that has no explicit width/height collapses to a 0x0 box
Severity: major (compounds BUG-02: even after the CSS fix, .user-section has no accessible click target)
Environment: real Chromium, unrestricted network, commit 22b9d35 - confirmed live via the playwright-test MCP browser (not just the CLI test run), so this is not a sandbox/proxy artifact
Steps to reproduce:
  1. Open http://localhost:5173 with devtools open
  2. Observe the console and network tab
  3. Log in as admin@admin.com / 2020 and look at the nav bar
Actual: console shows `Failed to load resource: the server responded with a status of 403 () @ https://kit.fontawesome.com/372ad6816f.js`; Home/Products/Contact render with no icon glyph at all; `.user-section` (the div wrapping fa-user-circle, App.vue:20-21) has `getBoundingClientRect() = {width: 0, height: 0}` and `::before` computed `content: none` - it is present in the DOM but has no clickable surface, so a mouse user cannot open the Sign Out dropdown even once BUG-02's CSS is fixed
Expected: icons render (kit is valid and unrestricted for this domain, or icons are self-hosted/bundled instead of depending on a third-party account-scoped script), and `.user-section` has a real box the same way `.btn-logout` (a <button> with padding and text) does
Evidence: review/evidence/bug08-icons-not-rendering.png (screenshot - nav bar with text but no icons anywhere); live console/network capture via playwright-test MCP, 2026-09-13
Notes: this Kit ID (`372ad6816f`) is almost certainly scoped in the developer's Font Awesome account to a specific domain - it 403s from any other origin, so this reproduces for every environment testing against localhost, not just this one. Root fix: self-host the Font Awesome SVGs (`@fortawesome/fontawesome-free` as a dependency) or issue a kit that allows `localhost`/the deployed domain, and give `.user-section` explicit dimensions so it doesn't depend on icon content for its hit area at all (ties into the BUG-06 "use a real <button>" fix). Cross-ref BUG-02, BUG-06, UI-008, UI-011b.
```

### Findings (risks and limitations - not failing tests)

| # | Finding | Impact | Evidence |
|---|---|---|---|
| FINDING-01 | No rate limiting, lockout or delay on failed attempts | Unlimited offline brute force; inherent to a client-only demo | `src/App.vue:116–127` |
| FINDING-02 | No server-side authentication - the browser is the only authority | Any user can grant themselves a session; acceptable only because this is a demo | `src/App.vue:139–145` |
| FINDING-03 | `checkLogged` accepts **any** non-empty `logged` value without validating it against `users` | An arbitrary string becomes the app's notion of identity and is printed to the console | `src/App.vue:141` |
| FINDING-04 | No `storage` event listener → tabs desync after login/logout | A stale tab keeps showing authenticated content after logout elsewhere | `src/App.vue` (no listener) |
| FINDING-05 | `localStorage` access is unguarded | With site data blocked, `setItem` throws and the form silently does nothing - indistinguishable from a wrong password | `src/App.vue:119, 129, 140` |
| FINDING-06 | Credentials are hard-coded in the shipped bundle in plaintext | Anyone can read all three passwords from the JS; inherent to the demo | `src/App.vue:108–112`, `js/users.js` |
| FINDING-07 | **The user list is duplicated**: `App.vue` hard-codes it instead of importing `js/users.js` | The two can silently diverge; a test suite importing `js/users.js` (as the AQA-engineer's data rule requires) would then be asserting against data the app does not use | `src/App.vue:108–112` vs `js/users.js:1–5` |
| FINDING-08 | The logged-in user's email is written to the console on every session check | Low-value info leak and log noise; also fires on every reload | `src/App.vue:143` |
| FINDING-09 | `rgba(800, 800, 800, .6)` uses out-of-range channel values (clamped to white) | Sloppy and misleading; makes the field's effective contrast hard to reason about (A11Y-013) | `css/style.css:78` |
| FINDING-10 | Email comparison is case sensitive | Correct credentials in the wrong case are rejected with no hint why | `src/App.vue:117` |
| FINDING-11 | No trimming of the email input | A pasted address with a trailing space fails and looks correct to the user | `src/App.vue:117` |
| FINDING-12 | Email field is `type="text"` with no `required` | No mobile email keyboard, no native format hint | `src/App.vue:46` |
| FINDING-13 | `autofocus` is applied to an element mounted by Vue after parse | Honoured inconsistently across browsers - a flake source for UI-005 and for keyboard tests that assume a starting focus | `src/App.vue:50` |
| FINDING-14 | No `autocomplete` attributes on the credential fields | Hurts password managers and WCAG 1.3.5 | `src/App.vue:45–60` |
| FINDING-15 | Dropdown has no outside-click or Escape dismissal | Non-standard menu behaviour | `src/App.vue:20–27` |
| FINDING-16 | Label says `User` while the placeholder says `E-mail address` | Ambiguous whether a username or an email is wanted | `src/App.vue:44, 49` |
| FINDING-17 | Page title is the generic `Single Page Application` | WCAG 2.4.2; poor tab identification | `index.html:6` |
| FINDING-18 | The password field keeps its value after a failed attempt | Minor: a shared screen retains the typed secret in the DOM; most products clear it | `src/App.vue:124–126` |
| FINDING-19 | Google Fonts is loaded over plain `http://` | Blocked as mixed content on any HTTPS deployment; silent font fallback | `index.html:7`, `index-vue.html:7` |
| FINDING-20 | `index-vue.html` is an unused duplicate entry point, and `style.css` is imported twice (`src/main.js:3` **and** the `@import` in `App.vue:154`) | The README explicitly asks for "only necessary sources"; the double import also ships the CSS twice | `index-vue.html`, `src/main.js:3`, `src/App.vue:153–155` |
| FINDING-21 | `.menu { width: 45vh }` sizes a horizontal element in viewport-height units | Nav width tracks screen height - the most likely responsive break (UI-014) | `css/style.css:113` |
| FINDING-22 | The only existing test (`js/users.test.js`) asserts on the credential *data*, not on any behaviour | Gives a false sense of coverage: it would still pass with the login completely broken | `js/users.test.js:4–8` |

---

## 10. Coverage summary

| Area | Cases | P0 | P1 | P2 | auto | manual | both |
|---|---|---|---|---|---|---|---|
| Data integrity (LOGIN-DATA-01) | 1 | 1 | 0 | 0 | 1 | 0 | 0 |
| Positive authentication (LOGIN-001…008) | 8 | 3 | 3 | 2 | 8 | 0 | 0 |
| Negative authentication (LOGIN-010…022) | 13 | 5 | 6 | 2 | 13 | 0 | 0 |
| Boundary / edge inputs (LOGIN-030…039) | 10 | 1 | 2 | 7 | 9 | 1 | 0 |
| Error handling (LOGIN-040…048) | 9 | 0 | 5 | 4 | 8 | 1 | 0 |
| Session / localStorage (SESSION-001…017) | 17 | 8 | 6 | 3 | 14 | 1 | 2 |
| UI / UX (UI-001…016) | 16 | 0 | 6 | 10 | 12 | 1 | 3 |
| Accessibility (A11Y-001…022) | 22 | 1 | 10 | 11 | 14 | 4 | 4 |
| **Total** | **96** | **19** | **38** | **39** | **79** | **8** | **9** |

Cases that document a **known defect** and are therefore expected to fail on the current build: `UI-002` (BUG-01), `UI-008` and `SESSION-006` (BUG-02), `A11Y-003`/`A11Y-004`/`A11Y-012` (BUG-03 - confirmed at runtime by axe: the whole-page scans of the logged-in states hit the `.btn-logout` contrast), `A11Y-007` (BUG-04), `A11Y-008`/`A11Y-009` (BUG-05), `A11Y-010` (BUG-06), `A11Y-021` (BUG-07), `UI-011b` and `SESSION-006` (also BUG-08, confirmed live via the playwright-test MCP browser), `A11Y-017`, `A11Y-018`, `A11Y-020`. Write them so they actually execute and fail on the current build (`test.fail(true, 'BUG-xx: ...')`), not `test.fixme()` - `test.fixme()` aborts the test body immediately and never turns red when the bug is fixed, so it cannot act as the "permanent regression guard" this plan and `DECISIONS.md` promise. Reserve `test.fixme()` for cases blocked by tooling/environment, not by an app defect. As implemented: `tests/a11y/axe.spec.ts` and `tests/a11y/keyboard.spec.ts` use `test.fail()` for every one of these except the two blocked by BUG-08's zero-size click target, where the trigger click itself is issued via `homePage.openUserMenu()` (a forced `dispatchEvent('click')`, not a real simulated mouse click) so the test fails fast on the actual assertion instead of hanging on a 30s actionability timeout.

Cases marked **(assumption)** - behaviour the code leaves undefined: `LOGIN-017`, `LOGIN-019`, `LOGIN-038`, `SESSION-009`, `SESSION-010`, `SESSION-012`, `SESSION-017`, `UI-004`, `UI-005`, `UI-010`.

## 11. Deliberately not tested, and why

| Not tested | Why |
|---|---|
| Server-side authentication, token handling, password hashing | There is no server. Authentication is a `find` over an in-memory array (`App.vue:117`); there is nothing to test beyond FINDING-02. |
| Brute-force protection, account lockout, CAPTCHA, MFA, password reset, "remember me", registration | None of these features exist. `LOGIN-038` records the absence of throttling; the rest would be tests of imaginary code. |
| Cross-site request forgery, CORS, secure/HttpOnly cookie flags | No network requests and no cookies are involved in the login. |
| Password strength/complexity rules | The app never creates or changes a password. |
| Content of the lorem-ipsum paragraphs, nav item navigation, `Home`/`Products`/`Contact` behaviour | Not part of the login feature and not wired to anything (`App.vue:6–17`); only their a11y semantics are noted (A11Y-020). |
| Visual pixel-perfect regression / screenshot diffing of the background photos | High maintenance cost against a decorative asset; UI-015 covers "the image loaded" and A11Y-013 covers the part that affects users. |
| Internationalisation / RTL | The app is `lang="en"` only, with no i18n layer. |
| Performance, load and stress testing | Client-only app with three records; no meaningful load dimension. LOGIN-030/031 cover the only realistic input-size risk. |
| The legacy `js/index.js` implementation | Not loaded by either HTML entry point - dead code kept for reference. It was read to infer intent (notably the `display: flex` that BUG-01 lost), but shipping tests against unreachable code would violate the README's "only necessary sources". |
| Screen-reader announcement verified across NVDA/JAWS/VoiceOver individually | Out of budget for a 6–10h assignment. `A11Y-008` and `A11Y-016` are marked `[manual]` with the expected announcement stated, so a single pass with one screen reader settles them. |
| `SESSION-017` (blocked storage) in CI | Requires a browser profile with site data disabled; documented as manual with the assumed failure mode rather than faked with a `localStorage` stub. |

## 12. Handoff to `AQA-engineer`

Suggested file mapping, so each spec has one clear subject:

- `tests/e2e/login.spec.ts` - `LOGIN-DATA-01`, `LOGIN-001…008`, `LOGIN-010…022`, `LOGIN-030…038`, `LOGIN-040…047`
- `tests/e2e/session.spec.ts` - `SESSION-001…016`
- `tests/e2e/ui.spec.ts` - `UI-001…003`, `UI-005…013`, `UI-015…016`
- `tests/a11y/keyboard.spec.ts` - `A11Y-006…007`, `A11Y-014…015` (keyboard operability and focus)
- `tests/a11y/axe.spec.ts` - `A11Y-001…005`, `A11Y-011…012`, `A11Y-017…019`, `A11Y-021…022` (axe scans, names, contrast, structure)

Build order - P0 first: `LOGIN-001, 002, 003, 010, 011, 015, 016, 022, 034` and `SESSION-001, 002, 003, 004, 005, 007, 009, 010`, plus `A11Y-006`.

Manual-only, not for CI: `LOGIN-039`, `LOGIN-048`, `SESSION-017`, `UI-014`, `A11Y-009`, `A11Y-013`, `A11Y-016`, `A11Y-020`.

Two notes that affect implementation directly:
1. **FINDING-07** - importing credentials from `js/users.js` is the right practice, but the app reads its own hard-coded copy in `App.vue:108–112`. Add one assertion that the two lists are identical, otherwise the whole suite could pass against data the app never uses.
2. **FINDING-13** - do not build the keyboard flows on `autofocus` being honoured; focus `#email` explicitly, and let `UI-005` be the single case that tests autofocus itself.

**Handoff complete (2026-09-14).** Actual file placement matches this mapping almost
exactly, with two deliberate additions not listed above: `UI-004` landed in
`tests/e2e/ui.spec.ts` alongside the rest of the logged-out group (it only needed the
existing fixtures, no reason for a separate home), and `A11Y-008`/`A11Y-010` landed in
`tests/a11y/axe.spec.ts` rather than being left unautomated - both only assert DOM
attributes (`role`, `aria-hidden`, `tabindex`), which needs no real screen reader, so
the `[both]` tag's automatable half is covered there and only the human-listening half
stays manual. All P0 cases plus every other `[auto]`/`[both]` case are implemented;
see the status line at the top of this document.
