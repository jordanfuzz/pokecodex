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

test('resolveGame flags unknown names as unexpected (recon warning material)', () => {
  assert.deepEqual(resolveGame('Some Future Game'), { name: 'Some Future Game', tracked: false, expected: false })
})

test('ROMAN maps generation numerals', () => {
  assert.equal(ROMAN.VII, 7)
})
