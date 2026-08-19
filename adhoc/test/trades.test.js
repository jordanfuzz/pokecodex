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

test('parseTrades sends single-pokemon rows to unparsed, not silently dropped', () => {
  const wikitext = `====Pokémon X and Y====
{| class="roundtable"
|-
! Location
! Pokémon
|-
| {{rt|1|Kalos}}
| {{MSP/6|001|Bunnelby}}
|}`
  const { trades, unparsed } = parseTrades(wikitext)
  assert.equal(trades.length, 0)
  assert.equal(unparsed.length, 1)
  assert.equal(unparsed[0].heading, 'Pokémon X and Y')
  assert.match(unparsed[0].rowText, /MSP\/6/)
})

test('parseTrades handles MSP/6 templates with a proper-case nickname (gen 6+)', () => {
  const wikitext = `====Pokémon X and Y====
{| class="roundtable"
|-
! Location
! Player's Pokémon
! NPC's Pokémon
! Nickname
|-
| {{OBP|Santalune City|Kalos Santalune City|Santalune City}}
| {{MSP/6|659|Bunnelby}}
| {{p|Bunnelby}}
| {{MSP/6|083|Farfetch'd}}
| {{p|Farfetch'd}}
| Quacklin'
|}`
  const { trades, unparsed } = parseTrades(wikitext)
  assert.equal(unparsed.length, 0)
  assert.equal(trades.length, 1)
  const [trade] = trades
  assert.equal(trade.location, 'Santalune City')
  assert.deepEqual(trade.gives, { ndex: 659, name: 'Bunnelby' })
  assert.deepEqual(trade.receives, { ndex: 83, name: "Farfetch'd" })
  assert.equal(trade.nickname, "Quacklin'")
})

test('parseTrades picks the plain-text nickname over species+gender, Japanese, item, and image cells', () => {
  const wikitext = `====Pokémon Diamond and Pearl====
{| class="roundtable"
|-
! Location
! Player's Pokémon
! NPC's Pokémon
! Nickname
! Japanese Nickname
! Held Item
! OT
|-
| {{OBP|Route 210|Sinnoh Route 210|Route 210}}
| {{MSP/4|095|Onix}}
| {{p|Onix}}{{male}}
| {{MSP/4|208|Steelix}}
| {{p|Steelix}}
| Rocky
| {{j|ロッキー}}
| [[Bitter Berry]]
| [[File:Foo.png|50px]]
|}`
  const { trades, unparsed } = parseTrades(wikitext)
  assert.equal(unparsed.length, 0)
  assert.equal(trades.length, 1)
  assert.equal(trades[0].nickname, 'Rocky')
})

test('parseTrades falls back to null when every nickname-ish cell carries markup', () => {
  const wikitext = `====Pokémon Diamond and Pearl====
{| class="roundtable"
|-
! Location
! Player's Pokémon
! NPC's Pokémon
! Japanese Nickname
! Held Item
|-
| {{OBP|Route 210|Sinnoh Route 210|Route 210}}
| {{MSP/4|100|Voltorb}}
| {{p|Voltorb}}
| {{MSP/4|101|Electrode}}
| {{p|Electrode}}
| {{j|ボルトロス}}
| [[Berry]]
|}`
  const { trades, unparsed } = parseTrades(wikitext)
  assert.equal(unparsed.length, 0)
  assert.equal(trades.length, 1)
  assert.equal(trades[0].nickname, null)
})
