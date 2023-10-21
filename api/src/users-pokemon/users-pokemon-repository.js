import pgPool from '../pg-pool.js'
import camelize from 'camelize'
import { randomUUID } from 'crypto'

const selectQuery = `
select up.id, up.notes, up.pokemon_id, up.pokeball, up.user_id, 
up.caught_at, gv.name as "gameVersion", gv.generation_id as "gen" 
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
      where users_pokemon_id = $1;`,
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
    .then(res => getBoxDataForUser(userId))
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
