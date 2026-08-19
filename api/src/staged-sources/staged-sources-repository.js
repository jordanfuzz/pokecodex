import pgPool from '../pg-pool.js'
import camelize from 'camelize'
import { randomUUID } from 'crypto'

export const isUserAdmin = (userId) =>
  pgPool
    .query('select is_admin from users where id = $1;', [userId])
    .then((res) => res.rows[0]?.is_admin ?? false)

export const listStagedSources = ({
  gen = null,
  status = 'pending',
  rowKind = null,
  confidence = null,
  includeExpected = false,
}) =>
  pgPool
    .query(
      `select ss.*, p.name as pokemon_name,
        row_to_json(ms) as matched_source,
        row_to_json(sg) as suggested_source,
        -- Must stay in lockstep with approveStagedSource's delete-branch reference count.
        coalesce(refs.count, 0) + coalesce(override_refs.count, 0) as reference_count
      from staged_sources ss
      join pokemon p on p.id = ss.pokemon_id
      left join sources ms on ms.id = ss.matched_source_id
      left join sources sg on sg.id = ss.suggested_source_id
      left join (
        select source_id, count(*)::int as count
        from users_pokemon_sources group by source_id
      ) refs on refs.source_id = ss.matched_source_id
      left join (
        select source_id, count(*)::int as count
        from users_source_overrides group by source_id
      ) override_refs on override_refs.source_id = ss.matched_source_id
      where (cast($1 as integer) is null or ss.gen = $1)
        and (cast($2 as staged_status) is null or ss.status = $2)
        and (cast($3 as staged_row_kind) is null or ss.row_kind = $3)
        and (cast($4 as staged_confidence) is null or ss.confidence = $4)
        and ($5 or not ss.expected_absent)
      order by ss.pokemon_id, ss.gen, ss.row_kind, ss.natural_key;`,
      [gen, status, rowKind, confidence, includeExpected]
    )
    .then((res) => camelize(res.rows))

export const getStagedSummary = () =>
  pgPool
    .query(
      `select gen, status, row_kind, expected_absent, count(*)::int as count
      from staged_sources
      group by gen, status, row_kind, expected_absent
      order by gen;`
    )
    .then((res) => camelize(res.rows))

export const updateStagedSource = (id, { name, description, source, gen, replaceDefault }) =>
  pgPool
    .query(
      `update staged_sources set
        name = coalesce($2, name),
        description = coalesce($3, description),
        source = coalesce($4, source),
        gen = coalesce($5, gen),
        replace_default = coalesce($6, replace_default)
      where id = $1 and status = 'pending'
      returning *;`,
      [id, name ?? null, description ?? null, source ?? null, gen ?? null, replaceDefault ?? null]
    )
    .then((res) => camelize(res.rows[0] ?? null))

export const rejectStagedSource = (id) =>
  pgPool
    .query(
      `update staged_sources set status = 'rejected', reviewed_at = now()
      where id = $1 and status = 'pending'
      returning *;`,
      [id]
    )
    .then((res) => camelize(res.rows[0] ?? null))

// The ONLY code that creates a sources row from a staged row; both approval
// paths must go through it so future guards apply to each.
const createSourceFromStaged = async (client, staged) => {
  const sourceId = randomUUID()
  await client.query(
    `insert into sources (id, pokemon_id, name, description, image, gen, source, replace_default)
     values ($1,$2,$3,$4,$5,$6,$7,$8);`,
    [sourceId, staged.pokemonId, staged.name, staged.description, staged.image,
      staged.gen, staged.source, staged.replaceDefault ?? false]
  )
  await client.query(`update staged_sources set created_source_id = $2 where id = $1;`, [staged.id, sourceId])
  return sourceId
}

export class InvalidActionError extends Error {}
export class ReferencedSourceError extends Error {
  constructor(referenceCount) {
    super('Source is referenced by user tracking rows')
    this.referenceCount = referenceCount
  }
}

export const approveStagedSource = async (id, { action = null, confirmReferencedDelete = false } = {}) => {
  const client = await pgPool.connect()
  try {
    await client.query('begin')
    const staged = camelize(
      (
        await client.query(
          `select * from staged_sources where id = $1 and status = 'pending' for update;`,
          [id]
        )
      ).rows[0] ?? null
    )
    if (!staged) {
      await client.query('rollback')
      return null
    }

    let resolution
    if (staged.rowKind === 'new') {
      await createSourceFromStaged(client, staged)
      resolution = 'created'
    } else if (staged.rowKind === 'audit') {
      if (!staged.matchedSourceId) {
        throw new InvalidActionError('staged row has no matched source (it may have been deleted); reject it instead')
      }
      if (action === 'apply') {
        await client.query(
          // gen = 0 is the multi-gen sentinel (see sources table doc); the
          // parent spec froze the multi-gen model, so nothing in this
          // increment may narrow a gen-0 source down to a single gen.
          `update sources set name = $2, description = $3,
            gen = case when gen = 0 then gen else $4 end,
            source = $5, replace_default = $6
           where id = $1;`,
          [staged.matchedSourceId, staged.name, staged.description, staged.gen,
            staged.source, staged.replaceDefault ?? false]
        )
        resolution = 'updated'
      } else if (action === 'no-change') {
        resolution = 'kept'
      } else {
        throw new InvalidActionError(`audit rows need action apply or no-change, got ${action}`)
      }
    } else if (staged.rowKind === 'existing-unmatched') {
      if (!staged.matchedSourceId) {
        throw new InvalidActionError('staged row has no matched source (it may have been deleted); reject it instead')
      }
      if (action === 'keep') {
        resolution = 'kept'
      } else if (action === 'update') {
        await client.query(
          // gen = 0 is the multi-gen sentinel; same guard as the audit
          // 'apply' branch above — nothing in this increment may narrow it.
          `update sources set
            name = coalesce($2, name), description = coalesce($3, description),
            gen = case when gen = 0 then gen else coalesce($4, gen) end,
            source = coalesce($5, source),
            replace_default = coalesce($6, replace_default)
           where id = $1;`,
          [staged.matchedSourceId, staged.name, staged.description, staged.gen,
            staged.source, staged.replaceDefault]
        )
        resolution = 'updated'
      } else if (action === 'delete') {
        // users_source_overrides cascades on source delete (see
        // adhoc/scripts/migrations/2026-08-users-source-overrides.sql), so it
        // needs no explicit delete here, but it must be counted so the admin
        // confirms with the full picture of what the delete will take out.
        const referenceCount = (
          await client.query(
            `select
              (select count(*) from users_pokemon_sources where source_id = $1)::int
              + (select count(*) from users_source_overrides where source_id = $1)::int
              as count;`,
            [staged.matchedSourceId]
          )
        ).rows[0].count
        if (referenceCount > 0 && !confirmReferencedDelete) throw new ReferencedSourceError(referenceCount)
        await client.query(`delete from users_pokemon_sources where source_id = $1;`, [staged.matchedSourceId])
        // Null every staged reference before the delete so the FKs allow it;
        // this row's raw_snippet snapshot preserves what was deleted.
        await client.query(
          `update staged_sources set suggested_source_id = null, suggestion_reason = null
           where suggested_source_id = $1;`,
          [staged.matchedSourceId]
        )
        await client.query(
          `update staged_sources set matched_source_id = null where matched_source_id = $1;`,
          [staged.matchedSourceId]
        )
        await client.query(`delete from sources where id = $1;`, [staged.matchedSourceId])
        resolution = 'deleted'
      } else {
        throw new InvalidActionError(`existing-unmatched rows need action keep, update, or delete, got ${action}`)
      }
    } else {
      // Guard for future row_kind enum growth: without this, an unrecognized
      // kind would silently fall through the existing-unmatched branch above.
      throw new InvalidActionError(`unknown row kind ${staged.rowKind}`)
    }

    const updated = camelize(
      (
        await client.query(
          `update staged_sources set status = 'approved', resolution = $2, reviewed_at = now()
           where id = $1 returning *;`,
          [id, resolution]
        )
      ).rows[0]
    )
    await client.query('commit')
    return updated
  } catch (error) {
    try {
      await client.query('rollback')
    } catch {
      // Swallow rollback failures so the original error is what propagates.
    }
    throw error
  } finally {
    client.release()
  }
}

export const resolvePairing = async (id, confirm) => {
  const client = await pgPool.connect()
  try {
    await client.query('begin')
    const staged = camelize(
      (
        await client.query(
          `select * from staged_sources
           where id = $1 and status = 'pending' and row_kind = 'new'
             and suggested_source_id is not null
           for update;`,
          [id]
        )
      ).rows[0] ?? null
    )
    if (!staged) {
      await client.query('rollback')
      return null
    }
    let updated
    if (confirm) {
      updated = camelize(
        (
          await client.query(
            `update staged_sources set
              matched_source_id = suggested_source_id,
              suggested_source_id = null, suggestion_reason = null,
              row_kind = 'audit', pairing_confirmed = true
             where id = $1 returning *;`,
            [id]
          )
        ).rows[0]
      )
      // Assumes at most one pending existing-unmatched row per matched_source_id;
      // stage-candidates dedupes by natural_key so this holds in practice.
      await client.query(
        `update staged_sources set status = 'approved', resolution = 'paired', reviewed_at = now()
         where row_kind = 'existing-unmatched' and matched_source_id = $1 and status = 'pending';`,
        [staged.suggestedSourceId]
      )
    } else {
      updated = camelize(
        (
          await client.query(
            `update staged_sources set suggested_source_id = null, suggestion_reason = null
             where id = $1 returning *;`,
            [id]
          )
        ).rows[0]
      )
    }
    await client.query('commit')
    return updated
  } catch (error) {
    try {
      await client.query('rollback')
    } catch {
      // Swallow rollback failures so the original error is what propagates.
    }
    throw error
  } finally {
    client.release()
  }
}

export const bulkApproveStagedSources = async (ids) => {
  const client = await pgPool.connect()
  try {
    await client.query('begin')
    const approvedIds = []
    const skippedIds = []
    for (const id of ids) {
      const staged = camelize(
        (
          await client.query(
            `select * from staged_sources
             where id = $1 and status = 'pending' and row_kind = 'new'
               and suggested_source_id is null for update;`,
            [id]
          )
        ).rows[0] ?? null
      )
      if (!staged) {
        skippedIds.push(id)
        continue
      }
      const sourceId = await createSourceFromStaged(client, staged)
      await client.query(
        `update staged_sources set status = 'approved', resolution = 'created',
          created_source_id = $2, reviewed_at = now()
         where id = $1;`,
        [id, sourceId]
      )
      approvedIds.push(id)
    }
    await client.query('commit')
    return { approvedIds, skippedIds }
  } catch (error) {
    try {
      await client.query('rollback')
    } catch {
      // Swallow rollback failures so the original error is what propagates.
    }
    throw error
  } finally {
    client.release()
  }
}
