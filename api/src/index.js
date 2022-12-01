import express from 'express'
const app = express()
import cookieParser from 'cookie-parser'

import config from '../config.js'
import pokemonRouter from './pokemon/pokemon-routes.js'

app.use(express.json())
app.use(cookieParser())
app.use('/api', pokemonRouter)

app.get('/', (req, res) => {
  res.status(200).send('OK')
})

app.listen(config.port, () => console.log(`Listening on port ${config.port}`))

process.on('SIGINT', () => {
  process.exit()
})
