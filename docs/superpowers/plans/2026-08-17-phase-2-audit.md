# Phase 2 Audit-Driven Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify the pokecodex build/tests on Windows, bring every dependency to latest (majors included), and run a code-quality pass whose findings land in BACKLOG.md.

**Architecture:** No production code is being designed here — this is an audit/migration phase. Work proceeds host-side on the `phase-2-audit` branch in ordered stages (baseline → minors → majors cheap-to-risky → quality pass), each verified by the api test suite, `vite build`, and a host-side Vite dev server on :3001 proxying to the running api container. Container rebuilds are deferred to a final post-fetch task.

**Tech Stack:** React 19 + Vite (app/), Express + Passport ESM (api/), mocha + supertest (api tests), Docker Compose dev stack (already running — do not touch), Postgres 17 on localhost:5432.

## Global Constraints

- **NEVER recreate/rebuild/stop compose containers until Task 11.** The Bulbapedia fetch is running inside the `pokecodex-adhoc-1` container. Forbidden until then: `npm start`/`npm stop` at repo root, `docker compose ... up/down/build/restart` against `compose.dev.yml`. `docker ps` / `docker logs` are fine.
- **Never push to master** — every push to master deploys to production (`.github/workflows/main.yml`). All commits go on `phase-2-audit`. Do not push the branch either unless asked; merge happens in Task 11 after sign-off.
- Spec: `docs/superpowers/specs/2026-08-17-phase-2-audit-design.md`.
- All shell commands below are Git Bash (POSIX) syntax, run from `C:/Users/jorda/repos/pokecodex` unless a `cd` is shown.
- Host `npm install` in `app/`, `api/`, `adhoc/` is safe (compose masks `/app/node_modules` with an anonymous volume).
- One commit per task unless a task says otherwise. Commit messages end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- The api test suite requires the compose Postgres on localhost:5432 — the running stack provides it; if tests fail with connection errors, STOP and report (do not restart anything).
- Several majors (react-router 8, MUI 9, lucide 1.x) postdate the model knowledge cutoff — the migration tasks REQUIRE reading the official upgrade guide (WebFetch step included) before editing code. Do not migrate from memory.
- Bail-out rule (from spec): if a major migration balloons, `git revert` its commits (or reset the uncommitted work), record what it needs as a BACKLOG.md entry under "Tech debt", and continue to the next task.

---

### Task 1: Windows baseline — install, test, build

**Files:**
- No source changes. Creates `app/node_modules/`, refreshes `api/node_modules/`.

**Interfaces:**
- Produces: a recorded green baseline (api tests pass, `vite build` succeeds) that later tasks compare against.

- [ ] **Step 1: Install api deps on host**

Run: `cd api && npm install`
Expected: completes without errors (warnings OK).

- [ ] **Step 2: Run api tests for baseline**

Run: `cd api && npm test`
Expected: `2 passing` (the two dev-login tests). If failing with DB connection errors, the compose stack isn't reachable — STOP and report. If failing for a Windows-specific reason, fix that before proceeding and commit the fix separately with message `fix: <windows issue> so api tests run on Windows`.

- [ ] **Step 3: Install app deps on host**

Run: `cd app && npm install`
Expected: completes; `app/node_modules/` now populated.

- [ ] **Step 4: Run production build for baseline**

Run: `cd app && npm run build`
Expected: `vite build` finishes with `✓ built in ...` and outputs to `app/build/`. Record any warnings verbatim (they become comparison points after the Vite 7 bump).

- [ ] **Step 5: Commit (only if fixes were needed)**

If Steps 2/4 required Windows fixes, they were committed in place. If nothing changed, there is nothing to commit — note "baseline green, no changes" and move on.

---

### Task 2: Host UI verification harness on :3001

**Files:**
- Modify: `app/vite.config.js`

**Interfaces:**
- Produces: `npm run dev:host` workflow used by Tasks 5, 6, 8, 9 for smoke tests — Vite on http://localhost:3001 proxying `/api` to the api container on localhost:3003.

- [ ] **Step 1: Make the proxy target and port overridable**

Replace `app/vite.config.js` with:

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// API_PROXY_TARGET lets a host-side dev server (outside compose) reach the
// api container via its published port instead of the compose DNS name.
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: Number(process.env.UI_PORT) || 3000,
    proxy: {
      '/api': {
        target: process.env.API_PROXY_TARGET || 'http://api:3003',
        changeOrigin: true,
      }
    }
  },
  build: {
    outDir: 'build'
  }
})
```

- [ ] **Step 2: Add a host dev script**

In `app/package.json` scripts, add:

```json
"dev:host": "cross-env-shell UI_PORT=3001 API_PROXY_TARGET=http://localhost:3003 vite"
```

Do NOT add cross-env as a dependency — instead use plain env in Git Bash: if `cross-env-shell` is unavailable, set the script to `"dev:host": "vite"` and always launch it as
`UI_PORT=3001 API_PROXY_TARGET=http://localhost:3003 npm run dev:host` from Git Bash. Prefer the plain-env form (YAGNI — no new dependency).

- [ ] **Step 3: Verify the running compose UI is unaffected**

Run: `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000`
Expected: `200` (container UI still uses defaults 3000 / `http://api:3003`).

- [ ] **Step 4: Smoke-test the harness**

Run (background): `cd app && UI_PORT=3001 API_PROXY_TARGET=http://localhost:3003 npm run dev:host`
Then browse to `http://localhost:3001/api/auth/dev-login` — expect a 302 into the app, then the pokemon list renders logged in. Stop the dev server after verifying.

- [ ] **Step 5: Commit**

```bash
git add app/vite.config.js app/package.json
git commit -m 'Make Vite port/proxy overridable for host-side dev

Lets a host Vite server on :3001 proxy to the api container while the
compose stack keeps :3000. Needed to smoke-test UI dependency majors
without rebuilding containers mid-Bulbapedia-fetch.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>'
```

---

### Task 3: Minor/patch dependency sweep

**Files:**
- Modify: `app/package.json`, `app/package-lock.json`, `api/package.json`, `api/package-lock.json`, `adhoc/package.json`, `adhoc/package-lock.json`

**Interfaces:**
- Produces: all non-major versions at latest; the version floor Tasks 4–9 build on.

- [ ] **Step 1: Bump minors/patches in api**

Run: `cd api && npm update --save`
Expected: `pg` moves to 8.23.x; express stays 4.x (majors untouched). Confirm with `npm outdated` — remaining rows should be majors only (dotenv, express).

- [ ] **Step 2: Run api tests**

Run: `cd api && npm test`
Expected: `2 passing`.

- [ ] **Step 3: Bump minors/patches in app**

Run: `cd app && npm update --save`
Expected: react/react-dom → 19.2.8, axios → 1.19.x, sass → 1.102.x, @mui/material → 7.3.11, @mui/x-date-pickers → 8.29.x, react-router → 7.18.x. Remaining `npm outdated` rows should be majors only (@mui/*, react-router, lucide-react, and vite/@vitejs/plugin-react if listed).

- [ ] **Step 4: Build and quick smoke**

Run: `cd app && npm run build`
Expected: build succeeds. Then repeat the Task 2 Step 4 smoke test briefly (dev-login, list renders).

- [ ] **Step 5: Bump minors/patches in adhoc (host lockfile only)**

Run: `cd adhoc && npm install && npm update --save`
Expected: axios/pg/pokedex-promise-v2 current; dotenv left at 16.x. No verification possible until the container rebuild (Task 11) — that is expected and fine; the running fetch is unaffected (its deps are already loaded in the container volume).

- [ ] **Step 6: Commit**

```bash
git add app/package.json app/package-lock.json api/package.json api/package-lock.json adhoc/package.json adhoc/package-lock.json
git commit -m 'Bump all minor/patch dependency versions

Phase 2 sweep, stage 1 of 2. Majors follow one commit each.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>'
```

---

### Task 4: dotenv 16 → 17 (api + adhoc)

**Files:**
- Modify: `api/package.json` + lock, `adhoc/package.json` + lock
- Call sites: `api/config.js:1-2`, `api/test/setup.js:4-7`, `adhoc/config.js:1-2`

**Interfaces:**
- Consumes: green baseline from Task 3.

- [ ] **Step 1: Check the changelog for breaking changes**

WebFetch `https://github.com/motdotla/dotenv/blob/master/CHANGELOG.md` and read the 17.0.0 entry. Known at cutoff: v17 is a small major (Node version floor + tips logging on `config()`), but verify against the actual changelog.

- [ ] **Step 2: Install**

Run: `cd api && npm install dotenv@latest && cd ../adhoc && npm install dotenv@latest`

- [ ] **Step 3: Apply any required call-site changes**

The three call sites are plain `dotenv.config()` / `dotenv.config({ path })`. If the changelog requires nothing, change nothing. If v17 logs an unwanted startup banner, suppress it at each call site per the changelog's documented option (e.g. `dotenv.config({ quiet: true })` — use the exact option name the changelog gives).

- [ ] **Step 4: Verify**

Run: `cd api && npm test`
Expected: `2 passing`, and no unexpected new console noise in test output.

- [ ] **Step 5: Commit**

```bash
git add api/package.json api/package-lock.json adhoc/package.json adhoc/package-lock.json api/config.js api/test/setup.js adhoc/config.js
git commit -m 'Upgrade dotenv to v17 in api and adhoc

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>'
```

(Only add the config files if they actually changed.)

---

### Task 5: Vite 6 → 7 (+ @vitejs/plugin-react)

**Files:**
- Modify: `app/package.json` + lock; possibly `app/vite.config.js`

**Interfaces:**
- Consumes: `dev:host` harness from Task 2.

- [ ] **Step 1: Read the migration guide**

WebFetch `https://vite.dev/guide/migration` (v7 guide). Known at cutoff: Node 20.19+/22.12+ required (host runs Node 24 — fine), default browser target changed to `baseline-widely-available`, no `vite.config` changes needed for a setup this simple — but verify.

- [ ] **Step 2: Install**

Run: `cd app && npm install -D vite@latest @vitejs/plugin-react@latest`

- [ ] **Step 3: Build**

Run: `cd app && npm run build`
Expected: success. Compare warnings against the Task 1 baseline; investigate anything new.

- [ ] **Step 4: Smoke test dev server**

Run: `cd app && UI_PORT=3001 API_PROXY_TARGET=http://localhost:3003 npm run dev:host`, dev-login at :3001, confirm list view renders and hot reload works (touch a `.jsx` file, see it update). Stop the server.

- [ ] **Step 5: Commit**

```bash
git add app/package.json app/package-lock.json app/vite.config.js
git commit -m 'Upgrade Vite to v7

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>'
```

---

### Task 6: lucide-react 0.x → 1.x

**Files:**
- Modify: `app/package.json` + lock
- Call site: `app/src/components/home/sources-list/sources-list.jsx:5` (`import { ArrowBigUpDash, Check } from 'lucide-react'`)

- [ ] **Step 1: Check for renames**

WebFetch the lucide v1 release notes (`https://github.com/lucide-icons/lucide/releases`) and check whether `ArrowBigUpDash` or `Check` were renamed/removed in 1.x.

- [ ] **Step 2: Install and fix the single import if needed**

Run: `cd app && npm install lucide-react@latest`
If either icon was renamed, update the one import line accordingly.

- [ ] **Step 3: Verify**

Run: `cd app && npm run build`
Expected: success (a removed icon would fail the build). Smoke: the up-arrow (evolve) and check icons render in the sources list at :3001.

- [ ] **Step 4: Commit**

```bash
git add app/package.json app/package-lock.json app/src/components/home/sources-list/sources-list.jsx
git commit -m 'Upgrade lucide-react to v1

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>'
```

---

### Task 7: Express 4 → 5 (api)

**Files:**
- Modify: `api/package.json` + lock
- Review for breakage: `api/src/app.js`, `api/src/index.js`, all `api/src/**/*-routes.js` (auth, game-data, pokemon, users-pokemon, sources, users)

- [ ] **Step 1: Read the migration guide**

WebFetch `https://expressjs.com/en/guide/migrating-5.html`. Key knowns at cutoff: path-to-regexp v8 route syntax (`*` wildcards must be named, `?`/`+` modifiers removed), `res.status()` rejects non-integers, `req.query` is a getter (still object), removed `app.del`/`res.sendfile` aliases, `express.urlencoded` extended defaults to false. Verify all against the guide.

- [ ] **Step 2: Audit routes against the breaking-change list**

Grep every route path in `api/src/**/*-routes.js` for patterns Express 5 breaks: `grep -rn "\.(get\|post\|put\|patch\|delete\|use)(" api/src --include='*-routes.js'`. This codebase uses plain literal paths mounted under `/api` (no regex/wildcard routes seen in `app.js`), so expect no changes — but confirm each path.

- [ ] **Step 3: Install**

Run: `cd api && npm install express@latest`

- [ ] **Step 4: Run tests**

Run: `cd api && npm test`
Expected: `2 passing`. The dev-login tests exercise the full middleware chain (json, cookie-session, passport session, redirect), which covers the riskiest Express 5 surface.

- [ ] **Step 5: Manual endpoint spot-check through the harness**

With the :3001 harness up and dev-logged-in, exercise a data route from the browser session (load the pokemon list → hits `/api` pokemon/sources routes through the *container* api? NO — the container api still runs Express 4). IMPORTANT: the running api container has old deps; to verify Express 5 at runtime, run the api on the host against the same DB:

Run: `cd api && POSTGRES_HOST=localhost NODE_ENV=development PORT=3103 node ./src`
(If `config.js` doesn't read `PORT`, check `api/src/index.js` for the listen port variable and use the env var it actually reads; if the port is hard-coded to 3003, skip the host run — it would collide with the container — and rely on the supertest suite, which loads the full app in-process.)
Then: `curl -s -o /dev/null -w '%{http_code}' http://localhost:3103/api/auth/dev-login` → expect `302`. Stop the host api afterward.

- [ ] **Step 6: Commit**

```bash
git add api/package.json api/package-lock.json
git commit -m 'Upgrade Express to v5

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>'
```

(Include any route-syntax fixes from Step 2 in the same commit.)

---

### Task 8: react-router 7 → 8

**Files:**
- Modify: `app/package.json` + lock
- Call sites (complete list):
  - `app/src/index.jsx:3` — `BrowserRouter as Router`
  - `app/src/app.jsx:3` — `Routes, Route`
  - `app/src/components/login/login.jsx:2` — `Navigate`
  - `app/src/components/box-view/box-view.jsx:3` — `Link, Navigate`
  - `app/src/components/home/home.jsx:3` — `Link, Navigate`
  - `app/src/components/sources/sources.jsx:3` — `Navigate`

- [ ] **Step 1: Read the upgrade guide**

react-router 8 postdates the knowledge cutoff. WebFetch `https://reactrouter.com/upgrading/v7` — if that 404s, WebFetch `https://reactrouter.com/` and follow its upgrading/changelog links to the official v7→v8 guide. Do not guess API changes.

- [ ] **Step 2: Install**

Run: `cd app && npm install react-router@latest`

- [ ] **Step 3: Apply guide-mandated changes to the six call sites**

The app uses only `BrowserRouter`, `Routes`, `Route`, `Link`, `Navigate` — the declarative-mode primitives. Update imports/usages exactly as the guide directs, nothing more.

- [ ] **Step 4: Verify**

Run: `cd app && npm run build` → success.
Smoke at :3001: navigate between list view and box view (Link), log out/in (Navigate redirects), confirm URL routing works on refresh.

- [ ] **Step 5: Commit**

```bash
git add app/package.json app/package-lock.json app/src
git commit -m 'Upgrade react-router to v8

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>'
```

---

### Task 9: @mui/material 7 → 9 and @mui/x-date-pickers 8 → 9

**Files:**
- Modify: `app/package.json` + lock
- Call sites (complete list — MUI surface is tiny):
  - `app/src/index.jsx:4-5` — `LocalizationProvider`, `AdapterLuxon`
  - `app/src/components/home/catch/catch.jsx:4-5` — `ThemeProvider, createTheme`, `DateTimePicker`

**Interfaces:**
- Consumes: BACKLOG.md context — the date picker is already slated for possible replacement ("Date picker is wonky/not rendering"). This task is the prime bail-out candidate: if the migration is heavy, prefer recording "replace MUI picker in phase 3" over fighting it.

- [ ] **Step 1: Read both upgrade guides**

WebFetch `https://mui.com/material-ui/migration/upgrade-to-v8/` and the v9 guide linked from it (v9 postdates cutoff; find it from `https://mui.com/material-ui/migration/`), plus the x-date-pickers v9 migration page from `https://mui.com/x/migration/`. Note: crossing two majors (7→9) — read both hops.

- [ ] **Step 2: Install**

Run: `cd app && npm install @mui/material@latest @mui/x-date-pickers@latest`
Check `npm ls @emotion/react @emotion/styled` — if MUI 9 needs newer emotion peers, bump them too.

- [ ] **Step 3: Apply guide-mandated changes to the four call sites**

Expected surface: `AdapterLuxon` import path, `LocalizationProvider` props, `DateTimePicker` props/slots API, `createTheme` signature. Only these two files use MUI.

- [ ] **Step 4: Verify**

Run: `cd app && npm run build` → success.
Smoke at :3001: open the catch modal, open the date-time picker, pick a date, save a catch, confirm the saved date displays. (This picker is a known-wonky area — compare against current behavior at :3000 to avoid attributing pre-existing bugs to the migration.)

- [ ] **Step 5: Commit — or bail out**

```bash
git add app/package.json app/package-lock.json app/src
git commit -m 'Upgrade MUI to v9 (material + x-date-pickers)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>'
```

Bail-out: `git checkout -- app` (discard), then add to BACKLOG.md "Tech debt": `- [ ] MUI 9 migration deferred: <one-line reason>. Consider folding into the date-picker replacement decision (Core v1 issues).` Commit that instead.

---

### Task 10: Code-quality pass (app/src + api/src)

**Files:**
- Modify: `docs/BACKLOG.md`; trivial fixes may touch `package.json` (root), `app/src/**`, `api/src/**`; possibly delete `compose.old.yml`

**Interfaces:**
- Consumes: final post-migration code from Tasks 3–9.
- Produces: updated BACKLOG.md; one cleanup commit of trivial fixes.

- [ ] **Step 1: Review api/src**

Read every file under `api/src` (routes, repositories, `app.js`, `index.js`, `pg-pool.js`, plus `config.js`). Look for: SQL injection risk in repository modules (string-built queries vs parameterized), missing `authCheck` on data routes, error handling that leaks internals, dead exports, repeated logic across the six route/repository pairs. Record findings as one-line bullets with file:line.

- [ ] **Step 2: Review app/src**

Read every component under `app/src`. Look for: state-management bugs matching known BACKLOG symptoms (uncontrolled inputs, stale source display), effect cleanup problems, unhandled promise rejections (one is already known on the 401 path), dead code/unused imports, oversized components doing too much. Record findings the same way.

- [ ] **Step 3: Triage into BACKLOG.md**

For each finding: if it duplicates an existing BACKLOG entry, optionally append detail to that entry (e.g. file:line confirmation); otherwise add it to the matching section ("Bugs" / "Tech debt"). Do not create new sections. Preserve the file's existing ordering conventions (rough priority order within sections).

- [ ] **Step 4: Apply trivial fixes**

Known already (verify each is still true before fixing):
- Root `package.json`: remove the dead `test` script (`mocha --config ./test/mocharc.yml` — no root `test/` dir, no mocha dep). Also remove root `package-lock.json` if root has no dependencies at all.
- Delete `compose.old.yml` if git history is its only remaining value (it is in git history regardless — confirm nothing references it: `grep -rn 'compose.old' --include='*' . --exclude-dir=node_modules --exclude-dir=old-notes`).
Plus whatever mechanical items Steps 1–2 surfaced (unused imports, dead code). Anything requiring judgment stays in BACKLOG.md instead.

- [ ] **Step 5: Verify nothing broke**

Run: `cd api && npm test` → `2 passing`. Run: `cd app && npm run build` → success.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m 'Code-quality pass: record findings, apply trivial fixes

Findings triaged into docs/BACKLOG.md; mechanical fixes (dead root test
script, stale compose.old.yml, unused imports) applied inline per the
phase 2 spec fix policy.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>'
```

---

### Task 11: Post-fetch verification and merge (BLOCKED until the Bulbapedia fetch completes)

**Files:**
- Modify: `docs/ROADMAP.md` (tick Phase 2 checkboxes)

**Interfaces:**
- Consumes: all prior tasks' commits on `phase-2-audit`; a finished Bulbapedia fetch.

- [ ] **Step 1: Confirm the fetch is done**

Run: `docker logs --tail 20 pokecodex-adhoc-1` and check `adhoc/bulbapedia-cache/` page count vs the pokemon table count, plus `adhoc/bulbapedia-cache/failures.json`. Confirm with Jordan before proceeding — the script is resumable, but only Jordan decides whether failures need a re-run first.

- [ ] **Step 2: Rebuild and recreate the dev stack**

Run: `docker compose -f compose.dev.yml up -d --build --force-recreate`
Expected: four containers up, api/ui images now containing the new deps.

- [ ] **Step 3: Full-stack verification**

- `cd api && npm test` → `2 passing`.
- Browse http://localhost:3000/api/auth/dev-login → app renders through the container stack (Vite 7 + new deps inside the container).
- Exercise: list view, box view, catch modal with date picker, evolve flow.

- [ ] **Step 4: Tick Phase 2 in ROADMAP.md**

Mark the three Phase 2 checkboxes `[x]` and commit:

```bash
git add docs/ROADMAP.md
git commit -m 'Mark roadmap Phase 2 complete

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>'
```

- [ ] **Step 5: Merge to master — WITH JORDAN'S EXPLICIT GO-AHEAD**

Merging and pushing master deploys to production. Ask first. Then:

```bash
git checkout master && git merge --no-ff phase-2-audit && git push origin master
```

Watch the GitHub Actions run; confirm the deploy job succeeds. If it fails, the fix happens on a new commit — never force-push master.
