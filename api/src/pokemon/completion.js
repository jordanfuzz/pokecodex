// sources that a pokemon can have multiple of (eg. unown forms)
export const repeatableSourceTypes = [
  'variant',
  'regional',
  'special',
  'npc-trade',
  'side-game',
  'prize',
  'gift',
  'pokewalker', // can be repeatable because of flying and surfing pikachu
  'event',
]

// rules that can be satisfied by a source inherited onto an evolution
export const evolutionSatisfiableTypes = [
  'special',
  'npc-trade',
  'side-game',
  'prize',
  'gift',
  'pokewalker',
  'honey-tree',
  'event',
  'game-corner',
]

// Raw catch rows (users_catches agg) carry gen and region; the cleaned
// shape handed to the front end drops region.
const toCatch = row => ({
  gameId: row.gameId,
  gen: Number(row.gen),
  isolationGroup: row.isolationGroup ?? null,
  transferGen: row.transferGen == null ? null : Number(row.transferGen),
})

// A catch is "from home region" iff its game's generation is the pokemon's
// debut gen AND its region is the pokemon's home region.
export const homeRegionCatchFilter = mon => c =>
  Number(c.gen) === Number(mon.originalGen) &&
  Boolean(c.region) &&
  Boolean(mon.homeRegion) &&
  c.region === mon.homeRegion

// mon: one raw camelized row from pokemonWithSourcesQuery.
// neededRules: getNeededRules() output (type strings, gender expanded).
// overrides: { [sourceId]: isRequired } for the user.
export const buildRequiredSources = (mon, neededRules, overrides = {}) => {
  const sourceRows = (mon.sourcesByType || []).filter(row => row && row.id)
  const ownedRows = (mon.usersSourcesByGen || []).filter(row => row && row.id)
  const catches = (mon.usersCatches || []).filter(row => row && row.gameId)
  const evolutionIds = new Set((mon.usersEvolutionSourceIds || []).filter(Boolean))
  const seen = new Set()
  const required = []

  for (const row of sourceRows) {
    if (seen.has(row.id)) continue
    seen.add(row.id)

    const override = overrides[row.id]
    const isRequired = override === undefined ? neededRules.includes(row.type) : override
    if (!isRequired) continue

    // 'From home region' is derived from where the pokemon was caught, not
    // from stored source links.
    const caughtIn =
      row.type === 'original'
        ? catches.filter(homeRegionCatchFilter(mon)).map(toCatch)
        : ownedRows.filter(o => o.id === row.id).map(toCatch)

    required.push({
      sourceId: row.id,
      name: row.name,
      type: row.type,
      firstGen: Number(row.firstGen),
      replaceDefault: Boolean(row.replaceDefault),
      caughtIn,
      caughtInGens: caughtIn.map(c => c.gen),
      caughtViaEvolution:
        evolutionSatisfiableTypes.includes(row.type) && evolutionIds.has(row.id),
      isOverridden: override !== undefined,
    })
  }
  return required
}

export const checkCompletion = (mon, requiredSources) => {
  if (!requiredSources.length) {
    // No applicable rules: any catch at all completes the record.
    return (
      (mon.usersSourcesByGen || []).some(row => row && row.id) ||
      Boolean((mon.usersSources || [])[0])
    )
  }
  return requiredSources.every(
    entry => entry.caughtIn.length > 0 || entry.caughtViaEvolution
  )
}
