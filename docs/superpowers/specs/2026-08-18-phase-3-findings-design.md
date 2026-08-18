# Phase 3 remaining findings — design

Date: 2026-08-18
Status: approved (brainstormed with Jordan; decisions recorded inline)
Scope: the "[ ] Fix remaining issues after manual testing" item of Phase 3 in
[docs/ROADMAP.md](../../ROADMAP.md), covering PHASE-3-FINDINGS.md and
phase-3-user-testing.md. The unit-test audit item is explicitly out of scope
for this work (separate session).

## 1. Ownership-scoped writes (security)

A logged-in user who obtains another user's `users_pokemon` uuid can write to
it. Fix all four write paths in
[api/src/users-pokemon/users-pokemon-repository.js](../../../api/src/users-pokemon/users-pokemon-repository.js),
mirroring how the source-override/box-data code scopes writes:

- `updateUsersPokemon`: remove `user_id = $2` from the SET list; add
  `and user_id = $n` to the WHERE. The follow-up source delete/inserts run
  **only if the UPDATE matched a row** (check `rowCount`) so a failed
  ownership check cannot rewrite another user's `users_pokemon_sources`.
- `updateNoteForUsersPokemon`: add `and user_id = $n` to the WHERE.
- `deleteUsersPokemon`: scope the `users_pokemon_sources` delete via a
  subselect on the owning row (`where users_pokemon_id in (select id from
  users_pokemon where id = $1 and user_id = $2)`); scope the row delete with
  `and user_id`.
- `evolveUsersPokemon`: at the start of the transaction, verify the base row
  with `select … from users_pokemon where id = $1 and user_id = $2 for
  update`; roll back and return without changes if no row matches.

Tests: the phase-3 test that pins the userId-ignored write behavior (commit
89a8011) flips to assert rejection. Add one cross-user-attempt test per write
path (update, note, delete, evolve) asserting no rows change.

## 2. "From home region" becomes auto-computed

### Decision

A catch qualifies as "from home region" iff its game is one of the pokemon's
**home games**: a game whose generation equals `pokemon.original_gen` AND
whose region is the pokemon's home region. Consequences of this definition:

- SoulSilver catch of a Sinnoh pokemon: no (right gen, wrong region).
- FireRed Bulbasaur, BDSP Tangrowth, Let's Go Eevee Vaporeon: no (wrong gen).
- Platinum counts for Diamond/Pearl-debut pokemon (same gen, same region).

Satisfaction is **derived from catch data, not stored**. The manual
"From original region" tag goes away; required-ness of the source is
unchanged (user rules + per-pill overrides).

### Data

- `game_versions` gains `region` (text). Data fill for all rows (~50 games):
  each game's in-world region (Kanto, Johto, Hoenn, Sinnoh, Unova, Kalos,
  Alola, Galar, Hisui, Paldea; spinoffs get their host region where
  meaningful, else null).
- `pokemon` gains `home_region` (text), filled by script: default mapped from
  `original_gen` (1→Kanto, 2→Johto, 3→Hoenn, 4→Sinnoh, 5→Unova, 6→Kalos,
  7→Alola, 8→Galar, 9→Paldea), then an explicit override list:
  - Legends Arceus newcomers (Wyrdeer, Kleavor, Ursaluna, Basculegion,
    Sneasler, Overqwil, Enamorus) and Hisuian forms → Hisui.
  - Meltan and Melmetal → Kanto (home games are the Let's Go pair).
- Migration: delete `users_pokemon_sources` rows whose source is type
  `original` (satisfaction is now derived; stored links would
  double-represent it).

### Behavior

- The main pokemon query ([api/src/pokemon/pokemon-repository.js](../../../api/src/pokemon/pokemon-repository.js))
  already joins catches to `game_versions`; it additionally exposes each
  catch's game generation and region.
- `buildRequiredSources` in [api/src/pokemon/completion.js](../../../api/src/pokemon/completion.js)
  synthesizes the `original` entry's `caughtInGens` from qualifying catches
  instead of reading stored links. `checkCompletion` is unchanged.
- Evolution needs no special logic: the evolved record keeps the original
  catch's game, so the check runs against the evolved pokemon's own home
  games. Gen-3 Wurmple→Cascoon qualifies; gen-1 Tangela→Tangrowth and gen-4
  Bonsly→Sudowoodo do not; gen-4 Tangela→Tangrowth does.
- UI: "From original region" is removed from the catch-log source dropdown.
  The pill in the sources list shows achieved/unachieved automatically (still
  clickable for the required-ness override cycle, section 4). The catches
  modal shows a derived "From home region" tag on qualifying catches.

Tests: completion with/without qualifying catches; evolution cases above;
catch dropdown no longer offers the original source.

## 3. Gender tags on evolve

Mirror the existing shiny swap in `evolveUsersPokemon`: if the base pokemon's
record links a `male`/`female` source and the evolved pokemon has the matching
gender source, delete the base link and insert the evolution's own source
non-inherited. If the evolution has no matching gender source, the link is
dropped with the base record (same as shiny). Ivysaur→Venusaur is unchanged:
Ivysaur has no gender sources, so there is nothing to carry.

Tests: Finneon→Lumineon carries the gender tag non-inherited; a base without
gender sources evolves cleanly.

## 4. Three-state source overrides

- Pill click cycles: **follow rules → always required → never required →
  follow rules**. DB model unchanged (override row with `isRequired`; absence
  = follow rules). Only `handleToggleSourceOverride` in
  [app/src/components/home/home.jsx](../../../app/src/components/home/home.jsx)
  changes: no override → create `isRequired: true`; `isRequired: true` →
  update to `false`; `isRequired: false` → delete. This makes all three
  states always reachable regardless of the current rule, fixing the stale
  override trap.
- Visuals in [sources-list.scss](../../../app/src/components/home/sources-list/sources-list.scss):
  "always required" = solid green border, thicker than today; "never
  required" = dashed + dimmed (unchanged); follow rules = no border.
- Border-disappears bug: the POST `/api/pokemon` (and PUT) response path
  calls `setPokemonState` with a payload lacking `usersSourceOverrides`,
  wiping them from `catchData`. Fix: include `usersSourceOverrides` in those
  API responses, and have `setPokemonState` preserve the previous value when
  a payload omits the key (belt and braces).

Tests: override cycle API behavior (create → update → delete); response
payloads include overrides.

## 5. Box view

- **Stays form-only** (decision b from PHASE-3-FINDINGS.md): `entryMakesBoxRow`
  keeps creating rows only for gender/variant/regional types plus
  individually forced sources. The contradicting spec line is struck; a note
  goes to BACKLOG in case a global non-standard rule (e.g. shiny) ever ships.
- **Isolated games**: Let's Go, Colosseum, and XD boxes count only catches
  made in that same game. Uses `game_versions.is_isolated` (set by migration
  where unset). To make this checkable, `/api/all-pokemon` exposes catch
  *games* (game id alongside gen) and box view's entry data carries
  `caughtInGames` alongside `caughtInGens`.
  - Outbound wrinkle, handled now: catches **made in** Let's Go cannot reach
    contemporaries (no LGPE→Ultra Sun path), so they do not satisfy the
    Gen 7 box; they do count for gen 8+ boxes via Home. Colosseum/XD catches
    trade out to gen 3 normally — no outbound restriction.
  - Declined for now (goes to BACKLOG): gen 2→1 Time Capsule back-trades;
    Virtual Console gen 1–2 → gen 7 transfer path.
- **Display agreement**: one shared helper (also resolving the duplicated
  `completeRecords` effect flagged by TODOs in box.jsx / box-checklist.jsx)
  computes "shown as in-box" = `isCaught && record checked`. The box sprite,
  read-mode checklist, and edit-mode checkbox all use it; edit mode shows
  stale records (checked but no longer `isCaught`) as unchecked and disabled.
  On checklist save, record keys that are no longer `isCaught` for the
  selected game are pruned from `completeRecords`.

Tests: transfer-path helper cases (normal gens, 1–2↔3+ wall, isolated
inbound, LGPE outbound); stale-record pruning.

## 6. Source flash on drawer open

In `handleOpenDrawer` ([home.jsx](../../../app/src/components/home/home.jsx)),
clear `activePokemonSources`/`usersPokemon`/`catchData` before fetching the
newly opened pokemon, and render skeleton pills in the drawer while data is
null. Kills the stale flash of the previous pokemon's sources.

## 7. Docs and cleanup

- Triage both findings files into [docs/BACKLOG.md](../../BACKLOG.md):
  decided/fixed items recorded as such; declined-for-now items (back-trade,
  VC path, global-source box rows) logged as backlog entries. Then delete
  `PHASE-3-FINDINGS.md` and `phase-3-user-testing.md` (per the findings
  file's own instruction).
- Admin /sources page item: done for our purposes — Jordan verifies in prod
  after the phase-3 deploy; anything found goes to BACKLOG.
- New DDL (`game_versions.region`, `pokemon.home_region`, `is_isolated`
  backfill, `original`-links deletion) is appended to
  [docs/phase-3-deploy.md](../../phase-3-deploy.md) in the DDL-before-code
  ordering, with the data-fill scripts runnable via the adhoc container.
- [docs/ROADMAP.md](../../ROADMAP.md): check off "Fix remaining issues after
  manual testing" when this ships; the unit-test audit item remains open.
- [docs/domain.md](../../domain.md): record the home-region definition
  (debut gen + home region, auto-computed) and the isolated-game box rule.
