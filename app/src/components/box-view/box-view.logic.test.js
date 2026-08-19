import { describe, it, expect } from 'vitest'
import {
  transferPathOk,
  catchSatisfiesBox,
  completeRecordsForVersion,
  isShownInBox,
  filterPokemonForVersion,
} from './box-view.logic'

const normalCatch = (gen, extra = {}) => ({
  gameId: 1,
  gen,
  isolationGroup: null,
  transferGen: null,
  ...extra,
})
const version = (generationId, extra = {}) => ({
  id: 99,
  generationId,
  isolationGroup: null,
  ...extra,
})

describe('transferPathOk', () => {
  it('allows same or forward gens from 3 onward', () => {
    expect(transferPathOk(3, 3)).toBe(true)
    expect(transferPathOk(3, 4)).toBe(true)
    expect(transferPathOk(4, 3)).toBe(false)
  })
  it('allows gen 1-2 movement but never into gen 3+', () => {
    expect(transferPathOk(1, 2)).toBe(true)
    expect(transferPathOk(2, 2)).toBe(true)
    expect(transferPathOk(1, 7)).toBe(false)
    expect(transferPathOk(2, 3)).toBe(false)
  })
})

describe('catchSatisfiesBox', () => {
  it('uses the gen rule for normal games', () => {
    expect(catchSatisfiesBox(normalCatch(3), version(5))).toBe(true)
    expect(catchSatisfiesBox(normalCatch(1), version(3))).toBe(false)
  })

  it('an isolated box only accepts catches from its own group', () => {
    const letsGoBox = version(7, { isolationGroup: 'lets-go' })
    expect(
      catchSatisfiesBox(
        normalCatch(7, { isolationGroup: 'lets-go', transferGen: 8 }),
        letsGoBox
      )
    ).toBe(true)
    expect(catchSatisfiesBox(normalCatch(7), letsGoBox)).toBe(false)
    expect(catchSatisfiesBox(normalCatch(3), letsGoBox)).toBe(false)
  })

  it('colosseum and xd are separate groups', () => {
    const colCatch = normalCatch(3, { isolationGroup: 'colosseum' })
    expect(catchSatisfiesBox(colCatch, version(3, { isolationGroup: 'xd' }))).toBe(false)
    expect(
      catchSatisfiesBox(colCatch, version(3, { isolationGroup: 'colosseum' }))
    ).toBe(true)
  })

  it("a Let's Go catch skips gen 7 boxes but reaches gen 8 via Home", () => {
    const lgCatch = normalCatch(7, { isolationGroup: 'lets-go', transferGen: 8 })
    expect(catchSatisfiesBox(lgCatch, version(7))).toBe(false)
    expect(catchSatisfiesBox(lgCatch, version(8))).toBe(true)
  })

  it('a colosseum catch works in normal gen 3+ boxes (trades out to GBA)', () => {
    const colCatch = normalCatch(3, { isolationGroup: 'colosseum' })
    expect(catchSatisfiesBox(colCatch, version(3))).toBe(true)
    expect(catchSatisfiesBox(colCatch, version(4))).toBe(true)
  })
})

describe('completeRecordsForVersion', () => {
  it('finds the records for the selected game, defaulting to empty', () => {
    const boxData = [{ gameId: 3, completeRecords: ['25'] }]
    expect(completeRecordsForVersion(boxData, { id: 3 })).toEqual(['25'])
    expect(completeRecordsForVersion(boxData, { id: 4 })).toEqual([])
    expect(completeRecordsForVersion(null, { id: 3 })).toEqual([])
  })
})

describe('isShownInBox', () => {
  const mon = { recordKey: '25', isCaught: true }
  it('needs both a valid catch and a checked record', () => {
    expect(isShownInBox(mon, ['25'])).toBe(true)
    expect(isShownInBox({ ...mon, isCaught: false }, ['25'])).toBe(false)
    expect(isShownInBox(mon, [])).toBe(false)
  })
})

describe('filterPokemonForVersion', () => {
  const entry = (overrides = {}) => ({
    sourceId: 's1',
    name: 'Variant A',
    type: 'variant',
    firstGen: 1,
    replaceDefault: false,
    caughtIn: [],
    caughtViaEvolution: false,
    isOverridden: false,
    ...overrides,
  })
  const mon = (id, overrides = {}) => ({
    id,
    name: `mon-${id}`,
    type1: 'grass',
    defaultImage: `default-${id}.png`,
    imagesBySource: [],
    requiredSources: [],
    usersCatches: [],
    ...overrides,
  })
  const boxVersion = (overrides = {}) => ({
    id: 99,
    generationId: 4,
    isolationGroup: null,
    dexLimit: null,
    limitedDex: null,
    addMeltanLine: false,
    ignoreGender: false,
    ignoreRegionalVariants: false,
    ...overrides,
  })

  it('applies dexLimit as a slice and limitedDex as an id filter', () => {
    const mons = [mon(1), mon(2), mon(3)]
    expect(
      filterPokemonForVersion(mons, boxVersion({ dexLimit: 2 })).map(r => r.id)
    ).toEqual([1, 2])
    expect(
      filterPokemonForVersion(mons, boxVersion({ limitedDex: [3, 1] })).map(r => r.id)
    ).toEqual([1, 3])
  })

  it('appends the Meltan line when the version asks for it', () => {
    const mons = [mon(1), mon(808), mon(809)]
    const rows = filterPokemonForVersion(
      mons,
      boxVersion({ dexLimit: 1, addMeltanLine: true })
    )
    expect(rows.map(r => r.id)).toEqual([1, 808, 809])
  })

  it('gates gender and regional rows on the version flags; variants always make rows', () => {
    const mons = [
      mon(1, {
        requiredSources: [
          entry({ sourceId: 'm', type: 'male' }),
          entry({ sourceId: 'r', type: 'regional' }),
          entry({ sourceId: 'v', type: 'variant' }),
        ],
      }),
    ]
    const all = filterPokemonForVersion(mons, boxVersion())
    expect(all.map(r => r.recordKey)).toEqual(['1', '1:m', '1:r', '1:v'])

    const gated = filterPokemonForVersion(
      mons,
      boxVersion({ ignoreGender: true, ignoreRegionalVariants: true })
    )
    expect(gated.map(r => r.recordKey)).toEqual(['1', '1:v'])
  })

  it('non-standard source types only make rows when the user forced them in', () => {
    const mons = [
      mon(1, {
        requiredSources: [
          entry({ sourceId: 'sh', type: 'shiny' }),
          entry({ sourceId: 'ov', type: 'shiny', isOverridden: true }),
        ],
      }),
    ]
    const rows = filterPokemonForVersion(mons, boxVersion())
    expect(rows.map(r => r.recordKey)).toEqual(['1', '1:ov'])
  })

  it('drops rows whose source first appears after the box game\u2019s gen', () => {
    const mons = [
      mon(1, {
        requiredSources: [
          entry({ sourceId: 'old', firstGen: 4 }),
          entry({ sourceId: 'new', firstGen: 5 }),
        ],
      }),
    ]
    const rows = filterPokemonForVersion(mons, boxVersion({ generationId: 4 }))
    expect(rows.map(r => r.recordKey)).toEqual(['1', '1:old'])
  })

  it('a replace-default entry drops the base row', () => {
    const mons = [
      mon(1, { requiredSources: [entry({ sourceId: 'rd', replaceDefault: true })] }),
    ]
    const rows = filterPokemonForVersion(mons, boxVersion())
    expect(rows.map(r => r.recordKey)).toEqual(['1:rd'])
  })

  it('marks rows caught per version using the transfer rules', () => {
    const gen2Catch = { gameId: 4, gen: 2, isolationGroup: null, transferGen: null }
    const gen4Catch = { gameId: 14, gen: 4, isolationGroup: null, transferGen: null }
    const mons = [
      mon(1, {
        usersCatches: [gen2Catch],
        requiredSources: [entry({ sourceId: 's1', caughtIn: [gen4Catch] })],
      }),
    ]
    const rows = filterPokemonForVersion(mons, boxVersion({ generationId: 4 }))
    const base = rows.find(r => r.recordKey === '1')
    const variant = rows.find(r => r.recordKey === '1:s1')
    expect(base.isCaught).toBe(false) // gen 2 never reaches a gen 4 box
    expect(variant.isCaught).toBe(true)
  })

  it('source rows take their variant image, falling back to the default', () => {
    const mons = [
      mon(1, {
        imagesBySource: [['Variant A', 'a.png']],
        requiredSources: [
          entry({ sourceId: 'a', name: 'Variant A' }),
          entry({ sourceId: 'b', name: 'Variant B' }),
        ],
      }),
    ]
    const rows = filterPokemonForVersion(mons, boxVersion())
    expect(rows.find(r => r.recordKey === '1:a').image).toBe('a.png')
    expect(rows.find(r => r.recordKey === '1:b').image).toBe('default-1.png')
    expect(rows.find(r => r.recordKey === '1').image).toBe('default-1.png')
  })
})
