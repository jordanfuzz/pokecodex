-- Personal per-source overrides: is_required=true forces a source excluded by
-- the user's general rules to be required; false excludes a normally required
-- one. Absent row = follow general rules.
create table if not exists users_source_overrides (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  source_id uuid not null references sources(id) on delete cascade,
  is_required boolean not null,
  unique (user_id, source_id)
);
