import { describe, it, expect } from 'vitest'
import {
  transferPathOk,
  catchSatisfiesBox,
  completeRecordsForVersion,
  isShownInBox,
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
