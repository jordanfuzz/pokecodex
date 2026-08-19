# Bulbapedia Recon Parser Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Increment 1 of the phase-4 source pipeline (spec:
`docs/superpowers/specs/2026-08-18-phase-4-source-pipeline-design.md`): parse
the local Bulbapedia cache into classified candidate source records and produce
a read-only recon report diffing them against the existing `sources` table.

**Architecture:** Pure parsing modules in `adhoc/src/bulbapedia/` (no I/O, unit
tested against inline wikitext fixtures), plus one orchestrator script
`adhoc/scripts/recon-report.js` that reads the cache + DB and writes a
markdown report and JSON outputs to `adhoc/recon-output/` (gitignored, like the
cache). **No DB writes anywhere in this increment.**

**Tech Stack:** Node 24 ESM (adhoc service), `node:test` built-in runner
(new — adhoc has no tests yet), `pg` via existing `adhoc/pg-pool.js`.

## Global Constraints

- The cache (`adhoc/bulbapedia-cache/`) is gitignored and must never be
  committed; same for `adhoc/recon-output/`. Bulbapedia is NEVER re-fetched.
- Nothing in this increment writes to the database — SELECT only.
- Tests must not read the gitignored cache; fixtures are inline string
  literals copied from real cached pages.
- Tests run on the host: `cd adhoc && npm test` (compose stack must be up only
  for the final recon run, which executes inside the adhoc container).
- Repo files use LF; match existing adhoc code style (ESM, no semicolon-free
  style — follow `fetch-bulbapedia.js`: no semicolons, 2-space indent).

## Reference: verified cache facts (recon 2026-08-18)

- 1,010 pokemon pages in `bulbapedia-cache/pokemon/NNNN-slug.json`
  (`{fetchedAt, title, pageid, revid, revTimestamp, wikitext}`), 31 aux pages
  in `bulbapedia-cache/aux/`, empty `failures.json`.
- "Game locations" is a level-3 heading (`===Game locations===`) containing
  `{{Availability/...}}` templates; a level-4 `====In side games====`
  subsection uses the same template family (e.g. Gligar's Stadium 2 entry).
- Entry templates: `Availability/Entry1`, `Entry2` (+`v2=`), optional `/None`
  suffix = unobtainable row. `Availability/Gen|gen=III` sets the generation
  (roman numerals). Other family members (`Header`, `NA`, `Footer`) carry no
  data. Area text nests small templates: `{{rt|130|Hoenn}}`, `{{p|Wobbuffet}}`,
  `{{pkmn|Egg}}`, `{{gdis|Mirage Island|III}}`, `{{DL|page|entry}}`,
  `{{color2|000|page|label}}`, `{{OBP|...}}`, `{{ga|Red}}`, comments
  `<!-- -->`, links `[[page|label]]`, `<br>`.
- Event/distribution aux pages: one template per entry, name always matches
  /event/i with a `pokemon=` param (`Gen3ievent`, `SwShievent`, `BDSPievent`,
  `LAievent`, `PEievent`, `G3event`, ...) plus `ndex=`, `level=`, `met=`,
  `method=`, `game=`, `gift=yes`.
- Trades page: wiki tables per game-heading; each trade row has two
  `{{MSP/3|ndex|Name}}` cells (player's pokemon first, NPC's — i.e. received —
  second) and an ALLCAPS English nickname cell; rowspans make some rows start
  without a location cell.
- `game_versions` ids (core): Red 1, Blue 2, Yellow 3, Gold 4, Silver 5,
  Crystal 6, Ruby 7, Sapphire 8, Emerald 9, Colosseum 10, XD 11, Fire Red 12,
  Leaf Green 13, Diamond 14, Pearl 15, Platinum 16, Heart Gold 17,
  Soul Silver 18, Black 19, White 20, Black 2 21, White 2 22, X 23, Y 24,
  Omega Ruby 25, Alpha Sapphire 26, Sun 27, Moon 28, Ultra Sun 29,
  Ultra Moon 30, Let's Go Pikachu 31, Let's Go Eevee 32, Sword 33, Shield 34,
  Brilliant Diamond 35, Shining Pearl 36, Legends Arceus 37, Scarlet 47,
  Violet 48. Spinoffs: Stadium 38 (gen 1), Stadium 2 39 (gen 2), Channel 40
  (gen 3), Box 41 (gen 3), Ranch 42 (gen 4), Ranger 43, Ranger 2 44,
  Ranger 3 45 (all gen 4), Battle Revolution 46 (gen 4).
- Unique source types in the enum (the differ's scope):
  `special, npc-trade, gift, prize, static-default, game-corner, side-game,
  event, fossil, honey-tree, starter, pokewalker`.

---

### Task 1: Test infra + wikitext template extractor

**Files:**
- Modify: `adhoc/package.json` (add test script)
- Create: `adhoc/src/bulbapedia/wikitext.js`
- Test: `adhoc/test/wikitext.test.js`

**Interfaces:**
- Produces: `parseTemplate(body: string) -> {name, params}` where `params` has
  named keys plus 1-indexed numeric keys for positional params;
  `extractTemplates(text: string) -> Array<{name, params}>` (top-level
  templates only, document order). Later tasks import both from
  `../src/bulbapedia/wikitext.js`.

- [ ] **Step 1: Add the test script**

In `adhoc/package.json`, add alongside `"license"`:

```json
"scripts": {
  "test": "node --test"
},
```

- [ ] **Step 2: Write the failing tests**

Create `adhoc/test/wikitext.test.js`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseTemplate, extractTemplates } from '../src/bulbapedia/wikitext.js'

test('parseTemplate splits named params', () => {
  const { name, params } = parseTemplate('Availability/Entry1|v=Emerald|t=FFF|area=Hatch')
  assert.equal(name, 'Availability/Entry1')
  assert.equal(params.v, 'Emerald')
  assert.equal(params.area, 'Hatch')
})

test('parseTemplate keeps positional params 1-indexed', () => {
  const { params } = parseTemplate('rt|130|Hoenn')
  assert.equal(params[1], '130')
  assert.equal(params[2], 'Hoenn')
})

test('parseTemplate mixes positional and named (Gligar Stadium 2 entry)', () => {
  const { params } = parseTemplate('Availability/Entry1|1|v=Stadium 2|color=000|area=Beat the rival')
  assert.equal(params[1], '1')
  assert.equal(params.v, 'Stadium 2')
})

test('parseTemplate ignores pipes inside nested templates and links', () => {
  const { params } = parseTemplate('Availability/Entry2|v=Ruby|v2=Sapphire|area={{rt|130|Hoenn}} ({{gdis|Mirage Island|III}}) [[a|b]]')
  assert.equal(params.v2, 'Sapphire')
  assert.equal(params.area, '{{rt|130|Hoenn}} ({{gdis|Mirage Island|III}}) [[a|b]]')
})

test('parseTemplate treats = inside nested braces as positional', () => {
  const { params } = parseTemplate('DL|List of Pokémon by Pal Park location|Field')
  assert.equal(params[1], 'List of Pokémon by Pal Park location')
  assert.equal(params[2], 'Field')
})

test('extractTemplates returns only top-level templates, in order', () => {
  const text = 'x {{Availability/Gen|gen=III}} y {{Availability/Entry1|v=Emerald|area={{p|Wobbuffet}} egg}} z'
  const templates = extractTemplates(text)
  assert.equal(templates.length, 2)
  assert.equal(templates[0].name, 'Availability/Gen')
  assert.equal(templates[1].params.area, '{{p|Wobbuffet}} egg')
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd adhoc && npm test`
Expected: FAIL — cannot find module `../src/bulbapedia/wikitext.js`

- [ ] **Step 4: Implement**

Create `adhoc/src/bulbapedia/wikitext.js`:

```js
// Wikitext template parsing. Pure functions, no I/O.

// Split on top-level pipes, ignoring pipes nested inside {{ }} or [[ ]].
const splitTopLevel = (body) => {
  const parts = []
  let depth = 0
  let current = ''
  for (let i = 0; i < body.length; i++) {
    const pair = body.slice(i, i + 2)
    if (pair === '{{' || pair === '[[') {
      depth++
      current += pair
      i++
    } else if ((pair === '}}' || pair === ']]') && depth > 0) {
      depth--
      current += pair
      i++
    } else if (body[i] === '|' && depth === 0) {
      parts.push(current)
      current = ''
    } else {
      current += body[i]
    }
  }
  parts.push(current)
  return parts
}

// Parse the inside of one {{...}}. Named params land on params[key];
// positional ones on params[1], params[2], ...
export const parseTemplate = (body) => {
  const parts = splitTopLevel(body)
  const params = {}
  let position = 0
  for (const part of parts.slice(1)) {
    const eq = part.indexOf('=')
    const nesting = part.search(/\{\{|\[\[/)
    if (eq !== -1 && (nesting === -1 || eq < nesting)) {
      params[part.slice(0, eq).trim()] = part.slice(eq + 1).trim()
    } else {
      params[++position] = part.trim()
    }
  }
  return { name: parts[0].trim(), params }
}

// Every top-level {{...}} template in `text`, in document order.
export const extractTemplates = (text) => {
  const templates = []
  let depth = 0
  let start = -1
  for (let i = 0; i < text.length; i++) {
    if (text.startsWith('{{', i)) {
      if (depth === 0) start = i
      depth++
      i++
    } else if (text.startsWith('}}', i) && depth > 0) {
      depth--
      i++
      if (depth === 0) templates.push(parseTemplate(text.slice(start + 2, i - 1)))
    }
  }
  return templates
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd adhoc && npm test`
Expected: PASS (6 tests)

- [ ] **Step 6: Commit**

```bash
git add adhoc/package.json adhoc/src/bulbapedia/wikitext.js adhoc/test/wikitext.test.js
git commit -m "feat(adhoc): wikitext template extractor with node:test setup"
```

---

### Task 2: Inline wikitext cleaner

**Files:**
- Modify: `adhoc/src/bulbapedia/wikitext.js`
- Test: `adhoc/test/wikitext.test.js` (append)

**Interfaces:**
- Consumes: `parseTemplate` from Task 1.
- Produces: `cleanWikitext(raw: string) -> string` — resolves nested inline
  templates, strips links/markup/comments, collapses whitespace. Exported from
  `wikitext.js`; used by every later parser.

- [ ] **Step 1: Write the failing tests** (append to `adhoc/test/wikitext.test.js`)

```js
import { cleanWikitext } from '../src/bulbapedia/wikitext.js'

test('cleanWikitext resolves the common inline templates', () => {
  assert.equal(cleanWikitext('{{rt|130|Hoenn}} ({{gdis|Mirage Island|III}})'), 'Route 130 (Mirage Island)')
  assert.equal(cleanWikitext('{{pkmn|breeding|Breed}} {{p|Wobbuffet}} holding a [[Lax Incense]]'), 'Breed Wobbuffet holding a Lax Incense')
  assert.equal(cleanWikitext('{{DL|List of Pokémon by Pal Park location|Field}}'), 'Field')
})

test('cleanWikitext resolves labelled links, bold, br, comments', () => {
  const raw = "Hatch {{pkmn|Egg}} [[List of in-game event Pokémon in Pokémon Emerald#Wynaut|received]] from an old couple in [[Lavaridge Town]]<br>{{rt|130|Hoenn}}<!-- note -->"
  assert.equal(cleanWikitext(raw), 'Hatch Egg received from an old couple in Lavaridge Town; Route 130')
})

test('cleanWikitext falls back to last positional param for unknown templates', () => {
  assert.equal(cleanWikitext('{{OBP|Underground Path|Kanto Routes 5–6|Underground Path (Rt. 5–6)}}'), 'Underground Path (Rt. 5–6)')
  assert.equal(cleanWikitext('{{Shiny}}'), 'Shiny')
})
```

Note: `{{pkmn|breeding|Breed}}` must resolve to its *label* (`Breed`), so the
`pkmn`/`p` handlers take the last positional param — which the unknown-template
fallback already does; only templates needing different behavior get handlers.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd adhoc && npm test`
Expected: FAIL — `cleanWikitext` is not exported

- [ ] **Step 3: Implement** (append to `adhoc/src/bulbapedia/wikitext.js`)

```js
// Inline template handlers. Anything absent falls back to its last
// positional param, which covers {{p|X}}, {{pkmn|a|label}}, {{OBP|..|label}},
// {{ga|Red}}, etc. Handlers exist only where the last param is NOT the label
// (gdis/rt end in a region or gen numeral) or a fixed word fits better.
const INLINE_TEMPLATES = {
  rt: (p) => `Route ${p[1]}`,
  gdis: (p) => p[1],
  dl: (p) => p[3] ?? p[2],
  color2: (p) => p[3] ?? p[2],
  safari: () => 'Safari Zone',
  player: () => 'the player',
  j: () => '',
  sup: () => '',
  tt: (p) => p[1] ?? '',
  tm: (p) => (p[2] ? `TM${p[1]} (${p[2]})` : `TM${p[1]}`),
}

const lastPositional = (name, params) => {
  const keys = Object.keys(params).filter((key) => /^\d+$/.test(key))
  return keys.length ? params[keys[keys.length - 1]] : name
}

export const cleanWikitext = (raw) => {
  let text = raw.replace(/<!--[\s\S]*?-->/g, '')
  const innermost = /\{\{([^{}]*)\}\}/
  for (let match; (match = text.match(innermost)); ) {
    const { name, params } = parseTemplate(match[1])
    const handler = INLINE_TEMPLATES[name.toLowerCase()]
    const replacement = handler ? handler(params) ?? '' : lastPositional(name, params)
    text = text.slice(0, match.index) + replacement + text.slice(match.index + match[0].length)
  }
  return text
    .replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, '$1')
    .replace(/\[\[([^\]]*)\]\]/g, '$1')
    .replace(/'''?/g, '')
    .replace(/<br\s*\/?>/gi, '; ')
    .replace(/<\/?[a-z][^>]*>/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}
```

(Fix the comment before committing: `gdis` gets a handler precisely because its
last positional param is the gen numeral, not the label.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd adhoc && npm test`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add adhoc/src/bulbapedia/wikitext.js adhoc/test/wikitext.test.js
git commit -m "feat(adhoc): inline wikitext cleaner for area text"
```

---

### Task 3: Game-version map

**Files:**
- Create: `adhoc/src/bulbapedia/games.js`
- Test: `adhoc/test/games.test.js`

**Interfaces:**
- Produces: `resolveGame(v: string) -> {name, tracked: boolean, id?, gen?,
  expected?}` — maps a Bulbapedia `v=` value to a `game_versions` row.
  `tracked: false` for games we don't track; `expected: true` on those we
  *know* we don't track (suppresses recon warnings). Also exports
  `ROMAN` (`{I: 1, ..., IX: 9}`).

- [ ] **Step 1: Write the failing tests**

Create `adhoc/test/games.test.js`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveGame, ROMAN } from '../src/bulbapedia/games.js'

test('resolveGame maps core games to game_versions ids and gens', () => {
  assert.deepEqual(resolveGame('FireRed'), { name: 'FireRed', tracked: true, id: 12, gen: 3 })
  assert.deepEqual(resolveGame("Let's Go Pikachu"), { name: "Let's Go Pikachu", tracked: true, id: 31, gen: 7 })
  assert.deepEqual(resolveGame('Black 2'), { name: 'Black 2', tracked: true, id: 21, gen: 5 })
})

test('resolveGame maps tracked spinoffs from the side-games section', () => {
  assert.deepEqual(resolveGame('Stadium 2'), { name: 'Stadium 2', tracked: true, id: 39, gen: 2 })
  assert.deepEqual(resolveGame('Ranger: SoA'), { name: 'Ranger: SoA', tracked: true, id: 44, gen: 4 })
})

test('resolveGame flags known-untracked games as expected', () => {
  assert.deepEqual(resolveGame('MD Red'), { name: 'MD Red', tracked: false, expected: true })
  assert.deepEqual(resolveGame('Pal Park'), { name: 'Pal Park', tracked: false, expected: true })
})

test('resolveGame flags unknown names as unexpected (recon warning material)', () => {
  assert.deepEqual(resolveGame('Some Future Game'), { name: 'Some Future Game', tracked: false, expected: false })
})

test('ROMAN maps generation numerals', () => {
  assert.equal(ROMAN.VII, 7)
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd adhoc && npm test`
Expected: FAIL — cannot find module `../src/bulbapedia/games.js`

- [ ] **Step 3: Implement**

Create `adhoc/src/bulbapedia/games.js`:

```js
// Bulbapedia Availability `v=` names -> game_versions rows.
// Ids verified against the game_versions table (2026-08 prod dump).
const GAMES = {
  Red: { id: 1, gen: 1 },
  Blue: { id: 2, gen: 1 },
  Yellow: { id: 3, gen: 1 },
  Gold: { id: 4, gen: 2 },
  Silver: { id: 5, gen: 2 },
  Crystal: { id: 6, gen: 2 },
  Ruby: { id: 7, gen: 3 },
  Sapphire: { id: 8, gen: 3 },
  Emerald: { id: 9, gen: 3 },
  Colosseum: { id: 10, gen: 3 },
  XD: { id: 11, gen: 3 },
  FireRed: { id: 12, gen: 3 },
  LeafGreen: { id: 13, gen: 3 },
  Diamond: { id: 14, gen: 4 },
  Pearl: { id: 15, gen: 4 },
  Platinum: { id: 16, gen: 4 },
  HeartGold: { id: 17, gen: 4 },
  SoulSilver: { id: 18, gen: 4 },
  Black: { id: 19, gen: 5 },
  White: { id: 20, gen: 5 },
  'Black 2': { id: 21, gen: 5 },
  'White 2': { id: 22, gen: 5 },
  X: { id: 23, gen: 6 },
  Y: { id: 24, gen: 6 },
  'Omega Ruby': { id: 25, gen: 6 },
  'Alpha Sapphire': { id: 26, gen: 6 },
  Sun: { id: 27, gen: 7 },
  Moon: { id: 28, gen: 7 },
  'Ultra Sun': { id: 29, gen: 7 },
  'Ultra Moon': { id: 30, gen: 7 },
  "Let's Go Pikachu": { id: 31, gen: 7 },
  "Let's Go Eevee": { id: 32, gen: 7 },
  Sword: { id: 33, gen: 8 },
  Shield: { id: 34, gen: 8 },
  'Brilliant Diamond': { id: 35, gen: 8 },
  'Shining Pearl': { id: 36, gen: 8 },
  'Legends Arceus': { id: 37, gen: 8 },
  'Legends: Arceus': { id: 37, gen: 8 },
  Scarlet: { id: 47, gen: 9 },
  Violet: { id: 48, gen: 9 },
  // tracked spinoffs (appear in the "In side games" section)
  Stadium: { id: 38, gen: 1 },
  'Stadium 2': { id: 39, gen: 2 },
  Channel: { id: 40, gen: 3 },
  Box: { id: 41, gen: 3 },
  Ranch: { id: 42, gen: 4 },
  Ranger: { id: 43, gen: 4 },
  'Ranger: SoA': { id: 44, gen: 4 },
  'Ranger: GS': { id: 45, gen: 4 },
  'Battle Revolution': { id: 46, gen: 4 },
}

// Untracked games/rows we expect to see; anything else untracked is warned
// about in the recon report so the map can be extended deliberately.
const KNOWN_UNTRACKED = [
  /^MD /, /^Trozei/, /^Pinball/, /^Snap/, /^New Snap/, /^Dash/, /^PokéPark/,
  /^Rumble/, /^Shuffle/, /^Picross/, /^Conquest/, /^Duel/, /^Quest/, /^Sleep/,
  /^Masters/, /^Café/, /^UNITE/, /^Magikarp Jump/, /^GO$/, /^HOME$/, /^Bank$/,
  /^Dream World$/, /^Dream Radar$/, /^Pal Park$/, /^Pokéwalker$/,
  /^Mystery Dungeon/, /^Legends Z-A$/, /^Z-A$/, /^Smile$/, /^Playhouse/,
]

export const ROMAN = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9 }

export const resolveGame = (v) => {
  const game = GAMES[v]
  if (game) return { name: v, tracked: true, ...game }
  return { name: v, tracked: false, expected: KNOWN_UNTRACKED.some((rx) => rx.test(v)) }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd adhoc && npm test`
Expected: PASS (14 tests)

- [ ] **Step 5: Commit**

```bash
git add adhoc/src/bulbapedia/games.js adhoc/test/games.test.js
git commit -m "feat(adhoc): bulbapedia game-version map"
```

---

### Task 4: Availability-section parser

**Files:**
- Create: `adhoc/src/bulbapedia/availability.js`
- Test: `adhoc/test/availability.test.js`

**Interfaces:**
- Consumes: `extractTemplates`, `cleanWikitext` (Task 1–2), `resolveGame`,
  `ROMAN` (Task 3).
- Produces: `extractSection(wikitext, title) -> string|null`;
  `parseGameLocations(wikitext) -> {entries, warnings}` where each entry is
  `{game: string, gameInfo: resolveGame() result, gen: number|null,
  subsection: string, none: boolean, rawArea: string, area: string}` —
  one entry per version per Entry template. `subsection` is `'core'` before
  any level-4 heading, else the lowercased heading text (e.g.
  `'in side games'`).

- [ ] **Step 1: Write the failing tests**

Create `adhoc/test/availability.test.js` with a fixture assembled from the real
Wynaut and Gligar pages (trimmed):

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extractSection, parseGameLocations } from '../src/bulbapedia/availability.js'

const FIXTURE = `intro text
===Game locations===
{{Availability/Header|type=Psychic}}
{{Availability/Gen|gen=III}}
{{Availability/Entry2|v=Ruby|v2=Sapphire|t=FFF|t2=FFF|area=Hatch {{pkmn|Egg}} [[List of in-game event Pokémon in Pokémon Ruby and Sapphire#Wynaut|received]] from an old couple in [[Lavaridge Town]]<br>{{rt|130|Hoenn}} ({{gdis|Mirage Island|III}})}}
{{Availability/Entry1/None|v=Colosseum}}
|}
|}
{{Availability/Gen|gen=VII}}
{{Availability/Entry2/None|v=Sun|v2=Moon|area=[[Pokémon Bank]]}}
|}
|}
{{Availability/Footer}}

====In side games====
{{Availability/Header|type=Ground|type2=Flying}}
{{Availability/Gen|gen=II}}
{{Availability/Entry1|1|v=Stadium 2|color=000|t=FFF|area=Beat the {{ga|Silver|Rival}} at the end of {{DL|Pokémon Stadium 2|Round 2}}}}
|}
|}
<!--{{Availability/Entry1|v=MD Light|area=commented out}}-->

===Held items===
{{Availability/Entry1|v=Red|area=should not be parsed}}
`

test('extractSection pulls a heading-delimited section', () => {
  const section = extractSection(FIXTURE, 'Game locations')
  assert.ok(section.includes('Stadium 2'))
  assert.ok(!section.includes('should not be parsed'))
  assert.equal(extractSection(FIXTURE, 'No Such Section'), null)
})

test('parseGameLocations emits one entry per version with gen and cleaned area', () => {
  const { entries } = parseGameLocations(FIXTURE)
  const ruby = entries.find((entry) => entry.game === 'Ruby')
  assert.equal(ruby.gen, 3)
  assert.equal(ruby.subsection, 'core')
  assert.equal(ruby.none, false)
  assert.ok(ruby.area.startsWith('Hatch Egg received from an old couple in Lavaridge Town'))
  const sapphire = entries.find((entry) => entry.game === 'Sapphire')
  assert.equal(sapphire.rawArea, ruby.rawArea)
})

test('parseGameLocations marks /None entries and keeps their area', () => {
  const { entries } = parseGameLocations(FIXTURE)
  const sun = entries.find((entry) => entry.game === 'Sun')
  assert.equal(sun.none, true)
  assert.equal(sun.gen, 7)
  const colosseum = entries.find((entry) => entry.game === 'Colosseum')
  assert.equal(colosseum.none, true)
  assert.equal(colosseum.rawArea, '')
})

test('parseGameLocations walks side-games subsection with its own gens', () => {
  const { entries } = parseGameLocations(FIXTURE)
  const stadium = entries.find((entry) => entry.game === 'Stadium 2')
  assert.equal(stadium.subsection, 'in side games')
  assert.equal(stadium.gen, 2)
  assert.equal(stadium.gameInfo.id, 39)
  assert.equal(stadium.area, 'Beat the Rival at the end of Round 2')
})

test('parseGameLocations ignores commented-out entries and missing section', () => {
  const { entries } = parseGameLocations(FIXTURE)
  assert.ok(!entries.some((entry) => entry.game === 'MD Light'))
  const empty = parseGameLocations('no locations here')
  assert.deepEqual(empty.entries, [])
  assert.equal(empty.warnings.length, 1)
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd adhoc && npm test`
Expected: FAIL — cannot find module `../src/bulbapedia/availability.js`

- [ ] **Step 3: Implement**

Create `adhoc/src/bulbapedia/availability.js`:

```js
import { extractTemplates, cleanWikitext } from './wikitext.js'
import { resolveGame, ROMAN } from './games.js'

// Pull one wiki section: from its heading to the next heading of the same or
// higher level. Title is matched case-insensitively as a whole heading.
export const extractSection = (wikitext, title) => {
  const heading = wikitext.match(new RegExp(`^(=+)\\s*${title}\\s*\\1\\s*$`, 'mi'))
  if (!heading) return null
  const level = heading[1].length
  const rest = wikitext.slice(heading.index + heading[0].length)
  const next = rest.match(new RegExp(`^={2,${level}}[^=]`, 'm'))
  return next ? rest.slice(0, next.index) : rest
}

const ENTRY = /^Availability\/Entry(\d)(\/None)?$/

export const parseGameLocations = (wikitext) => {
  const section = extractSection(wikitext, 'Game locations')
  if (!section) return { entries: [], warnings: ['no Game locations section'] }

  const entries = []
  const warnings = []
  let gen = null
  let subsection = 'core'

  for (const chunk of section.split(/^(====[^=].*?====)\s*$/m)) {
    const heading = chunk.match(/^====\s*(.*?)\s*====$/)
    if (heading) {
      subsection = heading[1].toLowerCase()
      continue
    }
    for (const template of extractTemplates(chunk.replace(/<!--[\s\S]*?-->/g, ''))) {
      if (template.name === 'Availability/Gen') {
        gen = ROMAN[template.params.gen] ?? null
        if (gen === null) warnings.push(`unknown gen numeral: ${template.params.gen}`)
        continue
      }
      const entryMatch = template.name.match(ENTRY)
      if (!entryMatch) continue
      const none = !!entryMatch[2]
      const versions = ['v', 'v2', 'v3', 'v4', 'v5']
        .map((key) => template.params[key])
        .filter(Boolean)
      if (versions.length === 0) {
        warnings.push(`entry with no versions in ${subsection}`)
        continue
      }
      const rawArea = template.params.area ?? ''
      for (const version of versions) {
        entries.push({
          game: version,
          gameInfo: resolveGame(version),
          gen,
          subsection,
          none,
          rawArea,
          area: cleanWikitext(rawArea),
        })
      }
    }
  }
  return { entries, warnings }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd adhoc && npm test`
Expected: PASS (19 tests)

- [ ] **Step 5: Commit**

```bash
git add adhoc/src/bulbapedia/availability.js adhoc/test/availability.test.js
git commit -m "feat(adhoc): availability-section parser (core + side games)"
```

---

### Task 5: Uniqueness classifier

**Files:**
- Create: `adhoc/src/bulbapedia/classify.js`
- Test: `adhoc/test/classify.test.js`

**Interfaces:**
- Consumes: availability entries (Task 4 shape).
- Produces: `classifyEntry(entry) -> {kind, reasons}` with `kind` one of
  `'unavailable' | 'untracked-game' | 'unique-candidate' | 'generic'`;
  `reasons` is a string array (empty for generic). Rules live in an exported
  `UNIQUE_PATTERNS` array of `{rx, reason, on}` (`on: 'raw'` matches
  `rawArea`, default matches cleaned `area`) so recon findings can tune them.

- [ ] **Step 1: Write the failing tests**

Create `adhoc/test/classify.test.js`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classifyEntry } from '../src/bulbapedia/classify.js'

const entry = (overrides) => ({
  game: 'Emerald',
  gameInfo: { name: 'Emerald', tracked: true, id: 9, gen: 3 },
  gen: 3,
  subsection: 'core',
  none: false,
  rawArea: '',
  area: '',
  ...overrides,
})

test('none rows are unavailable regardless of area text', () => {
  const result = classifyEntry(entry({ none: true, area: 'Trade, Event' }))
  assert.equal(result.kind, 'unavailable')
})

test('untracked games are set aside', () => {
  const result = classifyEntry(entry({ game: 'MD Red', gameInfo: { name: 'MD Red', tracked: false, expected: true } }))
  assert.equal(result.kind, 'untracked-game')
})

test('event-list links and gift language are unique candidates', () => {
  const gift = classifyEntry(entry({
    rawArea: 'Hatch {{pkmn|Egg}} [[List of in-game event Pokémon in Pokémon Emerald#Wynaut|received]] from an old couple',
    area: 'Hatch Egg received from an old couple in Lavaridge Town',
  }))
  assert.equal(gift.kind, 'unique-candidate')
  assert.ok(gift.reasons.includes('links to event list'))

  const trade = classifyEntry(entry({ area: 'In-game trade with an NPC on Route 226' }))
  assert.equal(trade.kind, 'unique-candidate')
})

test('wild-style rows are generic', () => {
  assert.equal(classifyEntry(entry({ area: 'Route 130 (Mirage Island)' })).kind, 'generic')
  assert.equal(classifyEntry(entry({ area: 'Breed Wobbuffet holding a Lax Incense' })).kind, 'generic')
  assert.equal(classifyEntry(entry({ area: 'Hammerlocke Hills (Max Raid Battle)' })).kind, 'generic')
})

test('side-game prize language is a unique candidate (Stadium 2 Gligar)', () => {
  const result = classifyEntry(entry({
    subsection: 'in side games',
    game: 'Stadium 2',
    gameInfo: { name: 'Stadium 2', tracked: true, id: 39, gen: 2 },
    gen: 2,
    area: 'Beat the Rival at the end of Round 2',
  }))
  assert.equal(result.kind, 'unique-candidate')
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd adhoc && npm test`
Expected: FAIL — cannot find module `../src/bulbapedia/classify.js`

- [ ] **Step 3: Implement**

Create `adhoc/src/bulbapedia/classify.js`:

```js
// Classify an availability entry as a unique-source candidate or generic
// availability. Recall over precision: the recon report (and later the
// review gate) is where false positives get culled, so patterns err broad.
export const UNIQUE_PATTERNS = [
  { rx: /list of in-game event pokémon/i, reason: 'links to event list', on: 'raw' },
  { rx: /first partner|starter/i, reason: 'starter' },
  { rx: /received|gift|given|reward/i, reason: 'gift language' },
  { rx: /in-game trade|trade with|traded (?:for|from)/i, reason: 'npc trade' },
  { rx: /game corner|prize|lottery/i, reason: 'prize' },
  { rx: /fossil/i, reason: 'fossil' },
  { rx: /honey tree/i, reason: 'honey tree' },
  { rx: /only one|one per (?:save|game)/i, reason: 'explicit only-one' },
  { rx: /beat(?:ing)? the|defeat(?:ing)?.*(?:round|castle|cup|mode)/i, reason: 'side-game completion prize' },
]

export const classifyEntry = (entry) => {
  if (entry.none) return { kind: 'unavailable', reasons: [] }
  if (!entry.gameInfo.tracked) return { kind: 'untracked-game', reasons: [] }
  const reasons = UNIQUE_PATTERNS.filter(({ rx, on }) =>
    rx.test(on === 'raw' ? entry.rawArea : entry.area)
  ).map(({ reason }) => reason)
  return reasons.length ? { kind: 'unique-candidate', reasons } : { kind: 'generic', reasons: [] }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd adhoc && npm test`
Expected: PASS (24 tests)

- [ ] **Step 5: Commit**

```bash
git add adhoc/src/bulbapedia/classify.js adhoc/test/classify.test.js
git commit -m "feat(adhoc): uniqueness classifier for availability entries"
```

---

### Task 6: Event and distribution page parser

**Files:**
- Create: `adhoc/src/bulbapedia/events.js`
- Test: `adhoc/test/events.test.js`

**Interfaces:**
- Consumes: `extractTemplates`, `cleanWikitext`.
- Produces: `parseEventEntries(wikitext) -> Array<{template, pokemon,
  ndex: number|null, level, game, method, met, gift: boolean}>`. Works for
  both "List of in-game event Pokémon ..." pages (`Gen3ievent`, `SwShievent`,
  ...) and "List of game-based Pokémon distributions ..." pages (`G3event`,
  ...) — every entry template's name matches /event/i and has `pokemon=`.

- [ ] **Step 1: Write the failing tests**

Create `adhoc/test/events.test.js` (fixture from the real FRLG page):

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseEventEntries } from '../src/bulbapedia/events.js'

const FIXTURE = `===Magikarp===
A [[Magikarp salesman|salesman]] will offer a {{p|Magikarp}}.
{{Gen3ievent
|pokemon=Magikarp
|ndex=0129
|level=5
|ball=Poké
|met={{color2|000|Kanto Route 4|Route 4}}
|move1=Splash|move1type=Normal
|gift=yes
|method={{pkmn2|Gift}} ({{pdollar}}500)
|game=frlg
}}
{{G3event
|pokemon=Jirachi
|nick=JIRACHI
|level=5
|game=3r
|ndex=385
|obtain=pal
|distribution=no}}
{{SomeOtherTemplate|pokemon=Ignored because name lacks the keyword|x=1}}
{{Gen3ievent-related-nav}}`

test('parseEventEntries pulls every /event/ template with a pokemon param', () => {
  const entries = parseEventEntries(FIXTURE)
  assert.equal(entries.length, 2)
  const [magikarp, jirachi] = entries
  assert.equal(magikarp.template, 'Gen3ievent')
  assert.equal(magikarp.pokemon, 'Magikarp')
  assert.equal(magikarp.ndex, 129)
  assert.equal(magikarp.gift, true)
  assert.equal(magikarp.met, 'Route 4')
  assert.ok(magikarp.method.startsWith('Gift'))
  assert.equal(jirachi.ndex, 385)
  assert.equal(jirachi.gift, false)
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd adhoc && npm test`
Expected: FAIL — cannot find module `../src/bulbapedia/events.js`

- [ ] **Step 3: Implement**

Create `adhoc/src/bulbapedia/events.js`:

```js
import { extractTemplates, cleanWikitext } from './wikitext.js'

// One record per event/distribution entry template. Both page families use
// one template per entry whose name contains "event" and has pokemon=.
export const parseEventEntries = (wikitext) => {
  const entries = []
  for (const template of extractTemplates(wikitext)) {
    if (!/event/i.test(template.name) || !template.params.pokemon) continue
    entries.push({
      template: template.name,
      pokemon: cleanWikitext(template.params.pokemon),
      ndex: template.params.ndex ? parseInt(template.params.ndex, 10) : null,
      level: template.params.level ?? null,
      game: template.params.game ?? null,
      method: cleanWikitext(template.params.method ?? template.params.obtain ?? ''),
      met: cleanWikitext(template.params.met ?? ''),
      gift: template.params.gift === 'yes',
    })
  }
  return entries
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd adhoc && npm test`
Expected: PASS (25 tests)

- [ ] **Step 5: Commit**

```bash
git add adhoc/src/bulbapedia/events.js adhoc/test/events.test.js
git commit -m "feat(adhoc): event/distribution page parser"
```

---

### Task 7: In-game trades parser

**Files:**
- Create: `adhoc/src/bulbapedia/trades.js`
- Test: `adhoc/test/trades.test.js`

**Interfaces:**
- Consumes: `cleanWikitext`.
- Produces: `parseTrades(wikitext) -> {trades, unparsed}` where each trade is
  `{heading, location, gives: {ndex, name}, receives: {ndex, name},
  nickname: string|null}`. Best-effort: rows containing `MSP/3` that don't
  yield two pokemon go to `unparsed` as `{heading, rowText}` — never silently
  dropped. `heading` is the nearest enclosing wiki heading (game names, for
  the human report; no fragile heading→game mapping in this increment).

- [ ] **Step 1: Write the failing tests**

Create `adhoc/test/trades.test.js` (fixture from the real gen 1 section,
including the rowspan continuation case):

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseTrades } from '../src/bulbapedia/trades.js'

const FIXTURE = `====Pokémon Red and Green (Japan), Pokémon Red and Blue (Western)====
{| class="roundtable"
|- class="blacklinks"
! Location
! colspan="2" | Player's Pokémon
! colspan="2" | NPC's Pokémon
! English<br>[[nickname]]
|-
| {{rt|2|Kanto}}
| {{MSP/3|063|Abra}}
| {{p|Abra}}
| {{MSP/3|122|Mr. Mime}}
| {{p|Mr. Mime}}
| MARCEL
| {{j|バリバリ}}<br>''Baribari''
|-
| rowspan="2" style="background:#FFF" | {{OBP|Underground Path|Kanto Routes 5–6|Underground Path (Rt. 5–6)}}
| {{MSP/3|029|Nidoran♀}}
| {{p|Nidoran♀}}
| {{MSP/3|032|Nidoran♂}}
| {{p|Nidoran♂}}
| ''N/A''
|-
| {{MSP/3|032|Nidoran♂}}
| {{p|Nidoran♂}}
| {{MSP/3|029|Nidoran♀}}
| {{p|Nidoran♀}}
| SPOT
|}`

test('parseTrades extracts gives/receives/nickname per row', () => {
  const { trades, unparsed } = parseTrades(FIXTURE)
  assert.equal(unparsed.length, 0)
  assert.equal(trades.length, 3)
  const [abra] = trades
  assert.equal(abra.heading, 'Pokémon Red and Green (Japan), Pokémon Red and Blue (Western)')
  assert.deepEqual(abra.gives, { ndex: 63, name: 'Abra' })
  assert.deepEqual(abra.receives, { ndex: 122, name: 'Mr. Mime' })
  assert.equal(abra.nickname, 'MARCEL')
  assert.equal(abra.location, 'Route 2')
})

test('parseTrades carries location across rowspan rows and handles N/A nicknames', () => {
  const { trades } = parseTrades(FIXTURE)
  const [, female, male] = trades
  assert.equal(female.location, 'Underground Path (Rt. 5–6)')
  assert.equal(female.nickname, null)
  assert.equal(male.location, 'Underground Path (Rt. 5–6)')
  assert.equal(male.nickname, 'SPOT')
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd adhoc && npm test`
Expected: FAIL — cannot find module `../src/bulbapedia/trades.js`

- [ ] **Step 3: Implement**

Create `adhoc/src/bulbapedia/trades.js`:

```js
import { cleanWikitext } from './wikitext.js'

const MSP = /\{\{MSP\/3\|(\d+)\|([^}|]+)(?:\|[^}]*)?\}\}/g
// ALLCAPS-ish nicknames, max 12 chars in-game (accented caps included)
const NICKNAME = /^[A-Z0-9ÉÀ-Þ .'♀♂-]{2,12}$/

// Best-effort parse of the "List of in-game trades" page. One record per
// table row naming two pokemon via {{MSP/3|ndex|Name}}: the first is what
// the player gives, the second what they receive. Rows that mention MSP/3
// but don't parse go to `unparsed` — never silently dropped.
export const parseTrades = (wikitext) => {
  const trades = []
  const unparsed = []
  let heading = ''
  let location = null
  let row = []

  const flushRow = () => {
    if (row.length === 0) return
    const cells = row
      .flatMap((line) => line.split('||'))
      .map((cell) => cell.replace(/^[|!]\s*/, '').replace(/^[^|]*\|\s*(?=\{\{|\[\[)/, '').trim())
    const rowText = cells.join(' | ')
    const msp = [...rowText.matchAll(MSP)]
    const firstMspCell = cells.findIndex((cell) => /MSP\/3/.test(cell))
    if (firstMspCell > 0) {
      const before = cells.slice(0, firstMspCell).map(cleanWikitext).filter(Boolean)
      if (before.length) location = before.join(', ')
    }
    if (msp.length >= 2) {
      const nickname = cells
        .slice(firstMspCell)
        .map(cleanWikitext)
        .find((cell) => NICKNAME.test(cell))
      trades.push({
        heading,
        location,
        gives: { ndex: parseInt(msp[0][1], 10), name: msp[0][2].trim() },
        receives: { ndex: parseInt(msp[1][1], 10), name: msp[1][2].trim() },
        nickname: nickname ?? null,
      })
    } else if (/MSP\/3/.test(rowText)) {
      unparsed.push({ heading, rowText })
    }
    row = []
  }

  for (const line of wikitext.split('\n')) {
    const headingMatch = line.match(/^(=+)\s*(.*?)\s*\1$/)
    if (headingMatch) {
      flushRow()
      heading = headingMatch[2]
      location = null
      continue
    }
    if (/^(\|-|\|\}|\{\|)/.test(line)) {
      flushRow()
      continue
    }
    if (/^[|!]/.test(line)) row.push(line)
    else if (row.length) row[row.length - 1] += ` ${line.trim()}`
  }
  flushRow()
  return { trades, unparsed }
}
```

Implementation notes for the cell cleanup regex
(`replace(/^[^|]*\|\s*(?=\{\{|\[\[)/, ...)`): it strips `rowspan="2" ... |`
style cell attributes. If the fixture's attribute cell (`rowspan="2"
style=... | {{OBP|...}}`) doesn't come out clean, prefer fixing the regex over
weakening the test — the test encodes real page content.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd adhoc && npm test`
Expected: PASS (27 tests)

- [ ] **Step 5: Commit**

```bash
git add adhoc/src/bulbapedia/trades.js adhoc/test/trades.test.js
git commit -m "feat(adhoc): in-game trades table parser"
```

---

### Task 8: Differ

**Files:**
- Create: `adhoc/src/bulbapedia/differ.js`
- Test: `adhoc/test/differ.test.js`

**Interfaces:**
- Consumes: candidate records `{pokemonId, gen, area, ...}` (built by the
  orchestrator from Tasks 4–6 output) and `sources` rows shaped
  `{id, pokemonId, name, description, gen, source}`.
- Produces: `UNIQUE_SOURCE_TYPES` (string array);
  `similarity(a, b) -> number` (0–1 token overlap);
  `diffCandidates(candidates, sources, threshold=0.34) ->
  {matched: [{candidate, source, score}], missing: [candidate],
  unmatchedExisting: [source]}`. Pure — no DB access.

- [ ] **Step 1: Write the failing tests**

Create `adhoc/test/differ.test.js`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { diffCandidates, similarity } from '../src/bulbapedia/differ.js'

const sources = [
  { id: 'a', pokemonId: 360, name: 'Lavaridge Springs', description: 'Egg received from an old couple in Lavaridge Town.', gen: 3, source: 'gift' },
  { id: 'b', pokemonId: 360, name: 'Wild', description: null, gen: 0, source: 'wild' },
  { id: 'c', pokemonId: 207, name: 'Ghost Tower', description: 'Old hand-entered row that Bulbapedia does not corroborate.', gen: 2, source: 'gift' },
]

test('similarity is token overlap over the smaller set', () => {
  assert.equal(similarity('Lavaridge Town egg', 'egg received in Lavaridge Town'), 1)
  assert.equal(similarity('completely different', 'no shared words'), 0)
})

test('diffCandidates matches candidates to existing rows by pokemon, gen, and text', () => {
  const candidates = [
    { pokemonId: 360, gen: 3, area: 'Hatch Egg received from an old couple in Lavaridge Town' },
    { pokemonId: 207, gen: 2, area: 'Beat the Rival at the end of Round 2' },
  ]
  const { matched, missing, unmatchedExisting } = diffCandidates(candidates, sources)
  assert.equal(matched.length, 1)
  assert.equal(matched[0].source.id, 'a')
  assert.equal(missing.length, 1)
  assert.equal(missing[0].pokemonId, 207)
  assert.deepEqual(unmatchedExisting.map((source) => source.id), ['c'])
})

test('diffCandidates never matches against non-unique source types', () => {
  const candidates = [{ pokemonId: 360, gen: 3, area: 'Wild' }]
  const { missing } = diffCandidates(candidates, sources)
  assert.equal(missing.length, 1)
})

test('gen-0 existing rows are eligible for any candidate gen', () => {
  const gameCorner = [{ id: 'd', pokemonId: 25, name: 'Game Corner', description: null, gen: 0, source: 'game-corner' }]
  const candidates = [{ pokemonId: 25, gen: 1, area: 'Game Corner prize' }]
  const { matched } = diffCandidates(candidates, gameCorner)
  assert.equal(matched.length, 1)
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd adhoc && npm test`
Expected: FAIL — cannot find module `../src/bulbapedia/differ.js`

- [ ] **Step 3: Implement**

Create `adhoc/src/bulbapedia/differ.js`:

```js
// Diff parsed candidates against existing sources rows. Pure functions.
export const UNIQUE_SOURCE_TYPES = [
  'special', 'npc-trade', 'gift', 'prize', 'static-default', 'game-corner',
  'side-game', 'event', 'fossil', 'honey-tree', 'starter', 'pokewalker',
]

const STOPWORDS = new Set([
  'the', 'a', 'an', 'in', 'at', 'on', 'of', 'from', 'to', 'is', 'this',
  'that', 'you', 'your', 'by', 'for', 'and', 'or', 'will', 'after', 'with',
  'was', 'be', 'if', 'it', 'not',
])

const tokens = (text) =>
  new Set(
    (text ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9é\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word && !STOPWORDS.has(word))
  )

export const similarity = (a, b) => {
  const tokensA = tokens(a)
  const tokensB = tokens(b)
  if (tokensA.size === 0 || tokensB.size === 0) return 0
  let common = 0
  for (const token of tokensA) if (tokensB.has(token)) common++
  return common / Math.min(tokensA.size, tokensB.size)
}

export const diffCandidates = (candidates, sources, threshold = 0.34) => {
  const uniqueSources = sources.filter((source) => UNIQUE_SOURCE_TYPES.includes(source.source))
  const matchedSourceIds = new Set()
  const matched = []
  const missing = []
  for (const candidate of candidates) {
    const pool = uniqueSources.filter(
      (source) =>
        source.pokemonId === candidate.pokemonId &&
        (source.gen === candidate.gen || source.gen === 0)
    )
    let best = null
    let bestScore = 0
    for (const source of pool) {
      const score = similarity(candidate.area, `${source.name} ${source.description ?? ''}`)
      if (score > bestScore) {
        best = source
        bestScore = score
      }
    }
    if (best && bestScore >= threshold) {
      matched.push({ candidate, source: best, score: bestScore })
      matchedSourceIds.add(best.id)
    } else {
      missing.push(candidate)
    }
  }
  const unmatchedExisting = uniqueSources.filter((source) => !matchedSourceIds.has(source.id))
  return { matched, missing, unmatchedExisting }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd adhoc && npm test`
Expected: PASS (31 tests)

- [ ] **Step 5: Commit**

```bash
git add adhoc/src/bulbapedia/differ.js adhoc/test/differ.test.js
git commit -m "feat(adhoc): candidate-vs-sources differ"
```

---

### Task 9: Recon orchestrator + report

**Files:**
- Create: `adhoc/scripts/recon-report.js`
- Modify: `.gitignore` (add `recon-output`)

**Interfaces:**
- Consumes: everything above, plus `adhoc/pg-pool.js` (SELECT only) and the
  cache files.
- Produces: `adhoc/recon-output/report.md`, `candidates.json`,
  `parser-health.json`. No exported API — this is the executable.

No unit test for the orchestrator (it's I/O glue over tested parts); its
verification is the sanity-check section of the report it produces (Step 3).

- [ ] **Step 1: Add `recon-output` to `.gitignore`**

Append a line to the repo root `.gitignore`:

```
recon-output
```

- [ ] **Step 2: Implement**

Create `adhoc/scripts/recon-report.js`:

```js
// Increment-1 recon: parse the entire Bulbapedia cache, classify entries,
// diff against the sources table, and write a coverage report.
// READ-ONLY: the only DB access is SELECT. See
// docs/superpowers/specs/2026-08-18-phase-4-source-pipeline-design.md.
//
// Run inside the adhoc container (stack must be up):
//   docker compose -f compose.dev.yml exec adhoc node scripts/recon-report.js
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pgPool from '../pg-pool.js'
import { parseGameLocations } from '../src/bulbapedia/availability.js'
import { classifyEntry } from '../src/bulbapedia/classify.js'
import { parseEventEntries } from '../src/bulbapedia/events.js'
import { parseTrades } from '../src/bulbapedia/trades.js'
import { diffCandidates, UNIQUE_SOURCE_TYPES, similarity } from '../src/bulbapedia/differ.js'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const CACHE = path.join(HERE, '..', 'bulbapedia-cache')
const OUT = path.join(HERE, '..', 'recon-output')

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
const auxGen = (filename) => AUX_GENS.find(([fragment]) => filename.includes(fragment))?.[1] ?? null

const readJson = async (file) => JSON.parse(await fs.readFile(file, 'utf8'))

// ---- parse pokemon pages -------------------------------------------------
const candidates = []
const tallies = { generic: 0, unavailable: 0, 'untracked-game': 0, 'unique-candidate': 0 }
const warnings = []
const unknownGames = new Map()

const pokemonFiles = (await fs.readdir(path.join(CACHE, 'pokemon'))).filter((f) => f.endsWith('.json'))
for (const file of pokemonFiles) {
  const pokemonId = parseInt(file.slice(0, 4), 10)
  const page = await readJson(path.join(CACHE, 'pokemon', file))
  const { entries, warnings: pageWarnings } = parseGameLocations(page.wikitext)
  warnings.push(...pageWarnings.map((warning) => `${file}: ${warning}`))
  for (const entry of entries) {
    const { kind, reasons } = classifyEntry(entry)
    tallies[kind]++
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
      origin: entry.subsection === 'core' ? 'availability' : 'side-games',
      reasons,
    })
  }
}

// ---- parse aux pages -----------------------------------------------------
const trades = { trades: [], unparsed: [] }
const auxFiles = (await fs.readdir(path.join(CACHE, 'aux'))).filter((f) => f.endsWith('.json'))
for (const file of auxFiles) {
  const page = await readJson(path.join(CACHE, 'aux', file))
  if (file.startsWith('list-of-in-game-trades')) {
    const parsed = parseTrades(page.wikitext)
    trades.trades.push(...parsed.trades)
    trades.unparsed.push(...parsed.unparsed)
    continue
  }
  const gen = auxGen(file)
  if (gen === null) {
    warnings.push(`aux page with unknown gen mapping: ${file}`)
    continue
  }
  const origin = file.startsWith('list-of-game-based') ? 'distribution' : 'event-list'
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
      origin,
      reasons: [origin],
    })
  }
}

// ---- fetch DB state (SELECT only) ----------------------------------------
const { rows: sources } = await pgPool.query(
  'select id, pokemon_id as "pokemonId", name, description, gen, source from sources'
)
const { rows: pokemon } = await pgPool.query('select id, name from pokemon')
await pgPool.end()
const pokemonName = new Map(pokemon.map(({ id, name }) => [id, name]))

// ---- diff ----------------------------------------------------------------
const inScope = candidates.filter((candidate) => candidate.gen >= 1 && candidate.gen <= 7)
const outOfScope = candidates.length - inScope.length
const { matched, missing, unmatchedExisting } = diffCandidates(inScope, sources)

// trades: nicknames vs existing npc-trade row names
const npcTradeRows = sources.filter((source) => source.source === 'npc-trade')
const tradeMatches = []
const tradeMisses = []
for (const trade of trades.trades) {
  const pool = npcTradeRows.filter((source) => source.pokemonId === trade.receives.ndex)
  const hit = pool.find(
    (source) => trade.nickname && similarity(source.name, trade.nickname) > 0
  ) ?? pool.find((source) => similarity(`${source.name} ${source.description ?? ''}`, `${trade.nickname ?? ''} ${trade.location ?? ''} trade`) >= 0.34)
  ;(hit ? tradeMatches : tradeMisses).push({ trade, source: hit ?? null })
}

// ---- sanity checks -------------------------------------------------------
const sanity = [
  {
    check: 'Wynaut Lavaridge gift (gen 3) matches an existing row',
    pass: matched.some(({ candidate }) => candidate.pokemonId === 360 && candidate.gen === 3 && /lavaridge/i.test(candidate.area)),
  },
  {
    check: 'Stadium 2 Gligar (suspected miss) appears in missing',
    pass: missing.some((candidate) => candidate.pokemonId === 207 && candidate.game === 'Stadium 2'),
  },
  {
    check: "Farfetch'd Stadium 2 side-game row matches",
    pass: matched.some(({ candidate }) => candidate.pokemonId === 83 && candidate.origin === 'side-games'),
  },
]

// ---- write outputs -------------------------------------------------------
await fs.mkdir(OUT, { recursive: true })

const byGen = (items, genOf) => {
  const map = new Map()
  for (const item of items) {
    const gen = genOf(item)
    map.set(gen, (map.get(gen) ?? 0) + 1)
  }
  return map
}
const missingByGen = byGen(missing, (candidate) => candidate.gen)
const matchedByGen = byGen(matched, ({ candidate }) => candidate.gen)
const unmatchedByGen = byGen(unmatchedExisting, (source) => source.gen)

const lines = []
lines.push('# Bulbapedia recon report', '')
lines.push(`Generated ${new Date().toISOString()} from ${pokemonFiles.length} pokemon pages + ${auxFiles.length} aux pages.`, '')
lines.push('## Summary', '')
lines.push(`- Availability entries: ${Object.values(tallies).reduce((a, b) => a + b, 0)} (${tallies['unique-candidate']} unique candidates, ${tallies.generic} generic, ${tallies.unavailable} unavailable, ${tallies['untracked-game']} untracked-game)`)
lines.push(`- Total candidates gens 1–7: ${inScope.length} (${outOfScope} out-of-scope gen 8+ candidates set aside)`)
lines.push(`- Matched to existing rows: ${matched.length}; missing (no existing row): ${missing.length}`)
lines.push(`- Existing unique rows with no candidate: ${unmatchedExisting.length} of ${sources.filter((s) => UNIQUE_SOURCE_TYPES.includes(s.source)).length}`)
lines.push(`- Trades parsed: ${trades.trades.length} (${trades.unparsed.length} unparsed rows); nickname-matched to npc-trade rows: ${tradeMatches.length}, unmatched: ${tradeMisses.length}`, '')

lines.push('## Sanity checks', '')
for (const { check, pass } of sanity) lines.push(`- [${pass ? 'x' : ' '}] ${check}`)
lines.push('')

lines.push('## Per-gen coverage', '', '| gen | candidates | matched | missing | existing-unmatched |', '| --- | --- | --- | --- | --- |')
for (let gen = 1; gen <= 7; gen++) {
  const total = (matchedByGen.get(gen) ?? 0) + (missingByGen.get(gen) ?? 0)
  lines.push(`| ${gen} | ${total} | ${matchedByGen.get(gen) ?? 0} | ${missingByGen.get(gen) ?? 0} | ${unmatchedByGen.get(gen) ?? 0} |`)
}
lines.push('')

const CAP = 250
lines.push('## Missing candidates (suspected new sources)', '')
for (let gen = 1; gen <= 7; gen++) {
  const genMissing = missing.filter((candidate) => candidate.gen === gen)
  if (!genMissing.length) continue
  lines.push(`### Gen ${gen} — ${genMissing.length}`, '')
  for (const candidate of genMissing.slice(0, CAP)) {
    lines.push(`- #${candidate.pokemonId} ${pokemonName.get(candidate.pokemonId) ?? '?'} [${candidate.game || candidate.origin}]: ${candidate.area.slice(0, 160)}`)
  }
  if (genMissing.length > CAP) lines.push(`- ... and ${genMissing.length - CAP} more (see candidates.json)`)
  lines.push('')
}

lines.push('## Existing unique rows with no Bulbapedia candidate', '')
lines.push('(Parser misses or data errors — the gen 1 audit starts here.)', '')
for (const source of unmatchedExisting.slice(0, CAP)) {
  lines.push(`- #${source.pokemonId} ${pokemonName.get(source.pokemonId) ?? '?'} gen ${source.gen} [${source.source}] ${source.name}`)
}
if (unmatchedExisting.length > CAP) lines.push(`- ... and ${unmatchedExisting.length - CAP} more`)
lines.push('')

lines.push('## Unmatched trades', '')
for (const { trade } of tradeMisses.slice(0, CAP)) {
  lines.push(`- ${trade.receives.name} for ${trade.gives.name}${trade.nickname ? ` "${trade.nickname}"` : ''} (${trade.heading})`)
}
lines.push('')

lines.push('## Parser health', '')
lines.push(`- Warnings: ${warnings.length}`)
for (const warning of warnings.slice(0, 50)) lines.push(`  - ${warning}`)
if (warnings.length > 50) lines.push(`  - ... and ${warnings.length - 50} more (see parser-health.json)`)
lines.push(`- Unknown (unexpected) game names:`)
for (const [game, count] of [...unknownGames.entries()].sort((a, b) => b[1] - a[1])) {
  lines.push(`  - ${game}: ${count}`)
}

await fs.writeFile(path.join(OUT, 'report.md'), lines.join('\n'))
await fs.writeFile(path.join(OUT, 'candidates.json'), JSON.stringify({ candidates, trades }, null, 2))
await fs.writeFile(
  path.join(OUT, 'parser-health.json'),
  JSON.stringify({ tallies, warnings, unknownGames: Object.fromEntries(unknownGames), unparsedTradeRows: trades.unparsed, sanity }, null, 2)
)
console.log(`report written to ${path.join(OUT, 'report.md')}`)
console.log(`sanity: ${sanity.filter((s) => s.pass).length}/${sanity.length} passing`)
```

- [ ] **Step 3: Run the recon and check sanity**

```bash
docker compose -f compose.dev.yml exec adhoc node scripts/recon-report.js
```

Expected: `sanity: 3/3 passing` and a `report.md` in `adhoc/recon-output/`.
If a sanity check fails, debug the responsible parser (systematic-debugging
skill), extend that parser's unit tests with the failing page's wikitext
excerpt, fix, and re-run. Also skim `report.md`'s Parser health section:
"unknown game names" entries mean `games.js` needs additions (add to `GAMES`
if trackable, `KNOWN_UNTRACKED` otherwise, with a test).

Note the Farfetch'd check (#83) assumes its existing "Stadium" side-game row
matches a parsed Stadium/Stadium 2 candidate — if Bulbapedia's side-games
section for Farfetch'd names it differently, inspect `candidates.json` before
concluding the parser is wrong; adjust the check to what the page really
contains if needed (and say so in the commit message).

- [ ] **Step 4: Run the full test suite once more**

Run: `cd adhoc && npm test`
Expected: PASS (31 tests)

- [ ] **Step 5: Commit**

```bash
git add .gitignore adhoc/scripts/recon-report.js
git commit -m "feat(adhoc): recon report orchestrator (read-only diff vs sources)"
```

---

### Task 10: Update docs with recon results

**Files:**
- Modify: `docs/source-data.md` (Position section)

**Interfaces:** none — documentation.

- [ ] **Step 1: Update the Position section**

In `docs/source-data.md`, replace the two Position bullets with (fill in the
real numbers from `report.md`):

```markdown
## Position

- Recon parser (phase 4 increment 1) diffs the full Bulbapedia cache against
  `sources`: run `docker compose -f compose.dev.yml exec adhoc node
  scripts/recon-report.js`, read `adhoc/recon-output/report.md` (gitignored).
- Recon 2026-08-18: N candidates gens 1–7, N matched to existing rows,
  N missing, N existing unique rows with no candidate. The old "stopped
  before Wynaut (#360)" bookmark is superseded by the per-gen diff.
```

- [ ] **Step 2: Commit**

```bash
git add docs/source-data.md
git commit -m "docs: record recon-parser position in source-data.md"
```

---

## Verification checklist (end of increment)

- `cd adhoc && npm test` — all green.
- Recon runs clean inside the adhoc container; `sanity: 3/3`.
- `git status` shows no cache or recon-output files staged.
- Report reviewed by Jordan before increment 2 (staging table + review page)
  is planned.
