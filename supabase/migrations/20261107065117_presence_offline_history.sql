alter table public.presence_sessions
  add column if not exists ended_at timestamptz;

create index if not exists presence_sessions_user_id_idx
  on public.presence_sessions (user_id);
