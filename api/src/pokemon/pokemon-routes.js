import express from 'express'
const router = express.Router()
import { getAll } from './pokemon-repository.js'

router.get('/pokemon', async (req, res) => {
  console.log('got here!')
  const response = {
    pokemon: await getAll(),
  }
  res.status(200).send(response)
})

export default router
