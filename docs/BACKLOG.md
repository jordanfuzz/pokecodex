# Backlog

Triaged from the pre-hiatus Obsidian board, board cards, and the 2026 revival
recap. This file is the single fix/feature list; [ROADMAP.md](ROADMAP.md) says
when classes of work happen. Within a section, items are roughly ordered by
priority. Data-gathering work lives in [source-data.md](source-data.md).

## Core v1 issues (roadmap phase 3)

- [ ] `isComplete` for variant forms is broken: rules check whether the user
      has *any* variant form instead of *all* of them (e.g. one Unown letter
      marks the whole record complete)
- [ ] Personal source overrides: a user whose general rules exclude a source
      type (e.g. shiny) can click that source pill on one pokemon's row to
      require it for that row only. Box view checklist must respect overrides.
- [ ] Date picker is wonky/not rendering (MUI styling; consider replacing MUI
      with an in-house picker — decide during fix)
- [ ] Re-evaluate v1 scope when phase 3 starts (old MVP definition: completion
      checkboxes correct under all rules; box viewer works; gen 1 sources
      finished; then reset Jordan's user data and start tracking for real)

## Bugs

- [ ] Notes aren't copied to the evolved pokemon on evolve — the note is lost
- [ ] Complete source pills still show in gens they shouldn't
- [ ] New users are broken until they set rules
- [ ] Uncontrolled component error in Rules component (confirmed still present
      2026-08: React warns about uncontrolled→controlled input on load)
- [ ] Unhandled promise rejection in UI when the auth check 401s on the
      logged-out landing page (found 2026-08)
- [ ] Clicking between records briefly shows the sources for the wrong pokemon
- [ ] Multiselect source dropdown is closing itself
- [ ] Shiny tag should not be grayed out after evolve
- [ ] When evolving a shiny pokemon, the evolution should be shiny
- [ ] Shouldn't have double evolved tags
- [ ] Game list dropdown is not sorting games correctly
- [ ] Changing gens in box view should reset to box 1
- [ ] In box view, caught pokemon shouldn't be available between gens 2–3
- [ ] Add limits to text inputs that don't save if they're too long
- [ ] Account for Nincada's evolution (two evolutions from one)
- [ ] Conditional evolution requirements: Basculin→Basculegion only if
      white-striped; Salandit→Salazzle only if female; etc.

## Tech debt

- [ ] Admin status isn't stored in cookies/JWT (front+back end check exists,
      but re-derived per request)
- [ ] Remove `female_image` and `shiny_image` from pokemon table
- [ ] Move remaining `box-view.logic.js` gameData into the `game_versions`
      table (partially done: `limited_dex` arrays are in the DB as of the
      pre-hiatus state — verify what's left in the logic file)
- [ ] Remove `#Game_locations` link
- [ ] Align filters with title on list view
- [ ] Open drawer should close when changing filters
- [ ] Verify: "Finish up DNS routing and SSL" (believed done — site was live
      at pokecodex.com)

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
- [ ] Pokewalker: add rule support, plus geographic location on catch log
- [ ] Add last few missing pokemon with images
- [ ] Limit ball choice when adding pokemon (trade/prize ⇒ default pokeball;
      gens 1–2 ⇒ default pokeball)
- [ ] "Uncaught only" filter (in the Figma alongside "incomplete only" —
      original motivation forgotten; evaluate before building)

## Bonus ideas (unordered)

Row/list UX: hover-state icons linking to Bulbapedia/Serebii/catch-location
modal; Bulbapedia catch-location iframe or stored snippet per pokemon; gradient
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
