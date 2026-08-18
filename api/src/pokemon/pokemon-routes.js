import express from 'express'
const router = express.Router()
import { getAllForUser } from './pokemon-repository.js'
import {
  getAllForUserAndPokemon,
  addPokemonForUser,
  getBoxDataForUser,
  setupBoxDataForUser,
  updateUsersBoxData,
} from '../users-pokemon/users-pokemon-repository.js'
import { getAllPokeballs, getAllGameVersions } from '../game-data/game-data-repository.js'
import {
  getSourcesForPokemon,
  getUsersPokemonSources,
  getEvolutionSourcesForPokemon,
} from '../sources/sources-repository.js'
import { formatGamesForFiltering } from './pokemon-utils.js'
import { getSourceOverridesForUserAndPokemon } from '../users/source-overrides-repository.js'

router.get('/all-pokemon', async (req, res) => {
  const response = {
    pokemon: await getAllForUser(req.user.id, req.query.generationId),
  }
  res.status(200).send(response)
})

router.get('/pokemon', async (req, res) => {
  const userId = req.user.id
  const response = {
    sources: await getSourcesForPokemon(req.query.pokemonId, req.query.generationId),
    usersPokemon: await getAllForUserAndPokemon(userId, req.query.pokemonId),
    usersPokemonSources: await getUsersPokemonSources(userId, req.query.pokemonId),
    usersPokemonEvolutionSources: await getEvolutionSourcesForPokemon(
      userId,
      req.query.pokemonId
    ),
    usersSourceOverrides: await getSourceOverridesForUserAndPokemon(
      userId,
      req.query.pokemonId
    ),
    pokeballs: await getAllPokeballs(),
    gameVersions: await getAllGameVersions(),
  }
  res.status(200).send(response)
})

router.post('/pokemon', async (req, res) => {
  if (!req.body)
    return res.status(400).send({ message: 'No data was sent to the server' })

  const userId = req.user.id

  // Resend the entire pokemon data anyway because it's less confusing on the frontend
  const response = {
    sources: await getSourcesForPokemon(req.body.pokemonId, req.body.generationId),
    usersPokemon: await addPokemonForUser({ ...req.body, userId }),
    usersPokemonSources: await getUsersPokemonSources(userId, req.body.pokemonId),
    usersPokemonEvolutionSources: await getEvolutionSourcesForPokemon(
      userId,
      req.body.pokemonId
    ),
    pokeballs: await getAllPokeballs(),
    gameVersions: await getAllGameVersions(),
  }

  res.status(200).send(response)
})

router.get('/pokemon/box-data', async (req, res) => {
  const response = {
    usersBoxData: await getBoxDataForUser(req.user.id),
    gameVersions: formatGamesForFiltering(await getAllGameVersions()),
  }
  res.status(200).send(response)
})

router.put('/pokemon/box-data', async (req, res) => {
  if (!req.body)
    return res.status(400).send({ message: 'No data was sent to the server' })
  const { completeRecords, gameId } = req.body

  const response = {
    usersBoxData: await updateUsersBoxData(completeRecords, req.user.id, gameId),
  }

  res.status(200).send(response)
})

router.post('/pokemon/box-data/setup', async (req, res) => {
  const response = {
    usersBoxData: await setupBoxDataForUser(req.user.id),
  }
  res.status(200).send(response)
})

export default router
