-- Rode este arquivo no SQL Editor do projeto Supabase antes de habilitar cadastros.
-- Perfis são públicos; e-mail e senha ficam no Supabase Auth e não são expostos pela API.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.site_settings (
  singleton boolean primary key default true check (singleton),
  creator_email text,
  creator_handle text not null default '@nick'
);
insert into private.site_settings (singleton, creator_email, creator_handle)
values (true, null, '@nick')
on conflict (singleton) do nothing;

create table if not exists private.reserved_handles (
  handle text primary key,
  riot_id text unique
);
insert into private.reserved_handles (handle, riot_id) values
  ('@derick', 'derick#br1'),
  ('@nick', 'nicolas#br1'),
  ('@maycao', 'maycao#br1'),
  ('@vexy', 'vexy#br1'),
  ('@raven', 'raven#br1'),
  ('@celesta', 'celesta#br1'),
  ('@kairos', 'kairos#br1'),
  ('@reis', 'reis#br1'),
  ('@raiq', 'raiq#br1'),
  ('@yago', 'yago#br1'),
  ('@brutus', 'brutus#br1'),
  ('@teco', 'teco#br1'),
  ('@nickpresidiario', 'nickpresidiario#br1')
on conflict do nothing;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  handle text not null unique check (handle ~ '^@[a-z0-9._-]{2,24}$'),
  name text not null check (char_length(name) between 2 and 48),
  role text not null default 'jogador' check (role in ('criador', 'moderador', 'capitao', 'jogador', 'visitante')),
  avatar text,
  bio text not null default '',
  favorite_champion text not null default '',
  primary_lane text not null default 'PREENCHER' check (primary_lane in ('TOP', 'JUNGLE', 'MID', 'ADC', 'SUPORTE', 'PREENCHER')),
  riot_id text not null unique,
  created_at timestamptz not null default now()
);

-- Estado compartilhado do torneio e sessões online, usados pelas funções serverless da Vercel.
create table if not exists public.shared_app_state (
  state_key text primary key check (state_key = 'tournament'),
  state jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.presence_sessions (
  session_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_handle text not null,
  last_seen_at timestamptz not null default now()
);
create index if not exists presence_sessions_last_seen_idx on public.presence_sessions (last_seen_at);
alter table public.shared_app_state enable row level security;
alter table public.presence_sessions enable row level security;
revoke all on public.shared_app_state, public.presence_sessions from public, anon, authenticated;

alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant update (handle, name, avatar, bio, favorite_champion, primary_lane, riot_id)
  on public.profiles to authenticated;

drop policy if exists "Profiles are public" on public.profiles;
create policy "Profiles are public" on public.profiles for select using (true);
drop policy if exists "Players update only their profile" on public.profiles;
create policy "Players update only their profile" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create table if not exists public.card_ornament_settings (
  tier text primary key check (tier in (
    'lenda', 'challenger', 'grao_mestre', 'mestre', 'diamante', 'esmeralda',
    'platina', 'ouro', 'prata', 'bronze', 'ferro', 'madeira', 'criminoso'
  )),
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  updated_at timestamptz not null default now()
);

alter table public.card_ornament_settings enable row level security;
revoke all on table public.card_ornament_settings from public, anon, authenticated;
grant select on table public.card_ornament_settings to anon, authenticated;
grant update (settings, updated_at) on table public.card_ornament_settings to authenticated;

drop policy if exists "Anyone can read shared card ornaments" on public.card_ornament_settings;
create policy "Anyone can read shared card ornaments"
  on public.card_ornament_settings for select to anon, authenticated
  using (true);

drop policy if exists "Only creator can update shared card ornaments" on public.card_ornament_settings;
create policy "Only creator can update shared card ornaments"
  on public.card_ornament_settings for update to authenticated
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

insert into public.card_ornament_settings (tier, settings) values
  ('lenda', '{"showFrame":false,"scale":1.27,"heightScale":1.22,"topScale":0.8,"offsetX":0,"offsetY":8.5,"layer":"front"}'::jsonb),
  ('challenger', '{"showFrame":true,"scale":1.14,"heightScale":1.23,"topScale":0.8,"offsetX":0,"offsetY":9.5,"layer":"front"}'::jsonb),
  ('grao_mestre', '{"showFrame":true,"scale":1.1,"heightScale":1.38,"topScale":0.94,"offsetX":0,"offsetY":3,"layer":"front"}'::jsonb),
  ('mestre', '{"showFrame":true,"scale":1.15,"heightScale":1.25,"topScale":0.94,"offsetX":0,"offsetY":8.5,"layer":"front"}'::jsonb),
  ('diamante', '{"showFrame":true,"scale":1.12,"heightScale":1.28,"topScale":0.93,"offsetX":0,"offsetY":5.5,"layer":"front"}'::jsonb),
  ('esmeralda', '{"showFrame":true,"scale":1.16,"heightScale":1.31,"topScale":0.98,"offsetX":0,"offsetY":9,"layer":"front"}'::jsonb),
  ('platina', '{"showFrame":true,"scale":1.16,"heightScale":1.34,"topScale":0.94,"offsetX":0,"offsetY":7,"layer":"front"}'::jsonb),
  ('ouro', '{"showFrame":true,"scale":1.09,"heightScale":1.31,"topScale":0.94,"offsetX":0,"offsetY":7,"layer":"front"}'::jsonb),
  ('prata', '{"showFrame":true,"scale":1.3,"heightScale":1.14,"topScale":1.1,"offsetX":0,"offsetY":3,"layer":"front"}'::jsonb),
  ('bronze', '{"showFrame":true,"scale":1.34,"heightScale":1.06,"topScale":1.07,"offsetX":0,"offsetY":0,"layer":"front"}'::jsonb),
  ('ferro', '{"showFrame":true,"scale":1.32,"heightScale":1.03,"topScale":1.01,"offsetX":0,"offsetY":2,"layer":"front"}'::jsonb),
  ('madeira', '{"showFrame":true,"scale":1.35,"heightScale":1,"topScale":0.8,"offsetX":0,"offsetY":5.5,"layer":"front"}'::jsonb),
  ('criminoso', '{"showFrame":true,"scale":1.52,"heightScale":1,"topScale":0.8,"offsetX":0,"offsetY":5.5,"layer":"front"}'::jsonb)
on conflict (tier) do nothing;

create or replace function private.guard_profile_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  signed_up_email text;
  configured_creator_email text;
begin
  new.handle := lower(regexp_replace(trim(new.handle), '^@+', ''));
  new.handle := '@' || new.handle;
  new.riot_id := lower(regexp_replace(trim(new.riot_id), '\s*#\s*', '#', 'g'));
  select lower(u.email) into signed_up_email from auth.users u where u.id = new.id;
  select lower(s.creator_email) into configured_creator_email
    from private.site_settings s where s.singleton = true;

  if exists (select 1 from private.reserved_handles r where r.handle = new.handle)
     and not (configured_creator_email is not null
       and signed_up_email = configured_creator_email
       and new.handle = (select s.creator_handle from private.site_settings s where s.singleton = true)) then
    raise exception 'Este @ pertence a um perfil oficial do Personas.' using errcode = '23505';
  end if;

  if exists (select 1 from private.reserved_handles r where r.riot_id = new.riot_id)
     and not (configured_creator_email is not null
       and signed_up_email = configured_creator_email
       and new.handle = (select s.creator_handle from private.site_settings s where s.singleton = true)) then
    raise exception 'Este Riot ID pertence a um perfil oficial do Personas.' using errcode = '23505';
  end if;

  if configured_creator_email is not null and signed_up_email = configured_creator_email then
    new.role := 'criador';
  elsif tg_op = 'INSERT' then
    new.role := 'jogador';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_profile_identity on public.profiles;
create trigger guard_profile_identity
  before insert or update of handle, riot_id on public.profiles
  for each row execute function private.guard_profile_identity();

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  creator_email text;
  creator_handle text;
begin
  select lower(s.creator_email), s.creator_handle into creator_email, creator_handle
    from private.site_settings s where s.singleton = true;

  insert into public.profiles (id, handle, name, primary_lane, riot_id, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'handle', ''),
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.raw_user_meta_data ->> 'primary_lane', 'PREENCHER'),
    coalesce(new.raw_user_meta_data ->> 'riot_id', ''),
    case when creator_email is not null and lower(new.email) = creator_email
      and coalesce(new.raw_user_meta_data ->> 'handle', '') = creator_handle
      then 'criador' else 'jogador' end
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_auth_user();

-- Últimas estatísticas de partida reconhecidas nos prints. A leitura é pública;
-- somente uma conta com cargo Criador pode inserir ou substituir os valores.
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

insert into public.player_match_records (
  player_id, season, result, kills, deaths, assists, minions, gold, image_fingerprint
)
select player_id, 1, 'unrecorded', kills, deaths, assists, minions, gold, 'legacy:' || player_id
from public.player_match_stats
on conflict (player_id, season, image_fingerprint) do nothing;

-- A shared season gate makes vote permissions consistent across browsers.
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
create index if not exists season_player_votes_voter_auth_user_idx
  on public.season_player_votes (voter_auth_user_id);

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
    and from_user_id = (select auth.uid())::text
    and exists (
      select 1 from public.profiles voter_profile
      where voter_profile.id = (select auth.uid())
        and voter_profile.name = season_player_votes.from_user_name
        and voter_profile.handle = season_player_votes.from_user_handle
    )
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

-- User-scoped in-app notifications. Ratings are delivered only to creator accounts.
-- Creator accounts may rate their own profile once per season; everyone else may
-- only rate other profiles. This keeps the UI rule enforced by the database too.
drop policy if exists "Authenticated users can rate once while season is active" on public.season_player_votes;
create policy "Authenticated users can rate once while season is active"
  on public.season_player_votes for insert to authenticated
  with check (
    voter_auth_user_id = (select auth.uid())
    and from_user_id = (select auth.uid())::text
    and exists (
      select 1 from public.profiles voter_profile
      where voter_profile.id = (select auth.uid())
        and voter_profile.name = season_player_votes.from_user_name
        and voter_profile.handle = season_player_votes.from_user_handle
    )
    and (
      target_user_id <> from_user_id
      or exists (
        select 1 from public.profiles creator_profile
        where creator_profile.id = (select auth.uid())
          and creator_profile.role = 'criador'
      )
    )
    and exists (
      select 1 from public.shared_season_control season_control
      where season_control.singleton = true
        and season_control.season = season_player_votes.season
        and season_control.status = 'active'
    )
  );

create table if not exists public.user_notifications (
  event_key text primary key check (char_length(event_key) between 1 and 200),
  recipient_auth_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  message text not null check (char_length(message) between 1 and 500),
  type text not null check (type in ('vote', 'team', 'captain_request', 'report', 'system', 'card')),
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists user_notifications_recipient_created_idx
  on public.user_notifications (recipient_auth_user_id, created_at desc);

alter table public.user_notifications enable row level security;
revoke all on table public.user_notifications from public, anon, authenticated;
grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.user_notifications to authenticated;

drop policy if exists "Users can read their notifications; creators can read vote notices" on public.user_notifications;
create policy "Users can read their notifications; creators can read vote notices"
  on public.user_notifications for select to authenticated
  using (
    recipient_auth_user_id = (select auth.uid())
    and (
      type <> 'vote'
      or exists (
        select 1 from public.profiles creator_profile
        where creator_profile.id = (select auth.uid())
          and creator_profile.role = 'criador'
      )
    )
  );

drop policy if exists "Only creators can insert event notifications" on public.user_notifications;
create policy "Only creators can insert event notifications"
  on public.user_notifications for insert to authenticated
  with check (
    exists (
      select 1 from public.profiles creator_profile
      where creator_profile.id = (select auth.uid())
        and creator_profile.role = 'criador'
    )
    and type <> 'vote'
  );

drop policy if exists "Users can update their notifications; creators can update vote notices" on public.user_notifications;
create policy "Users can update their notifications; creators can update vote notices"
  on public.user_notifications for update to authenticated
  using (
    recipient_auth_user_id = (select auth.uid())
    and (
      type <> 'vote'
      or exists (
        select 1 from public.profiles creator_profile
        where creator_profile.id = (select auth.uid())
          and creator_profile.role = 'criador'
      )
    )
  )
  with check (
    recipient_auth_user_id = (select auth.uid())
    and (
      type <> 'vote'
      or exists (
        select 1 from public.profiles creator_profile
        where creator_profile.id = (select auth.uid())
          and creator_profile.role = 'criador'
      )
    )
  );

drop policy if exists "Users can delete their notifications; creators can delete vote notices" on public.user_notifications;
create policy "Users can delete their notifications; creators can delete vote notices"
  on public.user_notifications for delete to authenticated
  using (
    recipient_auth_user_id = (select auth.uid())
    and (
      type <> 'vote'
      or exists (
        select 1 from public.profiles creator_profile
        where creator_profile.id = (select auth.uid())
          and creator_profile.role = 'criador'
      )
    )
  );

create or replace function public.notify_creators_of_new_vote()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_notifications (event_key, recipient_auth_user_id, title, message, type)
  select
    'vote:' || new.id::text,
    creator_profile.id,
    'Nova nota recebida',
    format('%s avaliou %s com nota %s na temporada %s.', new.from_user_name, new.target_user_name, new.score, new.season),
    'vote'
  from public.profiles creator_profile
  where creator_profile.role = 'criador'
  on conflict (event_key) do nothing;

  return new;
end;
$$;

revoke all on function public.notify_creators_of_new_vote() from public, anon, authenticated;

drop trigger if exists notify_creators_after_vote on public.season_player_votes;
create trigger notify_creators_after_vote
  after insert on public.season_player_votes
  for each row execute function public.notify_creators_of_new_vote();


create or replace function public.set_tournament_attendance(p_actor_id text, p_checked_in boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_season integer;
  v_state jsonb;
  v_attendee_ids jsonb;
  v_captain_ids jsonb;
  v_now_ms bigint;
begin
  if nullif(btrim(p_actor_id), '') is null or length(p_actor_id) > 160 then
    raise exception 'Conta inválida para o check-in.' using errcode = '22023';
  end if;

  if p_checked_in is null then
    raise exception 'Estado do check-in inválido.' using errcode = '22023';
  end if;

  select season_control.season
    into v_season
    from public.shared_season_control as season_control
   where season_control.singleton = true
     and season_control.status = 'ready'
   for share;

  if not found then
    raise exception 'O check-in desta temporada está encerrado.' using errcode = '55000';
  end if;

  v_now_ms := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;

  insert into public.shared_app_state (state_key, state, updated_at)
  values (
    'tournament',
    jsonb_build_object(
      'updatedAt', v_now_ms,
      'tournamentStarted', false,
      'attendeeIds', '[]'::jsonb,
      'captainIds', jsonb_build_array('', ''),
      'playerPoolIds', '[]'::jsonb,
      'teams', '[]'::jsonb,
      'draftMode', 'random',
      'seriesFormat', 'MD3',
      'draftStage', 'setup',
      'captainDraftTurn', null,
      'predefinedTeams', null,
      'confirmedDeckCardId', null,
      'attendanceSeason', v_season
    ),
    clock_timestamp()
  )
  on conflict (state_key) do nothing;

  select app_state.state
    into v_state
    from public.shared_app_state as app_state
   where app_state.state_key = 'tournament'
   for update;

  if coalesce((v_state ->> 'tournamentStarted')::boolean, false) then
    raise exception 'O check-in desta temporada está encerrado.' using errcode = '55000';
  end if;

  if v_state ? 'attendanceSeason'
     and nullif(v_state ->> 'attendanceSeason', '') is not null
     and (v_state ->> 'attendanceSeason')::integer <> v_season then
    raise exception 'Aguarde a sincronização do check-in desta temporada.' using errcode = '55000';
  end if;

  select coalesce(jsonb_agg(to_jsonb(attendees.id) order by attendees.first_position), '[]'::jsonb)
    into v_attendee_ids
    from (
      select attendee.value as id, min(attendee.ordinality) as first_position
        from jsonb_array_elements_text(coalesce(v_state -> 'attendeeIds', '[]'::jsonb))
             with ordinality as attendee(value, ordinality)
       group by attendee.value
    ) as attendees
   where p_checked_in or attendees.id <> p_actor_id;

  if p_checked_in
     and not exists (
       select 1
         from jsonb_array_elements_text(coalesce(v_state -> 'attendeeIds', '[]'::jsonb)) as attendee(value)
        where attendee.value = p_actor_id
     ) then
    v_attendee_ids := v_attendee_ids || jsonb_build_array(p_actor_id);
  end if;

  v_captain_ids := coalesce(v_state -> 'captainIds', jsonb_build_array('', ''));
  if jsonb_typeof(v_captain_ids) <> 'array' or jsonb_array_length(v_captain_ids) <> 2 then
    v_captain_ids := jsonb_build_array('', '');
  end if;

  if not p_checked_in then
    v_captain_ids := jsonb_build_array(
      case when v_captain_ids ->> 0 = p_actor_id then '' else coalesce(v_captain_ids ->> 0, '') end,
      case when v_captain_ids ->> 1 = p_actor_id then '' else coalesce(v_captain_ids ->> 1, '') end
    );
  end if;

  v_now_ms := greatest(
    v_now_ms,
    coalesce(nullif(v_state ->> 'updatedAt', '')::bigint, 0) + 1
  );

  v_state := jsonb_set(v_state, '{attendeeIds}', v_attendee_ids, true);
  v_state := jsonb_set(v_state, '{captainIds}', v_captain_ids, true);
  v_state := jsonb_set(v_state, '{attendanceSeason}', to_jsonb(v_season), true);
  v_state := jsonb_set(v_state, '{updatedAt}', to_jsonb(v_now_ms), true);

  update public.shared_app_state as app_state
     set state = v_state,
         updated_at = clock_timestamp()
   where app_state.state_key = 'tournament';

  return v_state;
end;
$$;

revoke all on function public.set_tournament_attendance(text, boolean) from public, anon, authenticated;
grant execute on function public.set_tournament_attendance(text, boolean) to service_role;

