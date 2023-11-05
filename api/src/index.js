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

import {
  getUserById,
  getUserByDiscordId,
  recordUserVisit,
  saveNewUser,
} from './users/users-repository.js'

app.use(express.json())
app.use(
  cookieSession({
    name: 'session',
    keys: [config.sessionSecret],
    maxAge: config.cookieOptions.maxAge,
  })
)

app.use(cookieParser())
app.use(passport.initialize())
app.use(passport.session())
app.use('/api/auth', authRouter)
app.use('/api', gameDataRouter)
app.use('/api', pokemonRouter)
app.use('/api', usersPokemonRouter)
app.use('/api', sourcesRouter)
app.use('/api', usersRouter)

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
      console.log('Got here', profile)
      const userIsInMegabox = profile.guilds.some(x => x.id === '146109488745807873')
      const existingUser = await getUserByDiscordId(profile.id)
      console.log('user is in megabox', userIsInMegabox)
      if (userIsInMegabox) {
        if (existingUser) {
          console.log('Got here 2')
          await recordUserVisit(existingUser.id)
          done(null, existingUser)
        } else {
          console.log('Got here 3')
          const newUser = await saveNewUser(profile.id, profile.username)
          console.log('Got here 4', newUser)
          done(null, newUser)
        }
      } else {
        console.log("User isn't in megabox")
        done(null, false, { message: 'User is not in Megabox' })
      }
    }
  )
)

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

app.get('/', authCheck, (req, res) => {
  res.status(200).send('Hello world!')
})

app.listen(config.port, () => console.log(`Listening on port ${config.port}`))

process.on('SIGINT', () => {
  process.exit()
})
