import express from 'express'
const router = express.Router()
import { getRulesForUser, updateRulesForUser } from './users-repository.js'

router.get('/user/rules', async (req, res) => {
  const rules = await getRulesForUser(req.user.id)
  res.status(200).send({ rules })
})

router.put('/user/rules', async (req, res) => {
  const rules = await updateRulesForUser(req.body.rules, req.user.id)

  if (!rules)
    return res.status(500).send({ message: 'An error occurred setting rules for user' })
  res.status(200).send({ rules })
})

export default router
