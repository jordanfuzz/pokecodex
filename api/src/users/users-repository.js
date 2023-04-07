import pgPool from '../pg-pool.js'
// Do not camelize

export const getRulesForUser = userId => {
  return pgPool
    .query('select user_rules from users where id = $1;', [userId])
    .then(res => res.rows[0].user_rules)
}

export const updateRulesForUser = (rules, userId) => {
  return pgPool
    .query(
      `update users set user_rules = $1 
      where id = $2 returning *;`,
      [rules, userId]
    )
    .then(res => res.rows[0].user_rules)
}
