import './setup.js'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import request from 'supertest'
import app from '../src/app.js'
import pgPool from '../src/pg-pool.js'
import { loginAgent } from './helpers.js'

describe('data routes without a session', () => {
  for (const [method, path] of [
    ['get', '/api/all-pokemon'],
    ['get', '/api/pokemon'],
    ['get', '/api/game-data'],
    ['get', '/api/user/rules'],
    ['get', '/api/pokemon/box-data'],
    ['put', '/api/user/rules'],
    ['post', '/api/pokemon'],
  ]) {
    it(`${method.toUpperCase()} ${path} responds 401`, async () => {
      const res = await request(app)[method](path)
      assert.equal(res.status, 401)
    })
  }
})

describe('data routes with a session', () => {
  it('GET /api/all-pokemon returns pokemon for the session user with no userId param', async () => {
    const agent = await loginAgent(app)
    const res = await agent.get('/api/all-pokemon')

    assert.equal(res.status, 200)
    assert.ok(Array.isArray(res.body.pokemon))
    assert.ok(res.body.pokemon.length > 0)
  })

  it('GET /api/user/rules returns rules without a userId param', async () => {
    const agent = await loginAgent(app)
    const res = await agent.get('/api/user/rules')

    assert.equal(res.status, 200)
    assert.ok(res.body.rules !== undefined)
  })

  it('GET /api/all-pokemon ignores a client-supplied userId and uses the session user', async () => {
    const agent = await loginAgent(app)
    const me = await agent.get('/api/auth/login')
    assert.equal(me.status, 200)
    const sessionUserId = me.body.id

    const other = await pgPool.query('select id from users where id <> $1 limit 1;', [
      sessionUserId,
    ])
    const otherUserId = other.rows[0]
      ? other.rows[0].id
      : '00000000-0000-0000-0000-000000000000'

    // Fired concurrently (not sequentially) so both land in the same instant
    // of shared fixture-user state — other test files mutate that user's
    // rules transiently, and a sequential await gap between these two calls
    // is wide enough to straddle one of those mutations.
    const [baseline, res] = await Promise.all([
      agent.get('/api/all-pokemon'),
      agent.get('/api/all-pokemon').query({ userId: otherUserId }),
    ])
    assert.equal(baseline.status, 200)
    assert.equal(res.status, 200)

    assert.equal(res.body.pokemon.length, baseline.body.pokemon.length)
    assert.deepEqual(
      res.body.pokemon.slice(0, 50).map(p => p.isComplete),
      baseline.body.pokemon.slice(0, 50).map(p => p.isComplete)
    )
  })
})
