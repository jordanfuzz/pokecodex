import './setup.js'
import assert from 'node:assert/strict'
import { describe, it, before } from 'node:test'
import app from '../src/app.js'
import pgPool from '../src/pg-pool.js'
import { loginAgent } from './helpers.js'
import { getSourcesForPokemon } from '../src/sources/sources-repository.js'

const POKEMON = 1 // Bulbasaur: sources across gens {0, 1, 4, 6, 7, 8}

describe('sources gen filtering (repository)', () => {
  it('a generationId returns only gen 0 plus that gen', async () => {
    const sources = await getSourcesForPokemon(POKEMON, 4)
    const gens = [...new Set(sources.map(s => s.gen))].sort()
    assert.deepEqual(gens, [0, 4])
  })

  it('no generationId returns every gen', async () => {
    const all = await getSourcesForPokemon(POKEMON)
    const gens = [...new Set(all.map(s => s.gen))]
    assert.ok(gens.length > 2, 'unfiltered call spans more than two gens')
  })
})

describe('sources routes', () => {
  it('GET /api/sources returns only the requested pokemon\'s sources', async () => {
    const agent = await loginAgent(app)
    const res = await agent.get(`/api/sources?pokemonId=${POKEMON}`)

    assert.equal(res.status, 200)
    assert.ok(res.body.sources.length > 0)
    assert.ok(res.body.sources.every(s => s.pokemonId === POKEMON))
  })
})

describe('POST /api/sources admin gate', () => {
  let agent, userId, savedIsAdmin
  const TEST_SOURCE_NAME = 'audit-test-source'

  const setAdmin = value =>
    pgPool.query(`update users set is_admin = $1 where id = $2;`, [value, userId])

  before(async () => {
    agent = await loginAgent(app)
    userId = (await agent.get('/api/auth/login')).body.id
    savedIsAdmin = (
      await pgPool.query(`select is_admin from users where id = $1;`, [userId])
    ).rows[0].is_admin
  })

  it('a non-admin gets 401 and no row is inserted', async () => {
    try {
      await setAdmin(false)
      const res = await agent.post('/api/sources').send({
        pokemonId: POKEMON,
        source: {
          name: TEST_SOURCE_NAME,
          source: 'wild',
          gen: 1,
          description: null,
          image: null,
          replaceDefault: false,
        },
      })
      assert.equal(res.status, 401)

      const rows = await pgPool.query(`select * from sources where name = $1;`, [
        TEST_SOURCE_NAME,
      ])
      assert.equal(rows.rows.length, 0)
    } finally {
      await setAdmin(savedIsAdmin)
    }
  })

  it('an admin insert lands and comes back in the response list', async () => {
    try {
      await setAdmin(true)
      const res = await agent.post('/api/sources').send({
        pokemonId: POKEMON,
        source: {
          name: TEST_SOURCE_NAME,
          source: 'wild',
          gen: 1,
          description: null,
          image: null,
          replaceDefault: false,
        },
      })
      assert.equal(res.status, 200)
      assert.ok(res.body.sources.some(s => s.name === TEST_SOURCE_NAME))

      const rows = await pgPool.query(`select * from sources where name = $1;`, [
        TEST_SOURCE_NAME,
      ])
      assert.equal(rows.rows.length, 1)
      assert.equal(rows.rows[0].pokemon_id, POKEMON)
    } finally {
      await pgPool.query(`delete from sources where name = $1;`, [TEST_SOURCE_NAME])
      await setAdmin(savedIsAdmin)
    }
  })
})
