import './setup.js'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildRequiredSources, checkCompletion } from '../src/pokemon/completion.js'

// Minimal raw-row fixtures in the camelized shape getAllForUser sees.
const unown = {
  sourcesByType: [
    {
      id: 'src-a',
      type: 'variant',
      name: 'A',
      image: null,
      replaceDefault: false,
      firstGen: 2,
    },
    {
      id: 'src-b',
      type: 'variant',
      name: 'B',
      image: null,
      replaceDefault: false,
      firstGen: 2,
    },
    {
      id: 'src-wild',
      type: 'wild',
      name: 'Wild',
      image: null,
      replaceDefault: false,
      firstGen: 0,
    },
  ],
  usersSourcesByGen: [{ id: 'src-a', source: 'variant', name: 'A', gen: 2 }],
  usersSources: ['variant'],
  usersEvolutionSourceIds: [null],
}

describe('buildRequiredSources', () => {
  it('requires every row of a repeatable type, not just the type', () => {
    const required = buildRequiredSources(unown, ['variant'])
    assert.deepEqual(required.map(r => r.sourceId).sort(), ['src-a', 'src-b'])
  })

  it('marks per-row caught state', () => {
    const required = buildRequiredSources(unown, ['variant'])
    const byId = Object.fromEntries(required.map(r => [r.sourceId, r]))
    assert.deepEqual(
      byId['src-a'].caughtIn.map(c => c.gen),
      [2]
    )
    assert.deepEqual(byId['src-b'].caughtIn, [])
  })

  it('an override forces a normally-excluded source in', () => {
    const required = buildRequiredSources(unown, [], { 'src-wild': true })
    assert.deepEqual(
      required.map(r => r.sourceId),
      ['src-wild']
    )
    assert.equal(required[0].isOverridden, true)
  })

  it('an override excludes a normally-required source', () => {
    const required = buildRequiredSources(unown, ['variant'], { 'src-b': false })
    assert.deepEqual(
      required.map(r => r.sourceId),
      ['src-a']
    )
  })

  it('evolution-satisfiable rows are flagged when the evolution inherited them', () => {
    const abra = {
      sourcesByType: [
        {
          id: 'src-trade',
          type: 'npc-trade',
          name: 'Trade',
          image: null,
          replaceDefault: false,
          firstGen: 1,
        },
      ],
      usersSourcesByGen: [null],
      usersSources: [null],
      usersEvolutionSourceIds: ['src-trade'],
    }
    const required = buildRequiredSources(abra, ['npc-trade'])
    assert.equal(required[0].caughtViaEvolution, true)
  })

  it('an inherited wild source does not satisfy the wild rule (wild is not evolution-satisfiable)', () => {
    const wildEvolved = {
      sourcesByType: [
        {
          id: 'src-wild',
          type: 'wild',
          name: 'Wild',
          image: null,
          replaceDefault: false,
          firstGen: 0,
        },
      ],
      usersSourcesByGen: [null],
      usersSources: [null],
      usersEvolutionSourceIds: ['src-wild'],
    }
    const required = buildRequiredSources(wildEvolved, ['wild'])
    assert.equal(required[0].caughtViaEvolution, false)
    assert.equal(checkCompletion(wildEvolved, required), false)
  })

  it('two catches of one source in different games of the same gen stay separate caughtIn entries', () => {
    const twoGames = {
      ...unown,
      usersSourcesByGen: [
        { id: 'src-a', source: 'variant', name: 'A', gen: 2, gameId: 4 },
        { id: 'src-a', source: 'variant', name: 'A', gen: 2, gameId: 5 },
      ],
    }
    const required = buildRequiredSources(twoGames, ['variant'])
    const entry = required.find(r => r.sourceId === 'src-a')
    assert.equal(entry.caughtIn.length, 2)
    assert.deepEqual(
      entry.caughtIn.map(c => c.gameId),
      [4, 5]
    )
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
        {
          id: 'src-trade',
          type: 'npc-trade',
          name: 'Trade',
          image: null,
          replaceDefault: false,
          firstGen: 1,
        },
      ],
      usersSourcesByGen: [{ id: 'src-other', source: 'wild', name: 'Wild', gen: 1 }],
      usersSources: ['wild'],
      usersEvolutionSourceIds: ['src-trade'],
    }
    const required = buildRequiredSources(abra, ['npc-trade'])
    assert.equal(checkCompletion(abra, required), true)
  })
})

describe('auto-computed home region', () => {
  const tangela = {
    originalGen: 1,
    homeRegion: 'Kanto',
    sourcesByType: [
      {
        id: 'src-original',
        type: 'original',
        name: 'From home region',
        image: null,
        replaceDefault: false,
        firstGen: 1,
      },
    ],
    usersSourcesByGen: [null],
    usersSources: [null],
    usersEvolutionSourceIds: [null],
    usersCatches: [],
  }

  it('a catch in a home game satisfies the original source', () => {
    const mon = {
      ...tangela,
      usersCatches: [
        { gameId: 1, gen: 1, region: 'Kanto', isolationGroup: null, transferGen: null },
      ],
    }
    const required = buildRequiredSources(mon, ['original'])
    assert.equal(required[0].caughtIn.length, 1)
    assert.equal(checkCompletion(mon, required), true)
  })

  it('same gen but wrong region does not satisfy it', () => {
    // e.g. a Sinnoh pokemon caught in Soul Silver (gen 4, Johto)
    const mon = {
      ...tangela,
      originalGen: 4,
      homeRegion: 'Sinnoh',
      usersCatches: [
        { gameId: 18, gen: 4, region: 'Johto', isolationGroup: null, transferGen: null },
      ],
    }
    const required = buildRequiredSources(mon, ['original'])
    assert.equal(required[0].caughtIn.length, 0)
    assert.equal(checkCompletion(mon, required), false)
  })

  it('right region but wrong gen (a remake) does not satisfy it', () => {
    const mon = {
      ...tangela,
      usersCatches: [
        { gameId: 12, gen: 3, region: 'Kanto', isolationGroup: null, transferGen: null },
      ],
    }
    const required = buildRequiredSources(mon, ['original'])
    assert.equal(required[0].caughtIn.length, 0)
  })

  it('stored original links are ignored — only catches count', () => {
    const mon = {
      ...tangela,
      usersSourcesByGen: [
        { id: 'src-original', source: 'original', name: 'From home region', gen: 1 },
      ],
      usersCatches: [],
    }
    const required = buildRequiredSources(mon, ['original'])
    assert.equal(required[0].caughtIn.length, 0)
    assert.equal(checkCompletion(mon, required), false)
  })

  it('null-region games never qualify', () => {
    const mon = {
      ...tangela,
      homeRegion: null,
      usersCatches: [
        { gameId: 40, gen: 1, region: null, isolationGroup: null, transferGen: null },
      ],
    }
    const required = buildRequiredSources(mon, ['original'])
    assert.equal(required[0].caughtIn.length, 0)
  })
})
