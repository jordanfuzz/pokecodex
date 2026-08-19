# Phase 4 source-data pipeline — design

Date: 2026-08-18. Approved by Jordan in brainstorming session.

Phase 4 finishes the unique-source dataset for gens 1–7 (roadmap's
deadline-critical path). The old method — manually scrubbing Bulbapedia
per pokemon, stalled near national dex #360 — is replaced by the pipeline
decided in [source-data-feasibility.md](../../source-data-feasibility.md):
parse the local Bulbapedia cache into candidate rows, cross-check against
PKHeX facts, review through an in-app gate, merge into `sources`.

## Current state (verified 2026-08-18)

- **Cache is complete**: `adhoc/bulbapedia-cache/` holds 1,010 pokemon pages
  (full wikitext + revids) and 31 aux pages (in-game trades, per-game event
  lists, per-gen distribution lists). `failures.json` is empty. Gitignored;
  never committed, never re-fetched (incremental refresh by revid if ever
  needed).
- **Sources table**: `pokemon_id, name, description, image, gen (0 = all),
  source` (24-value enum), `replace_default`. ~5,400 rows. Conventions:
  hand-crafted names ("Scamkarp", "Bebe's Eevee"); multi-gen sources are
  duplicate rows with a "(Gen N)" name suffix.
- **Coverage**: 134 distinct pokemon below #360 have unique-source rows and
  76 at/above (targeted passes: legendaries, some events) — coverage above
  #360 is patchy, not empty, so a diff-driven approach beats resuming from a
  bookmark.

## Decisions

- **Per-gen duplicate rows now.** Candidates follow today's "(Gen N)"-suffix
  model. The multi-gen model fix (domain.md) stays out of scope; staged
  provenance makes the eventual migration easier.
- **Names**: the parser emits a mechanical draft name plus raw Bulbapedia
  area text as the description; Jordan polishes names at review time. Naming
  voice is a human concern, not a parsing problem.
- **First slice through the pipeline: gen 1 audit.** Gens 1–2 were fully
  hand-scrubbed, so the diff should be small — a fast end-to-end proof that
  also lets gen 1 be enabled in the app. Then gen 2, then the gen 3
  completion (the big gap), onward through gen 7.
- **Nothing writes to `sources` except review-gate approval.**

## Increment 1 — parser + recon report (read-only)

New scripts under `adhoc/scripts/`, run in the adhoc container against the
cache only. No DB writes.

- **Availability parser**: parses the `{{Availability/…}}` template family
  from each cached page's "Game locations" section into one record per game
  per pokemon: `{pokemonId, game, gen, rawArea, cleanedArea}`. Resolves
  common nested templates (`{{rt}}`, `{{p}}`, `{{pkmn}}`, `{{gdis}}`,
  `{{DL}}`, `{{FB}}`, `{{safari}}`) to plain text. Unparseable entries are
  logged, never silently dropped — the failure list sizes the long tail
  (fallback per feasibility doc: agent-assisted drafting into the same
  staging table).
- **Aux parsers**: per-game event lists (most machine-friendly; one
  structured template per entry), distribution lists, and the in-game
  trades page (wiki tables per generation section).
- **Uniqueness classifier**: tags each availability record
  *candidate-unique* (gift/trade/one-per-save language, links into
  event-list pages) vs *generic* (wild/breed/swarm/raid — already covered
  by generic `wild`/`hatch` rows). Only candidate-unique records become
  staged candidates.
- **Differ + recon report**: joins candidates against existing `sources`
  (pokemon + gen + fuzzy name/description match) and reports per-gen
  coverage, suspected missing sources, and suspected wrong existing rows.
  Sanity checks: should rediscover Stadium 2 Gligar and most of
  source-data.md's "Known point fixes".

## Increment 2 — staging table + review page

- **Table `staged_sources`** (dev DB first; production only once the flow is
  proven): the `sources` columns plus `status`
  (pending/approved/rejected), `confidence`, `matched_source_id` (audit rows
  that correspond to an existing row), and provenance (`page`, `revid`, raw
  wikitext snippet, parser version). A repository module owns all SQL, per
  house style.
- **Admin-only API routes** (same `is_admin` gate as `addSourceForPokemon`):
  list/approve/reject/edit plus bulk-approve filtered by confidence.
- **Review page** in the app: filter by gen/status/confidence, inline edit
  of name/description/source-type before approval, one-click bulk approve of
  high-confidence rows. Approval inserts into `sources`.
- **Audit mode is the same page**: a staged row contradicting an existing
  row shows the diff; approving applies the correction.

## Increment 3 — PKHeX cross-check

Extract statics/gifts/trades facts from PKHeX.Core's legality encounter
tables (gens 1–7) into a JSON facts file; pret decomp tables as tie-breaker
where convenient. Facts only — GPLv3 code is never vendored. The
cross-check sets `confidence` on staged rows: Bulbapedia+PKHeX agreement =
high (bulk-approvable); disagreement = flagged for attention.

## Increment 4 — gen-by-gen rollout

Per gen, in order (1 → 7): generate/refresh that gen's staged candidates
(availability + aux pages + relevant source-data.md point fixes), review,
merge, enable the gen in the app. Gen 1 doubles as the pipeline's
end-to-end proof.

## Out of scope

- Multi-gen source model fix (domain.md) and the "(Gen X)" duplicate
  migration
- Re-fetching Bulbapedia (cache is authoritative; revid-incremental refresh
  only if ever needed)
- Bulbapedia iframe/snippet per pokemon (backlog bonus item)
- Gens 8+ and spinoffs (roadmap phase 7)

## Testing

- Parser/classifier: unit tests over representative wikitext fixtures
  (small excerpts, not full cached pages, so tests don't depend on the
  gitignored cache) — including the nested-template long tail and
  known-tricky pages.
- Differ: unit tests over synthetic candidate/existing-row sets.
- Staging repository + admin routes: node:test + supertest against the
  compose Postgres, matching the existing API test setup.
- End-to-end: the gen 1 audit slice is the acceptance test — small expected
  diff, known point fixes rediscovered.
