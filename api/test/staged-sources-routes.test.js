import './setup.js'
import assert from 'node:assert/strict'
import { describe, it, before, after } from 'node:test'
import app from '../src/app.js'
import pgPool from '../src/pg-pool.js'
import { loginAgent } from './helpers.js'
import {
  applyStagedMigration, insertStagedRow, cleanupStagedTestRows,
  insertTestSource, cleanupTestSources,
} from './staged-helpers.js'

let agent, userId, savedIsAdmin
const setAdmin = (value) =>
  pgPool.query(`update users set is_admin = $1 where id = $2;`, [value, userId])

// Everything lives inside one outer describe so this suite's own before/after
// hooks are scoped to it, rather than sitting at the module's top level. Node's
// test runner fires same-level hooks in registration order: setup.js (imported
// above) registers a root-level `after` that ends the pg pool, and — since that
// import runs before this file's own `before`/`after` calls — a *root-level*
// after here would run its pool-using cleanup queries after the pool was
// already ended. Nesting inside a describe makes this suite's after run when
// the describe finishes, which is before the root-level teardown runs.
describe('staged-sources routes', () => {
  before(async () => {
    await applyStagedMigration()
    agent = await loginAgent(app)
    userId = (await agent.get('/api/auth/login')).body.id
    savedIsAdmin = (
      await pgPool.query(`select is_admin from users where id = $1;`, [userId])
    ).rows[0].is_admin
    await setAdmin(true)
  })

  after(async () => {
    await cleanupStagedTestRows()
    await cleanupTestSources()
    await setAdmin(savedIsAdmin)
  })

  describe('admin gate', () => {
    it('a non-admin gets 401 from every staged-sources route', async () => {
      try {
        await setAdmin(false)
        assert.equal((await agent.get('/api/staged-sources')).status, 401)
        assert.equal((await agent.get('/api/staged-sources/summary')).status, 401)
        assert.equal((await agent.patch('/api/staged-sources/x')).status, 401)
        assert.equal((await agent.post('/api/staged-sources/x/reject')).status, 401)
      } finally {
        await setAdmin(true)
      }
    })

    it('the gate does not block other /api routes for non-admins', async () => {
      try {
        await setAdmin(false)
        assert.equal((await agent.get('/api/sources?pokemonId=1')).status, 200)
      } finally {
        await setAdmin(true)
      }
    })
  })

  describe('GET /api/staged-sources', () => {
    before(async () => {
      await insertStagedRow({ gen: 1, name: 'list-a' })
      await insertStagedRow({ gen: 2, name: 'list-b' })
      await insertStagedRow({ gen: 1, status: 'rejected', name: 'list-c' })
      await insertStagedRow({ gen: 1, expectedAbsent: true, rowKind: 'existing-unmatched', name: null, source: null, confidence: null, origin: null, games: null })
    })

    it('defaults to pending rows without expected-absent, filtered by gen', async () => {
      const res = await agent.get('/api/staged-sources?gen=1')
      assert.equal(res.status, 200)
      const names = res.body.stagedSources.map((r) => r.name)
      assert.ok(names.includes('list-a'))
      assert.ok(!names.includes('list-b'), 'gen filter applies')
      assert.ok(!names.includes('list-c'), 'rejected excluded by default')
      assert.ok(!res.body.stagedSources.some((r) => r.expectedAbsent), 'expected-absent hidden by default')
    })

    it('includeExpected=true and status=all widen the listing', async () => {
      const res = await agent.get('/api/staged-sources?gen=1&includeExpected=true&status=all')
      assert.ok(res.body.stagedSources.some((r) => r.expectedAbsent))
      assert.ok(res.body.stagedSources.some((r) => r.status === 'rejected'))
    })

    it('joins pokemon name, matched source, and reference count', async () => {
      const source = await insertTestSource()
      await pgPool.query(
        `insert into users_pokemon_sources (id, users_pokemon_id, source_id, is_inherited)
         select gen_random_uuid(), gen_random_uuid(), $1, false from generate_series(1, 2);`,
        [source.id]
      )
      try {
        await insertStagedRow({ rowKind: 'existing-unmatched', matchedSourceId: source.id, name: null, source: null, confidence: null, origin: null, games: null })
        const res = await agent.get('/api/staged-sources?gen=1&rowKind=existing-unmatched')
        const row = res.body.stagedSources.find((r) => r.matchedSourceId === source.id)
        assert.ok(row)
        assert.equal(row.pokemonName.toLowerCase(), 'bulbasaur')
        assert.equal(row.matchedSource.name, source.name)
        assert.equal(row.referenceCount, 2)
      } finally {
        await pgPool.query(`delete from users_pokemon_sources where source_id = $1;`, [source.id])
      }
    })
  })

  describe('GET /api/staged-sources/summary', () => {
    it('returns counts by gen, status, rowKind, expectedAbsent', async () => {
      const res = await agent.get('/api/staged-sources/summary')
      assert.equal(res.status, 200)
      const bucket = res.body.summary.find(
        (s) => s.gen === 1 && s.status === 'pending' && s.rowKind === 'new' && s.expectedAbsent === false
      )
      assert.ok(bucket)
      assert.ok(bucket.count >= 1)
    })
  })

  describe('PATCH /api/staged-sources/:id', () => {
    it('edits pending fields and leaves others alone', async () => {
      const row = await insertStagedRow()
      const res = await agent
        .patch(`/api/staged-sources/${row.id}`)
        .send({ name: 'polished name', source: 'npc-trade' })
      assert.equal(res.status, 200)
      assert.equal(res.body.stagedSource.name, 'polished name')
      assert.equal(res.body.stagedSource.source, 'npc-trade')
      assert.equal(res.body.stagedSource.description, 'staged test description')
    })

    it('404s on a non-pending row', async () => {
      const row = await insertStagedRow({ status: 'rejected' })
      const res = await agent.patch(`/api/staged-sources/${row.id}`).send({ name: 'x' })
      assert.equal(res.status, 404)
    })
  })

  describe('POST /api/staged-sources/:id/reject', () => {
    it('rejects a pending row and stamps reviewed_at', async () => {
      const row = await insertStagedRow()
      const res = await agent.post(`/api/staged-sources/${row.id}/reject`)
      assert.equal(res.status, 200)
      assert.equal(res.body.stagedSource.status, 'rejected')
      assert.ok(res.body.stagedSource.reviewedAt)
    })

    it('404s when rejecting twice', async () => {
      const row = await insertStagedRow()
      await agent.post(`/api/staged-sources/${row.id}/reject`)
      assert.equal((await agent.post(`/api/staged-sources/${row.id}/reject`)).status, 404)
    })
  })

  describe('POST /api/staged-sources/:id/approve', () => {
    it('new: inserts into sources and records created_source_id', async () => {
      const row = await insertStagedRow({ name: 'staged-api-test-created' })
      const res = await agent.post(`/api/staged-sources/${row.id}/approve`)
      assert.equal(res.status, 200)
      assert.equal(res.body.stagedSource.status, 'approved')
      assert.equal(res.body.stagedSource.resolution, 'created')
      const created = await pgPool.query(`select * from sources where id = $1;`, [
        res.body.stagedSource.createdSourceId,
      ])
      assert.equal(created.rows.length, 1)
      assert.equal(created.rows[0].name, 'staged-api-test-created')
      assert.equal(created.rows[0].pokemon_id, 1)
    })

    it('audit no-change: resolution kept, sources untouched', async () => {
      const source = await insertTestSource()
      const row = await insertStagedRow({ rowKind: 'audit', matchedSourceId: source.id, name: 'parsed name' })
      const res = await agent.post(`/api/staged-sources/${row.id}/approve`).send({ action: 'no-change' })
      assert.equal(res.body.stagedSource.resolution, 'kept')
      const kept = await pgPool.query(`select name from sources where id = $1;`, [source.id])
      assert.equal(kept.rows[0].name, source.name)
    })

    it('audit apply: updates the matched sources row from staged fields', async () => {
      const source = await insertTestSource()
      const row = await insertStagedRow({ rowKind: 'audit', matchedSourceId: source.id, name: 'staged-api-test-applied', source: 'npc-trade' })
      const res = await agent.post(`/api/staged-sources/${row.id}/approve`).send({ action: 'apply' })
      assert.equal(res.body.stagedSource.resolution, 'updated')
      const updated = await pgPool.query(`select name, source from sources where id = $1;`, [source.id])
      assert.equal(updated.rows[0].name, 'staged-api-test-applied')
      assert.equal(updated.rows[0].source, 'npc-trade')
    })

    it('audit with a missing action is a 400', async () => {
      const source = await insertTestSource()
      const row = await insertStagedRow({ rowKind: 'audit', matchedSourceId: source.id })
      assert.equal((await agent.post(`/api/staged-sources/${row.id}/approve`)).status, 400)
    })

    it('existing-unmatched keep: resolution kept', async () => {
      const source = await insertTestSource()
      const row = await insertStagedRow({ rowKind: 'existing-unmatched', matchedSourceId: source.id, name: null, source: null, confidence: null, origin: null, games: null })
      const res = await agent.post(`/api/staged-sources/${row.id}/approve`).send({ action: 'keep' })
      assert.equal(res.body.stagedSource.resolution, 'kept')
    })

    it('existing-unmatched update: coalesces staged fields onto the source', async () => {
      const source = await insertTestSource()
      const row = await insertStagedRow({ rowKind: 'existing-unmatched', matchedSourceId: source.id, name: 'staged-api-test-renamed', source: null, confidence: null, origin: null, games: null })
      await agent.post(`/api/staged-sources/${row.id}/approve`).send({ action: 'update' })
      const updated = await pgPool.query(`select name, source from sources where id = $1;`, [source.id])
      assert.equal(updated.rows[0].name, 'staged-api-test-renamed')
      assert.equal(updated.rows[0].source, source.source, 'null staged fields fall back to existing')
    })

    it('unreferenced delete removes the source outright', async () => {
      const source = await insertTestSource()
      const row = await insertStagedRow({ rowKind: 'existing-unmatched', matchedSourceId: source.id, name: null, source: null, confidence: null, origin: null, games: null })
      const res = await agent.post(`/api/staged-sources/${row.id}/approve`).send({ action: 'delete' })
      assert.equal(res.body.stagedSource.resolution, 'deleted')
      assert.equal(res.body.stagedSource.matchedSourceId, null, 'ref nulled so the FK allows the delete')
      const gone = await pgPool.query(`select 1 from sources where id = $1;`, [source.id])
      assert.equal(gone.rows.length, 0)
    })

    it('referenced delete 409s without the confirm flag, deletes refs with it', async () => {
      const source = await insertTestSource()
      await pgPool.query(
        `insert into users_pokemon_sources (id, users_pokemon_id, source_id, is_inherited)
         values (gen_random_uuid(), gen_random_uuid(), $1, false);`,
        [source.id]
      )
      const row = await insertStagedRow({ rowKind: 'existing-unmatched', matchedSourceId: source.id, name: null, source: null, confidence: null, origin: null, games: null })

      const blocked = await agent.post(`/api/staged-sources/${row.id}/approve`).send({ action: 'delete' })
      assert.equal(blocked.status, 409)
      assert.equal(blocked.body.referenceCount, 1)
      const stillThere = await pgPool.query(`select 1 from sources where id = $1;`, [source.id])
      assert.equal(stillThere.rows.length, 1, '409 must not half-delete')

      const confirmed = await agent
        .post(`/api/staged-sources/${row.id}/approve`)
        .send({ action: 'delete', confirmReferencedDelete: true })
      assert.equal(confirmed.status, 200)
      const refs = await pgPool.query(`select 1 from users_pokemon_sources where source_id = $1;`, [source.id])
      assert.equal(refs.rows.length, 0)
      const gone = await pgPool.query(`select 1 from sources where id = $1;`, [source.id])
      assert.equal(gone.rows.length, 0)
    })

    it('404s on an already-approved row', async () => {
      const row = await insertStagedRow()
      await agent.post(`/api/staged-sources/${row.id}/approve`)
      assert.equal((await agent.post(`/api/staged-sources/${row.id}/approve`)).status, 404)
    })
  })
})
