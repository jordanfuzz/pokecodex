# Phase 4 Increment 2 — Staging Table + Review Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `staged_sources` table, the cache→staging script, the admin review API, and the `/review` page, per [the increment 2 spec](../specs/2026-08-18-phase-4-increment-2-staging-review-design.md).

**Architecture:** A unified worklist table (`staged_sources`) holds all three recon populations (new / audit / existing-unmatched) keyed by an idempotent `natural_key`. Pure adhoc modules (candidate collection, upgraded differ, staged-row builder) feed a transactional staging script. An admin-gated Express router owns all review writes; a plain-React `/review` page drives it.

**Tech Stack:** Node 24 ESM, Postgres 17, Express 5 + Passport, node:test + supertest (API), node:test (adhoc), React 19 + vitest (app logic tests), scss.

## Global Constraints

- All SQL lives in repository modules; routes never query directly (CLAUDE.md).
- SQL is snake_case; API camelizes on read via `camelize`.
- **Nothing writes to `sources` except the approval routes in this plan** (parent spec rule).
- Dev DB only: the migration is never run against production in this increment.
- API tests hit the compose Postgres on localhost:5432 — the dev stack must be up (`npm start` at repo root).
- Adhoc unit tests use small wikitext fixtures, never the gitignored `adhoc/bulbapedia-cache/`.
- The `source_type` enum values are: `male, female, npc-trade, side-game, regional, special, shiny, wild, original, mega, gmax, battle-only, variant, hatch, starter, evolved, prize, gift, pokewalker, fossil, honey-tree, event, game-corner, static-default`.
- Bash tool syntax for multi-line git commits: POSIX heredoc (`git commit -F - <<'EOF'`), never PowerShell here-strings.

## Deviations from the spec (additive, for the reviewer's eye)

1. **`pairing_confirmed boolean` column** (not in the spec's column list): a human-confirmed pairing flips a `new` row to `audit`; a later restage would recompute it as `new` and clobber the confirmation. The upsert preserves `row_kind`/`matched_source_id` on rows with `pairing_confirmed = true`.
2. **`raw_snippet` on `existing-unmatched` rows holds a JSON snapshot of the `sources` row at staging time** (spec said provenance is null for that kind). Required so the audit trail survives a guarded delete, which must null `matched_source_id` before deleting the source row.

## Interface reference (shapes used across tasks)

**Candidate** (produced by `collect.js`, consumed by differ and builder):

```js
{
  pokemonId: 4, gen: 1, game: 'Red',            // game '' for aux origins
  area: 'cleaned text', rawArea: '{{...}}',      // rawArea null for aux origins
  origin: 'availability' | 'side-games' | 'event-list' | 'distribution' | 'trades',
  reasons: ['gift language'],                    // classify reasons, or [origin]
  pageTitle: 'Charmander (Pokémon)', revid: 4612768,
  nickname: null,                                // set only for origin 'trades'
}
```

**Diff result** (from `diffCandidates`):

```js
{
  matched: [{ candidate, source, score, matchKind: 'fuzzy' | 'nickname' }],
  missing: [candidate],
  suggestions: [{ candidate, source, score, reason }],  // subset of missing
  unmatchedExisting: [sourceRow],
}
```

**Staged row object** (from `buildStagedRows`, camelCase, matches DB columns):

```js
{
  naturalKey, rowKind, pokemonId, name, description, image, gen, source,
  replaceDefault, confidence, matchedSourceId, suggestedSourceId,
  suggestionReason, expectedAbsent, pageTitle, revid, rawSnippet, origin,
  games, parserVersion,
}
```

---

### Task 1: `staged_sources` migration

**Files:**
- Create: `adhoc/scripts/migrations/2026-08-staged-sources.sql`

**Interfaces:**
- Produces: the `staged_sources` table and `staged_row_kind` / `staged_status` / `staged_resolution` / `staged_confidence` enums that every later task reads and writes. Idempotent — safe to apply repeatedly (API test setup reruns it).

- [ ] **Step 1: Write the migration**

```sql
-- Phase 4 increment 2: unified review worklist for parsed Bulbapedia
-- candidates and unmatched existing sources rows. Dev DB only until the
-- flow is proven. Idempotent: API test setup applies it on every run.
do $$ begin
  create type staged_row_kind as enum ('new', 'audit', 'existing-unmatched');
exception when duplicate_object then null; end $$;

do $$ begin
  create type staged_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type staged_resolution as enum ('created', 'updated', 'deleted', 'kept', 'paired');
exception when duplicate_object then null; end $$;

do $$ begin
  create type staged_confidence as enum ('low', 'medium', 'high');
exception when duplicate_object then null; end $$;

create table if not exists staged_sources (
  id uuid primary key,
  natural_key text not null unique,
  row_kind staged_row_kind not null,
  status staged_status not null default 'pending',
  resolution staged_resolution,
  -- candidate payload (null on existing-unmatched rows except pokemon_id/gen)
  pokemon_id integer references pokemon(id),
  name text,
  description text,
  image text,
  gen integer,
  source source_type,
  replace_default boolean default false,
  confidence staged_confidence,
  -- pairing / audit. No cascade: the guarded-delete transaction nulls these
  -- explicitly so reviewed rows survive as an audit trail.
  matched_source_id uuid references sources(id),
  suggested_source_id uuid references sources(id),
  suggestion_reason text,
  created_source_id uuid,
  pairing_confirmed boolean not null default false,
  expected_absent boolean not null default false,
  -- provenance
  page_title text,
  revid integer,
  raw_snippet text,
  origin text,
  games text[],
  parser_version text,
  staged_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists staged_sources_gen_status_idx
  on staged_sources (gen, status);
create index if not exists staged_sources_matched_source_idx
  on staged_sources (matched_source_id);
```

- [ ] **Step 2: Apply it to the dev DB (stack must be up)**

Run (Bash tool, repo root):

```bash
docker compose -f compose.dev.yml exec -T postgres psql -U postgres -d pokemon -v ON_ERROR_STOP=1 < adhoc/scripts/migrations/2026-08-staged-sources.sql
```

Expected: `DO` × 4, `CREATE TABLE`, `CREATE INDEX` × 2, exit 0.

- [ ] **Step 3: Verify idempotency — apply again**

Same command. Expected: `DO` × 4, `NOTICE: relation "staged_sources" already exists, skipping` (and for the indexes), exit 0. Any error = failure.

- [ ] **Step 4: Verify the shape**

```bash
docker compose -f compose.dev.yml exec -T postgres psql -U postgres -d pokemon -c "\d staged_sources"
```

Expected: all columns above, unique constraint on `natural_key`.

- [ ] **Step 5: Commit**

```bash
git add adhoc/scripts/migrations/2026-08-staged-sources.sql
git commit -m "feat(adhoc): staged_sources migration for the review worklist"
```

---

### Task 2: Candidate collection module (`collect.js`) + recon refactor

Extract recon-report.js's inline candidate assembly into a pure, fixture-testable module, adding the provenance fields (`pageTitle`, `revid`, `rawArea`) and the trades→candidates mapping the staging script needs. The recon report keeps identical output — its known numbers are the regression check.

**Files:**
- Create: `adhoc/src/bulbapedia/collect.js`
- Create: `adhoc/test/collect.test.js`
- Modify: `adhoc/scripts/recon-report.js:12-118` (imports, AUX_GENS/auxGen, both parse loops)

**Interfaces:**
- Consumes: `parseGameLocations(wikitext)` → `{entries, warnings}` (availability.js); `classifyEntry(entry)` → `{kind, reasons}` (classify.js); `parseEventEntries(wikitext)` (events.js); trade records `{heading, location, gives: {ndex, name}, receives: {ndex, name}, nickname}` (trades.js).
- Produces:
  - `collectPokemonCandidates(file, page)` → `{candidates, warnings, tallies, unknownGames: Map}`
  - `collectAuxCandidates(file, page)` → `{candidates, warnings}`
  - `collectTradeCandidates(trades, page)` → `{candidates, warnings}`
  - `auxGen(filename)` → gen int or null (moved from recon-report)
  - Candidates in the **Candidate** shape from the interface reference.

- [ ] **Step 1: Write the failing tests**

`adhoc/test/collect.test.js`:

```js
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  collectPokemonCandidates,
  collectAuxCandidates,
  collectTradeCandidates,
  auxGen,
} from '../src/bulbapedia/collect.js'

const page = (wikitext) => ({ title: 'Testmon (Pokémon)', revid: 12345, wikitext })

const AVAILABILITY_PAGE = `
==Game locations==
{{Availability
|gen1=yes
}}
{{Availability/Gen|gen=I}}
{{Availability/Entry1|v=Red|area=[[Celadon City]] (gift)}}
{{Availability/Entry1|v=Blue|area=[[Celadon City]] (gift)}}
{{Availability/Entry1|v=Yellow|area=[[Route 24]]}}
`

describe('collectPokemonCandidates', () => {
  it('emits unique candidates with provenance and tallies generics', () => {
    const { candidates, tallies } = collectPokemonCandidates('0004-charmander.json', page(AVAILABILITY_PAGE))
    assert.equal(candidates.length, 2) // Red + Blue gift; Yellow wild is generic
    assert.deepEqual(candidates.map((c) => c.game), ['Red', 'Blue'])
    const [red] = candidates
    assert.equal(red.pokemonId, 4)
    assert.equal(red.gen, 1)
    assert.equal(red.origin, 'availability')
    assert.equal(red.pageTitle, 'Testmon (Pokémon)')
    assert.equal(red.revid, 12345)
    assert.match(red.rawArea, /Celadon City/)
    assert.equal(red.nickname, null)
    assert.ok(tallies.generic >= 1)
  })
})

describe('collectAuxCandidates', () => {
  it('maps event entries with the filename-derived gen', () => {
    const wikitext = '{{eventpoke|pokemon=Pikachu|ndex=25|game=OR|method=Gift|met=Contest Hall}}'
    const { candidates } = collectAuxCandidates(
      'list-of-in-game-event-pok-mon-omega-ruby-and-alpha-sapphire.json',
      page(wikitext)
    )
    assert.equal(candidates.length, 1)
    assert.equal(candidates[0].pokemonId, 25)
    assert.equal(candidates[0].gen, 6)
    assert.equal(candidates[0].origin, 'event-list')
    assert.equal(candidates[0].area, 'Gift — Contest Hall')
    assert.equal(candidates[0].revid, 12345)
  })

  it('warns on an unknown gen mapping instead of guessing', () => {
    const { candidates, warnings } = collectAuxCandidates('list-of-something-unknown.json', page(''))
    assert.equal(candidates.length, 0)
    assert.equal(warnings.length, 1)
  })
})

describe('collectTradeCandidates', () => {
  const trade = (heading, extra = {}) => ({
    heading,
    location: 'Vermilion City',
    gives: { ndex: 63, name: 'Abra' },
    receives: { ndex: 122, name: 'Mr. Mime' },
    nickname: 'Marcel',
    ...extra,
  })

  it('maps a trade to an npc-trade candidate with gen from the heading', () => {
    const { candidates } = collectTradeCandidates([trade('Red and Blue')], page(''))
    assert.equal(candidates.length, 1)
    const [c] = candidates
    assert.equal(c.pokemonId, 122)
    assert.equal(c.gen, 1)
    assert.equal(c.origin, 'trades')
    assert.equal(c.nickname, 'Marcel')
    assert.match(c.area, /Mr\. Mime/)
    assert.match(c.area, /Vermilion City/)
  })

  it('warns on an unknown heading instead of dropping silently', () => {
    const { candidates, warnings } = collectTradeCandidates([trade('Mystery Game')], page(''))
    assert.equal(candidates.length, 0)
    assert.equal(warnings.length, 1)
  })

  it('maps out-of-scope headings to gen 8/9 rather than warning', () => {
    const { candidates, warnings } = collectTradeCandidates([trade('Sword and Shield')], page(''))
    assert.equal(candidates[0].gen, 8)
    assert.equal(warnings.length, 0)
  })
})

describe('auxGen', () => {
  it('does not substring-match generation-i into generation-ii', () => {
    assert.equal(auxGen('list-of-game-based-distributions-generation-ii.json'), 2)
    assert.equal(auxGen('list-of-game-based-distributions-generation-i.json'), 1)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd adhoc && npm test` (if host node < 24: `docker compose -f compose.dev.yml exec adhoc npm test`)
Expected: FAIL — `Cannot find module ... collect.js`; existing suites still pass.

- [ ] **Step 3: Implement `adhoc/src/bulbapedia/collect.js`**

The AUX_GENS table and both loops move here from recon-report.js **verbatim except** for the added provenance fields, the trades mapping, and returning instead of mutating outer state:

```js
// Assemble diffable candidates from cached Bulbapedia pages. Pure per-page
// functions: scripts own the fs walking, these own the mapping, so tests
// run on fixtures without the gitignored cache.
import { parseGameLocations } from './availability.js'
import { classifyEntry } from './classify.js'
import { parseEventEntries } from './events.js'

// aux filename fragment -> gen of its candidates (event pages by game pair,
// distribution pages by gen). ZA/SV/gen-ix pages are out of phase-4 scope
// but included so nothing is silently dropped. Generation fragments keep the
// ".json" suffix so "generation-i" cannot substring-match generation-ii/iv/ix.
const AUX_GENS = [
  ['generation-i.json', 1], ['generation-ii.json', 2], ['generation-iii.json', 3],
  ['generation-iv.json', 4], ['generation-vi.json', 6], ['generation-vii.json', 7],
  ['generation-viii.json', 8], ['generation-ix.json', 9],
  ['ruby-and-sapphire', 3], ['emerald', 3], ['firered-and-leafgreen', 3],
  ['colosseum-and-pok-mon-xd', 3], ['diamond-and-pearl', 4], ['platinum', 4],
  ['heartgold-and-soulsilver', 4], ['black-2-and-white-2', 5],
  ['black-and-white', 5], ['x-and-y', 6], ['omega-ruby-and-alpha-sapphire', 6],
  ['sun-and-moon', 7], ['ultra-sun-and-ultra-moon', 7],
  ['let-s-go-pikachu-and-let-s-go-eevee', 7], ['sword-and-shield', 8],
  ['brilliant-diamond-and-shining-pearl', 8], ['legends-arceus', 8],
  ['legends-z-a', 9], ['scarlet-and-violet', 9],
]
export const auxGen = (filename) =>
  AUX_GENS.find(([fragment]) => filename.includes(fragment))?.[1] ?? null

// In-game-trades page section headings -> gen. Gen 8/9 entries are mapped
// (not warned) so the in-scope filter downstream drops them knowingly.
const TRADE_HEADING_GENS = [
  [/Red and Blue|Red and Green|Blue \(Japan|^Yellow/, 1],
  [/Gold and Silver|^Crystal/, 2],
  [/Ruby and Sapphire|^Emerald|FireRed and LeafGreen|Colosseum|^XD/, 3],
  [/Diamond and Pearl|^Platinum|HeartGold and SoulSilver/, 4],
  [/Black and White|Black 2 and White 2/, 5],
  [/X and Y|Omega Ruby and Alpha Sapphire/, 6],
  [/^Sun and Moon|Ultra Sun and Ultra Moon|Let's Go/, 7],
  [/Sword and Shield|Isle of Armor|Crown Tundra|Brilliant Diamond and Shining Pearl|Legends: Arceus/, 8],
  [/Legends: Z-A|Scarlet and Violet|Mega Dimension/, 9],
]
const tradeGen = (heading) =>
  TRADE_HEADING_GENS.find(([rx]) => rx.test(heading))?.[1] ?? null

export const collectPokemonCandidates = (file, page) => {
  const pokemonId = parseInt(file.slice(0, 4), 10)
  const { entries, warnings: parseWarnings } = parseGameLocations(page.wikitext)
  const warnings = parseWarnings.map((warning) => `${file}: ${warning}`)
  const candidates = []
  const tallies = { generic: 0, unavailable: 0, 'untracked-game': 0, 'unique-candidate': 0 }
  const unknownGames = new Map()
  for (const entry of entries) {
    const { kind, reasons } = classifyEntry(entry)
    tallies[kind] = (tallies[kind] ?? 0) + 1
    if (kind === 'untracked-game' && !entry.gameInfo.expected) {
      unknownGames.set(entry.game, (unknownGames.get(entry.game) ?? 0) + 1)
    }
    if (kind !== 'unique-candidate') continue
    if (entry.gen === null) {
      warnings.push(`${file}: candidate without gen (${entry.game})`)
      continue
    }
    candidates.push({
      pokemonId,
      gen: entry.gen,
      game: entry.game,
      area: entry.area,
      rawArea: entry.rawArea,
      origin: entry.subsection === 'core' ? 'availability' : 'side-games',
      reasons,
      pageTitle: page.title,
      revid: page.revid,
      nickname: null,
    })
  }
  return { candidates, warnings, tallies, unknownGames }
}

export const collectAuxCandidates = (file, page) => {
  const gen = auxGen(file)
  if (gen === null) {
    return { candidates: [], warnings: [`aux page with unknown gen mapping: ${file}`] }
  }
  const origin = file.startsWith('list-of-game-based') ? 'distribution' : 'event-list'
  const candidates = []
  const warnings = []
  for (const entry of parseEventEntries(page.wikitext)) {
    if (entry.ndex === null) {
      warnings.push(`${file}: event entry without ndex (${entry.pokemon})`)
      continue
    }
    candidates.push({
      pokemonId: entry.ndex,
      gen,
      game: entry.game ?? '',
      area: [entry.method, entry.met].filter(Boolean).join(' — ') || entry.pokemon,
      rawArea: null,
      origin,
      reasons: [origin],
      pageTitle: page.title,
      revid: page.revid,
      nickname: null,
    })
  }
  return { candidates, warnings }
}

export const collectTradeCandidates = (trades, page) => {
  const candidates = []
  const warnings = []
  for (const trade of trades) {
    const gen = tradeGen(trade.heading)
    if (gen === null) {
      warnings.push(`trade with unknown heading gen: ${trade.heading}`)
      continue
    }
    const location = trade.location ? ` at ${trade.location}` : ''
    candidates.push({
      pokemonId: trade.receives.ndex,
      gen,
      game: trade.heading,
      area: `In-game trade: receive ${trade.receives.name} for ${trade.gives.name}${location}`,
      rawArea: null,
      origin: 'trades',
      reasons: ['npc trade'],
      pageTitle: page.title,
      revid: page.revid,
      nickname: trade.nickname ?? null,
    })
  }
  return { candidates, warnings }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd adhoc && npm test`
Expected: PASS (new collect tests plus all existing suites).
If the availability fixture parses to 0 entries, compare it against the fixtures in `adhoc/test/availability.test.js` and adjust the fixture (not the parser).
If the `eventpoke` fixture emits nothing, check `parseEventEntries`'s template filter (`/event/i` + `pokemon=` param) and rename the fixture template accordingly.

- [ ] **Step 5: Refactor recon-report.js onto collect.js**

Replace the imports of `parseGameLocations`, `classifyEntry`, `parseEventEntries` (keep `parseTrades`, differ imports) with:

```js
import { collectPokemonCandidates, collectAuxCandidates } from '../src/bulbapedia/collect.js'
```

Delete the `AUX_GENS` table and `auxGen` from recon-report.js. Replace the pokemon-pages loop body with:

```js
for (const file of pokemonFiles) {
  const page = await readJson(path.join(CACHE, 'pokemon', file))
  const result = collectPokemonCandidates(file, page)
  warnings.push(...result.warnings)
  candidates.push(...result.candidates)
  for (const [kind, n] of Object.entries(result.tallies)) tallies[kind] = (tallies[kind] ?? 0) + n
  for (const [game, n] of result.unknownGames) unknownGames.set(game, (unknownGames.get(game) ?? 0) + n)
}
```

Replace the aux-pages loop's non-trades branch with:

```js
  const result = collectAuxCandidates(file, page)
  warnings.push(...result.warnings)
  candidates.push(...result.candidates)
```

(The trades branch and everything below the loops is untouched.)

- [ ] **Step 6: Regression — rerun the recon report**

Run: `docker compose -f compose.dev.yml exec adhoc node scripts/recon-report.js`
Then compare `adhoc/recon-output/report.md` header numbers against the recorded 2026-08-18 run ([source-data.md](../../source-data.md)): 1901 in-scope candidates, 879 matched, 1022 missing, 248 in-scope / 123 out-of-scope unmatched existing. **All numbers must be identical** — this refactor must not change behavior.

- [ ] **Step 7: Commit**

```bash
git add adhoc/src/bulbapedia/collect.js adhoc/test/collect.test.js adhoc/scripts/recon-report.js
git commit -m "refactor(adhoc): extract candidate collection into collect.js with provenance"
```

---

### Task 3: Differ upgrades — nickname matching, suggestion band, matchKind

**Files:**
- Modify: `adhoc/src/bulbapedia/differ.js`
- Modify: `adhoc/test/differ.test.js` (append new describe blocks; leave existing tests untouched)

**Interfaces:**
- Consumes: candidates (now possibly carrying `nickname`), sources rows `{id, pokemonId, name, description, gen, source}`.
- Produces: `diffCandidates(candidates, sources, threshold = 0.34, suggestionFloor = 0.15)` → the **Diff result** shape from the interface reference. `similarity(a, b, minTokens = 2)` gains the third parameter. Existing callers (recon-report) pass no extra args and read only `matched`/`missing`/`unmatchedExisting` — unchanged behavior for nickname-less candidates apart from the added `matchKind: 'fuzzy'` field.

- [ ] **Step 1: Write the failing tests (append to `adhoc/test/differ.test.js`)**

```js
describe('nickname matching', () => {
  const source = { id: 's1', pokemonId: 122, name: 'Marcel', description: 'FRLG trade', gen: 1, source: 'npc-trade' }
  const candidate = {
    pokemonId: 122, gen: 1, area: 'In-game trade: receive Mr. Mime for Abra',
    origin: 'trades', reasons: ['npc trade'], nickname: 'Marcel',
  }

  it('an exact nickname hit is a full match with matchKind nickname', () => {
    const { matched, missing, unmatchedExisting } = diffCandidates([candidate], [source])
    assert.equal(matched.length, 1)
    assert.equal(matched[0].matchKind, 'nickname')
    assert.equal(matched[0].source.id, 's1')
    assert.equal(missing.length, 0)
    assert.equal(unmatchedExisting.length, 0)
  })

  it('nickname matching normalizes case and punctuation', () => {
    const dotted = { ...source, name: 'ms. nido' }
    const { matched } = diffCandidates([{ ...candidate, nickname: 'Ms. Nido' }], [dotted])
    assert.equal(matched.length, 1)
    assert.equal(matched[0].matchKind, 'nickname')
  })

  it('a token-overlap nickname near-miss becomes a suggestion, not a match', () => {
    // area/description deliberately share zero tokens so only the nickname
    // fallback can propose the pairing.
    const renamed = { ...source, name: 'Marcel the Mime', description: null }
    const { matched, missing, suggestions } = diffCandidates(
      [{ ...candidate, nickname: 'Marcel Mime', area: 'Cerulean City swap' }], [renamed])
    assert.equal(matched.length, 0)
    assert.equal(missing.length, 1)
    assert.equal(suggestions.length, 1)
    assert.equal(suggestions[0].reason, 'nickname')
  })
})

describe('suggestion band', () => {
  it('a sub-threshold fuzzy score in [floor, threshold) is suggested', () => {
    // 1 shared token of 4/5 -> score 0.25: below 0.34, above 0.15
    const source = { id: 's2', pokemonId: 1, name: 'Celadon Mansion visitor gift', description: null, gen: 1, source: 'gift' }
    const candidate = { pokemonId: 1, gen: 1, area: 'Received from woman inside Celadon', origin: 'availability', reasons: ['gift language'], nickname: null }
    const { missing, suggestions } = diffCandidates([candidate], [source])
    assert.equal(missing.length, 1)
    assert.equal(suggestions.length, 1)
    assert.match(suggestions[0].reason, /^fuzzy:0\.2/)
  })

  it('1-token names zeroed by the min-token guard can still suggest', () => {
    const source = { id: 's3', pokemonId: 140, name: 'Fossil', description: null, gen: 1, source: 'fossil' }
    const candidate = { pokemonId: 140, gen: 1, area: 'Fossil revived (Cinnabar)', origin: 'availability', reasons: ['fossil'], nickname: null }
    const { matched, suggestions } = diffCandidates([candidate], [source])
    assert.equal(matched.length, 0) // strict guard still blocks the match
    assert.equal(suggestions.length, 1)
    assert.match(suggestions[0].reason, /^fuzzy-short:/)
  })

  it('fuzzy matches at/above threshold carry matchKind fuzzy', () => {
    const source = { id: 's4', pokemonId: 130, name: 'Red Gyarados', description: 'Lake of Rage static', gen: 2, source: 'static-default' }
    const candidate = { pokemonId: 130, gen: 2, area: 'Lake of Rage (Red Gyarados, only one)', origin: 'availability', reasons: ['explicit only-one'], nickname: null }
    const { matched } = diffCandidates([candidate], [source])
    assert.equal(matched.length, 1)
    assert.equal(matched[0].matchKind, 'fuzzy')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd adhoc && npm test`
Expected: new tests FAIL (`matchKind` undefined / `suggestions` undefined); existing differ tests still pass.

- [ ] **Step 3: Implement in `adhoc/src/bulbapedia/differ.js`**

Replace `similarity` and `diffCandidates` (keep `UNIQUE_SOURCE_TYPES`, `STOPWORDS`, `tokens` as-is):

```js
export const similarity = (a, b, minTokens = 2) => {
  const tokensA = tokens(a)
  const tokensB = tokens(b)
  // A single shared token (e.g. a 1-word source name like "Fossil") is not
  // enough signal to claim a match — require at least 2 tokens per side.
  // Suggestion passes relax this to 1 to propose pairings a human confirms.
  if (tokensA.size < minTokens || tokensB.size < minTokens) return 0
  let common = 0
  for (const token of tokensA) if (tokensB.has(token)) common++
  return common / Math.min(tokensA.size, tokensB.size)
}

const normalizeNickname = (text) => (text ?? '').toLowerCase().replace(/[^a-z0-9é♀♂]/g, '')

const bestBy = (pool, score) => {
  let best = null
  let bestScore = 0
  for (const source of pool) {
    const s = score(source)
    // Tie-break equal scores deterministically by id so results don't
    // depend on source array order.
    if (s > bestScore || (s === bestScore && best !== null && source.id < best.id)) {
      best = source
      bestScore = s
    }
  }
  return { best, bestScore }
}

// Multiple candidates legitimately matching the same source row is correct
// by design, not a bug: e.g. separate Ruby and Sapphire candidate rows for
// one gift that Bulbapedia records as a single gen-3 source both match that
// one source. Do not dedupe candidates against an already-matched source.
export const diffCandidates = (candidates, sources, threshold = 0.34, suggestionFloor = 0.15) => {
  const uniqueSources = sources.filter((source) => UNIQUE_SOURCE_TYPES.includes(source.source))
  const matchedSourceIds = new Set()
  const matched = []
  const missing = []
  const suggestions = []
  for (const candidate of candidates) {
    const pool = uniqueSources.filter(
      (source) =>
        source.pokemonId === candidate.pokemonId &&
        (source.gen === candidate.gen || source.gen === 0)
    )
    const nickname = normalizeNickname(candidate.nickname)
    const nicknameHit = nickname
      ? pool.find((source) => normalizeNickname(source.name) === nickname)
      : null
    if (nicknameHit) {
      matched.push({ candidate, source: nicknameHit, score: 1, matchKind: 'nickname' })
      matchedSourceIds.add(nicknameHit.id)
      continue
    }
    const { best, bestScore } = bestBy(pool, (source) =>
      similarity(candidate.area, `${source.name} ${source.description ?? ''}`)
    )
    if (best && bestScore >= threshold) {
      matched.push({ candidate, source: best, score: bestScore, matchKind: 'fuzzy' })
      matchedSourceIds.add(best.id)
      continue
    }
    missing.push(candidate)
    // Suggestion pass: below-threshold pairings a human confirms/rejects on
    // the review page instead of hand-hunting both lists.
    let suggestion = null
    if (best && bestScore >= suggestionFloor) {
      suggestion = { source: best, score: bestScore, reason: `fuzzy:${bestScore.toFixed(2)}` }
    } else {
      const loose = bestBy(pool, (source) =>
        similarity(candidate.area, `${source.name} ${source.description ?? ''}`, 1)
      )
      if (loose.best && loose.bestScore >= threshold) {
        suggestion = { source: loose.best, score: loose.bestScore, reason: `fuzzy-short:${loose.bestScore.toFixed(2)}` }
      }
    }
    if (!suggestion && candidate.nickname) {
      const hit = pool.find((source) => similarity(source.name, candidate.nickname, 1) > 0)
      if (hit) suggestion = { source: hit, score: 0, reason: 'nickname' }
    }
    if (suggestion) suggestions.push({ candidate, ...suggestion })
  }
  const unmatchedExisting = uniqueSources.filter((source) => !matchedSourceIds.has(source.id))
  return { matched, missing, suggestions, unmatchedExisting }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd adhoc && npm test`
Expected: PASS, including all pre-existing differ tests. If a pre-existing test asserts on the exact shape of `matched` entries, extend that assertion with `matchKind` rather than weakening it.

- [ ] **Step 5: Regression — rerun the recon report and compare numbers**

Run: `docker compose -f compose.dev.yml exec adhoc node scripts/recon-report.js`
Expected: same numbers as Task 2 step 6 (recon passes no nickname candidates, so matched/missing/unmatched counts must be identical).

- [ ] **Step 6: Commit**

```bash
git add adhoc/src/bulbapedia/differ.js adhoc/test/differ.test.js
git commit -m "feat(adhoc): differ nickname matching and sub-threshold pairing suggestions"
```

---

### Task 4: Staged-row builder (`build-staged-rows.js`)

Pure mapping from diff output to DB-shaped staged rows: natural keys, per-version collapse, draft names, source-type guessing, confidence, expected-absent labeling, existing-row snapshots.

**Files:**
- Create: `adhoc/src/staging/build-staged-rows.js`
- Create: `adhoc/test/build-staged-rows.test.js`

**Interfaces:**
- Consumes: the **Diff result** shape (Task 3) with `unmatchedExisting` already filtered to gen ≤ 7 by the caller.
- Produces:
  - `PARSER_VERSION` (string constant, bump on material parser changes)
  - `candidateKey(candidate)` → sha1 hex string
  - `guessSourceType(candidate)` → `source_type` value
  - `buildStagedRows({matched, missing, suggestions, unmatchedExisting}, {pokemonNames})` → `{rows, warnings}` where rows use the **Staged row object** shape. `pokemonNames` is a `Map<pokemonId, name>`.

- [ ] **Step 1: Write the failing tests**

`adhoc/test/build-staged-rows.test.js`:

```js
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildStagedRows,
  candidateKey,
  guessSourceType,
  PARSER_VERSION,
} from '../src/staging/build-staged-rows.js'

const candidate = (extra = {}) => ({
  pokemonId: 4, gen: 3, game: 'Ruby', area: 'Lavaridge Town (gift)',
  rawArea: '[[Lavaridge Town]] (gift)', origin: 'availability',
  reasons: ['gift language'], pageTitle: 'Testmon (Pokémon)', revid: 99,
  nickname: null, ...extra,
})
const pokemonNames = new Map([[4, 'Charmander'], [122, 'Mr. Mime'], [360, 'Wynaut']])
const emptyDiff = { matched: [], missing: [], suggestions: [], unmatchedExisting: [] }

describe('candidateKey', () => {
  it('is stable and ignores the game (per-version collapse)', () => {
    assert.equal(candidateKey(candidate()), candidateKey(candidate({ game: 'Sapphire' })))
    assert.notEqual(candidateKey(candidate()), candidateKey(candidate({ gen: 4 })))
    assert.notEqual(candidateKey(candidate()), candidateKey(candidate({ area: 'other' })))
  })
})

describe('guessSourceType', () => {
  it('maps reasons and origins to source types in priority order', () => {
    assert.equal(guessSourceType(candidate()), 'gift')
    assert.equal(guessSourceType(candidate({ origin: 'trades' })), 'npc-trade')
    assert.equal(guessSourceType(candidate({ reasons: ['npc trade', 'gift language'] })), 'npc-trade')
    assert.equal(guessSourceType(candidate({ reasons: ['starter'] })), 'starter')
    assert.equal(guessSourceType(candidate({ reasons: ['fossil'] })), 'fossil')
    assert.equal(guessSourceType(candidate({ reasons: ['honey tree'] })), 'honey-tree')
    assert.equal(guessSourceType(candidate({ origin: 'event-list', reasons: ['event-list'] })), 'event')
    assert.equal(guessSourceType(candidate({ reasons: ['prize'] })), 'prize')
    assert.equal(guessSourceType(candidate({ origin: 'side-games', reasons: [] })), 'side-game')
    assert.equal(guessSourceType(candidate({ reasons: [] })), 'special')
  })
})

describe('buildStagedRows — new rows', () => {
  it('collapses per-version duplicates into one row with a games union', () => {
    const { rows } = buildStagedRows(
      { ...emptyDiff, missing: [candidate(), candidate({ game: 'Sapphire' })] },
      { pokemonNames })
    assert.equal(rows.length, 1)
    const [row] = rows
    assert.equal(row.rowKind, 'new')
    assert.deepEqual(row.games, ['Ruby', 'Sapphire'])
    assert.equal(row.pokemonId, 4)
    assert.equal(row.gen, 3)
    assert.equal(row.source, 'gift')
    assert.equal(row.name, 'Charmander — Ruby/Sapphire gift')
    assert.equal(row.description, 'Lavaridge Town (gift)')
    assert.equal(row.rawSnippet, '[[Lavaridge Town]] (gift)')
    assert.equal(row.confidence, 'low')
    assert.equal(row.parserVersion, PARSER_VERSION)
    assert.equal(row.naturalKey, candidateKey(candidate()))
  })

  it('uses the nickname as the draft name and medium confidence for trades', () => {
    const trade = candidate({
      pokemonId: 122, gen: 1, game: 'Red and Blue', origin: 'trades',
      reasons: ['npc trade'], nickname: 'Marcel',
      area: 'In-game trade: receive Mr. Mime for Abra at Route 2', rawArea: null,
    })
    const { rows } = buildStagedRows({ ...emptyDiff, missing: [trade] }, { pokemonNames })
    assert.equal(rows[0].name, 'Marcel')
    assert.equal(rows[0].source, 'npc-trade')
    assert.equal(rows[0].confidence, 'medium')
    assert.equal(rows[0].rawSnippet, 'In-game trade: receive Mr. Mime for Abra at Route 2')
  })

  it('attaches the best suggestion to its new row', () => {
    const c = candidate()
    const suggestion = { candidate: c, source: { id: 'src-9' }, score: 0.25, reason: 'fuzzy:0.25' }
    const { rows } = buildStagedRows(
      { ...emptyDiff, missing: [c], suggestions: [suggestion] }, { pokemonNames })
    assert.equal(rows[0].suggestedSourceId, 'src-9')
    assert.equal(rows[0].suggestionReason, 'fuzzy:0.25')
  })
})

describe('buildStagedRows — audit rows', () => {
  it('carries matchedSourceId and upgrades nickname matches to high confidence', () => {
    const c = candidate({ origin: 'trades', nickname: 'Marcel', pokemonId: 122, gen: 1 })
    const { rows } = buildStagedRows(
      { ...emptyDiff, matched: [{ candidate: c, source: { id: 'src-1' }, score: 1, matchKind: 'nickname' }] },
      { pokemonNames })
    assert.equal(rows[0].rowKind, 'audit')
    assert.equal(rows[0].matchedSourceId, 'src-1')
    assert.equal(rows[0].confidence, 'high')
  })

  it('warns when one collapsed group matched different sources and keeps the best', () => {
    const a = candidate()
    const b = candidate({ game: 'Sapphire' })
    const { rows, warnings } = buildStagedRows(
      { ...emptyDiff, matched: [
        { candidate: a, source: { id: 'src-1' }, score: 0.9, matchKind: 'fuzzy' },
        { candidate: b, source: { id: 'src-2' }, score: 0.5, matchKind: 'fuzzy' },
      ] },
      { pokemonNames })
    assert.equal(rows.length, 1)
    assert.equal(rows[0].matchedSourceId, 'src-1')
    assert.equal(warnings.length, 1)
  })
})

describe('buildStagedRows — existing-unmatched rows', () => {
  const sourceRow = { id: 'src-3', pokemonId: 360, name: 'Pokewalker Wynaut', description: null, gen: 4, source: 'pokewalker' }

  it('snapshots the source row and labels pokewalker as expected-absent', () => {
    const { rows } = buildStagedRows({ ...emptyDiff, unmatchedExisting: [sourceRow] }, { pokemonNames })
    const [row] = rows
    assert.equal(row.rowKind, 'existing-unmatched')
    assert.equal(row.naturalKey, 'existing:src-3')
    assert.equal(row.pokemonId, 360)
    assert.equal(row.gen, 4)
    assert.equal(row.matchedSourceId, 'src-3')
    assert.equal(row.expectedAbsent, true)
    assert.equal(row.name, null)
    assert.deepEqual(JSON.parse(row.rawSnippet), sourceRow)
  })

  it('non-pokewalker unmatched rows are not expected-absent', () => {
    const { rows } = buildStagedRows(
      { ...emptyDiff, unmatchedExisting: [{ ...sourceRow, source: 'gift' }] }, { pokemonNames })
    assert.equal(rows[0].expectedAbsent, false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd adhoc && npm test`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `adhoc/src/staging/build-staged-rows.js`**

```js
// Map differ output to staged_sources-shaped rows. Pure: the staging script
// owns fs/DB, this owns the mapping, so tests run without cache or DB.
import { createHash } from 'node:crypto'

export const PARSER_VERSION = '2026-08-18.1'

// Source types that cannot appear in Bulbapedia availability data (the
// pokewalker rows were hand-gathered from Serebii). Their unmatched rows
// are expected, not errors — the review page hides them by default.
const EXPECTED_ABSENT_TYPES = ['pokewalker']

// The game is deliberately excluded: per-version duplicates (a Ruby and a
// Sapphire row of one gift) share a key and collapse into one staged row.
export const candidateKey = (candidate) =>
  createHash('sha1')
    .update(['candidate', candidate.origin, candidate.pokemonId, candidate.gen, candidate.area].join(' '))
    .digest('hex')

// First match wins; keep npc-trade above gift (trade entries often carry
// gift-ish language) and event pages above their method text.
const TYPE_GUESSES = [
  ['npc-trade', (c) => c.origin === 'trades' || c.reasons.includes('npc trade') || c.reasons.includes('trade language')],
  ['starter', (c) => c.reasons.includes('starter')],
  ['fossil', (c) => c.reasons.includes('fossil')],
  ['honey-tree', (c) => c.reasons.includes('honey tree')],
  ['event', (c) => c.origin === 'event-list' || c.origin === 'distribution' || c.reasons.includes('links to event list')],
  ['prize', (c) => c.reasons.includes('prize')],
  ['side-game', (c) => c.origin === 'side-games' || c.reasons.includes('shadow snag') || c.reasons.includes('side-game completion prize')],
  ['gift', (c) => c.reasons.includes('gift language')],
]
export const guessSourceType = (candidate) =>
  TYPE_GUESSES.find(([, test]) => test(candidate))?.[0] ?? 'special'

const NAME_LABELS = {
  'npc-trade': 'in-game trade', 'honey-tree': 'honey tree', 'side-game': 'side game',
  'static-default': 'static', gift: 'gift', starter: 'starter', fossil: 'fossil',
  event: 'event', prize: 'prize', special: 'special',
}

const MEDIUM_CONFIDENCE_ORIGINS = ['trades', 'event-list', 'distribution']
const confidenceFor = (candidate, matchKind = null) => {
  if (matchKind === 'nickname') return 'high'
  return MEDIUM_CONFIDENCE_ORIGINS.includes(candidate.origin) ? 'medium' : 'low'
}

export const buildStagedRows = ({ matched, missing, suggestions, unmatchedExisting }, { pokemonNames }) => {
  const rows = []
  const warnings = []

  // Group candidate-bearing entries by natural key. A key can't appear in
  // both matched and missing: identical (origin, pokemonId, gen, area)
  // candidates see the same pool and scores, so they diff identically.
  const groups = new Map()
  const groupFor = (candidate) => {
    const key = candidateKey(candidate)
    if (!groups.has(key)) groups.set(key, { key, candidates: [], matches: [] })
    const group = groups.get(key)
    group.candidates.push(candidate)
    return group
  }
  for (const entry of matched) groupFor(entry.candidate).matches.push(entry)
  for (const candidate of missing) groupFor(candidate)

  const suggestionByKey = new Map()
  for (const suggestion of suggestions) {
    const key = candidateKey(suggestion.candidate)
    const current = suggestionByKey.get(key)
    if (!current || suggestion.score > current.score) suggestionByKey.set(key, suggestion)
  }

  for (const group of groups.values()) {
    const [candidate] = group.candidates
    const games = [...new Set(group.candidates.map((c) => c.game || c.origin))]
    const sourceType = guessSourceType(candidate)
    const pokemonName = pokemonNames.get(candidate.pokemonId) ?? `#${candidate.pokemonId}`
    const bestMatch = group.matches.toSorted((a, b) => b.score - a.score)[0] ?? null
    if (bestMatch && new Set(group.matches.map((m) => m.source.id)).size > 1) {
      warnings.push(`group ${group.key} (${pokemonName} gen ${candidate.gen}) matched multiple sources; kept best`)
    }
    const suggestion = bestMatch ? null : suggestionByKey.get(group.key) ?? null
    rows.push({
      naturalKey: group.key,
      rowKind: bestMatch ? 'audit' : 'new',
      pokemonId: candidate.pokemonId,
      name: candidate.nickname ?? `${pokemonName} — ${games.join('/')} ${NAME_LABELS[sourceType] ?? sourceType}`,
      description: candidate.area,
      image: null,
      gen: candidate.gen,
      source: sourceType,
      replaceDefault: false,
      confidence: confidenceFor(candidate, bestMatch?.matchKind ?? null),
      matchedSourceId: bestMatch?.source.id ?? null,
      suggestedSourceId: suggestion?.source.id ?? null,
      suggestionReason: suggestion?.reason ?? null,
      expectedAbsent: false,
      pageTitle: candidate.pageTitle ?? null,
      revid: candidate.revid ?? null,
      rawSnippet: candidate.rawArea ?? candidate.area,
      origin: candidate.origin,
      games,
      parserVersion: PARSER_VERSION,
    })
  }

  for (const source of unmatchedExisting) {
    rows.push({
      naturalKey: `existing:${source.id}`,
      rowKind: 'existing-unmatched',
      pokemonId: source.pokemonId,
      name: null, description: null, image: null,
      gen: source.gen,
      source: null, replaceDefault: null, confidence: null,
      matchedSourceId: source.id,
      suggestedSourceId: null, suggestionReason: null,
      expectedAbsent: EXPECTED_ABSENT_TYPES.includes(source.source),
      pageTitle: null, revid: null,
      // Snapshot so the audit trail survives a guarded delete, which nulls
      // matched_source_id before removing the sources row.
      rawSnippet: JSON.stringify(source),
      origin: null, games: null,
      parserVersion: PARSER_VERSION,
    })
  }

  return { rows, warnings }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd adhoc && npm test`
Expected: PASS. (`toSorted` requires Node 20+; adhoc pins ≥ 24.)

- [ ] **Step 5: Commit**

```bash
git add adhoc/src/staging/build-staged-rows.js adhoc/test/build-staged-rows.test.js
git commit -m "feat(adhoc): staged-row builder with natural keys, type guessing, confidence"
```

---

### Task 5: Staging script (`stage-candidates.js`)

**Files:**
- Create: `adhoc/scripts/stage-candidates.js`

**Interfaces:**
- Consumes: everything from Tasks 2–4; `adhoc/pg-pool.js`; the cache layout recon-report.js reads (`bulbapedia-cache/pokemon/*.json`, `bulbapedia-cache/aux/*.json`).
- Produces: populated `staged_sources` rows; console summary. Later tasks only consume the table.

- [ ] **Step 1: Write the script**

```js
// Increment-2 staging: parse the Bulbapedia cache, diff against sources,
// and upsert the review worklist into staged_sources. Idempotent: pending
// rows refresh, reviewed rows are never touched, stale pending rows are
// deleted. The ONLY writes are to staged_sources. See
// docs/superpowers/specs/2026-08-18-phase-4-increment-2-staging-review-design.md.
//
// Run inside the adhoc container (stack must be up):
//   docker compose -f compose.dev.yml exec adhoc node scripts/stage-candidates.js
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import pgPool from '../pg-pool.js'
import { parseTrades } from '../src/bulbapedia/trades.js'
import {
  collectPokemonCandidates,
  collectAuxCandidates,
  collectTradeCandidates,
} from '../src/bulbapedia/collect.js'
import { diffCandidates } from '../src/bulbapedia/differ.js'
import { buildStagedRows } from '../src/staging/build-staged-rows.js'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const CACHE = path.join(HERE, '..', 'bulbapedia-cache')
const readJson = async (file) => JSON.parse(await fs.readFile(file, 'utf8'))

// ---- collect candidates ----------------------------------------------------
const candidates = []
const warnings = []

const pokemonFiles = (await fs.readdir(path.join(CACHE, 'pokemon'))).filter((f) => f.endsWith('.json'))
for (const file of pokemonFiles) {
  const page = await readJson(path.join(CACHE, 'pokemon', file))
  const result = collectPokemonCandidates(file, page)
  warnings.push(...result.warnings)
  candidates.push(...result.candidates)
}

const auxFiles = (await fs.readdir(path.join(CACHE, 'aux'))).filter((f) => f.endsWith('.json'))
for (const file of auxFiles) {
  const page = await readJson(path.join(CACHE, 'aux', file))
  if (file.startsWith('list-of-in-game-trades')) {
    const { trades, unparsed } = parseTrades(page.wikitext)
    warnings.push(...unparsed.map((row) => `unparsed trade row (${row.heading})`))
    const result = collectTradeCandidates(trades, page)
    warnings.push(...result.warnings)
    candidates.push(...result.candidates)
    continue
  }
  const result = collectAuxCandidates(file, page)
  warnings.push(...result.warnings)
  candidates.push(...result.candidates)
}

// ---- diff against the DB ---------------------------------------------------
const { rows: sources } = await pgPool.query(
  'select id, pokemon_id as "pokemonId", name, description, gen, source from sources order by id'
)
const { rows: pokemon } = await pgPool.query('select id, name from pokemon order by id')
const pokemonNames = new Map(pokemon.map(({ id, name }) => [id, name]))

const inScope = candidates.filter((candidate) => candidate.gen >= 1 && candidate.gen <= 7)
const diff = diffCandidates(inScope, sources)
const unmatchedInScope = diff.unmatchedExisting.filter((source) => source.gen <= 7)
const { rows, warnings: buildWarnings } = buildStagedRows(
  { ...diff, unmatchedExisting: unmatchedInScope },
  { pokemonNames }
)
warnings.push(...buildWarnings)

// ---- upsert ------------------------------------------------------------------
// where status = 'pending': reviewed rows are a permanent audit trail.
// pairing_confirmed guards row_kind/matched/suggested: a restage must not
// undo a human-confirmed pairing on a still-pending row.
const UPSERT = `
insert into staged_sources (
  id, natural_key, row_kind, pokemon_id, name, description, image, gen,
  source, replace_default, confidence, matched_source_id,
  suggested_source_id, suggestion_reason, expected_absent, page_title,
  revid, raw_snippet, origin, games, parser_version
) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
on conflict (natural_key) do update set
  row_kind = case when staged_sources.pairing_confirmed then staged_sources.row_kind else excluded.row_kind end,
  matched_source_id = case when staged_sources.pairing_confirmed then staged_sources.matched_source_id else excluded.matched_source_id end,
  suggested_source_id = case when staged_sources.pairing_confirmed then null else excluded.suggested_source_id end,
  suggestion_reason = case when staged_sources.pairing_confirmed then null else excluded.suggestion_reason end,
  pokemon_id = excluded.pokemon_id,
  name = excluded.name,
  description = excluded.description,
  gen = excluded.gen,
  source = excluded.source,
  replace_default = excluded.replace_default,
  confidence = excluded.confidence,
  expected_absent = excluded.expected_absent,
  page_title = excluded.page_title,
  revid = excluded.revid,
  raw_snippet = excluded.raw_snippet,
  origin = excluded.origin,
  games = excluded.games,
  parser_version = excluded.parser_version,
  staged_at = now()
where staged_sources.status = 'pending'
`

const client = await pgPool.connect()
try {
  await client.query('begin')
  for (const row of rows) {
    await client.query(UPSERT, [
      randomUUID(), row.naturalKey, row.rowKind, row.pokemonId, row.name,
      row.description, row.image, row.gen, row.source, row.replaceDefault,
      row.confidence, row.matchedSourceId, row.suggestedSourceId,
      row.suggestionReason, row.expectedAbsent, row.pageTitle, row.revid,
      row.rawSnippet, row.origin, row.games, row.parserVersion,
    ])
  }
  const { rowCount: staleDeleted } = await client.query(
    `delete from staged_sources where status = 'pending' and not (natural_key = any($1::text[]))`,
    [rows.map((row) => row.naturalKey)]
  )
  await client.query('commit')
  const byKind = rows.reduce((acc, row) => ({ ...acc, [row.rowKind]: (acc[row.rowKind] ?? 0) + 1 }), {})
  console.log(`staged ${rows.length} rows`, byKind)
  console.log(`stale pending rows deleted: ${staleDeleted}`)
  console.log(`warnings: ${warnings.length}`)
  for (const warning of warnings.slice(0, 40)) console.log(`  ${warning}`)
} catch (error) {
  await client.query('rollback')
  throw error
} finally {
  client.release()
  await pgPool.end()
}
```

- [ ] **Step 2: Run it against the dev DB**

```bash
docker compose -f compose.dev.yml exec adhoc node scripts/stage-candidates.js
```

Expected: `staged ~1000-1300 rows { new: ..., audit: ..., existing-unmatched: ~248 }` (new+audit is the recon's 1901 candidates collapsed per-version and now including trades candidates; existing-unmatched ≈ 248 minus rows newly matched via nickname/trades candidates). No error, exit 0.

- [ ] **Step 3: Sanity-check the table**

```bash
docker compose -f compose.dev.yml exec -T postgres psql -U postgres -d pokemon -c "select row_kind, count(*), count(*) filter (where expected_absent) as expected from staged_sources group by row_kind; select count(*) as pokewalker_expected from staged_sources where expected_absent;"
```

Expected: pokewalker_expected = 120 (the recon-reconciliation number); every row_kind present; suggestions exist (`select count(*) from staged_sources where suggested_source_id is not null` > 0).

- [ ] **Step 4: Verify restage idempotency**

Run the script again, then:

```bash
docker compose -f compose.dev.yml exec -T postgres psql -U postgres -d pokemon -c "select count(*) from staged_sources;"
```

Expected: same total as after the first run; script reports `stale pending rows deleted: 0`.

- [ ] **Step 5: Commit**

```bash
git add adhoc/scripts/stage-candidates.js
git commit -m "feat(adhoc): stage-candidates script upserts the review worklist"
```

---

### Task 6: API — admin gate, list, summary

**Files:**
- Create: `api/src/staged-sources/staged-sources-repository.js`
- Create: `api/src/staged-sources/staged-sources-routes.js`
- Create: `api/test/staged-helpers.js`
- Create: `api/test/staged-sources-routes.test.js`
- Modify: `api/src/app.js` (import + mount)

**Interfaces:**
- Consumes: `staged_sources` table (Task 1), Passport `req.user`, `camelize`, `pg-pool`.
- Produces (repository, consumed by Tasks 7–9 and the UI):
  - `isUserAdmin(userId)` → boolean
  - `listStagedSources({gen, status, rowKind, confidence, includeExpected})` → array of camelized rows, each with `pokemonName`, `matchedSource` (nested object or null), `suggestedSource`, `referenceCount` (int)
  - `getStagedSummary()` → `[{gen, status, rowKind, expectedAbsent, count}]`
- Produces (HTTP): `GET /api/staged-sources` → `{stagedSources: [...]}`; `GET /api/staged-sources/summary` → `{summary: [...]}`. Both 401 for non-admins via the router-scoped `requireAdmin`.

- [ ] **Step 1: Write the test helpers**

`api/test/staged-helpers.js`:

```js
import fs from 'node:fs'
import { fileURLToPath } from 'url'
import { randomUUID } from 'crypto'
import pgPool from '../src/pg-pool.js'

// The migration is idempotent (if-not-exists / duplicate_object guards), so
// every test run can apply it — no manual DB prep step for CI or fresh DBs.
export const applyStagedMigration = () =>
  pgPool.query(
    fs.readFileSync(
      fileURLToPath(new URL('../../adhoc/scripts/migrations/2026-08-staged-sources.sql', import.meta.url)),
      'utf8'
    )
  )

// parser_version 'test' is the cleanup handle for all planted rows.
export const insertStagedRow = async (overrides = {}) => {
  const row = {
    id: randomUUID(),
    naturalKey: `test-${randomUUID()}`,
    rowKind: 'new',
    status: 'pending',
    pokemonId: 1,
    name: 'staged-test-row',
    description: 'staged test description',
    image: null,
    gen: 1,
    source: 'gift',
    replaceDefault: false,
    confidence: 'low',
    matchedSourceId: null,
    suggestedSourceId: null,
    suggestionReason: null,
    expectedAbsent: false,
    pageTitle: 'Test page',
    revid: 1,
    rawSnippet: 'raw snippet',
    origin: 'availability',
    games: ['Red'],
    parserVersion: 'test',
    ...overrides,
  }
  await pgPool.query(
    `insert into staged_sources (
      id, natural_key, row_kind, status, pokemon_id, name, description, image,
      gen, source, replace_default, confidence, matched_source_id,
      suggested_source_id, suggestion_reason, expected_absent, page_title,
      revid, raw_snippet, origin, games, parser_version
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22);`,
    [
      row.id, row.naturalKey, row.rowKind, row.status, row.pokemonId, row.name,
      row.description, row.image, row.gen, row.source, row.replaceDefault,
      row.confidence, row.matchedSourceId, row.suggestedSourceId,
      row.suggestionReason, row.expectedAbsent, row.pageTitle, row.revid,
      row.rawSnippet, row.origin, row.games, row.parserVersion,
    ]
  )
  return row
}

export const cleanupStagedTestRows = () =>
  pgPool.query(`delete from staged_sources where parser_version = 'test';`)

// Test sources rows carry this name prefix for cleanup.
export const insertTestSource = async (overrides = {}) => {
  const source = {
    id: randomUUID(), pokemonId: 1, name: `staged-api-test-${randomUUID().slice(0, 8)}`,
    description: 'test source', image: null, gen: 1, source: 'gift', replaceDefault: false,
    ...overrides,
  }
  await pgPool.query(
    `insert into sources (id, pokemon_id, name, description, image, gen, source, replace_default)
     values ($1,$2,$3,$4,$5,$6,$7,$8);`,
    [source.id, source.pokemonId, source.name, source.description, source.image, source.gen, source.source, source.replaceDefault]
  )
  return source
}

export const cleanupTestSources = () =>
  pgPool.query(`delete from sources where name like 'staged-api-test-%';`)
```

- [ ] **Step 2: Write the failing tests**

`api/test/staged-sources-routes.test.js`:

```js
import './setup.js'
import assert from 'node:assert/strict'
import { describe, it, before, after } from 'node:test'
import app from '../src/app.js'
import pgPool from '../src/pg-pool.js'
import { loginAgent } from './helpers.js'
import {
  applyStagedMigration, insertStagedRow, cleanupStagedTestRows,
  insertTestSource, cleanupTestSources,
} from './staged-helpers.js'

let agent, userId, savedIsAdmin
const setAdmin = (value) =>
  pgPool.query(`update users set is_admin = $1 where id = $2;`, [value, userId])

before(async () => {
  await applyStagedMigration()
  agent = await loginAgent(app)
  userId = (await agent.get('/api/auth/login')).body.id
  savedIsAdmin = (
    await pgPool.query(`select is_admin from users where id = $1;`, [userId])
  ).rows[0].is_admin
  await setAdmin(true)
})

after(async () => {
  await cleanupStagedTestRows()
  await cleanupTestSources()
  await setAdmin(savedIsAdmin)
})

describe('admin gate', () => {
  it('a non-admin gets 401 from every staged-sources route', async () => {
    try {
      await setAdmin(false)
      assert.equal((await agent.get('/api/staged-sources')).status, 401)
      assert.equal((await agent.get('/api/staged-sources/summary')).status, 401)
    } finally {
      await setAdmin(true)
    }
  })

  it('the gate does not block other /api routes for non-admins', async () => {
    try {
      await setAdmin(false)
      assert.equal((await agent.get('/api/sources?pokemonId=1')).status, 200)
    } finally {
      await setAdmin(true)
    }
  })
})

describe('GET /api/staged-sources', () => {
  before(async () => {
    await insertStagedRow({ gen: 1, name: 'list-a' })
    await insertStagedRow({ gen: 2, name: 'list-b' })
    await insertStagedRow({ gen: 1, status: 'rejected', name: 'list-c' })
    await insertStagedRow({ gen: 1, expectedAbsent: true, rowKind: 'existing-unmatched', name: null, source: null, confidence: null, origin: null, games: null })
  })

  it('defaults to pending rows without expected-absent, filtered by gen', async () => {
    const res = await agent.get('/api/staged-sources?gen=1')
    assert.equal(res.status, 200)
    const names = res.body.stagedSources.map((r) => r.name)
    assert.ok(names.includes('list-a'))
    assert.ok(!names.includes('list-b'), 'gen filter applies')
    assert.ok(!names.includes('list-c'), 'rejected excluded by default')
    assert.ok(!res.body.stagedSources.some((r) => r.expectedAbsent), 'expected-absent hidden by default')
  })

  it('includeExpected=true and status=all widen the listing', async () => {
    const res = await agent.get('/api/staged-sources?gen=1&includeExpected=true&status=all')
    assert.ok(res.body.stagedSources.some((r) => r.expectedAbsent))
    assert.ok(res.body.stagedSources.some((r) => r.status === 'rejected'))
  })

  it('joins pokemon name, matched source, and reference count', async () => {
    const source = await insertTestSource()
    await pgPool.query(
      `insert into users_pokemon_sources (id, users_pokemon_id, source_id, is_inherited)
       select gen_random_uuid(), gen_random_uuid(), $1, false from generate_series(1, 2);`,
      [source.id]
    )
    try {
      await insertStagedRow({ rowKind: 'existing-unmatched', matchedSourceId: source.id, name: null, source: null, confidence: null, origin: null, games: null })
      const res = await agent.get('/api/staged-sources?gen=1&rowKind=existing-unmatched')
      const row = res.body.stagedSources.find((r) => r.matchedSourceId === source.id)
      assert.ok(row)
      assert.equal(row.pokemonName.toLowerCase(), 'bulbasaur')
      assert.equal(row.matchedSource.name, source.name)
      assert.equal(row.referenceCount, 2)
    } finally {
      await pgPool.query(`delete from users_pokemon_sources where source_id = $1;`, [source.id])
    }
  })
})

describe('GET /api/staged-sources/summary', () => {
  it('returns counts by gen, status, rowKind, expectedAbsent', async () => {
    const res = await agent.get('/api/staged-sources/summary')
    assert.equal(res.status, 200)
    const bucket = res.body.summary.find(
      (s) => s.gen === 1 && s.status === 'pending' && s.rowKind === 'new' && s.expectedAbsent === false
    )
    assert.ok(bucket)
    assert.ok(bucket.count >= 1)
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd api && node --test test/staged-sources-routes.test.js` (dev stack up)
Expected: FAIL — 404s (router not mounted) / module not found.

- [ ] **Step 4: Implement the repository (list/summary/admin parts)**

`api/src/staged-sources/staged-sources-repository.js`:

```js
import pgPool from '../pg-pool.js'
import camelize from 'camelize'

export const isUserAdmin = (userId) =>
  pgPool
    .query('select is_admin from users where id = $1;', [userId])
    .then((res) => res.rows[0]?.is_admin ?? false)

export const listStagedSources = ({
  gen = null,
  status = 'pending',
  rowKind = null,
  confidence = null,
  includeExpected = false,
}) =>
  pgPool
    .query(
      `select ss.*, p.name as pokemon_name,
        row_to_json(ms) as matched_source,
        row_to_json(sg) as suggested_source,
        coalesce(refs.count, 0) as reference_count
      from staged_sources ss
      join pokemon p on p.id = ss.pokemon_id
      left join sources ms on ms.id = ss.matched_source_id
      left join sources sg on sg.id = ss.suggested_source_id
      left join (
        select source_id, count(*)::int as count
        from users_pokemon_sources group by source_id
      ) refs on refs.source_id = ss.matched_source_id
      where (cast($1 as integer) is null or ss.gen = $1)
        and (cast($2 as staged_status) is null or ss.status = $2)
        and (cast($3 as staged_row_kind) is null or ss.row_kind = $3)
        and (cast($4 as staged_confidence) is null or ss.confidence = $4)
        and ($5 or not ss.expected_absent)
      order by ss.pokemon_id, ss.gen, ss.row_kind, ss.natural_key;`,
      [gen, status, rowKind, confidence, includeExpected]
    )
    .then((res) => camelize(res.rows))

export const getStagedSummary = () =>
  pgPool
    .query(
      `select gen, status, row_kind, expected_absent, count(*)::int as count
      from staged_sources
      group by gen, status, row_kind, expected_absent
      order by gen;`
    )
    .then((res) => camelize(res.rows))
```

- [ ] **Step 5: Implement the routes and mount them**

`api/src/staged-sources/staged-sources-routes.js`:

```js
import express from 'express'
const router = express.Router()
import { isUserAdmin, listStagedSources, getStagedSummary } from './staged-sources-repository.js'

// Path-scoped: this router is mounted at /api alongside the others, and an
// unscoped router.use() would gate every /api request passing through.
const requireAdmin = async (req, res, next) => {
  if (!(await isUserAdmin(req.user.id))) {
    return res.status(401).send({ message: 'User is not authorized to review staged sources' })
  }
  next()
}
router.use('/staged-sources', requireAdmin)

router.get('/staged-sources/summary', async (req, res) => {
  res.status(200).send({ summary: await getStagedSummary() })
})

router.get('/staged-sources', async (req, res) => {
  const stagedSources = await listStagedSources({
    gen: req.query.gen ? parseInt(req.query.gen, 10) : null,
    status: req.query.status === 'all' ? null : req.query.status ?? 'pending',
    rowKind: req.query.rowKind ?? null,
    confidence: req.query.confidence ?? null,
    includeExpected: req.query.includeExpected === 'true',
  })
  res.status(200).send({ stagedSources })
})

export default router
```

In `api/src/app.js`, add with the other router imports and mounts:

```js
import stagedSourcesRouter from './staged-sources/staged-sources-routes.js'
```

```js
app.use('/api', authCheck, stagedSourcesRouter)
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd api && node --test test/staged-sources-routes.test.js`
Expected: PASS. Then `cd api && npm test` — the full suite must stay green (especially `sources-routes.test.js`, proving the admin gate is scoped).

- [ ] **Step 7: Commit**

```bash
git add api/src/staged-sources api/src/app.js api/test/staged-helpers.js api/test/staged-sources-routes.test.js
git commit -m "feat(api): staged-sources list/summary routes behind admin gate"
```

---

### Task 7: API — edit (PATCH) and reject

**Files:**
- Modify: `api/src/staged-sources/staged-sources-repository.js`
- Modify: `api/src/staged-sources/staged-sources-routes.js`
- Modify: `api/test/staged-sources-routes.test.js` (append)

**Interfaces:**
- Produces: `updateStagedSource(id, {name, description, source, gen, replaceDefault})` → updated camelized row or null (not found / not pending); `rejectStagedSource(id)` → updated row or null. HTTP: `PATCH /api/staged-sources/:id` → `{stagedSource}` or 404; `POST /api/staged-sources/:id/reject` → `{stagedSource}` or 404.

- [ ] **Step 1: Write the failing tests (append to the test file)**

```js
describe('PATCH /api/staged-sources/:id', () => {
  it('edits pending fields and leaves others alone', async () => {
    const row = await insertStagedRow()
    const res = await agent
      .patch(`/api/staged-sources/${row.id}`)
      .send({ name: 'polished name', source: 'npc-trade' })
    assert.equal(res.status, 200)
    assert.equal(res.body.stagedSource.name, 'polished name')
    assert.equal(res.body.stagedSource.source, 'npc-trade')
    assert.equal(res.body.stagedSource.description, 'staged test description')
  })

  it('404s on a non-pending row', async () => {
    const row = await insertStagedRow({ status: 'rejected' })
    const res = await agent.patch(`/api/staged-sources/${row.id}`).send({ name: 'x' })
    assert.equal(res.status, 404)
  })
})

describe('POST /api/staged-sources/:id/reject', () => {
  it('rejects a pending row and stamps reviewed_at', async () => {
    const row = await insertStagedRow()
    const res = await agent.post(`/api/staged-sources/${row.id}/reject`)
    assert.equal(res.status, 200)
    assert.equal(res.body.stagedSource.status, 'rejected')
    assert.ok(res.body.stagedSource.reviewedAt)
  })

  it('404s when rejecting twice', async () => {
    const row = await insertStagedRow()
    await agent.post(`/api/staged-sources/${row.id}/reject`)
    assert.equal((await agent.post(`/api/staged-sources/${row.id}/reject`)).status, 404)
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd api && node --test test/staged-sources-routes.test.js`
Expected: new tests FAIL with 404 (routes missing).

- [ ] **Step 3: Implement repository functions (append)**

```js
export const updateStagedSource = (id, { name, description, source, gen, replaceDefault }) =>
  pgPool
    .query(
      `update staged_sources set
        name = coalesce($2, name),
        description = coalesce($3, description),
        source = coalesce($4, source),
        gen = coalesce($5, gen),
        replace_default = coalesce($6, replace_default)
      where id = $1 and status = 'pending'
      returning *;`,
      [id, name ?? null, description ?? null, source ?? null, gen ?? null, replaceDefault ?? null]
    )
    .then((res) => camelize(res.rows[0] ?? null))

export const rejectStagedSource = (id) =>
  pgPool
    .query(
      `update staged_sources set status = 'rejected', reviewed_at = now()
      where id = $1 and status = 'pending'
      returning *;`,
      [id]
    )
    .then((res) => camelize(res.rows[0] ?? null))
```

- [ ] **Step 4: Implement routes (append)**

```js
router.patch('/staged-sources/:id', async (req, res) => {
  const { name, description, source, gen, replaceDefault } = req.body
  const stagedSource = await updateStagedSource(req.params.id, {
    name, description, source, gen, replaceDefault,
  })
  if (!stagedSource) return res.status(404).send({ message: 'No pending staged source with that id' })
  res.status(200).send({ stagedSource })
})

router.post('/staged-sources/:id/reject', async (req, res) => {
  const stagedSource = await rejectStagedSource(req.params.id)
  if (!stagedSource) return res.status(404).send({ message: 'No pending staged source with that id' })
  res.status(200).send({ stagedSource })
})
```

(Extend the repository import list at the top of the routes file.)

- [ ] **Step 5: Run tests to verify they pass, then commit**

Run: `cd api && node --test test/staged-sources-routes.test.js` — PASS.

```bash
git add api/src/staged-sources api/test/staged-sources-routes.test.js
git commit -m "feat(api): staged-source edit and reject routes"
```

---

### Task 8: API — approve (all variants, guarded delete)

**Files:**
- Modify: `api/src/staged-sources/staged-sources-repository.js`
- Modify: `api/src/staged-sources/staged-sources-routes.js`
- Modify: `api/test/staged-sources-routes.test.js` (append)

**Interfaces:**
- Produces: `approveStagedSource(id, {action, confirmReferencedDelete})` → updated row, or null (not found/not pending), or throws `InvalidActionError` / `ReferencedSourceError` (has `.referenceCount`). HTTP: `POST /api/staged-sources/:id/approve` → 200 `{stagedSource}`, 400 (bad action), 404, or 409 `{message, referenceCount}`.
- Every `sources` write happens inside the same transaction as the staged-row status update.

- [ ] **Step 1: Write the failing tests (append)**

```js
describe('POST /api/staged-sources/:id/approve', () => {
  it('new: inserts into sources and records created_source_id', async () => {
    const row = await insertStagedRow({ name: 'staged-api-test-created' })
    const res = await agent.post(`/api/staged-sources/${row.id}/approve`)
    assert.equal(res.status, 200)
    assert.equal(res.body.stagedSource.status, 'approved')
    assert.equal(res.body.stagedSource.resolution, 'created')
    const created = await pgPool.query(`select * from sources where id = $1;`, [
      res.body.stagedSource.createdSourceId,
    ])
    assert.equal(created.rows.length, 1)
    assert.equal(created.rows[0].name, 'staged-api-test-created')
    assert.equal(created.rows[0].pokemon_id, 1)
  })

  it('audit no-change: resolution kept, sources untouched', async () => {
    const source = await insertTestSource()
    const row = await insertStagedRow({ rowKind: 'audit', matchedSourceId: source.id, name: 'parsed name' })
    const res = await agent.post(`/api/staged-sources/${row.id}/approve`).send({ action: 'no-change' })
    assert.equal(res.body.stagedSource.resolution, 'kept')
    const kept = await pgPool.query(`select name from sources where id = $1;`, [source.id])
    assert.equal(kept.rows[0].name, source.name)
  })

  it('audit apply: updates the matched sources row from staged fields', async () => {
    const source = await insertTestSource()
    const row = await insertStagedRow({ rowKind: 'audit', matchedSourceId: source.id, name: 'staged-api-test-applied', source: 'npc-trade' })
    const res = await agent.post(`/api/staged-sources/${row.id}/approve`).send({ action: 'apply' })
    assert.equal(res.body.stagedSource.resolution, 'updated')
    const updated = await pgPool.query(`select name, source from sources where id = $1;`, [source.id])
    assert.equal(updated.rows[0].name, 'staged-api-test-applied')
    assert.equal(updated.rows[0].source, 'npc-trade')
  })

  it('audit with a missing action is a 400', async () => {
    const source = await insertTestSource()
    const row = await insertStagedRow({ rowKind: 'audit', matchedSourceId: source.id })
    assert.equal((await agent.post(`/api/staged-sources/${row.id}/approve`)).status, 400)
  })

  it('existing-unmatched keep: resolution kept', async () => {
    const source = await insertTestSource()
    const row = await insertStagedRow({ rowKind: 'existing-unmatched', matchedSourceId: source.id, name: null, source: null, confidence: null, origin: null, games: null })
    const res = await agent.post(`/api/staged-sources/${row.id}/approve`).send({ action: 'keep' })
    assert.equal(res.body.stagedSource.resolution, 'kept')
  })

  it('existing-unmatched update: coalesces staged fields onto the source', async () => {
    const source = await insertTestSource()
    const row = await insertStagedRow({ rowKind: 'existing-unmatched', matchedSourceId: source.id, name: 'staged-api-test-renamed', source: null, confidence: null, origin: null, games: null })
    await agent.post(`/api/staged-sources/${row.id}/approve`).send({ action: 'update' })
    const updated = await pgPool.query(`select name, source from sources where id = $1;`, [source.id])
    assert.equal(updated.rows[0].name, 'staged-api-test-renamed')
    assert.equal(updated.rows[0].source, source.source, 'null staged fields fall back to existing')
  })

  it('unreferenced delete removes the source outright', async () => {
    const source = await insertTestSource()
    const row = await insertStagedRow({ rowKind: 'existing-unmatched', matchedSourceId: source.id, name: null, source: null, confidence: null, origin: null, games: null })
    const res = await agent.post(`/api/staged-sources/${row.id}/approve`).send({ action: 'delete' })
    assert.equal(res.body.stagedSource.resolution, 'deleted')
    assert.equal(res.body.stagedSource.matchedSourceId, null, 'ref nulled so the FK allows the delete')
    const gone = await pgPool.query(`select 1 from sources where id = $1;`, [source.id])
    assert.equal(gone.rows.length, 0)
  })

  it('referenced delete 409s without the confirm flag, deletes refs with it', async () => {
    const source = await insertTestSource()
    await pgPool.query(
      `insert into users_pokemon_sources (id, users_pokemon_id, source_id, is_inherited)
       values (gen_random_uuid(), gen_random_uuid(), $1, false);`,
      [source.id]
    )
    const row = await insertStagedRow({ rowKind: 'existing-unmatched', matchedSourceId: source.id, name: null, source: null, confidence: null, origin: null, games: null })

    const blocked = await agent.post(`/api/staged-sources/${row.id}/approve`).send({ action: 'delete' })
    assert.equal(blocked.status, 409)
    assert.equal(blocked.body.referenceCount, 1)
    const stillThere = await pgPool.query(`select 1 from sources where id = $1;`, [source.id])
    assert.equal(stillThere.rows.length, 1, '409 must not half-delete')

    const confirmed = await agent
      .post(`/api/staged-sources/${row.id}/approve`)
      .send({ action: 'delete', confirmReferencedDelete: true })
    assert.equal(confirmed.status, 200)
    const refs = await pgPool.query(`select 1 from users_pokemon_sources where source_id = $1;`, [source.id])
    assert.equal(refs.rows.length, 0)
    const gone = await pgPool.query(`select 1 from sources where id = $1;`, [source.id])
    assert.equal(gone.rows.length, 0)
  })

  it('404s on an already-approved row', async () => {
    const row = await insertStagedRow()
    await agent.post(`/api/staged-sources/${row.id}/approve`)
    assert.equal((await agent.post(`/api/staged-sources/${row.id}/approve`)).status, 404)
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd api && node --test test/staged-sources-routes.test.js`
Expected: approve tests FAIL with 404.

- [ ] **Step 3: Implement `approveStagedSource` (append to repository)**

```js
import { randomUUID } from 'crypto'

export class InvalidActionError extends Error {}
export class ReferencedSourceError extends Error {
  constructor(referenceCount) {
    super('Source is referenced by user tracking rows')
    this.referenceCount = referenceCount
  }
}

export const approveStagedSource = async (id, { action = null, confirmReferencedDelete = false } = {}) => {
  const client = await pgPool.connect()
  try {
    await client.query('begin')
    const staged = camelize(
      (
        await client.query(
          `select * from staged_sources where id = $1 and status = 'pending' for update;`,
          [id]
        )
      ).rows[0] ?? null
    )
    if (!staged) {
      await client.query('rollback')
      return null
    }

    let resolution
    if (staged.rowKind === 'new') {
      const sourceId = randomUUID()
      await client.query(
        `insert into sources (id, pokemon_id, name, description, image, gen, source, replace_default)
         values ($1,$2,$3,$4,$5,$6,$7,$8);`,
        [sourceId, staged.pokemonId, staged.name, staged.description, staged.image,
          staged.gen, staged.source, staged.replaceDefault ?? false]
      )
      await client.query(`update staged_sources set created_source_id = $2 where id = $1;`, [id, sourceId])
      resolution = 'created'
    } else if (staged.rowKind === 'audit') {
      if (action === 'apply') {
        await client.query(
          `update sources set name = $2, description = $3, gen = $4, source = $5, replace_default = $6
           where id = $1;`,
          [staged.matchedSourceId, staged.name, staged.description, staged.gen,
            staged.source, staged.replaceDefault ?? false]
        )
        resolution = 'updated'
      } else if (action === 'no-change') {
        resolution = 'kept'
      } else {
        throw new InvalidActionError(`audit rows need action apply or no-change, got ${action}`)
      }
    } else {
      // existing-unmatched
      if (action === 'keep') {
        resolution = 'kept'
      } else if (action === 'update') {
        await client.query(
          `update sources set
            name = coalesce($2, name), description = coalesce($3, description),
            gen = coalesce($4, gen), source = coalesce($5, source),
            replace_default = coalesce($6, replace_default)
           where id = $1;`,
          [staged.matchedSourceId, staged.name, staged.description, staged.gen,
            staged.source, staged.replaceDefault]
        )
        resolution = 'updated'
      } else if (action === 'delete') {
        const referenceCount = (
          await client.query(
            `select count(*)::int as count from users_pokemon_sources where source_id = $1;`,
            [staged.matchedSourceId]
          )
        ).rows[0].count
        if (referenceCount > 0 && !confirmReferencedDelete) throw new ReferencedSourceError(referenceCount)
        await client.query(`delete from users_pokemon_sources where source_id = $1;`, [staged.matchedSourceId])
        // Null every staged reference before the delete so the FKs allow it;
        // this row's raw_snippet snapshot preserves what was deleted.
        await client.query(
          `update staged_sources set suggested_source_id = null, suggestion_reason = null
           where suggested_source_id = $1;`,
          [staged.matchedSourceId]
        )
        await client.query(
          `update staged_sources set matched_source_id = null where matched_source_id = $1;`,
          [staged.matchedSourceId]
        )
        await client.query(`delete from sources where id = $1;`, [staged.matchedSourceId])
        resolution = 'deleted'
      } else {
        throw new InvalidActionError(`existing-unmatched rows need action keep, update, or delete, got ${action}`)
      }
    }

    const updated = camelize(
      (
        await client.query(
          `update staged_sources set status = 'approved', resolution = $2, reviewed_at = now()
           where id = $1 returning *;`,
          [id, resolution]
        )
      ).rows[0]
    )
    await client.query('commit')
    return updated
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
}
```

(Remove any duplicate `randomUUID` import if one was added earlier.)

- [ ] **Step 4: Implement the route (append)**

```js
router.post('/staged-sources/:id/approve', async (req, res) => {
  try {
    const stagedSource = await approveStagedSource(req.params.id, {
      action: req.body?.action ?? null,
      confirmReferencedDelete: req.body?.confirmReferencedDelete === true,
    })
    if (!stagedSource) return res.status(404).send({ message: 'No pending staged source with that id' })
    res.status(200).send({ stagedSource })
  } catch (error) {
    if (error instanceof InvalidActionError) return res.status(400).send({ message: error.message })
    if (error instanceof ReferencedSourceError) {
      return res.status(409).send({ message: error.message, referenceCount: error.referenceCount })
    }
    throw error
  }
})
```

- [ ] **Step 5: Run tests to verify they pass, then commit**

Run: `cd api && node --test test/staged-sources-routes.test.js` — PASS.

```bash
git add api/src/staged-sources api/test/staged-sources-routes.test.js
git commit -m "feat(api): staged-source approval with per-kind actions and guarded delete"
```

---

### Task 9: API — pairing confirm/reject and bulk approve

**Files:**
- Modify: `api/src/staged-sources/staged-sources-repository.js`
- Modify: `api/src/staged-sources/staged-sources-routes.js`
- Modify: `api/test/staged-sources-routes.test.js` (append)

**Interfaces:**
- Produces: `resolvePairing(id, confirm)` → updated row or null (not found / not pending / not a `new` row with a suggestion); `bulkApproveStagedSources(ids)` → `{approvedIds, skippedIds}` (skipped = not pending or not `new`). HTTP: `POST /api/staged-sources/:id/pairing` `{confirm: bool}` → `{stagedSource}` or 404; `POST /api/staged-sources/bulk-approve` `{ids: []}` → `{approvedIds, skippedIds}`.

- [ ] **Step 1: Write the failing tests (append)**

```js
describe('POST /api/staged-sources/:id/pairing', () => {
  it('confirm promotes the suggestion to a confirmed audit pairing and resolves the partner', async () => {
    const source = await insertTestSource()
    const partner = await insertStagedRow({ rowKind: 'existing-unmatched', matchedSourceId: source.id, name: null, source: null, confidence: null, origin: null, games: null })
    const row = await insertStagedRow({ suggestedSourceId: source.id, suggestionReason: 'nickname' })

    const res = await agent.post(`/api/staged-sources/${row.id}/pairing`).send({ confirm: true })
    assert.equal(res.status, 200)
    assert.equal(res.body.stagedSource.rowKind, 'audit')
    assert.equal(res.body.stagedSource.matchedSourceId, source.id)
    assert.equal(res.body.stagedSource.suggestedSourceId, null)
    assert.equal(res.body.stagedSource.pairingConfirmed, true)

    const resolved = await pgPool.query(`select status, resolution from staged_sources where id = $1;`, [partner.id])
    assert.equal(resolved.rows[0].status, 'approved')
    assert.equal(resolved.rows[0].resolution, 'paired')
  })

  it('reject clears the suggestion and leaves both rows pending', async () => {
    const source = await insertTestSource()
    const partner = await insertStagedRow({ rowKind: 'existing-unmatched', matchedSourceId: source.id, name: null, source: null, confidence: null, origin: null, games: null })
    const row = await insertStagedRow({ suggestedSourceId: source.id, suggestionReason: 'fuzzy:0.20' })

    const res = await agent.post(`/api/staged-sources/${row.id}/pairing`).send({ confirm: false })
    assert.equal(res.body.stagedSource.suggestedSourceId, null)
    assert.equal(res.body.stagedSource.rowKind, 'new')
    const untouched = await pgPool.query(`select status from staged_sources where id = $1;`, [partner.id])
    assert.equal(untouched.rows[0].status, 'pending')
  })

  it('404s on a row without a suggestion', async () => {
    const row = await insertStagedRow()
    assert.equal((await agent.post(`/api/staged-sources/${row.id}/pairing`).send({ confirm: true })).status, 404)
  })
})

describe('POST /api/staged-sources/bulk-approve', () => {
  it('approves pending new rows and skips everything else', async () => {
    const a = await insertStagedRow({ name: 'staged-api-test-bulk-a' })
    const b = await insertStagedRow({ name: 'staged-api-test-bulk-b' })
    const source = await insertTestSource()
    const audit = await insertStagedRow({ rowKind: 'audit', matchedSourceId: source.id })
    const rejected = await insertStagedRow({ status: 'rejected' })

    const res = await agent
      .post('/api/staged-sources/bulk-approve')
      .send({ ids: [a.id, b.id, audit.id, rejected.id] })
    assert.equal(res.status, 200)
    assert.deepEqual(new Set(res.body.approvedIds), new Set([a.id, b.id]))
    assert.deepEqual(new Set(res.body.skippedIds), new Set([audit.id, rejected.id]))

    const created = await pgPool.query(
      `select name from sources where name in ('staged-api-test-bulk-a', 'staged-api-test-bulk-b');`
    )
    assert.equal(created.rows.length, 2)
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd api && node --test test/staged-sources-routes.test.js` — new tests FAIL with 404.

- [ ] **Step 3: Implement repository functions (append)**

```js
export const resolvePairing = async (id, confirm) => {
  const client = await pgPool.connect()
  try {
    await client.query('begin')
    const staged = camelize(
      (
        await client.query(
          `select * from staged_sources
           where id = $1 and status = 'pending' and row_kind = 'new'
             and suggested_source_id is not null
           for update;`,
          [id]
        )
      ).rows[0] ?? null
    )
    if (!staged) {
      await client.query('rollback')
      return null
    }
    let updated
    if (confirm) {
      updated = camelize(
        (
          await client.query(
            `update staged_sources set
              matched_source_id = suggested_source_id,
              suggested_source_id = null, suggestion_reason = null,
              row_kind = 'audit', pairing_confirmed = true
             where id = $1 returning *;`,
            [id]
          )
        ).rows[0]
      )
      await client.query(
        `update staged_sources set status = 'approved', resolution = 'paired', reviewed_at = now()
         where row_kind = 'existing-unmatched' and matched_source_id = $1 and status = 'pending';`,
        [staged.suggestedSourceId]
      )
    } else {
      updated = camelize(
        (
          await client.query(
            `update staged_sources set suggested_source_id = null, suggestion_reason = null
             where id = $1 returning *;`,
            [id]
          )
        ).rows[0]
      )
    }
    await client.query('commit')
    return updated
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
}

export const bulkApproveStagedSources = async (ids) => {
  const client = await pgPool.connect()
  try {
    await client.query('begin')
    const approvedIds = []
    const skippedIds = []
    for (const id of ids) {
      const staged = camelize(
        (
          await client.query(
            `select * from staged_sources
             where id = $1 and status = 'pending' and row_kind = 'new' for update;`,
            [id]
          )
        ).rows[0] ?? null
      )
      if (!staged) {
        skippedIds.push(id)
        continue
      }
      const sourceId = randomUUID()
      await client.query(
        `insert into sources (id, pokemon_id, name, description, image, gen, source, replace_default)
         values ($1,$2,$3,$4,$5,$6,$7,$8);`,
        [sourceId, staged.pokemonId, staged.name, staged.description, staged.image,
          staged.gen, staged.source, staged.replaceDefault ?? false]
      )
      await client.query(
        `update staged_sources set status = 'approved', resolution = 'created',
          created_source_id = $2, reviewed_at = now()
         where id = $1;`,
        [id, sourceId]
      )
      approvedIds.push(id)
    }
    await client.query('commit')
    return { approvedIds, skippedIds }
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
}
```

- [ ] **Step 4: Implement routes (append)**

```js
router.post('/staged-sources/:id/pairing', async (req, res) => {
  const stagedSource = await resolvePairing(req.params.id, req.body?.confirm === true)
  if (!stagedSource) {
    return res.status(404).send({ message: 'No pending new staged source with a suggestion for that id' })
  }
  res.status(200).send({ stagedSource })
})

router.post('/staged-sources/bulk-approve', async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : []
  res.status(200).send(await bulkApproveStagedSources(ids))
})
```

- [ ] **Step 5: Run the full API suite, then commit**

Run: `cd api && npm test` — everything PASS.

```bash
git add api/src/staged-sources api/test/staged-sources-routes.test.js
git commit -m "feat(api): pairing confirm/reject and bulk approve for staged sources"
```

---

### Task 10: Review page shell — route, gate, tabs, filters, grouping logic

**Files:**
- Create: `app/src/components/review/review.logic.jsx`
- Create: `app/src/components/review/review.logic.test.js`
- Create: `app/src/components/review/review.jsx`
- Create: `app/src/components/review/review.scss`
- Modify: `app/src/app.jsx` (add route)

**Interfaces:**
- Consumes: `GET /api/staged-sources` / `GET /api/staged-sources/summary` (Task 6 shapes), `GET /api/auth/login` for the admin check (same as sources.jsx).
- Produces (logic module, consumed by Task 11–12 components):
  - `pendingCountsByGen(summary, includeExpected)` → `Map<gen, count>` of pending rows
  - `groupByPokemon(rows)` → `[{pokemonId, pokemonName, rows}]` (input order preserved — the API sorts)
  - `buildListQuery(gen, {status, rowKind, confidence, includeExpected})` → query string
  - `fieldDiffs(row)` → `[{field, staged, existing, changed}]` over name/description/gen/source/replaceDefault vs `row.matchedSource`
- Produces (page): `/review` route rendering grouped rows; `StagedRow` (Task 11) receives `{row, onAction}` where `onAction()` refetches list + summary.

- [ ] **Step 1: Write the failing logic tests**

`app/src/components/review/review.logic.test.js`:

```js
import { describe, it, expect } from 'vitest'
import {
  pendingCountsByGen,
  groupByPokemon,
  buildListQuery,
  fieldDiffs,
} from './review.logic'

describe('pendingCountsByGen', () => {
  const summary = [
    { gen: 1, status: 'pending', rowKind: 'new', expectedAbsent: false, count: 5 },
    { gen: 1, status: 'pending', rowKind: 'existing-unmatched', expectedAbsent: true, count: 3 },
    { gen: 1, status: 'approved', rowKind: 'new', expectedAbsent: false, count: 9 },
    { gen: 4, status: 'pending', rowKind: 'audit', expectedAbsent: false, count: 2 },
  ]

  it('sums pending rows per gen, excluding expected-absent by default', () => {
    const counts = pendingCountsByGen(summary, false)
    expect(counts.get(1)).toBe(5)
    expect(counts.get(4)).toBe(2)
  })

  it('includes expected-absent rows when asked', () => {
    expect(pendingCountsByGen(summary, true).get(1)).toBe(8)
  })
})

describe('groupByPokemon', () => {
  it('groups consecutive rows by pokemonId keeping order', () => {
    const rows = [
      { id: 'a', pokemonId: 4, pokemonName: 'Charmander' },
      { id: 'b', pokemonId: 4, pokemonName: 'Charmander' },
      { id: 'c', pokemonId: 25, pokemonName: 'Pikachu' },
    ]
    const groups = groupByPokemon(rows)
    expect(groups).toHaveLength(2)
    expect(groups[0].pokemonName).toBe('Charmander')
    expect(groups[0].rows.map((r) => r.id)).toEqual(['a', 'b'])
    expect(groups[1].rows.map((r) => r.id)).toEqual(['c'])
  })
})

describe('buildListQuery', () => {
  it('serializes gen and non-default filters', () => {
    expect(buildListQuery(1, { status: 'pending', rowKind: null, confidence: null, includeExpected: false }))
      .toBe('gen=1&status=pending&includeExpected=false')
    expect(buildListQuery(3, { status: 'all', rowKind: 'new', confidence: 'high', includeExpected: true }))
      .toBe('gen=3&status=all&rowKind=new&confidence=high&includeExpected=true')
  })
})

describe('fieldDiffs', () => {
  it('marks changed fields between staged values and the matched source', () => {
    const row = {
      name: 'Parsed name', description: 'same', gen: 3, source: 'gift', replaceDefault: false,
      matchedSource: { name: 'Old name', description: 'same', gen: 3, source: 'gift', replace_default: false },
    }
    const diffs = fieldDiffs(row)
    const byField = Object.fromEntries(diffs.map((d) => [d.field, d]))
    expect(byField.name.changed).toBe(true)
    expect(byField.name.existing).toBe('Old name')
    expect(byField.description.changed).toBe(false)
    expect(byField.gen.changed).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd app && npm test`
Expected: FAIL — module not found; existing app tests still pass.

- [ ] **Step 3: Implement `review.logic.jsx`**

```js
// Pure helpers for the review page, split out for unit testing (house
// pattern: see box-view.logic.jsx).

export const pendingCountsByGen = (summary, includeExpected = false) => {
  const counts = new Map()
  for (const bucket of summary) {
    if (bucket.status !== 'pending') continue
    if (!includeExpected && bucket.expectedAbsent) continue
    counts.set(bucket.gen, (counts.get(bucket.gen) ?? 0) + bucket.count)
  }
  return counts
}

export const groupByPokemon = (rows) => {
  const groups = []
  for (const row of rows) {
    const last = groups[groups.length - 1]
    if (last && last.pokemonId === row.pokemonId) last.rows.push(row)
    else groups.push({ pokemonId: row.pokemonId, pokemonName: row.pokemonName, rows: [row] })
  }
  return groups
}

export const buildListQuery = (gen, { status, rowKind, confidence, includeExpected }) => {
  const params = new URLSearchParams()
  params.set('gen', gen)
  params.set('status', status)
  if (rowKind) params.set('rowKind', rowKind)
  if (confidence) params.set('confidence', confidence)
  params.set('includeExpected', String(includeExpected))
  return params.toString()
}

const DIFF_FIELDS = [
  ['name', 'name'],
  ['description', 'description'],
  ['gen', 'gen'],
  ['source', 'source'],
  ['replaceDefault', 'replace_default'],
]

export const fieldDiffs = (row) => {
  const existing = row.matchedSource ?? {}
  return DIFF_FIELDS.map(([field, existingKey]) => {
    const staged = row[field] ?? null
    const current = existing[existingKey] ?? null
    return { field, staged, existing: current, changed: staged !== current }
  })
}
```

Note: `matchedSource` comes from `row_to_json(sources)` — verify during implementation whether `camelize` converts its nested keys; if `matchedSource.replaceDefault` arrives camelized, change `DIFF_FIELDS` to use camelCase keys on both sides and update the test fixture to match reality.

- [ ] **Step 4: Run logic tests to verify they pass**

Run: `cd app && npm test` — PASS.

- [ ] **Step 5: Implement the page shell**

`app/src/components/review/review.jsx`:

```jsx
import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import { Navigate } from 'react-router'
import StagedRow from './staged-row/staged-row'
import { pendingCountsByGen, groupByPokemon, buildListQuery } from './review.logic'
import './review.scss'

const GENS = [1, 2, 3, 4, 5, 6, 7]
const DEFAULT_FILTERS = { status: 'pending', rowKind: null, confidence: null, includeExpected: false }

const Review = () => {
  const [userData, setUserData] = useState(null)
  const [shouldRedirect, setShouldRedirect] = useState(false)
  const [summary, setSummary] = useState([])
  const [gen, setGen] = useState(1)
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [rows, setRows] = useState([])
  const [selectedIds, setSelectedIds] = useState(new Set())

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await axios.get('/api/auth/login', { withCredentials: true })
        if (response?.data?.id && response?.data?.isAdmin) setUserData(response.data)
        else setShouldRedirect(true)
      } catch (error) {
        setShouldRedirect(true)
      }
    }
    checkAuth()
  }, [])

  const loadSummary = useCallback(async () => {
    const response = await axios.get('/api/staged-sources/summary')
    setSummary(response.data.summary)
  }, [])

  const loadRows = useCallback(async () => {
    const response = await axios.get(`/api/staged-sources?${buildListQuery(gen, filters)}`)
    setRows(response.data.stagedSources)
    setSelectedIds(new Set())
  }, [gen, filters])

  useEffect(() => {
    if (!userData?.id) return
    loadSummary()
  }, [userData, loadSummary])

  useEffect(() => {
    if (!userData?.id) return
    loadRows()
  }, [userData, loadRows])

  const refresh = useCallback(async () => {
    await Promise.all([loadRows(), loadSummary()])
  }, [loadRows, loadSummary])

  const toggleSelected = (id) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectableIds = rows
    .filter((row) => row.rowKind === 'new' && row.status === 'pending')
    .map((row) => row.id)

  const handleBulkApprove = async () => {
    await axios.post('/api/staged-sources/bulk-approve', { ids: [...selectedIds] })
    await refresh()
  }

  const pendingCounts = pendingCountsByGen(summary, filters.includeExpected)
  const groups = groupByPokemon(rows)

  return shouldRedirect ? (
    <Navigate to="/login" replace />
  ) : (
    <div className="review-container">
      <h1 className="review-header">Source review</h1>
      <div className="gen-tabs">
        {GENS.map((g) => (
          <button
            key={g}
            className={`gen-tab ${g === gen ? 'active' : ''}`}
            onClick={() => setGen(g)}
          >
            Gen {g} ({pendingCounts.get(g) ?? 0})
          </button>
        ))}
      </div>
      <div className="filter-bar">
        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
        >
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="all">All</option>
        </select>
        <select
          value={filters.rowKind ?? ''}
          onChange={(e) => setFilters({ ...filters, rowKind: e.target.value || null })}
        >
          <option value="">All kinds</option>
          <option value="new">New</option>
          <option value="audit">Audit</option>
          <option value="existing-unmatched">Existing unmatched</option>
        </select>
        <select
          value={filters.confidence ?? ''}
          onChange={(e) => setFilters({ ...filters, confidence: e.target.value || null })}
        >
          <option value="">All confidence</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <label className="expected-toggle">
          <input
            type="checkbox"
            checked={filters.includeExpected}
            onChange={(e) => setFilters({ ...filters, includeExpected: e.target.checked })}
          />
          Show expected-absent
        </label>
      </div>
      {selectableIds.length > 0 && (
        <div className="bulk-bar">
          <label>
            <input
              type="checkbox"
              checked={selectedIds.size === selectableIds.length && selectableIds.length > 0}
              onChange={(e) =>
                setSelectedIds(e.target.checked ? new Set(selectableIds) : new Set())
              }
            />
            Select all new rows in view ({selectableIds.length})
          </label>
          <button
            className="bulk-approve-button"
            disabled={selectedIds.size === 0}
            onClick={handleBulkApprove}
          >
            Approve selected ({selectedIds.size})
          </button>
        </div>
      )}
      {groups.map((group) => (
        <div className="pokemon-group" key={`${group.pokemonId}`}>
          <h2 className="pokemon-group-header">
            #{group.pokemonId} {group.pokemonName}
          </h2>
          {group.rows.map((row) => (
            <StagedRow
              key={row.id}
              row={row}
              selected={selectedIds.has(row.id)}
              onToggleSelected={() => toggleSelected(row.id)}
              onAction={refresh}
            />
          ))}
        </div>
      ))}
      {rows.length === 0 && <p className="empty-message">Nothing to review with these filters.</p>}
    </div>
  )
}

export default Review
```

`app/src/components/review/review.scss` (minimal; extend at implementation time to match the app's look):

```scss
.review-container {
  padding: 1rem 2rem;

  .gen-tabs {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;

    .gen-tab.active {
      font-weight: bold;
      text-decoration: underline;
    }
  }

  .filter-bar {
    display: flex;
    gap: 1rem;
    align-items: center;
    margin-bottom: 1rem;
  }

  .bulk-bar {
    display: flex;
    gap: 1rem;
    align-items: center;
    margin-bottom: 1rem;
  }

  .pokemon-group {
    margin-bottom: 1.5rem;

    .pokemon-group-header {
      margin-bottom: 0.5rem;
    }
  }

  .empty-message {
    opacity: 0.7;
  }
}
```

In `app/src/app.jsx`, add:

```jsx
import Review from './components/review/review'
```

```jsx
<Route path="/review" element={<Review />} />
```

Until Task 11 exists, create a placeholder `app/src/components/review/staged-row/staged-row.jsx`:

```jsx
const StagedRow = ({ row }) => <div className="staged-row">{row.name ?? row.naturalKey}</div>
export default StagedRow
```

- [ ] **Step 6: Manual verification**

Dev stack up, staging run from Task 5 done. Visit http://localhost:3000/api/auth/dev-login then http://localhost:3000/review.
Expected: gen tabs with counts; switching tabs and filters refetches; gen 4 with "Show expected-absent" toggled shows ~120 more rows; non-admin (or logged-out) hits redirect to /login.

- [ ] **Step 7: Commit**

```bash
git add app/src/components/review app/src/app.jsx
git commit -m "feat(app): /review page shell with gen tabs, filters, grouping"
```

---

### Task 11: StagedRow — rendering, inline edit, provenance, new-row actions

**Files:**
- Replace: `app/src/components/review/staged-row/staged-row.jsx` (the Task 10 placeholder)
- Create: `app/src/components/review/staged-row/staged-row.scss`

**Interfaces:**
- Consumes: list-row shape (Task 6): all staged columns camelized + `pokemonName`, `matchedSource`, `suggestedSource`, `referenceCount`; API routes from Tasks 7–9. Props from Task 10: `{row, selected, onToggleSelected, onAction}`.
- Produces: the complete per-row UI used for every row kind (Task 12 adds the kind-specific panels into this file).

- [ ] **Step 1: Implement the row component**

```jsx
import { useState } from 'react'
import axios from 'axios'
import './staged-row.scss'

const EDITABLE_TYPES = [
  'npc-trade', 'side-game', 'special', 'starter', 'prize', 'gift',
  'pokewalker', 'fossil', 'honey-tree', 'event', 'game-corner', 'static-default',
]

const StagedRow = ({ row, selected, onToggleSelected, onAction }) => {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState({
    name: row.name ?? '',
    description: row.description ?? '',
    source: row.source ?? 'special',
    gen: row.gen,
  })

  const patch = async () => {
    await axios.patch(`/api/staged-sources/${row.id}`, {
      name: draft.name,
      description: draft.description,
      source: draft.source,
      gen: Number(draft.gen),
    })
    setIsEditing(false)
    await onAction()
  }

  const approve = async (body) => {
    await axios.post(`/api/staged-sources/${row.id}/approve`, body ?? {})
    await onAction()
  }

  const reject = async () => {
    await axios.post(`/api/staged-sources/${row.id}/reject`)
    await onAction()
  }

  const isPending = row.status === 'pending'

  return (
    <div className={`staged-row kind-${row.rowKind} status-${row.status}`}>
      <div className="staged-row-header">
        {isPending && row.rowKind === 'new' && (
          <input type="checkbox" checked={selected} onChange={onToggleSelected} />
        )}
        <span className={`kind-badge kind-${row.rowKind}`}>{row.rowKind}</span>
        {row.confidence && (
          <span className={`confidence-chip confidence-${row.confidence}`}>{row.confidence}</span>
        )}
        {row.expectedAbsent && <span className="expected-chip">expected absent</span>}
        {!isPending && <span className="resolution-chip">{row.status}: {row.resolution}</span>}
      </div>

      {row.rowKind !== 'existing-unmatched' &&
        (isEditing ? (
          <div className="staged-fields-edit">
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            <textarea
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
            <select value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value })}>
              {EDITABLE_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            <input
              type="number"
              value={draft.gen}
              onChange={(e) => setDraft({ ...draft, gen: e.target.value })}
            />
            <button onClick={patch}>Save</button>
            <button onClick={() => setIsEditing(false)}>Cancel</button>
          </div>
        ) : (
          <div className="staged-fields">
            <span className="staged-name">{row.name}</span>
            <span className="staged-type">{row.source}</span>
            <span className="staged-desc">{row.description}</span>
            {isPending && <button onClick={() => setIsEditing(true)}>Edit</button>}
          </div>
        ))}

      {row.rawSnippet && row.rowKind !== 'existing-unmatched' && (
        <details className="provenance">
          <summary>
            {row.origin} — {row.pageTitle} (rev {row.revid}) — {row.games?.join(', ')}
          </summary>
          <pre className="raw-snippet">{row.rawSnippet}</pre>
        </details>
      )}

      {isPending && row.rowKind === 'new' && !row.suggestedSourceId && (
        <div className="row-actions">
          <button className="approve-button" onClick={() => approve()}>Approve</button>
          <button className="reject-button" onClick={reject}>Reject</button>
        </div>
      )}
    </div>
  )
}

export default StagedRow
```

`app/src/components/review/staged-row/staged-row.scss`:

```scss
.staged-row {
  border: 1px solid rgba(0, 0, 0, 0.2);
  border-radius: 4px;
  padding: 0.5rem 0.75rem;
  margin-bottom: 0.5rem;

  .staged-row-header {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    margin-bottom: 0.25rem;
  }

  .kind-badge,
  .confidence-chip,
  .expected-chip,
  .resolution-chip {
    font-size: 0.75rem;
    padding: 0.1rem 0.4rem;
    border-radius: 3px;
    border: 1px solid currentColor;
  }

  .staged-fields,
  .staged-fields-edit {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    flex-wrap: wrap;

    .staged-name { font-weight: bold; }
    .staged-desc { opacity: 0.85; }
    textarea { min-width: 20rem; }
  }

  .provenance .raw-snippet {
    white-space: pre-wrap;
    font-size: 0.8rem;
    max-height: 12rem;
    overflow-y: auto;
  }

  .row-actions {
    margin-top: 0.5rem;
    display: flex;
    gap: 0.5rem;
  }

  &.status-approved { opacity: 0.6; }
  &.status-rejected { opacity: 0.45; }
}
```

- [ ] **Step 2: Manual verification**

On /review (gen 1): a `new` row shows badge/chip/fields; Edit → change name → Save persists (refetch shows it); Approve moves the row out of the pending view and `select count(*) from sources where id = (select created_source_id from staged_sources where name = '<the name>')` returns 1; Reject removes another row from pending; provenance expands showing raw wikitext.

- [ ] **Step 3: Run app tests, then commit**

Run: `cd app && npm test` — PASS (logic tests unaffected).

```bash
git add app/src/components/review app/src/app.jsx
git commit -m "feat(app): staged row rendering with inline edit and new-row actions"
```

---

### Task 12: StagedRow — audit diff, pairing banner, existing-unmatched actions

**Files:**
- Modify: `app/src/components/review/staged-row/staged-row.jsx`
- Modify: `app/src/components/review/staged-row/staged-row.scss` (append styles)

**Interfaces:**
- Consumes: `fieldDiffs(row)` from review.logic (Task 10); approve/pairing routes (Tasks 8–9) including the 409 guarded-delete handshake.
- Produces: the finished review UI for all three row kinds.

- [ ] **Step 1: Add the kind-specific panels to `staged-row.jsx`**

Add the import:

```jsx
import { fieldDiffs } from '../review.logic'
```

Add these handlers next to `approve`/`reject`:

```jsx
  const resolvePairing = async (confirm) => {
    await axios.post(`/api/staged-sources/${row.id}/pairing`, { confirm })
    await onAction()
  }

  const guardedDelete = async () => {
    try {
      await approve({ action: 'delete' })
    } catch (error) {
      const { status, data } = error.response ?? {}
      if (status !== 409) throw error
      const confirmed = window.confirm(
        `${data.referenceCount} user tracking row(s) reference this source. Delete it and the tracking rows?`
      )
      if (confirmed) await approve({ action: 'delete', confirmReferencedDelete: true })
    }
  }
```

Add the panels inside the row (after the provenance block, replacing the Task 11 new-row actions block with the fuller version below):

```jsx
      {isPending && row.suggestedSourceId && row.suggestedSource && (
        <div className="pairing-banner">
          Suggested match ({row.suggestionReason}): <strong>{row.suggestedSource.name}</strong>
          {' — '}{row.suggestedSource.description ?? 'no description'} (gen {row.suggestedSource.gen})
          <button onClick={() => resolvePairing(true)}>Same source</button>
          <button onClick={() => resolvePairing(false)}>Not a match</button>
        </div>
      )}

      {row.rowKind === 'audit' && row.matchedSource && (
        <table className="audit-diff">
          <tbody>
            {fieldDiffs(row).map(({ field, staged, existing, changed }) => (
              <tr key={field} className={changed ? 'changed' : ''}>
                <td className="diff-field">{field}</td>
                <td className="diff-existing">{String(existing ?? '—')}</td>
                <td className="diff-staged">{String(staged ?? '—')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {row.rowKind === 'existing-unmatched' && row.matchedSource && (
        <div className="existing-summary">
          <span className="staged-name">{row.matchedSource.name}</span>
          <span className="staged-type">{row.matchedSource.source}</span>
          <span className="staged-desc">{row.matchedSource.description}</span>
          <span className="reference-count">{row.referenceCount} user reference(s)</span>
        </div>
      )}

      {isPending && (
        <div className="row-actions">
          {row.rowKind === 'new' && !row.suggestedSourceId && (
            <>
              <button className="approve-button" onClick={() => approve()}>Approve</button>
              <button className="reject-button" onClick={reject}>Reject</button>
            </>
          )}
          {row.rowKind === 'audit' && (
            <>
              <button onClick={() => approve({ action: 'no-change' })}>Existing is fine</button>
              <button onClick={() => approve({ action: 'apply' })}>Apply parsed changes</button>
              <button className="reject-button" onClick={reject}>Reject</button>
            </>
          )}
          {row.rowKind === 'existing-unmatched' && (
            <>
              <button onClick={() => approve({ action: 'keep' })}>Keep</button>
              <button className="delete-button" onClick={guardedDelete}>Delete</button>
              <button className="reject-button" onClick={reject}>Skip</button>
            </>
          )}
        </div>
      )}
```

Note: axios throws on 409, which `guardedDelete` catches; every other handler lets errors surface to the console (house style — no toast system exists).

Append styles:

```scss
  .pairing-banner {
    margin-top: 0.5rem;
    padding: 0.4rem 0.6rem;
    border: 1px dashed currentColor;
    border-radius: 4px;
    display: flex;
    gap: 0.5rem;
    align-items: center;
    flex-wrap: wrap;
  }

  .audit-diff {
    margin-top: 0.5rem;
    font-size: 0.85rem;

    td { padding: 0.1rem 0.6rem; }
    .diff-field { font-weight: bold; }
    tr.changed .diff-staged { font-weight: bold; text-decoration: underline; }
  }

  .existing-summary {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    flex-wrap: wrap;

    .reference-count { font-size: 0.8rem; opacity: 0.8; }
  }
```

- [ ] **Step 2: Manual verification (full workflow pass)**

On /review against the Task 5 staging run:
1. A row with a pairing banner: "Same source" flips it to an audit row and its partner existing-unmatched row leaves the pending view; "Not a match" (on another) clears the banner.
2. An audit row shows the diff table with changed fields highlighted; "Existing is fine" resolves it; "Apply parsed changes" on another updates the sources row (check via psql).
3. An existing-unmatched row shows the live row + reference count; Delete on an unreferenced one removes it; Delete on a referenced one (verify `referenceCount > 0` in the UI) shows the confirm dialog, and cancelling leaves everything intact.
4. Bulk: select-all new rows in a filtered view, Approve selected — rows land in `sources`.
5. Restage (`stage-candidates.js`) and confirm reviewed rows keep their state and the confirmed pairing survives (`select row_kind, pairing_confirmed from staged_sources where pairing_confirmed;`).

- [ ] **Step 3: Run all app tests, then commit**

Run: `cd app && npm test` — PASS.

```bash
git add app/src/components/review
git commit -m "feat(app): audit diff, pairing banner, guarded delete on review rows"
```

---

### Task 13: Wrap-up — docs, full test sweep

**Files:**
- Modify: `docs/source-data.md` (Position section)

**Interfaces:** none — closes the increment.

- [ ] **Step 1: Full test sweep**

Run all three suites; every one must pass:

```bash
cd adhoc && npm test
```

```bash
cd api && npm test
```

```bash
cd app && npm test
```

- [ ] **Step 2: Smoke-check staged counts against the recon report**

Rerun both scripts back-to-back and reconcile: recon's in-scope candidate count (matched + missing) should equal the staged new+audit rows before collapse; spot-check a handful of rows against `adhoc/recon-output/diff.json`. Verify the sanity trio still holds in staged form:

```bash
docker compose -f compose.dev.yml exec -T postgres psql -U postgres -d pokemon -c "select row_kind, name from staged_sources where pokemon_id in (207, 83, 360) order by pokemon_id;"
```

Expected: Gligar (207) has a Stadium 2 `new` row; Farfetch'd (83) and Wynaut (360) appear as `audit` rows.

- [ ] **Step 3: Update `docs/source-data.md`**

In the Position section, after the recon bullet points, add (adjust numbers to the actual run):

```markdown
- Staging live (phase 4 increment 2, 2026-08-18): `docker compose -f
  compose.dev.yml exec adhoc node scripts/stage-candidates.js` upserts the
  review worklist into `staged_sources` (idempotent; reviewed rows never
  touched). Review at `/review` in the app (admin only): per-gen tabs,
  pairing suggestions, guarded delete. Pokewalker rows are staged
  `expected_absent` and hidden by default. Approval is the only path into
  `sources`. Working the diff per gen = increment 4.
```

- [ ] **Step 4: Commit**

```bash
git add docs/source-data.md
git commit -m "docs: record staging pipeline position in source-data.md"
```

---

## Self-review notes (spec coverage)

- Schema/enums/provenance/restage → Task 1, 5. Differ nickname + suggestions + confidence → Task 3 (heuristic applied in Task 4). Staging script + pure builder + draft names + type guess → Tasks 4–5. Admin routes: list/summary → 6, PATCH → 7, approve variants + guarded delete → 8, pairing + bulk → 9. Review page: tabs/filters/grouping → 10, inline edit/provenance/new actions → 11, audit diff/pairing banner/unmatched actions → 12. Testing section of the spec → Tasks 2–4 (adhoc unit), 6–9 (API), 13 (smoke). Recon-review requirements: pokewalker labeling (Tasks 4, 6, 10), nickname matching (Task 3).
- The two additive spec deviations are declared at the top of this plan.
