import express from 'express'
const router = express.Router()
import passport from 'passport'

import config from '../../config.js'

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
  req.logout()
  res.redirect(config.appUrl)
})

router.get('/failure', (req, res) => {
  res.status(401).redirect(config.appUrl)
})

export default router
