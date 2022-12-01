import pg from 'pg'
import config from './config.js'

console.log(config.pg)

export default new pg.Pool(config.pg)
