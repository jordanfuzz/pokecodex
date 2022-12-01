import express from 'express'
const router = express.Router()
import {
  getSourcesForPokemon,
  addSourceForPokemon,
} from './sources-repository.js'

router.get('/sources', async (req, res) => {
  const response = {
    sources: await getSourcesForPokemon(req.query.pokemonId),
  }
  res.status(200).send(response)
})

router.post('/sources', async (req, res) => {
  const response = {
    sources: await addSourceForPokemon(req.body.source, req.body.pokemonId),
  }
  res.status(200).send(response)
})

export default router
