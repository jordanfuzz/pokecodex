const pg = require('pg')
const config = require('../config')
const pgPool = new pg.Pool(config.pg)

module.exports = pgPool
