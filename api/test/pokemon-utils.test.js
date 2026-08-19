import './setup.js'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  getSourcesByType,
  getNeededRules,
  formatGamesForFiltering,
} from '../src/pokemon/pokemon-utils.js'

describe('getNeededRules', () => {
  it('keeps truthy rules and drops falsy ones', () => {
    assert.deepEqual(getNeededRules({ wild: true, hatch: false, shiny: true }), [
      'wild',
      'shiny',
    ])
  })

  it('expands gender into male and female in place', () => {
    assert.deepEqual(getNeededRules({ wild: true, gender: true, shiny: true }), [
      'wild',
      'male',
      'female',
      'shiny',
    ])
  })

  it('returns [] for empty rules', () => {
    assert.deepEqual(getNeededRules({}), [])
  })
})

describe('getSourcesByType', () => {
  const mon = {
    sourcesByType: [
      { type: 'wild', name: 'Wild', image: null, replaceDefault: false, firstGen: 0 },
      { type: 'variant', name: 'A', image: 'a.png', replaceDefault: false, firstGen: 2 },
      { type: 'variant', name: 'B', image: 'b.png', replaceDefault: true, firstGen: 2 },
    ],
  }

  it('groups repeatable types as [name, firstGen] pairs and flat types as name, firstGen', () => {
    const [byType] = getSourcesByType(mon)
    assert.deepEqual(byType.variant, [
      ['A', 2],
      ['B', 2],
    ])
    assert.deepEqual(byType.wild, ['Wild', 0])
  })

  it('collects image pairs and the replace-default source', () => {
    const [byType, images] = getSourcesByType(mon)
    assert.deepEqual(images, [
      ['A', 'a.png'],
      ['B', 'b.png'],
    ])
    assert.equal(byType.defaultSource, 'B')
  })

  it('leaves defaultSource undefined when nothing replaces the default', () => {
    const [byType] = getSourcesByType({
      sourcesByType: [
        { type: 'wild', name: 'Wild', image: null, replaceDefault: false, firstGen: 0 },
      ],
    })
    assert.equal(byType.defaultSource, undefined)
  })
})

describe('formatGamesForFiltering', () => {
  it('pairs each box option with its game row by id', () => {
    const games = [
      { id: 3, name: 'Yellow' },
      { id: 6, name: 'Crystal' },
    ]
    const result = formatGamesForFiltering(games)
    assert.deepEqual(result[0], ['Gen 1', { id: 3, name: 'Yellow' }])
    assert.deepEqual(result[1], ['Gen 2', { id: 6, name: 'Crystal' }])
  })

  it('leaves undefined for ids missing from game_versions', () => {
    const result = formatGamesForFiltering([])
    assert.equal(result.length, 18)
    assert.ok(
      result.every(([name, game]) => typeof name === 'string' && game === undefined)
    )
  })
})
