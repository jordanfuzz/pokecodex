import pgPool from '../pg-pool.js'
import camelize from 'camelize'

export const getRulesForUser = userId => {
  return pgPool
    .query('select user_rules from users where id = $1;', [userId])
    .then(res => camelize(res.rows[0]).userRules)
}

export const updateRulesForUser = (rules, userId) => {
  return pgPool
    .query(
      `update users set user_rules = $1 
      where id = $2 returning *;`,
      [rules, userId]
    )
    .then(res => camelize(res.rows[0]).userRules)
}
