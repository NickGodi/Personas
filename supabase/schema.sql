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

insert into public.card_ornament_settings (tier) values
  ('lenda'), ('challenger'), ('grao_mestre'), ('mestre'), ('diamante'),
  ('esmeralda'), ('platina'), ('ouro'), ('prata'), ('bronze'), ('ferro'),
  ('madeira'), ('criminoso')
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

