import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extractSection, parseGameLocations } from '../src/bulbapedia/availability.js'

const FIXTURE = `intro text
===Game locations===
{{Availability/Header|type=Psychic}}
{{Availability/Gen|gen=III}}
{{Availability/Entry2|v=Ruby|v2=Sapphire|t=FFF|t2=FFF|area=Hatch {{pkmn|Egg}} [[List of in-game event Pokémon in Pokémon Ruby and Sapphire#Wynaut|received]] from an old couple in [[Lavaridge Town]]<br>{{rt|130|Hoenn}} ({{gdis|Mirage Island|III}})}}
{{Availability/Entry1/None|v=Colosseum}}
|}
|}
{{Availability/Gen|gen=VII}}
{{Availability/Entry2/None|v=Sun|v2=Moon|area=[[Pokémon Bank]]}}
|}
|}
{{Availability/Footer}}

====In side games====
{{Availability/Header|type=Ground|type2=Flying}}
{{Availability/Gen|gen=II}}
{{Availability/Entry1|1|v=Stadium 2|color=000|t=FFF|area=Beat the {{ga|Silver|Rival}} at the end of {{DL|Pokémon Stadium 2|Round 2}}}}
|}
|}
<!--{{Availability/Entry1|v=MD Light|area=commented out}}-->

===Held items===
{{Availability/Entry1|v=Red|area=should not be parsed}}
`

test('extractSection pulls a heading-delimited section', () => {
  const section = extractSection(FIXTURE, 'Game locations')
  assert.ok(section.includes('Stadium 2'))
  assert.ok(!section.includes('should not be parsed'))
  assert.equal(extractSection(FIXTURE, 'No Such Section'), null)
})

test('parseGameLocations emits one entry per version with gen and cleaned area', () => {
  const { entries } = parseGameLocations(FIXTURE)
  const ruby = entries.find((entry) => entry.game === 'Ruby')
  assert.equal(ruby.gen, 3)
  assert.equal(ruby.subsection, 'core')
  assert.equal(ruby.none, false)
  assert.ok(ruby.area.startsWith('Hatch Egg received from an old couple in Lavaridge Town'))
  const sapphire = entries.find((entry) => entry.game === 'Sapphire')
  assert.equal(sapphire.rawArea, ruby.rawArea)
})

test('parseGameLocations marks /None entries and keeps their area', () => {
  const { entries } = parseGameLocations(FIXTURE)
  const sun = entries.find((entry) => entry.game === 'Sun')
  assert.equal(sun.none, true)
  assert.equal(sun.gen, 7)
  const colosseum = entries.find((entry) => entry.game === 'Colosseum')
  assert.equal(colosseum.none, true)
  assert.equal(colosseum.rawArea, '')
})

test('parseGameLocations walks side-games subsection with its own gens', () => {
  const { entries } = parseGameLocations(FIXTURE)
  const stadium = entries.find((entry) => entry.game === 'Stadium 2')
  assert.equal(stadium.subsection, 'in side games')
  assert.equal(stadium.gen, 2)
  assert.equal(stadium.gameInfo.id, 39)
  assert.equal(stadium.area, 'Beat the Rival at the end of Round 2')
})

test('parseGameLocations ignores commented-out entries and missing section', () => {
  const { entries } = parseGameLocations(FIXTURE)
  assert.ok(!entries.some((entry) => entry.game === 'MD Light'))
  const empty = parseGameLocations('no locations here')
  assert.deepEqual(empty.entries, [])
  assert.equal(empty.warnings.length, 1)
})
