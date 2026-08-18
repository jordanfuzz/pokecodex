# Source data — state and remaining work

The dataset of acquisition sources per pokemon (~5,400 rows as of the 2026-08
prod dump) was hand-gathered from Bulbapedia "game locations" sections and
in-game-event/trade lists. This doc tracks where that effort stands and every
known follow-up. Roadmap phase 1.5 investigates automating the rest; phase 4
finishes gens 1–7 (one gen at a time, enabling each gen in the app as its data
completes — well before the Feb 2027 Pokemon Bank shutdown, since the in-game
catching that follows is the slow part).

## Position

- Last known position: main pass **stopped before Wynaut** (national dex
  #360) — unverified against the data; re-confirm before resuming.
- Add-sources work was scoped to gens 1–5 first, 6+ later — superseded by the
  progressive plan above.

## Reference sources used

- Bulbapedia per-pokemon "game locations" sections
- [In-game trades](https://bulbapedia.bulbagarden.net/wiki/In-game_trade)
  (per-game sections)
- "List of in-game event Pokemon" pages per game (e.g. ORAS: Cosplay Pikachu)
- "List of game-based Pokemon distributions" pages per gen
- Yancy/Curtis B2W2 trades: NPC trades with hidden abilities, varying by
  player gender

## Systematic passes still to do

- [ ] Finish the main Bulbapedia pass (from Wynaut onward, per gen)
- [ ] Add regional variants
- [ ] Add G-max pokemon
- [ ] Add battle-only forms
- [ ] Mega evolutions? (decide whether they're source entries at all)
- [ ] Double-check npc-trades and side-games
- [ ] Go through "List of in-game event pokemon" for each gen
- [ ] Double check form variants (Cherrim was missed once)
- [ ] Verify Honey Tree sources
- [ ] Add [Dream Radar](https://bulbapedia.bulbagarden.net/wiki/Pok%C3%A9mon_Dream_Radar) sources
- [ ] Double check Bulbapedia links stored on rows
- [ ] Cross-check the personal special wishlist (Obsidian) — some entries may
      actually be unique-source requirements that belong in the data

## Known point fixes

- [ ] Remove `starter` source from Pikachu; remove `hatch` from Rotom; audit
      `hatch` everywhere; rename `hatch` → "hatched"
- [ ] Remove `hatch` from pokemon that have the `evolved` source? (decision)
- [ ] Find and add the special gen 3 Zigzagoon
- [ ] Stadium 2 Gligar probably missed (Farfetch'd has its Stadium 2 source)
- [ ] Add Member Card and Oak's Letter to Gen 8 games?
- [ ] What to do with Mew — add an Event or Mystery Gift source type?
- [ ] Odd Egg: hard to get for all possible pokemon; currently typed `gift`
- [ ] HOME Pikachu is parked at gen 8 because "Home" isn't a gen option

## Open decisions

- Is Gen 7 Island Scan separate from `wild`? SOS battles? Pokepelago?
- New game-corner source? (Game Corner is already unique+universal)
- Pal Park / Friend Safari — probably wild-like, not unique
- Differentiate `static` vs `special`? Not every static-location pokemon
  deserves double tracking
- A "Trade" source for users completing the dex via trades?
- Duplicate source names OK? (Ekans has two Game Corner sources: Gold and
  Gen 4)
- Multi-gen source modeling — see domain.md (the Wynaut/Lavaridge problem);
  blocks cleanly representing Honey Tree across gens too

## Add later (lower priority)

Dream World pokemon; Pokewalker rule updates; prize/gift rule updates ("unique
sources" rule should include `special`, `prize`, `gift`); special
NPC-presence pokemon (dancing Clefairy; Oddish w/ Lady Lynette in White;
Magnemite w/ Scientist Marie; Dunsparce w/ Breeder April); Partner Eevee;
Spiky-eared Pichu; Pikachu-colored Pichu.

## Access strategy (phase 1.5 spike)

- **PokeAPI**: run the official self-hosted instance locally before any bulk
  work — the public API rate-limits and IP-bans aggressively. PokeAPI does
  not contain unique-source data.
- **Bulbapedia**: the only known source for unique-source data. It's
  MediaWiki, so a queryable API and/or dumps likely exist even if crawling is
  blocked — the spike should settle the method (and whether the old
  "Bulbapedia iframe/snippet per pokemon" idea is feasible as a byproduct).
