import './setup.js'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import request from 'supertest'
import app from '../src/app.js'
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
})
