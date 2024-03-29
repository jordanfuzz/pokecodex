import express from 'express'
const router = express.Router()
import {
  deleteUsersPokemon,
  getAllForUserAndPokemon,
  updateNoteForUsersPokemon,
  updateUsersPokemon,
  evolveUsersPokemon,
} from './users-pokemon-repository.js'
import { getAllPokeballs, getAllGameVersions } from '../game-data/game-data-repository.js'
import {
  getUsersPokemonSources,
  getEvolutionSourcesForPokemon,
} from '../sources/sources-repository.js'

router.get('/users-pokemon', async (req, res) => {
  const response = {
    usersPokemon: await getAllForUserAndPokemon(req.query.userId, req.query.pokemonId),
    pokeballs: await getAllPokeballs(),
    gameVersions: await getAllGameVersions(),
  }
  res.status(200).send(response)
})

router.put('/users-pokemon', async (req, res) => {
  const response = {
    usersPokemon: await updateUsersPokemon(req.body),
    usersPokemonSources: await getUsersPokemonSources(
      req.body.userId,
      req.body.pokemonId
    ),
    usersPokemonEvolutionSources: await getEvolutionSourcesForPokemon(
      req.body.userId,
      req.body.pokemonId
    ),
  }
  res.status(200).send(response)
})

router.delete('/users-pokemon', async (req, res) => {
  const response = {
    usersPokemon: await deleteUsersPokemon(req.body),
    usersPokemonSources: await getUsersPokemonSources(
      req.body.userId,
      req.body.pokemonId
    ),
    usersPokemonEvolutionSources: await getEvolutionSourcesForPokemon(
      req.body.userId,
      req.body.pokemonId
    ),
  }
  res.status(200).send(response)
})

router.put('/users-pokemon/note', async (req, res) => {
  const response = {
    usersPokemon: await updateNoteForUsersPokemon(req.body),
  }
  res.status(200).send(response)
})

router.put('/users-pokemon/evolve', async (req, res) => {
  const response = {
    usersPokemon: await evolveUsersPokemon(req.body),
    usersPokemonSources: await getUsersPokemonSources(
      req.body.userId,
      req.body.oldPokemonData.pokemonId
    ),
    usersPokemonEvolutionSources: await getEvolutionSourcesForPokemon(
      req.body.userId,
      req.body.oldPokemonData.pokemonId
    ),
  }
  res.status(200).send(response)
})

export default router
