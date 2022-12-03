import express from 'express'
const router = express.Router()
import { getAllForUserAndPokemon } from './users-pokemon-repository.js'
import { getAllPokeballs, getAllGameVersions } from '../game-data/game-data-repository.js'

router.get('/users-pokemon', async (req, res) => {
  const response = {
    usersPokemon: await getAllForUserAndPokemon(req.query.userId, req.query.pokemonId),
    pokeballs: await getAllPokeballs(),
    gameVersions: await getAllGameVersions(),
  }
  res.status(200).send(response)
})

export default router
