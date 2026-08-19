import './setup.js'
import assert from 'node:assert/strict'
import { describe, it, before, after } from 'node:test'
import { randomUUID } from 'crypto'
import app from '../src/app.js'
import pgPool from '../src/pg-pool.js'
import { loginAgent } from './helpers.js'
import {
  setupBoxDataForUser,
  updateUsersBoxData,
  getBoxDataForUser,
} from '../src/users-pokemon/users-pokemon-repository.js'

// Setup-route idempotency is a known, backlogged gap (no unique(user_id,
// game_id) constraint) — deliberately not asserted here.
describe('box data repository', () => {
  let throwawayUserId

  before(async () => {
    throwawayUserId = randomUUID()
    // last_seen_at stays null so dev-login never picks this user.
    await pgPool.query(
      `insert into users(id, discord_id, discord_username) values($1, 'box-data-test', 'box-data-test');`,
      [throwawayUserId]
    )
  })

  after(async () => {
    await pgPool.query(`delete from users_box_data where user_id = $1;`, [
      throwawayUserId,
    ])
    await pgPool.query(`delete from users where id = $1;`, [throwawayUserId])
  })

  it('an update for a user with no box rows touches nothing and returns null', async () => {
    const anyGameId = (
      await pgPool.query(`select id from game_versions where box_size is not null limit 1;`)
    ).rows[0].id
    const result = await updateUsersBoxData(['999'], throwawayUserId, anyGameId)
    assert.equal(result, null)
  })

  it('setup creates one empty row per boxed game', async () => {
    const boxedGameCount = Number(
      (
        await pgPool.query(
          `select count(*) from game_versions where box_size is not null;`
        )
      ).rows[0].count
    )

    const created = await setupBoxDataForUser(throwawayUserId)
    assert.equal(created.length, boxedGameCount)
    assert.ok(created.every(row => row.userId === throwawayUserId))
    assert.ok(
      created.every(row => Array.isArray(row.completeRecords) && !row.completeRecords.length)
    )
  })

  it('update round-trips complete records for one game and leaves others empty', async () => {
    const rows = await getBoxDataForUser(throwawayUserId)
    const target = rows[0]

    const updated = await updateUsersBoxData(['25', '26:abc'], throwawayUserId, target.gameId)
    const targetRow = updated.find(r => r.gameId === target.gameId)
    assert.deepEqual(targetRow.completeRecords, ['25', '26:abc'])
    assert.ok(
      updated
        .filter(r => r.gameId !== target.gameId)
        .every(r => r.completeRecords.length === 0),
      'other games untouched'
    )
  })
})

describe('box data routes', () => {
  it('GET /api/pokemon/box-data returns box rows and the formatted game pairs', async () => {
    const agent = await loginAgent(app)
    const res = await agent.get('/api/pokemon/box-data')

    assert.equal(res.status, 200)
    assert.ok(
      res.body.usersBoxData === null || Array.isArray(res.body.usersBoxData),
      'usersBoxData is array-or-null'
    )
    assert.equal(res.body.gameVersions.length, 18)
    for (const [name, game] of res.body.gameVersions) {
      assert.equal(typeof name, 'string')
      if (game) assert.ok(game.id, 'paired game rows carry their id')
    }
  })

  it('PUT /api/pokemon/box-data updates only the addressed game for the session user', async () => {
    const agent = await loginAgent(app)
    const me = await agent.get('/api/auth/login')
    const userId = me.body.id

    const rows = (
      await pgPool.query(
        `select game_id, complete_records from users_box_data where user_id = $1 order by game_id limit 2;`,
        [userId]
      )
    ).rows
    if (rows.length < 2) {
      // Session user has no (or one) box row — the repository suite above
      // covers update semantics; nothing to safely exercise here.
      return
    }
    const [target, bystander] = rows

    try {
      const res = await agent.put('/api/pokemon/box-data').send({
        completeRecords: ['box-data-test-sentinel'],
        gameId: target.game_id,
      })
      assert.equal(res.status, 200)

      const after = await pgPool.query(
        `select game_id, complete_records from users_box_data where user_id = $1 and game_id = any($2::int[]);`,
        [userId, [target.game_id, bystander.game_id]]
      )
      const targetAfter = after.rows.find(r => r.game_id === target.game_id)
      const bystanderAfter = after.rows.find(r => r.game_id === bystander.game_id)
      assert.deepEqual(targetAfter.complete_records, ['box-data-test-sentinel'])
      assert.deepEqual(
        bystanderAfter.complete_records,
        bystander.complete_records,
        'other game rows untouched'
      )
    } finally {
      await pgPool.query(
        `update users_box_data set complete_records = $1 where user_id = $2 and game_id = $3;`,
        [JSON.stringify(target.complete_records), userId, target.game_id]
      )
    }
  })
})
