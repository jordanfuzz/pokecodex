# Backlog

Triaged from the pre-hiatus Obsidian board, board cards, and the 2026 revival
recap. This file is the single fix/feature list; [ROADMAP.md](ROADMAP.md) says
when classes of work happen. Within a section, items are roughly ordered by
priority. Data-gathering work lives in [source-data.md](source-data.md).

## Core v1 issues (roadmap phase 3)

- [x] `isComplete` for variant forms is broken: rules check whether the user
      has *any* variant form instead of *all* of them (e.g. one Unown letter
      marks the whole record complete)
- [x] Personal source overrides: a user whose general rules exclude a source
      type (e.g. shiny) can click that source pill on one pokemon's row to
      require it for that row only. Box view checklist must respect overrides.
- [x] Date picker is wonky/not rendering (MUI styling; consider replacing MUI
      with an in-house picker — decide during fix). Likely origin found
      2026-08: two rules in `catch.scss` (`.edit-date-picker input` line 83,
      `.no-border .MuiInput-underline:before` line 91) target the old
      TextField DOM. x-date-pickers now renders `MuiPickersTextField` with
      section spans and a visually-hidden `<input>`, so neither rule matches
      and both the text colour and the underline override are dead
- [ ] Re-evaluate v1 scope when phase 3 starts (old MVP definition: completion
      checkboxes correct under all rules; box viewer works; gen 1 sources
      finished; then reset Jordan's user data and start tracking for real)

## Bugs

- [x] `catch.jsx` calls `useEffect` (line 37) *after* the
      `if (!activePokemonSources || !catchData) return null` guard (line 35).
      The hook count changes between renders as soon as catch data arrives,
      which React throws on. Fixing means moving the guard below the hook and
      guarding inside the effect instead (found 2026-08)
- [x] Logged-out `/box-view` renders a blank page: `box-view.jsx:228` returns
      null on missing data before the `shouldRedirect` `<Navigate>` at line
      230, so the redirect to `/login` never happens (found 2026-08)
- [x] Notes aren't copied to the evolved pokemon on evolve — the note is lost
- [x] Complete source pills still show in gens they shouldn't
- [x] New users are broken until they set rules (mechanism found 2026-08:
      `users-routes.js:8` can't tell "no rules yet" from a query failure and
      500s either way; the 500 rejects `loadUserData` in `home.jsx:42`, which
      has no catch, so the rest of the page load is abandoned.
      `pokemon-repository.js:34` also throws on `rows[0].user_rules` for a
      userId with no row)
- [x] Uncontrolled component error in Rules component (confirmed still present
      2026-08: React warns about uncontrolled→controlled input on load —
      `ruleState` starts null, so `checked={ruleState && ruleState['gender']}`
      is null on the first render; `rules.jsx` lines 48, 61, 72, 83, 94, 105,
      116, 127)
- [x] Unhandled promise rejection in UI when the auth check 401s on the
      logged-out landing page (found 2026-08 — `login.jsx:12`, an
      `axios.get('/api/auth/login').then(...)` with no `.catch()`. The same
      pattern without try/catch is in `home.jsx:42`, `box-view.jsx:36` and
      `sources.jsx:36`)
- [x] Box view can crash on a game with no `users_box_data` row: `box.jsx:38`
      and `box-checklist.jsx:25` dereference `boxDataForVersion
      .completeRecords` without a guard, and rows are only created by the
      one-time setup call (found 2026-08)
- [x] Box view drops gender/regional/variant entries when rules arrive after
      the pokemon list: the filter effect at `box-view.jsx:54` omits
      `usersRules` from its dependencies and never re-runs (found 2026-08)
- [x] Editing a catch whose game version isn't in the dropdown list throws —
      `catch.jsx:46` reads `.id` off an unchecked `.find()` (found 2026-08)
- [x] Clearing the date field in the catch editor throws: `catch.jsx:194` calls
      `newDate.toISO()` and the picker passes null on clear (found 2026-08)
- [x] Clicking between records briefly shows the sources for the wrong pokemon
      (likely worsened by array-index React keys — `home.jsx:264`,
      `sources-list.jsx:353`, `box.jsx:64`, `box-checklist.jsx:66`,
      `sources.jsx:90` — which keep row state attached to a position rather
      than a pokemon when the filtered list changes)
- [x] Multiselect source dropdown is closing itself
- [x] Shiny tag should not be grayed out after evolve
- [x] When evolving a shiny pokemon, the evolution should be shiny
- [x] Shouldn't have double evolved tags
- [x] Game list dropdown is not sorting games correctly
- [x] Changing gens in box view should reset to box 1 (`box-view.jsx:219`
      `handleVersionChange` never touches `selectedBox`; the game `<select>` at
      line 240 also has no `value`, so it can drift out of sync with
      `selectedVersion`)
- [x] In box view, caught pokemon shouldn't be available between gens 2–3
- [ ] Add limits to text inputs that don't save if they're too long
      (deferred from phase 3)
- [ ] Account for Nincada's evolution (two evolutions from one) (deferred from
      phase 3)
- [ ] Conditional evolution requirements: Basculin→Basculegion only if
      white-striped; Salandit→Salazzle only if female; etc. (deferred from
      phase 3)

## Tech debt

- [x] No `authCheck` on any data route: `app.js:93` defines it but only
      `GET /` (line 104) uses it. Every `/api` route takes the userId from the
      query string or body and trusts it, so an unauthenticated request can
      read or write any user's data given an id. Fix is to mount `authCheck`
      on the routers and take the userId from `req.user` instead of the client
      (found 2026-08)
- [x] Error-handling middleware in `app.js`: a thrown repository error falls
      through to Express's default handler, which returns an HTML page with
      the stack trace whenever `NODE_ENV` isn't `production`. Routes should
      catch and return JSON. (Verified 2026-08 during phase 3: the JSON error
      middleware already existed since phase 2 — `app.js:110-113` — routes
      just needed to propagate errors to it, which the authCheck work above
      now does)
- [ ] Handlers dereference request data that may not be there: `req.body.*` in
      `sources-routes.js:14-17`, `users-routes.js:14` and
      `users-pokemon-routes.js:27,42,57,64` (under Express 5 a body-less
      request 500s rather than 400s), and `rows[0]` in
      `sources-repository.js:20` and `pokemon-repository.js:34` for a userId
      with no row. Low priority — the UI always sends JSON
- [ ] Multi-statement writes aren't transactional: `updateUsersPokemon`,
      `addPokemonForUser`, `evolveUsersPokemon` and `setupBoxDataForUser` in
      `users-pokemon-repository.js` fire independent queries, so a failure
      part-way through leaves users_pokemon and users_pokemon_sources out of
      step. Wrap each in a pooled client + BEGIN/COMMIT
- [ ] The "resend everything" response block (`getUsersPokemonSources` +
      `getEvolutionSourcesForPokemon` + pokeballs + game versions) is
      copy-pasted across five handlers — `pokemon-routes.js:46` and
      `users-pokemon-routes.js:25,40,55,62`. Extract one builder
- [ ] `GET /api/users-pokemon` (`users-pokemon-routes.js:16`) is dead — the UI
      only uses PUT/DELETE on that path
- [ ] `app.js:24` sets `trust proxy` only in development; production is the
      side that sits behind a reverse proxy. Confirm which is wanted
- [ ] `app.js:71` passes `callbackUrl` to the Discord strategy, but passport's
      option is `callbackURL` — the value is silently ignored and the callback
      is derived from the request. Works today; verify against the registered
      redirect URI before changing
- [ ] Admin status isn't stored in cookies/JWT (front+back end check exists,
      but re-derived per request)
- [ ] `home.jsx` is a 338-line component holding ten `useState`s, all fetching
      and all rendering; every handler re-fetches the whole list. Split the
      data layer out of the view. It also fetches `/api/all-pokemon` twice on
      load — once from `loadUserData` (line 45) and once from the
      `gameGenForFiltering` effect (line 54), which also fires on mount
- [ ] Remove `female_image` and `shiny_image` from pokemon table
- [ ] Move remaining `box-view.logic.js` gameData into the `game_versions`
      table (partially done: `limited_dex` arrays are in the DB as of the
      pre-hiatus state — verify what's left in the logic file)
- [ ] Remove `#Game_locations` link (`home.jsx:279`)
- [ ] Align filters with title on list view
- [ ] Open drawer should close when changing filters
- [ ] Sass `@import` is deprecated and goes away in Dart Sass 3 — four
      warnings on every build, from the `styles/colors` import at the top of
      `home.scss`, `catch.scss`, `box.scss` and `box-checklist.scss`.
      Migrating to `@use` means namespacing the variable references
- [ ] Main JS chunk is ~900 kB minified (286 kB gzipped), over Vite's 500 kB
      warning threshold. Route-level code splitting would help most
- [x] `npm audit`: app is clean; api now reports 0 vulnerabilities (was 3 —
      1 low, 1 moderate, 1 high — all via mocha's `diff`/`serialize-javascript`;
      resolved by the phase-3 test-runner swap to node's built-in `node:test`,
      which dropped the mocha dependency)
- [ ] Verify: "Finish up DNS routing and SSL" (believed done — site was live
      at pokecodex.com)
- [ ] `docker-compose.production.yml` (referenced by
      `.github/workflows/main.yml:77`) lives only on the deploy runner, not in
      the repo — bring it into the repo with host paths parameterized
- [ ] `GET /api/pokemon` (`pokemon-routes.js`) fires six serial `await`s where
      the queries are independent — `Promise.all` them (found 2026-08
      phase-3 final review)
- [ ] Drop the now-consumerless `json_agg(distinct(s2.source)) sources`
      aggregate and the `sourcesByType` payload field — nothing reads them
      anymore and they're not free on a perf-sensitive query/payload (found
      2026-08 phase-3 final review)
- [ ] The evolution pill display type list in `sources-repository.js` (3
      types) disagrees with the completion engine's
      `evolutionSatisfiableTypes` (9 types, `completion.js`) — clicking a
      grey pill the engine already treats as satisfied via evolution creates
      a pointless override, since the UI doesn't know that type is
      evolution-satisfiable (found 2026-08 phase-3 final review)
- [ ] `users_box_data` has no `unique(user_id, game_id)` constraint and the
      setup route that creates rows isn't idempotent — a repeat call (or a
      race) can create duplicate rows for the same user/game (found 2026-08
      phase-3 final review)
- [ ] Evolve regression tests to add: inherited id-preservation invariant,
      old-row deletion, chained-evolve dedupe (found 2026-08 phase-3 final
      review)
- [ ] `ROLLBACK` failure in `evolveUsersPokemon` can mask the original error
      that triggered the rollback — the caught error from `ROLLBACK` itself
      propagates instead of the real failure (found 2026-08 phase-3 final
      review)

## Features (post-v1 candidates)

- [ ] Game-filtering modes for the checklist (see gen-filtering card): a mode
      dropdown — by gen (current) / single game ("what do I still need in
      Emerald?") / combined games up to a point in the journey
- [ ] Automated database backups for production
- [ ] Mobile responsive layout + mobile search bar (roadmap phase 5)
- [ ] Description tooltips; simplify date display (time in tooltip or notes)
- [ ] User can set time preference
- [ ] Show images for forms/shiny when evolving
- [ ] Add note about closed beta on login page (maybe invite-only?)
- [ ] Pokewalker: add rule support, plus geographic location on catch log (source exists, no user rule, no geographic location)
- [ ] Add last few missing pokemon with images
- [ ] Limit ball choice when adding pokemon (trade/prize ⇒ default pokeball;
      gens 1–2 ⇒ default pokeball)
- [ ] "Uncaught only" filter (in the Figma alongside "incomplete only" —
      original motivation forgotten; evaluate before building)
- [ ] PKHeX importer - import a save -> adds pokemon (including box view)
- [ ] Add hover effects to yes and no options in confirmation boxes (evolve pokemon, delete pokemon, etc)
- [ ] Source pill hover state - brief description + image for unique forms (gender, shiny, etc)

## Bonus ideas (unordered)

Row/list UX: hover-state icons linking to Bulbapedia/Serebii/catch-location
modal; Bulbapedia catch-location iframe or stored snippet per pokemon (easy
via the MediaWiki API's rendered per-section HTML — see
source-data-feasibility.md); gradient
row color for dual types; cycle main image in open row; improve modal
(blur/transition); keyboard navigation & accessibility; remember filter
settings in localstorage; filter by type; date filter / catch view; search in
box view.

Box view: jump-to-box; count of pokemon in boxes vs needed; per-box complete
checkmark; pokemon details; sprites from selected game; message explaining
excluded sources (e.g. "gender ignored in this gen"); overflow-pokemon
handling; add-pokemon override.

Tracking: dex completion status by gen; catch count in drawer; option to show
shiny as main sprite when caught; remove shiny source for shiny-locked
pokemon; per-gen type differences; evolve method shown with catch location;
track hidden abilities; track giant pokemon (alpha/totem/titan); Pokemon
Home-specific view and rules.

Social/meta: other-player activity feed (most recent catches); user avatars;
header-row checkmark only when all records complete.

Inspiration: https://pokedextracker.com/

## Big future ideas (roadmap phase 8 territory)

The "full-blown playthrough tracker" concept — beyond the pokedex:

- **Journey overview / rules page**: shareable per-user rules, completion
  percentages across all pages, current team, recent catch, pinned achievements
- **Snap!**: fully user-curated screenshot grid (completed photos up top,
  wanted below), pinnable highlights; possibly linked to custom challenges
- **Hall of Fame**: chosen team per game
- **Ribbon dex**: ribbon list unlocked if any pokemon has it; prestige values
  per ribbon; "most prestigious pokemon"
- **Oddities**: showcase for unique pokemon (the Magcargo that "likes to run")
- **Custom challenges**: bucket-list items, optionally linked to a specific
  caught pokemon ("Suicune in a dive ball")
- **Random quest**: suggested oddball catches
- **Team generator**: type-diverse or same-type teams
- **Catch-next suggestion**: based on progress and current game
