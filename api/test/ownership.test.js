import './setup.js'
import assert from 'node:assert/strict'
import { describe, it, before, after } from 'node:test'
import { randomUUID } from 'crypto'
import app from '../src/app.js'
import pgPool from '../src/pg-pool.js'
import { loginAgent } from './helpers.js'

// A second user's catch must not be writable through the session user's
// requests, even with a leaked users_pokemon uuid.
const POKEMON = 63 // Abra

describe('ownership scoping on users-pokemon writes', () => {
  let agent, victimUserId, victimRowId, gameId

  before(async () => {
    agent = await loginAgent(app)
    victimUserId = randomUUID()
    victimRowId = randomUUID()
    gameId = (await pgPool.query('select id from game_versions limit 1;')).rows[0].id
    // last_seen_at stays null so dev-login never picks the victim.
    await pgPool.query(
      `insert into users(id, discord_id, discord_username) values($1, 'ownership-test', 'ownership-test');`,
      [victimUserId]
    )
    await pgPool.query(
      `insert into users_pokemon(id, user_id, pokemon_id, notes, game_id, pokeball, caught_at)
       values($1, $2, $3, 'ownership-test', $4, 1, now());`,
      [victimRowId, victimUserId, POKEMON, gameId]
    )
  })

  after(async () => {
    await pgPool.query(
      `delete from users_pokemon_sources where users_pokemon_id in
       (select id from users_pokemon where user_id = $1);`,
      [victimUserId]
    )
    await pgPool.query(`delete from users_pokemon where user_id = $1;`, [victimUserId])
    // Belt-and-suspenders: delete the victim row by id too, so a
    // takeover-regression bug (row reassigned to a different user_id) can't
    // leave residue on a real account instead of being swept above.
    await pgPool.query(`delete from users_pokemon where id = $1;`, [victimRowId])
    await pgPool.query(`delete from users where id = $1;`, [victimUserId])
  })

  const victimRow = async () =>
    (await pgPool.query(`select * from users_pokemon where id = $1;`, [victimRowId]))
      .rows[0]

  it('PUT /api/users-pokemon cannot update or take over another user\'s row', async () => {
    const res = await agent.put('/api/users-pokemon').send({
      usersPokemonId: victimRowId,
      pokemonId: POKEMON,
      sources: [],
      gameVersion: gameId,
      pokeball: 2,
      caughtAt: new Date().toISOString(),
    })
    assert.equal(res.status, 200)

    const row = await victimRow()
    assert.equal(row.user_id, victimUserId, 'row must still belong to the victim')
    assert.equal(row.pokeball, 1, 'pokeball must be unchanged')
  })

  it('PUT /api/users-pokemon with a foreign row does not rewrite its sources', async () => {
    const sourceId = (
      await pgPool.query(`select id from sources where pokemon_id = $1 limit 1;`, [
        POKEMON,
      ])
    ).rows[0].id
    await pgPool.query(
      `insert into users_pokemon_sources(id, users_pokemon_id, source_id) values($1, $2, $3);`,
      [randomUUID(), victimRowId, sourceId]
    )

    await agent.put('/api/users-pokemon').send({
      usersPokemonId: victimRowId,
      pokemonId: POKEMON,
      sources: [],
      gameVersion: gameId,
      pokeball: 2,
      caughtAt: new Date().toISOString(),
    })

    const links = await pgPool.query(
      `select * from users_pokemon_sources where users_pokemon_id = $1;`,
      [victimRowId]
    )
    assert.equal(links.rows.length, 1, 'victim sources must be untouched')
  })

  it('PUT /api/users-pokemon/note cannot write another user\'s note', async () => {
    await agent.put('/api/users-pokemon/note').send({
      usersPokemonId: victimRowId,
      pokemonId: POKEMON,
      note: 'hacked',
    })
    const row = await victimRow()
    assert.equal(row.notes, 'ownership-test')
  })

  it('DELETE /api/users-pokemon cannot delete another user\'s row', async () => {
    await agent.delete('/api/users-pokemon').send({
      usersPokemonId: victimRowId,
      pokemonId: POKEMON,
    })
    const row = await victimRow()
    assert.ok(row, 'victim row must still exist')
  })
})
