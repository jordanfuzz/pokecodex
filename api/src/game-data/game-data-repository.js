import pgPool from '../pg-pool.js'
import camelize from 'camelize'

export const getAllPokeballs = () => {
  return pgPool.query('select * from pokeballs;').then(res => camelize(res.rows))
}

export const getAllGameVersions = () => {
  return pgPool.query('select * from game_versions;').then(res => camelize(res.rows))
}
