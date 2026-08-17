import express from 'express'
const router = express.Router()
import passport from 'passport'

import config from '../../config.js'
import { getMostRecentlySeenUser } from './users-repository.js'

// Dev-only bypass: skips the Discord round-trip and logs in as the most
// recently seen user. Never registered outside development.
if (config.isDevelopment) {
  router.get('/dev-login', async (req, res, next) => {
    const user = await getMostRecentlySeenUser()
    if (!user) {
      return res.status(500).json({ message: 'No users exist to dev-login as' })
    }
    req.login(user, err => (err ? next(err) : res.redirect(config.appUrl)))
  })
}

router.get('/', passport.authenticate('discord'))

router.get(
  '/redirect',
  passport.authenticate('discord', {
    successRedirect: config.appUrl,
    failureRedirect: '/api/auth/failure',
  })
)

router.get('/login', (req, res) => {
  if (req.user) {
    res.status(200).json(req.user)
  } else {
    res.status(401).json({ success: false, message: 'User failed to authenticate' })
  }
})

router.get('/logout', (req, res) => {
  req.session = null
  res.redirect(config.appUrl)
})

router.get('/failure', (req, res) => {
  res.status(401).redirect(config.appUrl)
})

export default router
