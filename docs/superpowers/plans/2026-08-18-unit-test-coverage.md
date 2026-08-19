# Phase 3 Unit Test Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill the test-coverage gaps found by the phase-3 audit: untested pure utilities, untested happy paths on users-pokemon CRUD, the three backlogged evolve regressions, box-data, sources admin gating, the error handler, and the box-row derivation logic in the UI.

**Architecture:** Extend the existing API integration suite (node:test + supertest against the compose dev Postgres, serialized, self-cleaning fixtures tagged via `notes`) and the existing app vitest pattern (pure logic extracted to `.logic` files, no DOM). One small production refactor: extract `handleFilterPokemon`'s row derivation from `box-view.jsx` into a pure `filterPokemonForVersion` in `box-view.logic.jsx`.

**Tech Stack:** node:test, supertest, pg; vitest (node environment, no jsdom).

## Global Constraints

- API tests hit the real dev database (restored prod dump): every test must clean up exactly what it created, must not assert on or mutate pre-existing user rows except via save/restore, and must tag created `users_pokemon` rows in `notes` for sweep-style cleanup.
- Test files import `./setup.js` first (env overrides + pool teardown) and run under `npm test` (`--test-concurrency=1`).
- Do NOT test known-broken backlogged behavior (box-data setup idempotency, ROLLBACK error masking) — those are code fixes for later, not test targets.
- If a new test fails against existing code, stop: that is an audit finding to report, not something to silently "fix" either way.
- UI: no new scaffolding (no jsdom, no RTL). Only pure-logic tests.

---

### Task 1: pokemon-utils unit tests

**Files:**
- Test: `api/test/pokemon-utils.test.js` (create)

**Interfaces:**
- Consumes: `getSourcesByType`, `getNeededRules`, `formatGamesForFiltering` from `api/src/pokemon/pokemon-utils.js`

- [x] **Step 1: Write the tests**

```js
import './setup.js'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  getSourcesByType,
  getNeededRules,
  formatGamesForFiltering,
} from '../src/pokemon/pokemon-utils.js'

describe('getNeededRules', () => {
  it('keeps truthy rules and drops falsy ones', () => {
    assert.deepEqual(getNeededRules({ wild: true, hatch: false, shiny: true }), [
      'wild',
      'shiny',
    ])
  })

  it('expands gender into male and female in place', () => {
    assert.deepEqual(getNeededRules({ wild: true, gender: true, shiny: true }), [
      'wild',
      'male',
      'female',
      'shiny',
    ])
  })

  it('returns [] for empty rules', () => {
    assert.deepEqual(getNeededRules({}), [])
  })
})

describe('getSourcesByType', () => {
  const mon = {
    sourcesByType: [
      { type: 'wild', name: 'Wild', image: null, replaceDefault: false, firstGen: 0 },
      { type: 'variant', name: 'A', image: 'a.png', replaceDefault: false, firstGen: 2 },
      { type: 'variant', name: 'B', image: 'b.png', replaceDefault: true, firstGen: 2 },
    ],
  }

  it('groups repeatable types as [name, firstGen] pairs and flat types as name, firstGen', () => {
    const [byType] = getSourcesByType(mon)
    assert.deepEqual(byType.variant, [
      ['A', 2],
      ['B', 2],
    ])
    assert.deepEqual(byType.wild, ['Wild', 0])
  })

  it('collects image pairs and the replace-default source', () => {
    const [byType, images] = getSourcesByType(mon)
    assert.deepEqual(images, [
      ['A', 'a.png'],
      ['B', 'b.png'],
    ])
    assert.equal(byType.defaultSource, 'B')
  })
})

describe('formatGamesForFiltering', () => {
  it('pairs each box option with its game row by id', () => {
    const games = [{ id: 3, name: 'Yellow' }, { id: 6, name: 'Crystal' }]
    const result = formatGamesForFiltering(games)
    assert.deepEqual(result[0], ['Gen 1', { id: 3, name: 'Yellow' }])
    assert.deepEqual(result[1], ['Gen 2', { id: 6, name: 'Crystal' }])
  })

  it('leaves undefined for ids missing from game_versions', () => {
    const result = formatGamesForFiltering([])
    assert.equal(result.length, 18)
    assert.ok(result.every(([name, game]) => typeof name === 'string' && game === undefined))
  })
})
```

- [x] **Step 2: Run and verify pass**

Run: `cd api && node --test test/pokemon-utils.test.js`
Expected: all pass (pure functions, existing behavior).

- [x] **Step 3: Commit** — `test: unit-cover pokemon-utils (rules expansion, source grouping, box filter pairs)`

---

### Task 2: users-pokemon CRUD happy paths (route level)

**Files:**
- Test: `api/test/users-pokemon-crud.test.js` (create)

**Interfaces:**
- Consumes: `loginAgent` from `api/test/helpers.js`; routes `PUT/DELETE /api/users-pokemon`, `PUT /api/users-pokemon/note`; tables `users_pokemon`, `users_pokemon_sources`, `sources`.

Covers (all currently untested):
1. PUT `/api/users-pokemon` updates pokeball/game/caughtAt on an owned row.
2. PUT replaces non-inherited source links, preserves inherited ones (`is_inherited = true` survives the delete), and drops bogus/`original` source ids (`insertableSourceIds` filter).
3. PUT `/api/users-pokemon/note` writes the note and returns the refreshed list.
4. DELETE `/api/users-pokemon` removes the row and its links and the response no longer includes it.

Fixture pattern: insert `users_pokemon` rows for the session user (found via `/api/auth/login`) with `notes = 'crud-test'`, pokemon 63 (Abra); track created ids; cleanup deletes links then rows by tracked id in `after`.

Key assertions for (2):

```js
// seed: one inherited link (any Abra source), one non-inherited link
// PUT body sources: [wildId, 'bogus-uuid', originalId]  -> only wildId lands
const links = await pgPool.query(
  `select ups.source_id, ups.is_inherited, s.source from users_pokemon_sources ups
   join sources s on s.id = ups.source_id where ups.users_pokemon_id = $1;`,
  [rowId]
)
assert.ok(links.rows.some(l => l.is_inherited === true), 'inherited link preserved')
assert.ok(!links.rows.some(l => l.source === 'original'), 'original id dropped')
// non-inherited set now equals exactly [wildId]
```

- [x] **Step 1: Write the tests** (full file per pattern above)
- [x] **Step 2: Run** `cd api && node --test test/users-pokemon-crud.test.js` — expect pass
- [x] **Step 3: Commit** — `test: cover users-pokemon update/note/delete happy paths incl. inherited-link preservation`

---

### Task 3: evolve regression tests (backlog item)

**Files:**
- Modify: `api/test/evolve.test.js` (append a new describe block)

**Interfaces:**
- Consumes: `evolveUsersPokemon` from `api/src/users-pokemon/users-pokemon-repository.js`; constants BASE=63, EVOLVED=64 already in the file; add CHAIN=65 (Alakazam).

Three tests from BACKLOG.md:173:
1. **Old-row deletion:** after evolve, the base `users_pokemon` row is gone.
2. **Inherited id-preservation invariant:** a non-special link (e.g. a hatched source on Abra) keeps its `users_pokemon_sources.id` across the move to the evolution, now `is_inherited = true` and pointing at the evolved row.
3. **Chained-evolve dedupe:** evolve Abra→Kadabra→Alakazam; the Alakazam record has exactly one `evolved`-type link, and it is Alakazam's own (`sources.pokemon_id = 65`), non-inherited.

Fixture notes: reuse the file's `insertCatch`/cleanup helpers; extend `cleanup` pokemon-id array to include 65. For (2), link a non-shiny/non-gender/non-evolved source (query `select id from sources where pokemon_id = 63 and source not in ('shiny','male','female','evolved','original') limit 1`), record the link id, evolve, then assert the same link id exists attached to the Kadabra row with `is_inherited = true`.

- [x] **Step 1: Write the three tests**
- [x] **Step 2: Run** `cd api && node --test test/evolve.test.js` — expect pass
- [x] **Step 3: Commit** — `test: evolve regressions — old-row deletion, inherited-id invariant, chained-evolve dedupe`

---

### Task 4: box-data coverage

**Files:**
- Test: `api/test/box-data.test.js` (create)

**Interfaces:**
- Consumes: `setupBoxDataForUser`, `updateUsersBoxData`, `getBoxDataForUser` from `api/src/users-pokemon/users-pokemon-repository.js`; routes `GET /api/pokemon/box-data`, `PUT /api/pokemon/box-data`.

Tests:
1. **Repository setup for a fresh user:** create a throwaway user (null `last_seen_at` so dev-login never picks it), call `setupBoxDataForUser`; assert one row per `game_versions` row with `box_size is not null` (43 in current data — assert against a live count query, not the literal), each with `completeRecords: []`. Cleanup: delete `users_box_data` then the user.
2. **Update scoping:** `updateUsersBoxData(records, freshUserWithNoRows, gameId)` touches 0 rows and returns null (via `getBoxDataForUser`); a real update for the throwaway user (after setup) round-trips the records array.
3. **GET route shape:** logged in, `usersBoxData` is array-or-null and `gameVersions` is the 18 formatted `[name, game]` pairs.
4. **PUT route save/restore:** read the session user's current `complete_records` for one game id directly from SQL, PUT a sentinel array for that game, assert the response and DB reflect it AND other games' rows are untouched, then restore the saved value in `finally`.

Explicitly NOT tested: POST `/api/pokemon/box-data/setup` repeat-call behavior (known non-idempotency, backlogged).

- [x] **Step 1: Write the tests**
- [x] **Step 2: Run** `cd api && node --test test/box-data.test.js` — expect pass
- [x] **Step 3: Commit** — `test: cover box-data setup, update scoping, and route shapes`

---

### Task 5: sources routes and gen filtering

**Files:**
- Test: `api/test/sources-routes.test.js` (create)

**Interfaces:**
- Consumes: `getSourcesForPokemon` from `api/src/sources/sources-repository.js`; routes `GET /api/sources`, `POST /api/sources`; `users.is_admin` flag.

Tests:
1. **GET route:** `GET /api/sources?pokemonId=1` → 200, every row has `pokemonId === 1`.
2. **Gen filter (repository):** pokemon 1 has sources at gens {0,1,4,6,7,8}; `getSourcesForPokemon(1, 4)` returns only gens 0 and 4; `getSourcesForPokemon(1)` returns all.
3. **POST non-admin → 401:** save the session user's `is_admin`, set false, POST a source, expect 401 and no row inserted; restore in `finally`.
4. **POST admin inserts:** set `is_admin = true`, POST `{ pokemonId: 1, source: { name: 'audit-test-source', source: 'wild', gen: 1, description: null, image: null, replaceDefault: false } }`, expect 200 and the new source in the response list; delete the inserted `sources` row by name in `finally` (name is unique to the test), restore flag.

- [x] **Step 1: Write the tests**
- [x] **Step 2: Run** `cd api && node --test test/sources-routes.test.js` — expect pass
- [x] **Step 3: Commit** — `test: cover sources GET/gen filter and admin gate on POST`

---

### Task 6: error-handler leak test

**Files:**
- Test: `api/test/error-handler.test.js` (create)

**Interfaces:**
- Consumes: the terminal error handler in `api/src/app.js:111`; `loginAgent`.

```js
import './setup.js'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import app from '../src/app.js'
import { loginAgent } from './helpers.js'

// A non-integer pokemonId makes pg reject the query; Express 5 forwards the
// rejection to the terminal handler, which must answer 500 JSON with no
// stack trace (the default handler leaks stacks when NODE_ENV=development).
describe('terminal error handler', () => {
  it('responds 500 JSON without leaking a stack trace', async () => {
    const agent = await loginAgent(app)
    const res = await agent.get('/api/pokemon?pokemonId=not-a-number')

    assert.equal(res.status, 500)
    assert.deepEqual(res.body, { message: 'Internal server error' })
    assert.ok(!res.text.includes('    at '), 'no stack frames in the response')
  })
})
```

- [x] **Step 1: Write the test**
- [x] **Step 2: Run** `cd api && node --test test/error-handler.test.js` — expect pass (route exists and handler present)
- [x] **Step 3: Commit** — `test: assert the terminal error handler hides stack traces`

---

### Task 7: extract and test box-row derivation (UI)

**Files:**
- Modify: `app/src/components/box-view/box-view.logic.jsx` (add `filterPokemonForVersion`)
- Modify: `app/src/components/box-view/box-view.jsx:79-139` (replace `handleFilterPokemon` body with a call)
- Test: `app/src/components/box-view/box-view.logic.test.js` (append)

**Interfaces:**
- Produces: `filterPokemonForVersion(allPokemon, version) -> row[]` — the exact body of today's `handleFilterPokemon` minus the `setFilteredPokemon` call. Row fields: everything on `mon` plus `variant`, `recordKey` (`` `${mon.id}:${entry.sourceId}` `` for source rows, `` `${mon.id}` `` for the base row), `isCaught`, `image`.
- `box-view.jsx`'s `handleFilterPokemon` becomes:

```js
const handleFilterPokemon = allPokemon => {
  setFilteredPokemon(filterPokemonForVersion(allPokemon, selectedVersion))
}
```

Move verbatim (pure move, no behavior change): the dexLimit/limitedDex filter, meltan-line append, `entryMakesBoxRow`, the firstGen gate, replaceDefault collapse, and per-row `isCaught` via `catchSatisfiesBox`.

Tests to append (vitest, fixture builders in-file):
1. dexLimit slices; limitedDex filters by id.
2. `addMeltanLine` appends mons 808/809.
3. gender rows appear unless `ignoreGender`; regional rows unless `ignoreRegionalVariants`; variant rows always; non-standard types only when `isOverridden`.
4. rows with `firstGen > version.generationId` are dropped.
5. `replaceDefault` on any produced entry drops the base row.
6. `recordKey` formats; `isCaught` respects `catchSatisfiesBox` (e.g. a gen-2 catch does not satisfy a gen-3 box).
7. image comes from `imagesBySource` by variant name, falling back to `defaultImage`.

- [x] **Step 1: Write the vitest tests against the not-yet-extracted function** (they fail: not exported)
- [x] **Step 2: Run** `cd app && npx vitest run` — expect new tests FAIL (`filterPokemonForVersion is not a function`)
- [x] **Step 3: Extract the function verbatim into `box-view.logic.jsx`; rewire `box-view.jsx`**
- [x] **Step 4: Run** `cd app && npm test` — expect all pass
- [x] **Step 5: Commit** — `refactor+test: extract box-row derivation to box-view.logic and cover its rules`

---

### Task 8: full-suite verification

- [x] **Step 1:** `cd api && npm test` — all pass (46 existing + new)
- [x] **Step 2:** `cd app && npm test` — all pass (9 existing + new)
- [x] **Step 3:** `cd app && npm run build` — build still clean after the box-view refactor
- [x] **Step 4:** Update BACKLOG.md: check off the evolve-regression-tests item; commit — `docs: check off evolve regression tests in backlog`

## Explicitly out of scope (audit findings, not test targets)

- Discord OAuth strategy callback (Megabox gating in `app.js`) — needs passport mocking; low churn, low value. Documented as an accepted gap.
- `users-repository.js` `.catch(() => null)` wrappers — behavior is trivial; exercised indirectly by auth tests.
- sources-list pill bucketing/ordering — presentation logic; extraction not worth it under the keep-UI-tests-minimal constraint.
- Home/BoxView component state flows (stale-response guards etc.) — would require jsdom/RTL scaffolding the user declined.
