import pgPool from '../pg-pool.js'
import pokemonWithTypes from '../pokeapi-data/pokemon-with-types.json' assert { type: 'json' }

async function insertPokemon() {
  for await (const pokemon of pokemonWithTypes) {
    const {
      id,
      name,
      type1,
      type2,
      icon,
      defaultImage,
      femaleImage,
      shinyImage,
      bulbapediaLink,
      hasGenderDifferences,
      originalGen,
    } = pokemon

    pgPool.query(
      `insert into pokemon (id, name, type1, type2, icon, default_image, female_image, shiny_image, bulbapedia_link, has_gender_differences, original_gen)
    values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11);`,
      [
        id,
        name,
        type1,
        type2,
        icon,
        defaultImage,
        femaleImage,
        shinyImage,
        bulbapediaLink,
        hasGenderDifferences,
        originalGen,
      ]
    )
  }
}

insertPokemon()
