import { randomUUID } from 'crypto'
import camelize from 'camelize'
import pgPool from '../pg-pool.js'

// Bulk map for the completion engine: { [sourceId]: isRequired }
// Not camelized: source ids are uuids with hyphens, and camelize mangles
// hyphenated object keys, silently dropping every override.
export const getSourceOverridesForUser = userId => {
  return pgPool
    .query(
      'select source_id, is_required from users_source_overrides where user_id = $1;',
      [userId]
    )
    .then(res => Object.fromEntries(res.rows.map(r => [r.source_id, r.is_required])))
}

export const getSourceOverridesForUserAndPokemon = (userId, pokemonId) => {
  return pgPool
    .query(
      `select uso.source_id, uso.is_required
      from users_source_overrides uso
      join sources s on s.id = uso.source_id
      where uso.user_id = $1 and s.pokemon_id = $2;`,
      [userId, pokemonId]
    )
    .then(res => camelize(res.rows))
}

export const upsertSourceOverride = (userId, sourceId, isRequired) => {
  return pgPool
    .query(
      `insert into users_source_overrides(id, user_id, source_id, is_required)
      values($1, $2, $3, $4)
      on conflict (user_id, source_id) do update set is_required = $4
      returning *;`,
      [randomUUID(), userId, sourceId, isRequired]
    )
    .then(res => camelize(res.rows[0]))
}

export const deleteSourceOverride = (userId, sourceId) => {
  return pgPool.query(
    'delete from users_source_overrides where user_id = $1 and source_id = $2;',
    [userId, sourceId]
  )
}
