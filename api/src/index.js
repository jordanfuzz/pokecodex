const express = require('express')
const app = express()
const cookieParser = require('cookie-parser')

const config = require('../config')

app.use(express.json())
app.use(cookieParser())

app.get('/', (req, res) => {
  res.status(200).send('OK')
})

app.listen(config.port, () => console.log(`Listening on port ${config.port}`))

process.on('SIGINT', () => {
  process.exit()
})
