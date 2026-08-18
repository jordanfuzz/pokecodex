# Source-data automation feasibility (phase 1.5 spike)

Output of the roadmap phase 1.5 spike (2026-08-17). Question asked: **can the
Bulbapedia "game locations" scrubbing be semi-automated?** Answer: **yes** —
Bulbapedia has an open MediaWiki API and the target content is heavily
templated, and an independent machine-readable cross-check exists (PKHeX's
legality encounter tables). This doc records the findings, the decided
approach, and what it means for phase 4.

## Findings

### Bulbapedia: open API, templated content, no dumps

- The MediaWiki API at `https://bulbapedia.bulbagarden.net/w/api.php` works
  anonymously — verified with live requests (MediaWiki 1.43; Cloudflare in
  front but no challenge on api.php). Raw wikitext comes back as JSON via
  `action=query&prop=revisions` or per-section via `action=parse&section=N`
  (each pokemon page's section map locates its "Game locations" section).
- The data is template-structured, not prose:
  - **Game locations**: `{{Availability/Entry1|2}}` templates, one per game
    row, with `v=`/`v2=` (versions) and `area=` (location text, may nest
    small templates like `{{FB|...}}`/`{{safari|...}}`). Event-only rows link
    to the per-game event pages.
  - **In-game event pokemon**: one structured template per entry, per game
    (e.g. `{{SwShievent|pokemon=Grookey|level=5|met=...}}`) — the most
    machine-friendly of the three.
  - **In-game trades**: one page for all core games; plain wiki tables with
    small cell templates (`{{p|Abra}}`, `{{rt|2|Kanto}}`). Table parsing per
    generation section.
- **No usable dumps or mirrors exist.** Bulbagarden staff explicitly declined
  to publish dumps (legal exposure); the only public mirror is from 2014. The
  live API is the only realistic access path.
- **Etiquette and licensing**: robots.txt asks `Crawl-delay: 5`; content is
  CC BY-NC-SA 2.5 (fine for this non-commercial tracker, attribute
  Bulbapedia where derived text is shown; do not redistribute bulk dumps).
  The bot policy restricts editing bots only, not read-only API use.
- **Scale**: ~1,000 pokemon pages + 1 trades page + ~15 event pages. At one
  request per 5 seconds, a full one-time fetch is under 3 hours.

### PokeAPI: partial cross-check data; self-hosting unnecessary

- Decision: **clone [PokeAPI/api-data](https://github.com/PokeAPI/api-data)
  instead of self-hosting.** It's a bot-maintained static repo (~270 MB) of
  the pre-generated JSON for every endpoint — full offline access, zero rate
  limits, no Django/Hasura stack to run. (The underlying CSVs also ship in
  the main pokeapi repo if we ever want them loaded into our own Postgres.)
- PokeAPI holds more acquisition data than assumed: encounter methods include
  `gift`, `static`, `npc-trade`, `roaming`, etc., and spot checks confirm
  e.g. the Red Gyarados (`static`, Lake of Rage) and Eevee gifts across gens.
- But coverage is uneven and it cannot be the source of truth: only gen 7's
  NPC trades are complete ([issue #1451](https://github.com/PokeAPI/pokeapi/issues/1451)),
  static/legendary completeness is not guaranteed, gen 9 has no encounter
  data, and event distributions are absent entirely.

### PKHeX: the best independent cross-check for unique sources

[PKHeX.Core's legality encounter tables](https://github.com/kwsch/PKHeX/tree/master/PKHeX.Core/Legality/Encounters/Data)
encode static encounters, NPC gifts, and in-game trades for **every gen 1–9
game** as plain C# arrays (per-gen folders; wild slot tables are binary, but
the statics/trades/gifts we care about are readable source). This is the only
machine-readable dataset covering gens 5–7 and it's battle-tested — legality
checking depends on it. License is GPLv3: extract the facts, never vendor the
code. Supporting sources:

- **pret decompilations** (gens 1–4 only; gen 4 still WIP): ground truth for
  NPC trades and Game Corner prizes as literal data tables
  (e.g. `pokecrystal/data/events/npc_trades.asm`), gifts/statics in map
  scripts.
- **[projectpokemon/EventsGallery](https://github.com/projectpokemon/EventsGallery)**:
  the actual mystery-gift wondercard files, gens 3–9 (binary; PKHeX.Core
  parses them). Gen 1–2 event distributions exist only as Bulbapedia prose.

### Ruled out

Serebii and PokemonDB are HTML-only with no reuse grant (PokemonDB explicitly
forbids it); veekun/pokedex never implemented gift/trade/static tables and is
dormant; nothing relevant exists on Kaggle/HuggingFace or in the @pkmn/Smogon
ecosystem.

## Decided approach (informs phase 4)

Bulbapedia-primary pipeline with PKHeX as an independent validator, and a
human approval gate in front of the `sources` table:

1. **Fetch + cache** (one-time, ~3h): pull raw wikitext for all "Game
   locations" sections, the in-game trades page, and per-game event pages.
   Serial requests, 1 per 5s, `maxlag=5`, descriptive User-Agent with contact
   email, backoff on 429. Cache locally (table or files); all parser
   iteration runs against the cache — Bulbapedia is never re-hit. Refreshes,
   if ever needed, are incremental via revision timestamps.
2. **Parse** the templates into *candidate* rows shaped like `sources`
   (pokemon_id, name, gen, source_type, description, Bulbapedia link).
3. **Cross-check** candidates against facts extracted from PKHeX's encounter
   tables (and pret tables for gens 1–3 where convenient). Agreement =
   high-confidence candidate; disagreement = flagged.
4. **Review gate**: candidates land in a staging table, reviewed and approved
   per row through a review page in the app — designed for minimal friction
   (bulk-approve high-confidence rows, focus attention on flags). Only
   approved rows merge into `sources`.
5. **Audit existing data too**: the same diff also runs against the ~700
   existing hand-gathered unique rows, surfacing misses (e.g. the suspected
   Stadium 2 Gligar) and errors — the audit is nearly free once the parser
   exists.

Rollout stays per the roadmap: one gen at a time, enabling each gen in the
app as its data completes.

Fallback for messy long-tail pages the parser can't handle: have an agent
read the cached wikitext for that pokemon and draft candidate rows into the
same staging table — same review gate, no special path.

## Decisions recorded (Jordan, 2026-08-17)

- Audit and re-verify existing sources as well, not just the remaining pass.
- Review interface: staging table + review page in the app; per-row human
  approval is required but must be low-friction.
- Clone `api-data`; do not self-host PokeAPI.
- The old "Bulbapedia iframe/snippet per pokemon" idea stays a backlog bonus
  item (BACKLOG.md) — not part of this pipeline, though the API's rendered
  per-section HTML makes it easy if ever wanted.

## Open questions for phase 4 planning

- Where parsed source *names* come from: Bulbapedia area text is free-form
  ("Lake of Rage") — likely fine as-is, but naming conventions for the
  existing rows should be checked before generating candidates.
- The multi-gen source problem (domain.md): candidate generation will
  regenerate the same source per gen; decide whether the pipeline emits
  per-gen duplicates matching today's model or waits for the model fix.
- Staging-table schema and review-page UX — design when phase 4 starts;
  keep the staging table out of the production schema until then.
