import pgPool from '../pg-pool.js'
import camelize from 'camelize'

// TODO: sources_by_game might not work for specific sources(unown m), and is instead checking for source type (male)
// might need to get sourceId instead of s.source
const pokemonWithSourcesQuery = `
select p.id, p."name", p.type1, p.type2, p.icon, p.default_image, p.female_image, p.shiny_image, p.bulbapedia_link, p.has_gender_differences, p.original_gen, 
JSON_AGG(distinct(s.source)) users_sources, JSON_AGG(distinct(s2.source)) sources, JSON_AGG(distinct(s.source || ':' || gv.generation_id)) sources_by_game
from pokemon p
left join users_pokemon up on up.pokemon_id = p.id and up.user_id = $1
left join users_pokemon_sources ups on ups.users_pokemon_id = up.id
left join sources s on s.id = ups.source_id and ups.users_pokemon_id = up.id
left join sources s2 on s2.pokemon_id = p.id
left join game_versions gv on gv.id = up.game_id
group by p.id, p."name", p.type1, p.type2, p.icon, p.default_image, p.female_image, p.shiny_image, p.bulbapedia_link, p.has_gender_differences, p.original_gen
order by p.id;`

export const getAllForUser = userId => {
  return pgPool.query(pokemonWithSourcesQuery, [userId]).then(res =>
    pgPool
      .query(`select user_rules from users where id = $1;`, [userId])
      .then(rulesRes => {
        const pokemon = camelize(res.rows)
        const rules = camelize(rulesRes.rows[0]).userRules

        let neededRules = []
        for (const [key, value] of Object.entries(rules)) {
          if (value) neededRules.push(key)
        }

        if (neededRules.includes('gender'))
          neededRules.splice(neededRules.indexOf('gender'), 1, 'male', 'female')

        return pokemon.map(mon => {
          let userHasCompletedRecord = false
          const newRules = neededRules.filter(rule => mon.sources.includes(rule))

          if (!newRules.length) {
            if (mon.usersSources[0]) userHasCompletedRecord = true
          } else
            userHasCompletedRecord = newRules.every(rule =>
              mon.usersSources.includes(rule)
            )

          let sourceGens = {
            all: [],
          }

          if (!mon.sourcesByGame || !mon.sourcesByGame.length || !mon.sourcesByGame[0]) {
            sourceGens = null
          } else {
            mon.sourcesByGame.forEach(source => {
              const [sourceName, gen] = source.split(':')
              if (!sourceGens[sourceName]) sourceGens[sourceName] = []

              sourceGens[sourceName].push(gen)
              sourceGens.all.push(gen)
            })
          }

          return Object.assign({}, mon, {
            isComplete: userHasCompletedRecord,
            sourceGens,
          })
        })
      })
  )
}
