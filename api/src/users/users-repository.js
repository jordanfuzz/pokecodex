import { randomUUID } from 'crypto'
import camelize from 'camelize'
import pgPool from '../pg-pool.js'

// Do not camelize
export const getRulesForUser = userId => {
  return pgPool
    .query('select user_rules from users where id = $1;', [userId])
    .then(res => res.rows[0].user_rules)
    .catch(() => null)
}

// Do not camelize
export const updateRulesForUser = (rules, userId) => {
  return pgPool
    .query(
      `update users set user_rules = $1 
      where id = $2 returning *;`,
      [rules, userId]
    )
    .then(res => res.rows[0].user_rules)
    .catch(() => null)
}

export const getUserById = id => {
  return pgPool
    .query(`select * from users where id = $1;`, [id])
    .then(res => camelize(res.rows[0]))
    .catch(() => null)
}

export const getUserByDiscordId = discordId => {
  return pgPool
    .query(`select * from users where discord_id = $1;`, [discordId])
    .then(res => camelize(res.rows[0]))
    .catch(() => null)
}

export const recordUserVisit = id => {
  const now = new Date().toISOString()

  return pgPool
    .query(
      `
  update users 
  set last_seen_at = $1 
  where id = $2;`,
      [now, id]
    )
    .catch(() => null)
}

export const saveNewUser = (discordId, discordUsername) => {
  const id = randomUUID()
  const now = new Date().toISOString()

  return pgPool
    .query(
      `
    insert into users(id, discord_id, discord_username, last_seen_at) 
    values($1, $2, $3, $4)
    returning *;
    `,
      [id, discordId, discordUsername, now]
    )
    .then(res => camelize(res.rows[0]))
    .catch(() => null)
}
