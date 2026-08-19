import { test } from 'node:test'
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
