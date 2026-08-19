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

export const groupByPokemon = rows => {
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

// matchedSource comes from row_to_json(sources) in listStagedSources
// (staged-sources-repository.js), then the whole row array is run through
// camelize() — which recurses into nested objects — so the join side arrives
// camelCased (replaceDefault, not replace_default). Both sides of DIFF_FIELDS
// use the same camelCase key. When there's no match, matchedSource is
// genuinely null (row_to_json of a left-join NULL), not an all-null object.
const DIFF_FIELDS = ['name', 'description', 'gen', 'source', 'replaceDefault']

export const fieldDiffs = row => {
  const existing = row.matchedSource ?? {}
  return DIFF_FIELDS.map(field => {
    const staged = row[field] ?? null
    const current = existing[field] ?? null
    // apply preserves gen 0 (multi-gen) server-side (see approveStagedSource's
    // audit 'apply' branch), so don't highlight it as a pending change here.
    const changed = field === 'gen' && current === 0 ? false : staged !== current
    return { field, staged, existing: current, changed }
  })
}
