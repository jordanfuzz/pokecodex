import pgPool from '../pg-pool.js'
import camelize from 'camelize'
import {
  checkIfUserHasCompletedRecord,
  getUsersSourcesByGen,
  getSourcesByType,
  getNeededRules,
} from './pokemon-utils.js'

const pokemonWithSourcesQuery = `
select p.id, p."name", p.type1, p.type2, p.icon, p.default_image, p.bulbapedia_link, p.has_gender_differences, p.original_gen, 
json_agg(distinct(s.source)) users_sources, 
json_agg(distinct(s2.source)) sources, 
json_agg(distinct(jsonb_build_object('type', s2.source, 'name', s2.name, 'image', s2.image, 'replace_default', s2.replace_default, 'first_gen', s2.gen))) sources_by_type,
json_agg(distinct(jsonb_build_object('source', s.source, 'name', s.name, 'gen', gv.generation_id))) users_sources_by_gen
from pokemon p
left join users_pokemon up on up.pokemon_id = p.id and up.user_id = $1
left join users_pokemon_sources ups on ups.users_pokemon_id = up.id
left join sources s on s.id = ups.source_id and ups.users_pokemon_id = up.id
left join sources s2 on s2.pokemon_id = p.id
left join game_versions gv on gv.id = up.game_id
group by p.id, p."name", p.type1, p.type2, p.icon, p.default_image, p.bulbapedia_link, p.has_gender_differences, p.original_gen
order by p.id;`

export const getAllForUser = userId => {
  return pgPool.query(pokemonWithSourcesQuery, [userId]).then(res =>
    pgPool
      .query(`select user_rules from users where id = $1;`, [userId])
      .then(rulesRes => {
        const pokemon = camelize(res.rows)
        const rules = camelize(rulesRes.rows[0]).userRules
        const neededRules = getNeededRules(rules)

        return pokemon.map(mon => {
          // TODO: might need to change this to userHasCompletedRecordByGen
          const userHasCompletedRecord = checkIfUserHasCompletedRecord(mon, neededRules)
          const [sourcesByType, imagesBySource] = getSourcesByType(mon)
          const usersSourcesByGen = getUsersSourcesByGen(mon)

          return Object.assign({}, mon, {
            isComplete: userHasCompletedRecord,
            sourcesByType,
            usersSourcesByGen,
            imagesBySource,
          })
        })
      })
  )
}
