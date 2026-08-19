import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveGame, ROMAN } from '../src/bulbapedia/games.js'

test('resolveGame maps core games to game_versions ids and gens', () => {
  assert.deepEqual(resolveGame('FireRed'), { name: 'FireRed', tracked: true, id: 12, gen: 3 })
  assert.deepEqual(resolveGame("Let's Go Pikachu"), { name: "Let's Go Pikachu", tracked: true, id: 31, gen: 7 })
  assert.deepEqual(resolveGame('Black 2'), { name: 'Black 2', tracked: true, id: 21, gen: 5 })
})

test('resolveGame maps tracked spinoffs from the side-games section', () => {
  assert.deepEqual(resolveGame('Stadium 2'), { name: 'Stadium 2', tracked: true, id: 39, gen: 2 })
  assert.deepEqual(resolveGame('Ranger: SoA'), { name: 'Ranger: SoA', tracked: true, id: 44, gen: 4 })
})

test('resolveGame flags known-untracked games as expected', () => {
  assert.deepEqual(resolveGame('MD Red'), { name: 'MD Red', tracked: false, expected: true })
  assert.deepEqual(resolveGame('Pal Park'), { name: 'Pal Park', tracked: false, expected: true })
})

test('resolveGame maps recon-discovered v= aliases/typos to their tracked game', () => {
  assert.deepEqual(resolveGame('Box R&S'), { name: 'Box R&S', tracked: true, id: 41, gen: 3 })
  assert.deepEqual(resolveGame('Ranger: Soa'), { name: 'Ranger: Soa', tracked: true, id: 44, gen: 4 })
  assert.deepEqual(resolveGame('Rangers: GS'), { name: 'Rangers: GS', tracked: true, id: 45, gen: 4 })
})

test('resolveGame flags recon-discovered gen 8+/spinoff v= names as expected-untracked', () => {
  assert.deepEqual(resolveGame('Battle Trozei'), { name: 'Battle Trozei', tracked: false, expected: true })
  assert.deepEqual(resolveGame('Expansion Pass'), { name: 'Expansion Pass', tracked: false, expected: true })
  assert.deepEqual(resolveGame('Sword Expansion Pass'), { name: 'Sword Expansion Pass', tracked: false, expected: true })
  assert.deepEqual(resolveGame('The Hidden Treasure of Area Zero (Scarlet)'), { name: 'The Hidden Treasure of Area Zero (Scarlet)', tracked: false, expected: true })
  assert.deepEqual(resolveGame('Mega Dimension'), { name: 'Mega Dimension', tracked: false, expected: true })
  assert.deepEqual(resolveGame('Super MD'), { name: 'Super MD', tracked: false, expected: true })
  assert.deepEqual(resolveGame('Legends: Z-A'), { name: 'Legends: Z-A', tracked: false, expected: true })
  assert.deepEqual(resolveGame('Puzzle Challenge'), { name: 'Puzzle Challenge', tracked: false, expected: true })
  assert.deepEqual(resolveGame('Pokopia'), { name: 'Pokopia', tracked: false, expected: true })
})

test('resolveGame flags unknown names as unexpected (recon warning material)', () => {
  assert.deepEqual(resolveGame('Some Future Game'), { name: 'Some Future Game', tracked: false, expected: false })
})

test('ROMAN maps generation numerals', () => {
  assert.equal(ROMAN.VII, 7)
})
