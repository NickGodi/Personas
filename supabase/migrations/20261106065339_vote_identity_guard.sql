-- Index the auth foreign key and bind public vote identity to the signed-in profile.
create index if not exists season_player_votes_voter_auth_user_idx
  on public.season_player_votes (voter_auth_user_id);

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
