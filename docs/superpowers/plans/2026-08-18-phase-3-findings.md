# Phase 3 Remaining Findings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved design in
[docs/superpowers/specs/2026-08-18-phase-3-findings-design.md](../specs/2026-08-18-phase-3-findings-design.md):
ownership-scoped writes, auto-computed home-region, gender tags on evolve,
three-state source overrides, isolated-game box rules, drawer loading
skeleton, and docs cleanup.

**Architecture:** Express 5 + pg API (`api/`), React 19 + Vite UI (`app/`),
Postgres 17 in Docker. Repository modules own all SQL; routes never query
directly. The API camelizes snake_case on read. New data (game regions,
pokemon home regions, isolation groups) lands via a SQL migration; the
"From home region" source becomes derived from catch data instead of stored.

**Tech Stack:** Node 24 ESM, node:test + supertest (API tests, hit the
compose Postgres on localhost:5432 — **the dev stack must be up**: `npm start`
at repo root), vitest (added in Task 9 for pure front-end logic), Docker
Compose.

## Global Constraints

- Windows host. Git Bash mangles `/container/paths` in docker args — prefix
  docker commands with `MSYS_NO_PATHCONV=1` when passing absolute paths, or
  pipe files via stdin (`< file.sql`) as this plan's commands do.
- Public repo: no credentials, hostnames, or infrastructure details in
  committed files.
- API tests: `cd api && npm test` (runs `node --test --test-concurrency=1
  test/*.test.js`). Single file: `cd api && node --test test/<file>.test.js`.
  Tests log in via `/api/auth/dev-login` (most recently seen user) and need
  the dev stack running.
- All app code is ESM (`"type": "module"`); no TypeScript.
- SQL is snake_case; JS is camelCase; `camelize` converts on read (including
  keys inside `jsonb_build_object` aggregates).
- Do all work on a branch named `phase-3-findings` off `master` (create it in
  Task 1). Commit messages end with:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- **Do not run anything against production.** All DB work here targets the
  local dev database (restored from a production dump; disposable).

## Verified ground truth (from the dev DB, 2026-08-18)

- `game_versions` (48 rows, ids 1–48) already has `is_isolated` (true only
  for Colosseum id 10 and XD id 11). Let's Go Pikachu = id 31, Let's Go
  Eevee = id 32 (separate rows, currently not isolated). No `region`,
  `isolation_group`, or `transfer_gen` columns yet.
- `pokemon` (1010 rows) has `original_gen` but no `home_region`. There are
  **no Hisuian form rows** — the only Hisui-homed pokemon are the Legends
  Arceus newcomers, ids 899–905 (Wyrdeer, Kleavor, Ursaluna, Basculegion,
  Sneasler, Overqwil, Enamorus). Meltan/Melmetal are ids 808/809.
- Every pokemon has exactly one `original`-type source named
  `From home region`, gen-scoped to its debut gen.
- Finneon = 456, Lumineon = 457; both have `male` and `female` sources
  (used by the gender-swap test). Abra = 63, Kadabra = 64 (existing evolve
  test line).
- `users` columns: `id uuid pk`, `avatar`, `user_rules jsonb`,
  `discord_id text not null`, `discord_username`, `last_seen_at`,
  `is_admin`. Dev-login picks the most-recently-seen user, so a synthetic
  test user with `last_seen_at = null` never becomes the session user.
- The "pinned" test from commit 89a8011 (`api/test/auth.test.js`, client
  userId ignored on source-override writes) asserts behavior that stays
  correct after this work — it is **kept**, not flipped. (Deviation from the
  spec's assumption, which predated reading the test.)

---

### Task 1: Data migration — regions, home regions, isolation groups, derived original

**Files:**
- Create: `adhoc/scripts/migrations/2026-08-phase3-findings.sql`
- Test: verification via psql queries (expected counts below)

**Interfaces:**
- Produces: `game_versions.region text`, `game_versions.isolation_group
  text`, `game_versions.transfer_gen integer`, `pokemon.home_region text` —
  all later tasks assume these columns exist and are populated in dev.
  Deletes all `users_pokemon_sources` rows pointing at `original`-type
  sources.

- [ ] **Step 1: Create the branch**

```bash
git checkout -b phase-3-findings
```

- [ ] **Step 2: Write the migration SQL**

Create `adhoc/scripts/migrations/2026-08-phase3-findings.sql`:

```sql
-- Phase 3 findings: home-region data, isolation groups, derived original tag.
-- Home-region rule: a catch is "from home region" iff its game's generation
-- equals the pokemon's original_gen AND the game's region equals the
-- pokemon's home_region. Satisfaction is derived from catches, not stored.

alter table game_versions add column if not exists region text;
alter table game_versions add column if not exists isolation_group text;
alter table game_versions add column if not exists transfer_gen integer;
alter table pokemon add column if not exists home_region text;

update game_versions set region = 'Kanto'  where id in (1, 2, 3, 12, 13, 31, 32, 38);
update game_versions set region = 'Johto'  where id in (4, 5, 6, 17, 18, 39);
update game_versions set region = 'Hoenn'  where id in (7, 8, 9, 25, 26);
update game_versions set region = 'Orre'   where id in (10, 11);
update game_versions set region = 'Sinnoh' where id in (14, 15, 16, 35, 36);
update game_versions set region = 'Unova'  where id in (19, 20, 21, 22);
update game_versions set region = 'Kalos'  where id in (23, 24);
update game_versions set region = 'Alola'  where id in (27, 28, 29, 30);
update game_versions set region = 'Galar'  where id in (33, 34);
update game_versions set region = 'Hisui'  where id = 37;
update game_versions set region = 'Paldea' where id in (47, 48);
-- Channel (40), Box (41), Ranch (42), Ranger 1-3 (43-45), Battle Revolution
-- (46): peripherals with no host region. region stays null = never a home game.

-- Isolated games: their boxes only count catches made in the same group.
update game_versions set isolation_group = 'colosseum' where id = 10;
update game_versions set isolation_group = 'xd' where id = 11;
-- The Let's Go pair shares a group (they trade with each other), can't
-- receive Bank transfers, and its catches leave only via Home (gen 8+).
update game_versions
set isolation_group = 'lets-go', transfer_gen = 8, is_isolated = true
where id in (31, 32);

update pokemon set home_region = case original_gen
  when 1 then 'Kanto'
  when 2 then 'Johto'
  when 3 then 'Hoenn'
  when 4 then 'Sinnoh'
  when 5 then 'Unova'
  when 6 then 'Kalos'
  when 7 then 'Alola'
  when 8 then 'Galar'
  when 9 then 'Paldea'
end;
-- Legends Arceus newcomers debut in Hisui, not Galar. (No Hisuian form rows
-- exist in the dex data yet; if they are added later, set them here too.)
update pokemon set home_region = 'Hisui' where id between 899 and 905;
-- The Meltan line debuts in the Let's Go pair (Kanto).
update pokemon set home_region = 'Kanto' where id in (808, 809);

-- 'From home region' is now derived from catch data; stored links would
-- double-represent it.
delete from users_pokemon_sources ups using sources s
where s.id = ups.source_id and s.source = 'original';
```

- [ ] **Step 3: Apply to the dev database**

```bash
docker compose -f compose.dev.yml exec -T postgres psql -U postgres -d pokemon -v ON_ERROR_STOP=1 < adhoc/scripts/migrations/2026-08-phase3-findings.sql
```

Expected: a stream of `ALTER TABLE`/`UPDATE n` lines, no errors.

- [ ] **Step 4: Verify the data**

```bash
docker compose -f compose.dev.yml exec -T postgres psql -U postgres -d pokemon -c "select count(*) filter (where region is null) as no_region, count(*) filter (where isolation_group is not null) as isolated from game_versions;" -c "select count(*) from pokemon where home_region is null;" -c "select count(*) from users_pokemon_sources ups join sources s on s.id = ups.source_id where s.source = 'original';"
```

Expected: `no_region = 7` (ids 40–46), `isolated = 4` (10, 11, 31, 32),
pokemon without home_region = `0`, remaining original links = `0`.

- [ ] **Step 5: Commit**

```bash
git add adhoc/scripts/migrations/2026-08-phase3-findings.sql
git commit -m "feat: add region/home-region/isolation data migration

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Ownership-scoped writes (update, note, delete)

**Files:**
- Modify: `api/src/users-pokemon/users-pokemon-repository.js:17-67` and `:200-215`
- Test: `api/test/ownership.test.js` (create)

**Interfaces:**
- Consumes: nothing new.
- Produces: `updateUsersPokemon`, `updateNoteForUsersPokemon`,
  `deleteUsersPokemon` — same signatures and return shapes as today
  (resolve to the session user's camelized `users_pokemon` rows for that
  pokemon), but writes are no-ops when `usersPokemonId` isn't owned by
  `userId`. Task 3 adds the evolve path to the same test file.

- [ ] **Step 1: Write the failing tests**

Create `api/test/ownership.test.js`:

```js
import './setup.js'
import assert from 'node:assert/strict'
import { describe, it, before, after } from 'node:test'
import { randomUUID } from 'crypto'
import app from '../src/app.js'
import pgPool from '../src/pg-pool.js'
import { loginAgent } from './helpers.js'

// A second user's catch must not be writable through the session user's
// requests, even with a leaked users_pokemon uuid.
const POKEMON = 63 // Abra

describe('ownership scoping on users-pokemon writes', () => {
  let agent, victimUserId, victimRowId, gameId

  before(async () => {
    agent = await loginAgent(app)
    victimUserId = randomUUID()
    victimRowId = randomUUID()
    gameId = (await pgPool.query('select id from game_versions limit 1;')).rows[0].id
    // last_seen_at stays null so dev-login never picks the victim.
    await pgPool.query(
      `insert into users(id, discord_id, discord_username) values($1, 'ownership-test', 'ownership-test');`,
      [victimUserId]
    )
    await pgPool.query(
      `insert into users_pokemon(id, user_id, pokemon_id, notes, game_id, pokeball, caught_at)
       values($1, $2, $3, 'ownership-test', $4, 1, now());`,
      [victimRowId, victimUserId, POKEMON, gameId]
    )
  })

  after(async () => {
    await pgPool.query(
      `delete from users_pokemon_sources where users_pokemon_id in
       (select id from users_pokemon where user_id = $1);`,
      [victimUserId]
    )
    await pgPool.query(`delete from users_pokemon where user_id = $1;`, [victimUserId])
    await pgPool.query(`delete from users where id = $1;`, [victimUserId])
  })

  const victimRow = async () =>
    (await pgPool.query(`select * from users_pokemon where id = $1;`, [victimRowId]))
      .rows[0]

  it('PUT /api/users-pokemon cannot update or take over another user\'s row', async () => {
    const res = await agent.put('/api/users-pokemon').send({
      usersPokemonId: victimRowId,
      pokemonId: POKEMON,
      sources: [],
      gameVersion: gameId,
      pokeball: 2,
      caughtAt: new Date().toISOString(),
    })
    assert.equal(res.status, 200)

    const row = await victimRow()
    assert.equal(row.user_id, victimUserId, 'row must still belong to the victim')
    assert.equal(row.pokeball, 1, 'pokeball must be unchanged')
  })

  it('PUT /api/users-pokemon with a foreign row does not rewrite its sources', async () => {
    const sourceId = (
      await pgPool.query(`select id from sources where pokemon_id = $1 limit 1;`, [
        POKEMON,
      ])
    ).rows[0].id
    await pgPool.query(
      `insert into users_pokemon_sources(id, users_pokemon_id, source_id) values($1, $2, $3);`,
      [randomUUID(), victimRowId, sourceId]
    )

    await agent.put('/api/users-pokemon').send({
      usersPokemonId: victimRowId,
      pokemonId: POKEMON,
      sources: [],
      gameVersion: gameId,
      pokeball: 2,
      caughtAt: new Date().toISOString(),
    })

    const links = await pgPool.query(
      `select * from users_pokemon_sources where users_pokemon_id = $1;`,
      [victimRowId]
    )
    assert.equal(links.rows.length, 1, 'victim sources must be untouched')
  })

  it('PUT /api/users-pokemon/note cannot write another user\'s note', async () => {
    await agent.put('/api/users-pokemon/note').send({
      usersPokemonId: victimRowId,
      pokemonId: POKEMON,
      note: 'hacked',
    })
    const row = await victimRow()
    assert.equal(row.notes, 'ownership-test')
  })

  it('DELETE /api/users-pokemon cannot delete another user\'s row', async () => {
    await agent.delete('/api/users-pokemon').send({
      usersPokemonId: victimRowId,
      pokemonId: POKEMON,
    })
    const row = await victimRow()
    assert.ok(row, 'victim row must still exist')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd api && node --test test/ownership.test.js`
Expected: FAIL — takeover test fails (`row.user_id` becomes the session
user), note test fails (`notes` = 'hacked'), delete test fails (row gone).

- [ ] **Step 3: Scope the writes by user_id**

In `api/src/users-pokemon/users-pokemon-repository.js`, replace
`updateNoteForUsersPokemon`, `updateUsersPokemon`, and `deleteUsersPokemon`:

```js
export const updateNoteForUsersPokemon = noteData => {
  const { note, userId, pokemonId, usersPokemonId } = noteData

  return pgPool
    .query(`update users_pokemon set notes = $1 where id = $2 and user_id = $3;`, [
      note,
      usersPokemonId,
      userId,
    ])
    .then(() => {
      return pgPool
        .query(selectQuery, [userId, pokemonId])
        .then(res => camelize(res.rows))
    })
}

export const updateUsersPokemon = pokemonData => {
  const { sources, pokeball, gameVersion, userId, pokemonId, usersPokemonId, caughtAt } =
    pokemonData

  return pgPool
    .query(
      `update users_pokemon 
      set pokeball = $1,
      pokemon_id = $2,
      game_id = $3,
      caught_at = $4
      where id = $5 and user_id = $6;`,
      [pokeball, pokemonId, gameVersion, caughtAt, usersPokemonId, userId]
    )
    .then(result => {
      // Ownership predicate failed: leave the row's sources untouched too.
      if (result.rowCount === 0) return
      return pgPool
        .query(
          `delete from users_pokemon_sources 
      where users_pokemon_id = $1 and is_inherited = false;`,
          [usersPokemonId]
        )
        .then(() => {
          return Promise.all(
            sources.map(sourceId => {
              return pgPool.query(
                `insert into users_pokemon_sources(id, users_pokemon_id, source_id)
          values($1, $2, $3);`,
                [randomUUID(), usersPokemonId, sourceId]
              )
            })
          )
        })
    })
    .then(() => {
      return pgPool
        .query(selectQuery, [userId, pokemonId])
        .then(res => camelize(res.rows))
    })
}
```

and

```js
export const deleteUsersPokemon = pokemonData => {
  const { userId, pokemonId, usersPokemonId } = pokemonData

  return pgPool
    .query(
      `delete from users_pokemon_sources where users_pokemon_id in
      (select id from users_pokemon where id = $1 and user_id = $2);`,
      [usersPokemonId, userId]
    )
    .then(() => {
      return pgPool.query(
        `delete from users_pokemon where id = $1 and user_id = $2;`,
        [usersPokemonId, userId]
      )
    })
    .then(() => {
      return pgPool
        .query(selectQuery, [userId, pokemonId])
        .then(res => camelize(res.rows))
    })
}
```

Note `updateUsersPokemon` no longer sets `user_id` at all — that SET clause
was the takeover vector.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd api && node --test test/ownership.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: Run the whole API suite**

Run: `cd api && npm test`
Expected: PASS — existing tests (auth, evolve, completion, source-overrides,
users-routes, pokemon-routes, dev-login) unaffected.

- [ ] **Step 6: Commit**

```bash
git add api/src/users-pokemon/users-pokemon-repository.js api/test/ownership.test.js
git commit -m "fix: scope users-pokemon writes to the session user

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Evolve — ownership check and gender-tag swap

**Files:**
- Modify: `api/src/users-pokemon/users-pokemon-repository.js:99-198`
  (`evolveUsersPokemon`)
- Test: `api/test/evolve.test.js` (add cases), `api/test/ownership.test.js`
  (add evolve case)

**Interfaces:**
- Consumes: `evolveUsersPokemon(pokemonData)` as defined today.
- Produces: same signature/return; additionally the base's `male`/`female`
  source link is swapped to the evolution's own gender source
  (non-inherited), and a non-owned base row aborts the whole evolve.

- [ ] **Step 1: Write the failing tests**

In `api/test/evolve.test.js`, add after the existing shiny test (inside the
same `describe`), plus a second describe block for the gendered line. Also
update the top-of-file constants comment — the new block uses Finneon:

```js
  it('rolls back and changes nothing when the base row belongs to another user', async () => {
    const upId = await insertCatch(false)
    const victimUserId = randomUUID()
    await pgPool.query(
      `insert into users(id, discord_id, discord_username) values($1, 'evolve-ownership-test', 'x');`,
      [victimUserId]
    )
    try {
      await evolveUsersPokemon({
        userId: victimUserId, // not the owner of upId
        evolvedPokemonId: EVOLVED,
        oldPokemonData: {
          id: upId,
          pokemonId: BASE,
          pokeball: 1,
          gameId,
          caughtAt: new Date().toISOString(),
          notes: 'evolve-test',
        },
      })
      const baseRow = await pgPool.query(`select * from users_pokemon where id = $1;`, [
        upId,
      ])
      assert.equal(baseRow.rows.length, 1, 'base row must survive')
      const evolved = await pgPool.query(
        `select * from users_pokemon where user_id = $1;`,
        [victimUserId]
      )
      assert.equal(evolved.rows.length, 0, 'no evolved record for the attacker')
    } finally {
      await pgPool.query(`delete from users_pokemon where user_id = $1;`, [victimUserId])
      await pgPool.query(`delete from users where id = $1;`, [victimUserId])
    }
  })
```

New describe block at the bottom of the file:

```js
describe('evolveUsersPokemon gender swap', () => {
  const G_BASE = 456 // Finneon
  const G_EVOLVED = 457 // Lumineon

  let userId, gameId, baseFemaleId, evolvedFemaleId

  const genderCleanup = async uid => {
    await pgPool.query(
      `delete from users_pokemon_sources where users_pokemon_id in
       (select id from users_pokemon where user_id = $1 and pokemon_id = any($2::int[]) and notes = 'evolve-test');`,
      [uid, [G_BASE, G_EVOLVED]]
    )
    await pgPool.query(
      `delete from users_pokemon where user_id = $1 and pokemon_id = any($2::int[]) and notes = 'evolve-test';`,
      [uid, [G_BASE, G_EVOLVED]]
    )
  }

  beforeEach(async () => {
    userId = (await pgPool.query(userIdQuery)).rows[0].id
    gameId = (await pgPool.query('select id from game_versions limit 1;')).rows[0].id
    baseFemaleId = (
      await pgPool.query(
        `select id from sources where pokemon_id = $1 and source = 'female' limit 1;`,
        [G_BASE]
      )
    ).rows[0]?.id
    evolvedFemaleId = (
      await pgPool.query(
        `select id from sources where pokemon_id = $1 and source = 'female' limit 1;`,
        [G_EVOLVED]
      )
    ).rows[0]?.id
    await genderCleanup(userId)
  })

  after(async () => {
    const uid = (await pgPool.query(userIdQuery)).rows[0].id
    await genderCleanup(uid)
  })

  it('a female base becomes a female evolution (own source, not inherited)', async t => {
    if (!baseFemaleId || !evolvedFemaleId) return t.skip('no gender sources in data')
    const upId = randomUUID()
    await pgPool.query(
      `insert into users_pokemon(id, user_id, pokemon_id, notes, game_id, pokeball, caught_at)
       values($1, $2, $3, 'evolve-test', $4, 1, now());`,
      [upId, userId, G_BASE, gameId]
    )
    await pgPool.query(
      `insert into users_pokemon_sources(id, users_pokemon_id, source_id) values($1, $2, $3);`,
      [randomUUID(), upId, baseFemaleId]
    )

    await evolveUsersPokemon({
      userId,
      evolvedPokemonId: G_EVOLVED,
      oldPokemonData: {
        id: upId,
        pokemonId: G_BASE,
        pokeball: 1,
        gameId,
        caughtAt: new Date().toISOString(),
        notes: 'evolve-test',
      },
    })

    const links = (
      await pgPool.query(
        `select ups.source_id, ups.is_inherited, s.source from users_pokemon_sources ups
         join sources s on s.id = ups.source_id
         join users_pokemon up on up.id = ups.users_pokemon_id
         where up.user_id = $1 and up.pokemon_id = $2 and up.notes = 'evolve-test';`,
        [userId, G_EVOLVED]
      )
    ).rows
    const female = links.find(l => l.source === 'female')
    assert.ok(female, 'evolved record should have a female source')
    assert.equal(female.source_id, evolvedFemaleId)
    assert.equal(female.is_inherited, false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd api && node --test test/evolve.test.js`
Expected: FAIL — ownership test (evolved record created for attacker /
base row deleted) and gender test (female link inherited, base source id).

- [ ] **Step 3: Implement ownership check and gender swap**

In `evolveUsersPokemon`, restructure the transaction around an `aborted`
flag so the ownership check can bail out without touching anything and the
single `finally` still releases the client:

```js
  let aborted = false
  try {
    await client.query('BEGIN')

    const owned = await client.query(
      `select id from users_pokemon where id = $1 and user_id = $2 for update;`,
      [usersPokemonId, userId]
    )
    if (owned.rows.length === 0) {
      await client.query('ROLLBACK')
      aborted = true
    }

    if (!aborted) {
      // ... entire existing body (shiny swap, gender swap, moves, deletes,
      // evolved-source insert) unchanged, ending with:
      await client.query('COMMIT')
    }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }

  return pgPool.query(selectQuery, [userId, pokemonId]).then(res => camelize(res.rows))
```

(Wrap the existing body in `if (!aborted) { ... }` — do not duplicate it.)

Then add the gender swap directly after the existing shiny-swap block
(inside the same `if (!aborted)` body, before the "Everything else moves"
update):

```js
    // Gender carries through evolution: swap the base's gender link for the
    // evolved pokemon's own gender source, non-inherited (same as shiny).
    for (const genderType of ['male', 'female']) {
      const baseGenderLink = await client
        .query(
          `select ups.id from users_pokemon_sources ups
          join sources s on s.id = ups.source_id
          where ups.users_pokemon_id = $1 and s.source = $2::source_type;`,
          [usersPokemonId, genderType]
        )
        .then(res => res.rows[0])

      if (baseGenderLink) {
        const evolvedGenderId = await client
          .query(
            `select id from sources where source = $1::source_type and pokemon_id = $2;`,
            [genderType, evolvedPokemonId]
          )
          .then(res => res.rows[0]?.id)

        await client.query(`delete from users_pokemon_sources where id = $1;`, [
          baseGenderLink.id,
        ])
        if (evolvedGenderId)
          await client.query(
            `insert into users_pokemon_sources(id, users_pokemon_id, source_id)
            values($1, $2, $3);`,
            [randomUUID(), evolvedUsersPokemonId, evolvedGenderId]
          )
      }
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd api && node --test test/evolve.test.js`
Expected: PASS (existing 2 + new 2; gender test may skip only if dev data
lacks gender sources — it doesn't for Finneon/Lumineon)

- [ ] **Step 5: Run the whole API suite**

Run: `cd api && npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add api/src/users-pokemon/users-pokemon-repository.js api/test/evolve.test.js
git commit -m "feat: evolve verifies ownership and carries gender tags

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Auto-computed home region in the completion engine

**Files:**
- Modify: `api/src/pokemon/pokemon-repository.js:11-55`
- Modify: `api/src/pokemon/completion.js`
- Test: `api/test/completion.test.js` (extend)

**Interfaces:**
- Consumes: Task 1's columns.
- Produces:
  - Each mon from `getAllForUser` gains `usersCatches:
    Array<{gameId: number, gen: number, isolationGroup: string|null,
    transferGen: number|null}>` (Task 9's box view consumes this).
  - Each `requiredSources` entry gains `caughtIn` (same element shape as
    `usersCatches`); `caughtInGens` is kept in this task (removed in Task 9
    when the box view stops reading it).
  - `buildRequiredSources(mon, neededRules, overrides)` derives `original`
    entries' `caughtIn` from `mon.usersCatches` × (`mon.originalGen`,
    `mon.homeRegion`) instead of stored links.
  - New export from completion.js: `homeRegionCatchFilter(mon)` →
    `(rawCatch) => boolean` (raw catch rows carry `gen` and `region`).

- [ ] **Step 1: Write the failing tests**

Append to `api/test/completion.test.js`:

```js
describe('auto-computed home region', () => {
  const tangela = {
    originalGen: 1,
    homeRegion: 'Kanto',
    sourcesByType: [
      {
        id: 'src-original',
        type: 'original',
        name: 'From home region',
        image: null,
        replaceDefault: false,
        firstGen: 1,
      },
    ],
    usersSourcesByGen: [null],
    usersSources: [null],
    usersEvolutionSourceIds: [null],
    usersCatches: [],
  }

  it('a catch in a home game satisfies the original source', () => {
    const mon = {
      ...tangela,
      usersCatches: [
        { gameId: 1, gen: 1, region: 'Kanto', isolationGroup: null, transferGen: null },
      ],
    }
    const required = buildRequiredSources(mon, ['original'])
    assert.equal(required[0].caughtIn.length, 1)
    assert.equal(checkCompletion(mon, required), true)
  })

  it('same gen but wrong region does not satisfy it', () => {
    // e.g. a Sinnoh pokemon caught in Soul Silver (gen 4, Johto)
    const mon = {
      ...tangela,
      originalGen: 4,
      homeRegion: 'Sinnoh',
      usersCatches: [
        { gameId: 18, gen: 4, region: 'Johto', isolationGroup: null, transferGen: null },
      ],
    }
    const required = buildRequiredSources(mon, ['original'])
    assert.equal(required[0].caughtIn.length, 0)
    assert.equal(checkCompletion(mon, required), false)
  })

  it('right region but wrong gen (a remake) does not satisfy it', () => {
    const mon = {
      ...tangela,
      usersCatches: [
        { gameId: 12, gen: 3, region: 'Kanto', isolationGroup: null, transferGen: null },
      ],
    }
    const required = buildRequiredSources(mon, ['original'])
    assert.equal(required[0].caughtIn.length, 0)
  })

  it('stored original links are ignored — only catches count', () => {
    const mon = {
      ...tangela,
      usersSourcesByGen: [
        { id: 'src-original', source: 'original', name: 'From home region', gen: 1 },
      ],
      usersCatches: [],
    }
    const required = buildRequiredSources(mon, ['original'])
    assert.equal(required[0].caughtIn.length, 0)
    assert.equal(checkCompletion(mon, required), false)
  })

  it('null-region games never qualify', () => {
    const mon = {
      ...tangela,
      homeRegion: null,
      usersCatches: [
        { gameId: 40, gen: 1, region: null, isolationGroup: null, transferGen: null },
      ],
    }
    const required = buildRequiredSources(mon, ['original'])
    assert.equal(required[0].caughtIn.length, 0)
  })
})
```

Also update the two existing fixtures' expectations that will now read
`caughtIn`: in `describe('buildRequiredSources')` → `'marks per-row caught
state'`, add after the existing assertions:

```js
    assert.deepEqual(
      byId['src-a'].caughtIn.map(c => c.gen),
      [2]
    )
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd api && node --test test/completion.test.js`
Expected: FAIL — `caughtIn` undefined; home-region describe all failing.

- [ ] **Step 3: Implement completion changes**

In `api/src/pokemon/completion.js`, add above `buildRequiredSources`:

```js
// Raw catch rows (users_catches agg) carry gen and region; the cleaned
// shape handed to the front end drops region.
const toCatch = row => ({
  gameId: row.gameId,
  gen: Number(row.gen),
  isolationGroup: row.isolationGroup ?? null,
  transferGen: row.transferGen == null ? null : Number(row.transferGen),
})

// A catch is "from home region" iff its game's generation is the pokemon's
// debut gen AND its region is the pokemon's home region.
export const homeRegionCatchFilter = mon => c =>
  Number(c.gen) === Number(mon.originalGen) &&
  Boolean(c.region) &&
  Boolean(mon.homeRegion) &&
  c.region === mon.homeRegion
```

Replace the body of the `for` loop's entry construction in
`buildRequiredSources` (and add the `catches` line at the top):

```js
export const buildRequiredSources = (mon, neededRules, overrides = {}) => {
  const sourceRows = (mon.sourcesByType || []).filter(row => row && row.id)
  const ownedRows = (mon.usersSourcesByGen || []).filter(row => row && row.id)
  const catches = (mon.usersCatches || []).filter(row => row && row.gameId)
  const evolutionIds = new Set((mon.usersEvolutionSourceIds || []).filter(Boolean))
  const seen = new Set()
  const required = []

  for (const row of sourceRows) {
    if (seen.has(row.id)) continue
    seen.add(row.id)

    const override = overrides[row.id]
    const isRequired = override === undefined ? neededRules.includes(row.type) : override
    if (!isRequired) continue

    // 'From home region' is derived from where the pokemon was caught, not
    // from stored source links.
    const caughtIn =
      row.type === 'original'
        ? catches.filter(homeRegionCatchFilter(mon)).map(toCatch)
        : ownedRows.filter(o => o.id === row.id).map(toCatch)

    required.push({
      sourceId: row.id,
      name: row.name,
      type: row.type,
      firstGen: Number(row.firstGen),
      replaceDefault: Boolean(row.replaceDefault),
      caughtIn,
      caughtInGens: caughtIn.map(c => c.gen),
      caughtViaEvolution:
        evolutionSatisfiableTypes.includes(row.type) && evolutionIds.has(row.id),
      isOverridden: override !== undefined,
    })
  }
  return required
}
```

Update `checkCompletion`'s final return:

```js
  return requiredSources.every(
    entry => entry.caughtIn.length > 0 || entry.caughtViaEvolution
  )
```

- [ ] **Step 4: Update the main query**

In `api/src/pokemon/pokemon-repository.js`, replace
`pokemonWithSourcesQuery` with:

```js
const pokemonWithSourcesQuery = `
select p.id, p."name", p.type1, p.type2, p.icon, p.default_image, p.bulbapedia_link, p.has_gender_differences, p.original_gen, p.home_region, p.evolves_to,
json_agg(distinct(s.source)) users_sources,
json_agg(distinct(s2.source)) sources,
json_agg(distinct(s3.id)) users_evolution_source_ids,
json_agg(distinct(jsonb_build_object('id', s2.id, 'type', s2.source, 'name', s2.name, 'image', s2.image, 'replace_default', s2.replace_default, 'first_gen', s2.gen))) sources_by_type,
json_agg(distinct(jsonb_build_object('id', s.id, 'source', s.source, 'name', s.name, 'gen', gv.generation_id, 'game_id', up.game_id, 'isolation_group', gv.isolation_group, 'transfer_gen', gv.transfer_gen))) users_sources_by_gen,
json_agg(distinct(jsonb_build_object('game_id', up.game_id, 'gen', gv.generation_id, 'region', gv.region, 'isolation_group', gv.isolation_group, 'transfer_gen', gv.transfer_gen))) users_catches
from pokemon p
left join pokemon evolution on evolution.id = ANY(p.evolves_to)
left join users_pokemon up on up.pokemon_id = p.id and up.user_id = $1
left join users_pokemon up2 on up2.pokemon_id = evolution.id and up2.user_id = $1
left join users_pokemon_sources ups on ups.users_pokemon_id = up.id
left join users_pokemon_sources ups2 on ups2.users_pokemon_id = up2.id
left join sources s on s.id = ups.source_id and ups.users_pokemon_id = up.id
left join sources s2 on s2.pokemon_id = p.id and (CAST($2 AS INTEGER) IS NULL OR s2.gen = ANY(ARRAY[0, CAST($2 AS INTEGER)]))
left join sources s3 on s3.id = ups2.source_id and ups2.users_pokemon_id = up2.id
left join game_versions gv on gv.id = up.game_id
group by p.id, p."name", p.type1, p.type2, p.icon, p.default_image, p.bulbapedia_link, p.has_gender_differences, p.original_gen, p.home_region
order by p.id;`
```

And in `getAllForUser`'s map, expose the cleaned catches:

```js
  return pokemon.map(mon => {
    const requiredSources = buildRequiredSources(mon, neededRules, overrides)
    const isComplete = checkCompletion(mon, requiredSources)
    const [sourcesByType, imagesBySource] = getSourcesByType(mon)
    const usersSourcesByGen = getUsersSourcesByGen(mon)
    const usersCatches = (mon.usersCatches || [])
      .filter(row => row && row.gameId)
      .map(row => ({
        gameId: row.gameId,
        gen: Number(row.gen),
        isolationGroup: row.isolationGroup ?? null,
        transferGen: row.transferGen == null ? null : Number(row.transferGen),
      }))

    return Object.assign({}, mon, {
      isComplete,
      requiredSources,
      sourcesByType,
      usersSourcesByGen,
      imagesBySource,
      usersCatches,
    })
  })
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd api && node --test test/completion.test.js`
Expected: PASS
Then: `cd api && npm test`
Expected: PASS (source-overrides tests exercise `/api/all-pokemon` against
the real DB and will catch query syntax errors)

- [ ] **Step 6: Commit**

```bash
git add api/src/pokemon/completion.js api/src/pokemon/pokemon-repository.js api/test/completion.test.js
git commit -m "feat: derive home-region completion from catch games

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: API routes — homeRegionCatchIds, override payloads, original-link hardening

**Files:**
- Modify: `api/src/users-pokemon/users-pokemon-repository.js` (add
  `getHomeRegionCatchIds`, filter inserts in `addPokemonForUser` and
  `updateUsersPokemon`)
- Modify: `api/src/pokemon/pokemon-routes.js` (GET `/pokemon`,
  POST `/pokemon`)
- Modify: `api/src/users-pokemon/users-pokemon-routes.js` (all handlers)
- Test: `api/test/home-region.test.js` (create)

**Interfaces:**
- Consumes: Task 1 columns; Task 4 semantics.
- Produces:
  - `getHomeRegionCatchIds(userId, pokemonId)` → `Promise<string[]>` of
    `users_pokemon.id` uuids whose catch game is a home game.
  - Response field `homeRegionCatchIds: string[]` on GET `/api/pokemon`,
    POST `/api/pokemon`, PUT `/api/users-pokemon`, DELETE
    `/api/users-pokemon`, PUT `/api/users-pokemon/evolve`.
  - Response field `usersSourceOverrides` added to POST `/api/pokemon` and
    PUT `/api/users-pokemon`.
  - Write paths silently drop `original`-type source ids from incoming
    `sources` arrays.

- [ ] **Step 1: Write the failing tests**

Create `api/test/home-region.test.js`:

```js
import './setup.js'
import assert from 'node:assert/strict'
import { describe, it, beforeEach, after } from 'node:test'
import { randomUUID } from 'crypto'
import app from '../src/app.js'
import pgPool from '../src/pg-pool.js'
import { loginAgent } from './helpers.js'

const POKEMON = 399 // Bidoof, gen 4, home region Sinnoh
const DIAMOND = 14 // gen 4, Sinnoh — a home game
const SOUL_SILVER = 18 // gen 4, Johto — not a home game

const userIdQuery = 'select id from users order by last_seen_at desc nulls last limit 1;'
const cleanup = async userId => {
  await pgPool.query(
    `delete from users_pokemon_sources where users_pokemon_id in
     (select id from users_pokemon where user_id = $1 and pokemon_id = $2 and notes = 'home-region-test');`,
    [userId, POKEMON]
  )
  await pgPool.query(
    `delete from users_pokemon where user_id = $1 and pokemon_id = $2 and notes = 'home-region-test';`,
    [userId, POKEMON]
  )
}

const insertCatch = async (userId, gameId) => {
  const upId = randomUUID()
  await pgPool.query(
    `insert into users_pokemon(id, user_id, pokemon_id, notes, game_id, pokeball, caught_at)
     values($1, $2, $3, 'home-region-test', $4, 1, now());`,
    [upId, userId, POKEMON, gameId]
  )
  return upId
}

describe('home region catch ids', () => {
  let userId

  beforeEach(async () => {
    userId = (await pgPool.query(userIdQuery)).rows[0].id
    await cleanup(userId)
  })

  after(async () => {
    const uid = (await pgPool.query(userIdQuery)).rows[0].id
    await cleanup(uid)
  })

  it('GET /api/pokemon flags home-game catches and only those', async () => {
    const agent = await loginAgent(app)
    const homeId = await insertCatch(userId, DIAMOND)
    const awayId = await insertCatch(userId, SOUL_SILVER)

    const res = await agent.get(`/api/pokemon?pokemonId=${POKEMON}`)
    assert.equal(res.status, 200)
    assert.ok(Array.isArray(res.body.homeRegionCatchIds))
    assert.ok(res.body.homeRegionCatchIds.includes(homeId))
    assert.equal(res.body.homeRegionCatchIds.includes(awayId), false)
  })

  it('POST /api/pokemon returns homeRegionCatchIds and usersSourceOverrides, and drops original source ids', async () => {
    // The restored dump holds real user data, so identify the POST-created
    // row by diffing ids — never assert on or delete the user's other rows.
    const agent = await loginAgent(app)
    const originalSourceId = (
      await pgPool.query(
        `select id from sources where pokemon_id = $1 and source = 'original';`,
        [POKEMON]
      )
    ).rows[0].id

    const rowIds = async () =>
      (
        await pgPool.query(
          `select id from users_pokemon where user_id = $1 and pokemon_id = $2;`,
          [userId, POKEMON]
        )
      ).rows.map(r => r.id)
    const before = await rowIds()

    const res = await agent.post('/api/pokemon').send({
      pokemonId: POKEMON,
      sources: [originalSourceId],
      gameVersion: DIAMOND,
      pokeball: 1,
    })
    assert.equal(res.status, 200)
    assert.ok(Array.isArray(res.body.homeRegionCatchIds))
    assert.ok(Array.isArray(res.body.usersSourceOverrides))

    const newRowId = (await rowIds()).find(id => !before.includes(id))
    assert.ok(newRowId, 'POST should have created a row')

    try {
      const links = await pgPool.query(
        `select * from users_pokemon_sources where users_pokemon_id = $1;`,
        [newRowId]
      )
      assert.equal(links.rows.length, 0, 'original source id must not be stored')

      // the Diamond catch itself qualifies via derivation
      assert.ok(res.body.homeRegionCatchIds.includes(newRowId))
    } finally {
      await pgPool.query(`delete from users_pokemon_sources where users_pokemon_id = $1;`, [
        newRowId,
      ])
      await pgPool.query(`delete from users_pokemon where id = $1;`, [newRowId])
    }
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd api && node --test test/home-region.test.js`
Expected: FAIL — `homeRegionCatchIds` undefined on both routes; original
link stored.

- [ ] **Step 3: Implement repository additions**

In `api/src/users-pokemon/users-pokemon-repository.js` add:

```js
export const getHomeRegionCatchIds = (userId, pokemonId) => {
  return pgPool
    .query(
      `select up.id from users_pokemon up
      join game_versions gv on gv.id = up.game_id
      join pokemon p on p.id = up.pokemon_id
      where up.user_id = $1 and up.pokemon_id = $2
      and gv.generation_id = p.original_gen
      and gv.region is not null and gv.region = p.home_region;`,
      [userId, pokemonId]
    )
    .then(res => res.rows.map(r => r.id))
}

// The 'original' source is derived from catch data (see completion.js);
// storing a link would double-represent it, so write paths drop those ids.
const insertableSourceIds = sources => {
  if (!sources?.length) return Promise.resolve([])
  return pgPool
    .query(
      `select id from sources where id = any($1::uuid[]) and source <> 'original';`,
      [sources]
    )
    .then(res => res.rows.map(r => r.id))
}
```

In `addPokemonForUser`, replace the `sources.map(...)` insert block:

```js
    .then(() => insertableSourceIds(sources))
    .then(validSources => {
      return Promise.all(
        validSources.map(sourceId => {
          return pgPool.query(
            `insert into users_pokemon_sources(id, users_pokemon_id, source_id)
            values($1, $2, $3);`,
            [randomUUID(), usersPokemonId, sourceId]
          )
        })
      )
    })
```

In `updateUsersPokemon` (as rewritten in Task 2), replace its
`sources.map(...)` insert block the same way:

```js
        .then(() => insertableSourceIds(sources))
        .then(validSources => {
          return Promise.all(
            validSources.map(sourceId => {
              return pgPool.query(
                `insert into users_pokemon_sources(id, users_pokemon_id, source_id)
          values($1, $2, $3);`,
                [randomUUID(), usersPokemonId, sourceId]
              )
            })
          )
        })
```

- [ ] **Step 4: Implement route additions**

`api/src/pokemon/pokemon-routes.js`: import the new function (extend the
existing users-pokemon-repository import list with `getHomeRegionCatchIds`),
then add to the GET `/pokemon` response object:

```js
    homeRegionCatchIds: await getHomeRegionCatchIds(userId, req.query.pokemonId),
```

and to the POST `/pokemon` response object (it already imports
`getSourceOverridesForUserAndPokemon` for GET):

```js
    usersSourceOverrides: await getSourceOverridesForUserAndPokemon(
      userId,
      req.body.pokemonId
    ),
    homeRegionCatchIds: await getHomeRegionCatchIds(userId, req.body.pokemonId),
```

`api/src/users-pokemon/users-pokemon-routes.js`: extend the repository
import with `getHomeRegionCatchIds`, add
`import { getSourceOverridesForUserAndPokemon } from '../users/source-overrides-repository.js'`,
then:

- PUT `/users-pokemon` response adds:

```js
    usersSourceOverrides: await getSourceOverridesForUserAndPokemon(
      userId,
      req.body.pokemonId
    ),
    homeRegionCatchIds: await getHomeRegionCatchIds(userId, req.body.pokemonId),
```

- DELETE `/users-pokemon` response adds:

```js
    homeRegionCatchIds: await getHomeRegionCatchIds(userId, req.body.pokemonId),
```

- PUT `/users-pokemon/evolve` response adds:

```js
    homeRegionCatchIds: await getHomeRegionCatchIds(
      userId,
      req.body.oldPokemonData.pokemonId
    ),
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd api && node --test test/home-region.test.js`
Expected: PASS
Then: `cd api && npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add api/src/users-pokemon/users-pokemon-repository.js api/src/pokemon/pokemon-routes.js api/src/users-pokemon/users-pokemon-routes.js api/test/home-region.test.js
git commit -m "feat: expose home-region catch ids; drop stored original links

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Front end — three-state override cycle, thicker border, override-refresh bug

**Files:**
- Modify: `app/src/components/home/home.jsx:87-146`
- Modify: `app/src/components/home/sources-list/sources-list.scss:23-26`

**Interfaces:**
- Consumes: existing PUT/DELETE `/api/user/source-override` endpoints (the
  PUT already upserts with an explicit `isRequired` — no API change needed);
  Task 5's `usersSourceOverrides`/`homeRegionCatchIds` response fields.
- Produces: `catchData.homeRegionCatchIds` in state (Task 7 consumes it).

- [ ] **Step 1: Implement the three-state cycle**

In `app/src/components/home/home.jsx`, replace `handleToggleSourceOverride`'s
override branch (keep the surrounding try/catch, refresh fetch, stale-drawer
guard, and `refreshPokemonList()` exactly as they are):

```js
      const existing = catchData?.usersSourceOverrides?.find(
        x => x.sourceId === source.id
      )
      // Cycle: follow rules -> always required -> never required -> follow rules
      if (!existing) {
        await axios.put('/api/user/source-override', {
          sourceId: source.id,
          isRequired: true,
        })
      } else if (existing.isRequired) {
        await axios.put('/api/user/source-override', {
          sourceId: source.id,
          isRequired: false,
        })
      } else {
        await axios.delete(`/api/user/source-override/${source.id}`)
      }
```

Delete the now-unused `typeRequiredByRules` function (verify with a search
that nothing else references it).

- [ ] **Step 2: Fix the override-wipe on setPokemonState and thread homeRegionCatchIds**

Replace `setPokemonState`:

```js
  const setPokemonState = usersPokemonData => {
    const {
      sources,
      usersPokemon,
      usersPokemonSources,
      pokeballs,
      gameVersions,
      usersPokemonEvolutionSources,
      usersSourceOverrides,
      homeRegionCatchIds,
    } = usersPokemonData

    setActivePokemonSources(sources)
    setUsersPokemon(usersPokemon)
    // Payloads that omit overrides or home-region ids must not wipe them.
    setCatchData(prev => ({
      usersPokemonSources,
      pokeballs,
      gameVersions,
      usersPokemonEvolutionSources,
      usersSourceOverrides: usersSourceOverrides ?? prev?.usersSourceOverrides,
      homeRegionCatchIds: homeRegionCatchIds ?? prev?.homeRegionCatchIds,
    }))
  }
```

And in `handleUpdateUsersPokemon`, `handleEvolvePokemon`, and
`handleDeleteUsersPokemon`, add to each `Object.assign({}, catchData, {...})`
object (alongside the existing keys):

```js
      homeRegionCatchIds:
        usersPokemonData.data?.homeRegionCatchIds ?? catchData?.homeRegionCatchIds,
```

and in `handleUpdateUsersPokemon` only (its response now carries overrides):

```js
      usersSourceOverrides:
        usersPokemonData.data?.usersSourceOverrides ?? catchData?.usersSourceOverrides,
```

- [ ] **Step 3: Thicken the forced-required border**

In `app/src/components/home/sources-list/sources-list.scss`:

```scss
.override-required {
  outline: 3px solid #4caf50;
  outline-offset: -3px;
}
```

- [ ] **Step 4: Build and smoke-test**

Run: `cd app && npm run build`
Expected: build succeeds.

Manual check (dev stack up, http://localhost:3000, log in via
`/api/auth/dev-login`): open a pokemon drawer; click an unachieved pill
three times — it should go solid-green (thicker), then dashed-dim, then back
to normal, with no dead states; log a new catch and confirm existing green
borders survive without reopening the drawer.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/home/home.jsx app/src/components/home/sources-list/sources-list.scss
git commit -m "feat: three-state source override cycle; keep overrides on refresh

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Front end — derived home-region pill, dropdown removal, catch tag

**Files:**
- Modify: `app/src/components/home/home.jsx` (pass prop)
- Modify: `app/src/components/home/sources-list/sources-list.jsx:134-231, 347-378`
- Modify: `app/src/components/home/catch/catch.jsx:27-56`

**Interfaces:**
- Consumes: `catchData.homeRegionCatchIds` (Task 6),
  `props.homeRegionCatchIds` (array of users_pokemon uuids).
- Produces: none consumed later.

- [ ] **Step 1: Pass the prop**

In `home.jsx`'s `renderDrawer` 'sources' case, add to the `<SourcesList>`
props:

```js
            homeRegionCatchIds={catchData?.homeRegionCatchIds}
```

- [ ] **Step 2: Render the original pill from derived state**

In `sources-list.jsx` `renderSources()`, after the `overrideClass` helper,
partition out the original source and build its pill:

```js
    const originalSource = props.activePokemonSources.find(x => x.source === 'original')
    const nonOriginalSources = props.activePokemonSources.filter(
      x => x.source !== 'original'
    )
    const homeRegionAchieved = Boolean(props.homeRegionCatchIds?.length)

    const originalPill = originalSource ? (
      <span
        key={originalSource.id}
        className={`${
          homeRegionAchieved ? 'unlocked-source-pill' : 'locked-source-pill'
        } ${overrideClass(originalSource)}`}
        onClick={e => {
          e.stopPropagation()
          props.handleToggleSourceOverride(originalSource)
        }}
      >
        {homeRegionAchieved ? (
          <Check className="check-icon" color="white" size={25} strokeWidth={3.5} />
        ) : null}
        {originalSource.name}
      </span>
    ) : null
```

Then replace every use of `props.activePokemonSources` *inside the two
partition branches* (the `rawUnachievedSources`/`rawEvolutionSources`
filters) with `nonOriginalSources`, add `x.source !== 'original'` to the
achieved filter for safety:

```js
      .filter(x => !x.isInherited && x.source !== 'original' && activeSourceIds.has(x.id))
```

and change the return to slot the pill into the matching group:

```js
    return [
      achievedSources,
      homeRegionAchieved ? originalPill : null,
      evolutionAchievedSources,
      unachievedSources,
      homeRegionAchieved ? null : originalPill,
    ]
```

- [ ] **Step 3: Derived tag in the catches modal**

In `renderPokemonRows`'s `renderTags`, before the return, append a derived
tag for qualifying catches (`pokemon.id` here is the users_pokemon row id,
matching `homeRegionCatchIds` contents):

```js
      if (props.homeRegionCatchIds?.includes(pokemon.id))
        nonInheritedTags.push(
          <span key="home-region" className="catch-tag">
            From home region
          </span>
        )
```

- [ ] **Step 4: Remove original from the catch dropdown**

In `catch.jsx`, change `sourceOptions` to skip original sources:

```js
  const sourceOptions = activePokemonSources
    .filter(x => x.source !== 'original')
    .map((x, i) => {
```

and in the edit-mode `useEffect`, filter stored ids against the option list
so a stale original id can never round-trip back on submit:

```js
    const originalIds = new Set(
      (activePokemonSources ?? [])
        .filter(x => x.source === 'original')
        .map(x => x.id)
    )
    setSelectedSources(
      usersPokemonSources
        .filter(x => x.pokemonId === activeUsersPokemon.id)
        .map(x => x.id)
        .filter(id => !originalIds.has(id))
    )
```

(`activePokemonSources` is already destructured from props above the
`useEffect` in the current file, so the effect can reference it directly.)

- [ ] **Step 5: Build and smoke-test**

Run: `cd app && npm run build`
Expected: build succeeds.

Manual check: open a pokemon with no catches — "From home region" pill shows
dim/locked; log a catch in its debut-gen/home-region game — pill turns
achieved with a check, the catches modal shows a "From home region" tag on
that catch, and the catch-log dropdown no longer offers "From home region".

- [ ] **Step 6: Commit**

```bash
git add app/src/components/home/home.jsx app/src/components/home/sources-list/sources-list.jsx app/src/components/home/catch/catch.jsx
git commit -m "feat: derive the home-region pill and tag from catch data

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Front end — drawer loading skeleton (kill the source flash)

**Files:**
- Modify: `app/src/components/home/home.jsx:67-85, 241-287`
- Modify: `app/src/components/home/home.scss` (append)

**Interfaces:** none new.

- [ ] **Step 1: Clear stale state on drawer open**

In `home.jsx` `handleOpenDrawer`, in the else branch (opening a new drawer),
clear the previous pokemon's data before fetching:

```js
    } else {
      openDrawerIndexRef.current = pokemonId
      setOpenDrawerIndex(pokemonId)
      // Clear the previous pokemon's data so the drawer never flashes it.
      setActivePokemonSources(null)
      setUsersPokemon([])
      setCatchData(null)
      const genIdParameter = gameGenForFiltering
        ? `&generationId=${gameGenForFiltering}`
        : ''
      const usersPokemonData = await axios.get(
        `/api/pokemon?pokemonId=${pokemonId}${genIdParameter}`
      )
      if (!usersPokemonData.data) return

      setPokemonState(usersPokemonData.data)
    }
```

Note: `setCatchData(null)` means the `prev?.usersSourceOverrides` fallback
in `setPokemonState` starts empty for the new pokemon — correct, since
overrides are per-pokemon on this payload.

- [ ] **Step 2: Render the skeleton while loading**

In `renderDrawer`, at the top of the 'sources' case:

```js
      case 'sources':
        if (!activePokemonSources || !catchData) {
          drawerContents = (
            <div className="sources-loading">
              {[0, 1, 2, 3].map(i => (
                <span key={i} className="skeleton-pill" />
              ))}
            </div>
          )
          break
        }
```

(keep the existing `<SourcesList .../>` assignment after it for the loaded
case)

- [ ] **Step 3: Skeleton styles**

Append to `app/src/components/home/home.scss`:

```scss
.sources-loading {
  display: flex;
  flex-wrap: wrap;
  padding: 10px 5px;
  min-height: 45px;
}

.skeleton-pill {
  width: 110px;
  height: 31px;
  margin: 5px;
  background-color: rgba(0, 0, 0, 0.25);
  animation: skeleton-pulse 1.2s ease-in-out infinite;
}

@keyframes skeleton-pulse {
  0%,
  100% {
    opacity: 0.45;
  }
  50% {
    opacity: 0.9;
  }
}
```

- [ ] **Step 4: Build and smoke-test**

Run: `cd app && npm run build`
Expected: build succeeds.

Manual check: open one pokemon's drawer, then immediately open another —
the second drawer shows pulsing skeleton pills, never the first pokemon's
sources.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/home/home.jsx app/src/components/home/home.scss
git commit -m "fix: skeleton drawer instead of stale-source flash

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: Box view — transfer paths, isolated games, display agreement

**Files:**
- Modify: `app/package.json` (add vitest)
- Modify: `app/src/components/box-view/box-view.logic.js` (add pure functions)
- Create: `app/src/components/box-view/box-view.logic.test.js`
- Modify: `app/src/components/box-view/box-view.jsx:78-141`
- Modify: `app/src/components/box-view/box/box.jsx`
- Modify: `app/src/components/box-view/box-checklist/box-checklist.jsx`
- Modify: `api/src/pokemon/pokemon-repository.js`,
  `api/src/pokemon/pokemon-utils.js`, `api/src/pokemon/completion.js`,
  `api/test/completion.test.js` (cleanup: remove `usersSourcesByGen` and
  `caughtInGens`)

**Interfaces:**
- Consumes: `mon.usersCatches` and `requiredSources[].caughtIn` from Task 4
  (`{gameId, gen, isolationGroup, transferGen}`); `selectedVersion` is a
  full camelized `game_versions` row (has `generationId`, `isolationGroup`,
  `id`).
- Produces (in `box-view.logic.js`):
  - `transferPathOk(catchGen: number, versionGen: number): boolean`
  - `catchSatisfiesBox(c, version): boolean`
  - `completeRecordsForVersion(usersBoxData, version): string[]`
  - `isShownInBox(mon, completeRecords: string[]): boolean`

- [ ] **Step 1: Add vitest**

```bash
cd app && npm install --save-dev vitest
```

Add to `app/package.json` scripts:

```json
    "test": "vitest run"
```

- [ ] **Step 2: Write the failing tests**

Create `app/src/components/box-view/box-view.logic.test.js`:

```js
import { describe, it, expect } from 'vitest'
import {
  transferPathOk,
  catchSatisfiesBox,
  completeRecordsForVersion,
  isShownInBox,
} from './box-view.logic'

const normalCatch = (gen, extra = {}) => ({
  gameId: 1,
  gen,
  isolationGroup: null,
  transferGen: null,
  ...extra,
})
const version = (generationId, extra = {}) => ({
  id: 99,
  generationId,
  isolationGroup: null,
  ...extra,
})

describe('transferPathOk', () => {
  it('allows same or forward gens from 3 onward', () => {
    expect(transferPathOk(3, 3)).toBe(true)
    expect(transferPathOk(3, 4)).toBe(true)
    expect(transferPathOk(4, 3)).toBe(false)
  })
  it('allows gen 1-2 movement but never into gen 3+', () => {
    expect(transferPathOk(1, 2)).toBe(true)
    expect(transferPathOk(2, 2)).toBe(true)
    expect(transferPathOk(1, 7)).toBe(false)
    expect(transferPathOk(2, 3)).toBe(false)
  })
})

describe('catchSatisfiesBox', () => {
  it('uses the gen rule for normal games', () => {
    expect(catchSatisfiesBox(normalCatch(3), version(5))).toBe(true)
    expect(catchSatisfiesBox(normalCatch(1), version(3))).toBe(false)
  })

  it('an isolated box only accepts catches from its own group', () => {
    const letsGoBox = version(7, { isolationGroup: 'lets-go' })
    expect(
      catchSatisfiesBox(
        normalCatch(7, { isolationGroup: 'lets-go', transferGen: 8 }),
        letsGoBox
      )
    ).toBe(true)
    expect(catchSatisfiesBox(normalCatch(7), letsGoBox)).toBe(false)
    expect(catchSatisfiesBox(normalCatch(3), letsGoBox)).toBe(false)
  })

  it('colosseum and xd are separate groups', () => {
    const colCatch = normalCatch(3, { isolationGroup: 'colosseum' })
    expect(catchSatisfiesBox(colCatch, version(3, { isolationGroup: 'xd' }))).toBe(false)
    expect(
      catchSatisfiesBox(colCatch, version(3, { isolationGroup: 'colosseum' }))
    ).toBe(true)
  })

  it("a Let's Go catch skips gen 7 boxes but reaches gen 8 via Home", () => {
    const lgCatch = normalCatch(7, { isolationGroup: 'lets-go', transferGen: 8 })
    expect(catchSatisfiesBox(lgCatch, version(7))).toBe(false)
    expect(catchSatisfiesBox(lgCatch, version(8))).toBe(true)
  })

  it('a colosseum catch works in normal gen 3+ boxes (trades out to GBA)', () => {
    const colCatch = normalCatch(3, { isolationGroup: 'colosseum' })
    expect(catchSatisfiesBox(colCatch, version(3))).toBe(true)
    expect(catchSatisfiesBox(colCatch, version(4))).toBe(true)
  })
})

describe('completeRecordsForVersion', () => {
  it('finds the records for the selected game, defaulting to empty', () => {
    const boxData = [{ gameId: 3, completeRecords: ['25'] }]
    expect(completeRecordsForVersion(boxData, { id: 3 })).toEqual(['25'])
    expect(completeRecordsForVersion(boxData, { id: 4 })).toEqual([])
    expect(completeRecordsForVersion(null, { id: 3 })).toEqual([])
  })
})

describe('isShownInBox', () => {
  const mon = { recordKey: '25', isCaught: true }
  it('needs both a valid catch and a checked record', () => {
    expect(isShownInBox(mon, ['25'])).toBe(true)
    expect(isShownInBox({ ...mon, isCaught: false }, ['25'])).toBe(false)
    expect(isShownInBox(mon, [])).toBe(false)
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd app && npm test`
Expected: FAIL — the functions don't exist in `box-view.logic.js` yet.

- [ ] **Step 4: Implement the pure logic**

Append to `app/src/components/box-view/box-view.logic.js`:

```js
// Gens 1-2 and 3+ have no transfer path between them.
export const transferPathOk = (catchGen, versionGen) =>
  catchGen <= versionGen && !(catchGen <= 2 && versionGen >= 3)

// c: {gameId, gen, isolationGroup, transferGen}; version: a game_versions row.
// Isolated boxes (Let's Go, Colosseum, XD) only count catches from their own
// group. Catches from isolated games leave via transferGen (Let's Go -> 8 via
// Home) or their own gen (Colosseum/XD trade out to GBA gen 3).
export const catchSatisfiesBox = (c, version) => {
  if (version.isolationGroup) return c.isolationGroup === version.isolationGroup
  const effectiveGen = c.transferGen ?? c.gen
  return transferPathOk(effectiveGen, version.generationId)
}

export const completeRecordsForVersion = (usersBoxData, version) =>
  usersBoxData?.find(game => game.gameId === version.id)?.completeRecords ?? []

// The single definition of "shown as in-box": a valid catch AND a checked
// record. Sprite, read-mode checklist, and edit-mode checkbox all use this.
export const isShownInBox = (mon, completeRecords) =>
  Boolean(mon.isCaught) && completeRecords.includes(mon.recordKey)
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd app && npm test`
Expected: PASS (all box-view.logic tests)

- [ ] **Step 6: Use the logic in box-view.jsx**

In `app/src/components/box-view/box-view.jsx`:

- Import: `import { catchSatisfiesBox } from './box-view.logic'`
- Delete the local `transferPathOk` const (lines 78–80).
- In `handleFilterPokemon`, the entry map becomes:

```js
              isCaught: (entry.caughtIn || []).some(c =>
                catchSatisfiesBox(c, selectedVersion)
              ),
```

- The base-entry computation becomes:

```js
        const isCaught = (mon.usersCatches || []).some(c =>
          catchSatisfiesBox(c, selectedVersion)
        )
```

- [ ] **Step 7: Align the three displays**

`app/src/components/box-view/box/box.jsx` — drop the local
`completeRecords` state and its `useEffect` (the duplicated-effect TODO);
derive directly and gate the sprite:

```js
import { wallpapers, largeWallpaper, completeRecordsForVersion, isShownInBox } from '../box-view.logic'
```

```js
  const completeRecords = completeRecordsForVersion(usersBoxData, selectedVersion)
```

and in `renderPokemon`:

```js
          const transparent = isShownInBox(mon, completeRecords) ? '' : 'transparent'
```

`app/src/components/box-view/box-checklist/box-checklist.jsx` — import the
helpers, initialize the edit buffer from the shared derivation, align both
display modes, and prune stale records on save:

```js
import { completeRecordsForVersion, isShownInBox } from '../box-view.logic'
```

The `useEffect` body becomes:

```js
  useEffect(() => {
    setCompleteRecords(completeRecordsForVersion(usersBoxData, selectedVersion))
  }, [usersBoxData, selectedVersion])
```

Read-mode cell:

```js
            <td className="checklist-checkbox">
              {isShownInBox(pokemon, completeRecords) ? '✅' : '⬜'}
            </td>
```

Edit-mode checkbox (a stale record shows unchecked, matching what read mode
displays):

```js
              <input
                type="checkbox"
                onChange={e => handleRecordChange(e.target.checked, pokemon)}
                disabled={!pokemon.isCaught}
                checked={pokemon.isCaught && completeRecords.includes(pokemon.recordKey)}
              />
```

Save prunes keys that are no longer caught (unknown keys are kept —
conservative against dex-filter changes):

```js
  const handleChecklistSave = () => {
    const pruned = completeRecords.filter(key => {
      const mon = filteredPokemon.find(m => m.recordKey === key)
      return mon ? mon.isCaught : true
    })
    handleUpdateUsersBoxData(pruned)
  }
```

- [ ] **Step 8: API cleanup — remove the now-unused gen-only shapes**

The box view was the only consumer of `usersSourcesByGen` and
`caughtInGens`. Verify, then remove:

Run: `grep -rn "usersSourcesByGen\|caughtInGens" app/src api/src`
Expected remaining hits only in `api/src/pokemon/` (producer side).

- `api/src/pokemon/pokemon-utils.js`: delete `getUsersSourcesByGen`.
- `api/src/pokemon/pokemon-repository.js`: remove the
  `getUsersSourcesByGen` import and the `usersSourcesByGen` key from the
  returned object. Keep the `users_sources_by_gen` aggregate in the SQL —
  `buildRequiredSources` still reads the raw `mon.usersSourcesByGen` rows
  for per-source `caughtIn`.
- `api/src/pokemon/completion.js`: in `buildRequiredSources`, delete the
  `caughtInGens: caughtIn.map(c => c.gen),` line.
- `api/test/completion.test.js`: replace the two `caughtInGens` assertions
  with their `caughtIn` equivalents:

```js
    assert.deepEqual(
      byId['src-a'].caughtIn.map(c => c.gen),
      [2]
    )
    assert.deepEqual(byId['src-b'].caughtIn, [])
```

- [ ] **Step 9: Run everything**

Run: `cd api && npm test`
Expected: PASS
Run: `cd app && npm test && npm run build`
Expected: PASS + build succeeds.

Manual check (box view): pick "Gen 1" — pokemon caught in gen 1 show
caught; switch to "Gen 3" — gen-1-only catches show uncaught; "Let's Go" —
only Let's Go catches count; a checked record whose catch was deleted shows
unchecked in sprite, read mode, and edit mode alike.

- [ ] **Step 10: Commit**

```bash
git add app/package.json app/package-lock.json app/src/components/box-view api/src/pokemon api/test/completion.test.js
git commit -m "feat: isolated-game box rules and single in-box display rule

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 10: Docs, backlog triage, findings cleanup

**Files:**
- Modify: `docs/BACKLOG.md` (append entries)
- Modify: `docs/domain.md`
- Modify: `docs/phase-3-deploy.md`
- Modify: `docs/ROADMAP.md:93`
- Delete: `PHASE-3-FINDINGS.md`, `phase-3-user-testing.md`

**Interfaces:** none.

- [ ] **Step 1: Backlog entries**

Read `docs/BACKLOG.md` first and match its formatting/section conventions.
Add entries (adjusting wording to house style):

- Declined for now — gen 2 → gen 1 Time Capsule back-trades in box view
  (a gen 2 catch of a gen-1 dex pokemon could satisfy gen 1 boxes).
- Declined for now — Virtual Console gen 1–2 → gen 7 transfer path (only
  correct if gen 1–2 playthroughs are on 3DS VC; app can't tell from the
  game alone).
- Note — box view is deliberately form-only (decision 2026-08-18): if a
  global non-standard source rule (e.g. shiny) ever ships, box rows for it
  need the `entryMakesBoxRow` gate revisited.
- Note — Hisuian form rows don't exist in the dex data; when they're added
  (phase 7), set `pokemon.home_region = 'Hisui'` for them.

- [ ] **Step 2: domain.md updates**

In `docs/domain.md`:

- Under **Sources**, add to "Decisions already made":

```markdown
- "From home region" (the `original` source type) is **derived, not
  logged**: a catch qualifies iff its game's generation equals the
  pokemon's `original_gen` AND the game's region equals the pokemon's
  `home_region` (so SoulSilver Sinnoh catches, remakes, and Let's Go don't
  count). Stored `original` links were deleted; the pill and catch tags
  compute from catch data. Evolution needs no special case — the evolved
  record keeps the original catch's game, so the check runs against the
  evolution's own home games.
```

- Under **Games and dex rules**, add:

```markdown
- Isolated games (`isolation_group`): Let's Go pair (`lets-go`), Colosseum
  (`colosseum`), XD (`xd`). Their boxes only count catches from the same
  group. Outbound, a game's catches transfer as `transfer_gen` (Let's Go:
  8, via Home) or their own gen (Colosseum/XD trade out to GBA gen 3).
- `game_versions.region` / `pokemon.home_region` back the home-region rule;
  peripherals (Channel, Box, Ranch, Ranger, Battle Revolution) have null
  region and are never home games.
```

- [ ] **Step 3: Deploy runbook**

In `docs/phase-3-deploy.md`, add to the **Sequence** section after step 2:

```markdown
2b. **Apply the phase-3 findings migration**:
   `adhoc/scripts/migrations/2026-08-phase3-findings.sql` (regions,
   home regions, isolation groups, and deletion of stored
   `original`-type source links — the deploy's code derives home-region
   completion and errors nowhere without it, but users would see wrong
   home-region state until it runs; apply it in the same window as step 2).
```

And add to the **Smoke test** list:

```markdown
   - Home-region pill: a pokemon caught in its debut game shows the
     "From home region" pill achieved without a stored tag.
   - Box view isolated games: the Let's Go box only shows catches made in
     Let's Go.
```

- [ ] **Step 3b: Strike the contradicting box-row line in the old spec**

In `docs/superpowers/specs/2026-08-18-phase-3-core-v1-design.md` line 97,
replace:

```markdown
- Forced types with no current `case` (e.g. shiny) get box rows for free.
```

with:

```markdown
- Individually forced (pill-override) sources get box rows; a *globally*
  enabled non-standard rule (e.g. shiny) deliberately does not — box view
  is form-only (decision 2026-08-18, see the phase-3 findings spec).
```

- [ ] **Step 4: Roadmap and findings files**

- `docs/ROADMAP.md` line 93: change to
  `- [x] Fix remaining issues after manual testing (spec: docs/superpowers/specs/2026-08-18-phase-3-findings-design.md)`
- Delete `PHASE-3-FINDINGS.md` and `phase-3-user-testing.md` (per the
  findings file's own instruction, now that durable copies are triaged).

```bash
git rm PHASE-3-FINDINGS.md phase-3-user-testing.md
```

- [ ] **Step 5: Commit**

```bash
git add docs/BACKLOG.md docs/domain.md docs/phase-3-deploy.md docs/ROADMAP.md docs/superpowers/specs/2026-08-18-phase-3-core-v1-design.md
git commit -m "docs: triage phase-3 findings into backlog; record new domain rules

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Final verification (after all tasks)

- [ ] `cd api && npm test` — full suite green.
- [ ] `cd app && npm test && npm run build` — green + builds.
- [ ] Manual pass over the phase-3-user-testing scenarios: evolution tag
  behavior (Wurmple→Cascoon keeps home-region credit, Tangela→Tangrowth
  doesn't, gender carries Finneon→Lumineon), three-state pills, no source
  flash, box view isolated games and display agreement.
- [ ] Use superpowers:finishing-a-development-branch to merge
  `phase-3-findings` back to `master`.
