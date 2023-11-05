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
  console.log('Got here, login')
  if (req.user) {
    console.log('Got here, login, 2')
    res.status(200).json(req.user)
  } else {
    console.log('Got here, login, 3')
    res.status(401).json({ success: false, message: 'User failed to authenticate' })
  }
})

router.get('/logout', (req, res) => {
  console.log('Got here, logout')

  req.logout()
  res.redirect(config.appUrl)
})

router.get('/failure', (req, res) => {
  console.log('Got here, failure')

  res.status(401).redirect(config.appUrl)
})

export default router
