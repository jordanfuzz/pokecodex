import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  collectPokemonCandidates,
  collectAuxCandidates,
  collectTradeCandidates,
  auxGen,
} from '../src/bulbapedia/collect.js'

const page = (wikitext) => ({ title: 'Testmon (Pokémon)', revid: 12345, wikitext })

const AVAILABILITY_PAGE = `
==Game locations==
{{Availability
|gen1=yes
}}
{{Availability/Gen|gen=I}}
{{Availability/Entry1|v=Red|area=[[Celadon City]] (gift)}}
{{Availability/Entry1|v=Blue|area=[[Celadon City]] (gift)}}
{{Availability/Entry1|v=Yellow|area=[[Route 24]]}}
`

describe('collectPokemonCandidates', () => {
  it('emits unique candidates with provenance and tallies generics', () => {
    const { candidates, tallies } = collectPokemonCandidates('0004-charmander.json', page(AVAILABILITY_PAGE))
    assert.equal(candidates.length, 2) // Red + Blue gift; Yellow wild is generic
    assert.deepEqual(candidates.map((c) => c.game), ['Red', 'Blue'])
    const [red] = candidates
    assert.equal(red.pokemonId, 4)
    assert.equal(red.gen, 1)
    assert.equal(red.origin, 'availability')
    assert.equal(red.pageTitle, 'Testmon (Pokémon)')
    assert.equal(red.revid, 12345)
    assert.match(red.rawArea, /Celadon City/)
    assert.equal(red.nickname, null)
    assert.ok(tallies.generic >= 1)
  })
})

describe('collectAuxCandidates', () => {
  it('maps event entries with the filename-derived gen', () => {
    const wikitext = '{{eventpoke|pokemon=Pikachu|ndex=25|game=OR|method=Gift|met=Contest Hall}}'
    const { candidates } = collectAuxCandidates(
      'list-of-in-game-event-pok-mon-omega-ruby-and-alpha-sapphire.json',
      page(wikitext)
    )
    assert.equal(candidates.length, 1)
    assert.equal(candidates[0].pokemonId, 25)
    assert.equal(candidates[0].gen, 6)
    assert.equal(candidates[0].origin, 'event-list')
    assert.equal(candidates[0].area, 'Gift — Contest Hall')
    assert.equal(candidates[0].revid, 12345)
  })

  it('warns on an unknown gen mapping instead of guessing', () => {
    const { candidates, warnings } = collectAuxCandidates('list-of-something-unknown.json', page(''))
    assert.equal(candidates.length, 0)
    assert.equal(warnings.length, 1)
  })
})

describe('collectTradeCandidates', () => {
  const trade = (heading, extra = {}) => ({
    heading,
    location: 'Vermilion City',
    gives: { ndex: 63, name: 'Abra' },
    receives: { ndex: 122, name: 'Mr. Mime' },
    nickname: 'Marcel',
    ...extra,
  })

  it('maps a trade to an npc-trade candidate with gen from the heading', () => {
    const { candidates } = collectTradeCandidates([trade('Red and Blue')], page(''))
    assert.equal(candidates.length, 1)
    const [c] = candidates
    assert.equal(c.pokemonId, 122)
    assert.equal(c.gen, 1)
    assert.equal(c.origin, 'trades')
    assert.equal(c.nickname, 'Marcel')
    assert.match(c.area, /Mr\. Mime/)
    assert.match(c.area, /Vermilion City/)
  })

  it('warns on an unknown heading instead of dropping silently', () => {
    const { candidates, warnings } = collectTradeCandidates([trade('Mystery Game')], page(''))
    assert.equal(candidates.length, 0)
    assert.equal(warnings.length, 1)
  })

  it('maps out-of-scope headings to gen 8/9 rather than warning', () => {
    const { candidates, warnings } = collectTradeCandidates([trade('Sword and Shield')], page(''))
    assert.equal(candidates[0].gen, 8)
    assert.equal(warnings.length, 0)
  })
})

describe('auxGen', () => {
  it('does not substring-match generation-i into generation-ii', () => {
    assert.equal(auxGen('list-of-game-based-distributions-generation-ii.json'), 2)
    assert.equal(auxGen('list-of-game-based-distributions-generation-i.json'), 1)
  })
})
