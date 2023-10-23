import pgPool from '../pg-pool.js'
import camelize from 'camelize'
import { randomUUID } from 'crypto'

export const getSourcesForPokemon = pokemonId => {
  return pgPool
    .query('select * from sources where pokemon_id = $1;', [pokemonId])
    .then(res => camelize(res.rows))
}

export const addSourceForPokemon = async (sourceData, pokemonId, userId) => {
  const { name, source, gen, image, description, replaceDefault } = sourceData

  const userIsAdmin = await pgPool
    .query('select is_admin from users where id = $1;', [userId])
    .then(res => res.rows[0].is_admin)

  if (!userIsAdmin) return null

  return pgPool
    .query(
      `insert into sources(id, pokemon_id, name, description, image, gen, source, replace_default)
    values($1, $2, $3, $4, $5, $6, $7, $8);`,
      [randomUUID(), pokemonId, name, description, image, gen, source, replaceDefault]
    )
    .then(() => {
      return pgPool
        .query('select * from sources where pokemon_id = $1;', [pokemonId])
        .then(res => camelize(res.rows))
    })
}

export const getUsersPokemonSources = (userId, pokemonId) => {
  return pgPool
    .query(
      `select s.id, s.name, s.gen, up.id as "pokemonId" from sources s
    join users_pokemon_sources ups on ups.source_id = s.id
    join users_pokemon up on up.id = ups.users_pokemon_id
    where up.user_id = $1 and up.pokemon_id = $2;`,
      [userId, pokemonId]
    )
    .then(res => camelize(res.rows))
}
