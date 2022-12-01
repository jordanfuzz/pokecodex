import pgPool from '../pg-pool.js'
import basicSources from '../pokeapi-data/basic-sources.json' assert { type: 'json' }

async function insertSources() {
  for await (const basicSource of basicSources) {
    const { id, pokemonId, name, description, image, gen, source } = basicSource

    pgPool.query(
      `insert into sources (id, pokemon_id, name, description, image, gen, source)
    values ($1, $2, $3, $4, $5, $6, $7);`,
      [id, pokemonId, name, description, image, gen, source]
    )
  }
}

insertSources()
