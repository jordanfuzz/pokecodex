import pgPool from '../pg-pool.js'
import camelize from 'camelize'
import { randomUUID } from 'crypto'

export const getAllForUserAndPokemon = (userId, pokemonId) => {
  return pgPool
    .query('select * from users_pokemon where user_id = $1 and pokemon_id = $2;', [
      userId,
      pokemonId,
    ])
    .then(res => camelize(res.rows))
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
      ).then(() => {
        return pgPool
          .query('select * from users_pokemon where user_id = $1 and pokemon_id = $2;', [
            userId,
            pokemonId,
          ])
          .then(res => camelize(res.rows))
      })
    })
}
