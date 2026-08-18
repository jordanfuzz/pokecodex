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

// mon: one raw camelized row from pokemonWithSourcesQuery.
// neededRules: getNeededRules() output (type strings, gender expanded).
// overrides: { [sourceId]: isRequired } for the user.
export const buildRequiredSources = (mon, neededRules, overrides = {}) => {
  const sourceRows = (mon.sourcesByType || []).filter(row => row && row.id)
  const ownedRows = (mon.usersSourcesByGen || []).filter(row => row && row.id)
  const evolutionIds = new Set((mon.usersEvolutionSourceIds || []).filter(Boolean))
  const seen = new Set()
  const required = []

  for (const row of sourceRows) {
    if (seen.has(row.id)) continue
    seen.add(row.id)

    const override = overrides[row.id]
    const isRequired = override === undefined ? neededRules.includes(row.type) : override
    if (!isRequired) continue

    required.push({
      sourceId: row.id,
      name: row.name,
      type: row.type,
      firstGen: Number(row.firstGen),
      replaceDefault: Boolean(row.replaceDefault),
      caughtInGens: ownedRows.filter(o => o.id === row.id).map(o => Number(o.gen)),
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
    entry => entry.caughtInGens.length > 0 || entry.caughtViaEvolution
  )
}
