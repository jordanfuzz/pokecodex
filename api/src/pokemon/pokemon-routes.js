import express from 'express'
const router = express.Router()
import { getAllForUser } from './pokemon-repository.js'
import {
  getAllForUserAndPokemon,
  addPokemonForUser,
} from '../users-pokemon/users-pokemon-repository.js'
import { getAllPokeballs, getAllGameVersions } from '../game-data/game-data-repository.js'
import {
  getSourcesForPokemon,
  getUsersPokemonSources,
} from '../sources/sources-repository.js'

router.get('/all-pokemon', async (req, res) => {
  if (!req.query.userId) res.status(400).send({ message: 'No userId provided' })

  const response = {
    pokemon: await getAllForUser(req.query.userId),
  }
  res.status(200).send(response)
})

router.get('/pokemon', async (req, res) => {
  const response = {
    sources: await getSourcesForPokemon(req.query.pokemonId),
    usersPokemon: await getAllForUserAndPokemon(req.query.userId, req.query.pokemonId),
    usersPokemonSources: await getUsersPokemonSources(
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
    usersPokemon: await addPokemonForUser(req.body),
    usersPokemonSources: await getUsersPokemonSources(
      req.body.userId,
      req.body.pokemonId
    ),
    sources: await getSourcesForPokemon(req.body.pokemonId),
    pokeballs: await getAllPokeballs(),
    gameVersions: await getAllGameVersions(),
  }

  res.status(200).send(response)
})

export default router
