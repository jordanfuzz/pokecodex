import './setup.js'
import assert from 'node:assert/strict'
import { describe, it, after } from 'mocha'
import request from 'supertest'
import app from '../src/app.js'
import pgPool from '../src/pg-pool.js'

// Under Express 5, a request with no JSON body leaves req.body undefined; the
// route must 400 once, not double-send or fall through to a query.
describe('POST /api/pokemon with no body', () => {
  // pgPool is a shared singleton with dev-login.test.js, which also closes
  // it in its own after hook; guard so whichever suite runs last doesn't
  // double-end the pool.
  after(() => {
    if (!pgPool.ending) return pgPool.end()
  })

  it('responds 400 with a message', async () => {
    const res = await request(app).post('/api/pokemon')

    assert.equal(res.status, 400)
    assert.ok(res.body.message)
  })
})
