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
