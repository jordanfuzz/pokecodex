import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseTemplate, extractTemplates, cleanWikitext } from '../src/bulbapedia/wikitext.js'

test('parseTemplate splits named params', () => {
  const { name, params } = parseTemplate('Availability/Entry1|v=Emerald|t=FFF|area=Hatch')
  assert.equal(name, 'Availability/Entry1')
  assert.equal(params.v, 'Emerald')
  assert.equal(params.area, 'Hatch')
})

test('parseTemplate keeps positional params 1-indexed', () => {
  const { params } = parseTemplate('rt|130|Hoenn')
  assert.equal(params[1], '130')
  assert.equal(params[2], 'Hoenn')
})

test('parseTemplate mixes positional and named (Gligar Stadium 2 entry)', () => {
  const { params } = parseTemplate('Availability/Entry1|1|v=Stadium 2|color=000|area=Beat the rival')
  assert.equal(params[1], '1')
  assert.equal(params.v, 'Stadium 2')
})

test('parseTemplate ignores pipes inside nested templates and links', () => {
  const { params } = parseTemplate('Availability/Entry2|v=Ruby|v2=Sapphire|area={{rt|130|Hoenn}} ({{gdis|Mirage Island|III}}) [[a|b]]')
  assert.equal(params.v2, 'Sapphire')
  assert.equal(params.area, '{{rt|130|Hoenn}} ({{gdis|Mirage Island|III}}) [[a|b]]')
})

test('parseTemplate treats = inside nested braces as positional', () => {
  const { params } = parseTemplate('Entry|{{tt|x|note=y}}|v=Ruby')
  assert.equal(params[1], '{{tt|x|note=y}}')
  assert.equal(params.v, 'Ruby')
})

test('extractTemplates returns only top-level templates, in order', () => {
  const text = 'x {{Availability/Gen|gen=III}} y {{Availability/Entry1|v=Emerald|area={{p|Wobbuffet}} egg}} z'
  const templates = extractTemplates(text)
  assert.equal(templates.length, 2)
  assert.equal(templates[0].name, 'Availability/Gen')
  assert.equal(templates[1].params.area, '{{p|Wobbuffet}} egg')
})

test('cleanWikitext resolves the common inline templates', () => {
  assert.equal(cleanWikitext('{{rt|130|Hoenn}} ({{gdis|Mirage Island|III}})'), 'Route 130 (Mirage Island)')
  assert.equal(cleanWikitext('{{pkmn|breeding|Breed}} {{p|Wobbuffet}} holding a [[Lax Incense]]'), 'Breed Wobbuffet holding a Lax Incense')
  assert.equal(cleanWikitext('{{DL|List of Pokémon by Pal Park location|Field}}'), 'Field')
})

test('cleanWikitext resolves labelled links, bold, br, comments', () => {
  const raw = "Hatch {{pkmn|Egg}} [[List of in-game event Pokémon in Pokémon Emerald#Wynaut|received]] from an old couple in [[Lavaridge Town]]<br>{{rt|130|Hoenn}}<!-- note -->"
  assert.equal(cleanWikitext(raw), 'Hatch Egg received from an old couple in Lavaridge Town; Route 130')
})

test('cleanWikitext falls back to last positional param for unknown templates', () => {
  assert.equal(cleanWikitext('{{OBP|Underground Path|Kanto Routes 5–6|Underground Path (Rt. 5–6)}}'), 'Underground Path (Rt. 5–6)')
  assert.equal(cleanWikitext('{{Shiny}}'), 'Shiny')
})
