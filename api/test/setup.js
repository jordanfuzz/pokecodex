// Loads the repo-root .env, then overrides for running tests on the host:
// Postgres is reached via its published port instead of the compose network
// alias, and dev-only behavior is always on under test.
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { after } from 'mocha'

dotenv.config({
  path: fileURLToPath(new URL('../../.env', import.meta.url)),
  quiet: true,
})
process.env.POSTGRES_HOST = 'localhost'
process.env.NODE_ENV = 'development'

// Both test files import this module first (ESM caches it, so this runs
// once), making it the one place that owns pool teardown for the whole
// suite. pg-pool.js builds its Pool from config.js, which reads
// POSTGRES_HOST/NODE_ENV at import time — a static top-of-file import here
// would be hoisted ahead of the env overrides above and capture the wrong
// host, so this is a dynamic import, deferred until the hook actually runs.
after(async () => {
  const { default: pgPool } = await import('../src/pg-pool.js')
  await pgPool.end()
})
