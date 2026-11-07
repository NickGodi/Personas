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
