import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classifyEntry } from '../src/bulbapedia/classify.js'

const entry = (overrides) => ({
  game: 'Emerald',
  gameInfo: { name: 'Emerald', tracked: true, id: 9, gen: 3 },
  gen: 3,
  subsection: 'core',
  none: false,
  rawArea: '',
  area: '',
  ...overrides,
})

test('none rows are unavailable regardless of area text', () => {
  const result = classifyEntry(entry({ none: true, area: 'Trade, Event' }))
  assert.equal(result.kind, 'unavailable')
})

test('untracked games are set aside', () => {
  const result = classifyEntry(entry({ game: 'MD Red', gameInfo: { name: 'MD Red', tracked: false, expected: true } }))
  assert.equal(result.kind, 'untracked-game')
})

test('event-list links and gift language are unique candidates', () => {
  const gift = classifyEntry(entry({
    rawArea: 'Hatch {{pkmn|Egg}} [[List of in-game event Pokémon in Pokémon Emerald#Wynaut|received]] from an old couple',
    area: 'Hatch Egg received from an old couple in Lavaridge Town',
  }))
  assert.equal(gift.kind, 'unique-candidate')
  assert.ok(gift.reasons.includes('links to event list'))

  const trade = classifyEntry(entry({ area: 'In-game trade with an NPC on Route 226' }))
  assert.equal(trade.kind, 'unique-candidate')
})

test('wild-style rows are generic', () => {
  assert.equal(classifyEntry(entry({ area: 'Route 130 (Mirage Island)' })).kind, 'generic')
  assert.equal(classifyEntry(entry({ area: 'Breed Wobbuffet holding a Lax Incense' })).kind, 'generic')
  assert.equal(classifyEntry(entry({ area: 'Hammerlocke Hills (Max Raid Battle)' })).kind, 'generic')
})

test('side-game prize language is a unique candidate (Stadium 2 Gligar)', () => {
  const result = classifyEntry(entry({
    subsection: 'in side games',
    game: 'Stadium 2',
    gameInfo: { name: 'Stadium 2', tracked: true, id: 39, gen: 2 },
    gen: 2,
    area: 'Beat the Rival at the end of Round 2',
  }))
  assert.equal(result.kind, 'unique-candidate')
})
