import pgPool from '../pg-pool.js'
import camelize from 'camelize'

export const getSourcesForPokemon = pokemonId => {
  return pgPool
    .query('select * from sources where pokemon_id = $1;', [pokemonId])
    .then(res => camelize(res.rows))
}
