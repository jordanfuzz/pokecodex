import './setup.js'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import app from '../src/app.js'
import { loginAgent } from './helpers.js'

// A non-integer pokemonId makes pg reject the query; Express 5 forwards the
// rejection to the terminal handler in app.js, which must answer 500 JSON
// with no stack trace (the default handler leaks stacks whenever
// NODE_ENV !== 'production', and tests always run in development).
describe('terminal error handler', () => {
  it('responds 500 JSON without leaking a stack trace', async () => {
    const agent = await loginAgent(app)
    const res = await agent.get('/api/pokemon?pokemonId=not-a-number')

    assert.equal(res.status, 500)
    assert.deepEqual(res.body, { message: 'Internal server error' })
    assert.ok(!res.text.includes('    at '), 'no stack frames in the response')
  })
})
