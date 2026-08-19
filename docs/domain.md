# Domain rules

What the app models and why. Distilled from the challenge master note and
pre-hiatus design notes; the personal challenge content (wishlists, bucket
list, hardware) intentionally stays in Jordan's Obsidian vault.

## The challenge, as it drives requirements

The app exists to track a lifetime catch-em-all challenge. The app-relevant
rules:

1. **Living dex** of all non-limited-release forms and variants of all pokemon.
2. Beat and 100% the National Dex in each region and generation, including
   remakes — hence per-game and per-gen tracking, not just one global dex.
3. **Every pokemon with a unique source or variant is a separate required
   entry** (e.g. the Red Gyarados counts in addition to a regular Gyarados).
   This is the reason the source system exists.
4. Entries must come from the pokemon's home region/generation — hence
   tracking *where and when* each pokemon was caught, and why a Vaporeon from
   Let's Go Eevee must not satisfy the Gen 1 box.
5. Users customize their own rules (which source types they require — gender,
   regional variants, shinies, etc.), so completion is always evaluated
   per-user against their rules. Per-row personal overrides are a planned v1
   feature (see BACKLOG).

Progressive rollout strategy: finish source data one gen at a time and enable
gens in the app as their data is ready, through gen 7 (see ROADMAP).

## Sources

A **source** is a method of acquisition for a pokemon. Generic sources (wild,
hatched) exist for most pokemon; unique one-time sources (NPC gifts, static
encounters, in-game trades — anything Bulbapedia lists as "only one") are
tracked as separate required entries.

Source types as of the pre-hiatus state (`source_type` enum in the DB):

`male`, `female`, `npc-trade`, `side-game`, `regional`, `special`, `shiny`,
`wild`, `original`, `mega`, `gmax`, `battle-only`, `variant`, `hatch`,
`starter`, `evolved`, `prize`, `gift`, `pokewalker`

Decisions already made:

- Game Corner is a unique and universal source type.
- Static legendary locations were changed from `special` to a static-style
  source so they aren't required in every gen. (Open question: differentiate
  static vs special generally — not every static-location pokemon is "special
  enough" to track twice.)
- The "unique sources" user rule should include `special`, `prize`, and `gift`
  (listed as still to-apply pre-hiatus).
- "From home region" (the `original` source type) is **derived, not
  logged**: a catch qualifies iff its game's generation equals the
  pokemon's `original_gen` AND the game's region equals the pokemon's
  `home_region` (so SoulSilver Sinnoh catches, remakes, and Let's Go don't
  count). Stored `original` links were deleted; the pill and catch tags
  compute from catch data. Evolution needs no special case — the evolved
  record keeps the original catch's game, so the check runs against the
  evolution's own home games.

Gen scoping: each source row carries a gen (0 = all gens), and the checklist
only shows sources obtainable in the selected gen. **Unsolved: the multi-gen
source problem** — a source that exists in several-but-not-all gens currently
needs duplicate rows (Wynaut's "Lavaridge Springs" and "Lavaridge Springs
(Gen 6)"). Fixing this includes migrating existing "(Gen X)"-suffixed
duplicates and the static-default sources (e.g. Seafoam Islands should be one
source appearing only in gens where it's Articuno's location).

## Evolution and source inheritance

The core question: if a source-bearing pokemon evolves (Partner Pikachu →
Raichu), who holds the source? Solved design, implemented pre-hiatus:

- Evolving creates a new `users_pokemon` record, moves the old record's
  sources to it in `users_pokemon_sources` with `is_inherited = true`, deletes
  the old record, and adds the `evolved` source.
- Inherited sources can't be edited.
- When displaying an incomplete special source on a base pokemon, the app
  checks whether an evolved form satisfies it (icon on the pill suggests the
  evolution covers it).
- Only "special" source classes can be satisfied by an evolution: in-game
  trades, side-game trades, and unique sources. Basic sources (wild, hatch,
  gender…) are not inherited — a wild Kadabra doesn't satisfy wild Abra.

Known consequences (open items, see BACKLOG): notes are lost on evolve; the
base pokemon's completion doesn't count evolution-satisfied sources in all
cases; conditional evolutions (white-striped Basculin → Basculegion,
female Salandit → Salazzle, Nincada's double evolution) aren't modeled.

### Performance trade-off (deliberate, documented pre-hiatus)

Moving sources to the evolved record makes display easy but aggregation hard:
adding `users_evolution_source_ids` to the main query in
`pokemon-repository.js` raised it from ~70ms to ~300ms. The written
optimization plan, if it becomes necessary: keep the base pokemon's record and
sources in place on evolve (marking them instead of moving), display from the
base record, and drop the third join. Other ideas on file: render rows before
completion state (checkboxes load later); compute completion on writes instead
of every page load.

## Variants

What counts as a distinct trackable entry (from the variants research note):

- **In scope**: form differences (Bulbapedia's list), gender differences,
  regional forms, Gigantamax forms, Vivillon patterns, Alcremie variants,
  hat/costume Pikachus from the main games, purified Shadow Lugia, non-Dada
  Zarude, Ash Greninja, original-color Magearna.
- **Special handling**: Mega Evolutions (don't persist in Home — screenshot
  bucket-list item; maybe collect stones per supporting game); combined
  pokemon (Kyurem/Necrozma/Calyrex forms — unclear if the dex preserves them);
  Spinda (billions of patterns in mainline — track as one; GO has 9);
  giant/alpha/totem/titan pokemon (only if the game recognizes them as
  different); shiny dex is a maybe-someday, not a requirement.
- **Out of scope**: Shadow pokemon generally, GO costume pokemon (mostly
  untradeable to Home — double-check), limited-release pokemon with no
  permanent in-game source (Lance's Dragonite, Payday Fearow/Rapidash).

## Games and dex rules

`game_versions` carries per-game rules: `box_size`/`max_boxes`, `dex_limit`,
`ignore_gender`, `ignore_regional_variants`, `ignore_rules`,
`include_meltan_line`, `is_isolated`, and `limited_dex` (jsonb array of
national dex ids for games with partial dexes — populated for Colosseum, XD,
Sword/Shield, Legends Arceus, Scarlet/Violet).

Notable game-specific rules encoded or planned:

- Colosseum/XD boxes only count pokemon caught in those games, with a wrinkle:
  trade-in-only dex entries (e.g. the one Slugma, evolvable to Magcargo)
  should be satisfiable by trading in.
- Gens 2–3 can't exchange pokemon (no transfer path), so box availability
  must not bridge them.
- Punctuation Unown don't exist in gen 2.
- A caught pokemon satisfies a gen's box only if caught in that gen or earlier
  *along a valid transfer path* (the Let's Go Vaporeon rule).
- Isolated games (`isolation_group`): Let's Go pair (`lets-go`), Colosseum
  (`colosseum`), XD (`xd`). Their boxes only count catches from the same
  group. Outbound, a game's catches transfer as `transfer_gen` (Let's Go:
  8, via Home) or their own gen (Colosseum/XD trade out to GBA gen 3).
- `game_versions.region` / `pokemon.home_region` back the home-region rule;
  peripherals (Channel, Box, Ranch, Ranger, Battle Revolution) have null
  region and are never home games.

## Filtering (current behavior)

- **By gen**: pokemon id ranges (1–151, etc.). Completion shown is across all
  sources for those pokemon, not gen-scoped.
- **By game**: filters pokemon by game (grouped by gen) and, when a row is
  opened, shows only sources obtainable in the selected game.
- **Hide completed**: hides rows whose rules are all met; composable with the
  above.

The richer three-mode design (by gen / single game / combined games up to a
point) is a backlog feature.
