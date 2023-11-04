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

router.get('/all-pokemon', async (req, res) => {
  if (!req.query.userId) res.status(400).send({ message: 'No userId provided' })

  const response = {
    pokemon: await getAllForUser(req.query.userId, req.query.generationId),
  }
  res.status(200).send(response)
})

router.get('/pokemon', async (req, res) => {
  const response = {
    sources: await getSourcesForPokemon(req.query.pokemonId, req.query.generationId),
    usersPokemon: await getAllForUserAndPokemon(req.query.userId, req.query.pokemonId),
    usersPokemonSources: await getUsersPokemonSources(
      req.query.userId,
      req.query.pokemonId
    ),
    usersPokemonEvolutionSources: await getEvolutionSourcesForPokemon(
      req.query.userId,
      req.query.pokemonId
    ),
    pokeballs: await getAllPokeballs(),
    gameVersions: await getAllGameVersions(),
  }
  res.status(200).send(response)
})

router.post('/pokemon', async (req, res) => {
  if (!req.body) res.status(400).send({ message: 'No data was sent to the server' })

  // Resend the entire pokemon data anyway because it's less confusing on the frontend
  const response = {
    sources: await getSourcesForPokemon(req.body.pokemonId),
    usersPokemon: await addPokemonForUser(req.body),
    usersPokemonSources: await getUsersPokemonSources(
      req.body.userId,
      req.body.pokemonId
    ),
    usersPokemonEvolutionSources: await getEvolutionSourcesForPokemon(
      req.body.userId,
      req.body.pokemonId
    ),
    pokeballs: await getAllPokeballs(),
    gameVersions: await getAllGameVersions(),
  }

  res.status(200).send(response)
})

router.get('/pokemon/box-data', async (req, res) => {
  if (!req.query.userId) res.status(400).send({ message: 'No userId provided' })

  const response = {
    usersBoxData: await getBoxDataForUser(req.query.userId),
    gameVersions: formatGamesForFiltering(await getAllGameVersions()),
  }
  res.status(200).send(response)
})

router.put('/pokemon/box-data', async (req, res) => {
  if (!req.body) res.status(400).send({ message: 'No data was sent to the server' })
  const { completeRecords, userId, gameId } = req.body

  const response = {
    usersBoxData: await updateUsersBoxData(completeRecords, userId, gameId),
  }

  res.status(200).send(response)
})

router.post('/pokemon/box-data/setup', async (req, res) => {
  if (!req.query.userId) res.status(400).send({ message: 'No userId provided' })

  const response = {
    usersBoxData: await setupBoxDataForUser(req.query.userId),
  }
  res.status(200).send(response)
})

export default router
