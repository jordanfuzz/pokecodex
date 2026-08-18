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
- [ ] Kingambit (983), Annihilape (979), Ursaluna (901) have no 'evolved'
      source row — evolving into them yields no Evolved tag (found 2026-08,
      phase 3)

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

## Access strategy (settled by the phase 1.5 spike)

See [source-data-feasibility.md](source-data-feasibility.md) for the full
findings and decided pipeline. Summary:

- **Bulbapedia**: open MediaWiki API, templated content — one-time polite
  fetch into a local cache, parse into candidate rows, human review gate
  (staging table + review page) before anything touches `sources`. The same
  diff audits the existing hand-gathered rows.
- **PKHeX encounter tables** (+ pret decomps, EventsGallery): independent
  machine-readable cross-check for statics/gifts/trades, all gens 1–7.
- **PokeAPI**: clone the static `PokeAPI/api-data` repo for offline data —
  no self-hosting, no rate-limit risk. Partial cross-check value only; it
  has no event distributions and incomplete gen 1–6 trades.
- The "Bulbapedia iframe/snippet per pokemon" idea remains a backlog bonus
  item (not part of the pipeline).
