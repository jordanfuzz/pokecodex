import express from 'express'
const router = express.Router()
import { getSourcesForPokemon, addSourceForPokemon } from './sources-repository.js'

router.get('/sources', async (req, res) => {
  const response = {
    sources: await getSourcesForPokemon(req.query.pokemonId),
  }
  res.status(200).send(response)
})

router.post('/sources', async (req, res) => {
  const sources = await addSourceForPokemon(
    req.body.source,
    req.body.pokemonId,
    req.body.userId
  )
  if (!sources) res.status(401).send({ message: 'User is not authorized to add sources' })
  else {
    const response = {
      sources,
    }
    res.status(200).send(response)
  }
})

export default router
