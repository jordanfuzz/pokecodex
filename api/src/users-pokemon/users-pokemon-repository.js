import pgPool from '../pg-pool.js'
import camelize from 'camelize'
import { randomUUID } from 'crypto'

const selectQuery = `
select up.id, up.notes, up.pokemon_id, up.pokeball, up.user_id, 
up.caught_at, gv.name as "gameVersion", gv.id as "gameId", gv.generation_id as "gen" 
from users_pokemon up
join game_versions gv on gv.id = up.game_id 
where user_id = $1 and pokemon_id = $2
order by gv.generation_id, up.caught_at;`

export const getAllForUserAndPokemon = (userId, pokemonId) => {
  return pgPool.query(selectQuery, [userId, pokemonId]).then(res => camelize(res.rows))
}

export const getHomeRegionCatchIds = (userId, pokemonId) => {
  return pgPool
    .query(
      `select up.id from users_pokemon up
      join game_versions gv on gv.id = up.game_id
      join pokemon p on p.id = up.pokemon_id
      where up.user_id = $1 and up.pokemon_id = $2
      and gv.generation_id = p.original_gen
      and gv.region is not null and gv.region = p.home_region;`,
      [userId, pokemonId]
    )
    .then(res => res.rows.map(r => r.id))
}

// The 'original' source is derived from catch data (see completion.js);
// storing a link would double-represent it, so write paths drop those ids.
const insertableSourceIds = sources => {
  if (!sources?.length) return Promise.resolve([])
  return pgPool
    .query(
      `select id from sources where id = any($1::uuid[]) and source <> 'original';`,
      [sources]
    )
    .then(res => res.rows.map(r => r.id))
}

export const updateNoteForUsersPokemon = noteData => {
  const { note, userId, pokemonId, usersPokemonId } = noteData

  return pgPool
    .query(`update users_pokemon set notes = $1 where id = $2 and user_id = $3;`, [
      note,
      usersPokemonId,
      userId,
    ])
    .then(() => {
      return pgPool
        .query(selectQuery, [userId, pokemonId])
        .then(res => camelize(res.rows))
    })
}

export const updateUsersPokemon = pokemonData => {
  const { sources, pokeball, gameVersion, userId, pokemonId, usersPokemonId, caughtAt } =
    pokemonData

  return pgPool
    .query(
      `update users_pokemon
      set pokeball = $1,
      pokemon_id = $2,
      game_id = $3,
      caught_at = $4
      where id = $5 and user_id = $6;`,
      [pokeball, pokemonId, gameVersion, caughtAt, usersPokemonId, userId]
    )
    .then(result => {
      // Ownership predicate failed: leave the row's sources untouched too.
      if (result.rowCount === 0) return
      return pgPool
        .query(
          `delete from users_pokemon_sources
      where users_pokemon_id = $1 and is_inherited = false;`,
          [usersPokemonId]
        )
        .then(() => insertableSourceIds(sources))
        .then(validSources => {
          return Promise.all(
            validSources.map(sourceId => {
              return pgPool.query(
                `insert into users_pokemon_sources(id, users_pokemon_id, source_id)
          values($1, $2, $3);`,
                [randomUUID(), usersPokemonId, sourceId]
              )
            })
          )
        })
    })
    .then(() => {
      return pgPool
        .query(selectQuery, [userId, pokemonId])
        .then(res => camelize(res.rows))
    })
}

export const addPokemonForUser = pokemonData => {
  const { userId, pokemonId, pokeball, gameVersion, sources } = pokemonData

  const usersPokemonId = randomUUID()

  return pgPool
    .query(
      `insert into users_pokemon (id, user_id, pokemon_id, game_id, pokeball, caught_at)
    values($1, $2, $3, $4, $5, $6)
    returning *;`,
      [usersPokemonId, userId, pokemonId, gameVersion, pokeball, new Date()]
    )
    .then(() => insertableSourceIds(sources))
    .then(validSources => {
      return Promise.all(
        validSources.map(sourceId => {
          return pgPool.query(
            `insert into users_pokemon_sources(id, users_pokemon_id, source_id)
            values($1, $2, $3);`,
            [randomUUID(), usersPokemonId, sourceId]
          )
        })
      )
    })
    .then(() => {
      return pgPool
        .query(selectQuery, [userId, pokemonId])
        .then(res => camelize(res.rows))
    })
}

export const evolveUsersPokemon = async pokemonData => {
  const { userId, evolvedPokemonId, oldPokemonData } = pokemonData
  const {
    pokeball,
    gameId,
    caughtAt,
    id: usersPokemonId,
    pokemonId,
    notes,
  } = oldPokemonData

  const evolvedUsersPokemonId = randomUUID()
  const client = await pgPool.connect()

  let aborted = false
  try {
    await client.query('BEGIN')

    const owned = await client.query(
      `select id from users_pokemon where id = $1 and user_id = $2 for update;`,
      [usersPokemonId, userId]
    )
    if (owned.rows.length === 0) {
      await client.query('ROLLBACK')
      aborted = true
    }

    if (!aborted) {
      await client.query(
        `insert into users_pokemon (id, user_id, pokemon_id, notes, game_id, pokeball, caught_at)
        values($1, $2, $3, $4, $5, $6, $7);`,
        [
          evolvedUsersPokemonId,
          userId,
          evolvedPokemonId,
          notes ?? null,
          gameId,
          pokeball,
          caughtAt,
        ]
      )

      // Never inherit an old 'evolved' source (prevents double evolved tags).
      await client.query(
        `delete from users_pokemon_sources
        where users_pokemon_id = $1
        and source_id in (select id from sources where source = 'evolved');`,
        [usersPokemonId]
      )

      // A shiny base evolves into a shiny evolution: swap the base's shiny link
      // for the evolved pokemon's own shiny source, non-inherited.
      const baseShinyLink = await client
        .query(
          `select ups.id from users_pokemon_sources ups
          join sources s on s.id = ups.source_id
          where ups.users_pokemon_id = $1 and s.source = 'shiny';`,
          [usersPokemonId]
        )
        .then(res => res.rows[0])

      if (baseShinyLink) {
        const evolvedShinyId = await client
          .query(`select id from sources where source = 'shiny' and pokemon_id = $1;`, [
            evolvedPokemonId,
          ])
          .then(res => res.rows[0]?.id)

        await client.query(`delete from users_pokemon_sources where id = $1;`, [
          baseShinyLink.id,
        ])
        if (evolvedShinyId)
          await client.query(
            `insert into users_pokemon_sources(id, users_pokemon_id, source_id)
            values($1, $2, $3);`,
            [randomUUID(), evolvedUsersPokemonId, evolvedShinyId]
          )
      }

      // Gender carries through evolution: swap the base's gender link for the
      // evolved pokemon's own gender source, non-inherited (same as shiny).
      for (const genderType of ['male', 'female']) {
        const baseGenderLink = await client
          .query(
            `select ups.id from users_pokemon_sources ups
            join sources s on s.id = ups.source_id
            where ups.users_pokemon_id = $1 and s.source = $2::source_type;`,
            [usersPokemonId, genderType]
          )
          .then(res => res.rows[0])

        if (baseGenderLink) {
          const evolvedGenderId = await client
            .query(
              `select id from sources where source = $1::source_type and pokemon_id = $2;`,
              [genderType, evolvedPokemonId]
            )
            .then(res => res.rows[0]?.id)

          await client.query(`delete from users_pokemon_sources where id = $1;`, [
            baseGenderLink.id,
          ])
          if (evolvedGenderId)
            await client.query(
              `insert into users_pokemon_sources(id, users_pokemon_id, source_id)
              values($1, $2, $3);`,
              [randomUUID(), evolvedUsersPokemonId, evolvedGenderId]
            )
        }
      }

      // Everything else moves to the evolution as inherited.
      await client.query(
        `update users_pokemon_sources
        set users_pokemon_id = $1, is_inherited = true
        where users_pokemon_id = $2;`,
        [evolvedUsersPokemonId, usersPokemonId]
      )

      await client.query(`delete from users_pokemon where id = $1;`, [usersPokemonId])

      const evolutionSourceId = await client
        .query(`select id from sources where source = 'evolved' and pokemon_id = $1;`, [
          evolvedPokemonId,
        ])
        .then(res => res.rows[0]?.id)
      if (evolutionSourceId)
        await client.query(
          `insert into users_pokemon_sources(id, users_pokemon_id, source_id)
          values($1, $2, $3);`,
          [randomUUID(), evolvedUsersPokemonId, evolutionSourceId]
        )

      await client.query('COMMIT')
    }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }

  return pgPool.query(selectQuery, [userId, pokemonId]).then(res => camelize(res.rows))
}

export const deleteUsersPokemon = pokemonData => {
  const { userId, pokemonId, usersPokemonId } = pokemonData

  return pgPool
    .query(
      `delete from users_pokemon_sources where users_pokemon_id in
      (select id from users_pokemon where id = $1 and user_id = $2);`,
      [usersPokemonId, userId]
    )
    .then(() => {
      return pgPool.query(
        `delete from users_pokemon where id = $1 and user_id = $2;`,
        [usersPokemonId, userId]
      )
    })
    .then(() => {
      return pgPool
        .query(selectQuery, [userId, pokemonId])
        .then(res => camelize(res.rows))
    })
}

export const getBoxDataForUser = userId => {
  const boxDataQuery = 'select * from users_box_data where user_id = $1;'
  return pgPool
    .query(boxDataQuery, [userId])
    .then(res => (res.rows[0] ? camelize(res.rows) : null))
}

export const updateUsersBoxData = (completeRecords, userId, gameId) => {
  const boxDataQuery = `
  update users_box_data
  set complete_records = $1
  where user_id = $2 and game_id = $3
  returning *;`

  return pgPool
    .query(boxDataQuery, [JSON.stringify(completeRecords), userId, gameId])
    .then(() => getBoxDataForUser(userId))
}

export const setupBoxDataForUser = userId => {
  const getGameVersionsQuery = `
  select id from game_versions
  where box_size is not null;`

  return pgPool.query(getGameVersionsQuery).then(res => {
    const setupBoxQuery = `
    insert into users_box_data(id, user_id, game_id, complete_records)
    values($1, $2, $3, $4)
    returning *;`

    const gameVersions = camelize(res.rows)
    const boxData = gameVersions.map(game => {
      return {
        id: randomUUID(),
        userId,
        gameId: game.id,
        completeRecords: [],
      }
    })

    const promises = boxData.map(boxDataEntry => {
      return pgPool.query(setupBoxQuery, [
        boxDataEntry.id,
        boxDataEntry.userId,
        boxDataEntry.gameId,
        JSON.stringify(boxDataEntry.completeRecords),
      ])
    })

    return Promise.all(promises).then(res => camelize(res.map(r => r.rows[0])))
  })
}
