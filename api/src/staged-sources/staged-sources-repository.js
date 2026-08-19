import pgPool from '../pg-pool.js'
import camelize from 'camelize'

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
        coalesce(refs.count, 0) as reference_count
      from staged_sources ss
      join pokemon p on p.id = ss.pokemon_id
      left join sources ms on ms.id = ss.matched_source_id
      left join sources sg on sg.id = ss.suggested_source_id
      left join (
        select source_id, count(*)::int as count
        from users_pokemon_sources group by source_id
      ) refs on refs.source_id = ss.matched_source_id
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
