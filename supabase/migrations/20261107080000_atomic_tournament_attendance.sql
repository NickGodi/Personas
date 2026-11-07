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
