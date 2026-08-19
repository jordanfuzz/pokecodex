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
