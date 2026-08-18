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

  it('a client-supplied userId is ignored on a write — the row lands under the session user', async () => {
    const agent = await loginAgent(app)
    const me = await agent.get('/api/auth/login')
    assert.equal(me.status, 200)
    const sessionUserId = me.body.id

    const other = await pgPool.query(
      'select id from users where id <> $1 order by id limit 1;',
      [sessionUserId]
    )
    const otherUserId = other.rows[0]
      ? other.rows[0].id
      : '00000000-0000-0000-0000-000000000000'

    const source = await pgPool.query('select id from sources order by id limit 1;')
    const sourceId = source.rows[0].id

    try {
      const res = await agent
        .put('/api/user/source-override')
        .query({ userId: otherUserId })
        .send({ sourceId, isRequired: true })
      assert.equal(res.status, 200)

      const override = await pgPool.query(
        'select user_id from users_source_overrides where source_id = $1;',
        [sourceId]
      )
      assert.equal(override.rows.length, 1)
      // The query-string userId was ignored — the write landed under the
      // session user, not the other user id supplied on the request.
      assert.equal(override.rows[0].user_id, sessionUserId)
    } finally {
      await pgPool.query(
        'delete from users_source_overrides where user_id = $1 and source_id = $2;',
        [sessionUserId, sourceId]
      )
    }
  })
})
