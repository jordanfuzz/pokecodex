import './setup.js'
import assert from 'node:assert/strict'
import { describe, it, after } from 'node:test'
import app from '../src/app.js'
import pgPool from '../src/pg-pool.js'
import { loginAgent } from './helpers.js'

// Uses a real source row from the dev data; cleans up its override rows.
const anySourceId = () =>
  pgPool.query('select id, pokemon_id from sources limit 1;').then(r => r.rows[0])

describe('source overrides', () => {
  let createdFor = null

  after(async () => {
    if (createdFor)
      await pgPool.query('delete from users_source_overrides where source_id = $1;', [
        createdFor,
      ])
  })

  it('PUT upserts and GET /api/pokemon returns it', async () => {
    const agent = await loginAgent(app)
    const source = await anySourceId()
    createdFor = source.id

    const put = await agent
      .put('/api/user/source-override')
      .send({ sourceId: source.id, isRequired: true })
    assert.equal(put.status, 200)
    assert.equal(put.body.override.isRequired, true)

    // Upsert flips it without erroring on the unique constraint
    const put2 = await agent
      .put('/api/user/source-override')
      .send({ sourceId: source.id, isRequired: false })
    assert.equal(put2.status, 200)
    assert.equal(put2.body.override.isRequired, false)

    const res = await agent.get(`/api/pokemon?pokemonId=${source.pokemon_id}`)
    assert.ok(
      res.body.usersSourceOverrides.some(
        o => o.sourceId === source.id && o.isRequired === false
      )
    )
  })

  it('a forced override makes the row required in /api/all-pokemon', async () => {
    const agent = await loginAgent(app)
    const source = await anySourceId()
    createdFor = source.id

    await agent
      .put('/api/user/source-override')
      .send({ sourceId: source.id, isRequired: true })

    const list = await agent.get('/api/all-pokemon')
    const mon = list.body.pokemon.find(p => p.id === source.pokemon_id)
    assert.ok(mon.requiredSources.some(r => r.sourceId === source.id && r.isOverridden))
  })

  it('DELETE removes the override', async () => {
    const agent = await loginAgent(app)
    const source = await anySourceId()

    await agent
      .put('/api/user/source-override')
      .send({ sourceId: source.id, isRequired: true })
    const del = await agent.delete(`/api/user/source-override/${source.id}`)
    assert.equal(del.status, 200)

    const res = await agent.get(`/api/pokemon?pokemonId=${source.pokemon_id}`)
    assert.equal(
      res.body.usersSourceOverrides.some(o => o.sourceId === source.id),
      false
    )
  })

  it('PUT with a bad body responds 400', async () => {
    const agent = await loginAgent(app)
    const res = await agent.put('/api/user/source-override').send({ sourceId: 'x' })
    assert.equal(res.status, 400)
  })
})
