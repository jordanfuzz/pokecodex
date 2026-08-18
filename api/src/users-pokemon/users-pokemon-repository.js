import pgPool from '../pg-pool.js'
import camelize from 'camelize'
import { randomUUID } from 'crypto'

const selectQuery = `
select up.id, up.notes, up.pokemon_id, up.pokeball, up.user_id, 
up.caught_at, gv.name as "gameVersion", gv.id as "gameId", gv.generation_id as "gen" 
from users_pokemon up
join game_versions gv on gv.id = up.game_id 
where user_id = $1 and pokemon_id = $2
order by gv.generation_id, up.caught_at;`

export const getAllForUserAndPokemon = (userId, pokemonId) => {
  return pgPool.query(selectQuery, [userId, pokemonId]).then(res => camelize(res.rows))
}

export const updateNoteForUsersPokemon = noteData => {
  const { note, userId, pokemonId, usersPokemonId } = noteData

  return pgPool
    .query(`update users_pokemon set notes = $1 where id = $2;`, [note, usersPokemonId])
    .then(() => {
      return pgPool
        .query(selectQuery, [userId, pokemonId])
        .then(res => camelize(res.rows))
    })
}

export const updateUsersPokemon = pokemonData => {
  const { sources, pokeball, gameVersion, userId, pokemonId, usersPokemonId, caughtAt } =
    pokemonData

  return pgPool
    .query(
      `update users_pokemon 
      set pokeball = $1,
      user_id = $2,
      pokemon_id = $3,
      game_id = $4,
      caught_at = $5
      where id = $6;`,
      [pokeball, userId, pokemonId, gameVersion, caughtAt, usersPokemonId]
    )
    .then(() => {
      return pgPool.query(
        `delete from users_pokemon_sources 
      where users_pokemon_id = $1 and is_inherited = false;`,
        [usersPokemonId]
      )
    })
    .then(() => {
      return Promise.all(
        sources.map(sourceId => {
          return pgPool.query(
            `insert into users_pokemon_sources(id, users_pokemon_id, source_id)
          values($1, $2, $3);`,
            [randomUUID(), usersPokemonId, sourceId]
          )
        })
      )
    })
    .then(() => {
      return pgPool
        .query(selectQuery, [userId, pokemonId])
        .then(res => camelize(res.rows))
    })
}

export const addPokemonForUser = pokemonData => {
  const { userId, pokemonId, pokeball, gameVersion, sources } = pokemonData

  const usersPokemonId = randomUUID()

  return pgPool
    .query(
      `insert into users_pokemon (id, user_id, pokemon_id, game_id, pokeball, caught_at)
    values($1, $2, $3, $4, $5, $6)
    returning *;`,
      [usersPokemonId, userId, pokemonId, gameVersion, pokeball, new Date()]
    )
    .then(() => {
      return Promise.all(
        sources.map(sourceId => {
          return pgPool.query(
            `insert into users_pokemon_sources(id, users_pokemon_id, source_id)
            values($1, $2, $3);`,
            [randomUUID(), usersPokemonId, sourceId]
          )
        })
      )
    })
    .then(() => {
      return pgPool
        .query(selectQuery, [userId, pokemonId])
        .then(res => camelize(res.rows))
    })
}

export const evolveUsersPokemon = async pokemonData => {
  const { userId, evolvedPokemonId, oldPokemonData } = pokemonData
  const { pokeball, gameId, caughtAt, id: usersPokemonId, pokemonId, notes } =
    oldPokemonData

  const evolvedUsersPokemonId = randomUUID()
  const client = await pgPool.connect()

  try {
    await client.query('BEGIN')

    await client.query(
      `insert into users_pokemon (id, user_id, pokemon_id, notes, game_id, pokeball, caught_at)
      values($1, $2, $3, $4, $5, $6, $7);`,
      [evolvedUsersPokemonId, userId, evolvedPokemonId, notes ?? null, gameId, pokeball, caughtAt]
    )

    // Never inherit an old 'evolved' source (prevents double evolved tags).
    await client.query(
      `delete from users_pokemon_sources
      where users_pokemon_id = $1
      and source_id in (select id from sources where source = 'evolved');`,
      [usersPokemonId]
    )

    // A shiny base evolves into a shiny evolution: swap the base's shiny link
    // for the evolved pokemon's own shiny source, non-inherited.
    const baseShinyLink = await client
      .query(
        `select ups.id from users_pokemon_sources ups
        join sources s on s.id = ups.source_id
        where ups.users_pokemon_id = $1 and s.source = 'shiny';`,
        [usersPokemonId]
      )
      .then(res => res.rows[0])

    if (baseShinyLink) {
      const evolvedShinyId = await client
        .query(`select id from sources where source = 'shiny' and pokemon_id = $1;`, [
          evolvedPokemonId,
        ])
        .then(res => res.rows[0]?.id)

      await client.query(`delete from users_pokemon_sources where id = $1;`, [
        baseShinyLink.id,
      ])
      if (evolvedShinyId)
        await client.query(
          `insert into users_pokemon_sources(id, users_pokemon_id, source_id)
          values($1, $2, $3);`,
          [randomUUID(), evolvedUsersPokemonId, evolvedShinyId]
        )
    }

    // Everything else moves to the evolution as inherited.
    await client.query(
      `update users_pokemon_sources
      set users_pokemon_id = $1, is_inherited = true
      where users_pokemon_id = $2;`,
      [evolvedUsersPokemonId, usersPokemonId]
    )

    await client.query(`delete from users_pokemon where id = $1;`, [usersPokemonId])

    const evolutionSourceId = await client
      .query(`select id from sources where source = 'evolved' and pokemon_id = $1;`, [
        evolvedPokemonId,
      ])
      .then(res => res.rows[0]?.id)
    if (evolutionSourceId)
      await client.query(
        `insert into users_pokemon_sources(id, users_pokemon_id, source_id)
        values($1, $2, $3);`,
        [randomUUID(), evolvedUsersPokemonId, evolutionSourceId]
      )

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }

  return pgPool.query(selectQuery, [userId, pokemonId]).then(res => camelize(res.rows))
}

export const deleteUsersPokemon = pokemonData => {
  const { userId, pokemonId, usersPokemonId } = pokemonData

  return pgPool
    .query(`delete from users_pokemon_sources where users_pokemon_id = $1;`, [
      usersPokemonId,
    ])
    .then(() => {
      return pgPool.query(`delete from users_pokemon where id = $1;`, [usersPokemonId])
    })
    .then(() => {
      return pgPool
        .query(selectQuery, [userId, pokemonId])
        .then(res => camelize(res.rows))
    })
}

export const getBoxDataForUser = userId => {
  const boxDataQuery = 'select * from users_box_data where user_id = $1;'
  return pgPool
    .query(boxDataQuery, [userId])
    .then(res => (res.rows[0] ? camelize(res.rows) : null))
}

export const updateUsersBoxData = (completeRecords, userId, gameId) => {
  const boxDataQuery = `
  update users_box_data
  set complete_records = $1
  where user_id = $2 and game_id = $3
  returning *;`

  return pgPool
    .query(boxDataQuery, [JSON.stringify(completeRecords), userId, gameId])
    .then(() => getBoxDataForUser(userId))
}

export const setupBoxDataForUser = userId => {
  const getGameVersionsQuery = `
  select id from game_versions
  where box_size is not null;`

  return pgPool.query(getGameVersionsQuery).then(res => {
    const setupBoxQuery = `
    insert into users_box_data(id, user_id, game_id, complete_records)
    values($1, $2, $3, $4)
    returning *;`

    const gameVersions = camelize(res.rows)
    const boxData = gameVersions.map(game => {
      return {
        id: randomUUID(),
        userId,
        gameId: game.id,
        completeRecords: [],
      }
    })

    const promises = boxData.map(boxDataEntry => {
      return pgPool.query(setupBoxQuery, [
        boxDataEntry.id,
        boxDataEntry.userId,
        boxDataEntry.gameId,
        JSON.stringify(boxDataEntry.completeRecords),
      ])
    })

    return Promise.all(promises).then(res => camelize(res.map(r => r.rows[0])))
  })
}
