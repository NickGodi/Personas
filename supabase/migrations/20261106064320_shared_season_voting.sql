-- Shared season control and authenticated, one-per-player ratings.
create table if not exists public.shared_season_control (
  singleton boolean primary key default true check (singleton),
  season integer not null check (season between 1 and 999),
  status text not null check (status in ('ready', 'active')),
  started_at timestamptz,
  ends_at timestamptz,
  updated_at timestamptz not null default now(),
  check (
    (status = 'ready' and started_at is null and ends_at is null)
    or (status = 'active' and started_at is not null and ends_at is not null)
  )
);

insert into public.shared_season_control (singleton, season, status)
values (true, 1, 'ready')
on conflict (singleton) do nothing;

alter table public.shared_season_control enable row level security;
revoke all on table public.shared_season_control from public, anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on table public.shared_season_control to anon, authenticated;
grant insert, update on table public.shared_season_control to authenticated;

drop policy if exists "Anyone can read shared season control" on public.shared_season_control;
create policy "Anyone can read shared season control"
  on public.shared_season_control for select to anon, authenticated
  using (true);

drop policy if exists "Only creator can insert shared season control" on public.shared_season_control;
create policy "Only creator can insert shared season control"
  on public.shared_season_control for insert to authenticated
  with check (
    exists (
      select 1 from public.profiles creator_profile
      where creator_profile.id = (select auth.uid())
        and creator_profile.role = 'criador'
    )
  );

drop policy if exists "Only creator can update shared season control" on public.shared_season_control;
create policy "Only creator can update shared season control"
  on public.shared_season_control for update to authenticated
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

create table if not exists public.season_player_votes (
  id uuid primary key default gen_random_uuid(),
  season integer not null check (season between 1 and 999),
  voter_auth_user_id uuid not null references auth.users(id) on delete cascade,
  from_user_id text not null check (char_length(from_user_id) between 1 and 128),
  from_user_name text not null check (char_length(from_user_name) between 1 and 48),
  from_user_handle text not null check (char_length(from_user_handle) between 2 and 25),
  target_user_id text not null check (char_length(target_user_id) between 1 and 128),
  target_user_name text not null check (char_length(target_user_name) between 1 and 48),
  score integer not null check (score between 0 and 100),
  comment text check (comment is null or char_length(comment) <= 500),
  created_at timestamptz not null default now(),
  constraint season_player_votes_once_per_target unique (season, voter_auth_user_id, target_user_id)
);

create index if not exists season_player_votes_season_target_idx
  on public.season_player_votes (season, target_user_id);

alter table public.season_player_votes enable row level security;
revoke all on table public.season_player_votes from public, anon, authenticated;
grant select on table public.season_player_votes to anon, authenticated;
grant insert, delete on table public.season_player_votes to authenticated;

drop policy if exists "Anyone can read shared season votes" on public.season_player_votes;
create policy "Anyone can read shared season votes"
  on public.season_player_votes for select to anon, authenticated
  using (true);

drop policy if exists "Authenticated users can rate once while season is active" on public.season_player_votes;
create policy "Authenticated users can rate once while season is active"
  on public.season_player_votes for insert to authenticated
  with check (
    voter_auth_user_id = (select auth.uid())
    and exists (
      select 1 from public.shared_season_control season_control
      where season_control.singleton = true
        and season_control.season = season_player_votes.season
        and season_control.status = 'active'
    )
  );

drop policy if exists "Only creator can delete season votes" on public.season_player_votes;
create policy "Only creator can delete season votes"
  on public.season_player_votes for delete to authenticated
  using (
    exists (
      select 1 from public.profiles creator_profile
      where creator_profile.id = (select auth.uid())
        and creator_profile.role = 'criador'
    )
  );
