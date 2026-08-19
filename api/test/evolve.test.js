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

  it('rolls back and changes nothing when the base row belongs to another user', async () => {
    const upId = await insertCatch(false)
    const victimUserId = randomUUID()
    await pgPool.query(
      `insert into users(id, discord_id, discord_username) values($1, 'evolve-ownership-test', 'x');`,
      [victimUserId]
    )
    try {
      await evolveUsersPokemon({
        userId: victimUserId, // not the owner of upId
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
      const baseRow = await pgPool.query(`select * from users_pokemon where id = $1;`, [
        upId,
      ])
      assert.equal(baseRow.rows.length, 1, 'base row must survive')
      const evolved = await pgPool.query(
        `select * from users_pokemon where user_id = $1;`,
        [victimUserId]
      )
      assert.equal(evolved.rows.length, 0, 'no evolved record for the attacker')
    } finally {
      await pgPool.query(`delete from users_pokemon where user_id = $1;`, [victimUserId])
      await pgPool.query(`delete from users where id = $1;`, [victimUserId])
    }
  })
})

// Regression tests from the phase-3 final review (BACKLOG.md): old-row
// deletion, the inherited-link id-preservation invariant, and chained-evolve
// evolved-tag dedupe.
describe('evolveUsersPokemon regressions', () => {
  const CHAIN = 65 // Alakazam

  let userId, gameId

  const chainCleanup = async uid => {
    await pgPool.query(
      `delete from users_pokemon_sources where users_pokemon_id in
       (select id from users_pokemon where user_id = $1 and pokemon_id = any($2::int[]) and notes = 'evolve-test');`,
      [uid, [BASE, EVOLVED, CHAIN]]
    )
    await pgPool.query(
      `delete from users_pokemon where user_id = $1 and pokemon_id = any($2::int[]) and notes = 'evolve-test';`,
      [uid, [BASE, EVOLVED, CHAIN]]
    )
  }

  beforeEach(async () => {
    userId = (await pgPool.query(userIdQuery)).rows[0].id
    gameId = (await pgPool.query('select id from game_versions limit 1;')).rows[0].id
    await chainCleanup(userId)
  })

  after(async () => {
    const uid = (await pgPool.query(userIdQuery)).rows[0].id
    await chainCleanup(uid)
  })

  const insertBase = async () => {
    const upId = randomUUID()
    await pgPool.query(
      `insert into users_pokemon(id, user_id, pokemon_id, notes, game_id, pokeball, caught_at)
       values($1, $2, $3, 'evolve-test', $4, 1, now());`,
      [upId, userId, BASE, gameId]
    )
    return upId
  }

  const evolve = (fromRowId, fromPokemonId, toPokemonId) =>
    evolveUsersPokemon({
      userId,
      evolvedPokemonId: toPokemonId,
      oldPokemonData: {
        id: fromRowId,
        pokemonId: fromPokemonId,
        pokeball: 1,
        gameId,
        caughtAt: new Date().toISOString(),
        notes: 'evolve-test',
      },
    })

  const rowFor = async pokemonId =>
    (
      await pgPool.query(
        `select * from users_pokemon where user_id = $1 and pokemon_id = $2 and notes = 'evolve-test';`,
        [userId, pokemonId]
      )
    ).rows[0]

  it('deletes the base row after a successful evolve', async () => {
    const upId = await insertBase()
    await evolve(upId, BASE, EVOLVED)

    const oldRow = await pgPool.query(`select * from users_pokemon where id = $1;`, [
      upId,
    ])
    assert.equal(oldRow.rows.length, 0, 'base row must be gone')
    assert.ok(await rowFor(EVOLVED), 'evolved row must exist')
  })

  it('moves ordinary links to the evolution preserving their link ids, as inherited', async () => {
    const upId = await insertBase()
    const plainSourceId = (
      await pgPool.query(
        `select id from sources where pokemon_id = $1
         and source not in ('shiny', 'male', 'female', 'evolved', 'original') limit 1;`,
        [BASE]
      )
    ).rows[0].id
    const linkId = randomUUID()
    await pgPool.query(
      `insert into users_pokemon_sources(id, users_pokemon_id, source_id) values($1, $2, $3);`,
      [linkId, upId, plainSourceId]
    )

    await evolve(upId, BASE, EVOLVED)

    const evolvedRow = await rowFor(EVOLVED)
    const movedLink = (
      await pgPool.query(`select * from users_pokemon_sources where id = $1;`, [linkId])
    ).rows[0]
    assert.ok(movedLink, 'link row survives the move under the same id')
    assert.equal(movedLink.users_pokemon_id, evolvedRow.id)
    assert.equal(movedLink.is_inherited, true)
    assert.equal(movedLink.source_id, plainSourceId)
  })

  it('a chained evolve leaves exactly one evolved tag: the final form’s own', async () => {
    const upId = await insertBase()
    await evolve(upId, BASE, EVOLVED)
    const kadabraRow = await rowFor(EVOLVED)

    await evolve(kadabraRow.id, EVOLVED, CHAIN)

    const alakazamRow = await rowFor(CHAIN)
    const evolvedLinks = (
      await pgPool.query(
        `select ups.is_inherited, s.pokemon_id from users_pokemon_sources ups
         join sources s on s.id = ups.source_id
         where ups.users_pokemon_id = $1 and s.source = 'evolved';`,
        [alakazamRow.id]
      )
    ).rows
    assert.equal(evolvedLinks.length, 1, 'exactly one evolved tag after the chain')
    assert.equal(evolvedLinks[0].pokemon_id, CHAIN, 'the tag is the final form’s own')
    assert.equal(evolvedLinks[0].is_inherited, false)
  })
})

describe('evolveUsersPokemon gender swap', () => {
  const G_BASE = 456 // Finneon
  const G_EVOLVED = 457 // Lumineon

  let userId, gameId, baseFemaleId, evolvedFemaleId

  const genderCleanup = async uid => {
    await pgPool.query(
      `delete from users_pokemon_sources where users_pokemon_id in
       (select id from users_pokemon where user_id = $1 and pokemon_id = any($2::int[]) and notes = 'evolve-test');`,
      [uid, [G_BASE, G_EVOLVED]]
    )
    await pgPool.query(
      `delete from users_pokemon where user_id = $1 and pokemon_id = any($2::int[]) and notes = 'evolve-test';`,
      [uid, [G_BASE, G_EVOLVED]]
    )
  }

  beforeEach(async () => {
    userId = (await pgPool.query(userIdQuery)).rows[0].id
    gameId = (await pgPool.query('select id from game_versions limit 1;')).rows[0].id
    baseFemaleId = (
      await pgPool.query(
        `select id from sources where pokemon_id = $1 and source = 'female' limit 1;`,
        [G_BASE]
      )
    ).rows[0]?.id
    evolvedFemaleId = (
      await pgPool.query(
        `select id from sources where pokemon_id = $1 and source = 'female' limit 1;`,
        [G_EVOLVED]
      )
    ).rows[0]?.id
    await genderCleanup(userId)
  })

  after(async () => {
    const uid = (await pgPool.query(userIdQuery)).rows[0].id
    await genderCleanup(uid)
  })

  it('a female base becomes a female evolution (own source, not inherited)', async t => {
    if (!baseFemaleId || !evolvedFemaleId) return t.skip('no gender sources in data')
    const upId = randomUUID()
    await pgPool.query(
      `insert into users_pokemon(id, user_id, pokemon_id, notes, game_id, pokeball, caught_at)
       values($1, $2, $3, 'evolve-test', $4, 1, now());`,
      [upId, userId, G_BASE, gameId]
    )
    await pgPool.query(
      `insert into users_pokemon_sources(id, users_pokemon_id, source_id) values($1, $2, $3);`,
      [randomUUID(), upId, baseFemaleId]
    )

    await evolveUsersPokemon({
      userId,
      evolvedPokemonId: G_EVOLVED,
      oldPokemonData: {
        id: upId,
        pokemonId: G_BASE,
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
        [userId, G_EVOLVED]
      )
    ).rows
    const female = links.find(l => l.source === 'female')
    assert.ok(female, 'evolved record should have a female source')
    assert.equal(female.source_id, evolvedFemaleId)
    assert.equal(female.is_inherited, false)
  })
})
