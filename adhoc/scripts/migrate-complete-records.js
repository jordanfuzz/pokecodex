// One-time migration: complete_records entries move from
//   123  (number, base record)          -> "123"
//   "123:Alolan" / "123:male" (names)   -> "123:<sourceId>"
// Also dedupes each row's migrated array: after Task 8 shipped, users may
// have saved NEW-format keys alongside legacy ones (e.g. both `1` and `"1"`
// for the same record), so mapping alone can leave duplicate entries.
// Unmatched entries are kept as-is and reported for manual review.
import pgPool from '../pg-pool.js'

const main = async () => {
  const dryRun = process.argv.includes('--dry-run')
  if (dryRun) {
    console.log('DRY RUN — no rows will be written.\n')
  }

  const sources = (
    await pgPool.query('select id, pokemon_id, name, source from sources;')
  ).rows

  const findSourceId = (pokemonId, suffix) => {
    if (suffix === 'male' || suffix === 'female') {
      return sources.find(s => s.pokemon_id === pokemonId && s.source === suffix)?.id
    }
    return sources.find(s => s.pokemon_id === pokemonId && s.name === suffix)?.id
  }

  const rows = (await pgPool.query('select id, complete_records from users_box_data;'))
    .rows
  let unmatched = []
  let changedRows = 0
  let totalDuplicatesRemoved = 0

  for (const row of rows) {
    try {
      const records = row.complete_records ?? []
      const migrated = records.map(record => {
        if (typeof record === 'number') return String(record)
        if (typeof record !== 'string') {
          // Not a number or string at all (null, boolean, object, ...) -
          // nothing to migrate to; report for manual review.
          unmatched.push({ boxRow: row.id, record })
          return record
        }
        const match = /^(\d+):(.+)$/.exec(record)
        if (!match) {
          // Already a plain "<id>" string, or an unrecognized shape
          // (empty string, "25:", non-numeric text, ...). Only the former
          // is expected; report anything else so real production shapes
          // surface instead of being silently swallowed.
          if (!/^\d+$/.test(record)) unmatched.push({ boxRow: row.id, record })
          return record
        }
        const [, idText, suffix] = match
        // Already migrated? Source ids are uuids.
        if (/^[0-9a-f-]{36}$/.test(suffix)) return record
        const sourceId = findSourceId(Number(idText), suffix)
        if (!sourceId) {
          unmatched.push({ boxRow: row.id, record })
          return record
        }
        return `${idText}:${sourceId}`
      })

      const deduped = [...new Set(migrated)]
      const duplicatesRemoved = migrated.length - deduped.length
      if (duplicatesRemoved > 0) {
        totalDuplicatesRemoved += duplicatesRemoved
        // migrated.indexOf(v) !== i picks out every occurrence after the
        // first, i.e. exactly the values Set() dropped - printed so e.g.
        // two different legacy suffixes collapsing onto the same uuid is
        // distinguishable from a plain 1 / "1" duplicate pair.
        const removedValues = migrated.filter((v, i) => migrated.indexOf(v) !== i)
        console.log(
          `  box row ${row.id}: removed ${duplicatesRemoved} duplicate(s) after mapping: ${removedValues.join(', ')}`
        )
      }

      // Compare as JSON (not via String() coercion) so a type-only change
      // (number 60 -> string "60") still counts as a change that needs writing.
      const isUnchanged = JSON.stringify(records) === JSON.stringify(deduped)
      if (isUnchanged) continue

      changedRows++
      console.log(
        `  box row ${row.id}: ${JSON.stringify(records)} -> ${JSON.stringify(deduped)}`
      )
      if (!dryRun) {
        await pgPool.query(
          'update users_box_data set complete_records = $1 where id = $2;',
          [JSON.stringify(deduped), row.id]
        )
      }
    } catch (err) {
      console.error(`Error processing users_box_data.id=${row.id}`)
      throw err
    }
  }

  console.log(`Checked ${rows.length} users_box_data rows; changed ${changedRows}.`)
  if (totalDuplicatesRemoved > 0) {
    console.log(`Removed ${totalDuplicatesRemoved} duplicate record(s) total.`)
  }
  if (unmatched.length) {
    console.log('UNMATCHED entries (left as-is, review manually):')
    unmatched.forEach(u =>
      console.log(`  box row ${u.boxRow}: ${JSON.stringify(u.record)}`)
    )
  }
  if (dryRun) {
    console.log('\nDRY RUN — no rows written.')
  }
  await pgPool.end()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
