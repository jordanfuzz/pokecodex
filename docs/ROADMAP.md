# Pokecodex Roadmap

Living roadmap for the 2026 revival. This is the source of truth for project
priorities; the old Obsidian board (`old-notes/Project Board.md`, gitignored) is
historical reference only.

## Context and deadline

Nintendo announced the shutdown of Pokemon Bank (closing **February 2027**). The
app must be usable at least through **gen 7** before then, so all pokemon for
the catch-em-all challenge can be tracked and moved to Pokemon Home in time.
That makes phases 3–4 the critical path; everything from phase 5 onward is soft.

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
- [ ] Add a couple of key skills (run the app, query pokemon data)
- [ ] Distill still-relevant material from `old-notes/` into `docs/`
- [ ] Delete `2026-project-recap.md` once its content is fully absorbed here

Deferred from this phase: autonomous agent loop orchestrator — revisit once
there is a backlog of well-defined tasks for it.

Note: development moved from macOS to Windows; production hosting remains
TrueNAS (Debian). Expect dev-environment assumptions in scripts/docs to need
updating.

### Phase 1.5 — Source-data automation spike (timeboxed, ~1 day)

Answer one question: can the Bulbapedia "game locations" scrubbing be
semi-automated? Output is a short feasibility doc informing phase 4's approach.

- [ ] Investigate Bulbapedia access: it runs MediaWiki, which usually means a
      queryable API even where crawling is blocked; also check for dumps/mirrors
- [ ] Stand up a local PokeAPI instance (official self-host docker-compose) to
      permanently remove the rate-limit/IP-ban risk
- [ ] Write up feasibility findings in `docs/`

### Phase 2 — Audit-driven cleanup

The big lifts (Vite migration, Node/API dependency updates) were already done in
January 2026. Remaining work is an audit, not a rewrite:

- [ ] Verify build and tests pass on Windows
- [ ] Sweep remaining outdated dependencies
- [ ] One code-quality pass producing a prioritized fix list (appended here)

Early findings parking lot (from phase 1 shakeout):

- Unhandled promise rejection in the UI when the auth check 401s on the
  logged-out landing page
- React warning: a component switches an input from uncontrolled to controlled

### Phase 3 — Core issues and planned v1

Known issues carried from the pre-hiatus state:

- [ ] Source variants not counting toward "completion" of a row
- [ ] Date picker not rendering — consider replacing the 3rd-party library with
      an in-house solution
- [ ] Personal source overrides: a user whose general rules exclude (e.g.)
      shinies should be able to click a source pill on one pokemon's row to
      require it for that row only
- [ ] Re-triage the old project board for other v1 items

### Phase 4 — Source data for gens 1–7 (deadline-critical)

Approach determined by the phase 1.5 spike. Finish gathering source data for
all gen 1–7 pokemon.

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
