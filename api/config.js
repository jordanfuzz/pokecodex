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
  port: 3003,
  cookieOptions: {
    maxAge: 1000 * 60 * 60 * 24 * 7,
  },
  clientId: e.CLIENT_ID,
  clientSecret: e.CLIENT_SECRET,
  sessionSecret: e.SESSION_SECRET,
  appUrl: isDevelopment ? 'http://localhost:3000' : 'https://pokecodex.com',
}
