import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseTemplate, extractTemplates } from '../src/bulbapedia/wikitext.js'

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
