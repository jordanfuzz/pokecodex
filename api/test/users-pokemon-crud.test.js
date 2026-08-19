import './setup.js'
import assert from 'node:assert/strict'
import { describe, it, before, after } from 'node:test'
import { randomUUID } from 'crypto'
import app from '../src/app.js'
import pgPool from '../src/pg-pool.js'
import { loginAgent } from './helpers.js'

// Happy-path coverage for the users-pokemon write routes. The ownership
// tests cover the denied paths; these cover what a normal edit must do.
const POKEMON = 63 // Abra

describe('users-pokemon CRUD happy paths', () => {
  let agent, userId, gameId, otherGameId
  const createdRowIds = []

  const insertRow = async () => {
    const id = randomUUID()
    await pgPool.query(
      `insert into users_pokemon(id, user_id, pokemon_id, notes, game_id, pokeball, caught_at)
       values($1, $2, $3, 'crud-test', $4, 1, now());`,
      [id, userId, POKEMON, gameId]
    )
    createdRowIds.push(id)
    return id
  }

  const linksFor = async rowId =>
    (
      await pgPool.query(
        `select ups.id, ups.source_id, ups.is_inherited, s.source from users_pokemon_sources ups
         join sources s on s.id = ups.source_id
         where ups.users_pokemon_id = $1;`,
        [rowId]
      )
    ).rows

  before(async () => {
    agent = await loginAgent(app)
    userId = (await agent.get('/api/auth/login')).body.id
    const games = await pgPool.query('select id from game_versions order by id limit 2;')
    gameId = games.rows[0].id
    otherGameId = games.rows[1].id
  })

  after(async () => {
    await pgPool.query(
      `delete from users_pokemon_sources where users_pokemon_id = any($1::uuid[]);`,
      [createdRowIds]
    )
    await pgPool.query(`delete from users_pokemon where id = any($1::uuid[]);`, [
      createdRowIds,
    ])
  })

  it('PUT /api/users-pokemon updates pokeball, game and caughtAt on an owned row', async () => {
    const rowId = await insertRow()
    const caughtAt = '2026-01-02T03:04:05.000Z'

    const res = await agent.put('/api/users-pokemon').send({
      usersPokemonId: rowId,
      pokemonId: POKEMON,
      sources: [],
      gameVersion: otherGameId,
      pokeball: 2,
      caughtAt,
    })
    assert.equal(res.status, 200)

    // caught_at is timestamp WITHOUT time zone: postgres drops the Z and
    // stores the UTC wall time, so compare wall times via to_char rather
    // than a Date round-trip (which would depend on the host timezone).
    const row = (
      await pgPool.query(
        `select *, to_char(caught_at, 'YYYY-MM-DD"T"HH24:MI:SS') as caught_wall
         from users_pokemon where id = $1;`,
        [rowId]
      )
    ).rows[0]
    assert.equal(row.pokeball, 2)
    assert.equal(row.game_id, otherGameId)
    assert.equal(row.caught_wall, '2026-01-02T03:04:05')

    // The response reflects the updated row.
    const returned = res.body.usersPokemon.find(p => p.id === rowId)
    assert.ok(returned, 'updated row is in the response')
    assert.equal(returned.pokeball, 2)
  })

  it('PUT replaces non-inherited links, preserves inherited ones, and drops bogus/original ids', async () => {
    const rowId = await insertRow()

    const sourceRows = (
      await pgPool.query(
        `select id, source from sources where pokemon_id = $1 and source <> 'original' order by source limit 3;`,
        [POKEMON]
      )
    ).rows
    assert.ok(sourceRows.length >= 3, 'Abra needs at least 3 non-original sources')
    const [inheritedSrc, oldSrc, newSrc] = sourceRows
    const originalId = (
      await pgPool.query(
        `select id from sources where pokemon_id = $1 and source = 'original';`,
        [POKEMON]
      )
    ).rows[0].id

    // Seed one inherited link and one plain link.
    await pgPool.query(
      `insert into users_pokemon_sources(id, users_pokemon_id, source_id, is_inherited)
       values($1, $2, $3, true), ($4, $2, $5, false);`,
      [randomUUID(), rowId, inheritedSrc.id, randomUUID(), oldSrc.id]
    )

    const res = await agent.put('/api/users-pokemon').send({
      usersPokemonId: rowId,
      pokemonId: POKEMON,
      sources: [newSrc.id, randomUUID(), originalId],
      gameVersion: gameId,
      pokeball: 1,
      caughtAt: new Date().toISOString(),
    })
    assert.equal(res.status, 200)

    const links = await linksFor(rowId)
    const inherited = links.filter(l => l.is_inherited)
    const plain = links.filter(l => !l.is_inherited)
    assert.deepEqual(
      inherited.map(l => l.source_id),
      [inheritedSrc.id],
      'inherited link survives the rewrite'
    )
    assert.deepEqual(
      plain.map(l => l.source_id),
      [newSrc.id],
      'plain links replaced with exactly the valid new id'
    )
    assert.ok(!links.some(l => l.source === 'original'), 'original id never stored')
  })

  it('PUT /api/users-pokemon/note writes the note and returns the refreshed list', async () => {
    const rowId = await insertRow()

    const res = await agent.put('/api/users-pokemon/note').send({
      usersPokemonId: rowId,
      pokemonId: POKEMON,
      note: 'crud-test-note',
    })
    assert.equal(res.status, 200)

    const row = (
      await pgPool.query(`select notes from users_pokemon where id = $1;`, [rowId])
    ).rows[0]
    assert.equal(row.notes, 'crud-test-note')
    assert.ok(Array.isArray(res.body.usersPokemon))
    assert.ok(res.body.usersPokemon.some(p => p.id === rowId))
  })

  it('DELETE /api/users-pokemon removes the row and its links', async () => {
    const rowId = await insertRow()
    const sourceId = (
      await pgPool.query(`select id from sources where pokemon_id = $1 limit 1;`, [
        POKEMON,
      ])
    ).rows[0].id
    await pgPool.query(
      `insert into users_pokemon_sources(id, users_pokemon_id, source_id) values($1, $2, $3);`,
      [randomUUID(), rowId, sourceId]
    )

    const res = await agent
      .delete('/api/users-pokemon')
      .send({ usersPokemonId: rowId, pokemonId: POKEMON })
    assert.equal(res.status, 200)

    const row = await pgPool.query(`select * from users_pokemon where id = $1;`, [rowId])
    assert.equal(row.rows.length, 0, 'row deleted')
    const links = await linksFor(rowId)
    assert.equal(links.length, 0, 'links deleted')
    assert.ok(!res.body.usersPokemon.some(p => p.id === rowId))
  })
})
