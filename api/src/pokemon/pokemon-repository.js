import pgPool from '../pg-pool.js'
import camelize from 'camelize'

export const getAll = () => {
  return pgPool
    .query('select * from pokemon order by id;')
    .then(res => camelize(res.rows))
}
