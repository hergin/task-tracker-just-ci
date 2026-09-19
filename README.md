# Seed app

A small task tracker (lists and tasks) built with Vite, React, TypeScript, Tailwind and Firebase (Auth, Firestore, Security Rules). It is deliberately unfinished: missing features are the backlog.

Conventions for anyone changing the code, human or agent: [CLAUDE.md](CLAUDE.md).

## Requirements

- Node 22 (see `.nvmrc`) and npm
- Java, for the Firebase emulators (tested with Java 26). The first emulator run downloads the emulator files.

## Run it locally

Everything runs on the Firebase emulators under a demo project: no Firebase account, no secrets. Use three terminals:

```bash
npm ci
npm run emulators   # terminal 1: Auth + Firestore emulators, Emulator UI at http://127.0.0.1:4000
npm run seed        # terminal 2: load the fixture data (re-run any time to reset)
npm run dev         # terminal 3: the app at http://localhost:5173
```

Sign in with **Sign in with GitHub** (the emulator shows a fake account picker, so any name works) or with **Test sign-in** as `e2e-owner@e2e.test` / `local-e2e-password` to see the fixture lists.

## Acceptance tests

Playwright tests in `tests/acceptance/` drive the app through its UI. They never start a server. With the emulators seeded and the dev server running (above):

```bash
npx playwright install chromium   # once
npm run test:e2e
```

With nothing running, one command does everything: it starts and seeds the emulators, starts the dev server, runs the suite, and stops it all. It needs Java, and the ports 8080, 9099 and 5173 free.

```bash
npm run test:e2e:local
```

## Scripts

| Script | What it does |
|---|---|
| `dev` | Vite dev server, connected to the emulators |
| `emulators` | starts the Auth and Firestore emulators (data is lost when they stop) |
| `seed` | resets the running emulators to the fixture in `scripts/fixture.ts` |
| `build` | typecheck + production build into `dist/` |
| `preview` | serve the production build locally |
| `lint` | oxlint; warnings fail |
| `typecheck` | `tsc -b` |
| `test:unit` | Vitest over `tests/unit/` |
| `test:rules` | starts the Firestore emulator, runs `tests/rules/` against `firestore.rules`, stops the emulator |
| `test:e2e` | Playwright acceptance tests against `BASE_URL` (default: the local dev server, which must be running) |
| `test:e2e:local` | the whole acceptance suite with nothing running: emulators, seed, dev server, tests, then everything stops |
| `verify` | `lint` + `typecheck` + `test:unit` |

## Continuous integration

[.github/workflows/ci.yml](.github/workflows/ci.yml) runs on every pull request and every push to `main`: `npm run verify` and `npm run test:rules` in one job, `npm run test:e2e:local` in another. Everything runs on the emulators, so it needs no secrets. Nothing is deployed.

## Environment variables

Local development and CI need none: [.env.development](.env.development) is committed and points at the emulators. [.env.example](.env.example) documents every variable. To run the acceptance tests against a deployment, set `BASE_URL` to its URL and `E2E_PASSWORD` to the test account's password.

## Known warnings

- `npm audit` reports moderate issues in dependencies of `firebase-tools` (the Firebase CLI). It's a local and CI tool and never ships in the app bundle. `npm audit fix --force` would downgrade it to an old major version, so leave it until `firebase-tools` updates them.
- `vite build` warns that the main chunk is over 500 kB. That's the Firebase SDK; code-splitting isn't worth it for this app yet.

