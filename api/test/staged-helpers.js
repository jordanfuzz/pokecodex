import fs from 'node:fs'
import { fileURLToPath } from 'url'
import { randomUUID } from 'crypto'
import pgPool from '../src/pg-pool.js'

// The migration is idempotent (if-not-exists / duplicate_object guards), so
// every test run can apply it — no manual DB prep step for CI or fresh DBs.
export const applyStagedMigration = () =>
  pgPool.query(
    fs.readFileSync(
      fileURLToPath(new URL('../../adhoc/scripts/migrations/2026-08-staged-sources.sql', import.meta.url)),
      'utf8'
    )
  )

// parser_version 'test' is the cleanup handle for all planted rows.
export const insertStagedRow = async (overrides = {}) => {
  const row = {
    id: randomUUID(),
    naturalKey: `test-${randomUUID()}`,
    rowKind: 'new',
    status: 'pending',
    pokemonId: 1,
    name: 'staged-test-row',
    description: 'staged test description',
    image: null,
    gen: 1,
    source: 'gift',
    replaceDefault: false,
    confidence: 'low',
    matchedSourceId: null,
    suggestedSourceId: null,
    suggestionReason: null,
    expectedAbsent: false,
    pageTitle: 'Test page',
    revid: 1,
    rawSnippet: 'raw snippet',
    origin: 'availability',
    games: ['Red'],
    parserVersion: 'test',
    ...overrides,
  }
  await pgPool.query(
    `insert into staged_sources (
      id, natural_key, row_kind, status, pokemon_id, name, description, image,
      gen, source, replace_default, confidence, matched_source_id,
      suggested_source_id, suggestion_reason, expected_absent, page_title,
      revid, raw_snippet, origin, games, parser_version
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22);`,
    [
      row.id, row.naturalKey, row.rowKind, row.status, row.pokemonId, row.name,
      row.description, row.image, row.gen, row.source, row.replaceDefault,
      row.confidence, row.matchedSourceId, row.suggestedSourceId,
      row.suggestionReason, row.expectedAbsent, row.pageTitle, row.revid,
      row.rawSnippet, row.origin, row.games, row.parserVersion,
    ]
  )
  return row
}

export const cleanupStagedTestRows = () =>
  pgPool.query(`delete from staged_sources where parser_version = 'test';`)

// Test sources rows carry this name prefix for cleanup.
export const insertTestSource = async (overrides = {}) => {
  const source = {
    id: randomUUID(), pokemonId: 1, name: `staged-api-test-${randomUUID().slice(0, 8)}`,
    description: 'test source', image: null, gen: 1, source: 'gift', replaceDefault: false,
    ...overrides,
  }
  await pgPool.query(
    `insert into sources (id, pokemon_id, name, description, image, gen, source, replace_default)
     values ($1,$2,$3,$4,$5,$6,$7,$8);`,
    [source.id, source.pokemonId, source.name, source.description, source.image, source.gen, source.source, source.replaceDefault]
  )
  return source
}

export const cleanupTestSources = () =>
  pgPool.query(`delete from sources where name like 'staged-api-test-%';`)
