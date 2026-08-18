import './setup.js'
import assert from 'node:assert/strict'
import { describe, it } from 'mocha'
import request from 'supertest'
import app from '../src/app.js'

// Under Express 5, a request with no JSON body leaves req.body undefined; the
// route must 400 once, not double-send or fall through to a query.
// Pool teardown is a single root hook in setup.js, shared with every other
// test file.
describe('POST /api/pokemon with no body', () => {
  it('responds 400 with a message', async () => {
    const res = await request(app).post('/api/pokemon')

    assert.equal(res.status, 400)
    assert.ok(res.body.message)
  })
})
