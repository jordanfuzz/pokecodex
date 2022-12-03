import pgPool from '../pg-pool.js'
import camelize from 'camelize'

export const getAllForUserAndPokemon = (userId, pokemonId) => {
  return pgPool
    .query('select * from users_pokemon where user_id = $1 and pokemon_id = $2;', [
      userId,
      pokemonId,
    ])
    .then(res => camelize(res.rows))
}
