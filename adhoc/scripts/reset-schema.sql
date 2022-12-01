drop table if exists users;
-- drop table if exists pokemon;
drop table if exists sources;
drop table if exists users_pokemon;
drop table if exists users_pokemon_sources;

drop type if exists source_type;
drop type if exists pokemon_type;
create type source_type as enum ('male', 'female', 'npc-trade', 'side-game', 'regional', 'special', 'shiny', 'wild', 'original', 'mega', 'gmax', 'battle-only', 'variant');
create type pokemon_type as enum ('normal', 'fighting', 'flying', 'poison', 'ground', 'rock', 'bug', 'ghost', 'steel', 'fire', 'water', 'grass', 'electric', 'psychic', 'ice', 'dragon', 'dark', 'fairy',);

create table users (
  id uuid primary key,
  avatar text
);

-- create table pokemon (
--   id integer primary key,
--   name text not null,
--   type1 pokemon_type not null,
--   type2 pokemon_type,
--   icon text,
--   default_image text,
--   female_image text,
--   shiny_image text
--   bulbapedia_link text,
--   has_gender_differences boolean,
--   original_gen integer not null
-- );

create table sources (
  id uuid primary key,
  pokemon_id integer not null,
  name text not null,
  description text,
  image text,
  gen integer not null, --0 is all
  source source_type
);

create table users_pokemon (
  id uuid primary key,
  pokemon_id integer not null,
  notes text,
  caught_at timestamp without time zone
);

create table users_pokemon_sources (
  id uuid primary key,
  users_pokemon_id uuid not null,
  source_id uuid not null
);