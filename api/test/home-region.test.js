import './setup.js'
import assert from 'node:assert/strict'
import { describe, it, beforeEach, after } from 'node:test'
import { randomUUID } from 'crypto'
import app from '../src/app.js'
import pgPool from '../src/pg-pool.js'
import { loginAgent } from './helpers.js'

const POKEMON = 399 // Bidoof, gen 4, home region Sinnoh
const DIAMOND = 14 // gen 4, Sinnoh — a home game
const SOUL_SILVER = 18 // gen 4, Johto — not a home game

const userIdQuery = 'select id from users order by last_seen_at desc nulls last limit 1;'
const cleanup = async userId => {
  await pgPool.query(
    `delete from users_pokemon_sources where users_pokemon_id in
     (select id from users_pokemon where user_id = $1 and pokemon_id = $2 and notes = 'home-region-test');`,
    [userId, POKEMON]
  )
  await pgPool.query(
    `delete from users_pokemon where user_id = $1 and pokemon_id = $2 and notes = 'home-region-test';`,
    [userId, POKEMON]
  )
}

const insertCatch = async (userId, gameId) => {
  const upId = randomUUID()
  await pgPool.query(
    `insert into users_pokemon(id, user_id, pokemon_id, notes, game_id, pokeball, caught_at)
     values($1, $2, $3, 'home-region-test', $4, 1, now());`,
    [upId, userId, POKEMON, gameId]
  )
  return upId
}

describe('home region catch ids', () => {
  let userId
  const createdRowIds = []

  beforeEach(async () => {
    userId = (await pgPool.query(userIdQuery)).rows[0].id
    await cleanup(userId)
  })

  after(async () => {
    const uid = (await pgPool.query(userIdQuery)).rows[0].id
    await cleanup(uid)
    const trackedIds = createdRowIds.filter(Boolean)
    await pgPool.query(
      `delete from users_pokemon_sources where users_pokemon_id = any($1::uuid[]);`,
      [trackedIds]
    )
    await pgPool.query(`delete from users_pokemon where id = any($1::uuid[]);`, [trackedIds])
  })

  it('GET /api/pokemon flags home-game catches and only those', async () => {
    const agent = await loginAgent(app)
    const homeId = await insertCatch(userId, DIAMOND)
    const awayId = await insertCatch(userId, SOUL_SILVER)

    const res = await agent.get(`/api/pokemon?pokemonId=${POKEMON}`)
    assert.equal(res.status, 200)
    assert.ok(Array.isArray(res.body.homeRegionCatchIds))
    assert.ok(res.body.homeRegionCatchIds.includes(homeId))
    assert.equal(res.body.homeRegionCatchIds.includes(awayId), false)
  })

  it('POST /api/pokemon returns homeRegionCatchIds and usersSourceOverrides, and drops original source ids', async () => {
    // The restored dump holds real user data, so identify the POST-created
    // row by diffing ids — never assert on or delete the user's other rows.
    const agent = await loginAgent(app)
    const originalSourceId = (
      await pgPool.query(
        `select id from sources where pokemon_id = $1 and source = 'original';`,
        [POKEMON]
      )
    ).rows[0].id

    const rowIds = async () =>
      (
        await pgPool.query(
          `select id from users_pokemon where user_id = $1 and pokemon_id = $2;`,
          [userId, POKEMON]
        )
      ).rows.map(r => r.id)
    const before = await rowIds()

    const res = await agent.post('/api/pokemon').send({
      pokemonId: POKEMON,
      sources: [originalSourceId],
      gameVersion: DIAMOND,
      pokeball: 1,
    })

    // Compute newRowId before any response assertions so a failing
    // assertion below still lets the finally block clean up the row.
    const newRowId = (await rowIds()).find(id => !before.includes(id))
    createdRowIds.push(newRowId)
    assert.ok(newRowId, 'POST should have created a row')

    try {
      assert.equal(res.status, 200)
      assert.ok(Array.isArray(res.body.homeRegionCatchIds))
      assert.ok(Array.isArray(res.body.usersSourceOverrides))

      const links = await pgPool.query(
        `select * from users_pokemon_sources where users_pokemon_id = $1;`,
        [newRowId]
      )
      assert.equal(links.rows.length, 0, 'original source id must not be stored')

      // the Diamond catch itself qualifies via derivation
      assert.ok(res.body.homeRegionCatchIds.includes(newRowId))
    } finally {
      await pgPool.query(`delete from users_pokemon_sources where users_pokemon_id = $1;`, [
        newRowId,
      ])
      await pgPool.query(`delete from users_pokemon where id = $1;`, [newRowId])
    }
  })
})
