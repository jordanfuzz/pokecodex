import express from 'express'
const app = express()
import cookieParser from 'cookie-parser'
import cookieSession from 'cookie-session'
import passport from 'passport'
import DiscordStrategy from 'passport-discord'

import config from '../config.js'
import authRouter from './users/auth-routes.js'
import gameDataRouter from './game-data/game-data-routes.js'
import pokemonRouter from './pokemon/pokemon-routes.js'
import usersPokemonRouter from './users-pokemon/users-pokemon-routes.js'
import sourcesRouter from './sources/sources-routes.js'
import usersRouter from './users/users-routes.js'
import stagedSourcesRouter from './staged-sources/staged-sources-routes.js'

import {
  getUserById,
  getUserByDiscordId,
  recordUserVisit,
  saveNewUser,
} from './users/users-repository.js'

app.use(express.json())
if (config.isDevelopment) {
  app.set('trust proxy', 1)
}
app.use(
  cookieSession({
    name: 'session',
    keys: [config.sessionSecret],
    maxAge: config.cookieOptions.maxAge,
  })
)

app.use((req, res, next) => {
  if (req.session && !req.session.regenerate) {
    req.session.regenerate = cb => cb()
  }
  if (req.session && !req.session.save) {
    req.session.save = cb => cb()
  }
  next()
})

app.use(cookieParser())
app.use(passport.initialize())
app.use(passport.session())

const authCheck = (req, res, next) => {
  if (!req.user) {
    res.status(401).json({
      authenticated: false,
      message: 'User has not been authenticated',
    })
  } else {
    next()
  }
}

app.use('/api/auth', authRouter)
app.use('/api', authCheck, gameDataRouter)
app.use('/api', authCheck, pokemonRouter)
app.use('/api', authCheck, usersPokemonRouter)
app.use('/api', authCheck, sourcesRouter)
app.use('/api', authCheck, usersRouter)
app.use('/api', authCheck, stagedSourcesRouter)

passport.serializeUser((user, done) => {
  done(null, user.id)
})

passport.deserializeUser(async (id, done) => {
  const user = await getUserById(id)
  if (user) await recordUserVisit(id)

  done(null, user)
})

passport.use(
  new DiscordStrategy(
    {
      clientID: config.clientId,
      clientSecret: config.clientSecret,
      callbackUrl: '/api/auth/redirect',
      scope: ['identify', 'guilds'],
    },
    async (accessToken, refreshToken, profile, done) => {
      const userIsInMegabox = profile.guilds.some(x => x.id === '146109488745807873')
      const existingUser = await getUserByDiscordId(profile.id)

      if (userIsInMegabox) {
        if (existingUser) {
          await recordUserVisit(existingUser.id)
          done(null, existingUser)
        } else {
          const newUser = await saveNewUser(profile.id, profile.username)
          done(null, newUser)
        }
      } else {
        done(null, false, { message: 'User is not in Megabox' })
      }
    }
  )
)

app.get('/', authCheck, (req, res) => {
  res.status(200).send('Hello world!')
})

// Express 5 forwards async-handler rejections here; without this, the default
// handler leaks stack traces to clients whenever NODE_ENV !== 'production'.
app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ message: 'Internal server error' })
})

export default app
