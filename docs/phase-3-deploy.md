# Phase 3 deploy runbook

Phase 3 ships a new `users_source_overrides` table alongside code that reads
and writes it on every `/api/all-pokemon` request. Ordering is load-bearing:
if the code deploys before the table exists, every `/api/all-pokemon` request
500s. Follow this sequence in order.

## Sequence

1. **Fresh production dump** (standing rule — never run data-touching work
   against production without one). See `CLAUDE.md` for the restore command
   and backup location.
2. **Apply the overrides migration**:
   `adhoc/scripts/migrations/2026-08-users-source-overrides.sql`. This has to
   land before the code deploy — the completion engine and the source-override
   routes assume the table already exists.
3. **Deploy code** (normal GitHub Actions self-hosted-runner flow).
4. **Dry-run the complete-records migration** in the adhoc container:
   ```
   docker compose -f compose.dev.yml exec adhoc node scripts/migrate-complete-records.js --dry-run
   ```
   (swap the compose file for whatever production uses). Review the output
   closely before proceeding — in particular the unmatched and dedupe report.
   The suffix-matching path (`"123:Alolan"` → `"123:<sourceId>"`) was only
   ever exercised against synthetic dev data, not real production
   `complete_records` values, so this is the step most likely to surface
   something unexpected.
5. **Run it for real** (same command, without `--dry-run`) once the dry-run
   output looks sane.
6. **Smoke test**:
   - List view: completion checkmarks look right on load.
   - Box view: checked records match what's expected for a known game.
   - Pill override toggle: click a source pill, confirm it flips and the
     drawer/list both reflect it; clear the override afterward.

## The window between (3) and (5)

Between deploying code and running the complete-records migration for real,
box view checkboxes will read as unchecked (the new code expects
`complete_records` keys in the migrated shape, which don't exist yet for
users who haven't been migrated). If a user saves a checklist during that
window, the write goes through with the new key format sitting alongside any
old-format keys already in that row — a mix of formats in the same array.
This is expected and handled: `migrate-complete-records.js`'s dedupe step
collapses duplicate/mixed-format entries for the same record when it runs,
so step (5) cleans this up rather than leaving it stuck. Keep the window
between (3) and (5) as short as practical anyway.
