-- Phase 3 findings: home-region data, isolation groups, derived original tag.
-- Home-region rule: a catch is "from home region" iff its game's generation
-- equals the pokemon's original_gen AND the game's region equals the
-- pokemon's home_region. Satisfaction is derived from catches, not stored.

alter table game_versions add column if not exists region text;
alter table game_versions add column if not exists isolation_group text;
alter table game_versions add column if not exists transfer_gen integer;
alter table pokemon add column if not exists home_region text;

update game_versions set region = 'Kanto'  where id in (1, 2, 3, 12, 13, 31, 32, 38);
update game_versions set region = 'Johto'  where id in (4, 5, 6, 17, 18, 39);
update game_versions set region = 'Hoenn'  where id in (7, 8, 9, 25, 26);
update game_versions set region = 'Orre'   where id in (10, 11);
update game_versions set region = 'Sinnoh' where id in (14, 15, 16, 35, 36);
update game_versions set region = 'Unova'  where id in (19, 20, 21, 22);
update game_versions set region = 'Kalos'  where id in (23, 24);
update game_versions set region = 'Alola'  where id in (27, 28, 29, 30);
update game_versions set region = 'Galar'  where id in (33, 34);
update game_versions set region = 'Hisui'  where id = 37;
update game_versions set region = 'Paldea' where id in (47, 48);
-- Channel (40), Box (41), Ranch (42), Ranger 1-3 (43-45), Battle Revolution
-- (46): peripherals with no host region. region stays null = never a home game.

-- Isolated games: their boxes only count catches made in the same group.
update game_versions set isolation_group = 'colosseum' where id = 10;
update game_versions set isolation_group = 'xd' where id = 11;
-- The Let's Go pair shares a group (they trade with each other), can't
-- receive Bank transfers, and its catches leave only via Home (gen 8+).
update game_versions
set isolation_group = 'lets-go', transfer_gen = 8, is_isolated = true
where id in (31, 32);

update pokemon set home_region = case original_gen
  when 1 then 'Kanto'
  when 2 then 'Johto'
  when 3 then 'Hoenn'
  when 4 then 'Sinnoh'
  when 5 then 'Unova'
  when 6 then 'Kalos'
  when 7 then 'Alola'
  when 8 then 'Galar'
  when 9 then 'Paldea'
end;
-- Legends Arceus newcomers debut in Hisui, not Galar. (No Hisuian form rows
-- exist in the dex data yet; if they are added later, set them here too.)
update pokemon set home_region = 'Hisui' where id between 899 and 905;
-- The Meltan line debuts in the Let's Go pair (Kanto).
update pokemon set home_region = 'Kanto' where id in (808, 809);

-- 'From home region' is now derived from catch data; stored links would
-- double-represent it.
delete from users_pokemon_sources ups using sources s
where s.id = ups.source_id and s.source = 'original';
