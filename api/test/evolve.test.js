import './setup.js'
import assert from 'node:assert/strict'
import { describe, it, beforeEach, after } from 'node:test'
import { randomUUID } from 'crypto'
import pgPool from '../src/pg-pool.js'
import { evolveUsersPokemon } from '../src/users-pokemon/users-pokemon-repository.js'

const BASE = 63 // Abra
const EVOLVED = 64 // Kadabra

const userIdQuery = 'select id from users order by last_seen_at desc nulls last limit 1;'
const cleanup = async userId => {
  await pgPool.query(
    `delete from users_pokemon_sources where users_pokemon_id in
     (select id from users_pokemon where user_id = $1 and pokemon_id = any($2::int[]) and notes = 'evolve-test');`,
    [userId, [BASE, EVOLVED]]
  )
  await pgPool.query(
    `delete from users_pokemon where user_id = $1 and pokemon_id = any($2::int[]) and notes = 'evolve-test';`,
    [userId, [BASE, EVOLVED]]
  )
}

describe('evolveUsersPokemon', () => {
  let userId, gameId, baseShinyId, evolvedShinyId

  beforeEach(async () => {
    userId = (await pgPool.query(userIdQuery)).rows[0].id
    gameId = (await pgPool.query('select id from game_versions limit 1;')).rows[0].id
    baseShinyId = (
      await pgPool.query(
        `select id from sources where pokemon_id = $1 and source = 'shiny' limit 1;`,
        [BASE]
      )
    ).rows[0]?.id
    evolvedShinyId = (
      await pgPool.query(
        `select id from sources where pokemon_id = $1 and source = 'shiny' limit 1;`,
        [EVOLVED]
      )
    ).rows[0]?.id
    await cleanup(userId)
  })

  after(async () => {
    const uid = (await pgPool.query(userIdQuery)).rows[0].id
    await cleanup(uid)
  })

  const insertCatch = async withShiny => {
    const upId = randomUUID()
    await pgPool.query(
      `insert into users_pokemon(id, user_id, pokemon_id, notes, game_id, pokeball, caught_at)
       values($1, $2, $3, 'evolve-test', $4, 1, now());`,
      [upId, userId, BASE, gameId]
    )
    if (withShiny && baseShinyId)
      await pgPool.query(
        `insert into users_pokemon_sources(id, users_pokemon_id, source_id) values($1, $2, $3);`,
        [randomUUID(), upId, baseShinyId]
      )
    return upId
  }

  it('copies notes to the evolved record', async () => {
    const upId = await insertCatch(false)
    await evolveUsersPokemon({
      userId,
      evolvedPokemonId: EVOLVED,
      oldPokemonData: {
        id: upId,
        pokemonId: BASE,
        pokeball: 1,
        gameId,
        caughtAt: new Date().toISOString(),
        notes: 'evolve-test',
      },
    })
    const evolved = (
      await pgPool.query(
        `select * from users_pokemon where user_id = $1 and pokemon_id = $2 and notes = 'evolve-test';`,
        [userId, EVOLVED]
      )
    ).rows
    assert.equal(evolved.length, 1)
    assert.equal(evolved[0].notes, 'evolve-test')
  })

  it('a shiny base becomes a shiny evolution (own source, not inherited)', async t => {
    if (!baseShinyId || !evolvedShinyId) return t.skip('no shiny sources in data')
    const upId = await insertCatch(true)
    await evolveUsersPokemon({
      userId,
      evolvedPokemonId: EVOLVED,
      oldPokemonData: {
        id: upId,
        pokemonId: BASE,
        pokeball: 1,
        gameId,
        caughtAt: new Date().toISOString(),
        notes: 'evolve-test',
      },
    })
    const links = (
      await pgPool.query(
        `select ups.source_id, ups.is_inherited, s.source from users_pokemon_sources ups
         join sources s on s.id = ups.source_id
         join users_pokemon up on up.id = ups.users_pokemon_id
         where up.user_id = $1 and up.pokemon_id = $2 and up.notes = 'evolve-test';`,
        [userId, EVOLVED]
      )
    ).rows
    const shiny = links.find(l => l.source === 'shiny')
    assert.ok(shiny, 'evolved record should have a shiny source')
    assert.equal(shiny.source_id, evolvedShinyId)
    assert.equal(shiny.is_inherited, false)
    // and no evolved-type duplicates
    assert.equal(links.filter(l => l.source === 'evolved').length, 1)
  })
})
