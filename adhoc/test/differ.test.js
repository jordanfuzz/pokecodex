import { test, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { diffCandidates, similarity } from '../src/bulbapedia/differ.js'

const sources = [
  { id: 'a', pokemonId: 360, name: 'Lavaridge Springs', description: 'Egg received from an old couple in Lavaridge Town.', gen: 3, source: 'gift' },
  { id: 'b', pokemonId: 360, name: 'Wild Grass', description: null, gen: 0, source: 'wild' },
  { id: 'c', pokemonId: 207, name: 'Ghost Tower', description: 'Old hand-entered row that Bulbapedia does not corroborate.', gen: 2, source: 'gift' },
]

test('similarity is token overlap over the smaller set', () => {
  assert.equal(similarity('Lavaridge Town egg', 'egg received in Lavaridge Town'), 1)
  assert.equal(similarity('completely different', 'no shared words'), 0)
})

test('diffCandidates matches candidates to existing rows by pokemon, gen, and text', () => {
  const candidates = [
    { pokemonId: 360, gen: 3, area: 'Hatch Egg received from an old couple in Lavaridge Town' },
    { pokemonId: 207, gen: 2, area: 'Beat the Rival at the end of Round 2' },
  ]
  const { matched, missing, unmatchedExisting } = diffCandidates(candidates, sources)
  assert.equal(matched.length, 1)
  assert.equal(matched[0].source.id, 'a')
  assert.equal(missing.length, 1)
  assert.equal(missing[0].pokemonId, 207)
  assert.deepEqual(unmatchedExisting.map((source) => source.id), ['c'])
})

test('diffCandidates never matches against non-unique source types', () => {
  // area and source b's name are both 2-token and identical, so similarity
  // would be 1.0 if the UNIQUE_SOURCE_TYPES filter weren't applied — this
  // pins the type filter rather than accidentally passing via the min-token
  // guard (a 1-token area like 'Wild' scores 0 regardless of the filter).
  const candidates = [{ pokemonId: 360, gen: 3, area: 'Wild Grass' }]
  const { missing } = diffCandidates(candidates, sources)
  assert.equal(missing.length, 1)
})

test('gen-0 existing rows are eligible for any candidate gen', () => {
  const gameCorner = [{ id: 'd', pokemonId: 25, name: 'Game Corner', description: null, gen: 0, source: 'game-corner' }]
  const candidates = [{ pokemonId: 25, gen: 1, area: 'Game Corner prize' }]
  const { matched } = diffCandidates(candidates, gameCorner)
  assert.equal(matched.length, 1)
})

test('similarity requires at least 2 tokens per side to avoid single-word over-matching', () => {
  assert.equal(similarity('Fossil', 'Claw Fossil obtained at the museum'), 0)
})

test('diffCandidates does not match a single-token source name against unrelated area text', () => {
  const fossilSources = [{ id: 'e', pokemonId: 138, name: 'Fossil', description: null, gen: 3, source: 'fossil' }]
  const candidates = [{ pokemonId: 138, gen: 3, area: 'Revive from Claw Fossil obtained at the Mt. Chimney excavation site' }]
  const { missing, unmatchedExisting } = diffCandidates(candidates, fossilSources)
  assert.equal(missing.length, 1)
  assert.deepEqual(unmatchedExisting.map((source) => source.id), ['e'])
})

test('diffCandidates breaks equal-score ties by lexicographically smaller source id', () => {
  const tiedSources = [
    { id: 'b', pokemonId: 999, name: 'Mystery Gift', description: 'Received via wireless communication', gen: 4, source: 'event' },
    { id: 'a', pokemonId: 999, name: 'Mystery Gift', description: 'Received via wireless communication', gen: 4, source: 'event' },
  ]
  const candidates = [{ pokemonId: 999, gen: 4, area: 'Mystery Gift received via wireless communication' }]
  const { matched } = diffCandidates(candidates, tiedSources)
  assert.equal(matched.length, 1)
  assert.equal(matched[0].source.id, 'a')
})

test('diffCandidates lets multiple same-gen candidates legitimately match one source (e.g. Ruby+Sapphire rows of one gift)', () => {
  const oneGift = [{ id: 'f', pokemonId: 380, name: 'Egg Move', description: 'Received as an egg from the old man in Lavaridge', gen: 3, source: 'gift' }]
  const candidates = [
    { pokemonId: 380, gen: 3, area: 'Ruby: Received as an egg from the old man in Lavaridge' },
    { pokemonId: 380, gen: 3, area: 'Sapphire: Received as an egg from the old man in Lavaridge' },
  ]
  const { matched, unmatchedExisting } = diffCandidates(candidates, oneGift)
  assert.equal(matched.length, 2)
  assert.equal(matched[0].source.id, matched[1].source.id)
  assert.deepEqual(unmatchedExisting, [])
})

describe('nickname matching', () => {
  const source = { id: 's1', pokemonId: 122, name: 'Marcel', description: 'FRLG trade', gen: 1, source: 'npc-trade' }
  const candidate = {
    pokemonId: 122, gen: 1, area: 'In-game trade: receive Mr. Mime for Abra',
    origin: 'trades', reasons: ['npc trade'], nickname: 'Marcel',
  }

  it('an exact nickname hit is a full match with matchKind nickname', () => {
    const { matched, missing, unmatchedExisting } = diffCandidates([candidate], [source])
    assert.equal(matched.length, 1)
    assert.equal(matched[0].matchKind, 'nickname')
    assert.equal(matched[0].source.id, 's1')
    assert.equal(missing.length, 0)
    assert.equal(unmatchedExisting.length, 0)
  })

  it('nickname matching normalizes case and punctuation', () => {
    const dotted = { ...source, name: 'ms. nido' }
    const { matched } = diffCandidates([{ ...candidate, nickname: 'Ms. Nido' }], [dotted])
    assert.equal(matched.length, 1)
    assert.equal(matched[0].matchKind, 'nickname')
  })

  it('a token-overlap nickname near-miss becomes a suggestion, not a match', () => {
    // area/description deliberately share zero tokens so only the nickname
    // fallback can propose the pairing.
    const renamed = { ...source, name: 'Marcel the Mime', description: null }
    const { matched, missing, suggestions } = diffCandidates(
      [{ ...candidate, nickname: 'Marcel Mime', area: 'Cerulean City swap' }], [renamed])
    assert.equal(matched.length, 0)
    assert.equal(missing.length, 1)
    assert.equal(suggestions.length, 1)
    assert.equal(suggestions[0].reason, 'nickname')
  })
})

describe('suggestion band', () => {
  it('a sub-threshold fuzzy score in [floor, threshold) is suggested', () => {
    // 1 shared token of 4/5 -> score 0.25: below 0.34, above 0.15
    const source = { id: 's2', pokemonId: 1, name: 'Celadon Mansion visitor gift', description: null, gen: 1, source: 'gift' }
    const candidate = { pokemonId: 1, gen: 1, area: 'Received from woman inside Celadon', origin: 'availability', reasons: ['gift language'], nickname: null }
    const { missing, suggestions } = diffCandidates([candidate], [source])
    assert.equal(missing.length, 1)
    assert.equal(suggestions.length, 1)
    assert.match(suggestions[0].reason, /^fuzzy:0\.2/)
  })

  it('1-token names zeroed by the min-token guard can still suggest', () => {
    const source = { id: 's3', pokemonId: 140, name: 'Fossil', description: null, gen: 1, source: 'fossil' }
    const candidate = { pokemonId: 140, gen: 1, area: 'Fossil revived (Cinnabar)', origin: 'availability', reasons: ['fossil'], nickname: null }
    const { matched, suggestions } = diffCandidates([candidate], [source])
    assert.equal(matched.length, 0) // strict guard still blocks the match
    assert.equal(suggestions.length, 1)
    assert.match(suggestions[0].reason, /^fuzzy-short:/)
  })

  it('fuzzy matches at/above threshold carry matchKind fuzzy', () => {
    const source = { id: 's4', pokemonId: 130, name: 'Red Gyarados', description: 'Lake of Rage static', gen: 2, source: 'static-default' }
    const candidate = { pokemonId: 130, gen: 2, area: 'Lake of Rage (Red Gyarados, only one)', origin: 'availability', reasons: ['explicit only-one'], nickname: null }
    const { matched } = diffCandidates([candidate], [source])
    assert.equal(matched.length, 1)
    assert.equal(matched[0].matchKind, 'fuzzy')
  })
})
