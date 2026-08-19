import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildStagedRows,
  candidateKey,
  guessSourceType,
  PARSER_VERSION,
} from '../src/staging/build-staged-rows.js'

const candidate = (extra = {}) => ({
  pokemonId: 4, gen: 3, game: 'Ruby', area: 'Lavaridge Town (gift)',
  rawArea: '[[Lavaridge Town]] (gift)', origin: 'availability',
  reasons: ['gift language'], pageTitle: 'Testmon (Pokémon)', revid: 99,
  nickname: null, ...extra,
})
const pokemonNames = new Map([[4, 'Charmander'], [122, 'Mr. Mime'], [360, 'Wynaut']])
const emptyDiff = { matched: [], missing: [], suggestions: [], unmatchedExisting: [] }

describe('candidateKey', () => {
  it('is stable and ignores the game (per-version collapse)', () => {
    assert.equal(candidateKey(candidate()), candidateKey(candidate({ game: 'Sapphire' })))
    assert.notEqual(candidateKey(candidate()), candidateKey(candidate({ gen: 4 })))
    assert.notEqual(candidateKey(candidate()), candidateKey(candidate({ area: 'other' })))
  })

  it('differs when only the nickname differs', () => {
    assert.notEqual(
      candidateKey(candidate({ nickname: 'Marcel' })),
      candidateKey(candidate({ nickname: 'Spearsy' })))
  })

  it('still collapses per-version when nicknames are equal', () => {
    assert.equal(
      candidateKey(candidate({ game: 'Ruby', nickname: 'Marcel' })),
      candidateKey(candidate({ game: 'Sapphire', nickname: 'Marcel' })))
  })
})

describe('guessSourceType', () => {
  it('maps reasons and origins to source types in priority order', () => {
    assert.equal(guessSourceType(candidate()), 'gift')
    assert.equal(guessSourceType(candidate({ origin: 'trades' })), 'npc-trade')
    assert.equal(guessSourceType(candidate({ reasons: ['npc trade', 'gift language'] })), 'npc-trade')
    assert.equal(guessSourceType(candidate({ reasons: ['starter'] })), 'starter')
    assert.equal(guessSourceType(candidate({ reasons: ['fossil'] })), 'fossil')
    assert.equal(guessSourceType(candidate({ reasons: ['honey tree'] })), 'honey-tree')
    assert.equal(guessSourceType(candidate({ origin: 'event-list', reasons: ['event-list'] })), 'event')
    assert.equal(guessSourceType(candidate({ reasons: ['prize'] })), 'prize')
    assert.equal(guessSourceType(candidate({ origin: 'side-games', reasons: [] })), 'side-game')
    assert.equal(guessSourceType(candidate({ reasons: [] })), 'special')
  })
})

describe('buildStagedRows — new rows', () => {
  it('collapses per-version duplicates into one row with a games union', () => {
    const { rows } = buildStagedRows(
      { ...emptyDiff, missing: [candidate(), candidate({ game: 'Sapphire' })] },
      { pokemonNames })
    assert.equal(rows.length, 1)
    const [row] = rows
    assert.equal(row.rowKind, 'new')
    assert.deepEqual(row.games, ['Ruby', 'Sapphire'])
    assert.equal(row.pokemonId, 4)
    assert.equal(row.gen, 3)
    assert.equal(row.source, 'gift')
    assert.equal(row.name, 'Charmander — Ruby/Sapphire gift')
    assert.equal(row.description, 'Lavaridge Town (gift)')
    assert.equal(row.rawSnippet, '[[Lavaridge Town]] (gift)')
    assert.equal(row.confidence, 'low')
    assert.equal(row.parserVersion, PARSER_VERSION)
    assert.equal(row.naturalKey, candidateKey(candidate()))
  })

  it('uses the nickname as the draft name and medium confidence for trades', () => {
    const trade = candidate({
      pokemonId: 122, gen: 1, game: 'Red and Blue', origin: 'trades',
      reasons: ['npc trade'], nickname: 'Marcel',
      area: 'In-game trade: receive Mr. Mime for Abra at Route 2', rawArea: null,
    })
    const { rows } = buildStagedRows({ ...emptyDiff, missing: [trade] }, { pokemonNames })
    assert.equal(rows[0].name, 'Marcel')
    assert.equal(rows[0].source, 'npc-trade')
    assert.equal(rows[0].confidence, 'medium')
    assert.equal(rows[0].rawSnippet, 'In-game trade: receive Mr. Mime for Abra at Route 2')
  })

  it('attaches the best suggestion to its new row', () => {
    const c = candidate()
    const suggestion = { candidate: c, source: { id: 'src-9' }, score: 0.25, reason: 'fuzzy:0.25' }
    const { rows } = buildStagedRows(
      { ...emptyDiff, missing: [c], suggestions: [suggestion] }, { pokemonNames })
    assert.equal(rows[0].suggestedSourceId, 'src-9')
    assert.equal(rows[0].suggestionReason, 'fuzzy:0.25')
  })
})

describe('buildStagedRows — audit rows', () => {
  it('carries matchedSourceId and upgrades nickname matches to high confidence', () => {
    const c = candidate({ origin: 'trades', nickname: 'Marcel', pokemonId: 122, gen: 1 })
    const { rows } = buildStagedRows(
      { ...emptyDiff, matched: [{ candidate: c, source: { id: 'src-1' }, score: 1, matchKind: 'nickname' }] },
      { pokemonNames })
    assert.equal(rows[0].rowKind, 'audit')
    assert.equal(rows[0].matchedSourceId, 'src-1')
    assert.equal(rows[0].confidence, 'high')
  })

  it('warns when one collapsed group matched different sources and keeps the best', () => {
    const a = candidate()
    const b = candidate({ game: 'Sapphire' })
    const { rows, warnings } = buildStagedRows(
      { ...emptyDiff, matched: [
        { candidate: a, source: { id: 'src-1' }, score: 0.9, matchKind: 'fuzzy' },
        { candidate: b, source: { id: 'src-2' }, score: 0.5, matchKind: 'fuzzy' },
      ] },
      { pokemonNames })
    assert.equal(rows.length, 1)
    assert.equal(rows[0].matchedSourceId, 'src-1')
    assert.equal(warnings.length, 1)
  })
})

describe('buildStagedRows — existing-unmatched rows', () => {
  const sourceRow = { id: 'src-3', pokemonId: 360, name: 'Pokewalker Wynaut', description: null, gen: 4, source: 'pokewalker' }

  it('snapshots the source row and labels pokewalker as expected-absent', () => {
    const { rows } = buildStagedRows({ ...emptyDiff, unmatchedExisting: [sourceRow] }, { pokemonNames })
    const [row] = rows
    assert.equal(row.rowKind, 'existing-unmatched')
    assert.equal(row.naturalKey, 'existing:src-3')
    assert.equal(row.pokemonId, 360)
    assert.equal(row.gen, 4)
    assert.equal(row.matchedSourceId, 'src-3')
    assert.equal(row.expectedAbsent, true)
    assert.equal(row.name, null)
    assert.deepEqual(JSON.parse(row.rawSnippet), sourceRow)
  })

  it('non-pokewalker unmatched rows are not expected-absent', () => {
    const { rows } = buildStagedRows(
      { ...emptyDiff, unmatchedExisting: [{ ...sourceRow, source: 'gift' }] }, { pokemonNames })
    assert.equal(rows[0].expectedAbsent, false)
  })
})
