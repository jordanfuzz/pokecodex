import Pokedex from 'pokedex-promise-v2'
import { randomUUID } from 'crypto'
import pgPool from '../pg-pool.js'

const pokedex = new Pokedex()

const insertSources = async (recordsToSet, offset = 1) => {
  console.log('Starting at: ', offset)
  let skippedPokemon = []
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
      console.log(error)
      continue
    }

    const recursivelyAddSourceToEvolution = async chainLink => {
      const { evolves_to } = chainLink

      if (evolves_to && evolves_to.length) {
        evolves_to.forEach(async evolution => {
          const evolutionName = evolution.species.name

          const insertQuery = `
          insert into sources (id, pokemon_id, name, gen, source)
          values ($1, $2, $3, $4, $5);
        `
          const sourceId = randomUUID()
          const pokemon = await pgPool
            .query('select id from pokemon where LOWER(name) = LOWER($1)', [
              evolutionName,
            ])
            .then(res => res.rows[0])

          if (!pokemon || !pokemon.id) {
            skippedPokemon.push(evolutionName)
            console.log(evolutionName, ' not found in database. Skipping.')
          } else {
            const existingSource = await pgPool
              .query('select * from sources where pokemon_id = $1 and source = $2', [
                pokemon.id,
                'evolved',
              ])
              .then(res => res.rows[0])

            if (existingSource) {
              console.log('Source already exists for ', pokemon.id)
              return
            }
            console.log('Inserting ', evolutionName)
            await pgPool.query(insertQuery, [
              sourceId,
              pokemon.id,
              'Evolved',
              0,
              'evolved',
            ])
            console.log('Done inserting ', evolutionName)
          }
          await recursivelyAddSourceToEvolution(evolution)
        })
      }
    }

    await recursivelyAddSourceToEvolution(evolutionChain.chain)
    console.log('Done with ', i)
  }
  console.log('Skipped: ', skippedPokemon)
}

insertSources(100, 446)

// const totalSkipped2 = ['dipplin', 'sinistcha']

// const totalSkipped = [
//   'annihilape',
//   'kleavor',
//   'clodsire',
//   'farigiraf',
//   'dudunsparce',
//   'overqwil',
//   'sneasler',
//   'ursaluna',
//   'wyrdeer',
//   'basculegion',
//   'kingambit',
//   'dipplin',
//   'floragato',
//   'meowscarada',
//   'crocalor',
//   'skeledirge',
//   'quaxwell',
//   'quaquaval',
//   'oinkologne',
//   'spidops',
//   'lokix',
//   'pawmo',
//   'pawmot',
//   'maushold',
//   'dachsbun',
//   'dolliv',
//   'arboliva',
//   'naclstack',
//   'garganacl',
//   'armarouge',
//   'ceruledge',
//   'bellibolt',
//   'kilowattrel',
//   'mabosstiff',
//   'grafaiai',
//   'brambleghast',
//   'toedscruel',
//   'scovillain',
//   'rabsca',
//   'espathra',
//   'tinkatuff',
//   'tinkaton',
//   'wugtrio',
//   'palafin',
//   'revavroom',
//   'glimmora',
//   'houndstone',
// ]
// Stopped at 511
