import { test } from 'node:test'
import assert from 'node:assert/strict'
import { diffCandidates, similarity } from '../src/bulbapedia/differ.js'

const sources = [
  { id: 'a', pokemonId: 360, name: 'Lavaridge Springs', description: 'Egg received from an old couple in Lavaridge Town.', gen: 3, source: 'gift' },
  { id: 'b', pokemonId: 360, name: 'Wild', description: null, gen: 0, source: 'wild' },
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
  const candidates = [{ pokemonId: 360, gen: 3, area: 'Wild' }]
  const { missing } = diffCandidates(candidates, sources)
  assert.equal(missing.length, 1)
})

test('gen-0 existing rows are eligible for any candidate gen', () => {
  const gameCorner = [{ id: 'd', pokemonId: 25, name: 'Game Corner', description: null, gen: 0, source: 'game-corner' }]
  const candidates = [{ pokemonId: 25, gen: 1, area: 'Game Corner prize' }]
  const { matched } = diffCandidates(candidates, gameCorner)
  assert.equal(matched.length, 1)
})
