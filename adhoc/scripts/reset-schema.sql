-- drop table if exists users;
-- drop table if exists pokemon;
drop table if exists sources;
drop table if exists users_pokemon;
drop table if exists users_pokemon_sources;
-- drop table if exists game_versions;
drop table if exists pokeballs;

drop type if exists source_type;
drop type if exists pokemon_type;
create type source_type as enum ('male', 'female', 'npc-trade', 'side-game', 'regional', 'special', 'shiny', 'wild', 'original', 'mega', 'gmax', 'battle-only', 'variant', 'hatch', 'starter', 'evolved', 'prize', 'gift', 'pokewalker', 'fossil', 'honey-tree', 'event', 'game-corner', 'static-default');
create type pokemon_type as enum ('normal', 'fighting', 'flying', 'poison', 'ground', 'rock', 'bug', 'ghost', 'steel', 'fire', 'water', 'grass', 'electric', 'psychic', 'ice', 'dragon', 'dark', 'fairy',);


-- a0af5822-5822-4281-add6-f6c9de34a083
-- create table users (
--   id uuid primary key,
--   discord_id text not null,
--   discord_username text,
--   last_seen_at timestamp without time zone,
--   time_format integer default 0,
--   user_rules jsonb,
--   is_admin boolean not null default 'false'
-- );
-- avatar_pokemon integer

-- create table pokemon (
--   id integer primary key,
--   name text not null,
--   type1 pokemon_type not null,
--   type2 pokemon_type,
--   icon text,
--   default_image text,
--   bulbapedia_link text,
--   has_gender_differences boolean,
--   original_gen integer not null,
--   evolves_to integer[]
-- );

create table sources (
  id uuid primary key,
  pokemon_id integer not null,
  name text not null,
  description text,
  image text,
  gen integer not null, --0 is all
  source source_type,
  replace_default boolean not null default 'false',
);

-- create table user_overrides (
--   id uuid primary key,
--   source_id uuid not null,
--   is_required boolean not null
-- );

create table users_pokemon (
  id uuid primary key,
  user_id uuid not null,
  pokemon_id integer not null,
  notes text,
  game_id integer,
  pokeball integer default 1,
  caught_at timestamp without time zone
);

create table users_pokemon_sources (
  id uuid primary key,
  users_pokemon_id uuid not null,
  source_id uuid not null,
  is_inherited boolean not null default 'false'
);

-- create table game_versions (
--   id serial primary key,
--   game_order integer,
--   name text not null,
--   pokeapi_id integer,
--   generation_id integer not null,
--   is_spinoff boolean not null default 'false',
--   box_size integer,
--   max_boxes integer,
--   dex_limit integer,
--   ignore_gender boolean not null default 'false', 
--   ignore_regional_variants boolean not null default 'false',
--   ignore_rules boolean not null default 'false',
--   include_meltan_line boolean not null default 'false',
--   is_isolated boolean not null default 'false',
--   limited_dex jsonb
-- );

create table users_box_data (
  id uuid primary key,
  user_id uuid not null,
  game_id integer not null,
  complete_records jsonb
);

create table pokeballs (
  id serial primary key,
  name text not null,
  image text not null
);
