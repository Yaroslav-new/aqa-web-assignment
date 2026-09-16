# Design decisions

Why the test suite and repository ended up structured the way they did. The
*what* is in [README.md](README.md), [tests/TESTING.md](tests/TESTING.md) and
[tests/plans/login-test-cases.md](tests/plans/login-test-cases.md); this is the
*why*, for anything that isn't self-evident from the code.

## The app was treated as the system under test, not fixed

Eight confirmed defects were found while designing and later automating the
test plan (`BUG-01…08` in
[tests/plans/login-test-cases.md §9](tests/plans/login-test-cases.md)) - the
first six from reading `src/App.vue`/`css/style.css`, the last two (BUG-07,
BUG-08) confirmed live in a real browser via the `playwright-test` MCP server
while writing the a11y suite. The two most visible defects are that the
logged-in content area and the "Sign Out" dropdown are both rendered but kept
invisible by leftover pre-Vue CSS (`display: none` rules the Vue port never
removed). It would have been trivial to delete those CSS lines and make every
test pass. That was deliberately not done: the assignment's deliverable is
the test suite, and a suite that quietly edits the thing it's supposed to be
grading proves nothing. Instead each defect is documented with steps to
reproduce, severity, evidence (file:line) and a proposed fix, and the
corresponding test case states the *correct* behaviour and is marked
`test.fail(true, 'BUG-xx: ...')` with the bug id - so it fails honestly today
and turns into a permanent regression guard the moment someone fixes the app.

This was originally written as `test.fixme()` and corrected after the fact:
`test.fixme()` aborts the test body at the exact line it's called, so
everything after it - the login, the scan, the actual assertion - never runs.
It only proves that someone once believed the bug existed; it can't turn red
when the bug is fixed, because a skipped test never runs at all. `test.fail()`
still executes the whole test and requires it to fail; the day the underlying
bug is fixed, the assertion starts passing and Playwright reports "expected to
fail, but passed", which is the only mechanism that actually forces someone to
notice and remove the annotation. Every defect-documenting case in the suite
uses `test.fail()` for this reason.

## One designed case can be two tests when `test.fail()` requires it

`UI-011` ("both logout controls are present and reachable") is implemented as
two tests, `UI-011a` and `UI-011b`, not one. The button half passes; the
user-icon half hits BUG-08 and must be written `test.fail()` - which requires
the *whole* test to fail, so a passing assertion and a `test.fail()`-marked
failing one can't share a body without the passing half being swallowed by
the expected failure. Splitting is what keeps the button half a real
regression guard. The plan still lists `UI-011` as one designed case (see
§7) - the split is purely how it's automated, not a second design decision.

## A written test plan came before any test code

[tests/plans/login-test-cases.md](tests/plans/login-test-cases.md) - 96 cases
with preconditions, steps, expected result and a "why it matters" line - was
written by reading `src/App.vue` line by line before `tests/e2e/*.spec.ts`
existed. This forces every branch of `logIn/logOut/toggleLogout/clearError/
checkLogged` to be enumerated up front (coverage table in the plan's §10)
instead of discovering gaps by accident later, and it gives every test title a
stable id (`LOGIN-001`, `SESSION-004`, ...) that maps a CI failure straight
back to its designed case, priority and rationale.

## TypeScript for the whole test layer, the app stays JS

Tests are `strict` TypeScript, checked by `tsc --noEmit`; the application
source is out of `tsconfig.json`'s scope entirely. The app is the fixed
artefact being graded - there's no reason to touch its language or tooling.
The test suite is new code with no such constraint, and strict typing catches
locator/fixture mistakes (wrong property name, wrong return type) before a
test even runs, which matters more here than in the app because the suite is
the actual deliverable.

## Playwright for behaviour, Vitest for data

Two runners exist because they check two different things: Playwright drives
a real browser to verify the app *behaves* correctly (login, session,
accessibility), while a single Vitest test (`js/users.test.ts`) checks that
the credential *data* in `js/users.js` hasn't silently lost an account. They
are scoped apart in `vitest.config.ts` (`exclude: ['tests/**']`) so Vitest
never tries to collect Playwright's `test.describe` files and crash on them.

## `js/users.js` is the one source of truth for credentials

`src/App.vue` hard-codes its own copy of the three accounts instead of
importing `js/users.js` (`FINDING-07`). If the tests had simply retyped the
same three emails/passwords, the suite could stay green forever even if the
app's copy drifted from the documented data - it would be testing against
credentials the running app never actually reads. Instead every test imports
`js/users.js` (via `tests/fixtures/users.ts`), and one dedicated case,
`LOGIN-DATA-01`, reads the user list straight out of the live Vue instance and
asserts it's `toEqual` the imported list. That one assertion is what makes
importing the "correct" data source actually meaningful.

## Shared fixtures and assertion helpers over per-file duplication

`loginPage.login(admin.email, admin.password)` followed by a "nav is visible"
sanity check used to be retyped at the top of most session/UI/a11y tests, and
the "back on the login view, no header, no session key" check was retyped
slightly differently in `login.spec.ts`, `session.spec.ts` and `ui.spec.ts`.
Neither is a design choice worth re-deriving per file: `loggedInPage` in
[tests/fixtures/test.ts](tests/fixtures/test.ts) covers the first (only for
cases whose precondition is simply "already logged in" - a test that must
observe the moment of login itself still calls `loginPage.login` directly),
and `expectLoggedOut()` in
[tests/fixtures/assertions.ts](tests/fixtures/assertions.ts) covers the
second. Both stay at the spec layer, so "Page Objects hold no assertions"
below is unaffected - this is deduplication of the spec-side checks, not a
relocation of them into the page objects.

## Page Objects hold no assertions, specs hold no raw selectors

`tests/pages/*.page.ts` expose only semantic locators (`getByRole`,
`getByLabel`, `getByPlaceholder`) and actions; every `expect()` lives in the
spec files. The split keeps a locator change (say, a re-labelled button) a
one-line fix in the page object, while what's actually being verified stays
readable in the spec without wading through selector logic. No XPath and no
class-chain selectors, on purpose - class names are the layer most likely to
change and least likely to reflect user-visible behaviour, which is why
`css/style.css`'s `.active`/`display:none` bugs exist in the first place.

## Tiers are tags, not separate files or a naming convention

`@smoke` and `@critical` are declared as Playwright tags in the test's option
argument (`test('LOGIN-001: …', { tag: [...] }, ...)`), not encoded into file
names or titles. A test can be smoke *and* critical at once, `--grep` selects
either tier from any spec file, and the case id in the title stays the only
thing a human reads.

## CI is a cheap gate on PRs, full verification on master

[.github/workflows/quality-gate.yml](.github/workflows/quality-gate.yml) runs
only the four `@smoke` tests on a pull request (~10s) and the full e2e + a11y
suite on push to master. A PR check that takes several minutes discourages
people from waiting for it; a smoke tier that just proves the core loop still
works is enough signal to gate a merge, while the full suite still catches
everything else immediately after, on master. The trade-off - a regression
outside the smoke tier only surfaces red on master, after merge - is accepted
deliberately rather than accidentally, and written down in
[CLAUDE.md](CLAUDE.md) so it isn't mistaken for an oversight.

## Every test starts logged out, independently

The `cleanPage` fixture wipes `localStorage`/`sessionStorage` and reloads
before each test. Nothing in the suite depends on execution order or on
another test's leftover state, which is what lets the suite run with multiple
parallel workers in CI without flaking.

## Legacy files were kept despite "only necessary sources"

`js/index.js` (the pre-Vue implementation) and `index-vue.html` are dead code
- neither is loaded by the running app. The README asks for "only necessary
sources," which would argue for deleting them, but `js/index.js` was what
made it possible to figure out `BUG-01` in the first place: it explicitly sets
`content.style.display = 'flex'` after login, which is exactly the line the
Vue port dropped. Reference value for understanding *intended* behaviour was
judged worth more here than strict adherence to the "necessary sources" rule
for these two files specifically - argued for in
[tests/plans/login-test-cases.md §11](tests/plans/login-test-cases.md), not
just assumed.
