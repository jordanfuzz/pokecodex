import express from 'express'
import { getAllGameVersions } from './game-data-repository.js'
import { formatGamesForFiltering } from '../pokemon/pokemon-utils.js'
const router = express.Router()

router.get('/game-data', async (req, res) => {
  const response = {
    gameVersions: formatGamesForFiltering(await getAllGameVersions()),
  }
  res.status(200).send(response)
})

export default router
