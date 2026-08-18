// One-time polite fetch of Bulbapedia wikitext into a local cache
// (bulbapedia-cache/, gitignored — Bulbagarden staff object to redistributed
// dumps, so the cache must never be committed). Parsers iterate against the
// cache; Bulbapedia is not re-hit. See docs/source-data-feasibility.md.
//
// Usage (inside the adhoc container):
//   node scripts/fetch-bulbapedia.js [--limit N] [--only pokemon|aux]
//
// Resumable: already-cached pages are skipped, so re-running only fetches
// what's missing. Failures are logged and written to bulbapedia-cache/failures.json.

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pgPool from '../pg-pool.js'

const API = 'https://bulbapedia.bulbagarden.net/w/api.php'
const USER_AGENT = 'Pokecodex/0.1 (personal pokedex tracker; jordan@cooperplanet.com)'
const DELAY_MS = 5000 // robots.txt Crawl-delay: 5
const CACHE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'bulbapedia-cache')

// DB names that don't resolve to Bulbapedia titles even via redirects
const TITLE_OVERRIDES = {
  'Nidoran ♀': 'Nidoran♀',
  'Nidoran ♂': 'Nidoran♂',
  Farfetchd: "Farfetch'd",
  Sirfetchd: "Sirfetch'd",
  Flabebe: 'Flabébé',
  'Mr-rime': 'Mr. Rime',
  'Ho-oh': 'Ho-Oh',
}

const AUX_PAGES = ['List of in-game trades']
const AUX_PREFIXES = [
  'List of in-game event Pokémon',
  'List of game-based Pokémon distributions',
]

const args = process.argv.slice(2)
const limitArg = args.indexOf('--limit')
const limit = limitArg === -1 ? Infinity : Number(args[limitArg + 1])
const onlyArg = args.indexOf('--only')
const only = onlyArg === -1 ? null : args[onlyArg + 1]

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const slugify = (title) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

async function apiGet(params) {
  const url = new URL(API)
  for (const [key, value] of Object.entries({ format: 'json', formatversion: 2, maxlag: 5, ...params })) {
    url.searchParams.set(key, value)
  }

  for (let attempt = 1; attempt <= 5; attempt++) {
    let response
    try {
      response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
    } catch (error) {
      console.warn(`  network error (attempt ${attempt}): ${error.message}`)
      await sleep(attempt * 15000)
      continue
    }

    if (response.status === 429 || response.status >= 500) {
      const retryAfter = Number(response.headers.get('retry-after')) || attempt * 15
      console.warn(`  HTTP ${response.status}, retrying in ${retryAfter}s (attempt ${attempt})`)
      await sleep(retryAfter * 1000)
      continue
    }
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)

    const body = await response.json()
    if (body.error?.code === 'maxlag') {
      console.warn(`  server lagged, retrying in 30s (attempt ${attempt})`)
      await sleep(30000)
      continue
    }
    if (body.error) throw new Error(`API error ${body.error.code}: ${body.error.info}`)
    return body
  }
  throw new Error(`giving up after 5 attempts: ${url}`)
}

async function fetchPage(requestedTitle, outFile) {
  const body = await apiGet({
    action: 'query',
    prop: 'revisions',
    rvprop: 'content|ids|timestamp',
    rvslots: 'main',
    redirects: 1,
    titles: requestedTitle,
  })

  const page = body.query.pages[0]
  if (!page || page.missing) throw new Error(`page missing: ${requestedTitle}`)

  const revision = page.revisions[0]
  await fs.writeFile(
    outFile,
    JSON.stringify(
      {
        fetchedAt: new Date().toISOString(),
        requestedTitle,
        title: page.title,
        redirected: page.title !== requestedTitle,
        pageid: page.pageid,
        revid: revision.revid,
        revTimestamp: revision.timestamp,
        wikitext: revision.slots.main.content,
      },
      null,
      2
    )
  )
  return revision.slots.main.content.length
}

async function fetchAll(jobs, failures) {
  let done = 0
  for (const job of jobs) {
    done++
    try {
      await fs.access(job.outFile)
      continue // already cached — no request, no delay
    } catch {
      // not cached yet
    }

    try {
      const bytes = await fetchPage(job.title, job.outFile)
      console.log(`[${done}/${jobs.length}] ${job.title} ok (${Math.round(bytes / 1024)} KB)`)
    } catch (error) {
      console.error(`[${done}/${jobs.length}] ${job.title} FAILED: ${error.message}`)
      failures.push({ title: job.title, error: error.message })
    }
    await sleep(DELAY_MS)
  }
}

async function pokemonJobs() {
  const { rows } = await pgPool.query('select id, name from pokemon order by id')
  const dir = path.join(CACHE_DIR, 'pokemon')
  await fs.mkdir(dir, { recursive: true })
  return rows.map(({ id, name }) => {
    const title = `${TITLE_OVERRIDES[name] ?? name} (Pokémon)`
    return { title, outFile: path.join(dir, `${String(id).padStart(4, '0')}-${slugify(name)}.json`) }
  })
}

async function auxJobs(failures) {
  const dir = path.join(CACHE_DIR, 'aux')
  await fs.mkdir(dir, { recursive: true })
  const titles = [...AUX_PAGES]

  for (const prefix of AUX_PREFIXES) {
    try {
      const body = await apiGet({ action: 'query', list: 'prefixsearch', pssearch: prefix, pslimit: 'max' })
      titles.push(...body.query.prefixsearch.map((result) => result.title))
    } catch (error) {
      console.error(`prefix search "${prefix}" FAILED: ${error.message}`)
      failures.push({ title: `prefixsearch:${prefix}`, error: error.message })
    }
    await sleep(DELAY_MS)
  }

  return [...new Set(titles)].map((title) => ({ title, outFile: path.join(dir, `${slugify(title)}.json`) }))
}

const failures = []
await fs.mkdir(CACHE_DIR, { recursive: true })

if (only !== 'aux') {
  const jobs = (await pokemonJobs()).slice(0, limit)
  console.log(`fetching ${jobs.length} pokemon pages...`)
  await fetchAll(jobs, failures)
}
if (only !== 'pokemon') {
  const jobs = (await auxJobs(failures)).slice(0, limit)
  console.log(`fetching ${jobs.length} aux pages (trades/events/distributions)...`)
  await fetchAll(jobs, failures)
}

await fs.writeFile(path.join(CACHE_DIR, 'failures.json'), JSON.stringify(failures, null, 2))
console.log(failures.length ? `done with ${failures.length} failures (see failures.json)` : 'done, no failures')
await pgPool.end()
