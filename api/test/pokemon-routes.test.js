import './setup.js'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import request from 'supertest'
import app from '../src/app.js'
import { loginAgent } from './helpers.js'

// Under Express 5, a request with no JSON body leaves req.body undefined; the
// route must 400 once, not double-send or fall through to a query.
// Pool teardown is registered per-process by setup.js.
describe('POST /api/pokemon with no body', () => {
  it('responds 401 without a session', async () => {
    const res = await request(app).post('/api/pokemon')

    assert.equal(res.status, 401)
  })

  it('responds 400 with a message when logged in', async () => {
    const agent = await loginAgent(app)
    const res = await agent.post('/api/pokemon')

    assert.equal(res.status, 400)
    assert.ok(res.body.message)
  })
})
