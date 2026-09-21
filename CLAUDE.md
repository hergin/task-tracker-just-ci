# CLAUDE.md

A small task tracker (lists and tasks). It is deliberately unfinished: missing features are the backlog. Build exactly what an issue asks for, nothing more.

## Commands

| Command | What it does |
|---|---|
| `npm run verify` | lint + typecheck + unit tests. **Must pass before any work is considered done.** Needs no network, Java or emulator. |
| `npm run test:rules` | Security Rules tests inside the Firestore emulator (needs Java). **Must also pass when `firestore.rules` or the data shape changes.** |
| `npm run test:e2e` | Playwright acceptance tests against `BASE_URL`, by default the local dev server, which must already be running with seeded emulators |
| `npm run test:e2e:local` | The whole acceptance suite with nothing running: starts and seeds the emulators, starts the dev server, runs the tests, stops everything (needs Java and Playwright's Chromium). **Run it before pushing.** Extra arguments go to Playwright. |
| `npm run emulators` | Starts the Auth and Firestore emulators for the `demo-seed-app` project, with the Emulator UI at http://127.0.0.1:4000. Data is lost when they stop. |
| `npm run seed` | Resets the running emulators to exactly the fixture below. |
| `npm run dev` | Vite dev server at http://localhost:5173, connected to the emulators |
| `npm run lint` | oxlint; warnings fail |
| `npm run typecheck` | `tsc -b` over the app, config, test and script projects |
| `npm run test:unit` | Vitest over `tests/unit/` |
| `npm run build` | typecheck + production build into `dist/` |

## Local development

Everything runs locally on the Firebase emulators; no accounts or secrets. `.env.development` (committed) already points the app at them.

1. `npm run emulators` (keep it running)
2. `npm run seed` (again whenever you want a clean state)
3. `npm run dev`

Sign in with **Sign in with GitHub** (the emulator shows a fake account picker) or with **Test sign-in** as `e2e-owner@e2e.test` / `local-e2e-password`, which shows the fixture data.

## Stack

Vite + React + React Router (SPA) · TypeScript strict · Tailwind (no component library) · Firebase Auth + Firestore + Security Rules · Firebase Hosting · Vitest · Playwright. No server code. No state management library.

## Where things go

| Adding | Location |
|---|---|
| A screen | `src/routes/<Name>.tsx`, registered in `src/router.tsx` |
| A component | `src/components/<Name>.tsx`, one component per file |
| A domain type or field limit | `src/data/types.ts` |
| A query hook or write function | `src/data/<entity>.ts` |
| A React hook with no Firebase in it | `src/hooks/` |
| Pure logic (no Firebase, no React) | `src/lib/`, with a unit test in `tests/unit/` |
| Test-only UI | `src/e2e/`, rendered only behind `VITE_E2E_LOGIN` |
| A Security Rule | `firestore.rules`, with tests in `tests/rules/` |
| An index | `firestore.indexes.json` |
| A build-time variable | `src/env.d.ts`, `.env.example`, and `.env.development` if local dev needs it |
| A maintenance script | `scripts/`, with pure logic in `scripts/lib/` covered by unit tests |

Named exports only, no default exports. Match the existing style: single quotes, no semicolons.

## Data model

```
users/{uid}                      name, image, createdAt
lists/{listId}                   name, ownerId, createdAt
lists/{listId}/tasks/{taskId}    ownerId, title, notes, status, dueDate, assigneeId,
                                 position, createdAt, completedAt
```

Types live in `src/data/types.ts`.

- **Every field is always present.** Optional fields are stored as `null`, never omitted; the rules reject documents with missing or extra fields.
- `status` is `'todo' | 'doing' | 'done' | 'postponed'`. `dueDate` is a `'YYYY-MM-DD'` string with no time zone; "today" is the browser's local date (`toDateKey` in `src/lib/dates.ts`).
- `createdAt` is server time. `completedAt` is set to server time when a task becomes done, kept while it stays done, and cleared when it leaves done: `completedAtChange` in `src/lib/tasks.ts`, enforced identically by the rules. Moving a task to another list writes it again with the dates it already had (`moveTaskToList`), so on create the rules accept any timestamp that is not in the future; every other write sends server time.
- `ownerId` is repeated on every task, so rules can check it and queries can span lists.
- A user profile holds no email (profiles are readable by every signed-in user). Email stays in Firebase Auth. The profile is created or refreshed on every sign-in (`src/data/auth.ts`).
- Field limits are `LIMITS` in `src/data/types.ts`, mirrored in `firestore.rules`. Change both together.

## Reading and writing data

- **Only `src/data/` and `src/lib/firebase.ts` may import Firebase.** Lint enforces this.
- **Reads:** each data module exports a hook built on `useSubscription(key, subscribe)` from `src/hooks/useSubscription.ts`: a realtime `onSnapshot` subscription returning `{ status: 'loading' }` or `{ status: 'ready', data }`. The `key` names everything the query depends on. Unexpected read errors are thrown to the route error boundary; map expected ones inside `subscribe` (see `useList`, which turns `permission-denied` into `null`, shown as "List not found").
- **Writes:** async functions in `src/data/` that validate input with `src/lib/` helpers (such as `requiredText`), then run the Firebase call inside `attempt()` from `src/data/errors.ts`, which returns `Result<T>`. Components call them through `useAction(fn)` from `src/hooks/useAction.ts` and render `error` with `<FormError>`.
- **Errors:** expected failures are `Result` errors rendered inline next to the control that caused them. Unexpected errors throw and reach `src/components/RouteError.tsx`. Never swallow an error.
- **Unconfirmed writes are visible.** A hook can report Firestore's `hasPendingWrites` (see `useTasks`, which marks each task `saving`); a screen that shows changes before the server confirms them must show that it is still saving.
- **A write may read what it needs** with a one-off query inside `src/data/` (for example `deleteList` loads the list's tasks). Components never read outside the subscription hooks.
- **Deleting a list deletes its tasks too** (`deleteList`): Firestore never deletes a subcollection by itself, and leftover tasks would still show up in queries across lists.
- **Documents → types:** `src/data/converters.ts`.
- **Every query filters with `where('ownerId', '==', uid)`.** Security Rules are not filters: a query without that clause is rejected outright, even if every matching document is yours.
- **Queries only filter on `ownerId`. Sort and filter the results in code** with the helpers in `src/lib/` (`compareLists`, `compareTasks`, `isOpen`, `isDueByToday`, `groupDueByToday`). Adding `orderBy` or another `where` needs an index in `firestore.indexes.json`, and a new index only works once it is deployed and built.
- A change to data shape or queries also changes `firestore.rules`, `firestore.indexes.json` and `tests/rules/` in the same PR.

## Auth

- `AppShell` shows the sign-in screen to signed-out visitors at any URL; there is no sign-in route. Inside the shell, get the user with `useCurrentUser()`. Only `AppShell` uses `useAuthState()`.
- Humans sign in with GitHub. The test sign-in form (Email/Password, `src/e2e/TestSignIn.tsx`) is rendered only when built with `VITE_E2E_LOGIN=true`: local development and test builds. **Never import anything from `src/e2e/` except in `SignIn.tsx` behind that flag.** Production builds must not contain its `data-e2e-login` marker.

## Seed fixture

`scripts/fixture.ts`, written by `npm run seed`. Fixed ids and timestamps; all due dates are in the past, so dated open tasks are always overdue. **Treat the fixture as read-only in tests:** create your own data for anything a test changes.

**Users:** `e2e-owner` "E2E Owner" (the test account, `e2e-owner@e2e.test`) · `e2e-other` "E2E Other" (profile only, no sign-in)

**Lists:**

| id | name | owner |
|---|---|---|
| `list-groceries` | Groceries | e2e-owner |
| `list-work` | Work | e2e-owner |
| `list-empty` | Empty list | e2e-owner |
| `list-other-private` | Private list of another user | e2e-other |

**Tasks** (in display order within each list):

| id | list | title | status | due | other |
|---|---|---|---|---|---|
| `task-milk` | Groceries | Buy milk | todo | 2026-01-12 | |
| `task-bread` | Groceries | Buy bread | doing | | |
| `task-eggs` | Groceries | Buy eggs | done | | completed 2026-01-02 |
| `task-invoices` | Work | Send invoices | doing | 2026-01-10 | |
| `task-report` | Work | Write quarterly report | todo | 2026-01-15 | notes "Include the Q4 numbers.", assigned to e2e-other |
| `task-archive` | Work | Archive old files | done | 2026-01-05 | completed 2026-01-05 |
| `task-plan` | Work | Plan next year | todo | | |
| `task-private` | Private list of another user | Private task of another user | todo | | owned by e2e-other |

## Tests

- **Unit** (`tests/unit/`): pure logic. No network, no emulator, no DOM.
- **Rules** (`tests/rules/`): every Security Rule, against the Firestore emulator. Each test starts from an empty database; set up state with `seed()` and act as a user with `dbAs()`, both from `tests/rules/setup.ts`. Test both what's allowed (`assertSucceeds`) and what's refused (`assertFails`).
- **Acceptance** (`tests/acceptance/`): behaviour, driven through the UI of a running app. Rules below.

## Acceptance tests

`tests/acceptance/`, run with `npm run test:e2e`. The same tests run unmodified against the local dev server and against a deployment (`BASE_URL` plus `E2E_PASSWORD`). **Off limits to implementation work: never edit files in `tests/acceptance/` while implementing a feature.**

- **Drive the UI only.** Never import from `src/` or `scripts/`, never touch Firebase. Use role-based locators (`getByRole`, `getByLabel`) and web-first assertions (`await expect(locator)…`). No `waitForTimeout`, no `.only`. `npm run verify` enforces these (`tests/unit/acceptance-conventions.test.ts`).
- **Every test starts signed in as `e2e-owner`**, from the session saved by `auth.setup.ts`. For signed-out behaviour use `test.use({ storageState: { cookies: [], origins: [] } })`. Never write another login flow.
- **Tests share one database, run in parallel, and run again without reseeding.** Read the fixture, never change it. Give anything a test creates a `uniqueName()`. Never assert totals that other tests can change.
- **Never assert position among data other tests can create:** not the first heading on `/today`, the nth search result, or the order of everything on a shared page, since another test's data can land anywhere in it. Filter to the test's own items or the fixture's first, e.g. `groups.filter({ hasText: /^(Work|Groceries)$/ })`, and prefer data that sorts after the fixture's. A test that breaks this and gets in another test's way is fixed in a pull request of its own.
- **Scope locators** to the region under test, e.g. `page.getByRole('list', { name: 'Tasks' }).getByRole('listitem')`.
- **Every literal locator passes `exact: true`:** `page.getByRole('list', { name: 'Due in Work', exact: true })`, `page.getByText('No tasks yet.', { exact: true })`, `page.getByLabel('Notes', { exact: true })`. Playwright matches a name, text or label as a substring unless told otherwise, so a literal also matches every longer name that contains it, and other tests' data produces such names: lists named after the fixture's, such as `uniqueName('Groceries run')` (#86), or after UI wording, such as `uniqueName('List A')` against a `Delete list` button (#102). `npm run verify` fails a string or template literal without it; a regex or a variable holding a unique name needs none.
- **After a write, wait for proof the server saved it before reloading or navigating away.** The app shows that proof: forms clear or close only after the server confirms (`createList()`, `addTask()`), a "Deleted …" notice appears after a delete, and on a list page "Saving…" is shown while any task change is unconfirmed (`expectTasksSaved()`). The helpers wait up to 30 s for that proof, since a deployment's database can be slow to confirm; an assertion in a spec that waits for server confirmation itself passes `SERVER_CONFIRMED` (`toBeVisible(SERVER_CONFIRMED)`). Every other assertion keeps the default wait: 10 s on the local emulators, 20 s against a deployment, whose database now and then pauses for longer than 10 s even for a page's first read (`DEFAULT_WAIT_MS` in `tests/acceptance/support/env.ts`). One action waits 10 s locally and 30 s against a deployment (`ACTION_WAIT_MS`), and a whole test gets 30 s locally and 120 s against a deployment (`TEST_TIMEOUT_MS`), so a single slow confirmation can't run a test out of time and fail the run as flaky (#121). All helpers are in `tests/acceptance/support/data.ts`.
- **Assert absence (`toHaveCount(0)`) only after asserting something that proves the data has loaded**, or it passes without checking anything.
- **Dates:** tests run in the UTC time zone; compute "today" in UTC.
- Shared steps and settings go in `tests/acceptance/support/`.

## Git and CI

- Branches: `feat/<issue>-<slug>`, `fix/<issue>-<slug>`, `chore/<slug>`.
- Commits: Conventional Commits, e.g. `feat: add status filter`.
- PR body includes `Closes #<issue>`.
- Changes land as squash-merged pull requests. The squash commit takes the pull request's title, so write PR titles as Conventional Commits.
- CI (`.github/workflows/ci.yml`) runs on every pull request and push to `main`: `checks` (`npm run verify` and `npm run test:rules`) and `acceptance` (`npm run test:e2e:local`). Nothing is deployed.
- New issues use the template in `.github/ISSUE_TEMPLATE/feature.yml`: what a user should be able to do, plus "done when" conditions checkable in a browser.
