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

// Trade headings for gen 8+ games/spinoffs — trades aren't gen-filtered like
// candidates (parseTrades has no gen field), so unmatched trades need this to
// separate in-scope (gen 1–7) misses from out-of-scope noise.
const OUT_OF_SCOPE_HEADINGS = [
  /Sword and Shield/, /Isle of Armor/, /Crown Tundra/,
  /Brilliant Diamond and Shining Pearl/, /Legends: Z-A/, /Scarlet and Violet/,
  /^Mega Dimension$/,
]
const isOutOfScopeTrade = (trade) => OUT_OF_SCOPE_HEADINGS.some((rx) => rx.test(trade.heading))

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
  'select id, pokemon_id as "pokemonId", name, description, gen, source from sources order by id'
)
const { rows: pokemon } = await pgPool.query('select id, name from pokemon order by id')
await pgPool.end()
const pokemonName = new Map(pokemon.map(({ id, name }) => [id, name]))

// ---- diff ----------------------------------------------------------------
const inScope = candidates.filter((candidate) => candidate.gen >= 1 && candidate.gen <= 7)
const outOfScope = candidates.length - inScope.length
const { matched, missing, unmatchedExisting } = diffCandidates(inScope, sources)

// distinct matched source rows — `matched.length` counts candidate rows, and
// several candidates (e.g. per-version Ruby/Sapphire rows of one gift)
// legitimately match the same source row, so it is not directly comparable
// to source-row counts like unmatchedExisting.
const distinctMatchedSourceIds = new Set(matched.map(({ source }) => source.id)).size

// `missing` holds one entry per candidate row, so a gift listed once per
// version (Ruby, Sapphire, ...) shows up as literal duplicates. Collapse
// rows identical in (pokemonId, gen, area) for reporting; keep the raw
// count too since it is what "candidate rows" means everywhere else.
const missingGroups = new Map()
for (const candidate of missing) {
  const key = `${candidate.pokemonId}::${candidate.gen}::${candidate.area}`
  if (!missingGroups.has(key)) missingGroups.set(key, { ...candidate, games: new Set() })
  missingGroups.get(key).games.add(candidate.game || candidate.origin)
}
const missingRows = [...missingGroups.values()]
const missingDistinctGenArea = missingRows.length
const missingDistinctPokemonGen = new Set(missing.map((c) => `${c.pokemonId}::${c.gen}`)).size

// Sources aren't gen-filtered before diffCandidates (only candidates are),
// so unmatchedExisting mixes in-scope (gen 0–7, gen 0 being eligible for
// any candidate gen) rows with gen 8/9 rows that can never match a gen 1–7
// candidate by construction. Split the reporting so the two aren't summed
// together as if comparable.
const uniqueSourcesAll = sources.filter((s) => UNIQUE_SOURCE_TYPES.includes(s.source))
const uniqueSourcesInScope = uniqueSourcesAll.filter((s) => s.gen <= 7)
const uniqueSourcesOutOfScope = uniqueSourcesAll.length - uniqueSourcesInScope.length
const unmatchedInScope = unmatchedExisting.filter((s) => s.gen <= 7)
const unmatchedOutOfScope = unmatchedExisting.length - unmatchedInScope.length

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
lines.push(`- Matched to existing rows: ${matched.length} candidate rows (${distinctMatchedSourceIds} distinct source rows — several candidates, e.g. per-version Ruby/Sapphire rows of one gift, legitimately match the same source row); missing (no existing row): ${missing.length} candidate rows (${missingDistinctGenArea} distinct pokemon+gen+area after collapsing per-version duplicates, ${missingDistinctPokemonGen} distinct pokemon+gen)`)
lines.push(`- Existing unique rows with no candidate: ${unmatchedInScope.length} of ${uniqueSourcesInScope.length} in scope (gen 0–7); ${unmatchedOutOfScope} of ${uniqueSourcesOutOfScope} out of scope (gen 8/9, set aside — phase 4 covers gens 1–7 only)`)
lines.push(`- Caveat: 'missing' and 'existing unmatched' are NOT disjoint — a below-threshold match (including 1-token names hit by the min-token guard) lists the same fact in both; reconcile per pokemon before creating rows.`)
const tradeMissesOutOfScope = tradeMisses.filter(({ trade }) => isOutOfScopeTrade(trade)).length
const tradeMissesInScope = tradeMisses.length - tradeMissesOutOfScope
lines.push(`- Trades parsed: ${trades.trades.length} (${trades.unparsed.length} unparsed rows); loosely matched to npc-trade rows: ${tradeMatches.length}, unmatched: ${tradeMisses.length} (${tradeMissesInScope} in-scope gen 1–7, ${tradeMissesOutOfScope} out-of-scope gen 8+)`)
lines.push(`- Caveat: trade matching ignores game/gen (parsed trades carry no game/gen field), so a "loose match" can pair a trade with an npc-trade row from a different game — matching is on name/description vs nickname/location text only, not confirmed same-game identity.`, '')

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
lines.push('(Rows identical in pokemon+gen+area — e.g. separate Ruby and Sapphire candidates for one gift Bulbapedia records once — are collapsed to one bullet listing every version in the game field.)', '')
for (let gen = 1; gen <= 7; gen++) {
  const genMissingRaw = missing.filter((candidate) => candidate.gen === gen)
  if (!genMissingRaw.length) continue
  const genRows = missingRows.filter((row) => row.gen === gen)
  lines.push(`### Gen ${gen} — ${genMissingRaw.length} rows (${genRows.length} distinct)`, '')
  for (const candidate of genRows.slice(0, CAP)) {
    const games = [...candidate.games]
    const gameLabel = games.length > 1 ? `[${games.join(', ')}]` : `[${games[0] ?? ''}]`
    lines.push(`- #${candidate.pokemonId} ${pokemonName.get(candidate.pokemonId) ?? '?'} ${gameLabel}: ${candidate.area.slice(0, 160)}`)
  }
  if (genRows.length > CAP) lines.push(`- ... and ${genRows.length - CAP} more (see diff.json)`)
  lines.push('')
}

lines.push('## Existing unique rows with no Bulbapedia candidate', '')
lines.push(`(Parser misses or data errors — the gen 1 audit starts here. Some of these also appear in "Missing candidates" above — see the overlap caveat in Summary. In-scope (gen 0–7) rows only; ${unmatchedOutOfScope} gen 8/9 rows are out of phase-4 scope and excluded from this list — see diff.json for the full unmatchedExisting array.)`, '')
for (const source of unmatchedInScope.slice(0, CAP)) {
  lines.push(`- #${source.pokemonId} ${pokemonName.get(source.pokemonId) ?? '?'} gen ${source.gen} [${source.source}] ${source.name}`)
}
if (unmatchedInScope.length > CAP) lines.push(`- ... and ${unmatchedInScope.length - CAP} more (see diff.json)`)
lines.push('')

lines.push('## Unmatched trades', '')
for (const { trade } of tradeMisses.slice(0, CAP)) {
  const scopeLabel = isOutOfScopeTrade(trade) ? ' [gen 8+/out of scope]' : ''
  lines.push(`- ${trade.receives.name} for ${trade.gives.name}${trade.nickname ? ` "${trade.nickname}"` : ''} (${trade.heading})${scopeLabel}`)
}
if (tradeMisses.length > CAP) lines.push(`- ... and ${tradeMisses.length - CAP} more (see diff.json)`)
lines.push('')

lines.push('## Parser health', '')
lines.push(`- Warnings: ${warnings.length}`)
for (const warning of warnings.slice(0, 50)) lines.push(`  - ${warning}`)
if (warnings.length > 50) lines.push(`  - ... and ${warnings.length - 50} more (see parser-health.json)`)
lines.push(`- Gen-5 distributions gap: AUX_GENS has no "generation-v" entry — the cache holds no "...distributions-in-generation-v" page. Gen-5 distributions therefore contribute zero candidates, silently, with nothing else in this report to flag the gap. (Whether Bulbapedia even has such a page is unverified — not fetched to check.)`)
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
await fs.writeFile(
  path.join(OUT, 'diff.json'),
  JSON.stringify({ matched, missing, unmatchedExisting, tradeMisses }, null, 2)
)
console.log(`report written to ${path.join(OUT, 'report.md')}`)
console.log(`sanity: ${sanity.filter((s) => s.pass).length}/${sanity.length} passing`)
