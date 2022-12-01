import express from 'express'
const router = express.Router()
import { getSourcesForPokemon } from './sources-repository.js'

router.get('/sources', async (req, res) => {
  console.log('got here')
  const response = {
    sources: await getSourcesForPokemon(req.query.pokemonId),
  }
  res.status(200).send(response)
})

export default router
