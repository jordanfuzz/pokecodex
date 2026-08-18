# Pokecodex

A Pokedex tracker across all Pokemon games for a lifetime catch-em-all
challenge. One user base (small, Discord-gated), one Postgres database, React
front end. See [docs/ROADMAP.md](docs/ROADMAP.md) for current priorities — the
Pokemon Bank shutdown (February 2027) makes gen 1–7 usability the deadline.

## Architecture

| Service    | Path     | What it is                                              |
| ---------- | -------- | ------------------------------------------------------- |
| `ui`       | `app/`   | React 19 + Vite dev server on :3000, proxies `/api`     |
| `api`      | `api/`   | Express + Passport (Discord OAuth) on :3003, ESM        |
| `postgres` | —        | Postgres 17, database `pokemon`, named volume `pg-data` |
| `adhoc`    | `adhoc/` | Idle container for manually run data scripts (PokeAPI)  |

Production runs the same stack via `compose.yml` on a TrueNAS box; deploys go
through the GitHub Actions self-hosted runner (`.github/workflows/main.yml`).

## Running locally (Windows)

```
npm start          # docker compose -f compose.dev.yml up -d --force-recreate
npm stop
```

- App: http://localhost:3000 — log in via http://localhost:3000/api/auth/dev-login
  (dev-only route, no Discord round-trip; logs in as the most recently seen user).
- Real Discord OAuth needs `CLIENT_ID`/`CLIENT_SECRET` in `.env` (see
  `.env.example`; values live in the production `.env`).
- API tests: `cd api && npm test` (mocha + supertest). Tests hit the compose
  Postgres on localhost:5432, so the dev stack must be up.
- The api container runs nodemon with `--legacy-watch` (polling) because file
  events don't cross Windows bind mounts. UI hot reload is handled by Vite.
- Postgres uses a **named volume**, not a bind mount — reset the DB with
  `docker compose -f compose.dev.yml down -v` then re-restore.

### Restoring data

Production dumps live in `~/pokecodex-backups/` (outside the repo). Restore:

```
docker compose -f compose.dev.yml exec -T postgres pg_restore -U postgres -d pokemon < ~/pokecodex-backups/<dump-file>
```

Never run data-touching work against production without a fresh dump first.

## Data model (database `pokemon`)

- `pokemon` — one row per trackable form/variant (~1000 rows)
- `sources` — **the crown jewels** (~5400 rows, hand-gathered): a source is a
  method of acquisition for a pokemon. Generic ones ("wild", "hatched") plus
  unique one-time sources (NPC gifts, static encounters like the Red Gyarados,
  in-game trades — anything Bulbapedia lists as "only one"). Unique sources are
  separate required entries for challenge completion.
- `game_versions` — games incl. spinoffs, with per-game dex rules/box sizes
- `users`, `users_pokemon`, `users_pokemon_sources`, `users_box_data` —
  per-user tracking state
- SQL is snake_case; the API camelizes on read (`camelize`). Repository modules
  (`api/src/*/**-repository.js`) own all SQL; routes never query directly.

## Gotchas

- **PokeAPI rate-limits aggressively and IP-bans.** Do not bulk-query the
  public instance. A local PokeAPI instance is planned (see roadmap phase 1.5).
- Do not scrape Bulbapedia ad hoc; the access strategy is a roadmap item.
- `old-notes/` (gitignored) holds copied Obsidian notes. Useful history, but
  possibly stale — confirm with Jordan before basing feature decisions on them.
- This is a public repo: keep credentials, hostnames, and infrastructure
  details out of committed files. `.env` is gitignored; keep it that way.
- Git Bash on Windows mangles `/container/paths` in docker args — prefix
  commands with `MSYS_NO_PATHCONV=1` when passing absolute paths to docker.
