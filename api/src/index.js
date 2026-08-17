import config from '../config.js'
import app from './app.js'

app.listen(config.port, () => console.log(`Listening on port ${config.port}`))

process.on('SIGINT', () => {
  process.exit()
})
