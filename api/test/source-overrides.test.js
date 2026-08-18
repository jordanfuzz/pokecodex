import './setup.js'
import assert from 'node:assert/strict'
import { describe, it, after } from 'node:test'
import app from '../src/app.js'
import pgPool from '../src/pg-pool.js'
import { loginAgent } from './helpers.js'
import { getNeededRules } from '../src/pokemon/pokemon-utils.js'

// Uses a real source row from the dev data; deterministic so repeat runs hit
// the same row. Cleans up its own override rows afterward.
const anySourceId = () =>
  pgPool.query('select id, pokemon_id from sources order by id limit 1;').then(r => r.rows[0])

// Picks a source whose type is NOT required by the logged-in user's current
// rules, so PUTting isRequired: true is a genuine flip (rules-excluded ->
// forced-in) rather than a no-op the general rules would already satisfy.
const excludedSourceForUser = async agent => {
  const rulesRes = await agent.get('/api/user/rules')
  const neededRules = getNeededRules(rulesRes.body.rules ?? {})

  const res = neededRules.length
    ? await pgPool.query(
        'select id, pokemon_id from sources where not (source::text = any($1::text[])) order by id limit 1;',
        [neededRules]
      )
    : await pgPool.query('select id, pokemon_id from sources order by id limit 1;')

  return res.rows[0]
}

const currentUserId = async agent => {
  const res = await agent.get('/api/auth/login')
  return res.body.id
}

describe('source overrides', () => {
  const createdSourceIds = new Set()

  after(async () => {
    if (!createdSourceIds.size) return
    const agent = await loginAgent(app)
    const userId = await currentUserId(agent)
    await pgPool.query(
      'delete from users_source_overrides where user_id = $1 and source_id = any($2::uuid[]);',
      [userId, Array.from(createdSourceIds)]
    )
  })

  it('PUT upserts and GET /api/pokemon returns it', async () => {
    const agent = await loginAgent(app)
    const source = await anySourceId()
    createdSourceIds.add(source.id)

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
    const source = await excludedSourceForUser(agent)
    createdSourceIds.add(source.id)

    await agent
      .put('/api/user/source-override')
      .send({ sourceId: source.id, isRequired: true })

    const list = await agent.get('/api/all-pokemon')
    const mon = list.body.pokemon.find(p => p.id === source.pokemon_id)
    const requiredEntry = mon.requiredSources.find(r => r.sourceId === source.id)
    // The source's own type is rules-excluded for this user, so the only way
    // it can appear in requiredSources at all is via the override.
    assert.ok(requiredEntry, 'expected the overridden source to be forced into requiredSources')
    assert.equal(requiredEntry.isOverridden, true)
  })

  it('DELETE removes the override', async () => {
    const agent = await loginAgent(app)
    const source = await anySourceId()
    createdSourceIds.add(source.id)

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
