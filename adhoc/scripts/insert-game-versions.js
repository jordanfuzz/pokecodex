import pgPool from '../pg-pool.js'
import gameVersions from '../pokeapi-data/game-spinoffs.json' assert { type: 'json' }

async function insertGameVersions() {
  for await (const game of gameVersions) {
    const { id, identifier, generation_id, is_spinoff } = game

    pgPool.query(
      `insert into game_versions (id, name, generation_id, is_spinoff)
      values ($1, $2, $3, $4);`,
      [id, identifier, generation_id, is_spinoff]
    )
  }
}

insertGameVersions()
