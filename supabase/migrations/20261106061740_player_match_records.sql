-- Histórico acumulado de partidas reconhecidas pelo OCR.
create table if not exists public.player_match_records (
  id uuid primary key default gen_random_uuid(),
  player_id text not null check (char_length(player_id) between 1 and 128),
  season integer not null check (season between 1 and 999),
  result text not null check (result in ('victory', 'defeat', 'unrecorded')),
  kills integer not null check (kills between 0 and 100),
  deaths integer not null check (deaths between 0 and 100),
  assists integer not null check (assists between 0 and 100),
  minions integer not null check (minions between 0 and 2000),
  gold integer not null check (gold between 0 and 1000000),
  image_fingerprint text not null check (char_length(image_fingerprint) between 1 and 128),
  created_at timestamptz not null default now(),
  unique (player_id, season, image_fingerprint)
);

create index if not exists player_match_records_season_player_idx
  on public.player_match_records (season, player_id);

alter table public.player_match_records enable row level security;
revoke all on table public.player_match_records from public, anon, authenticated;
grant select on table public.player_match_records to anon, authenticated;
grant insert, update on table public.player_match_records to authenticated;

drop policy if exists "Anyone can read seasonal player match records" on public.player_match_records;
create policy "Anyone can read seasonal player match records"
  on public.player_match_records for select to anon, authenticated
  using (true);

drop policy if exists "Only creator can insert seasonal player match records" on public.player_match_records;
create policy "Only creator can insert seasonal player match records"
  on public.player_match_records for insert to authenticated
  with check (
    exists (
      select 1 from public.profiles creator_profile
      where creator_profile.id = (select auth.uid())
        and creator_profile.role = 'criador'
    )
  );

drop policy if exists "Only creator can update seasonal player match records" on public.player_match_records;
create policy "Only creator can update seasonal player match records"
  on public.player_match_records for update to authenticated
  using (
    exists (
      select 1 from public.profiles creator_profile
      where creator_profile.id = (select auth.uid())
        and creator_profile.role = 'criador'
    )
  )
  with check (
    exists (
      select 1 from public.profiles creator_profile
      where creator_profile.id = (select auth.uid())
        and creator_profile.role = 'criador'
    )
  );

-- Bring forward the latest legacy snapshot once, without assuming its result.
insert into public.player_match_records (
  player_id, season, result, kills, deaths, assists, minions, gold, image_fingerprint
)
select player_id, 1, 'unrecorded', kills, deaths, assists, minions, gold, 'legacy:' || player_id
from public.player_match_stats
on conflict (player_id, season, image_fingerprint) do nothing;
