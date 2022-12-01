import pg from 'pg'
import config from '../config.js'

export default new pg.Pool(config.pg)
