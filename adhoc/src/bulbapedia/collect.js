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
