import { describe, it, expect } from 'vitest'
import { pendingCountsByGen, groupByPokemon, buildListQuery, fieldDiffs } from './review.logic'

describe('pendingCountsByGen', () => {
  const summary = [
    { gen: 1, status: 'pending', rowKind: 'new', expectedAbsent: false, count: 5 },
    { gen: 1, status: 'pending', rowKind: 'existing-unmatched', expectedAbsent: true, count: 3 },
    { gen: 1, status: 'approved', rowKind: 'new', expectedAbsent: false, count: 9 },
    { gen: 4, status: 'pending', rowKind: 'audit', expectedAbsent: false, count: 2 },
  ]

  it('sums pending rows per gen, excluding expected-absent by default', () => {
    const counts = pendingCountsByGen(summary, false)
    expect(counts.get(1)).toBe(5)
    expect(counts.get(4)).toBe(2)
  })

  it('includes expected-absent rows when asked', () => {
    expect(pendingCountsByGen(summary, true).get(1)).toBe(8)
  })
})

describe('groupByPokemon', () => {
  it('groups consecutive rows by pokemonId keeping order', () => {
    const rows = [
      { id: 'a', pokemonId: 4, pokemonName: 'Charmander' },
      { id: 'b', pokemonId: 4, pokemonName: 'Charmander' },
      { id: 'c', pokemonId: 25, pokemonName: 'Pikachu' },
    ]
    const groups = groupByPokemon(rows)
    expect(groups).toHaveLength(2)
    expect(groups[0].pokemonName).toBe('Charmander')
    expect(groups[0].rows.map(r => r.id)).toEqual(['a', 'b'])
    expect(groups[1].rows.map(r => r.id)).toEqual(['c'])
  })
})

describe('buildListQuery', () => {
  it('serializes gen and non-default filters', () => {
    expect(
      buildListQuery(1, { status: 'pending', rowKind: null, confidence: null, includeExpected: false })
    ).toBe('gen=1&status=pending&includeExpected=false')
    expect(
      buildListQuery(3, { status: 'all', rowKind: 'new', confidence: 'high', includeExpected: true })
    ).toBe('gen=3&status=all&rowKind=new&confidence=high&includeExpected=true')
  })
})

describe('fieldDiffs', () => {
  // matchedSource comes from row_to_json(sources) and is then run through the
  // same camelize() as the rest of the row (see staged-sources-repository.js
  // listStagedSources) — camelize walks nested objects, so the join side
  // arrives as replaceDefault, not replace_default. Fixture matches that.
  it('marks changed fields between staged values and the matched source', () => {
    const row = {
      name: 'Parsed name',
      description: 'same',
      gen: 3,
      source: 'gift',
      replaceDefault: false,
      matchedSource: {
        name: 'Old name',
        description: 'same',
        gen: 3,
        source: 'gift',
        replaceDefault: false,
      },
    }
    const diffs = fieldDiffs(row)
    const byField = Object.fromEntries(diffs.map(d => [d.field, d]))
    expect(byField.name.changed).toBe(true)
    expect(byField.name.existing).toBe('Old name')
    expect(byField.description.changed).toBe(false)
    expect(byField.gen.changed).toBe(false)
  })

  it('treats a null matchedSource (no match) as all-fields-new', () => {
    const row = {
      name: 'Parsed name',
      description: null,
      gen: 3,
      source: 'gift',
      replaceDefault: false,
      matchedSource: null,
    }
    const diffs = fieldDiffs(row)
    const byField = Object.fromEntries(diffs.map(d => [d.field, d]))
    expect(byField.name.changed).toBe(true)
    expect(byField.name.existing).toBe(null)
  })
})
