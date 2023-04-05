import express from 'express'
const router = express.Router()
import { getRulesForUser, updateRulesForUser } from './users-repository.js'

router.get('/user/rules', async (req, res) => {
  const response = {
    rules: await getRulesForUser(req.query.userId),
  }
  res.status(200).send(response)
})

router.put('/user/rules', async (req, res) => {
  const response = {
    rules: await updateRulesForUser(req.body.rules, req.body.userId),
  }
  res.status(200).send(response)
})

export default router
