import fs from 'fs'
import { randomUUID } from 'crypto'
import rawPokemon from '../pokeapi-data/pokemon-species.json' assert { type: 'json' }
import allPokemon from '../pokeapi-data/pokemon-raw.json' assert { type: 'json' }
import pokemonForms from '../pokeapi-data/pokemon-forms.json' assert { type: 'json' }

let basicSources = []
let regionalVariants = []
let otherVariants = []
let errors = []

// https://github.com/PokeAPI/pokeapi/blob/master/data/v2/csv/version_groups.csv
const versionGenerationIds = [
  1, 1, 2, 2, 3, 3, 3, 4, 4, 4, 5, 3, 3, 5, 6, 6, 7, 7, 7, 8, 8, 8, 8, 8,
]

for (let i = 201; i <= 201; i++) {
  const pokemon = rawPokemon.find(pokemon => pokemon.id === i)

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
    description:
      'This pokemon was caught in the first generation in which it appeared.',
    gen: pokemon.generation_id,
    source: 'original',
  }
  basicSources.push(shinySource)
  basicSources.push(wildSource)
  basicSources.push(originalSource)

  const allVariantIds = allPokemon
    .filter(mon => mon.species_id === pokemon.id)
    .map(mon => mon.id)

  allVariantIds.forEach(id => {
    const variant = pokemonForms.find(form => form.pokemon_id === id)
    if (['alola', 'galar', 'hisui'].includes(variant.form_identifier)) {
      const regionName =
        variant.form_identifier.charAt(0).toUpperCase() +
        variant.form_identifier.slice(1)
      const regionalVariantSource = {
        id: randomUUID(),
        pokemonId: pokemon.id,
        name: regionName,
        description: `A variant only found in the ${regionName} Region.`,
        image: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${variant.pokemon_id}.png`,
        gen: versionGenerationIds[variant.introduced_in_version_group_id - 1],
        source: 'regional',
      }
      regionalVariants.push(regionalVariantSource)
    } else if (variant.is_mega) {
      const megaVariantSource = {
        id: randomUUID(),
        pokemonId: pokemon.id,
        name: 'Mega Evolution',
        image: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${variant.pokemon_id}.png`,
        gen: versionGenerationIds[variant.introduced_in_version_group_id - 1],
        source: 'mega',
      }
      otherVariants.push(megaVariantSource)
    } else if (variant.form_identifier === 'gmax') {
      const gmaxVariantSource = {
        id: randomUUID(),
        pokemonId: pokemon.id,
        name: 'Gigantamax',
        image: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${variant.pokemon_id}.png`,
        gen: 8,
        source: 'gmax',
      }
      otherVariants.push(gmaxVariantSource)
    } else if (variant.is_battle_only) {
      const battleOnlyVariantSource = {
        id: randomUUID(),
        pokemonId: pokemon.id,
        name: 'Battle-only Form',
        image: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${variant.pokemon_id}.png`,
        gen: versionGenerationIds[variant.introduced_in_version_group_id - 1],
        source: 'battle-only',
      }
      otherVariants.push(battleOnlyVariantSource)
    } else errors.push(variant)
  })
}

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
