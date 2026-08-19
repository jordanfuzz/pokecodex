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
