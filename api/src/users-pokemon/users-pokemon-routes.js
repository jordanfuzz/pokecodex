import express from 'express'
const router = express.Router()
import {
  deleteUsersPokemon,
  getAllForUserAndPokemon,
  updateNoteForUsersPokemon,
  updateUsersPokemon,
  evolveUsersPokemon,
  getHomeRegionCatchIds,
} from './users-pokemon-repository.js'
import { getAllPokeballs, getAllGameVersions } from '../game-data/game-data-repository.js'
import {
  getUsersPokemonSources,
  getEvolutionSourcesForPokemon,
} from '../sources/sources-repository.js'
import { getSourceOverridesForUserAndPokemon } from '../users/source-overrides-repository.js'

router.get('/users-pokemon', async (req, res) => {
  const response = {
    usersPokemon: await getAllForUserAndPokemon(req.user.id, req.query.pokemonId),
    pokeballs: await getAllPokeballs(),
    gameVersions: await getAllGameVersions(),
  }
  res.status(200).send(response)
})

router.put('/users-pokemon', async (req, res) => {
  const userId = req.user.id
  const response = {
    usersPokemon: await updateUsersPokemon({ ...req.body, userId }),
    usersPokemonSources: await getUsersPokemonSources(userId, req.body.pokemonId),
    usersPokemonEvolutionSources: await getEvolutionSourcesForPokemon(
      userId,
      req.body.pokemonId
    ),
    usersSourceOverrides: await getSourceOverridesForUserAndPokemon(
      userId,
      req.body.pokemonId
    ),
    homeRegionCatchIds: await getHomeRegionCatchIds(userId, req.body.pokemonId),
  }
  res.status(200).send(response)
})

router.delete('/users-pokemon', async (req, res) => {
  const userId = req.user.id
  const response = {
    usersPokemon: await deleteUsersPokemon({ ...req.body, userId }),
    usersPokemonSources: await getUsersPokemonSources(userId, req.body.pokemonId),
    usersPokemonEvolutionSources: await getEvolutionSourcesForPokemon(
      userId,
      req.body.pokemonId
    ),
    homeRegionCatchIds: await getHomeRegionCatchIds(userId, req.body.pokemonId),
  }
  res.status(200).send(response)
})

router.put('/users-pokemon/note', async (req, res) => {
  const userId = req.user.id
  const response = {
    usersPokemon: await updateNoteForUsersPokemon({ ...req.body, userId }),
  }
  res.status(200).send(response)
})

router.put('/users-pokemon/evolve', async (req, res) => {
  const userId = req.user.id
  const response = {
    usersPokemon: await evolveUsersPokemon({ ...req.body, userId }),
    usersPokemonSources: await getUsersPokemonSources(
      userId,
      req.body.oldPokemonData.pokemonId
    ),
    usersPokemonEvolutionSources: await getEvolutionSourcesForPokemon(
      userId,
      req.body.oldPokemonData.pokemonId
    ),
    homeRegionCatchIds: await getHomeRegionCatchIds(
      userId,
      req.body.oldPokemonData.pokemonId
    ),
  }
  res.status(200).send(response)
})

export default router
