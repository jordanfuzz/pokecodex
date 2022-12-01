import pgPool from '../pg-pool.js'
import camelize from 'camelize'
import { randomUUID } from 'crypto'

export const getSourcesForPokemon = pokemonId => {
  return pgPool
    .query('select * from sources where pokemon_id = $1;', [pokemonId])
    .then(res => camelize(res.rows))
}

export const addSourceForPokemon = (sourceData, pokemonId) => {
  const { name, source, gen, image, description } = sourceData

  return pgPool
    .query(
      `insert into sources(id, pokemon_id, name, description, image, gen, source)
    values($1, $2, $3, $4, $5, $6, $7);`,
      [randomUUID(), pokemonId, name, description, image, gen, source]
    )
    .then(() => {
      return pgPool
        .query('select * from sources where pokemon_id = $1;', [pokemonId])
        .then(res => camelize(res.rows))
    })
}
