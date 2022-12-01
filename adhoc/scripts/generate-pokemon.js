const fs = require('fs')
const rawPokemon = require('../pokeapi-data/pokemon-species.json')
const pokemonTypes = require('../pokeapi-data/pokemon-types.json')

const types = [
  'normal',
  'fighting',
  'flying',
  'poison',
  'ground',
  'rock',
  'bug',
  'ghost',
  'steel',
  'fire',
  'water',
  'grass',
  'electric',
  'psychic',
  'ice',
  'dragon',
  'dark',
  'fairy',
]

let pokemonWithTypes = []
for (let i = 1; i <= 898; i++) {
  const pokemon = rawPokemon.find(pokemon => pokemon.id === i)

  let rawTypes = pokemonTypes.filter(
    pokemonType => pokemonType.pokemon_id === pokemon.id
  )

  const pokemonName =
    pokemon.identifier.charAt(0).toUpperCase() + pokemon.identifier.slice(1)

  const hasGenderDifferences = !!pokemon.has_gender_differences

  const singlePokemon = {
    id: i,
    name: pokemonName,
    type1: types[rawTypes.find(type => type.slot === 1).type_id - 1],
    type2: types[rawTypes.find(type => type.slot === 2)?.type_id - 1] || null,
    originalGen: pokemon.generation_id,
    hasGenderDifferences,
    bulbapediaLink: `https://bulbapedia.bulbagarden.net/wiki/${pokemonName.replace(
      '-',
      '_'
    )}_(Pok%C3%A9mon)`,
    icon: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-viii/icons/${i}.png`,
    defaultImage: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${i}.png`,
    femaleImage: hasGenderDifferences
      ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/female/${i}.png`
      : null,
    shinyImage: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/${i}.png`,
  }

  pokemonWithTypes.push(singlePokemon)
}

fs.writeFile(
  'pokemon-with-types.json',
  JSON.stringify(pokemonWithTypes),
  'utf8',
  () => {
    console.log('Done!')
  }
)
