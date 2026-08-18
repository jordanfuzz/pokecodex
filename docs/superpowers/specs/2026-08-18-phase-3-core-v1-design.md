# Phase 3 design — Core issues and planned v1

Approved design for roadmap Phase 3 (2026-08-18). Scope was re-evaluated
against the old MVP definition per [ROADMAP.md](../../ROADMAP.md) phase 3 and
the "Core v1 issues" section of [BACKLOG.md](../../BACKLOG.md).

## v1 definition

v1 is outcome-based, from the old MVP definition:

- **A. Completion checkboxes are correct under all rules** (including per-row
  overrides).
- **B. The box viewer works.**
- **C. The app is stable enough to reset Jordan's user data and start
  tracking for real.**

"Gen 1 sources finished" remains Phase 4. Resetting user data is a post-v1
operational step, not code in this phase.

## Hard requirements

1. **Batch completion at page load.** Every pokemon row's completion state
   must arrive with the initial `GET /api/all-pokemon` response. No per-row
   queries, no lazy computation on row-open. (A previous refactor broke this
   by pulling checks into per-pokemon queries — top-level checkboxes only
   updated when a row was opened. That is a dealbreaker.)
2. **No new joins on the perf-sensitive main query** in
   `pokemon-repository.js` (documented history: a third join took it from
   ~70ms to ~300ms). New data (overrides) is fetched with one additional bulk
   query per request and merged in JS.
3. **The API is the single source of truth for "what is required".** The box
   view must not re-derive requirements with its own logic.

## In scope

### 1. Auth hardening (first, it changes every route signature)

Today only `GET /` uses `authCheck` (`api/src/app.js:93,104`); every data
route trusts a client-supplied userId. Changes:

- Mount `authCheck` on all `/api` data routers.
- Handlers take the userId from `req.user`, never from query/body.
- UI stops sending userIds in requests.
- Add minimal JSON error-handling middleware so thrown repository errors
  return JSON instead of Express's HTML stack-trace page.

### 2. New-user onboarding chain

- `users-routes.js:8`: distinguish "no rules yet" (return empty rules, 200)
  from query failure (500).
- `pokemon-repository.js:34`: don't throw for a userId with no rules row;
  treat as empty rules.
- `home.jsx:42` (`loadUserData`): catch rejections so one failed call doesn't
  abandon the rest of page load.

### 3. Completion engine (architectural core)

New API-side module owning required-entry expansion:

- Pure function: `(pokemon's sources, user rules, user overrides, gen
  context) -> requiredSources[]`, each entry carrying `sourceId`, `name`,
  `type`, applicable gens, `replaceDefault`.
- `isComplete` = every required entry satisfied by the user's owned sources,
  matched **per source row** (fixes the variant ANY-vs-ALL bug — one Unown
  letter no longer completes the record; `pokemon-utils.js:14-47`).
- Evolution-inheritance semantics preserved: only special classes (in-game
  trades, side-game trades, unique sources) can be satisfied by an evolved
  form, as today (`pokemon-utils.js:26-41`).
- Computed inside `getAllForUser` from the existing aggregates
  (`sources_by_type`, `users_sources_by_gen`) plus one bulk overrides query.
- Payload ships `requiredSources` per pokemon; `home.jsx` keeps consuming
  `isComplete` unchanged.

### 4. Personal source overrides (bidirectional)

- Table: `users_source_overrides (id uuid pk, user_id fk users, source_id fk
  sources, is_required boolean, unique(user_id, source_id))` — the
  commented-out pre-hiatus stub (`adhoc/scripts/reset-schema.sql:51-55`)
  completed with `user_id`.
- Routes under `authCheck`: `PUT /api/user/source-override` (upsert),
  `DELETE /api/user/source-override/:sourceId`. Both return the refreshed
  pokemon payload so row checkboxes update immediately.
- Semantics: `is_required = true` forces a source excluded by general rules
  to be required for that row; `is_required = false` excludes a normally
  required source for that row. Absent row = follow general rules.
- UX: clicking a source pill in `sources-list.jsx` toggles its override
  (default -> overridden -> default). Overridden pills get a distinct visual
  state (badge/outline) visible at a glance.
- Box view respects overrides automatically because it renders from
  `requiredSources`.

### 5. Box view consumes `requiredSources`

- Replace the hand-rolled fan-out switch (`box-view.jsx:97-213`) with rows
  rendered from the API's `requiredSources` (filtered by the selected game's
  gen/dex rules, which stay client-side inputs to display).
- Forced types with no current `case` (e.g. shiny) get box rows for free.
- Checklist row keys move from `id` / `id:variantName` (mixed number/string)
  to a stable `id:sourceId` scheme; one-time migration of existing
  `users_box_data.complete_records` values.
- Box-view bug fixes:
  - Guard missing `users_box_data` rows (`box.jsx:38`,
    `box-checklist.jsx:25`).
  - Add `usersRules` to the filter effect deps (`box-view.jsx:54`).
  - Gens 2–3 must not bridge caught-availability (no transfer path).
  - Gen change resets `selectedBox` to 1; give the game `<select>` a `value`
    so it can't drift (`box-view.jsx:219,240`).
  - Logged-out `/box-view` redirects to `/login` (move the `shouldRedirect`
    check above the null-data return, `box-view.jsx:228-230`).

### 6. Evolve integrity

- Copy notes to the evolved record on evolve.
- Evolving a shiny produces a shiny evolution; shiny tag not grayed out
  after evolve; no double `evolved` tags.

### 7. Date picker replacement

- Replace MUI `DateTimePicker` with a styled native
  `<input type="datetime-local">` in `catch.jsx`.
- Remove `@mui/material`, `@mui/x-date-pickers`, `@emotion/react`,
  `@emotion/styled` from `app/package.json`; remove the
  `LocalizationProvider`/`AdapterLuxon` wrapper in `index.jsx` and the
  `ThemeProvider`/`darkTheme` in `catch.jsx`. (MUI has no other consumers —
  verified.) Luxon stays for date formatting.
- Fixes subsumed: white-on-white text, dead underline rule, null-on-clear
  crash (`catch.jsx:194`). Delete dead SCSS (`catch.scss:83-103` dead rules).

### 8. Remaining stability/UX bugs

- `catch.jsx:37` hook-order bug: move the early return below the hook.
- `catch.jsx:46` unchecked `.find().id` for a game version not in the list.
- Unhandled 401/failed-fetch rejections: `login.jsx:12`, `home.jsx:42`,
  `box-view.jsx:36`, `sources.jsx:36`.
- Uncontrolled->controlled input warnings in `rules.jsx` (init `ruleState`
  to defaults instead of null).
- Wrong-pokemon source flash: replace array-index React keys with stable ids
  (`home.jsx:264`, `sources-list.jsx:353`, `box.jsx:64`,
  `box-checklist.jsx:66`, `sources.jsx:90`).
- Complete source pills showing in gens they shouldn't (falls out of
  gen-aware required-entry expansion; verify explicitly).
- Multiselect source dropdown closing itself.
- Game list dropdown sort order.

### 9. Test runner swap + TDD

- Replace Mocha with Node's built-in `node:test` runner (`npm test` =
  `node --test`). Mocha was never a deliberate choice, is the sole source of
  the API's 3 `npm audit` findings, and the existing suite is two files plus
  setup. supertest is unaffected.
- API work in this phase is test-driven. The suite gains:
  - a login helper that establishes a session through the dev-login route
    (tests already run with the dev stack up), since all routes now require
    auth;
  - a completion-engine matrix: rules x variants x overrides x evolution
    inheritance x gen scoping;
  - onboarding regression tests (new user with no rules row);
  - auth tests (401 without session; userId taken from session not query).

## Out of scope (deferred)

- Nincada double-evolution and conditional evolutions (Basculin, Salandit)
  — evolution *modeling* tied to Phase 4 source data; fast-follow.
- Text input length limits.
- Everything in BACKLOG "Features", "Bonus ideas", "Big future ideas".
- Tech debt not listed above (transactions, response-block dedup, Sass
  `@use` migration, code splitting, `home.jsx` decomposition) — unless a
  Phase 3 change happens to touch it trivially.
- Gen 1 source data (Phase 4).

## Sequencing

1. Auth hardening + JSON error middleware + test-runner swap (foundation)
2. Onboarding fixes
3. Completion engine + `isComplete` fix
4. Overrides (table, routes, pill UX)
5. Box view on `requiredSources` + box bug fixes + `complete_records`
   migration
6. Evolve integrity fixes
7. Date picker replacement (MUI removal)
8. Remaining stability/UX bugs
9. Full pass: tests green, manual smoke of list + box + catch editor flows

Work lands on a `phase-3` branch in per-chunk commits. Data-touching
migrations (`users_source_overrides`, `complete_records` key migration) get a
fresh production dump first, per standing rule.
