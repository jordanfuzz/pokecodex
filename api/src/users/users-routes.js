import express from 'express'
const router = express.Router()
import { getRulesForUser, updateRulesForUser } from './users-repository.js'
import {
  upsertSourceOverride,
  deleteSourceOverride,
} from './source-overrides-repository.js'

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

router.put('/user/source-override', async (req, res) => {
  const { sourceId, isRequired } = req.body ?? {}
  if (!sourceId || typeof isRequired !== 'boolean')
    return res.status(400).send({ message: 'sourceId and isRequired are required' })

  const override = await upsertSourceOverride(req.user.id, sourceId, isRequired)
  res.status(200).send({ override })
})

router.delete('/user/source-override/:sourceId', async (req, res) => {
  await deleteSourceOverride(req.user.id, req.params.sourceId)
  res.status(200).send({ deleted: true })
})

export default router
