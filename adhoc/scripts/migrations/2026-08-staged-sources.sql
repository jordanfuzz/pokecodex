-- Phase 4 increment 2: unified review worklist for parsed Bulbapedia
-- candidates and unmatched existing sources rows. Dev DB only until the
-- flow is proven. Idempotent: API test setup applies it on every run.
do $$ begin
  create type staged_row_kind as enum ('new', 'audit', 'existing-unmatched');
exception when duplicate_object then null; end $$;

do $$ begin
  create type staged_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type staged_resolution as enum ('created', 'updated', 'deleted', 'kept', 'paired');
exception when duplicate_object then null; end $$;

do $$ begin
  create type staged_confidence as enum ('low', 'medium', 'high');
exception when duplicate_object then null; end $$;

create table if not exists staged_sources (
  id uuid primary key,
  natural_key text not null unique,
  row_kind staged_row_kind not null,
  status staged_status not null default 'pending',
  resolution staged_resolution,
  -- candidate payload (null on existing-unmatched rows except pokemon_id/gen)
  pokemon_id integer references pokemon(id),
  name text,
  description text,
  image text,
  gen integer,
  source source_type,
  replace_default boolean default false,
  confidence staged_confidence,
  -- pairing / audit. No cascade: the guarded-delete transaction nulls these
  -- explicitly so reviewed rows survive as an audit trail.
  matched_source_id uuid references sources(id),
  suggested_source_id uuid references sources(id),
  suggestion_reason text,
  created_source_id uuid,
  pairing_confirmed boolean not null default false,
  expected_absent boolean not null default false,
  -- provenance
  page_title text,
  revid integer,
  raw_snippet text,
  origin text,
  games text[],
  parser_version text,
  staged_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists staged_sources_gen_status_idx
  on staged_sources (gen, status);
create index if not exists staged_sources_matched_source_idx
  on staged_sources (matched_source_id);
