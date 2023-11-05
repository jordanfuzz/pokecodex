import { randomUUID } from 'crypto'
import camelize from 'camelize'
import pgPool from '../pg-pool.js'

// Do not camelize
export const getRulesForUser = userId => {
  return pgPool
    .query('select user_rules from users where id = $1;', [userId])
    .then(res => res.rows[0].user_rules)
    .catch(e => console.log(e))
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
    .catch(e => console.log(e))
}

export const getUserById = id => {
  console.log('Got here, getUserById')
  return pgPool
    .query(`select * from users where id = $1;`, [id])
    .then(res => camelize(res.rows[0]))
    .catch(e => console.log(e))
}

export const getUserByDiscordId = discordId => {
  console.log('Got here, getUserByDiscordId')

  return pgPool
    .query(`select * from users where discord_id = $1;`, [discordId])
    .then(res => camelize(res.rows[0]))
    .catch(e => console.log(e))
}

export const recordUserVisit = id => {
  console.log('Got here, recordUserVisit')

  const now = new Date().toISOString()

  return pgPool
    .query(
      `
  update users 
  set last_seen_at = $1 
  where id = $2;`,
      [now, id]
    )
    .catch(e => console.log(e))
}

export const saveNewUser = (discordId, discordUsername) => {
  console.log('Got here, saveNewUser')
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
    .catch(e => console.log(e))
}
