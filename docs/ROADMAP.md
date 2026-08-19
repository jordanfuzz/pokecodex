# Pokecodex Roadmap

Living roadmap for the 2026 revival. This is the source of truth for project
priorities; the old Obsidian board (`old-notes/Project Board.md`, gitignored) is
historical reference only.

## Context and deadline

Nintendo announced the shutdown of Pokemon Bank (closing **February 2027**).
All pokemon for the catch-em-all challenge must be tracked and moved to Pokemon
Home before then — and the *in-game collecting* is by far the slowest part of
that. So the app and its gen 1–7 source data need to be done **well before**
the deadline to leave maximum catching time; February is the finish line for
the playthrough, not for the software. Phases 3–4 are the critical path;
everything from phase 5 onward is soft.

Related docs: [BACKLOG.md](BACKLOG.md) (triaged bugs/features),
[domain.md](domain.md) (challenge rules and app domain model),
[source-data.md](source-data.md) (source dataset status, phase 4's worklist).

## Key concept: a pokemon's "source"

A **source** is a method of acquisition for an instance of a pokemon — "wild"
and "hatched" are sources, but so are unique one-time acquisitions: NPC gift
pokemon, static single encounters (e.g. the Red Gyarados in gen 2), in-game
trades, and anything Bulbapedia lists as "only one." Unique sources are tracked
as separate required entries. Gathering this data per pokemon ("source data")
was previously a tedious manual scrub of Bulbapedia "game locations" sections.

## Phases

### Phase 0 — Secure the data (in progress)

Nothing else touches data until this is done.

- [x] Restore SSH access from the Windows desktop (dedicated per-machine key)
- [x] `pg_dump` the production database over SSH; store outside git
- [x] Verify the dump restores cleanly into local Docker Postgres

### Phase 1 — Windows dev environment + agent basics

- [x] Bring up `compose.dev.yml` on Windows against restored data; fix any
      Windows-specific breakage (line endings, volume mounts, etc.)
- [x] Working local login: `GET /api/auth/dev-login` (development only) logs in
      as the most recently seen user, no Discord round-trip; real OAuth creds
      can still be used via `.env` when needed
- [x] Write `CLAUDE.md`: architecture, how to run, data model, the "source"
      concept, gotchas
- [x] Decide whether any agent skills are worth adding now that docs are
      consolidated (deferred; CLAUDE.md may be sufficient)
- [x] Distill still-relevant material from `old-notes/` into `docs/`
      (BACKLOG.md, domain.md, source-data.md; the limited-dex arrays note was
      already absorbed into `game_versions.limited_dex`)
- [x] Delete `2026-project-recap.md`

Deferred from this phase: autonomous agent loop orchestrator — revisit once
there is a backlog of well-defined tasks for it.

Note: development moved from macOS to Windows; production hosting remains
TrueNAS (Debian). Expect dev-environment assumptions in scripts/docs to need
updating.

### Phase 1.5 — Source-data automation spike (timeboxed, ~1 day)

Answer one question: can the Bulbapedia "game locations" scrubbing be
semi-automated? Output is a short feasibility doc informing phase 4's approach.

- [x] Investigate Bulbapedia access: open MediaWiki API, heavily templated
      content, no dumps — semi-automation is feasible (see
      [source-data-feasibility.md](source-data-feasibility.md))
- [x] Local PokeAPI: decided to clone the static `PokeAPI/api-data` repo
      instead of self-hosting — same rate-limit-free access, no stack to run
- [x] Write up feasibility findings in `docs/`
      ([source-data-feasibility.md](source-data-feasibility.md))
- [x] Revisit agent skills: deferred again — reconsider when phase 4 builds
      the parse/review pipeline, where a repeatable workflow would exist

### Phase 2 — Audit-driven cleanup

The big lifts (Vite migration, Node/API dependency updates) were already done in
January 2026. Remaining work is an audit, not a rewrite:

- [x] Verify build and tests pass on Windows
- [x] Sweep remaining outdated dependencies (all majors taken: Express 5,
      Vite 8, react-router 8, MUI 9, dotenv 17, lucide-react 1)
- [x] One code-quality pass; findings went into [BACKLOG.md](BACKLOG.md)

### Phase 3 — Core issues and planned v1

Work the "Core v1 issues" section of [BACKLOG.md](BACKLOG.md), starting with a
re-evaluation of v1 scope against the old MVP definition recorded there.
- [x] First pass of core issues
- [x] Fix remaining issues after manual testing (spec: docs/superpowers/specs/2026-08-18-phase-3-findings-design.md)
- [ ] Automatic testing - What is the unit test coverage of the app at this point? Audit and add tests as needed before moving on.

### Phase 4 — Source data for gens 1–7 (deadline-critical)

Approach determined by the phase 1.5 spike; full worklist in
[source-data.md](source-data.md). Progressive rollout: finish source data one
gen at a time and enable each gen in the app as its data completes.

### Phase 5 — Mobile responsive layout

### Phase 6 — Testing, real usage, and brainstorming next major features

### Phase 7 — Source data for remaining gens and modern spinoff games

### Phase 8 — Bonus features

## Resources

- **PokeAPI** — excellent, but aggressive rate limiting / IP bans. Use the
  local self-hosted instance (phase 1.5) before any bulk data work.
- **Bulbapedia** — only known source for unique-source data. Access strategy
  TBD in phase 1.5.
- **old-notes/** (gitignored) — copied Obsidian notes. Messy, possibly stale;
  don't base core feature assumptions on them without confirming with Jordan.
  `catch-em-all-challenge.md` is the master note for the goal behind the app.
