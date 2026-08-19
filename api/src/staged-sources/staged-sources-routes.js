import express from 'express'
const router = express.Router()
import { isUserAdmin, listStagedSources, getStagedSummary } from './staged-sources-repository.js'

// Path-scoped: this router is mounted at /api alongside the others, and an
// unscoped router.use() would gate every /api request passing through.
const requireAdmin = async (req, res, next) => {
  if (!(await isUserAdmin(req.user.id))) {
    return res.status(401).send({ message: 'User is not authorized to review staged sources' })
  }
  next()
}
router.use('/staged-sources', requireAdmin)

router.get('/staged-sources/summary', async (req, res) => {
  res.status(200).send({ summary: await getStagedSummary() })
})

router.get('/staged-sources', async (req, res) => {
  const stagedSources = await listStagedSources({
    gen: req.query.gen ? parseInt(req.query.gen, 10) : null,
    status: req.query.status === 'all' ? null : req.query.status ?? 'pending',
    rowKind: req.query.rowKind ?? null,
    confidence: req.query.confidence ?? null,
    includeExpected: req.query.includeExpected === 'true',
  })
  res.status(200).send({ stagedSources })
})

export default router
