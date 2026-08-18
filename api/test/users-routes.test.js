import './setup.js'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import app from '../src/app.js'
import pgPool from '../src/pg-pool.js'
import { loginAgent } from './helpers.js'

describe('GET /api/user/rules for a user with no rules', () => {
  it('responds 200 with empty rules instead of 500', async () => {
    const agent = await loginAgent(app)
    const me = await agent.get('/api/auth/login')

    // Simulate a brand-new user: null out rules, restore after.
    const saved = await pgPool
      .query('select user_rules from users where id = $1;', [me.body.id])
      .then(r => r.rows[0].user_rules)

    try {
      await pgPool.query('update users set user_rules = null where id = $1;', [me.body.id])

      const res = await agent.get('/api/user/rules')
      assert.equal(res.status, 200)
      assert.deepEqual(res.body.rules, {})

      const list = await agent.get('/api/all-pokemon')
      assert.equal(list.status, 200)
      assert.ok(Array.isArray(list.body.pokemon))
    } finally {
      await pgPool.query('update users set user_rules = $1 where id = $2;', [
        saved,
        me.body.id,
      ])
    }
  })
})
