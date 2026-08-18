# Phase 2 — Audit-driven cleanup: design

Approved design for roadmap Phase 2 (verify Windows build/tests, dependency
sweep, code-quality pass). Planned 2026-08-17 while the Bulbapedia fetch
script was running; the constraints section exists because of that.

## Decisions made during brainstorming

- Execute the safe (host-side) work now; only container rebuilds wait for the
  fetch to finish.
- Dependency policy: **everything to latest**, including majors (Express 5,
  MUI 9, react-router 8, Vite 7, lucide-react 1.x, dotenv 17).
- Code-quality pass covers **app/ and api/ only** (adhoc/ is one-off tooling
  that phase 4 reworks).
- Fix policy: **fix trivial findings inline**; everything needing judgment is
  recorded in BACKLOG.md.

## Constraints

- **The Bulbapedia fetch runs inside the adhoc container.** Until it
  completes, nothing may recreate or rebuild compose containers: no
  `npm start` / `npm stop` at the repo root, no `docker compose up/down/build`
  against `compose.dev.yml`. All Phase 2 work before Stage 4 is host-side.
- **Every push to master deploys to production**
  (`.github/workflows/main.yml`). All work lands on the `phase-2-audit`
  branch; merge to master only after Stage 4 verification.
- Host `npm install` in `app/`, `api/`, `adhoc/` is safe: compose masks
  `/app/node_modules` with an anonymous volume, so host installs never reach
  the running containers.
- Editing `adhoc/package.json` is safe while the fetch runs — the script
  already has its deps loaded; the adhoc image rebuild happens in Stage 4.

## Stage 0 — Windows baseline

Establish green *before* changing anything, so later breakage is attributable
to a specific change and not to Windows.

- Host `npm install` in `app/` and `api/`.
- Run `api` tests (`cd api && npm test` — hits compose Postgres on
  localhost:5432, host-side, container-safe).
- Run `app` build (`vite build`).
- Stand up the UI verification harness: host Vite dev server on **:3001**
  with `/api` proxied to the api container on :3003; verify via dev-login.
- Fix any Windows-specific breakage found (line endings, paths, etc.).

## Stage 1 — Minor/patch sweep

One commit bumping all minor/patch versions across `app/`, `api/`, `adhoc/`
(react 19.2.8, axios, sass, pg, etc.). Verify with api tests + vite build.

## Stage 2 — Major migrations

One commit per major, ordered cheap-to-risky so easy wins land even if a
later migration stalls:

1. dotenv 16 → 17 (api + adhoc)
2. Vite 6 → 7 (+ @vitejs/plugin-react as required)
3. lucide-react 0.x → 1.x
4. Express 4 → 5 (api)
5. react-router 7 → 8
6. @mui/material 7 → 9 and @mui/x-date-pickers 8 → 9

Verification per major: api majors → test suite; UI majors → `vite build`
plus eyes-on smoke test through the :3001 harness (list view, box view,
rules, date picker, evolve flow).

**Bail-out rule:** if a migration balloons past reasonable effort, revert its
commit, record in BACKLOG.md what the migration needs, and continue. The
phase does not stall on any single major.

Known context: BACKLOG.md already floats replacing the MUI date picker; if
the x-date-pickers 9 migration is where MUI pain concentrates, that is a
candidate for the bail-out rule with a "replace instead of migrate" note.

## Stage 3 — Code-quality pass

After migrations, so findings reflect final code. Scope: `app/src`, `api/src`.

- Trivial mechanical findings (dead code, unused imports, stale root `test`
  script referencing mocha with no dependency) → fixed inline in a cleanup
  commit.
- Judgment-required findings → BACKLOG.md, placed in its existing sections
  and deduped against current entries.

## Stage 4 — Post-fetch verification (deferred)

Only after the Bulbapedia fetch completes:

- Rebuild and recreate all containers:
  `docker compose -f compose.dev.yml up -d --build --force-recreate`.
- Full-stack smoke test through :3000 with real container deps; re-run api
  tests.
- Merge `phase-2-audit` → master; watch the production deploy.
- Tick the Phase 2 checkboxes in ROADMAP.md.

## Exit criteria

- Build + tests green on Windows.
- All dependencies at latest, or explicitly deferred in BACKLOG.md with
  reasons.
- BACKLOG.md updated with code-quality findings.
- Rebuilt dev stack verified end-to-end; master deployed clean.
