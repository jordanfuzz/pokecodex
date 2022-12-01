import dotenv from 'dotenv'
dotenv.config()

const e = process.env

const isDevelopment = e.NODE_ENV === 'development'

export default {
  pg: {
    host: e.POSTGRES_HOST,
    user: e.POSTGRES_USER,
    database: e.POSTGRES_DB,
    password: e.POSTGRES_PASSWORD,
  },
  isDevelopment,
}
