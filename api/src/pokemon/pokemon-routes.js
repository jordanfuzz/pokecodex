import express from 'express'
const router = express.Router()
import { getAll } from './pokemon-repository.js'
import { getAllForUserAndPokemon } from '../users-pokemon/users-pokemon-repository.js'
import { getAllPokeballs, getAllGameVersions } from '../game-data/game-data-repository.js'
import {
  getSourcesForPokemon,
  getUsersPokemonSources,
} from '../sources/sources-repository.js'

router.get('/all-pokemon', async (req, res) => {
  const response = {
    pokemon: await getAll(),
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

export default router
