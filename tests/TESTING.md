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
A green run reports **89 passed, 0 skipped**: eleven cases document a confirmed
defect and are written with `test.fail()` (see "Known defects" below) - they
genuinely execute and fail on the assertion that proves the bug, and Playwright
counts an expected failure as a pass. None are `test.fixme`, which would abort
the test body and prove nothing.

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
| Login (`e2e/login.spec.ts`) | 36 (`LOGIN-001…047`, `LOGIN-DATA-01`) | all three accounts log in (by click, Enter, and paste); every negative/edge/injection input is rejected identically; error state transitions (shown, cleared, persisted, non-disclosing); no crash on 1000+ char or unicode input; double-submit and 20x-retry are safe |
| Session (`e2e/session.spec.ts`) | 16 (`SESSION-001…016`) | what `localStorage.logged` grants and revokes: survives reload, dies on logout (both entry points), password never persisted, cross-tab/cross-context isolation, the client-only trust model pinned deliberately |
| UI (`e2e/ui.spec.ts`) | 15 (`UI-001…013`, `UI-015…016`) | every visible element, label, and layout claim in the design (320px width, background images, console cleanliness, both logout controls' real reachability) |
| Accessibility (`a11y/`) | 18 (`A11Y-001…008`, `A11Y-010…012`, `A11Y-014…015`, `A11Y-017…019`, `A11Y-021…022`) | axe A/AA scans of four page states; label associations; contrast (heading pass, logout button fail); keyboard operability, tab order, no keyboard trap; autocomplete/title/lang/landmark structure; reflow at 320px and 200% zoom |

Not automated: `LOGIN-039`/`LOGIN-048` (autofill UI, viewport scroll - password-manager and visual judgement calls), `SESSION-017` (blocked storage - needs a special browser profile), `UI-014` (manual viewport inspection), `A11Y-009`/`A11Y-013`/`A11Y-016`/`A11Y-020` (need a real screen reader or human visual judgement) - all `[manual]` in the plan by design, not gaps.

Tiers are declared as tags, not in titles:
`test('LOGIN-001: …', { tag: ['@smoke', '@critical'] }, …)` - `@smoke` is the
core loop, `@critical` guards auth integrity, untagged is regression depth.

## Known defects and expected failures

The plan's §9 documents eight confirmed defects (BUG-01…08) found by reading
the source and confirmed at runtime (BUG-08 live, via the `playwright-test`
MCP browser). Tests that document a known defect state the *correct* behaviour
and use `test.fail(true, 'BUG-xx: ...')` - never weakened, never `test.fixme`
(which would abort the test body and prove nothing). Each genuinely runs and
fails on the exact assertion that proves the bug, so it turns red on its own
the day someone fixes the app - a real regression guard, not a silent skip:

- `UI-002` - **BUG-01**: `.content` stays `display:none`, so the logged-in
  content area never becomes visible.
- `UI-008`, `SESSION-006` - **BUG-02**: `.logout` stays `display:none`, so the
  Sign Out dropdown is never reachable.
- `A11Y-003`, `A11Y-004`, `A11Y-012` - **BUG-03**: the Logout button fails
  WCAG AA contrast (≈3.96:1 vs required 4.5:1), confirmed by axe and by a
  from-scratch relative-luminance calculation.
- `A11Y-007` - **BUG-04**: `outline: none` removes the focus ring from the
  LOGIN button with no compensating style.
- `A11Y-008` - **BUG-05**: `.error-message` has no `role="alert"`, so failed
  logins are never announced to a screen reader.
- `A11Y-010` - **BUG-06**: the user-icon trigger is a bare `<div>` - no role,
  name, or keyboard handler.
- `A11Y-021` - **BUG-07**: none of the six Font Awesome icons carry
  `aria-hidden`.
- `SESSION-006`, `UI-011`'s user-icon half - **BUG-08**: `.user-section` has
  zero rendered size because the Font Awesome kit script 403s, so it has no
  clickable hit area even once BUG-02's CSS is fixed. Any test that must
  interact with it uses `homePage.openUserMenu()`, which dispatches the click
  event directly instead of simulating a real mouse click at real coordinates
  - a genuine `.click()` on a 0×0 element either hangs for the full test
  timeout or throws "outside of the viewport", neither of which is the actual
  defect being tested.
- `A11Y-017` - **FINDING-14**: no `autocomplete` attributes.
- `A11Y-018` - **FINDING-17**: the page title is the generic "Single Page
  Application".

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
