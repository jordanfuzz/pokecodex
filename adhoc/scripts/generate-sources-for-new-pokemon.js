import fs from 'fs'
import { randomUUID } from 'crypto'
import pokemonSpecies from '../pokeapi-data/updated-pokemon-species.json' assert { type: 'json' }
import pgPool from '../pg-pool.js'

// import allPokemon from '../pokeapi-data/updated-pokemon-raw.json' assert { type: 'json' }
// import pokemonForms from '../pokeapi-data/updated-pokemon-forms.json' assert { type: 'json' }

let basicSources = []
// let regionalVariants = []
// let otherVariants = []
// let errors = []

// https://github.com/PokeAPI/pokeapi/blob/master/data/v2/csv/version_groups.csv
// const versionGenerationIds = [
//   1, 1, 2, 2, 3, 3, 3, 4, 4, 4, 5, 3, 3, 5, 6, 6, 7, 7, 7, 8, 8, 8, 8, 8, 9, 9, 9,
// ]

const startersByGeneration = [
  [1, 4, 7],
  [152, 155, 158],
  [252, 255, 258],
  [387, 390, 393],
  [495, 498, 501],
  [650, 653, 656],
  [722, 725, 728],
  [810, 813, 816],
  [906, 909, 912],
]

const virgins = [
  144, 145, 146, 150, 151, 201, 243, 244, 245, 249, 250, 251, 377, 378, 379, 380, 381,
  382, 383, 384, 385, 386, 480, 481, 482, 483, 484, 485, 486, 487, 488, 491, 492, 493,
  494, 638, 639, 640, 641, 642, 643, 644, 645, 646, 647, 648, 649, 716, 717, 718, 719,
  720, 721, 772, 773, 785, 786, 787, 788, 789, 790, 791, 792, 793, 794, 795, 796, 797,
  798, 799, 800, 801, 802, 803, 804, 805, 806, 807, 808, 809, 880, 881, 882, 883, 888,
  889, 890, 891, 892, 893, 894, 895, 896, 897, 898, 905, 984, 985, 986, 987, 988, 989,
  990, 991, 992, 993, 994, 995, 999, 1000, 1001, 1002, 1003, 1004, 1005, 1006, 1007, 1008,
  1009, 1010, 1014, 1015, 1016, 1017,
]

for (let i = 899; i <= 1010; i++) {
  const pokemon = pokemonSpecies.find(pokemon => pokemon.id === i)

  const hasGenderDifferences = !!pokemon.has_gender_differences

  if (hasGenderDifferences) {
    const maleSource = {
      id: randomUUID(),
      pokemonId: pokemon.id,
      name: 'Male',
      image: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemon.id}.png`,
      gen: 0,
      source: 'male',
    }
    const femaleSource = {
      id: randomUUID(),
      pokemonId: pokemon.id,
      name: 'Female',
      image: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/female/${pokemon.id}.png`,
      gen: 0,
      source: 'female',
    }
    basicSources.push(maleSource)
    basicSources.push(femaleSource)
  }

  const shinySource = {
    id: randomUUID(),
    pokemonId: pokemon.id,
    name: 'Shiny',
    image: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/${pokemon.id}.png`,
    gen: 0,
    source: 'shiny',
  }
  const wildSource = {
    id: randomUUID(),
    pokemonId: pokemon.id,
    name: 'Wild',
    gen: 0,
    source: 'wild',
  }
  const originalSource = {
    id: randomUUID(),
    pokemonId: pokemon.id,
    name: 'From home region',
    description: 'This pokemon was caught in the first generation in which it appeared.',
    gen: pokemon.generation_id,
    source: 'original',
  }
  const hatchSource = {
    id: randomUUID(),
    pokemonId: i,
    name: 'Hatch',
    gen: 0,
    source: 'hatch',
  }

  const starterGeneration = startersByGeneration.findIndex(x => x.includes(i)) + 1
  const starterSource = {
    id: randomUUID(),
    pokemonId: i,
    name: 'Starter',
    gen: startersByGeneration.findIndex(x => x.includes(i)) + 1,
    source: 'starter',
  }

  if (!virgins.includes(i)) basicSources.push(hatchSource)
  if (starterGeneration > 0) basicSources.push(starterSource)
  basicSources.push(shinySource)
  basicSources.push(wildSource)
  basicSources.push(originalSource)
}

async function insertSources() {
  for await (const basicSource of basicSources) {
    const { id, pokemonId, name, gen, source } = basicSource

    pgPool.query(
      `insert into sources (id, pokemon_id, name, gen, source)
    values ($1, $2, $3, $4, $5);`,
      [id, pokemonId, name, gen, source]
    )
  }
}

insertSources()

// const allVariantIds = allPokemon
//   .filter(mon => mon.species_id === pokemon.id)
//   .map(mon => mon.id)

// I don't know why I didn't do these for the other pokemon?

// allVariantIds.forEach(id => {
//   const variant = pokemonForms.find(form => form.pokemon_id === id)
//   if (['alola', 'galar', 'hisui', 'paldea'].includes(variant.form_identifier)) {
//     const regionName =
//       variant.form_identifier.charAt(0).toUpperCase() + variant.form_identifier.slice(1)
//     const regionalVariantSource = {
//       id: randomUUID(),
//       pokemonId: pokemon.id,
//       name: regionName,
//       description: `A variant only found in the ${regionName} Region.`,
//       image: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${variant.pokemon_id}.png`,
//       gen: versionGenerationIds[variant.introduced_in_version_group_id - 1],
//       source: 'regional',
//     }
//     regionalVariants.push(regionalVariantSource)
//   } else if (variant.is_mega) {
//     const megaVariantSource = {
//       id: randomUUID(),
//       pokemonId: pokemon.id,
//       name: 'Mega Evolution',
//       image: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${variant.pokemon_id}.png`,
//       gen: versionGenerationIds[variant.introduced_in_version_group_id - 1],
//       source: 'mega',
//     }
//     otherVariants.push(megaVariantSource)
//   } else if (variant.form_identifier === 'gmax') {
//     const gmaxVariantSource = {
//       id: randomUUID(),
//       pokemonId: pokemon.id,
//       name: 'Gigantamax',
//       image: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${variant.pokemon_id}.png`,
//       gen: 8,
//       source: 'gmax',
//     }
//     otherVariants.push(gmaxVariantSource)
//   } else if (variant.is_battle_only) {
//     const battleOnlyVariantSource = {
//       id: randomUUID(),
//       pokemonId: pokemon.id,
//       name: 'Battle-only Form',
//       image: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${variant.pokemon_id}.png`,
//       gen: versionGenerationIds[variant.introduced_in_version_group_id - 1],
//       source: 'battle-only',
//     }
//     otherVariants.push(battleOnlyVariantSource)
//   } else errors.push(variant)
// })

// fs.writeFileSync('basic-sources.json', JSON.stringify(basicSources), 'utf8')
// console.log('Done with basic-sources.json!')

// fs.writeFileSync(
//   'regional-variants.json',
//   JSON.stringify(regionalVariants),
//   'utf8'
// )
// console.log('Done with regional-variants.json!')

// fs.writeFileSync('other-variants.json', JSON.stringify(otherVariants), 'utf8')
// console.log('Done with other-variants.json!')

// fs.writeFileSync('error.json', JSON.stringify(errors), 'utf8')
// console.log('Wrote errors to error.json!')
