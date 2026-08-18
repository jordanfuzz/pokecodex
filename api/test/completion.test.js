import './setup.js'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildRequiredSources, checkCompletion } from '../src/pokemon/completion.js'

// Minimal raw-row fixtures in the camelized shape getAllForUser sees.
const unown = {
  sourcesByType: [
    { id: 'src-a', type: 'variant', name: 'A', image: null, replaceDefault: false, firstGen: 2 },
    { id: 'src-b', type: 'variant', name: 'B', image: null, replaceDefault: false, firstGen: 2 },
    { id: 'src-wild', type: 'wild', name: 'Wild', image: null, replaceDefault: false, firstGen: 0 },
  ],
  usersSourcesByGen: [{ id: 'src-a', source: 'variant', name: 'A', gen: 2 }],
  usersSources: ['variant'],
  usersEvolutionSourceIds: [null],
}

describe('buildRequiredSources', () => {
  it('requires every row of a repeatable type, not just the type', () => {
    const required = buildRequiredSources(unown, ['variant'])
    assert.deepEqual(
      required.map(r => r.sourceId).sort(),
      ['src-a', 'src-b']
    )
  })

  it('marks per-row caught state', () => {
    const required = buildRequiredSources(unown, ['variant'])
    const byId = Object.fromEntries(required.map(r => [r.sourceId, r]))
    assert.deepEqual(byId['src-a'].caughtInGens, [2])
    assert.deepEqual(byId['src-b'].caughtInGens, [])
  })

  it('an override forces a normally-excluded source in', () => {
    const required = buildRequiredSources(unown, [], { 'src-wild': true })
    assert.deepEqual(required.map(r => r.sourceId), ['src-wild'])
    assert.equal(required[0].isOverridden, true)
  })

  it('an override excludes a normally-required source', () => {
    const required = buildRequiredSources(unown, ['variant'], { 'src-b': false })
    assert.deepEqual(required.map(r => r.sourceId), ['src-a'])
  })

  it('evolution-satisfiable rows are flagged when the evolution inherited them', () => {
    const abra = {
      sourcesByType: [
        { id: 'src-trade', type: 'npc-trade', name: 'Trade', image: null, replaceDefault: false, firstGen: 1 },
      ],
      usersSourcesByGen: [null],
      usersSources: [null],
      usersEvolutionSourceIds: ['src-trade'],
    }
    const required = buildRequiredSources(abra, ['npc-trade'])
    assert.equal(required[0].caughtViaEvolution, true)
  })
})

describe('checkCompletion', () => {
  it('one variant does not complete a record needing two (the Unown bug)', () => {
    const required = buildRequiredSources(unown, ['variant'])
    assert.equal(checkCompletion(unown, required), false)
  })

  it('all variants caught completes the record', () => {
    const caughtBoth = {
      ...unown,
      usersSourcesByGen: [
        { id: 'src-a', source: 'variant', name: 'A', gen: 2 },
        { id: 'src-b', source: 'variant', name: 'B', gen: 3 },
      ],
    }
    const required = buildRequiredSources(caughtBoth, ['variant'])
    assert.equal(checkCompletion(caughtBoth, required), true)
  })

  it('with no applicable rules, any catch completes the record', () => {
    assert.equal(checkCompletion(unown, []), true)
    const uncaught = { ...unown, usersSourcesByGen: [null], usersSources: [null] }
    assert.equal(checkCompletion(uncaught, []), false)
  })

  it('evolution-inherited sources satisfy their row', () => {
    const abra = {
      sourcesByType: [
        { id: 'src-trade', type: 'npc-trade', name: 'Trade', image: null, replaceDefault: false, firstGen: 1 },
      ],
      usersSourcesByGen: [{ id: 'src-other', source: 'wild', name: 'Wild', gen: 1 }],
      usersSources: ['wild'],
      usersEvolutionSourceIds: ['src-trade'],
    }
    const required = buildRequiredSources(abra, ['npc-trade'])
    assert.equal(checkCompletion(abra, required), true)
  })
})
