import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseEventEntries } from '../src/bulbapedia/events.js'

const FIXTURE = `===Magikarp===
A [[Magikarp salesman|salesman]] will offer a {{p|Magikarp}}.
{{Gen3ievent
|pokemon=Magikarp
|ndex=0129
|level=5
|ball=Poké
|met={{color2|000|Kanto Route 4|Route 4}}
|move1=Splash|move1type=Normal
|gift=yes
|method={{pkmn2|Gift}} ({{pdollar}}500)
|game=frlg
}}
{{G3event
|pokemon=Jirachi
|nick=JIRACHI
|level=5
|game=3r
|ndex=385
|obtain=pal
|distribution=no}}
{{SomeOtherTemplate|pokemon=Ignored because name lacks the keyword|x=1}}
{{Gen3ievent-related-nav}}`

test('parseEventEntries pulls every /event/ template with a pokemon param', () => {
  const entries = parseEventEntries(FIXTURE)
  assert.equal(entries.length, 2)
  const [magikarp, jirachi] = entries
  assert.equal(magikarp.template, 'Gen3ievent')
  assert.equal(magikarp.pokemon, 'Magikarp')
  assert.equal(magikarp.ndex, 129)
  assert.equal(magikarp.gift, true)
  assert.equal(magikarp.met, 'Route 4')
  assert.ok(magikarp.method.startsWith('Gift'))
  assert.equal(jirachi.ndex, 385)
  assert.equal(jirachi.gift, false)
})
