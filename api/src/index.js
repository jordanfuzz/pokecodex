import express from 'express'
const app = express()
import cookieParser from 'cookie-parser'

import config from '../config.js'
import pokemonRouter from './pokemon/pokemon-routes.js'
import sourcesRouter from './sources/sources-routes.js'

app.use(express.json())
app.use(cookieParser())
app.use('/api', pokemonRouter)
app.use('/api', sourcesRouter)

app.get('/', (req, res) => {
  res.status(200).send('OK')
})

app.listen(config.port, () => console.log(`Listening on port ${config.port}`))

process.on('SIGINT', () => {
  process.exit()
})
