// One-time migration: complete_records entries move from
//   123  (number, base record)          -> "123"
//   "123:Alolan" / "123:male" (names)   -> "123:<sourceId>"
// Also dedupes each row's migrated array: after Task 8 shipped, users may
// have saved NEW-format keys alongside legacy ones (e.g. both `1` and `"1"`
// for the same record), so mapping alone can leave duplicate entries.
// Unmatched entries are kept as-is and reported for manual review.
import pgPool from '../pg-pool.js'

const main = async () => {
  const sources = (await pgPool.query('select id, pokemon_id, name, source from sources;'))
    .rows

  const findSourceId = (pokemonId, suffix) => {
    if (suffix === 'male' || suffix === 'female') {
      return sources.find(s => s.pokemon_id === pokemonId && s.source === suffix)?.id
    }
    return sources.find(s => s.pokemon_id === pokemonId && s.name === suffix)?.id
  }

  const rows = (await pgPool.query('select id, complete_records from users_box_data;')).rows
  let unmatched = []
  let changedRows = 0
  let totalDuplicatesRemoved = 0

  for (const row of rows) {
    const records = row.complete_records ?? []
    const migrated = records.map(record => {
      if (typeof record === 'number') return String(record)
      const match = /^(\d+):(.+)$/.exec(record)
      if (!match) return record // already a plain "<id>" string or unknown
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
      console.log(`  box row ${row.id}: removed ${duplicatesRemoved} duplicate(s) after mapping`)
    }

    // Compare as JSON (not via String() coercion) so a type-only change
    // (number 60 -> string "60") still counts as a change that needs writing.
    const isUnchanged = JSON.stringify(records) === JSON.stringify(deduped)
    if (isUnchanged) continue

    changedRows++
    await pgPool.query('update users_box_data set complete_records = $1 where id = $2;', [
      JSON.stringify(deduped),
      row.id,
    ])
  }

  console.log(`Checked ${rows.length} users_box_data rows; changed ${changedRows}.`)
  if (totalDuplicatesRemoved > 0) {
    console.log(`Removed ${totalDuplicatesRemoved} duplicate record(s) total.`)
  }
  if (unmatched.length) {
    console.log('UNMATCHED entries (left as-is, review manually):')
    unmatched.forEach(u => console.log(`  box row ${u.boxRow}: ${u.record}`))
  }
  await pgPool.end()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
