# Phase 4 increment 2 — staging table + review page: design

Date: 2026-08-18. Approved by Jordan in brainstorming session.

Child spec of
[2026-08-18-phase-4-source-pipeline-design.md](2026-08-18-phase-4-source-pipeline-design.md)
(the parent stays authoritative for the pipeline as a whole). This spec pins
down increment 2: the `staged_sources` table, the staging script, the
admin API, and the review page. It also folds in the requirements from the
increment-1 recon review recorded in
[source-data.md](../../source-data.md): label expected-non-Bulbapedia
source types (pokewalker) in the unmatched view, and add nickname-based
matching to the differ.

## Decisions (brainstormed 2026-08-18)

- **Unified worklist.** `staged_sources` holds all three recon populations
  — missing candidates, matched (audit) candidates, and existing rows with
  no candidate — as one queue, one table, one status machine (approach A;
  two-table and computed-view alternatives rejected as worse for the
  reconcile-per-pokemon workflow).
- **Suggested pairings.** The differ proposes candidate↔existing pairs
  below the match threshold (nickname hits, weak fuzzy matches); the
  reviewer confirms or rejects the pairing on the page instead of
  hand-hunting both lists.
- **Guarded delete.** Deleting an existing `sources` row from the review
  page shows its `users_pokemon_sources` reference count. Unreferenced
  rows hard-delete on approval; referenced rows require an explicit second
  confirmation that also deletes the referencing tracking rows.
- **Stage all gens at once, review per gen.** One idempotent staging run
  covers gens 1–7; the review page's gen filter drives increment 4's
  per-gen workflow. Re-runs refresh pending rows and never touch reviewed
  ones.

## Schema — `staged_sources`

Migration SQL in `adhoc/scripts/migrations/` (house pattern), written
`create table/type if not exists` so test setup can apply it idempotently.
Dev DB only; production gets the migration once the flow is proven
(parent-spec rule).

Enums:

- `staged_row_kind`: `new` (missing candidate), `audit` (candidate matched
  to an existing row), `existing-unmatched` (existing unique-source row
  with no candidate)
- `staged_status`: `pending`, `approved`, `rejected`
- `staged_resolution`: `created`, `updated`, `deleted`, `kept`, `paired` —
  set on approval, records the write that happened
- `staged_confidence`: `low`, `medium`, `high`

Columns:

| Group | Columns |
| --- | --- |
| Identity/state | `id` uuid PK; `row_kind`; `status` (default `pending`); `resolution` null until approved; `natural_key` text unique |
| Candidate payload | `pokemon_id` int FK → pokemon; `name` (mechanical draft); `description` (cleaned area text); `image`; `gen` int; `source` (`source_type` enum, parser's guess); `replace_default` bool default false; `confidence` |
| Pairing/audit | `matched_source_id` uuid FK → sources; `suggested_source_id` uuid FK → sources; `suggestion_reason` text (`nickname`, `fuzzy:<score>`); `created_source_id` uuid; `expected_absent` bool default false |
| Provenance | `page_title`; `revid` int; `raw_snippet` (raw wikitext); `origin` (`availability`/`side-games`/`event-list`/`distribution`/`trades`); `games` text[]; `parser_version`; `staged_at` timestamptz default now(); `reviewed_at` timestamptz |

Semantics:

- `natural_key` is a stable hash of (pokemonId, gen, origin, area) for
  candidates and `existing:<source_id>` for existing-unmatched rows. It is
  the upsert key that makes restaging idempotent.
- On `existing-unmatched` rows the candidate payload and provenance are
  null **except** `pokemon_id` and `gen`, copied from the source row so
  filtering and per-pokemon grouping work; the page displays the live
  `sources` row via the `matched_source_id` join.
- `matched_source_id` means "the existing sources row this staged row is
  about" for both `audit` and `existing-unmatched` kinds.
- `expected_absent` marks rows whose source type cannot appear in
  Bulbapedia availability data (currently: `pokewalker`, hand-gathered
  from Serebii — 120 of the 248 in-scope unmatched rows). The review page
  hides them by default; they are not errors.
- Foreign keys to `sources` do **not** cascade-delete staged rows; the
  approve-delete transaction nulls or resolves them explicitly so the
  audit trail survives.

**Restage semantics** (staging script re-run): upsert by `natural_key`.
Pending rows get payload and provenance refreshed; approved/rejected rows
are never modified (permanent audit trail); pending rows whose natural key
the parser no longer emits are deleted.

## Differ upgrades (`adhoc/src/bulbapedia/differ.js`)

- **Nickname matching**: an exact nickname match between a parsed in-game
  trade and an npc-trade row's name is a full match with `high`
  confidence (recon review: this alone reconciles 6 of 17 unmatched
  npc-trade rows).
- **Suggestion band**: candidate/existing scores in [0.15, 0.34), plus
  pairs currently zeroed by the min-token guard (1-token names), emit
  pairing *suggestions* rather than nothing. Suggestions surface on both
  the candidate row (`suggested_source_id`, `suggestion_reason`) and keep
  the existing row in the unmatched population until confirmed.
- **Confidence heuristic** (increment 3's PKHeX cross-check will upgrade
  this): `high` = exact nickname match; `medium` = structured aux origins
  (event-list, distribution, trades); `low` = fuzzy availability-derived.

## Staging script — `adhoc/scripts/stage-candidates.js`

Runs in the adhoc container against the cache + dev DB:
`docker compose -f compose.dev.yml exec adhoc node scripts/stage-candidates.js`.
`recon-report.js` remains the read-only report; the staging script is the
only cache→DB writer.

- Reuses the increment-1 parse exactly as recon-report.js does
  (availability + classify + aux parsers + differ).
- New pure module `adhoc/src/staging/build-staged-rows.js` maps diff
  output to staged rows — testable without the gitignored cache:
  - collapse per-version duplicates (a Ruby+Sapphire pair of one gift is
    one staged row with `games: {Ruby, Sapphire}`)
  - draft a mechanical name (e.g. "Charmander — FRLG gift"); naming voice
    stays a review-time human concern per the parent spec
  - guess `source_type` from classifier reasons/origin: trade language →
    `npc-trade`, gift language → `gift`, event-list/distribution pages →
    `event`, side-games origin → `side-game`, prize language → `prize`,
    fallback `special`
  - compute `natural_key`, assign `confidence` per the heuristic above
- Provenance: `revid` and `page_title` from the cached page JSON;
  `raw_snippet` is the raw template text of the availability entry — a
  small addition to the availability parser to pass the raw slice through.
  `parser_version` is a constant in `adhoc/src`, bumped on material parser
  changes.
- All writes in one transaction; upsert per the restage semantics above.

## API — `api/src/staged-sources/`

`staged-sources-repository.js` owns all SQL; `staged-sources-routes.js`
mounts under `/api`. Whole router behind a `requireAdmin` middleware
(same `users.is_admin` lookup the sources repository does, applied once at
the router level). Per the parent spec, **nothing writes to `sources`
except these approval routes**.

- `GET /api/staged-sources?gen=&status=&rowKind=&confidence=&includeExpected=`
  — worklist rows joined with the live `sources` row (audit/unmatched
  kinds), pokemon names, and `users_pokemon_sources` reference counts.
  Default filters: `status=pending`, `includeExpected=false`.
- `GET /api/staged-sources/summary` — counts by gen × status × row_kind;
  drives the gen tabs.
- `PATCH /api/staged-sources/:id` — edit `name`, `description`, `source`,
  `gen`, `replaceDefault` on pending rows only.
- `POST /api/staged-sources/:id/approve` — body selects the action where
  the row kind is ambiguous:
  - `new`: no body needed → insert into `sources` (edited values),
    set `created_source_id`, resolution `created`
  - `audit`: `{action: 'no-change'}` → resolution `kept`;
    `{action: 'apply'}` → update the matched `sources` row from the staged
    fields, resolution `updated`
  - `existing-unmatched`: `{action: 'keep'}` → `kept`;
    `{action: 'update'}` → update the row, `updated`;
    `{action: 'delete', confirmReferencedDelete?}` → guarded delete:
    unreferenced rows delete outright; referenced rows 409 without the
    confirm flag, and with it delete the `users_pokemon_sources` rows too;
    resolution `deleted`
  - every variant runs the `sources` write and the staged-row status
    update in a single transaction
- `POST /api/staged-sources/:id/reject` — status `rejected`, no `sources`
  write.
- `POST /api/staged-sources/:id/pairing` `{confirm: bool}` — confirm:
  candidate's `suggested_source_id` promotes to `matched_source_id`,
  `row_kind` flips `new` → `audit`, and the partner `existing-unmatched`
  row auto-resolves (`approved`/`paired`). Reject: suggestion cleared,
  both rows stay pending.
- `POST /api/staged-sources/bulk-approve` — by explicit ids and/or the
  current filter; intended for high-confidence `new` rows.

## Review page — `/review`

New route in [app.jsx](../../../app/src/app.jsx); admin check + redirect
pattern from [sources.jsx](../../../app/src/components/sources/sources.jsx);
plain React + scss per house style. Components under
`app/src/components/review/`.

- **Gen tabs** with pending counts (summary endpoint) select the working
  gen — increment 4's per-gen workflow lives here.
- **Filter bar**: status (default `pending`), row kind, confidence,
  hide-expected toggle (default on).
- **Worklist grouped by pokemon** (sprite + name) so overlapping
  missing/unmatched facts for one pokemon reconcile on one screen (the
  recon report's "not disjoint" caveat).
- Per row: kind badge, confidence chip, inline-editable draft fields
  (name/description/source-type), expandable provenance (raw wikitext,
  page + revid, games list).
- `audit` rows: side-by-side field diff, existing vs parsed, with
  "Existing is fine" / "Apply parsed changes" actions.
- `new` rows: Approve / Reject; a pending suggestion renders a banner
  ("Suggested match: <existing row> — nickname") with Confirm /
  Not-a-match.
- `existing-unmatched` rows: live `sources` row + reference count, with
  Keep / Edit-and-save / Delete (confirmation dialog when referenced).
- **Bulk bar**: select-all-within-filter + bulk approve.

## Testing

- **adhoc unit tests** (existing `adhoc/test/` conventions): differ
  suggestion band and nickname matching; `build-staged-rows` mapping —
  stable natural keys, per-version collapse, source-type guessing,
  confidence assignment.
- **API tests** (node:test + supertest against compose Postgres, existing
  setup): repository CRUD and filters; every approve variant including
  guarded delete with a planted `users_pokemon_sources` reference; pairing
  confirm auto-resolving the partner row; bulk approve; non-admin 401.
  Test setup applies the idempotent migration; tests create and clean up
  their own rows.
- **Smoke acceptance**: one stage-all run against the restored dump;
  staged counts reconcile with the recon report's numbers (1,901
  candidates, 248 in-scope unmatched, 120 expected-absent pokewalker).
  The end-to-end proof remains increment 4's gen 1 slice.

## Out of scope

- PKHeX cross-check and confidence upgrades (increment 3)
- Production migration/deploy of `staged_sources` (after the flow is
  proven on dev, per the parent spec)
- Multi-gen source model fix and "(Gen N)" duplicate migration
  (parent-spec exclusion)
- Mobile layout for the review page (roadmap phase 5)
