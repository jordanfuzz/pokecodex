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

if (rows.length === 0) {
  throw new Error('no staged rows built — refusing to run the stale delete against an empty emission')
}

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
  image = excluded.image,
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
  // A parser change that re-keys a candidate must not destroy a human-confirmed
  // pairing; the confirmed row lingers pending for the reviewer instead.
  const { rowCount: staleDeleted } = await client.query(
    `delete from staged_sources where status = 'pending' and not pairing_confirmed and not (natural_key = any($1::text[]))`,
    [rows.map((row) => row.naturalKey)]
  )
  await client.query('commit')
  const byKind = rows.reduce((acc, row) => ({ ...acc, [row.rowKind]: (acc[row.rowKind] ?? 0) + 1 }), {})
  console.log(`staged ${rows.length} rows`, byKind)
  console.log(`stale pending rows deleted: ${staleDeleted}`)
  console.log(`warnings: ${warnings.length}`)
  for (const warning of warnings.slice(0, 40)) console.log(`  ${warning}`)
  if (warnings.length > 40) console.log(`  ...and ${warnings.length - 40} more`)
} catch (error) {
  try {
    await client.query('rollback')
  } catch {
    // swallow rollback failure so the original error propagates
  }
  throw error
} finally {
  client.release()
  await pgPool.end()
}
