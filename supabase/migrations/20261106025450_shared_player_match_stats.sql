create table if not exists public.player_match_stats (
  player_id text primary key check (char_length(player_id) between 1 and 128),
  kills integer not null default 0 check (kills between 0 and 100),
  deaths integer not null default 0 check (deaths between 0 and 100),
  assists integer not null default 0 check (assists between 0 and 100),
  minions integer not null default 0 check (minions between 0 and 2000),
  gold integer not null default 0 check (gold between 0 and 1000000),
  updated_at timestamptz not null default now()
);

alter table public.player_match_stats enable row level security;
revoke all on table public.player_match_stats from public, anon, authenticated;
grant select on table public.player_match_stats to anon, authenticated;
grant insert, update on table public.player_match_stats to authenticated;

drop policy if exists "Anyone can read latest player match statistics" on public.player_match_stats;
create policy "Anyone can read latest player match statistics"
  on public.player_match_stats for select to anon, authenticated
  using (true);

drop policy if exists "Only creator can insert player match statistics" on public.player_match_stats;
create policy "Only creator can insert player match statistics"
  on public.player_match_stats for insert to authenticated
  with check (
    exists (
      select 1 from public.profiles creator_profile
      where creator_profile.id = (select auth.uid())
        and creator_profile.role = 'criador'
    )
  );

drop policy if exists "Only creator can update player match statistics" on public.player_match_stats;
create policy "Only creator can update player match statistics"
  on public.player_match_stats for update to authenticated
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

insert into public.player_match_stats (player_id, kills, deaths, assists, minions, gold)
values ('user_nicolas', 19, 9, 5, 330, 23941)
on conflict (player_id) do update set
  kills = excluded.kills,
  deaths = excluded.deaths,
  assists = excluded.assists,
  minions = excluded.minions,
  gold = excluded.gold,
  updated_at = now();
