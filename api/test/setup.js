// Loads the repo-root .env, then overrides for running tests on the host:
// Postgres is reached via its published port instead of the compose network
// alias, and dev-only behavior is always on under test.
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'

dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)) })
process.env.POSTGRES_HOST = 'localhost'
process.env.NODE_ENV = 'development'
