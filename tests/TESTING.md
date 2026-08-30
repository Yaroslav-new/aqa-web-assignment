# Test framework

The deliverable of this assignment: an automated test suite for the login feature
of the Vue 3 SPA. TypeScript end to end - Playwright for E2E and accessibility,
Vitest for the unit layer, GitHub Actions for CI. The application source is the
system under test and is never modified to make a test pass.

## Quick start

```bash
npm i
npx playwright install chromium     # --with-deps on Linux/CI
npm test                            # typecheck → unit → e2e
```

The Vite dev server is started and stopped by Playwright itself (`webServer` in
[playwright.config.ts](playwright.config.ts)) - do not run `npm run dev` first.
A green run reports **2 skipped**: two axe cases are `test.fixme` on a confirmed
defect (see "Known defects" below).

## Commands

| Command | What it runs |
|---|---|
| `npm test` | the whole chain: typecheck, unit, e2e |
| `npm run typecheck` | `tsc --noEmit` over the test project |
| `npm run test:unit` | Vitest, no browser |
| `npm run test:e2e` | the whole Playwright suite (e2e + a11y) |
| `npm run test:login` / `test:session` | one functional area |
| `npm run test:a11y` | accessibility specs only |
| `npm run test:smoke` | `@smoke` tier - the core loop works at all (~10s) |
| `npm run test:critical` | `@critical` tier - auth cannot be bypassed |
| `npm run test:e2e:ui` | interactive UI mode |
| `npm run test:e2e:slow` | headed browser, 500ms slowMo, 1 worker - watch the run live |
| `npm run test:debug` | Playwright inspector, step through |
| `npm run test:report` | open the last HTML report |

Run a single case by its id (every test title starts with one):

```bash
npx playwright test --grep "SESSION-007"
npx playwright test --repeat-each=10 --grep "SESSION-007"   # flake hunt
```

## Architecture

```
tests/
├── plans/login-test-cases.md   95 designed cases - the specification the specs implement
├── e2e/                        functional specs: login, session, ui
├── a11y/                       accessibility: keyboard operability + axe WCAG A/AA scans
├── pages/                      Page Objects - locators and actions, no assertions
└── fixtures/                   clean-state fixture + test data
playwright.config.ts            webServer on :5173, chromium project, traces/video on failure
vitest.config.ts                scopes the unit layer; keeps Vitest away from Playwright specs
tsconfig.json                   strict TS over the test project only (the app stays JS)
js/users.test.ts                the single unit test (lives next to the app data it checks)
```

How a test executes, end to end:

1. The **`cleanPage` fixture** ([tests/fixtures/test.ts](tests/fixtures/test.ts))
   navigates to the origin, wipes `localStorage`/`sessionStorage` and reloads -
   every test starts logged out, independent of order, safe to run in parallel.
2. **Page Objects** ([tests/pages/](tests/pages/)) expose semantic locators
   (`getByRole`, `getByLabel`, `getByPlaceholder`) and actions. They hold no
   assertions; specs hold no raw selectors.
3. **Test data** flows from one source: `js/users.js` → re-exported by
   [tests/fixtures/users.ts](tests/fixtures/users.ts) → imported by specs.
   Credentials are never retyped. `LOGIN-DATA-01` asserts the app authenticates
   against this same list - the app hard-codes its own copy, and if the two
   diverged the whole suite could pass against data the app never reads.
4. **Assertions are web-first** (`await expect(locator).toBeVisible()`,
   `expect.poll` for storage): no `waitForTimeout`, no raised timeouts.

## What the suite verifies

Every test title begins with a case id from
[tests/plans/login-test-cases.md](tests/plans/login-test-cases.md) - the design
document with priorities, steps and a "why it matters" line per case. The failure
in a report maps straight back to its designed case.

| Area | Cases implemented | What is proven |
|---|---|---|
| Login (`e2e/login.spec.ts`) | 10 | all three accounts log in; wrong/unknown/mixed credentials are rejected; failures leave no session; XSS input is never executed |
| Session (`e2e/session.spec.ts`) | 8 | what `localStorage.logged` grants and revokes: survives reload, dies on logout, password never persisted; the client-only trust model is pinned deliberately |
| UI (`e2e/ui.spec.ts`) | 1 | both logout controls exist and are reachable |
| Accessibility (`a11y/`) | 5 | keyboard-only login (WCAG 2.1.1); axe A/AA scans of four distinct page states |

Tiers are declared as tags, not in titles:
`test('LOGIN-001: …', { tag: ['@smoke', '@critical'] }, …)` - `@smoke` is the
core loop, `@critical` guards auth integrity, untagged is regression depth.

## Known defects and expected skips

The plan's §9 documents six confirmed defects (BUG-01…06) found by reading the
source and confirmed at runtime. Tests that document a known defect state the
*correct* behaviour and are marked `test.fixme` with the bug id - never weakened:

- `A11Y-003` / `A11Y-004` are skipped on **BUG-03**: the Logout button fails
  WCAG AA contrast (≈3.96:1 vs required 4.5:1), confirmed by axe at runtime.
  When the bug is fixed, the fixme comes off and the scans become permanent guards.

## CI

[.github/workflows/quality-gate.yml](.github/workflows/quality-gate.yml) - a cheap
gate on pull requests, full verification on master:

| Job | Trigger | Runs |
|---|---|---|
| smoke | every pull request | the `@smoke` tier only |
| e2e | push to master, manual dispatch | all of `tests/e2e` |
| a11y | push to master, manual dispatch | all of `tests/a11y` |

Browsers are cached on the lockfile hash. HTML reports upload as artifacts on
every non-cancelled run (14 days); traces, screenshots and videos only on
failure (7 days). Download from the run page → Artifacts, then
`npx playwright show-report <dir>` / `npx playwright show-trace <trace.zip>`.

## Conventions (enforced, not aspirational)

- Locators by role/label/placeholder; no XPath, no styling-class chains.
- No hard waits, no `networkidle`, no raised timeouts - web-first assertions only.
- Page objects hold no assertions; specs hold no raw selectors.
- Every test starts logged out via the fixture; no test depends on another.
- Never weaken an assertion, add a wait, or edit application source to turn a
  test green - a genuine app defect becomes a bug entry and a `fixme` case.
