import './setup.js'
import assert from 'node:assert/strict'
import { describe, it, after } from 'mocha'
import request from 'supertest'
import app from '../src/app.js'
import pgPool from '../src/pg-pool.js'
import config from '../config.js'

// These tests run against the compose dev database (real data, no mocks).
// Start it with `npm start` at the repo root before running tests.
describe('GET /api/auth/dev-login', () => {
  after(() => pgPool.end())

  it('logs the client in and redirects to the app', async () => {
    const res = await request(app).get('/api/auth/dev-login')

    assert.equal(res.status, 302)
    assert.equal(res.headers.location, config.appUrl)
    assert.ok(
      res.headers['set-cookie']?.some(c => c.startsWith('session=')),
      'expected a session cookie to be set'
    )
  })

  it('creates a session that authenticates subsequent requests', async () => {
    const agent = request.agent(app)
    await agent.get('/api/auth/dev-login')

    const res = await agent.get('/api/auth/login')

    assert.equal(res.status, 200)
    assert.ok(res.body.id, 'expected the logged-in user to have an id')
  })
})
