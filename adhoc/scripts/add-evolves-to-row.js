import Pokedex from 'pokedex-promise-v2'
import pgPool from '../pg-pool.js'

const pokedex = new Pokedex()

const addEvolutions = async (recordsToSet, offset = 1) => {
  console.log('Starting at: ', offset)
  const maxPokemonEvolutionChain = 543
  if (offset + recordsToSet > maxPokemonEvolutionChain)
    offset = maxPokemonEvolutionChain - recordsToSet

  for (let i = offset; i <= offset + recordsToSet; i++) {
    console.log('Fetching evolution chain for: ', i)
    let evolutionChain
    try {
      evolutionChain = await pokedex.getEvolutionChainById(i)
    } catch (error) {
      console.log('Error fetching evolution chain for: ', i)
      console.log(error.message)
      continue
    }

    const recursivelyAddEvolutions = async chainLink => {
      const { evolves_to } = chainLink
      const pokemonName = chainLink.species.name

      if (evolves_to && evolves_to.length) {
        console.log('Adding evolutions for ', pokemonName)
        const pokemon = await pgPool
          .query('select id from pokemon where LOWER(name) = LOWER($1)', [pokemonName])
          .then(res => res.rows[0])

        if (!pokemon || !pokemon.id) {
          console.log(pokemonName, ' not found in database. Skipping.')
        }

        const pokemonToAddAsEvolutions = evolves_to.map(evolution =>
          evolution.species.name.toLowerCase()
        )

        const { rows } = await pgPool.query(
          'SELECT id FROM pokemon WHERE LOWER(name) = ANY($1::text[])',
          [pokemonToAddAsEvolutions]
        )
        if (!rows.length) return
        const pokemonIds = rows.map(row => row.id)

        const updateQuery = `
          update pokemon
          set evolves_to = $1
          where id = $2
        `
        await pgPool.query(updateQuery, [pokemonIds, pokemon.id])
        // add evolutions (const evolutions = evolves_to.map(evolution => evolution.species.id)
        // repeat for others
        evolves_to.forEach(async evolution => {
          await recursivelyAddEvolutions(evolution)
        })
      } else console.log('No evolutions for ', pokemonName)
    }
    await recursivelyAddEvolutions(evolutionChain.chain)
    console.log('Done with ', i)
  }
}

addEvolutions(10, 538)
