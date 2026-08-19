import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseTrades } from '../src/bulbapedia/trades.js'

const FIXTURE = `====Pokémon Red and Green (Japan), Pokémon Red and Blue (Western)====
{| class="roundtable"
|- class="blacklinks"
! Location
! colspan="2" | Player's Pokémon
! colspan="2" | NPC's Pokémon
! English<br>[[nickname]]
|-
| {{rt|2|Kanto}}
| {{MSP/3|063|Abra}}
| {{p|Abra}}
| {{MSP/3|122|Mr. Mime}}
| {{p|Mr. Mime}}
| MARCEL
| {{j|バリバリ}}<br>''Baribari''
|-
| rowspan="2" style="background:#FFF" | {{OBP|Underground Path|Kanto Routes 5–6|Underground Path (Rt. 5–6)}}
| {{MSP/3|029|Nidoran♀}}
| {{p|Nidoran♀}}
| {{MSP/3|032|Nidoran♂}}
| {{p|Nidoran♂}}
| ''N/A''
|-
| {{MSP/3|032|Nidoran♂}}
| {{p|Nidoran♂}}
| {{MSP/3|029|Nidoran♀}}
| {{p|Nidoran♀}}
| SPOT
|}`

test('parseTrades extracts gives/receives/nickname per row', () => {
  const { trades, unparsed } = parseTrades(FIXTURE)
  assert.equal(unparsed.length, 0)
  assert.equal(trades.length, 3)
  const [abra] = trades
  assert.equal(abra.heading, 'Pokémon Red and Green (Japan), Pokémon Red and Blue (Western)')
  assert.deepEqual(abra.gives, { ndex: 63, name: 'Abra' })
  assert.deepEqual(abra.receives, { ndex: 122, name: 'Mr. Mime' })
  assert.equal(abra.nickname, 'MARCEL')
  assert.equal(abra.location, 'Route 2')
})

test('parseTrades carries location across rowspan rows and handles N/A nicknames', () => {
  const { trades } = parseTrades(FIXTURE)
  const [, female, male] = trades
  assert.equal(female.location, 'Underground Path (Rt. 5–6)')
  assert.equal(female.nickname, null)
  assert.equal(male.location, 'Underground Path (Rt. 5–6)')
  assert.equal(male.nickname, 'SPOT')
})
